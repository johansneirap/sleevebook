"use server";

import { type CopyInput, copyInputSchema, layoutSchema } from "@sleevebook/binder-core";
import { binderVersion, cardInstance } from "@sleevebook/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadUserLayouts } from "./collection";
import { db } from "./db";
import { assertBinderOwner, assertUser } from "./session";

// Fase 7: mutations of physical copies. Every action checks the signed-in user
// owns the copies (and the binder, when a pocket is involved).

const MAX_COPIES_PER_ADD = 50;

type CopyFormInput = z.input<typeof copyInputSchema>;

function toColumns(input: CopyInput) {
  return {
    variantId: input.variantId,
    language: input.language,
    condition: input.condition,
    gradingCompany: input.gradingCompany,
    gradingGrade: input.gradingGrade === null ? null : String(input.gradingGrade),
    purchasePrice: input.purchasePrice === null ? null : String(input.purchasePrice),
    purchaseCurrency: input.purchaseCurrency,
    valueUsd: input.valueUsd === null ? null : String(input.valueUsd),
    notes: input.notes || null,
    acquiredAt: input.acquiredAt,
  };
}

function revalidateCollection(binderIds: Iterable<string> = []) {
  revalidatePath("/coleccion");
  revalidatePath("/intercambios");
  for (const binderId of binderIds) {
    revalidatePath(`/binders/${binderId}`);
    revalidatePath(`/binders/${binderId}/editar`);
  }
}

/** Adds `quantity` identical copies. Returns their ids. */
export async function createCopies(input: CopyFormInput, quantity = 1): Promise<string[]> {
  const current = await assertUser();
  const parsed = copyInputSchema.parse(input);
  const count = z.number().int().min(1).max(MAX_COPIES_PER_ADD).parse(quantity);
  const rows = await db
    .insert(cardInstance)
    .values(Array.from({ length: count }, () => ({ userId: current.id, ...toColumns(parsed) })))
    .returning({ id: cardInstance.id });
  revalidateCollection();
  return rows.map((row) => row.id);
}

/** Edits a copy. The variant can't change: delete and add instead. */
export async function updateCopy(copyId: string, input: CopyFormInput): Promise<void> {
  const current = await assertUser();
  const parsed = copyInputSchema.parse(input);
  const [existing] = await db
    .select({ variantId: cardInstance.variantId })
    .from(cardInstance)
    .where(and(eq(cardInstance.id, copyId), eq(cardInstance.userId, current.id)));
  if (!existing) {
    throw new Error("No autorizado");
  }
  if (existing.variantId !== parsed.variantId) {
    throw new Error("No se puede cambiar la carta de una copia");
  }
  await db
    .update(cardInstance)
    .set({ ...toColumns(parsed), updatedAt: new Date() })
    .where(eq(cardInstance.id, copyId));
  const placedIn = (await loadUserLayouts(current.id))
    .filter((layout) =>
      Object.values(layout.pockets).some((c) => c.kind === "card" && c.instance === copyId),
    )
    .map((layout) => layout.binderId);
  revalidateCollection(placedIn);
}

/**
 * Rewrites the latest layout of `binderId`, applying `patch` to its pockets.
 * Returns true when something changed.
 */
async function patchLatestPockets(
  binderId: string,
  patch: (pockets: ReturnType<typeof layoutSchema.parse>["pockets"]) => boolean,
): Promise<boolean> {
  const [versionRow] = await db
    .select({ id: binderVersion.id, layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return false;
  }
  const layout = layoutSchema.parse(versionRow.layout);
  const pockets = { ...layout.pockets };
  if (!patch(pockets)) {
    return false;
  }
  await db
    .update(binderVersion)
    .set({ layout: layoutSchema.parse({ ...layout, pockets }) })
    .where(eq(binderVersion.id, versionRow.id));
  return true;
}

/** Removes copies and unlinks them from any pocket that pointed at them. */
export async function deleteCopies(copyIds: string[]): Promise<void> {
  const current = await assertUser();
  if (copyIds.length === 0) {
    return;
  }
  const owned = await db
    .select({ id: cardInstance.id })
    .from(cardInstance)
    .where(and(eq(cardInstance.userId, current.id), inArray(cardInstance.id, copyIds)));
  const ids = new Set(owned.map((row) => row.id));
  if (ids.size === 0) {
    return;
  }

  const touched: string[] = [];
  for (const layout of await loadUserLayouts(current.id)) {
    const changed = await patchLatestPockets(layout.binderId, (pockets) => {
      let any = false;
      for (const [code, content] of Object.entries(pockets)) {
        if (content.kind === "card" && content.instance && ids.has(content.instance)) {
          pockets[code] = { ...content, instance: null };
          any = true;
        }
      }
      return any;
    });
    if (changed) {
      touched.push(layout.binderId);
    }
  }
  await db.delete(cardInstance).where(inArray(cardInstance.id, [...ids]));
  revalidateCollection(touched);
}

export type LinkResult =
  | { ok: true }
  | { ok: false; reason: "ocupada"; binderId: string; binderName: string; pocketCode: string };

/**
 * Links (or with `copyId` null, unlinks) the copy shown in a binder pocket.
 * The copy must be the same card as the pocket. A copy already in another
 * pocket is refused unless `move` is set, which unlinks it there first.
 */
export async function linkPocketCopy(
  binderId: string,
  pocketCode: string,
  copyId: string | null,
  move = false,
): Promise<LinkResult> {
  const current = await assertBinderOwner(binderId);

  if (copyId !== null) {
    const [copy] = await db
      .select({ variantId: cardInstance.variantId })
      .from(cardInstance)
      .where(and(eq(cardInstance.id, copyId), eq(cardInstance.userId, current.id)));
    if (!copy) {
      throw new Error("No autorizado");
    }

    const layouts = await loadUserLayouts(current.id);
    const pocket = layouts.find((l) => l.binderId === binderId)?.pockets[pocketCode];
    if (pocket?.kind !== "card" || pocket.variant !== copy.variantId) {
      throw new Error("La copia no corresponde a la carta del bolsillo");
    }

    for (const layout of layouts) {
      for (const [code, content] of Object.entries(layout.pockets)) {
        const elsewhere = layout.binderId !== binderId || code !== pocketCode;
        if (content.kind === "card" && content.instance === copyId && elsewhere) {
          if (!move) {
            return {
              ok: false,
              reason: "ocupada",
              binderId: layout.binderId,
              binderName: layout.binderName,
              pocketCode: code,
            };
          }
          await patchLatestPockets(layout.binderId, (pockets) => {
            const latest = pockets[code];
            if (latest?.kind !== "card" || latest.instance !== copyId) {
              return false;
            }
            pockets[code] = { ...latest, instance: null };
            return true;
          });
          revalidateCollection([layout.binderId]);
        }
      }
    }
  }

  await patchLatestPockets(binderId, (pockets) => {
    const content = pockets[pocketCode];
    if (content?.kind !== "card") {
      throw new Error("El bolsillo no tiene una carta");
    }
    pockets[pocketCode] = { ...content, instance: copyId };
    return true;
  });
  revalidateCollection([binderId]);
  return { ok: true };
}

/** Creates a copy of the pocket's card with these details and links it. */
export async function createCopyForPocket(
  binderId: string,
  pocketCode: string,
  input: Omit<CopyFormInput, "variantId">,
): Promise<string> {
  const current = await assertBinderOwner(binderId);
  const layouts = await loadUserLayouts(current.id);
  const pocket = layouts.find((l) => l.binderId === binderId)?.pockets[pocketCode];
  if (pocket?.kind !== "card") {
    throw new Error("El bolsillo no tiene una carta");
  }
  const parsed = copyInputSchema.parse({ ...input, variantId: pocket.variant });
  const [row] = await db
    .insert(cardInstance)
    .values({ userId: current.id, ...toColumns(parsed) })
    .returning({ id: cardInstance.id });
  if (!row) {
    throw new Error("No se pudo crear la copia");
  }
  await linkPocketCopy(binderId, pocketCode, row.id);
  return row.id;
}

/**
 * One-time helper for existing binders: creates an EN / NM copy for every card
 * pocket that has no copy yet and links it. A pocket holding `count` cards
 * gets one linked copy plus `count - 1` loose copies. Returns how many copies
 * were created.
 */
export async function createCopiesFromBinders(): Promise<number> {
  const current = await assertUser();
  const layouts = await loadUserLayouts(current.id);
  const existing = new Set(
    (
      await db
        .select({ id: cardInstance.id })
        .from(cardInstance)
        .where(eq(cardInstance.userId, current.id))
    ).map((row) => row.id),
  );

  let created = 0;
  const touched: string[] = [];
  for (const layout of layouts) {
    const pending = Object.entries(layout.pockets).filter(
      ([, content]) =>
        content.kind === "card" && !(content.instance && existing.has(content.instance)),
    );
    if (pending.length === 0) {
      continue;
    }

    const links = new Map<string, string>();
    for (const [code, content] of pending) {
      if (content.kind !== "card") {
        continue;
      }
      const count = content.count ?? 1;
      const rows = await db
        .insert(cardInstance)
        .values(
          Array.from({ length: count }, () => ({ userId: current.id, variantId: content.variant })),
        )
        .returning({ id: cardInstance.id });
      created += rows.length;
      const first = rows[0];
      if (first) {
        links.set(code, first.id);
      }
    }

    await patchLatestPockets(layout.binderId, (pockets) => {
      for (const [code, copyId] of links) {
        const content = pockets[code];
        if (content?.kind === "card") {
          pockets[code] = { ...content, instance: copyId };
        }
      }
      return links.size > 0;
    });
    touched.push(layout.binderId);
  }

  revalidateCollection(touched);
  return created;
}

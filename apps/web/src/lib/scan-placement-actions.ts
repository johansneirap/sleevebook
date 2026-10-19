"use server";

import {
  type Layout,
  layoutSchema,
  parsePocketCode,
  pocketCodeToGlobalIndex,
} from "@sleevebook/binder-core";
import { binder, binderVersion, cardVariant } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { applyPocketChanges } from "./pocket-actions";
import { assertBinderOwner } from "./session";

export type ScanPlacementResult =
  | { status: "placed"; binderId: string; binderName: string; pocketCode: string; spread: number }
  | { status: "full"; binderName: string }
  | { status: "invalid"; message: string };

const variantIdSchema = z.uuid();

/**
 * Spread index (see generateSpreads) that shows a pocket: sheet n front is
 * the second face of spread n-1, sheet n back is the first face of spread n.
 */
function spreadForPocket(sheet: number, side: "F" | "B"): number {
  return side === "F" ? sheet - 1 : sheet;
}

/** Lowest-index unlocked empty pocket, or null when the binder is full. */
function firstEmptyPocket(layout: Layout): string | null {
  let best: { code: string; index: number } | null = null;
  for (const [code, content] of Object.entries(layout.pockets)) {
    if (content.kind !== "empty" || content.locked) {
      continue;
    }
    const index = pocketCodeToGlobalIndex(parsePocketCode(code), layout.format);
    if (best === null || index < best.index) {
      best = { code, index };
    }
  }
  return best?.code ?? null;
}

/**
 * Puts a catalog variant into the first empty pocket of one of the user's
 * binders (sheet order, front before back). Expected failures come back as a
 * result, not a thrown error, so the UI can show them in Spanish.
 */
export async function placeScannedCard(
  binderId: string,
  variantId: string,
): Promise<ScanPlacementResult> {
  await assertBinderOwner(binderId);

  const parsedVariant = variantIdSchema.safeParse(variantId);
  if (!parsedVariant.success) {
    return { status: "invalid", message: "Carta no válida." };
  }
  const [variantRow] = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(eq(cardVariant.id, parsedVariant.data));
  if (!variantRow) {
    return { status: "invalid", message: "Carta no encontrada en el catálogo." };
  }

  const [binderRow] = await db
    .select({ name: binder.name })
    .from(binder)
    .where(eq(binder.id, binderId));
  if (!binderRow) {
    return { status: "invalid", message: "Binder no encontrado." };
  }

  const [versionRow] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return { status: "invalid", message: "El binder no tiene páginas todavía." };
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const pocketCode = firstEmptyPocket(layout);
  if (!pocketCode) {
    return { status: "full", binderName: binderRow.name };
  }

  await applyPocketChanges(binderId, [
    { pocketCode, content: { kind: "card", variant: parsedVariant.data, instance: null } },
  ]);

  const { sheet, side } = parsePocketCode(pocketCode);
  return {
    status: "placed",
    binderId,
    binderName: binderRow.name,
    pocketCode,
    spread: spreadForPocket(sheet, side),
  };
}

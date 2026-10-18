"use server";

import { cardVariant, wishlistItem } from "@sleevebook/db";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./db";
import { assertUser } from "./session";

const MAX_TARGET_USD = 100000;
const MAX_NOTE_LENGTH = 140;
const MAX_BULK = 500;

const variantIdSchema = z.uuid();

function parseVariantId(value: unknown): string {
  const parsed = variantIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Carta no válida");
  }
  return parsed.data;
}

/** Throws unless every id is an existing catalog variant. */
async function assertVariantsExist(variantIds: string[]): Promise<void> {
  const unique = [...new Set(variantIds)];
  const rows = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(inArray(cardVariant.id, unique));
  if (rows.length !== unique.length) {
    throw new Error("Carta no encontrada");
  }
}

export async function addToWishlist(variantId: string): Promise<void> {
  const viewer = await assertUser();
  const id = parseVariantId(variantId);
  await assertVariantsExist([id]);
  await db.insert(wishlistItem).values({ userId: viewer.id, variantId: id }).onConflictDoNothing();
  revalidatePath("/deseos");
}

export async function removeFromWishlist(variantId: string): Promise<void> {
  const viewer = await assertUser();
  const id = parseVariantId(variantId);
  await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.userId, viewer.id), eq(wishlistItem.variantId, id)));
  revalidatePath("/deseos");
}

/** Adds the variant when missing, removes it when present. */
export async function toggleWishlist(variantId: string): Promise<{ inList: boolean }> {
  const viewer = await assertUser();
  const id = parseVariantId(variantId);

  const removed = await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.userId, viewer.id), eq(wishlistItem.variantId, id)))
    .returning({ id: wishlistItem.id });
  if (removed.length > 0) {
    revalidatePath("/deseos");
    return { inList: false };
  }

  await assertVariantsExist([id]);
  await db.insert(wishlistItem).values({ userId: viewer.id, variantId: id }).onConflictDoNothing();
  revalidatePath("/deseos");
  return { inList: true };
}

/** Price alert threshold in USD. Clearing it also clears the alert state. */
export async function setWishlistTarget(
  variantId: string,
  targetPriceUsd: number | null,
): Promise<void> {
  const viewer = await assertUser();
  const id = parseVariantId(variantId);

  if (targetPriceUsd === null) {
    const cleared = await db
      .update(wishlistItem)
      .set({ targetPriceUsd: null, alertedAt: null })
      .where(and(eq(wishlistItem.userId, viewer.id), eq(wishlistItem.variantId, id)))
      .returning({ id: wishlistItem.id });
    if (cleared.length === 0) {
      throw new Error("La carta no está en tu lista");
    }
  } else {
    if (
      typeof targetPriceUsd !== "number" ||
      !Number.isFinite(targetPriceUsd) ||
      targetPriceUsd < 0 ||
      targetPriceUsd > MAX_TARGET_USD
    ) {
      throw new Error("Precio objetivo no válido");
    }
    const updated = await db
      .update(wishlistItem)
      .set({ targetPriceUsd: targetPriceUsd.toFixed(2) })
      .where(and(eq(wishlistItem.userId, viewer.id), eq(wishlistItem.variantId, id)))
      .returning({ id: wishlistItem.id });
    if (updated.length === 0) {
      throw new Error("La carta no está en tu lista");
    }
  }
  revalidatePath("/deseos");
}

export async function setWishlistNote(variantId: string, note: string): Promise<void> {
  const viewer = await assertUser();
  const id = parseVariantId(variantId);
  const trimmed = String(note ?? "").trim();
  if (trimmed.length > MAX_NOTE_LENGTH) {
    throw new Error(`La nota no puede superar ${MAX_NOTE_LENGTH} caracteres`);
  }

  const updated = await db
    .update(wishlistItem)
    .set({ note: trimmed === "" ? null : trimmed })
    .where(and(eq(wishlistItem.userId, viewer.id), eq(wishlistItem.variantId, id)))
    .returning({ id: wishlistItem.id });
  if (updated.length === 0) {
    throw new Error("La carta no está en tu lista");
  }
  revalidatePath("/deseos");
}

/** "Agregar faltantes": returns how many were newly added. */
export async function addManyToWishlist(variantIds: string[]): Promise<{ added: number }> {
  const viewer = await assertUser();
  if (!Array.isArray(variantIds) || variantIds.length > MAX_BULK) {
    throw new Error(`Puedes agregar hasta ${MAX_BULK} cartas a la vez`);
  }
  const ids = [...new Set(variantIds.map(parseVariantId))];
  if (ids.length === 0) {
    return { added: 0 };
  }
  await assertVariantsExist(ids);

  const inserted = await db
    .insert(wishlistItem)
    .values(ids.map((variantId) => ({ userId: viewer.id, variantId })))
    .onConflictDoNothing()
    .returning({ id: wishlistItem.id });
  revalidatePath("/deseos");
  return { added: inserted.length };
}

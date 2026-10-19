"use server";

import { type FoilMask, foilMaskSchema } from "@sleevebook/binder-core";
import { cardVariant, foilMask } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { assertUser, isAdmin } from "./session";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Only admins (OWNER_EMAIL) curate foil masks for now. Community contributions
 * (votes, suggestions reviewed by admins) are a later step.
 */
async function assertAdminCurator(variantId: string): Promise<string> {
  const viewer = await assertUser();
  if (!isAdmin(viewer)) {
    throw new Error("No autorizado");
  }
  if (!UUID_PATTERN.test(variantId)) {
    throw new Error("Variante no válida");
  }
  return viewer.id;
}

function revalidateMaskPages(variantId: string): void {
  revalidatePath(`/admin/mascaras/${variantId}`);
  revalidatePath("/admin/mascaras");
}

/** Stores the hand-made mask of a variant (upsert). Admin only. */
export async function saveFoilMask(variantId: string, mask: FoilMask): Promise<void> {
  const viewerId = await assertAdminCurator(variantId);
  const parsed = foilMaskSchema.safeParse(mask);
  if (!parsed.success) {
    throw new Error("Máscara no válida");
  }

  const [variant] = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(eq(cardVariant.id, variantId));
  if (!variant) {
    throw new Error("Variante no encontrada");
  }

  const updatedAt = new Date();
  await db
    .insert(foilMask)
    .values({ variantId, mask: parsed.data, updatedBy: viewerId, updatedAt })
    .onConflictDoUpdate({
      target: foilMask.variantId,
      set: { mask: parsed.data, updatedBy: viewerId, updatedAt },
    });

  revalidateMaskPages(variantId);
}

/** Removes the hand-made mask so the variant uses defaultFoilMask again. Admin only. */
export async function resetFoilMask(variantId: string): Promise<void> {
  await assertAdminCurator(variantId);
  await db.delete(foilMask).where(eq(foilMask.variantId, variantId));
  revalidateMaskPages(variantId);
}

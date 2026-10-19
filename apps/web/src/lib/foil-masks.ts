import { type FoilMask, foilMaskSchema, layoutSchema } from "@sleevebook/binder-core";
import { binderVersion, foilMask } from "@sleevebook/db";
import { desc, inArray } from "drizzle-orm";
import { db } from "./db";

/** Variants that can carry foil (the ones the mask editor covers). */
export const FOIL_VARIANTS = ["holo", "reverse", "pokeball", "masterball"] as const;

export const FOIL_VARIANT_LABEL: Record<string, string> = {
  holo: "Holo",
  reverse: "Reverse",
  pokeball: "Pokeball",
  masterball: "Master Ball",
};

/**
 * Hand-made foil masks (render level N4) by variant id. Rows that fail
 * foilMaskSchema are ignored, so the renderer falls back to defaultFoilMask.
 * Variants without a row are absent from the map.
 */
export async function getFoilMasks(variantIds: string[]): Promise<Map<string, FoilMask>> {
  const masks = new Map<string, FoilMask>();
  if (variantIds.length === 0) {
    return masks;
  }

  const rows = await db
    .select({ variantId: foilMask.variantId, mask: foilMask.mask })
    .from(foilMask)
    .where(inArray(foilMask.variantId, variantIds));

  for (const row of rows) {
    const parsed = foilMaskSchema.safeParse(row.mask);
    if (parsed.success) {
      masks.set(row.variantId, parsed.data);
    }
  }

  return masks;
}

/**
 * Variant ids placed in ANY binder, read from each binder's latest layout
 * (highest versionNumber). Unparseable layouts are skipped.
 */
export async function listVariantIdsInBinders(): Promise<string[]> {
  const latest = await db
    .selectDistinctOn([binderVersion.binderId], { layout: binderVersion.layout })
    .from(binderVersion)
    .orderBy(binderVersion.binderId, desc(binderVersion.versionNumber));

  const ids = new Set<string>();
  for (const row of latest) {
    const parsed = layoutSchema.safeParse(row.layout);
    if (!parsed.success) {
      continue;
    }
    for (const content of Object.values(parsed.data.pockets)) {
      if (content.kind === "card" || content.kind === "placeholder") {
        ids.add(content.variant);
      }
    }
  }
  return [...ids];
}

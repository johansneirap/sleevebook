import { layoutSchema } from "@sleevebook/binder-core";
import type { Database } from "@sleevebook/db";
import { binderVersion, card, cardVariant, externalId, goal } from "@sleevebook/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PROVIDER } from "../upsert";
import type { PriceSourceCard } from "./source";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Variant ids referenced by one layout: every card and placeholder pocket.
 * Panels, empty pockets and anything malformed contribute nothing.
 */
export function collectLayoutVariantIds(layout: unknown): string[] {
  const parsed = layoutSchema.safeParse(layout);
  if (!parsed.success) {
    return [];
  }
  const ids: string[] = [];
  for (const content of Object.values(parsed.data.pockets)) {
    if (content.kind === "card" || content.kind === "placeholder") {
      ids.push(content.variant);
    }
  }
  return ids;
}

export interface ReferencedVariants {
  cards: PriceSourceCard[];
  /** Distinct referenced variants that resolve to a pokemontcg.io card. */
  variantsReferenced: number;
  /** Referenced variant ids with no card_variant row or no pokemontcg.io id. */
  unmappedVariantIds: string[];
}

/**
 * The variants whose prices matter: each card/placeholder in the LATEST layout
 * of every binder, plus every goal's variantIds. Grouped by pokemontcg.io card
 * id so the price source can batch by card.
 */
export async function collectReferencedVariants(db: Database): Promise<ReferencedVariants> {
  const latestLayouts = await db
    .selectDistinctOn([binderVersion.binderId], { layout: binderVersion.layout })
    .from(binderVersion)
    .orderBy(binderVersion.binderId, desc(binderVersion.versionNumber));

  const goals = await db.select({ variantIds: goal.variantIds }).from(goal);

  const requested = new Set<string>();
  for (const row of latestLayouts) {
    for (const id of collectLayoutVariantIds(row.layout)) {
      requested.add(id);
    }
  }
  for (const row of goals) {
    for (const id of row.variantIds) {
      requested.add(id);
    }
  }

  const validIds = [...requested].filter((id) => UUID_PATTERN.test(id));
  if (validIds.length === 0) {
    return { cards: [], variantsReferenced: 0, unmappedVariantIds: [] };
  }

  const rows = await db
    .select({
      variantId: cardVariant.id,
      variant: cardVariant.variant,
      externalCardId: externalId.externalId,
    })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(
      externalId,
      and(
        eq(externalId.entityType, "card"),
        eq(externalId.provider, PROVIDER),
        eq(externalId.entityId, card.id),
      ),
    )
    .where(inArray(cardVariant.id, validIds));

  const cardsById = new Map<string, PriceSourceCard>();
  const mappedIds = new Set<string>();
  for (const row of rows) {
    mappedIds.add(row.variantId);
    let entry = cardsById.get(row.externalCardId);
    if (!entry) {
      entry = { externalCardId: row.externalCardId, variants: [] };
      cardsById.set(row.externalCardId, entry);
    }
    entry.variants.push({ variantId: row.variantId, variant: row.variant });
  }

  return {
    cards: [...cardsById.values()],
    variantsReferenced: mappedIds.size,
    unmappedVariantIds: [...requested].filter((id) => !mappedIds.has(id)),
  };
}

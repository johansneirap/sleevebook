"use server";

import { card, cardVariant, set } from "@sleevebook/db";
import { eq, ilike } from "drizzle-orm";
import { extractImageUrl, type VariantDisplay } from "./binders";
import { db } from "./db";

const SEARCH_LIMIT = 20;

export async function searchCardVariants(query: string): Promise<VariantDisplay[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const rows = await db
    .select({
      id: cardVariant.id,
      variant: cardVariant.variant,
      images: cardVariant.images,
      cardName: card.name,
      number: card.number,
      rarity: card.rarity,
      setName: set.name,
    })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .where(ilike(card.name, `%${trimmed}%`))
    .limit(SEARCH_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    name: row.cardName,
    number: row.number,
    rarity: row.rarity,
    setName: row.setName,
    variant: row.variant,
    imageUrl: extractImageUrl(row.images),
  }));
}

import type { Layout } from "@sleevebook/binder-core";
import { layoutSchema } from "@sleevebook/binder-core";
import { binder, binderVersion, card, cardVariant, DEV_USER_ID, set } from "@sleevebook/db";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";

export interface BinderSummary {
  id: string;
  name: string;
  formatRows: number;
  formatCols: number;
  sheets: number;
  status: string;
}

export async function listBinders(): Promise<BinderSummary[]> {
  return db
    .select({
      id: binder.id,
      name: binder.name,
      formatRows: binder.formatRows,
      formatCols: binder.formatCols,
      sheets: binder.sheets,
      status: binder.status,
    })
    .from(binder)
    .where(eq(binder.userId, DEV_USER_ID))
    .orderBy(binder.name);
}

export interface BinderWithLayout {
  id: string;
  name: string;
  sheets: number;
  layout: Layout;
}

export async function getBinderWithLayout(binderId: string): Promise<BinderWithLayout | null> {
  const [binderRow] = await db.select().from(binder).where(eq(binder.id, binderId));
  if (!binderRow) {
    return null;
  }

  const [versionRow] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return null;
  }

  return {
    id: binderRow.id,
    name: binderRow.name,
    sheets: binderRow.sheets,
    layout: layoutSchema.parse(versionRow.layout),
  };
}

export interface VariantDisplay {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  setName: string;
  variant: string;
  imageUrl: string | null;
}

interface StoredImages {
  "pokemontcg.io"?: { small?: string; large?: string };
  r2?: { thumbnail: string; medium: string; high: string };
}

export function extractImageUrl(images: unknown): string | null {
  const stored = images as StoredImages | null;
  return (
    stored?.r2?.high ?? stored?.["pokemontcg.io"]?.large ?? stored?.["pokemontcg.io"]?.small ?? null
  );
}

export async function getVariantDisplays(
  variantIds: string[],
): Promise<Map<string, VariantDisplay>> {
  const map = new Map<string, VariantDisplay>();
  if (variantIds.length === 0) {
    return map;
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
    .where(inArray(cardVariant.id, variantIds));

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      name: row.cardName,
      number: row.number,
      rarity: row.rarity,
      setName: row.setName,
      variant: row.variant,
      imageUrl: extractImageUrl(row.images),
    });
  }

  return map;
}

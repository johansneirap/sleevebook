import type {
  BinderMode,
  Currency,
  FoilMask,
  Layout,
  SellerContact,
} from "@sleevebook/binder-core";
import { currencySchema, layoutSchema, sellerContactSchema } from "@sleevebook/binder-core";
import { binder, binderVersion, card, cardVariant, set } from "@sleevebook/db";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { getFoilMasks } from "./foil-masks";

export interface BinderSummary {
  id: string;
  name: string;
  formatRows: number;
  formatCols: number;
  sheets: number;
  status: string;
}

export async function listBinders(userId: string): Promise<BinderSummary[]> {
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
    .where(eq(binder.userId, userId))
    .orderBy(binder.name);
}

export interface BinderWithLayout {
  id: string;
  name: string;
  sheets: number;
  status: string;
  layout: Layout;
  mode: BinderMode;
  sellerContact: SellerContact;
  currency: Currency;
}

/** Fase 3 binder settings, parsed defensively from their DB columns. */
export function parseBinderSettings(row: {
  mode: string;
  sellerContact: unknown;
  currency: string;
}): { mode: BinderMode; sellerContact: SellerContact; currency: Currency } {
  return {
    mode: row.mode === "seller" ? "seller" : "collection",
    sellerContact: sellerContactSchema.catch({}).parse(row.sellerContact ?? {}),
    currency: currencySchema.catch("usd").parse(row.currency),
  };
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
    status: binderRow.status,
    layout: layoutSchema.parse(versionRow.layout),
    ...parseBinderSettings(binderRow),
  };
}

export interface VariantDisplay {
  id: string;
  /** Fase 5 (N4): where the foil shines; filled by the foil-mask loader, absent = default by variant. */
  foilMask?: FoilMask | null;
  name: string;
  number: string;
  rarity: string | null;
  setName: string;
  variant: string;
  imageUrl: string | null;
}

export function collectVariantIds(pockets: Layout["pockets"]): string[] {
  const ids = new Set<string>();
  for (const content of Object.values(pockets)) {
    if (content.kind === "card" || content.kind === "placeholder") {
      ids.add(content.variant);
    }
  }
  return [...ids];
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

  const masks = await getFoilMasks(rows.map((row) => row.id));

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      name: row.cardName,
      number: row.number,
      rarity: row.rarity,
      setName: row.setName,
      variant: row.variant,
      imageUrl: extractImageUrl(row.images),
      foilMask: masks.get(row.id) ?? null,
    });
  }

  return map;
}

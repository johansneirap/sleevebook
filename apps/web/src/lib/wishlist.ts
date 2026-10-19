import { wishlistItem } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { getVariantDisplays, type VariantDisplay } from "./binders";
import { db } from "./db";
import { getLatestEurPrices, getLatestPrices } from "./pricing";

export interface WishlistEntry {
  variantId: string;
  display: VariantDisplay;
  /** Latest market price in USD, or null when we have none yet. */
  priceUsd: number | null;
  /** Cardmarket EUR average, or null when we have none yet. */
  priceEur: number | null;
  /** Price alert threshold in USD, or null. */
  targetPriceUsd: number | null;
  note: string | null;
  /** ISO timestamp. */
  createdAt: string;
}

/** The user's wishlist, newest first, with catalog display and market price. */
export async function getWishlist(userId: string): Promise<WishlistEntry[]> {
  const rows = await db
    .select({
      variantId: wishlistItem.variantId,
      targetPriceUsd: wishlistItem.targetPriceUsd,
      note: wishlistItem.note,
      createdAt: wishlistItem.createdAt,
    })
    .from(wishlistItem)
    .where(eq(wishlistItem.userId, userId))
    .orderBy(desc(wishlistItem.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const variantIds = rows.map((row) => row.variantId);
  const [displays, prices, eurPrices] = await Promise.all([
    getVariantDisplays(variantIds),
    getLatestPrices(variantIds),
    getLatestEurPrices(variantIds),
  ]);

  const entries: WishlistEntry[] = [];
  for (const row of rows) {
    const display = displays.get(row.variantId);
    if (!display) {
      // The variant was removed from the catalog; nothing to show.
      continue;
    }
    entries.push({
      variantId: row.variantId,
      display,
      priceUsd: prices[row.variantId]?.amountUsd ?? null,
      priceEur: eurPrices[row.variantId]?.amountEur ?? null,
      targetPriceUsd: row.targetPriceUsd === null ? null : Number(row.targetPriceUsd),
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    });
  }
  return entries;
}

/** Variant ids on the user's wishlist, for "ya en mi lista" markers. */
export async function getWishlistVariantIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ variantId: wishlistItem.variantId })
    .from(wishlistItem)
    .where(eq(wishlistItem.userId, userId));
  return rows.map((row) => row.variantId);
}

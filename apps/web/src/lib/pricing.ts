"use server";

import { pricePoint } from "@sleevebook/db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";

export interface LatestPrice {
  amountUsd: number;
  source: string;
  capturedAt: string;
}

export interface LatestEurPrice {
  amountEur: number;
  capturedAt: string;
}

/**
 * Newest USD market price per variant (TCGplayer, via TCGdex or the
 * pokemontcg.io fallback). Cardmarket EUR rows are never returned here: they
 * would read as US$. Currency is compared case-insensitively because older
 * rows were stored as "USD".
 */
export async function getLatestPrices(variantIds: string[]): Promise<Record<string, LatestPrice>> {
  if (variantIds.length === 0) {
    return {};
  }

  const rows = await db
    .select({
      variantId: pricePoint.variantId,
      amount: pricePoint.amount,
      source: pricePoint.source,
      capturedAt: pricePoint.capturedAt,
    })
    .from(pricePoint)
    .where(
      and(
        inArray(pricePoint.variantId, variantIds),
        // Not a source whitelist: some e2e fixtures store USD under their own
        // source names. Cardmarket EUR is the only row that must never show as US$.
        ne(pricePoint.source, "cardmarket"),
        sql`lower(${pricePoint.currency}) = 'usd'`,
      ),
    )
    .orderBy(desc(pricePoint.capturedAt));

  const result: Record<string, LatestPrice> = {};
  for (const row of rows) {
    if (!(row.variantId in result)) {
      result[row.variantId] = {
        amountUsd: Number(row.amount),
        source: row.source,
        capturedAt: row.capturedAt.toISOString(),
      };
    }
  }
  return result;
}

/** Newest Cardmarket EUR average per variant (stored by the prices job). */
export async function getLatestEurPrices(
  variantIds: string[],
): Promise<Record<string, LatestEurPrice>> {
  if (variantIds.length === 0) {
    return {};
  }

  const rows = await db
    .select({
      variantId: pricePoint.variantId,
      amount: pricePoint.amount,
      capturedAt: pricePoint.capturedAt,
    })
    .from(pricePoint)
    .where(
      and(
        inArray(pricePoint.variantId, variantIds),
        eq(pricePoint.source, "cardmarket"),
        sql`lower(${pricePoint.currency}) = 'eur'`,
      ),
    )
    .orderBy(desc(pricePoint.capturedAt));

  const result: Record<string, LatestEurPrice> = {};
  for (const row of rows) {
    if (!(row.variantId in result)) {
      result[row.variantId] = {
        amountEur: Number(row.amount),
        capturedAt: row.capturedAt.toISOString(),
      };
    }
  }
  return result;
}

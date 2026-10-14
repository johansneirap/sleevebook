"use server";

import { pricePoint } from "@sleevebook/db";
import { desc, inArray } from "drizzle-orm";
import { db } from "./db";

export interface LatestPrice {
  amountUsd: number;
  source: string;
  capturedAt: string;
}

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
    .where(inArray(pricePoint.variantId, variantIds))
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

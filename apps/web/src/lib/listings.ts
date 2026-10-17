import type { PocketListing } from "@sleevebook/binder-core";
import { currencySchema, listingStatusSchema } from "@sleevebook/binder-core";
import { pocketListing } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { db } from "./db";

/** Seller-mode state per pocket code. Pockets without a row are "disponible" at market price. */
export async function getListings(binderId: string): Promise<Record<string, PocketListing>> {
  const rows = await db.select().from(pocketListing).where(eq(pocketListing.binderId, binderId));
  const result: Record<string, PocketListing> = {};
  for (const row of rows) {
    result[row.pocketCode] = {
      status: listingStatusSchema.catch("disponible").parse(row.status),
      price: row.price === null ? null : Number(row.price),
      currency: currencySchema.catch("usd").parse(row.currency),
    };
  }
  return result;
}

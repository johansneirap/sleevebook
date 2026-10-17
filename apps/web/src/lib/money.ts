import type { Currency, ExchangeRates } from "@sleevebook/binder-core";
import { CURRENCIES } from "@sleevebook/binder-core";
import { exchangeRate } from "@sleevebook/db";
import { desc, inArray } from "drizzle-orm";
import { db } from "./db";

export interface RatesSnapshot {
  rates: ExchangeRates;
  /** ISO date of the oldest rate in use, for "tipo de cambio al …" labels. */
  capturedAt: string | null;
}

/** Latest USD -> CLP/EUR rates written by the daily prices job. */
export async function getExchangeRates(): Promise<RatesSnapshot> {
  const quotes = CURRENCIES.filter((c): c is Exclude<Currency, "usd"> => c !== "usd");
  const rows = await db
    .select({
      quote: exchangeRate.quote,
      rate: exchangeRate.rate,
      capturedAt: exchangeRate.capturedAt,
    })
    .from(exchangeRate)
    .where(inArray(exchangeRate.quote, quotes))
    .orderBy(desc(exchangeRate.capturedAt));

  const rates: ExchangeRates = { usd: 1 };
  let oldest: Date | null = null;
  for (const row of rows) {
    const quote = row.quote as Currency;
    if (rates[quote] === undefined) {
      rates[quote] = Number(row.rate);
      if (!oldest || row.capturedAt < oldest) {
        oldest = row.capturedAt;
      }
    }
  }
  return { rates, capturedAt: oldest?.toISOString() ?? null };
}

import type { Database } from "@sleevebook/db";
import { exchangeRate } from "@sleevebook/db";
import { z } from "zod";

export const RATES_SOURCE = "open.er-api.com";
export const RATES_URL = "https://open.er-api.com/v6/latest/USD";
export const RATE_QUOTES = ["clp", "eur"] as const;

const ratesResponseSchema = z
  .object({
    result: z.string(),
    rates: z.record(z.string(), z.number()),
  })
  .loose();

export interface UsdRate {
  quote: (typeof RATE_QUOTES)[number];
  rate: number;
}

/** Picks the CLP/EUR rates out of an open.er-api.com "latest/USD" response. */
export function parseUsdRates(json: unknown): UsdRate[] {
  const parsed = ratesResponseSchema.parse(json);
  if (parsed.result !== "success") {
    throw new Error(`open.er-api.com returned result "${parsed.result}"`);
  }

  return RATE_QUOTES.map((quote) => {
    const rate = parsed.rates[quote.toUpperCase()];
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`open.er-api.com has no usable ${quote.toUpperCase()} rate`);
    }
    return { quote, rate };
  });
}

export async function fetchUsdRates(fetchImpl: typeof fetch = fetch): Promise<UsdRate[]> {
  const response = await fetchImpl(RATES_URL, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`open.er-api.com responded ${response.status}`);
  }
  return parseUsdRates(await response.json());
}

/**
 * Fetches today's USD -> CLP/EUR rates and stores them in exchange_rate.
 * Throws on any failure; the caller decides whether that is fatal (it is not
 * for the prices job).
 */
export async function captureUsdRates(
  db: Database,
  fetchImpl: typeof fetch = fetch,
  capturedAt: Date = new Date(),
): Promise<Record<string, number>> {
  const rates = await fetchUsdRates(fetchImpl);
  await db.insert(exchangeRate).values(
    rates.map(({ quote, rate }) => ({
      base: "usd",
      quote,
      rate: rate.toFixed(6),
      source: RATES_SOURCE,
      capturedAt,
    })),
  );
  return Object.fromEntries(rates.map(({ quote, rate }) => [quote, rate]));
}

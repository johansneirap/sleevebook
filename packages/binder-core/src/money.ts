import { z } from "zod";

export const CURRENCIES = ["usd", "clp", "eur"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const currencySchema = z.enum(CURRENCIES);

/** USD -> quote rates; `usd` is always 1. A missing quote means "no rate yet". */
export type ExchangeRates = Partial<Record<Currency, number>>;

/** Converts a USD amount; returns undefined when the rate is unknown. */
export function convertFromUsd(
  amountUsd: number,
  currency: Currency,
  rates: ExchangeRates,
): number | undefined {
  if (currency === "usd") {
    return amountUsd;
  }
  const rate = rates[currency];
  return rate === undefined ? undefined : amountUsd * rate;
}

/** Converts between any two currencies through USD. */
export function convertMoney(
  amount: number,
  from: Currency,
  to: Currency,
  rates: ExchangeRates,
): number | undefined {
  if (from === to) {
    return amount;
  }
  const fromRate = from === "usd" ? 1 : rates[from];
  if (fromRate === undefined || fromRate === 0) {
    return undefined;
  }
  return convertFromUsd(amount / fromRate, to, rates);
}

const LOCALES: Record<Currency, string> = { usd: "en-US", clp: "es-CL", eur: "es-ES" };

/** "US$12.50", "$12.500" (CLP, no decimals), "12,50 €". */
export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency: currency.toUpperCase(),
    currencyDisplay: currency === "usd" ? "symbol" : "narrowSymbol",
    minimumFractionDigits: currency === "clp" ? 0 : 2,
    maximumFractionDigits: currency === "clp" ? 0 : 2,
  }).format(amount);
}

import {
  type Currency,
  convertFromUsd,
  currencySchema,
  formatMoney,
} from "@sleevebook/binder-core";
import { user } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { getExchangeRates } from "./money";

/** Formats USD market prices in the viewer's preferred currency (USD when no rate yet). */
export async function getViewerPriceFormatter(
  userId: string,
): Promise<{ currency: Currency; formatUsd: (amountUsd: number | null) => string }> {
  const [row] = await db
    .select({ preferredCurrency: user.preferredCurrency })
    .from(user)
    .where(eq(user.id, userId));
  const currency = currencySchema.catch("usd").parse(row?.preferredCurrency);
  const { rates } = await getExchangeRates();
  return {
    currency,
    formatUsd: (amountUsd) => {
      if (amountUsd === null) {
        return "sin precio";
      }
      const converted = currency === "usd" ? undefined : convertFromUsd(amountUsd, currency, rates);
      // USD keeps the app-wide "$12.50 USD" form (see binder-header formatDisplayMoney).
      return converted === undefined
        ? `$${amountUsd.toFixed(2)} USD`
        : formatMoney(converted, currency);
    },
  };
}

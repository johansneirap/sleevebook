import type { Currency, Layout } from "@sleevebook/binder-core";
import { formatMoney, resolvePocketPrice } from "@sleevebook/binder-core";
import type { VariantDisplay } from "../../lib/binders";
import { collectVariantIds } from "../../lib/binders";
import { getListings } from "../../lib/listings";
import { getExchangeRates } from "../../lib/money";
import { getLatestPrices } from "../../lib/pricing";
import type { PocketMetaMap, WantCatalogEntry } from "./types";

export interface SellerPocketData {
  pocketMeta: PocketMetaMap;
  catalog: Record<string, WantCatalogEntry>;
  /** "Precios en CLP · tipo de cambio al …"; null when the binder prices in USD. */
  priceNote: string | null;
}

/**
 * Server side of seller mode: listing status and resolved price per card pocket,
 * in the binder's display currency. Only called for seller binders.
 */
export async function loadSellerPocketData(
  binderId: string,
  pockets: Layout["pockets"],
  displays: Map<string, VariantDisplay>,
  currency: Currency,
): Promise<SellerPocketData> {
  const [listings, marketPrices, exchange] = await Promise.all([
    getListings(binderId),
    getLatestPrices(collectVariantIds(pockets)),
    getExchangeRates(),
  ]);

  const pocketMeta: PocketMetaMap = {};
  const catalog: Record<string, WantCatalogEntry> = {};
  for (const [code, content] of Object.entries(pockets)) {
    if (content.kind !== "card") {
      continue;
    }
    const listing = listings[code];
    const status = listing?.status ?? "disponible";
    const price = resolvePocketPrice(
      content,
      listing,
      marketPrices[content.variant]?.amountUsd,
      currency,
      exchange.rates,
    );
    const display = displays.get(content.variant);
    pocketMeta[code] = {
      status,
      price: price ? formatMoney(price.amount, price.currency) : undefined,
    };
    catalog[code] = {
      name: display?.name ?? "Carta",
      number: display?.number,
      setName: display?.setName,
      status,
      price,
    };
  }

  let priceNote: string | null = null;
  if (currency !== "usd") {
    const date = exchange.capturedAt
      ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" }).format(
          new Date(exchange.capturedAt),
        )
      : null;
    priceNote = `Precios en ${currency.toUpperCase()}${date ? ` · tipo de cambio al ${date}` : ""}`;
  }

  return { pocketMeta, catalog, priceNote };
}

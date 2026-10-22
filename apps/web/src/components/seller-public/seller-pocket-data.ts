import type { Currency, Layout } from "@sleevebook/binder-core";
import { formatMoney, resolvePocketPrice } from "@sleevebook/binder-core";
import type { VariantDisplay } from "../../lib/binders";
import { collectVariantIds } from "../../lib/binders";
import type { PocketCopyBadge } from "../../lib/collection";
import { getPocketCopies } from "../../lib/collection";
import { getListings } from "../../lib/listings";
import { getExchangeRates } from "../../lib/money";
import { getLatestPrices } from "../../lib/pricing";
import { type PocketCopyMap, pocketCopiesByCode } from "../binder/pocket-copy-badge";
import type { PocketMetaMap, WantCatalogEntry } from "./types";

export interface SellerPocketData {
  pocketMeta: PocketMetaMap;
  catalog: Record<string, WantCatalogEntry>;
  /** "Precios en CLP · tipo de cambio al …"; null when the binder prices in USD. */
  priceNote: string | null;
  /** Copy chips per pocket (language, condition, grading). */
  pocketCopies: PocketCopyMap;
}

/** Copy badges and USD values of a binder's linked copies (see getPocketCopies). */
export interface CopyData {
  badges: Record<string, PocketCopyBadge>;
  values: Record<string, number>;
}

/**
 * Server side of seller mode: listing status and resolved price per card pocket,
 * in the binder's display currency. Only called for seller binders.
 * A pocket linked to a copy is priced from the copy's estimated value (the
 * market price scaled by condition); the seller listing and the owner's
 * override still take precedence. Pass `copies` when the caller already has them.
 */
export async function loadSellerPocketData(
  binderId: string,
  ownerId: string,
  pockets: Layout["pockets"],
  displays: Map<string, VariantDisplay>,
  currency: Currency,
  copies?: CopyData,
): Promise<SellerPocketData> {
  const [listings, marketPrices, exchange] = await Promise.all([
    getListings(binderId),
    getLatestPrices(collectVariantIds(pockets)),
    getExchangeRates(),
  ]);
  const copyData: CopyData =
    copies ??
    (await getPocketCopies(
      ownerId,
      pockets,
      Object.fromEntries(Object.entries(marketPrices).map(([id, price]) => [id, price.amountUsd])),
    ));

  const pocketMeta: PocketMetaMap = {};
  const catalog: Record<string, WantCatalogEntry> = {};
  for (const [code, content] of Object.entries(pockets)) {
    if (content.kind !== "card") {
      continue;
    }
    const listing = listings[code];
    const status = listing?.status ?? "disponible";
    const copyValue = content.instance ? copyData.values[content.instance] : undefined;
    const price = resolvePocketPrice(
      content,
      listing,
      copyValue ?? marketPrices[content.variant]?.amountUsd,
      currency,
      exchange.rates,
    );
    const copyBadge = content.instance ? copyData.badges[content.instance] : undefined;
    const display = displays.get(content.variant);
    pocketMeta[code] = {
      status,
      price: price ? formatMoney(price.amount, price.currency) : undefined,
      estimated: price?.origin === "mercado" && copyBadge?.estimated === true,
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

  return {
    pocketMeta,
    catalog,
    priceNote,
    pocketCopies: pocketCopiesByCode(pockets, copyData.badges),
  };
}

export interface PriceSourceCard {
  /** pokemontcg.io card id, e.g. "sv1-112". */
  externalCardId: string;
  /** Set name as stored in our catalog; TCGdex maps sets by name first. */
  setName?: string;
  /** Card number as stored in our catalog, e.g. "112" or "DP12". */
  number?: string;
  variants: Array<{ variantId: string; variant: string }>;
}

export interface FetchedPrice {
  variantId: string;
  amount: number;
  /** Lowercase code. Defaults to "usd" when omitted. */
  currency?: "usd" | "eur";
  /** Stored as price_point.source. Defaults to the source's name when omitted. */
  source?: string;
  condition?: string;
}

/**
 * A provider of market prices. The daily prices job depends only on this
 * interface, so the implementation can be swapped. A source may return
 * non-USD entries (flagged by `currency`); the job decides what to store.
 */
export interface PriceSource {
  name: string;
  fetchUsdPrices(cards: PriceSourceCard[]): Promise<FetchedPrice[]>;
}

/**
 * The cards restricted to the variants without a price yet; cards left with
 * no variants are dropped. Used to hand only the gaps to the fallback source.
 */
export function restrictToUnpriced(
  cards: PriceSourceCard[],
  pricedVariantIds: ReadonlySet<string>,
): PriceSourceCard[] {
  return cards
    .map((card) => ({
      ...card,
      variants: card.variants.filter((entry) => !pricedVariantIds.has(entry.variantId)),
    }))
    .filter((card) => card.variants.length > 0);
}

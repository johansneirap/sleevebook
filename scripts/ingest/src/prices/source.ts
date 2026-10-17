export interface PriceSourceCard {
  /** pokemontcg.io card id, e.g. "sv1-112". */
  externalCardId: string;
  variants: Array<{ variantId: string; variant: string }>;
}

export interface FetchedPrice {
  variantId: string;
  amount: number;
  condition?: string;
}

/**
 * A provider of USD market prices. The daily prices job depends only on this
 * interface, so the implementation can be swapped (pokemontcg.io today,
 * Scrydex before pokemontcg.io shuts down on 2027-03-01).
 */
export interface PriceSource {
  name: string;
  fetchUsdPrices(cards: PriceSourceCard[]): Promise<FetchedPrice[]>;
}

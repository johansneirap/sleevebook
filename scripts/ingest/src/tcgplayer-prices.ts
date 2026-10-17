// Maps our derived variant names to the tcgplayer price bucket that prices
// that exact printing. Vintage-only buckets (1stEditionHolofoil, etc.) are
// intentionally not modeled here.
export const TCGPLAYER_PRICE_KEY: Record<string, string> = {
  normal: "normal",
  holo: "holofoil",
  reverse: "reverseHolofoil",
  pokeball: "pokeball",
  masterball: "masterball",
};

export interface TcgplayerPriceBucket {
  market?: number | null;
  mid?: number | null;
}

/**
 * USD amount for one variant of a card, from pokemontcg.io's `tcgplayer.prices`
 * map. Prefers the market price, falls back to mid. Null when the variant has
 * no bucket or the bucket has no positive price.
 */
export function pickTcgplayerAmountUsd(
  prices: Record<string, TcgplayerPriceBucket | undefined> | undefined,
  variant: string,
): number | null {
  const key = TCGPLAYER_PRICE_KEY[variant];
  const bucket = key ? prices?.[key] : undefined;
  const amount = bucket?.market ?? bucket?.mid;
  return typeof amount === "number" && amount > 0 ? amount : null;
}

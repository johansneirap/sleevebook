import type { Layout } from "./layout-schema";

export type PriceLookup = Record<string, number | undefined>;

/**
 * Total market value of a binder's card pockets. `copyValues` (USD per copy
 * id, see estimateCopyValueUsd) replaces the variant's market price for
 * pockets linked to a copy; the owner's manual override still wins.
 */
export function computeBinderValueUsd(
  pockets: Layout["pockets"],
  prices: PriceLookup,
  copyValues: PriceLookup = {},
): number {
  let total = 0;
  for (const content of Object.values(pockets)) {
    if (content.kind !== "card") {
      continue;
    }
    const copyValue = content.instance ? copyValues[content.instance] : undefined;
    const unitPrice = content.priceOverrideUsd ?? copyValue ?? prices[content.variant];
    if (unitPrice === undefined) {
      continue;
    }
    total += unitPrice * (content.count ?? 1);
  }
  return total;
}

export function sumVariantPricesUsd(variantIds: string[], prices: PriceLookup): number {
  return variantIds.reduce((sum, id) => sum + (prices[id] ?? 0), 0);
}

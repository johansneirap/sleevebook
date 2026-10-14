import type { Layout } from "./layout-schema";

export type PriceLookup = Record<string, number | undefined>;

export function computeBinderValueUsd(pockets: Layout["pockets"], prices: PriceLookup): number {
  let total = 0;
  for (const content of Object.values(pockets)) {
    if (content.kind !== "card") {
      continue;
    }
    const unitPrice = content.priceOverrideUsd ?? prices[content.variant];
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

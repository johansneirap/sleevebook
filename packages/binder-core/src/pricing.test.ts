import { describe, expect, it } from "vitest";
import { createEmptyLayout } from "./empty-layout";
import { computeBinderValueUsd, sumVariantPricesUsd } from "./pricing";

describe("computeBinderValueUsd", () => {
  it("sums market price per owned card, ignoring placeholders and empties", () => {
    const layout = createEmptyLayout({ rows: 1, cols: 2 }, 1);
    layout.pockets["S1·F·1"] = { kind: "card", variant: "a", instance: null };
    layout.pockets["S1·F·2"] = { kind: "placeholder", variant: "b", style: "ficha" };

    expect(computeBinderValueUsd(layout.pockets, { a: 10, b: 999 })).toBe(10);
  });

  it("prefers a manual price override over the market price", () => {
    const layout = createEmptyLayout({ rows: 1, cols: 1 }, 1);
    layout.pockets["S1·F·1"] = {
      kind: "card",
      variant: "a",
      instance: null,
      priceOverrideUsd: 25,
    };

    expect(computeBinderValueUsd(layout.pockets, { a: 10 })).toBe(25);
  });

  it("multiplies by count when several copies share one pocket", () => {
    const layout = createEmptyLayout({ rows: 1, cols: 1 }, 1);
    layout.pockets["S1·F·1"] = { kind: "card", variant: "a", instance: null, count: 4 };

    expect(computeBinderValueUsd(layout.pockets, { a: 2 })).toBe(8);
  });

  it("skips cards with no known price instead of treating them as free", () => {
    const layout = createEmptyLayout({ rows: 1, cols: 1 }, 1);
    layout.pockets["S1·F·1"] = { kind: "card", variant: "unknown", instance: null };

    expect(computeBinderValueUsd(layout.pockets, {})).toBe(0);
  });
});

describe("sumVariantPricesUsd", () => {
  it("adds up the price of each variant id", () => {
    expect(sumVariantPricesUsd(["a", "b", "c"], { a: 10, b: 5 })).toBe(15);
  });

  it("returns 0 for an empty list", () => {
    expect(sumVariantPricesUsd([], { a: 10 })).toBe(0);
  });
});

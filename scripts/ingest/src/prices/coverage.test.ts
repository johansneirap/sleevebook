import { describe, expect, it } from "vitest";
import {
  COVERAGE_EXAMPLE_LIMIT,
  type CoverageRow,
  classifyCoverage,
  formatCoverageReport,
  toPriceSourceCards,
} from "./coverage";
import type { TcgdexOutcome, TcgdexVariantResult } from "./tcgdex";

function row(variantId: string, overrides: Partial<CoverageRow> = {}): CoverageRow {
  return {
    variantId,
    variant: "normal",
    setName: "Shining Legends",
    number: "25",
    externalCardId: "sm35-25",
    ...overrides,
  };
}

function result(variantId: string, outcome: TcgdexOutcome): TcgdexVariantResult {
  return {
    variantId,
    variant: "normal",
    externalCardId: "sm35-25",
    outcome,
    amount: outcome === "priced" ? 1 : null,
  };
}

describe("toPriceSourceCards", () => {
  it("groups variants by pokemontcg.io card and skips variants without one", () => {
    const cards = toPriceSourceCards([
      row("a", { variant: "normal" }),
      row("b", { variant: "reverse" }),
      row("c", { externalCardId: null }),
    ]);
    expect(cards).toEqual([
      {
        externalCardId: "sm35-25",
        setName: "Shining Legends",
        number: "25",
        variants: [
          { variantId: "a", variant: "normal" },
          { variantId: "b", variant: "reverse" },
        ],
      },
    ]);
  });
});

describe("classifyCoverage", () => {
  it("gives every requested variant exactly one reason", () => {
    const report = classifyCoverage({
      requestedIds: ["a", "b", "c", "d"],
      rows: [row("a"), row("b", { externalCardId: null }), row("c")],
      results: [result("a", "priced"), result("c", "card-not-found")],
    });

    expect(report.requested).toBe(4);
    expect(report.counts.priced).toBe(1);
    expect(report.counts["no-external-id"]).toBe(1);
    expect(report.counts["card-not-found"]).toBe(1);
    expect(report.counts["not-in-catalog"]).toBe(1);
    const total = Object.values(report.counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(4);
  });

  it("reports variants TCGdex missed but the pokemontcg.io fallback priced", () => {
    const report = classifyCoverage({
      requestedIds: ["a", "b"],
      rows: [row("a"), row("b")],
      results: [result("a", "no-bucket-price"), result("b", "priced")],
      fallbackPricedIds: new Set(["a"]),
    });
    expect(report.counts["priced-fallback"]).toBe(1);
    expect(report.counts["no-bucket-price"]).toBe(0);
    expect(report.counts.priced).toBe(1);
  });

  it("keeps at most 20 examples per reason and none for priced variants", () => {
    const ids = Array.from({ length: 25 }, (_, index) => `v${index}`);
    const report = classifyCoverage({
      requestedIds: ids,
      rows: ids.map((id) => row(id)),
      results: ids.map((id) => result(id, "card-not-found")),
    });
    expect(report.counts["card-not-found"]).toBe(25);
    expect(report.examples["card-not-found"]).toHaveLength(COVERAGE_EXAMPLE_LIMIT);
    expect(report.examples.priced).toHaveLength(0);
  });
});

describe("formatCoverageReport", () => {
  it("prints a line per reason and examples only for unpriced reasons", () => {
    const report = classifyCoverage({
      requestedIds: ["a", "b"],
      rows: [row("a", { externalCardId: null }), row("b")],
      results: [result("b", "set-not-mapped")],
    });
    const text = formatCoverageReport(report);

    expect(text).toContain("Referenced variants: 2");
    expect(text).toContain("no pokemontcg.io external id");
    expect(text).toContain("TCGdex set not mapped (up to 20):");
    expect(text).toContain("Shining Legends #25 [normal]");
    expect(text).not.toContain("priced by TCGdex (up to");
  });
});

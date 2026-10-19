import { describe, expect, it } from "vitest";
import {
  normalizeScanNumber,
  normalizeScanSetTotal,
  normalizeScanText,
  rankScanCandidates,
  type ScanCatalogRow,
  type ScanReadingInput,
  scoreScanRow,
} from "./scan-match";

function row(
  overrides: Partial<ScanCatalogRow> & { cardId: string; variantId: string },
): ScanCatalogRow {
  return {
    cardName: "Lucario",
    number: "112",
    setName: "Base Set",
    printedTotal: 198,
    variant: "normal",
    imageUrl: null,
    ...overrides,
  };
}

describe("normalization", () => {
  it("drops diacritics, case and punctuation from names", () => {
    expect(normalizeScanText("Pokémon LV.X")).toBe("pokemon lv x");
    expect(normalizeScanText("  Mr. Mime ")).toBe("mr mime");
    expect(normalizeScanText(null)).toBe("");
  });

  it("normalizes collector numbers", () => {
    expect(normalizeScanNumber("012")).toBe("12");
    expect(normalizeScanNumber("tg05")).toBe("TG5");
    expect(normalizeScanNumber("112/198")).toBe("112");
    expect(normalizeScanNumber("SWSH123")).toBe("SWSH123");
    expect(normalizeScanNumber("  ")).toBeNull();
    expect(normalizeScanNumber(undefined)).toBeNull();
  });

  it("normalizes set totals", () => {
    expect(normalizeScanSetTotal("0198")).toBe("198");
    expect(normalizeScanSetTotal("n/a")).toBeNull();
  });
});

describe("scoreScanRow", () => {
  const base: ScanReadingInput = {
    name: "Lucario",
    number: "112",
    setTotal: "198",
    setName: "Base Set",
  };

  it("scores number + set total + name highest", () => {
    expect(scoreScanRow(base, row({ cardId: "c", variantId: "v" }))).toBe(1);
  });

  it("ranks number + name above name only", () => {
    const numberAndName = scoreScanRow(
      { name: "Lucario", number: "112" },
      row({ cardId: "c", variantId: "v" }),
    );
    const nameOnly = scoreScanRow({ name: "Lucario" }, row({ cardId: "c", variantId: "v" }));
    expect(numberAndName).toBeGreaterThanOrEqual(0.8);
    expect(nameOnly).toBeLessThan(0.8);
    expect(numberAndName).toBeGreaterThan(nameOnly);
  });

  it("penalises a wrong set total", () => {
    const wrongTotal = scoreScanRow(
      { ...base, setTotal: "102" },
      row({ cardId: "c", variantId: "v" }),
    );
    expect(wrongTotal).toBeLessThan(0.8);
  });

  it("accepts modifier words as the same character, at a lower score", () => {
    const mega = row({ cardId: "c", variantId: "v", cardName: "Mega Lucario ex" });
    expect(scoreScanRow({ name: "Lucario", number: "112" }, mega)).toBeLessThan(
      scoreScanRow({ name: "Lucario", number: "112" }, row({ cardId: "c", variantId: "v" })),
    );
    expect(scoreScanRow({ name: "Lucario" }, mega)).toBeGreaterThan(0);
  });

  it("returns 0 for a different card with no number evidence", () => {
    expect(scoreScanRow({ name: "Pikachu" }, row({ cardId: "c", variantId: "v" }))).toBe(0);
  });

  it("halves a score when a read number disagrees", () => {
    const nameOnly = scoreScanRow({ name: "Lucario" }, row({ cardId: "c", variantId: "v" }));
    const wrongNumber = scoreScanRow(
      { name: "Lucario", number: "7" },
      row({ cardId: "c", variantId: "v" }),
    );
    expect(wrongNumber).toBeCloseTo(nameOnly / 2, 1);
  });
});

describe("rankScanCandidates", () => {
  it("returns every variant of the top card, finish match first, capped at the limit", () => {
    const rows = [
      row({ cardId: "a", variantId: "a-normal", variant: "normal" }),
      row({ cardId: "a", variantId: "a-holo", variant: "holo" }),
      row({ cardId: "a", variantId: "a-reverse", variant: "reverse" }),
      row({ cardId: "b", variantId: "b-normal", cardName: "Riolu", number: "1" }),
    ];
    const ranked = rankScanCandidates(
      { name: "Lucario", number: "112", setTotal: "198", finish: "holo" },
      rows,
    );
    expect(ranked.map((c) => c.variantId)).toEqual(["a-holo", "a-normal", "a-reverse"]);
    expect(ranked[0]?.score).toBe(1);
  });

  it("caps the total number of candidates", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      row({ cardId: `c${i}`, variantId: `v${i}`, variant: `var${i}` }),
    );
    expect(rankScanCandidates({ name: "Lucario", number: "112" }, rows)).toHaveLength(6);
    expect(rankScanCandidates({ name: "Lucario", number: "112" }, rows, 2)).toHaveLength(2);
  });

  it("drops rows that score 0 and returns nothing for an empty catalog", () => {
    expect(rankScanCandidates({ name: "Pikachu" }, [row({ cardId: "a", variantId: "a" })])).toEqual(
      [],
    );
    expect(rankScanCandidates({ name: "Lucario" }, [])).toEqual([]);
  });

  it("puts the strongest card first", () => {
    const rows = [
      row({ cardId: "name-only", variantId: "n", number: "5", setName: "Other" }),
      row({ cardId: "exact", variantId: "e" }),
    ];
    const ranked = rankScanCandidates({ name: "Lucario", number: "112", setTotal: "198" }, rows);
    expect(ranked[0]?.variantId).toBe("e");
  });
});

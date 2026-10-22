import { describe, expect, it } from "vitest";
import {
  copyInputSchema,
  estimateCopyValueUsd,
  gradingLabel,
  languageChip,
  placeCopies,
} from "./copy";
import { computeBinderValueUsd } from "./pricing";
import { collectTradeable } from "./trade";

const VARIANT = "8d4f1f0e-4f8e-4c39-9a52-0d0f6f7d1a11";
const raw = {
  language: "en",
  condition: "NM",
  gradingCompany: null,
  gradingGrade: null,
  valueUsd: null,
};

describe("copy labels", () => {
  it("uses short chips for languages", () => {
    expect(languageChip("ja")).toBe("JP");
    expect(languageChip("es")).toBe("ES");
    expect(languageChip("xx")).toBe("XX");
  });

  it("formats grading", () => {
    expect(gradingLabel({ gradingCompany: "PSA", gradingGrade: 10 })).toBe("PSA 10");
    expect(gradingLabel({ gradingCompany: "BGS", gradingGrade: 9.5 })).toBe("BGS 9.5");
    expect(gradingLabel({ gradingCompany: null, gradingGrade: null })).toBeNull();
  });
});

describe("copyInputSchema", () => {
  it("fills defaults", () => {
    const parsed = copyInputSchema.parse({ variantId: VARIANT });
    expect(parsed).toMatchObject({ language: "en", condition: "NM", gradingCompany: null });
  });

  it("requires company and grade together", () => {
    expect(copyInputSchema.safeParse({ variantId: VARIANT, gradingCompany: "PSA" }).success).toBe(
      false,
    );
    expect(
      copyInputSchema.safeParse({ variantId: VARIANT, gradingCompany: "PSA", gradingGrade: 9 })
        .success,
    ).toBe(true);
  });

  it("rejects grades off the half-point scale", () => {
    expect(
      copyInputSchema.safeParse({ variantId: VARIANT, gradingCompany: "CGC", gradingGrade: 9.3 })
        .success,
    ).toBe(false);
  });
});

describe("estimateCopyValueUsd", () => {
  it("returns the NM market price for NM copies", () => {
    expect(estimateCopyValueUsd(raw, 10)).toEqual({ amountUsd: 10, origin: "mercado" });
  });

  it("scales by condition", () => {
    expect(estimateCopyValueUsd({ ...raw, condition: "MP" }, 10)).toEqual({
      amountUsd: 7,
      origin: "condicion",
    });
  });

  it("prefers the owner's valuation", () => {
    expect(estimateCopyValueUsd({ ...raw, valueUsd: 50 }, 10)).toEqual({
      amountUsd: 50,
      origin: "manual",
    });
  });

  it("only references the raw price for graded copies", () => {
    expect(estimateCopyValueUsd({ ...raw, gradingCompany: "PSA", gradingGrade: 10 }, 10)).toEqual({
      amountUsd: 10,
      origin: "referencia",
    });
  });

  it("is undefined without a price", () => {
    expect(estimateCopyValueUsd(raw, undefined)).toBeUndefined();
  });
});

describe("placeCopies", () => {
  it("maps linked pockets to their copy, first one wins", () => {
    const placed = placeCopies([
      {
        binderId: "a",
        pockets: {
          S1·F·1: { kind: "card", variant: "v1", instance: "c1" },
          S1·F·2: { kind: "card", variant: "v1", instance: null },
        },
      },
      { binderId: "b", pockets: { S1·F·1: { kind: "card", variant: "v1", instance: "c1" } } },
    ]);
    expect(placed.get("c1")).toEqual({ binderId: "a", pocketCode: "S1·F·1" });
    expect(placed.size).toBe(1);
  });
});

describe("binder value with copies", () => {
  it("uses the copy value for linked pockets", () => {
    const pockets = {
      S1·F·1: { kind: "card" as const, variant: "v1", instance: "c1" },
      S1·F·2: { kind: "card" as const, variant: "v1", instance: null },
    };
    expect(computeBinderValueUsd(pockets, { v1: 10 }, { c1: 7 })).toBe(17);
  });
});

describe("collectTradeable with copies", () => {
  it("counts loose and linked copies once, keeping one", () => {
    const tradeable = collectTradeable(
      [
        {
          mode: "collection",
          listings: {},
          pockets: {
            S1·F·1: { kind: "card", variant: "v1", instance: "c1" },
            S1·F·2: { kind: "card", variant: "v1", instance: null },
          },
        },
      ],
      [
        { id: "c1", variantId: "v1" },
        { id: "c2", variantId: "v1" },
      ],
    );
    // c1 (in a pocket) + c2 (loose) + one unlinked pocket = 3 owned, 2 extras.
    expect(tradeable.get("v1")).toBe(2);
  });

  it("counts a copy in a seller pocket only as for sale", () => {
    const tradeable = collectTradeable(
      [
        {
          mode: "seller",
          listings: {},
          pockets: { S1·F·1: { kind: "card", variant: "v1", instance: "c1" } },
        },
      ],
      [{ id: "c1", variantId: "v1" }],
    );
    expect(tradeable.get("v1")).toBe(1);
  });
});

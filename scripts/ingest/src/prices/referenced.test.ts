import { createEmptyLayout } from "@sleevebook/binder-core";
import { describe, expect, it } from "vitest";
import { collectLayoutVariantIds } from "./referenced";

const VARIANT_A = "11111111-1111-4111-8111-111111111111";
const VARIANT_B = "22222222-2222-4222-8222-222222222222";

describe("collectLayoutVariantIds", () => {
  it("collects card and placeholder variants, ignoring empty and panel pockets", () => {
    const layout = createEmptyLayout({ rows: 3, cols: 3 }, 1);
    layout.pockets = {
      S1·F·1: {
        kind: "card",
        variant: VARIANT_A,
        instance: null,
      },
      S1·F·2: {
        kind: "placeholder",
        variant: VARIANT_B,
        style: "ficha",
      },
      S1·F·3: { kind: "empty" },
    };
    expect(collectLayoutVariantIds(layout).sort()).toEqual([VARIANT_A, VARIANT_B].sort());
  });

  it("returns nothing for a layout that does not validate", () => {
    expect(collectLayoutVariantIds({ pockets: "nope" })).toEqual([]);
    expect(collectLayoutVariantIds(null)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { layoutSchema } from "./layout-schema";

const VALID_LAYOUT = {
  format: { rows: 3, cols: 3 },
  opening: "side",
  sheets: 20,
  theme: { preset: "night-crimson", sleeve: "clear", bg: "asset_123" },
  sections: [{ id: "bw", title: "Black & White", startsOnNewSide: true }],
  panels: [
    {
      id: "p1",
      asset: "asset_77",
      anchor: "S1·F·1",
      span: { rows: 3, cols: 3 },
      crop: { x: 0, y: 0, zoom: 1 },
      seamMm: 0,
    },
  ],
  pockets: {
    S1·B·1: { kind: "card", variant: "sv1-112.normal", instance: null, locked: false },
    S1·B·2: { kind: "placeholder", variant: "bw1-70.reverse", style: "ficha" },
    S1·B·3: { kind: "empty" },
  },
};

describe("layoutSchema", () => {
  it("accepts the layout documented in docs/PRODUCT.md", () => {
    expect(layoutSchema.parse(VALID_LAYOUT)).toMatchObject(VALID_LAYOUT);
  });

  it("rejects an unknown opening value", () => {
    expect(() => layoutSchema.parse({ ...VALID_LAYOUT, opening: "diagonal" })).toThrow();
  });

  it("rejects a pocket key that is not a valid pocket code", () => {
    const layout = { ...VALID_LAYOUT, pockets: { "not-a-code": { kind: "empty" } } };
    expect(() => layoutSchema.parse(layout)).toThrow();
  });

  it("rejects an unknown pocket content kind", () => {
    const layout = { ...VALID_LAYOUT, pockets: { S1·B·1: { kind: "sticker" } } };
    expect(() => layoutSchema.parse(layout)).toThrow();
  });

  it("defaults sections, panels and pockets to empty", () => {
    const minimal = layoutSchema.parse({
      format: { rows: 2, cols: 2 },
      opening: "side",
      sheets: 1,
      theme: { preset: "default", sleeve: "clear" },
    });
    expect(minimal.sections).toEqual([]);
    expect(minimal.panels).toEqual([]);
    expect(minimal.pockets).toEqual({});
  });
});

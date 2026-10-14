import { describe, expect, it } from "vitest";
import { createEmptyLayout } from "./empty-layout";

describe("createEmptyLayout", () => {
  it("fills every pocket of a 3x3x20 binder as empty", () => {
    const layout = createEmptyLayout({ rows: 3, cols: 3 }, 20);
    expect(Object.keys(layout.pockets)).toHaveLength(360);
    expect(Object.values(layout.pockets).every((p) => p.kind === "empty")).toBe(true);
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "empty" });
    expect(layout.pockets["S20·B·9"]).toEqual({ kind: "empty" });
  });

  it("defaults to side opening and validates against layoutSchema", () => {
    const layout = createEmptyLayout({ rows: 2, cols: 2 }, 1);
    expect(layout.opening).toBe("side");
    expect(layout.sheets).toBe(1);
    expect(Object.keys(layout.pockets)).toHaveLength(8);
  });

  it("accepts a top opening", () => {
    const layout = createEmptyLayout({ rows: 4, cols: 4 }, 2, "top");
    expect(layout.opening).toBe("top");
  });
});

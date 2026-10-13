import { describe, expect, it } from "vitest";
import { capacity, pocketsPerSheet, pocketsPerSide } from "./format";

describe("format", () => {
  it("computes pockets per side and per sheet", () => {
    expect(pocketsPerSide({ rows: 3, cols: 3 })).toBe(9);
    expect(pocketsPerSheet({ rows: 3, cols: 3 })).toBe(18);
    expect(pocketsPerSide({ rows: 4, cols: 4 })).toBe(16);
    expect(pocketsPerSheet({ rows: 4, cols: 4 })).toBe(32);
  });

  it("computes capacity for a 3x3 binder of 20 sheets as 360", () => {
    expect(capacity({ rows: 3, cols: 3 }, 20)).toBe(360);
  });

  it("computes capacity for a 4x4 binder of 20 sheets as 640", () => {
    expect(capacity({ rows: 4, cols: 4 }, 20)).toBe(640);
  });
});

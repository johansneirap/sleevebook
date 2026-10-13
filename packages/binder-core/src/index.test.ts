import { describe, expect, it } from "vitest";
import { capacity, formatPocketCode, layoutSchema, parsePocketCode } from "./index.js";

describe("public API", () => {
  it("re-exports the module functions from a single entry point", () => {
    expect(capacity({ rows: 3, cols: 3 }, 20)).toBe(360);
    expect(formatPocketCode(parsePocketCode("S3·B·5"))).toBe("S3·B·5");
    expect(() =>
      layoutSchema.parse({
        format: { rows: 2, cols: 2 },
        opening: "side",
        sheets: 1,
        theme: { preset: "default", sleeve: "clear" },
      }),
    ).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  formatPocketCode,
  fromAsciiAlias,
  parsePocketCode,
  pocketCodeFromGlobalIndex,
  pocketCodeToGlobalIndex,
  toAsciiAlias,
} from "./pocket-code";

const FORMAT_3X3 = { rows: 3, cols: 3 };

describe("pocket-code", () => {
  it("parses and formats a pocket code", () => {
    expect(parsePocketCode("S3·B·5")).toEqual({ sheet: 3, side: "B", index: 5 });
    expect(formatPocketCode({ sheet: 3, side: "B", index: 5 })).toBe("S3·B·5");
  });

  it("converts to and from the ASCII alias", () => {
    expect(toAsciiAlias("S3·B·5")).toBe("s3-b-5");
    expect(fromAsciiAlias("s3-b-5")).toEqual({ sheet: 3, side: "B", index: 5 });
  });

  it("accepts a parsed PocketCode when converting to the ASCII alias", () => {
    expect(toAsciiAlias({ sheet: 3, side: "B", index: 5 })).toBe("s3-b-5");
  });

  it("rejects a malformed ASCII alias", () => {
    expect(() => fromAsciiAlias("not-a-code")).toThrow();
  });

  it("maps pocket codes to 0-based global indexes in reading order", () => {
    expect(pocketCodeToGlobalIndex({ sheet: 1, side: "F", index: 1 }, FORMAT_3X3)).toBe(0);
    expect(pocketCodeToGlobalIndex({ sheet: 1, side: "B", index: 1 }, FORMAT_3X3)).toBe(9);
    expect(pocketCodeToGlobalIndex({ sheet: 20, side: "B", index: 9 }, FORMAT_3X3)).toBe(359);
  });

  it("is the inverse of pocketCodeFromGlobalIndex", () => {
    expect(pocketCodeFromGlobalIndex(0, FORMAT_3X3)).toEqual({ sheet: 1, side: "F", index: 1 });
    expect(pocketCodeFromGlobalIndex(9, FORMAT_3X3)).toEqual({ sheet: 1, side: "B", index: 1 });
    expect(pocketCodeFromGlobalIndex(359, FORMAT_3X3)).toEqual({ sheet: 20, side: "B", index: 9 });
  });
});

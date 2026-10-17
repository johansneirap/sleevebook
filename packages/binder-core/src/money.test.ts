import { describe, expect, it } from "vitest";
import { convertFromUsd, convertMoney, formatMoney } from "./money";

describe("money", () => {
  it("converts USD with a known rate and returns undefined without one", () => {
    expect(convertFromUsd(10, "clp", { clp: 950 })).toBe(9500);
    expect(convertFromUsd(10, "eur", {})).toBeUndefined();
    expect(convertFromUsd(10, "usd", {})).toBe(10);
  });

  it("converts between non-USD currencies through USD", () => {
    expect(convertMoney(9500, "clp", "eur", { clp: 950, eur: 0.9 })).toBeCloseTo(9);
    expect(convertMoney(5, "eur", "eur", {})).toBe(5);
  });

  it("formats CLP without decimals and USD with two", () => {
    expect(formatMoney(12500.4, "clp")).toMatch(/12\.500/);
    expect(formatMoney(12500.4, "clp")).not.toMatch(/,4/);
    expect(formatMoney(12.5, "usd")).toBe("$12.50");
  });
});

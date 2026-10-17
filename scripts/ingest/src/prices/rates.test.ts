import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fetchUsdRates, parseUsdRates, RATES_URL } from "./rates";

const fixture = JSON.parse(
  readFileSync(new URL("./__fixtures__/er-api-latest-usd.json", import.meta.url), "utf-8"),
);

describe("parseUsdRates", () => {
  it("returns the CLP and EUR rates from an open.er-api.com response", () => {
    expect(parseUsdRates(fixture)).toEqual([
      { quote: "clp", rate: 952.35 },
      { quote: "eur", rate: 0.9187 },
    ]);
  });

  it("rejects a response whose result is not success", () => {
    expect(() => parseUsdRates({ ...fixture, result: "error" })).toThrow(/error/);
  });

  it("rejects a response missing one of the quotes", () => {
    const { CLP: _clp, ...withoutClp } = fixture.rates;
    expect(() => parseUsdRates({ ...fixture, rates: withoutClp })).toThrow(/CLP/);
  });

  it("rejects non-positive rates", () => {
    expect(() => parseUsdRates({ ...fixture, rates: { ...fixture.rates, EUR: 0 } })).toThrow(/EUR/);
  });
});

describe("fetchUsdRates", () => {
  it("requests the latest USD table and parses it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 }));
    const rates = await fetchUsdRates(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledWith(RATES_URL, expect.anything());
    expect(rates).toHaveLength(2);
  });

  it("throws on a non-ok HTTP status", async () => {
    const fetchMock = async () => new Response("", { status: 500 });
    await expect(fetchUsdRates(fetchMock as unknown as typeof fetch)).rejects.toThrow("500");
  });
});

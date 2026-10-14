import { describe, expect, it } from "vitest";
import { parseCatalogKey, slugifySpecialVariant } from "./variant-mapping";

describe("parseCatalogKey", () => {
  it("parses a catalog key into the pokemontcg.io id and variant", () => {
    expect(parseCatalogKey("bw1-70.n")).toEqual({ pokemonTcgIoId: "bw1-70", variant: "normal" });
    expect(parseCatalogKey("bw1-70.r")).toEqual({ pokemonTcgIoId: "bw1-70", variant: "reverse" });
    expect(parseCatalogKey("bw1-71.h")).toEqual({ pokemonTcgIoId: "bw1-71", variant: "holo" });
    expect(parseCatalogKey("rsv10pt5-62.pb")).toEqual({
      pokemonTcgIoId: "rsv10pt5-62",
      variant: "pokeball",
    });
    expect(parseCatalogKey("rsv10pt5-61.mb")).toEqual({
      pokemonTcgIoId: "rsv10pt5-61",
      variant: "masterball",
    });
  });

  it("throws on a key with no suffix (e.g. a special item's key)", () => {
    expect(() => parseCatalogKey("x-00")).toThrow(/not a catalog key/);
  });

  it("throws on an unrecognized suffix", () => {
    expect(() => parseCatalogKey("bw1-70.zz")).toThrow(/Unknown variant suffix/);
  });
});

describe("slugifySpecialVariant", () => {
  it("slugifies every special variant label used in the seed", () => {
    expect(slugifySpecialVariant("Normal")).toBe("normal");
    expect(slugifySpecialVariant("Holo")).toBe("holo");
    expect(slugifySpecialVariant("Reverse Holo")).toBe("reverse");
    expect(slugifySpecialVariant("Stamped")).toBe("stamped");
    expect(slugifySpecialVariant("Stamped Holo")).toBe("stamped-holo");
    expect(slugifySpecialVariant("Gold Border")).toBe("gold-border");
    expect(slugifySpecialVariant("Jumbo (oversize)")).toBe("jumbo");
    expect(slugifySpecialVariant("7 different jumbos")).toBe("jumbo-set");
    expect(slugifySpecialVariant("Cosmos Holo")).toBe("cosmos-holo");
    expect(slugifySpecialVariant("Cracked Ice Holo")).toBe("cracked-ice-holo");
    expect(slugifySpecialVariant("Exclusive Holo")).toBe("exclusive-holo");
  });

  it("throws on an unrecognized label", () => {
    expect(() => slugifySpecialVariant("Something New")).toThrow(/Unknown special variant label/);
  });
});

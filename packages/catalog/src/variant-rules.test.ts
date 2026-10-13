import { describe, expect, it } from "vitest";
import { deriveVariants } from "./variant-rules";

describe("deriveVariants", () => {
  it("gives a plain rarity normal + reverse in a regular set", () => {
    const result = deriveVariants({ rarity: "Common", setName: "Base" });
    expect(result.variants).toEqual(["normal", "reverse"]);
    expect(result.needsReview).toBe(false);
  });

  it("gives Rare Holo the holo variant plus reverse", () => {
    const result = deriveVariants({ rarity: "Rare Holo", setName: "Base" });
    expect(result.variants).toEqual(["holo", "reverse"]);
  });

  it("gives special rarities holo only, with no reverse", () => {
    const result = deriveVariants({ rarity: "V", setName: "Sword & Shield" });
    expect(result.variants).toEqual(["holo"]);
  });

  it("drops reverse in sets printed without it", () => {
    const result = deriveVariants({ rarity: "Common", setName: "POP Series 7" });
    expect(result.variants).toEqual(["normal"]);
  });

  it("drops reverse for promo cards regardless of set", () => {
    const result = deriveVariants({ rarity: "Promo", setName: "Base" });
    expect(result.variants).toEqual(["holo"]);
  });

  it("replaces reverse with pokeball/masterball in the designated sets", () => {
    const result = deriveVariants({ rarity: "Common", setName: "Prismatic Evolutions" });
    expect(result.variants).toEqual(["normal", "pokeball", "masterball"]);
  });

  it("flags a missing rarity for review and defaults to normal", () => {
    const result = deriveVariants({ setName: "Base" });
    expect(result.variants).toEqual(["normal"]);
    expect(result.needsReview).toBe(true);
  });

  it("flags a very recently released set for review", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    const result = deriveVariants(
      { rarity: "Common", setName: "Mega Evolution", releasedAt: "2026/09/16" },
      { now },
    );
    expect(result.needsReview).toBe(true);
  });

  it("does not flag a set released long ago", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    const result = deriveVariants(
      { rarity: "Common", setName: "Base", releasedAt: "1999/01/09" },
      { now },
    );
    expect(result.needsReview).toBe(false);
  });
});

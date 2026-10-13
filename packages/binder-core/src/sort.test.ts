import { describe, expect, it } from "vitest";
import { compareCardNumbers, sortPockets } from "./sort.js";

describe("compareCardNumbers", () => {
  it("sorts plain numbers before prefixed ones, by value then letter suffix", () => {
    const numbers = ["10", "2", "GG26", "55a", "55"];
    expect([...numbers].sort(compareCardNumbers)).toEqual(["2", "10", "55", "55a", "GG26"]);
  });

  it("treats equal card numbers as equal", () => {
    expect(compareCardNumbers("55a", "55a")).toBe(0);
  });

  it("sorts a number with no digits after any numbered one", () => {
    expect(compareCardNumbers("76", "PROMO")).toBeLessThan(0);
  });

  it("breaks ties by suffix in both directions", () => {
    expect(compareCardNumbers("55a", "55b")).toBeLessThan(0);
    expect(compareCardNumbers("55b", "55a")).toBeGreaterThan(0);
  });
});

describe("sortPockets", () => {
  it("sorts by a single cardNumber key", () => {
    const items = ["10", "2", "GG26", "55a", "55"].map((number) => ({ number }));
    const sorted = sortPockets(items, [{ get: (i) => i.number, type: "cardNumber" }]);
    expect(sorted.map((i) => i.number)).toEqual(["2", "10", "55", "55a", "GG26"]);
  });

  it("supports a composite key with mixed directions", () => {
    const items = [
      { era: "SWSH", set: "BRS", number: "132" },
      { era: "SV", set: "SV1", number: "1" },
      { era: "SWSH", set: "SWSH1", number: "2" },
    ];
    const sorted = sortPockets(items, [
      { get: (i) => i.era },
      { get: (i) => i.number, type: "cardNumber", dir: "desc" },
    ]);
    expect(sorted.map((i) => `${i.era}/${i.number}`)).toEqual(["SV/1", "SWSH/132", "SWSH/2"]);
  });

  it("sorts plain numeric keys without a cardNumber type", () => {
    const items = [{ price: 30 }, { price: 10 }, { price: 20 }];
    const sorted = sortPockets(items, [{ get: (i) => i.price }]);
    expect(sorted.map((i) => i.price)).toEqual([10, 20, 30]);
  });

  it("sorts plain string keys alphabetically without a type", () => {
    const items = [{ name: "b" }, { name: "a" }];
    const sorted = sortPockets(items, [{ get: (i) => i.name }]);
    expect(sorted.map((i) => i.name)).toEqual(["a", "b"]);
  });

  it("is stable when every key compares equal", () => {
    const items = [
      { id: 1, group: "a" },
      { id: 2, group: "a" },
    ];
    const sorted = sortPockets(items, [{ get: (i) => i.group }]);
    expect(sorted.map((i) => i.id)).toEqual([1, 2]);
  });
});

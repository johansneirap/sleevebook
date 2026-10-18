import { describe, expect, it } from "vitest";
import type { Layout } from "./layout-schema";
import {
  collectTradeable,
  collectWants,
  computeTradeMatches,
  type TradeLayoutInput,
  type TradeParty,
} from "./trade";

type Pockets = Layout["pockets"];

function card(variant: string, count?: number): Pockets[string] {
  return count === undefined
    ? { kind: "card", variant, instance: null }
    : { kind: "card", variant, instance: null, count };
}

function collection(pockets: Pockets): TradeLayoutInput {
  return { mode: "collection", pockets, listings: {} };
}

function seller(pockets: Pockets, listings: TradeLayoutInput["listings"] = {}): TradeLayoutInput {
  return { mode: "seller", pockets, listings };
}

function party(
  userId: string,
  tradeable: Record<string, number>,
  wants: string[],
  optedIn?: boolean,
): TradeParty {
  return {
    userId,
    tradeable: new Map(Object.entries(tradeable)),
    wants: new Set(wants),
    optedIn,
  };
}

describe("collectTradeable", () => {
  it("keeps one copy for the collection and offers the extras", () => {
    const tradeable = collectTradeable([collection({ S1·F·1: card("X", 2), S1·F·2: card("Y") })]);
    expect(tradeable.get("X")).toBe(1);
    expect(tradeable.has("Y")).toBe(false);
  });

  it("counts a pocket without count as one copy", () => {
    const tradeable = collectTradeable([collection({ S1·F·1: card("X") })]);
    expect(tradeable.has("X")).toBe(false);
  });

  it("sums a variant across all collection binders before keeping one copy", () => {
    const tradeable = collectTradeable([
      collection({ S1·F·1: card("X") }),
      collection({ S1·F·1: card("X", 2) }),
      collection({ S2·F·1: card("X") }),
    ]);
    // 1 + 2 + 1 = 4 copies, one kept, 3 tradeable.
    expect(tradeable.get("X")).toBe(3);
  });

  it("keeps one copy once per variant, not once per binder", () => {
    const tradeable = collectTradeable([
      collection({ S1·F·1: card("X") }),
      collection({ S1·F·1: card("X") }),
    ]);
    // Two copies total: one kept, one extra.
    expect(tradeable.get("X")).toBe(1);
  });

  it("ignores placeholders, panels and empty pockets", () => {
    const tradeable = collectTradeable([
      collection({
        S1·F·1: { kind: "placeholder", variant: "X", style: "ficha" },
        S1·F·2: { kind: "panel", panelId: "p1" },
        S1·F·3: { kind: "empty" },
      }),
    ]);
    expect(tradeable.size).toBe(0);
  });

  it("offers every disponible seller pocket fully, including counts above one", () => {
    const tradeable = collectTradeable([seller({ S1·F·1: card("X"), S1·F·2: card("X", 3) })]);
    expect(tradeable.get("X")).toBe(4);
  });

  it("treats a seller pocket with no listing row as disponible", () => {
    const tradeable = collectTradeable([seller({ S1·F·1: card("X") }, {})]);
    expect(tradeable.get("X")).toBe(1);
  });

  it("never counts reservado or vendido seller pockets", () => {
    const tradeable = collectTradeable([
      seller(
        { S1·F·1: card("X", 2), S1·F·2: card("Y", 5) },
        { S1·F·1: { status: "reservado" }, S1·F·2: { status: "vendido" } },
      ),
    ]);
    expect(tradeable.size).toBe(0);
  });

  it("counts only the disponible pockets of a mixed seller binder", () => {
    const tradeable = collectTradeable([
      seller(
        { S1·F·1: card("X"), S1·F·2: card("X"), S1·F·3: card("X") },
        { S1·F·2: { status: "vendido" }, S1·F·3: { status: "disponible" } },
      ),
    ]);
    // S1·F·1 has no row (disponible), S1·F·2 is sold, S1·F·3 is disponible.
    expect(tradeable.get("X")).toBe(2);
  });

  it("does not apply the keep-one rule to seller binders", () => {
    const tradeable = collectTradeable([
      collection({ S1·F·1: card("X") }),
      seller({ S1·F·1: card("X") }),
    ]);
    // Collection: one copy, nothing extra. Seller: one copy for sale.
    expect(tradeable.get("X")).toBe(1);
  });

  it("adds the collection extras and the seller stock for the same variant", () => {
    const tradeable = collectTradeable([
      collection({ S1·F·1: card("X", 3) }),
      seller({ S1·F·1: card("X", 2) }),
    ]);
    // Collection: 3 copies, 2 extras. Seller: 2 for sale. Total 4.
    expect(tradeable.get("X")).toBe(4);
  });

  it("returns an empty map for no binders", () => {
    expect(collectTradeable([]).size).toBe(0);
  });
});

describe("collectWants", () => {
  it("returns the wishlist when there are no binders", () => {
    expect([...collectWants(["A", "B"], [])].sort()).toEqual(["A", "B"]);
  });

  it("adds goal variants that the binder does not hold", () => {
    const wants = collectWants(
      [],
      [{ pockets: { S1·F·1: card("A") }, goalVariantIds: ["A", "B", "C"] }],
    );
    expect([...wants].sort()).toEqual(["B", "C"]);
  });

  it("checks presence per binder, not across binders", () => {
    const wants = collectWants(
      [],
      [
        { pockets: { S1·F·1: card("A") }, goalVariantIds: ["A"] },
        { pockets: {}, goalVariantIds: ["A"] },
      ],
    );
    expect([...wants]).toEqual(["A"]);
  });

  it("does not count a placeholder as holding a goal variant", () => {
    const wants = collectWants(
      [],
      [
        {
          pockets: { S1·F·1: { kind: "placeholder", variant: "A", style: "ficha" } },
          goalVariantIds: ["A"],
        },
      ],
    );
    expect([...wants]).toEqual(["A"]);
  });

  it("merges the wishlist with goal variants without duplicates", () => {
    const wants = collectWants(["A", "Z"], [{ pockets: {}, goalVariantIds: ["A", "B"] }]);
    expect([...wants].sort()).toEqual(["A", "B", "Z"]);
  });
});

describe("computeTradeMatches", () => {
  it("finds a mutual match with both directions", () => {
    const viewer = party("me", { Y: 1 }, ["X"]);
    const ana = party("ana", { X: 1 }, ["Y"]);
    expect(computeTradeMatches(viewer, [ana])).toEqual([
      { userId: "ana", theyCanGive: ["X"], youCanGive: ["Y"], mutual: true },
    ]);
  });

  it("reports a one-way match as not mutual", () => {
    const viewer = party("me", {}, ["X"]);
    const ana = party("ana", { X: 1 }, []);
    expect(computeTradeMatches(viewer, [ana])).toEqual([
      { userId: "ana", theyCanGive: ["X"], youCanGive: [], mutual: false },
    ]);
  });

  it("reports a match where only the viewer can give", () => {
    const viewer = party("me", { Y: 2 }, []);
    const bea = party("bea", {}, ["Y"]);
    expect(computeTradeMatches(viewer, [bea])).toEqual([
      { userId: "bea", theyCanGive: [], youCanGive: ["Y"], mutual: false },
    ]);
  });

  it("excludes users with no overlap", () => {
    const viewer = party("me", { Y: 1 }, ["X"]);
    const carla = party("carla", { Q: 1 }, ["R"]);
    expect(computeTradeMatches(viewer, [carla])).toEqual([]);
  });

  it("never matches the viewer against themselves", () => {
    const viewer = party("me", { X: 1 }, ["X"]);
    const same = party("me", { X: 1 }, ["X"]);
    expect(computeTradeMatches(viewer, [same])).toEqual([]);
  });

  it("ignores variants the other user holds with zero copies", () => {
    const viewer = party("me", {}, ["X"]);
    const ana = party("ana", { X: 0 }, []);
    expect(computeTradeMatches(viewer, [ana])).toEqual([]);
  });

  it("ignores a viewer copy count of zero", () => {
    const viewer = party("me", { Y: 0 }, []);
    const ana = party("ana", {}, ["Y"]);
    expect(computeTradeMatches(viewer, [ana])).toEqual([]);
  });

  it("returns nothing when the viewer is opted out", () => {
    const viewer = party("me", { Y: 1 }, ["X"], false);
    const ana = party("ana", { X: 1 }, ["Y"]);
    expect(computeTradeMatches(viewer, [ana])).toEqual([]);
  });

  it("excludes opted-out users from the matches", () => {
    const viewer = party("me", { Y: 1 }, ["X"]);
    const ana = party("ana", { X: 1 }, ["Y"], false);
    expect(computeTradeMatches(viewer, [ana])).toEqual([]);
  });

  it("includes users without an opt-in flag, like a missing profile row", () => {
    const viewer = party("me", { Y: 1 }, ["X"], true);
    const ana = party("ana", { X: 1 }, ["Y"]);
    expect(computeTradeMatches(viewer, [ana])).toHaveLength(1);
  });

  it("lists matched variants sorted", () => {
    const viewer = party("me", { Y: 1, B: 1 }, ["X", "A", "Z"]);
    const ana = party("ana", { Z: 1, X: 1, A: 2 }, ["Y", "B"]);
    const [match] = computeTradeMatches(viewer, [ana]);
    expect(match?.theyCanGive).toEqual(["A", "X", "Z"]);
    expect(match?.youCanGive).toEqual(["B", "Y"]);
  });

  it("sorts mutual matches first", () => {
    const viewer = party("me", { Y: 1 }, ["X"]);
    const oneWay = party("aaa", { X: 1 }, []);
    const mutual = party("zzz", { X: 1 }, ["Y"]);
    const result = computeTradeMatches(viewer, [oneWay, mutual]);
    expect(result.map((m) => m.userId)).toEqual(["zzz", "aaa"]);
  });

  it("sorts by total matched count, most first, within the same mutuality", () => {
    const viewer = party("me", { Y: 1, B: 1 }, ["X", "A"]);
    const small = party("small", { X: 1 }, ["Y"]);
    const big = party("big", { X: 1, A: 1 }, ["Y", "B"]);
    const result = computeTradeMatches(viewer, [small, big]);
    expect(result.map((m) => m.userId)).toEqual(["big", "small"]);
  });

  it("breaks ties by userId", () => {
    const viewer = party("me", { Y: 1 }, ["X"]);
    const bob = party("bob", { X: 1 }, ["Y"]);
    const ana = party("ana", { X: 1 }, ["Y"]);
    const result = computeTradeMatches(viewer, [bob, ana]);
    expect(result.map((m) => m.userId)).toEqual(["ana", "bob"]);
  });

  it("returns no matches for no others", () => {
    expect(computeTradeMatches(party("me", { Y: 1 }, ["X"]), [])).toEqual([]);
  });
});

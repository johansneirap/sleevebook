import type { Layout, TradeMatch } from "@sleevebook/binder-core";
import { createEmptyLayout } from "@sleevebook/binder-core";
import { describe, expect, it } from "vitest";
import {
  buildTradeParties,
  decideTradeNotifications,
  type PastTradeNotice,
  parseTradeData,
  TRADE_NOTIFY_CAP_PER_USER,
} from "./trade-alerts";

const NOW = new Date("2026-10-19T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function match(overrides: Partial<TradeMatch> & { userId: string }): TradeMatch {
  const theyCanGive = overrides.theyCanGive ?? ["v1"];
  const youCanGive = overrides.youCanGive ?? [];
  return {
    theyCanGive,
    youCanGive,
    mutual: theyCanGive.length > 0 && youCanGive.length > 0,
    ...overrides,
  };
}

function past(overrides: Partial<PastTradeNotice> & { otherUserId: string }): PastTradeNotice {
  return {
    theyCanGive: ["v1"],
    youCanGive: [],
    createdAt: new Date(NOW.getTime() - DAY),
    ...overrides,
  };
}

describe("decideTradeNotifications", () => {
  it("notifies about a new match with title, body and data", () => {
    const [notice] = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1", "v2"], youCanGive: ["v3"] })],
      handles: new Map([["u2", "ana"]]),
      past: [],
      now: NOW,
    });
    expect(notice).toEqual({
      userId: "me",
      kind: "intercambio",
      title: "Nuevo intercambio posible con @ana",
      body: "Te puede dar 2 · le sirve 1 de lo tuyo · Intercambio mutuo",
      href: "/intercambios",
      data: { otherUserId: "u2", theyCanGive: ["v1", "v2"], youCanGive: ["v3"] },
    });
  });

  it("omits the mutual marker when the match is one-way", () => {
    const [notice] = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1"], youCanGive: [] })],
      handles: new Map([["u2", "ana"]]),
      past: [],
      now: NOW,
    });
    expect(notice?.body).toBe("Te puede dar 1 · le sirve 0 de lo tuyo");
  });

  it("skips a match already covered by a recent notice with a superset", () => {
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1"] })],
      handles: new Map(),
      past: [past({ otherUserId: "u2", theyCanGive: ["v1", "v2"] })],
      now: NOW,
    });
    expect(decision).toEqual([]);
  });

  it("notifies again when the match has a variant the old notice did not have", () => {
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1", "v9"] })],
      handles: new Map(),
      past: [past({ otherUserId: "u2", theyCanGive: ["v1"] })],
      now: NOW,
    });
    expect(decision).toHaveLength(1);
  });

  it("notifies again when the old notice is older than 30 days", () => {
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1"] })],
      handles: new Map(),
      past: [past({ otherUserId: "u2", createdAt: new Date(NOW.getTime() - 31 * DAY) })],
      now: NOW,
    });
    expect(decision).toHaveLength(1);
  });

  it("ignores recent notices about other counterparts", () => {
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1"] })],
      handles: new Map(),
      past: [past({ otherUserId: "u3", theyCanGive: ["v1"] })],
      now: NOW,
    });
    expect(decision).toHaveLength(1);
  });

  it("requires both directions to be covered", () => {
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2", theyCanGive: ["v1"], youCanGive: ["v5"] })],
      handles: new Map(),
      past: [past({ otherUserId: "u2", theyCanGive: ["v1"], youCanGive: [] })],
      now: NOW,
    });
    expect(decision).toHaveLength(1);
  });

  it("caps the notifications per run and keeps the match order", () => {
    const matches = Array.from({ length: TRADE_NOTIFY_CAP_PER_USER + 3 }, (_, index) =>
      match({ userId: `u${index}` }),
    );
    const decision = decideTradeNotifications({
      viewerId: "me",
      matches,
      handles: new Map(),
      past: [],
      now: NOW,
    });
    expect(decision).toHaveLength(TRADE_NOTIFY_CAP_PER_USER);
    expect(decision.map((notice) => notice.data.otherUserId)).toEqual(
      matches.slice(0, TRADE_NOTIFY_CAP_PER_USER).map((item) => item.userId),
    );
  });

  it("falls back to a generic title when the handle is unknown", () => {
    const [notice] = decideTradeNotifications({
      viewerId: "me",
      matches: [match({ userId: "u2" })],
      handles: new Map(),
      past: [],
      now: NOW,
    });
    expect(notice?.title).toBe("Nuevo intercambio posible con un coleccionista");
  });
});

describe("parseTradeData", () => {
  it("accepts the stored shape and rejects anything else", () => {
    expect(parseTradeData({ otherUserId: "u2", theyCanGive: ["v1"], youCanGive: [] })).toEqual({
      otherUserId: "u2",
      theyCanGive: ["v1"],
      youCanGive: [],
    });
    expect(parseTradeData(null)).toBeNull();
    expect(parseTradeData({ otherUserId: "u2", theyCanGive: "v1", youCanGive: [] })).toBeNull();
  });
});

describe("buildTradeParties", () => {
  const cardPocket = (variant: string, count?: number) =>
    count === undefined
      ? { kind: "card" as const, variant, instance: null }
      : { kind: "card" as const, variant, instance: null, count };

  // Real pocket codes of a 1x1, 2-sheet layout: the first contents land on them in order.
  const base = createEmptyLayout({ rows: 1, cols: 1 }, 2);
  const [, C1 = "", C2 = ""] = Object.keys(base.pockets);

  function layoutWith(contents: Array<ReturnType<typeof cardPocket>>) {
    const pockets: Layout["pockets"] = { ...base.pockets };
    contents.forEach((content, index) => {
      const code = Object.keys(base.pockets)[index];
      if (code) {
        pockets[code] = content;
      }
    });
    return { ...base, pockets };
  }

  it("builds collection extras, wishlist wants and opt-outs from rows", () => {
    const parties = buildTradeParties({
      profiles: [{ userId: "out", tradesOptIn: false }],
      binders: [
        {
          binderId: "b1",
          userId: "a",
          mode: "collection",
          layout: layoutWith([cardPocket("v1", 3), cardPocket("v2")]),
          goalVariantIds: ["v9"],
        },
        {
          binderId: "b2",
          userId: "out",
          mode: "collection",
          layout: layoutWith([cardPocket("v1", 2)]),
          goalVariantIds: [],
        },
      ],
      listings: [],
      wishlist: [{ userId: "b", variantId: "v7" }],
    });
    const byId = new Map(parties.map((party) => [party.userId, party]));
    expect(byId.get("a")?.tradeable.get("v1")).toBe(2);
    expect(byId.get("a")?.tradeable.has("v2")).toBe(false);
    expect([...(byId.get("a")?.wants ?? [])].sort()).toEqual(["v9"]);
    expect(byId.get("b")?.wants.has("v7")).toBe(true);
    expect(byId.get("out")?.optedIn).toBe(false);
    expect(byId.get("b")?.optedIn).toBe(true);
  });

  it("counts only disponible seller pockets", () => {
    const [seller] = buildTradeParties({
      profiles: [],
      binders: [
        {
          binderId: "b1",
          userId: "s",
          mode: "seller",
          layout: layoutWith([cardPocket("v1"), cardPocket("v1"), cardPocket("v1")]),
          goalVariantIds: [],
        },
      ],
      listings: [
        { binderId: "b1", pocketCode: C1, status: "reservado" },
        { binderId: "b1", pocketCode: C2, status: "vendido" },
      ],
      wishlist: [],
    });
    expect(seller?.tradeable.get("v1")).toBe(1);
  });

  it("skips binders whose layout does not parse and users with nothing to trade", () => {
    const parties = buildTradeParties({
      profiles: [],
      binders: [
        {
          binderId: "b1",
          userId: "x",
          mode: "collection",
          layout: { broken: true },
          goalVariantIds: [],
        },
      ],
      listings: [],
      wishlist: [],
    });
    expect(parties).toEqual([]);
  });
});

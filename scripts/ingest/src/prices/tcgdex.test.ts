import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type PriceSourceCard, restrictToUnpriced } from "./source";
import {
  createTcgdexSource,
  matchCardByNumber,
  normalizeCardNumber,
  normalizeSetName,
  pickTcgdexAmountUsd,
  setIdCandidates,
} from "./tcgdex";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8"));
}

const noLog = () => {};
const noSleep = async () => {};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routes TCGdex URLs to fixtures. Unknown sets and cards answer 404. */
function tcgdexRoutes(overrides: Record<string, () => Response> = {}) {
  const sets = fixture("tcgdex-sets.json");
  const routes: Record<string, () => Response> = {
    "/v2/en/sets": () => json(sets),
    "/v2/en/sets/sv03.5": () => json(fixture("tcgdex-set-sv03-5.json")),
    "/v2/en/sets/dpp": () => json(fixture("tcgdex-set-dpp.json")),
    "/v2/en/cards/sv03.5-025": () => json(fixture("tcgdex-card-sv03-5-025.json")),
    "/v2/en/cards/dpp-DP12": () => json(fixture("tcgdex-card-no-pricing.json")),
    ...overrides,
  };
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const path = new URL(url).pathname;
    const route = routes[path];
    return route ? route() : json({ error: "not found" }, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function sourceWith(fetchImpl: typeof fetch, extra: Parameters<typeof createTcgdexSource>[0] = {}) {
  return createTcgdexSource({
    fetch: fetchImpl,
    sleep: noSleep,
    log: noLog,
    backoffMs: 1,
    ...extra,
  });
}

describe("set mapping", () => {
  it("normalizes names: lowercase, & as and, no punctuation", () => {
    expect(normalizeSetName("Scarlet & Violet 151")).toBe("scarletandviolet151");
    expect(normalizeSetName("Scarlet and Violet 151")).toBe("scarletandviolet151");
    expect(normalizeSetName("Shining Legends!")).toBe(normalizeSetName("shining legends"));
  });

  it("tries TCGdex id spellings for pokemontcg.io set ids", () => {
    expect(setIdCandidates("sv1")).toContain("sv01");
    expect(setIdCandidates("sm35")).toContain("sm3.5");
    expect(setIdCandidates("sv3pt5")).toContain("sv03.5");
    expect(setIdCandidates("base1")[0]).toBe("base1");
  });

  it("resolves a set by id when the names differ", async () => {
    const { fetchImpl, calls } = tcgdexRoutes();
    const source = sourceWith(fetchImpl);
    await source.fetchUsdPrices([
      {
        externalCardId: "sm35-12",
        setName: "Sun & Moon Shining Legends (ES)",
        number: "12",
        variants: [{ variantId: "v-1", variant: "normal" }],
      },
    ]);
    expect(calls).toContain("https://api.tcgdex.net/v2/en/sets/sm3.5");
  });

  it("does not request set or card details for a set it cannot find", async () => {
    const { fetchImpl, calls } = tcgdexRoutes();
    const prices = await sourceWith(fetchImpl).fetchUsdPrices([
      {
        externalCardId: "zz9-1",
        setName: "Nonexistent Set",
        number: "1",
        variants: [{ variantId: "v-1", variant: "normal" }],
      },
    ]);
    expect(prices).toEqual([]);
    expect(calls.some((url) => url.includes("/sets/") && !url.endsWith("/sets"))).toBe(false);
  });
});

describe("card matching", () => {
  it("matches zero-padded TCGdex local ids to our numbers", () => {
    const cards = [
      { id: "sv03.5-025", localId: "025" },
      { id: "sv03.5-112", localId: "112" },
    ];
    expect(matchCardByNumber(cards, "25")?.id).toBe("sv03.5-025");
    expect(matchCardByNumber(cards, "112")?.id).toBe("sv03.5-112");
    expect(matchCardByNumber(cards, "1")).toBeUndefined();
  });

  it("matches promo numbers with letters, ignoring case and leading zeros", () => {
    const cards = [{ id: "dpp-DP12", localId: "DP12" }];
    expect(matchCardByNumber(cards, "DP12")?.id).toBe("dpp-DP12");
    expect(matchCardByNumber(cards, "dp12")?.id).toBe("dpp-DP12");
    expect(matchCardByNumber(cards, "DP012")?.id).toBe("dpp-DP12");
    expect(matchCardByNumber(cards, "12")).toBeUndefined();
  });

  it("normalizes card numbers without touching letters", () => {
    expect(normalizeCardNumber("025")).toBe("25");
    expect(normalizeCardNumber("0")).toBe("0");
    expect(normalizeCardNumber("TG01")).toBe("tg1");
  });
});

describe("price bucket selection", () => {
  const lucario = (
    fixture("tcgdex-card-dp1-6.json") as { pricing: { tcgplayer: Record<string, unknown> } }
  ).pricing.tcgplayer;

  it("maps holo to holofoil and reverse to reverse-holofoil, preferring marketPrice", () => {
    expect(pickTcgdexAmountUsd(lucario, "holo")).toBe(64.57);
    expect(pickTcgdexAmountUsd(lucario, "reverse")).toBe(44.35);
  });

  it("falls back to midPrice when marketPrice is null", () => {
    const pikachu = (
      fixture("tcgdex-card-sv03-5-025.json") as { pricing: { tcgplayer: Record<string, unknown> } }
    ).pricing.tcgplayer;
    expect(pickTcgdexAmountUsd(pikachu, "normal")).toBe(0.3);
  });

  it("returns null when the bucket is missing, empty or not the variant's printing", () => {
    expect(pickTcgdexAmountUsd(lucario, "normal")).toBeNull();
    expect(pickTcgdexAmountUsd(lucario, "masterball")).toBeNull();
    expect(pickTcgdexAmountUsd(undefined, "holo")).toBeNull();
    expect(pickTcgdexAmountUsd({ holofoil: { marketPrice: 0 } }, "holo")).toBeNull();
    expect(pickTcgdexAmountUsd(lucario, "unknown-variant")).toBeNull();
  });

  it("does not read 1st-edition buckets for a normal printing", () => {
    const pikachu = (
      fixture("tcgdex-card-sv03-5-025.json") as { pricing: { tcgplayer: Record<string, unknown> } }
    ).pricing.tcgplayer;
    expect(pickTcgdexAmountUsd(pikachu, "holo")).toBeNull();
  });

  it("accepts camelCase bucket names as well as kebab-case", () => {
    expect(pickTcgdexAmountUsd({ reverseHolofoil: { marketPrice: 2 } }, "reverse")).toBe(2);
  });
});

describe("createTcgdexSource", () => {
  it("prices resolved cards, leaves unpriced variants out and adds the Cardmarket EUR average", async () => {
    const { fetchImpl } = tcgdexRoutes();
    const cards: PriceSourceCard[] = [
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [
          { variantId: "v-normal", variant: "normal" },
          { variantId: "v-reverse", variant: "reverse" },
          { variantId: "v-holo", variant: "holo" },
        ],
      },
    ];
    const prices = await sourceWith(fetchImpl).fetchUsdPrices(cards);
    expect(prices).toEqual([
      { variantId: "v-normal", amount: 0.3, currency: "usd" },
      { variantId: "v-reverse", amount: 1.5, currency: "usd" },
      { variantId: "v-normal", amount: 0.25, currency: "eur", source: "cardmarket" },
    ]);
  });

  it("returns nothing for a card whose TCGdex entry has no pricing", async () => {
    const { fetchImpl } = tcgdexRoutes();
    const prices = await sourceWith(fetchImpl).fetchUsdPrices([
      {
        externalCardId: "dpp-DP12",
        setName: "DP Black Star Promos",
        number: "DP12",
        variants: [{ variantId: "v-promo", variant: "normal" }],
      },
    ]);
    expect(prices).toEqual([]);
  });

  it("retries a 503 and then succeeds", async () => {
    let setsCalls = 0;
    const { fetchImpl } = tcgdexRoutes({
      "/v2/en/sets": () => {
        setsCalls++;
        return setsCalls === 1 ? json({}, 503) : json(fixture("tcgdex-sets.json"));
      },
    });
    const prices = await sourceWith(fetchImpl).fetchUsdPrices([
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [{ variantId: "v-reverse", variant: "reverse" }],
      },
    ]);
    expect(setsCalls).toBe(2);
    expect(prices[0]).toEqual({ variantId: "v-reverse", amount: 1.5, currency: "usd" });
  });

  it("leaves cards unpriced when the sets list keeps failing", async () => {
    const { fetchImpl } = tcgdexRoutes({ "/v2/en/sets": () => json({}, 500) });
    const prices = await sourceWith(fetchImpl, { maxAttempts: 2 }).fetchUsdPrices([
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [{ variantId: "v-reverse", variant: "reverse" }],
      },
    ]);
    expect(prices).toEqual([]);
  });

  it("skips the remaining cards once the deadline has passed", async () => {
    const { fetchImpl, calls } = tcgdexRoutes();
    let clock = 0;
    const prices = await sourceWith(fetchImpl, {
      deadlineMs: 1_000,
      now: () => {
        clock += 5_000;
        return clock;
      },
    }).fetchUsdPrices([
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [{ variantId: "v-reverse", variant: "reverse" }],
      },
    ]);
    expect(prices).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("returns an empty list without requests when there are no cards", async () => {
    const { fetchImpl, calls } = tcgdexRoutes();
    expect(await sourceWith(fetchImpl).fetchUsdPrices([])).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe("fallback partition", () => {
  const cards: PriceSourceCard[] = [
    {
      externalCardId: "sv3pt5-25",
      setName: "Scarlet & Violet 151",
      number: "25",
      variants: [
        { variantId: "v-a", variant: "normal" },
        { variantId: "v-b", variant: "reverse" },
      ],
    },
    {
      externalCardId: "dpp-DP12",
      setName: "DP Black Star Promos",
      number: "DP12",
      variants: [{ variantId: "v-c", variant: "normal" }],
    },
  ];

  it("keeps only the variants TCGdex did not price, dropping fully priced cards", () => {
    expect(restrictToUnpriced(cards, new Set(["v-a", "v-b"]))).toEqual([
      {
        externalCardId: "dpp-DP12",
        setName: "DP Black Star Promos",
        number: "DP12",
        variants: [{ variantId: "v-c", variant: "normal" }],
      },
    ]);
  });

  it("keeps a partially priced card with only its unpriced variant", () => {
    const [partial] = restrictToUnpriced(cards, new Set(["v-a"]));
    expect(partial?.variants).toEqual([{ variantId: "v-b", variant: "reverse" }]);
    expect(restrictToUnpriced(cards, new Set())).toEqual(cards);
  });
});

describe("per-variant outcomes", () => {
  it("explains why each variant is priced or unpriced", async () => {
    const { fetchImpl } = tcgdexRoutes();
    const results = await sourceWith(fetchImpl).diagnose([
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [
          { variantId: "v-normal", variant: "normal" },
          { variantId: "v-pokeball", variant: "pokeball" },
        ],
      },
      {
        externalCardId: "zz9-1",
        setName: "Nonexistent Set",
        number: "1",
        variants: [{ variantId: "v-no-set", variant: "normal" }],
      },
      {
        externalCardId: "sv3pt5-999",
        setName: "Scarlet & Violet 151",
        number: "999",
        variants: [{ variantId: "v-no-card", variant: "normal" }],
      },
      {
        externalCardId: "x-1",
        variants: [{ variantId: "v-no-name", variant: "normal" }],
      },
    ]);

    const outcomes = Object.fromEntries(
      results.map((result) => [result.variantId, result.outcome]),
    );
    expect(outcomes).toEqual({
      "v-normal": "priced",
      "v-pokeball": "no-bucket-price",
      "v-no-set": "set-not-mapped",
      "v-no-card": "card-not-found",
      "v-no-name": "no-set-name",
    });
    expect(results.find((result) => result.variantId === "v-normal")?.amount).toBe(0.3);
  });

  it("reads a card whose tcgplayer pricing is null: no USD price, the Cardmarket average is kept", async () => {
    const nullTcgplayer = {
      id: "sv03.5-025",
      localId: "025",
      pricing: { tcgplayer: null, cardmarket: { avg: 2.5 } },
    };
    const { fetchImpl } = tcgdexRoutes({
      "/v2/en/cards/sv03.5-025": () => json(nullTcgplayer),
    });
    const cards: PriceSourceCard[] = [
      {
        externalCardId: "sv3pt5-25",
        setName: "Scarlet & Violet 151",
        number: "25",
        variants: [{ variantId: "v-normal", variant: "normal" }],
      },
    ];
    const source = sourceWith(fetchImpl);

    const [result] = await source.diagnose(cards);
    expect(result?.outcome).toBe("no-bucket-price");
    expect(await source.fetchUsdPrices(cards)).toEqual([
      { variantId: "v-normal", amount: 2.5, currency: "eur", source: "cardmarket" },
    ]);
  });
});

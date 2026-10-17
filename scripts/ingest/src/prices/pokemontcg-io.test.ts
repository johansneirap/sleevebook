import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildCardsUrl,
  buildIdQuery,
  chunk,
  createPokemontcgIoSource,
  parseCardsResponse,
} from "./pokemontcg-io";
import type { PriceSourceCard } from "./source";

const fixture = JSON.parse(
  readFileSync(new URL("./__fixtures__/pokemontcg-cards.json", import.meta.url), "utf-8"),
);

const cards: PriceSourceCard[] = [
  {
    externalCardId: "sv1-1",
    variants: [
      { variantId: "v-1-normal", variant: "normal" },
      { variantId: "v-1-reverse", variant: "reverse" },
    ],
  },
  { externalCardId: "sv1-2", variants: [{ variantId: "v-2-holo", variant: "holo" }] },
  { externalCardId: "sv1-3", variants: [{ variantId: "v-3-holo", variant: "holo" }] },
  { externalCardId: "sv1-4", variants: [{ variantId: "v-4-normal", variant: "normal" }] },
  { externalCardId: "sv1-5", variants: [{ variantId: "v-5-normal", variant: "normal" }] },
];

const noLog = () => {};
const noSleep = async () => {};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("parseCardsResponse", () => {
  it("maps tcgplayer buckets to variant prices, preferring market over mid", () => {
    const prices = parseCardsResponse(fixture, cards);
    expect(prices).toEqual([
      // sv1-1 normal: market 0.15 wins over mid 0.2
      { variantId: "v-1-normal", amount: 0.15 },
      // sv1-1 reverse: market null, falls back to mid 0.45
      { variantId: "v-1-reverse", amount: 0.45 },
      // sv1-2 holo maps to the "holofoil" bucket, mid 6.5 (no market)
      { variantId: "v-2-holo", amount: 6.5 },
      // sv1-3 holo: market 13.37 wins over mid 14
      { variantId: "v-3-holo", amount: 13.37 },
    ]);
  });

  it("skips zero prices, cards without tcgplayer data and unknown card ids", () => {
    const prices = parseCardsResponse(fixture, cards);
    const ids = prices.map((price) => price.variantId);
    expect(ids).not.toContain("v-4-normal");
    expect(ids).not.toContain("v-5-normal");
    expect(parseCardsResponse(fixture, [])).toEqual([]);
  });

  it("returns nothing for a variant whose bucket is absent from the card", () => {
    const prices = parseCardsResponse(fixture, [
      { externalCardId: "sv1-1", variants: [{ variantId: "v-x", variant: "masterball" }] },
    ]);
    expect(prices).toEqual([]);
  });

  it("rejects a response that is not shaped like /v2/cards", () => {
    expect(() => parseCardsResponse({ nope: true }, cards)).toThrow();
  });
});

describe("query batching", () => {
  it("chunks ids into batches of the given size, keeping order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });

  it("builds an OR query over exact card ids", () => {
    expect(buildIdQuery(["sv1-1", "sv1-2"])).toBe('id:"sv1-1" OR id:"sv1-2"');
  });

  it("drops quote characters so an id cannot break out of the query", () => {
    expect(buildIdQuery(['a"b'])).toBe('id:"ab"');
  });

  it("encodes the query and asks for only id and tcgplayer", () => {
    const url = new URL(buildCardsUrl(["sv1-1", "sv1-2"], "https://example.test/v2/cards"));
    expect(url.searchParams.get("q")).toBe('id:"sv1-1" OR id:"sv1-2"');
    expect(url.searchParams.get("select")).toBe("id,tcgplayer");
    expect(url.searchParams.get("pageSize")).toBe("250");
  });

  it("sends one request per batch and the API key header when configured", async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      return jsonResponse({ data: [] });
    });
    const manyCards: PriceSourceCard[] = Array.from({ length: 120 }, (_, index) => ({
      externalCardId: `xy1-${index + 1}`,
      variants: [{ variantId: `v-${index}`, variant: "normal" }],
    }));

    const source = createPokemontcgIoSource({
      apiKey: "test-key",
      batchSize: 50,
      delayMs: 0,
      fetch: fetchMock as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    await source.fetchUsdPrices(manyCards);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seen[0]?.headers["X-Api-Key"]).toBe("test-key");
    const firstQuery = new URL(seen[0]?.url as string).searchParams.get("q") as string;
    expect(firstQuery.split(" OR ")).toHaveLength(50);
  });
});

describe("createPokemontcgIoSource", () => {
  it("is named tcgplayer and returns parsed prices", async () => {
    const source = createPokemontcgIoSource({
      fetch: (async () => jsonResponse(fixture)) as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    expect(source.name).toBe("tcgplayer");
    const prices = await source.fetchUsdPrices(cards);
    expect(prices).toHaveLength(4);
  });

  it("retries on 429 and succeeds, honoring Retry-After", async () => {
    const sleeps: number[] = [];
    const responses = [
      new Response("", { status: 429, headers: { "retry-after": "2" } }),
      jsonResponse(fixture),
    ];
    const source = createPokemontcgIoSource({
      fetch: (async () => responses.shift() as Response) as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      log: noLog,
    });
    const prices = await source.fetchUsdPrices(cards);
    expect(prices).toHaveLength(4);
    expect(sleeps).toEqual([2000]);
  });

  it("retries 5xx with exponential backoff and gives up after maxAttempts", async () => {
    const sleeps: number[] = [];
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }));
    const source = createPokemontcgIoSource({
      maxAttempts: 3,
      backoffMs: 10,
      fetch: fetchMock as unknown as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      log: noLog,
    });
    await expect(source.fetchUsdPrices(cards)).rejects.toThrow("all 1 batches failed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([10, 20]);
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 400 }));
    const source = createPokemontcgIoSource({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    await expect(source.fetchUsdPrices(cards)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the prices of the batches that succeeded when another batch fails", async () => {
    const batchCards: PriceSourceCard[] = [
      { externalCardId: "sv1-1", variants: [{ variantId: "v-1-normal", variant: "normal" }] },
      { externalCardId: "sv1-2", variants: [{ variantId: "v-2-holo", variant: "holo" }] },
    ];
    const responses = [
      jsonResponse({
        data: [{ id: "sv1-1", tcgplayer: { prices: { normal: { market: 1.5 } } } }],
      }),
      new Response("", { status: 400 }),
    ];
    const source = createPokemontcgIoSource({
      batchSize: 1,
      delayMs: 0,
      fetch: (async () => responses.shift() as Response) as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    const prices = await source.fetchUsdPrices(batchCards);
    expect(prices).toEqual([{ variantId: "v-1-normal", amount: 1.5 }]);
  });

  it("stops issuing requests once the overall deadline has passed", async () => {
    let clock = 0;
    const fetchMock = vi.fn(async () => {
      clock += 1000;
      return jsonResponse({ data: [] });
    });
    const manyCards: PriceSourceCard[] = Array.from({ length: 5 }, (_, index) => ({
      externalCardId: `xy1-${index + 1}`,
      variants: [{ variantId: `v-${index}`, variant: "normal" }],
    }));
    const source = createPokemontcgIoSource({
      batchSize: 1,
      delayMs: 0,
      deadlineMs: 1500,
      now: () => clock,
      fetch: fetchMock as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    await source.fetchUsdPrices(manyCards);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list without any request when there are no cards", async () => {
    const fetchMock = vi.fn();
    const source = createPokemontcgIoSource({
      fetch: fetchMock as unknown as typeof fetch,
      sleep: noSleep,
      log: noLog,
    });
    expect(await source.fetchUsdPrices([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

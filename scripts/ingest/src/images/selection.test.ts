import { describe, expect, it, vi } from "vitest";
import { variantImageKey } from "./pipeline";
import {
  describeError,
  hasR2Images,
  mergeR2Images,
  parseImageArgs,
  pokemontcgSourceUrl,
  variantKeyOf,
  withRetry,
} from "./selection";

describe("parseImageArgs", () => {
  it("defaults to the referenced variants only, capped at 500, live", () => {
    expect(parseImageArgs([])).toEqual({ all: false, limit: null, cap: 500, dryRun: false });
  });

  it("reads the flags, with and without =", () => {
    expect(parseImageArgs(["--all", "--limit", "200", "--cap=50", "--dry-run"])).toEqual({
      all: true,
      limit: 200,
      cap: 50,
      dryRun: true,
    });
  });

  it("rejects --limit without --all, non-positive numbers and unknown flags", () => {
    expect(() => parseImageArgs(["--limit", "5"])).toThrow("only applies together with --all");
    expect(() => parseImageArgs(["--cap", "0"])).toThrow("positive whole number");
    expect(() => parseImageArgs(["--cap", "2.5"])).toThrow("positive whole number");
    expect(() => parseImageArgs(["--cap"])).toThrow("positive whole number");
    expect(() => parseImageArgs(["--nope"])).toThrow("Unknown argument: --nope");
  });
});

describe("source image selection", () => {
  it("copies the large pokemontcg.io image, falling back to the small one", () => {
    expect(
      pokemontcgSourceUrl({
        "pokemontcg.io": {
          small: "https://images.pokemontcg.io/sv1/112.png",
          large: "https://images.pokemontcg.io/sv1/112_hires.png",
        },
      }),
    ).toBe("https://images.pokemontcg.io/sv1/112_hires.png");
    expect(
      pokemontcgSourceUrl({
        "pokemontcg.io": { small: "https://images.pokemontcg.io/sv1/112.png" },
      }),
    ).toBe("https://images.pokemontcg.io/sv1/112.png");
  });

  it("returns null when there is no pokemontcg.io image to copy", () => {
    expect(pokemontcgSourceUrl(null)).toBeNull();
    expect(pokemontcgSourceUrl({ r2: { high: "https://x/high.jpg" } })).toBeNull();
    expect(pokemontcgSourceUrl({ "pokemontcg.io": {} })).toBeNull();
  });

  it("treats a variant as stored once images.r2 is present", () => {
    expect(hasR2Images({ "pokemontcg.io": { large: "x" } })).toBe(false);
    expect(hasR2Images({ r2: null })).toBe(false);
    expect(hasR2Images({ r2: { high: "https://assets/high.jpg" } })).toBe(true);
    expect(hasR2Images(null)).toBe(false);
  });
});

describe("R2 key naming", () => {
  it("builds the same key as the catalog ingest: <card id>-<variant>/<size>.jpg", () => {
    const variantKey = variantKeyOf("sv1-112", "normal");
    expect(variantKey).toBe("sv1-112-normal");
    expect(variantImageKey(variantKey, "high")).toBe("cards/sv1-112-normal/high.jpg");
    expect(variantImageKey(variantKeyOf("swsh12pt5gg-GG56", "holo"), "thumbnail")).toBe(
      "cards/swsh12pt5gg-GG56-holo/thumbnail.jpg",
    );
  });

  it("keeps the pokemontcg.io entry and adds the three R2 URLs", () => {
    const merged = mergeR2Images(
      { "pokemontcg.io": { small: "s", large: "l" } },
      {
        thumbnail: "https://assets/cards/a/thumbnail.jpg",
        medium: "https://assets/cards/a/medium.jpg",
        high: "https://assets/cards/a/high.jpg",
      },
    );
    expect(merged).toEqual({
      "pokemontcg.io": { small: "s", large: "l" },
      r2: {
        thumbnail: "https://assets/cards/a/thumbnail.jpg",
        medium: "https://assets/cards/a/medium.jpg",
        high: "https://assets/cards/a/high.jpg",
      },
    });
  });
});

describe("withRetry", () => {
  it("returns the first success and waits with exponential backoff between attempts", async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error("boom");
        }
        return "ok";
      },
      { attempts: 3, baseDelayMs: 10, sleep },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it("rethrows the last error once the attempts are used up", async () => {
    const sleep = vi.fn(async () => {});
    await expect(
      withRetry(
        async () => {
          throw new Error("still down");
        },
        { attempts: 2, baseDelayMs: 1, sleep },
      ),
    ).rejects.toThrow("still down");
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

describe("describeError", () => {
  it("unwraps AggregateError so connection failures are readable", () => {
    const error = new AggregateError([new Error("connect ECONNREFUSED 127.0.0.1:9090")], "");
    expect(describeError(error)).toBe("Error: connect ECONNREFUSED 127.0.0.1:9090");
  });

  it("names the error type when the message is empty, and stringifies anything else", () => {
    expect(describeError(new TypeError(""))).toBe("TypeError");
    expect(describeError(new Error("bad"))).toBe("Error: bad");
    expect(describeError("plain")).toBe("plain");
  });
});

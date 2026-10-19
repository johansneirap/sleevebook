import { z } from "zod";
import type { FetchedPrice, PriceSource, PriceSourceCard } from "./source";

export const TCGDEX_BASE_URL = "https://api.tcgdex.net/v2/en";

/** Our variant name -> TCGdex tcgplayer bucket (kebab-case). Same meaning as TCGPLAYER_PRICE_KEY. */
export const TCGDEX_BUCKET_KEY: Record<string, string> = {
  normal: "normal",
  holo: "holofoil",
  reverse: "reverse-holofoil",
  pokeball: "pokeball",
  masterball: "masterball",
};

const setsSchema = z.array(z.object({ id: z.string(), name: z.string() }).loose());

type TcgdexSet = z.infer<typeof setsSchema>[number];

const setDetailSchema = z
  .object({
    cards: z.array(
      z
        .object({
          id: z.string(),
          localId: z.union([z.string(), z.number()]).transform((value) => String(value)),
        })
        .loose(),
    ),
  })
  .loose();

// TCGdex sends `tcgplayer: null` (and sometimes `pricing: null`) for cards it
// has no TCGplayer data for; a strict "optional" rejected the whole card.
const cardDetailSchema = z
  .object({
    pricing: z
      .object({
        tcgplayer: z.record(z.string(), z.unknown()).nullish(),
        cardmarket: z.unknown().optional(),
      })
      .loose()
      .nullish(),
  })
  .loose();

const bucketSchema = z
  .object({
    marketPrice: z.number().nullish(),
    midPrice: z.number().nullish(),
  })
  .loose();

const cardmarketSchema = z.object({ avg: z.number().nullish() }).loose();

function positive(value: number | null | undefined): number | null {
  return typeof value === "number" && value > 0 ? value : null;
}

/** Lowercase, `&` as "and", everything but letters and digits removed. */
export function normalizeSetName(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * TCGdex set ids for a pokemontcg.io set id, most likely first. Examples:
 * "sv1" -> "sv01", "sm35" -> "sm3.5", "sv3pt5" -> "sv03.5".
 */
export function setIdCandidates(pokemontcgSetId: string): string[] {
  const id = pokemontcgSetId.trim().toLowerCase();
  const candidates = [id];

  const pt = /^([a-z]+)(\d+)pt(\d+)$/.exec(id);
  if (pt) {
    const [, prefix = "", digits = "", sub = ""] = pt;
    candidates.push(`${prefix}${digits.padStart(2, "0")}.${sub}`, `${prefix}${digits}.${sub}`);
  }

  const plain = /^([a-z]+)(\d+)$/.exec(id);
  if (plain) {
    const [, prefix = "", digits = ""] = plain;
    candidates.push(`${prefix}${digits.padStart(2, "0")}`);
    if (digits.length === 2) {
      candidates.push(`${prefix}${digits[0]}.${digits[1]}`);
    }
  }

  return [...new Set(candidates)];
}

/**
 * Card numbers compared without case and leading zeros: "025" == "25",
 * "DP012" == "DP12". Non-numeric numbers keep their letters.
 */
export function normalizeCardNumber(number: string): string {
  return number
    .trim()
    .toLowerCase()
    .replace(/^([a-z]*)0+(?=\d)/, "$1");
}

export interface TcgdexCardRef {
  id: string;
  localId: string;
}

/** The TCGdex card whose localId matches our card number, if any. */
export function matchCardByNumber(
  cards: TcgdexCardRef[],
  number: string,
): TcgdexCardRef | undefined {
  const exact = cards.find(
    (card) => card.localId.trim().toLowerCase() === number.trim().toLowerCase(),
  );
  if (exact) {
    return exact;
  }
  const target = normalizeCardNumber(number);
  return cards.find((card) => normalizeCardNumber(card.localId) === target);
}

function bucketKey(raw: string): string {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * USD amount for one variant from a TCGdex `pricing.tcgplayer` object.
 * Prefers marketPrice, falls back to midPrice; null when the bucket is absent
 * or has no positive price.
 */
export function pickTcgdexAmountUsd(
  tcgplayer: Record<string, unknown> | undefined,
  variant: string,
): number | null {
  const wanted = TCGDEX_BUCKET_KEY[variant];
  if (!wanted || !tcgplayer) {
    return null;
  }
  const entry = Object.entries(tcgplayer).find(([key]) => bucketKey(key) === wanted);
  if (!entry) {
    return null;
  }
  const parsed = bucketSchema.safeParse(entry[1]);
  if (!parsed.success) {
    return null;
  }
  return positive(parsed.data.marketPrice) ?? positive(parsed.data.midPrice);
}

/** pokemontcg.io card ids look like "sv1-112"; the set id is everything before the last dash. */
export function pokemontcgSetIdOf(externalCardId: string): string | null {
  const dash = externalCardId.lastIndexOf("-");
  return dash > 0 ? externalCardId.slice(0, dash) : null;
}

/**
 * Why one variant ended up priced or unpriced by TCGdex. "priced" is the only
 * outcome that stores a price; the rest are the reasons the coverage report shows.
 */
export type TcgdexOutcome =
  | "priced"
  | "no-set-name"
  | "set-not-mapped"
  | "tcgdex-unavailable"
  | "card-not-found"
  | "no-bucket-price"
  | "not-attempted";

export interface TcgdexVariantResult {
  variantId: string;
  variant: string;
  externalCardId: string;
  outcome: TcgdexOutcome;
  /** USD amount when outcome is "priced", otherwise null. */
  amount: number | null;
  tcgdexSetId?: string;
  tcgdexCardId?: string;
  /** Price bucket names TCGdex returned for the card, to spot naming gaps. */
  tcgdexBuckets?: string[];
}

export interface TcgdexSource extends PriceSource {
  /** The outcome of every requested variant, priced or not. Same lookups as fetchUsdPrices. */
  diagnose(cards: PriceSourceCard[]): Promise<TcgdexVariantResult[]>;
}

export interface TcgdexOptions {
  baseUrl?: string;
  /** Parallel card workers. */
  concurrency?: number;
  /** Pause after each network request, per worker. */
  requestDelayMs?: number;
  /** Attempts per request, including the first one. */
  maxAttempts?: number;
  /** Base for exponential backoff on 429/5xx and network errors. */
  backoffMs?: number;
  /** Per-request timeout. */
  requestTimeoutMs?: number;
  /** Wall-clock cap for one fetchUsdPrices call; remaining cards are left unpriced. */
  deadlineMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type SetResolution =
  | { status: "mapped"; id: string }
  | { status: "unmapped" }
  | { status: "unavailable" };

interface CardResolution {
  variants: TcgdexVariantResult[];
  /** Cardmarket average attached to the "normal" variant, when TCGdex has one. */
  eur: FetchedPrice | null;
  /** The card was found in TCGdex (priced or not). */
  matched: boolean;
}

/**
 * TCGdex as a PriceSource. Returns TCGplayer USD prices (name "tcgplayer", so
 * the UI and alerts keep reading them) and card-level Cardmarket EUR averages
 * (source "cardmarket", currency "eur", attached to the "normal" variant only).
 *
 * Cards it cannot resolve or price are simply absent from the result; the job
 * sends those variants to the fallback source.
 */
export function createTcgdexSource(options: TcgdexOptions = {}): TcgdexSource {
  const {
    baseUrl = TCGDEX_BASE_URL,
    concurrency = 4,
    requestDelayMs = 150,
    maxAttempts = 3,
    backoffMs = 1_000,
    requestTimeoutMs = 20_000,
    deadlineMs = 15 * 60_000,
    fetch: fetchImpl = fetch,
    sleep = defaultSleep,
    now = Date.now,
    log = (message: string) => console.log(message),
  } = options;

  /** Resolves to undefined on 404; throws after the last failed attempt. */
  async function getJson(url: string): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }
        const waitMs = backoffMs * 2 ** (attempt - 1);
        log(`TCGdex network error (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (response.status === 404) {
        await sleep(requestDelayMs);
        return undefined;
      }
      if (response.ok) {
        const json: unknown = await response.json();
        await sleep(requestDelayMs);
        return json;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= maxAttempts) {
        throw new Error(`TCGdex responded ${response.status} for ${url}`);
      }
      const waitMs = backoffMs * 2 ** (attempt - 1);
      log(
        `TCGdex responded ${response.status} (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }

  let setsPromise: Promise<TcgdexSet[] | null> | undefined;
  const setIdPromises = new Map<string, Promise<SetResolution>>();
  const setCardsPromises = new Map<string, Promise<TcgdexCardRef[] | null>>();

  /** The /sets list, fetched once per source instance. Null when unavailable. */
  function getSets() {
    setsPromise ??= (async () => {
      try {
        const parsed = setsSchema.safeParse(await getJson(`${baseUrl}/sets`));
        if (!parsed.success) {
          log("TCGdex /sets response not understood; all cards go to the fallback");
          return null;
        }
        return parsed.data;
      } catch (error) {
        log(`TCGdex /sets failed: ${String(error)}`);
        return null;
      }
    })();
    return setsPromise;
  }

  /** TCGdex set id for our set, by name first, then by set id candidates. */
  function resolveSetId(setName: string, pokemontcgSetId: string | null): Promise<SetResolution> {
    const key = `${setName}\u0000${pokemontcgSetId ?? ""}`;
    let promise = setIdPromises.get(key);
    if (!promise) {
      promise = (async (): Promise<SetResolution> => {
        const sets = await getSets();
        if (!sets) {
          return { status: "unavailable" };
        }
        const candidates = pokemontcgSetId ? setIdCandidates(pokemontcgSetId) : [];
        const wantedName = normalizeSetName(setName);
        const byName = sets.filter((set) => normalizeSetName(set.name) === wantedName);
        if (byName.length > 0) {
          const preferred = byName.find((set) => candidates.includes(set.id.toLowerCase()));
          const chosen = preferred ?? byName[0];
          return chosen ? { status: "mapped", id: chosen.id } : { status: "unmapped" };
        }
        for (const candidate of candidates) {
          const hit = sets.find((set) => set.id.toLowerCase() === candidate);
          if (hit) {
            return { status: "mapped", id: hit.id };
          }
        }
        return { status: "unmapped" };
      })();
      setIdPromises.set(key, promise);
    }
    return promise;
  }

  /** Card list of one TCGdex set, fetched once per run. */
  function getSetCards(tcgdexSetId: string): Promise<TcgdexCardRef[] | null> {
    let promise = setCardsPromises.get(tcgdexSetId);
    if (!promise) {
      promise = (async () => {
        try {
          const json = await getJson(`${baseUrl}/sets/${encodeURIComponent(tcgdexSetId)}`);
          const parsed = setDetailSchema.safeParse(json);
          return parsed.success
            ? parsed.data.cards.map((card) => ({ id: card.id, localId: card.localId }))
            : null;
        } catch (error) {
          log(`TCGdex set ${tcgdexSetId} failed: ${String(error)}`);
          return null;
        }
      })();
      setCardsPromises.set(tcgdexSetId, promise);
    }
    return promise;
  }

  /** Every variant of a card gets the same outcome when the card never resolved. */
  function unresolved(
    card: PriceSourceCard,
    outcome: TcgdexOutcome,
    tcgdexSetId?: string,
  ): CardResolution {
    return {
      variants: card.variants.map(({ variantId, variant }) => ({
        variantId,
        variant,
        externalCardId: card.externalCardId,
        outcome,
        amount: null,
        tcgdexSetId,
      })),
      eur: null,
      matched: false,
    };
  }

  async function resolveCard(card: PriceSourceCard): Promise<CardResolution> {
    if (!card.setName || !card.number) {
      return unresolved(card, "no-set-name");
    }
    const setResolution = await resolveSetId(card.setName, pokemontcgSetIdOf(card.externalCardId));
    if (setResolution.status === "unavailable") {
      return unresolved(card, "tcgdex-unavailable");
    }
    if (setResolution.status === "unmapped") {
      return unresolved(card, "set-not-mapped");
    }
    const tcgdexSetId = setResolution.id;

    const cards = await getSetCards(tcgdexSetId);
    if (!cards) {
      return unresolved(card, "tcgdex-unavailable", tcgdexSetId);
    }
    const match = matchCardByNumber(cards, card.number);
    if (!match) {
      return unresolved(card, "card-not-found", tcgdexSetId);
    }

    const json = await getJson(`${baseUrl}/cards/${encodeURIComponent(match.id)}`);
    const parsed = cardDetailSchema.safeParse(json);
    if (!parsed.success) {
      return unresolved(card, "tcgdex-unavailable", tcgdexSetId);
    }
    const tcgplayer = parsed.data.pricing?.tcgplayer ?? undefined;
    const tcgdexBuckets = Object.keys(tcgplayer ?? {}).filter(
      (key) => key !== "unit" && key !== "updated",
    );

    const variants: TcgdexVariantResult[] = card.variants.map(({ variantId, variant }) => {
      const amount = pickTcgdexAmountUsd(tcgplayer, variant);
      return {
        variantId,
        variant,
        externalCardId: card.externalCardId,
        outcome: amount !== null ? "priced" : "no-bucket-price",
        amount,
        tcgdexSetId,
        tcgdexCardId: match.id,
        tcgdexBuckets,
      };
    });

    const cardmarket = cardmarketSchema.safeParse(parsed.data.pricing?.cardmarket);
    const eurAmount = cardmarket.success ? positive(cardmarket.data.avg) : null;
    const normal = card.variants.find((entry) => entry.variant === "normal");
    const eur: FetchedPrice | null =
      eurAmount !== null && normal
        ? {
            variantId: normal.variantId,
            amount: eurAmount,
            currency: "eur",
            source: "cardmarket",
          }
        : null;

    return { variants, eur, matched: true };
  }

  /** Resolves every card with a small worker pool, stopping at the run deadline. */
  async function resolveAll(cards: PriceSourceCard[]) {
    const startedAt = now();
    const resolutions: CardResolution[] = [];
    const skipped: PriceSourceCard[] = [];
    let next = 0;

    const worker = async () => {
      while (next < cards.length) {
        if (now() - startedAt > deadlineMs) {
          skipped.push(...cards.slice(next));
          next = cards.length;
          break;
        }
        const card = cards[next++];
        if (!card) {
          break;
        }
        try {
          resolutions.push(await resolveCard(card));
        } catch (error) {
          log(`TCGdex card ${card.externalCardId} failed: ${String(error)}`);
          resolutions.push(unresolved(card, "tcgdex-unavailable"));
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, cards.length) }, worker));
    return { resolutions, skipped };
  }

  return {
    name: "tcgplayer",
    async fetchUsdPrices(cards) {
      const { resolutions, skipped } = await resolveAll(cards);
      const prices: FetchedPrice[] = [];
      let resolvedCards = 0;
      for (const resolution of resolutions) {
        if (resolution.matched) {
          resolvedCards++;
        }
        for (const variant of resolution.variants) {
          if (variant.amount !== null) {
            prices.push({ variantId: variant.variantId, amount: variant.amount, currency: "usd" });
          }
        }
        if (resolution.eur) {
          prices.push(resolution.eur);
        }
      }

      log(
        `TCGdex: ${resolvedCards}/${cards.length} cards resolved` +
          (skipped.length > 0 ? `; ${skipped.length} skipped at the deadline` : ""),
      );
      return prices;
    },
    async diagnose(cards) {
      const { resolutions, skipped } = await resolveAll(cards);
      const results = resolutions.flatMap((resolution) => resolution.variants);
      for (const card of skipped) {
        for (const { variantId, variant } of card.variants) {
          results.push({
            variantId,
            variant,
            externalCardId: card.externalCardId,
            outcome: "not-attempted",
            amount: null,
          });
        }
      }
      return results;
    },
  };
}

import { z } from "zod";
import type { TcgplayerPriceBucket } from "../tcgplayer-prices";
import { pickTcgplayerAmountUsd } from "../tcgplayer-prices";
import type { FetchedPrice, PriceSource, PriceSourceCard } from "./source";

export const POKEMONTCG_CARDS_URL = "https://api.pokemontcg.io/v2/cards";

/** Card ids per request. Keeps the q= URL well under typical length limits. */
export const POKEMONTCG_BATCH_SIZE = 50;

const bucketSchema = z
  .object({
    market: z.number().nullable().optional(),
    mid: z.number().nullable().optional(),
  })
  .loose();

const responseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.string(),
          tcgplayer: z
            .object({
              prices: z.record(z.string(), bucketSchema).optional(),
            })
            .loose()
            .optional(),
        })
        .loose(),
    ),
  })
  .loose();

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/** Lucene-style query matching any of the given card ids. */
export function buildIdQuery(cardIds: string[]): string {
  return cardIds.map((id) => `id:"${id.replaceAll('"', "")}"`).join(" OR ");
}

export function buildCardsUrl(cardIds: string[], baseUrl = POKEMONTCG_CARDS_URL): string {
  const params = new URLSearchParams({
    q: buildIdQuery(cardIds),
    pageSize: "250",
    select: "id,tcgplayer",
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Turns a pokemontcg.io /v2/cards response into USD prices for the variants
 * requested in `cards`. Variants without a usable tcgplayer bucket are skipped.
 */
export function parseCardsResponse(json: unknown, cards: PriceSourceCard[]): FetchedPrice[] {
  const parsed = responseSchema.parse(json);
  const cardById = new Map(cards.map((card) => [card.externalCardId, card]));

  const prices: FetchedPrice[] = [];
  for (const apiCard of parsed.data) {
    const requested = cardById.get(apiCard.id);
    if (!requested) {
      continue;
    }
    const buckets = apiCard.tcgplayer?.prices as
      | Record<string, TcgplayerPriceBucket | undefined>
      | undefined;
    for (const { variantId, variant } of requested.variants) {
      const amount = pickTcgplayerAmountUsd(buckets, variant);
      if (amount !== null) {
        prices.push({ variantId, amount });
      }
    }
  }
  return prices;
}

export interface PokemontcgIoOptions {
  apiKey?: string;
  baseUrl?: string;
  batchSize?: number;
  /** Pause between consecutive batch requests. */
  delayMs?: number;
  /** Attempts per batch request, including the first one. */
  maxAttempts?: number;
  /** Base for exponential backoff on 429/5xx and network errors. */
  backoffMs?: number;
  /** Wall-clock cap for the whole fetch; remaining batches are skipped past it. */
  deadlineMs?: number;
  /** Per-request timeout; a timed-out request counts as a network error. */
  requestTimeoutMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const MAX_RETRY_AFTER_MS = 60_000;

/**
 * pokemontcg.io v2 as a PriceSource. Reads `tcgplayer.prices` per card; the
 * name "tcgplayer" matches what the UI shows as the price source.
 *
 * Throws only when every batch failed, so a partial outage still ingests the
 * prices that did arrive.
 */
export function createPokemontcgIoSource(options: PokemontcgIoOptions = {}): PriceSource {
  const {
    apiKey,
    baseUrl = POKEMONTCG_CARDS_URL,
    batchSize = POKEMONTCG_BATCH_SIZE,
    delayMs = 300,
    maxAttempts = 4,
    backoffMs = 1_000,
    deadlineMs = 20 * 60_000,
    requestTimeoutMs = 30_000,
    fetch: fetchImpl = fetch,
    sleep = defaultSleep,
    now = Date.now,
    log = (message: string) => console.log(message),
  } = options;

  async function getJson(url: string): Promise<unknown> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    for (let attempt = 1; ; attempt++) {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }
        const waitMs = backoffMs * 2 ** (attempt - 1);
        log(
          `pokemontcg.io network error (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      if (response.ok) {
        return response.json();
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= maxAttempts) {
        throw new Error(`pokemontcg.io responded ${response.status}`);
      }

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS)
          : backoffMs * 2 ** (attempt - 1);
      log(
        `pokemontcg.io responded ${response.status} (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }

  return {
    name: "tcgplayer",
    async fetchUsdPrices(cards) {
      const batches = chunk(cards, batchSize);
      const startedAt = now();
      const prices: FetchedPrice[] = [];
      let succeeded = 0;

      for (const [index, batch] of batches.entries()) {
        if (now() - startedAt > deadlineMs) {
          log(`pokemontcg.io deadline reached; skipping ${batches.length - index} batches`);
          break;
        }
        if (index > 0) {
          await sleep(delayMs);
        }

        const url = buildCardsUrl(
          batch.map((card) => card.externalCardId),
          baseUrl,
        );
        try {
          const json = await getJson(url);
          prices.push(...parseCardsResponse(json, batch));
          succeeded++;
        } catch (error) {
          log(`pokemontcg.io batch ${index + 1}/${batches.length} failed: ${String(error)}`);
        }
      }

      if (batches.length > 0 && succeeded === 0) {
        throw new Error(`pokemontcg.io: all ${batches.length} batches failed`);
      }
      return prices;
    },
  };
}

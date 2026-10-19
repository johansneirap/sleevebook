import { createDb, pricePoint } from "@sleevebook/db";
import { runPriceAlerts } from "./alerts";
import { createPokemontcgIoSource } from "./pokemontcg-io";
import { captureUsdRates } from "./rates";
import { collectReferencedVariants } from "./referenced";
import type { FetchedPrice } from "./source";
import { restrictToUnpriced } from "./source";
import { createTcgdexSource } from "./tcgdex";

export interface PricesSummary {
  /** Distinct referenced variants that have a card in our catalog with a pokemontcg.io id. */
  variantsReferenced: number;
  cardsQueried: number;
  pricedByTcgdex: number;
  pricedByPokemontcgIo: number;
  unpriced: number;
  /** Cardmarket EUR averages fetched from TCGdex. Not stored yet (see run notes). */
  cardmarketEur: number;
  pricesIngested: number;
  rates: Record<string, number> | null;
  alertsNotified: number;
}

async function main(): Promise<PricesSummary> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const apiKey = process.env.POKEMONTCG_API_KEY || undefined;

  const db = createDb(databaseUrl);
  try {
    let rates: Record<string, number> | null = null;
    try {
      rates = await captureUsdRates(db);
      console.log("Exchange rates stored:", rates);
    } catch (error) {
      console.warn("Exchange rates skipped; prices continue:", error);
    }

    console.log("Collecting referenced variants...");
    const referenced = await collectReferencedVariants(db);
    if (referenced.unmappedVariantIds.length > 0) {
      console.log(
        `${referenced.unmappedVariantIds.length} referenced variant ids have no pokemontcg.io card; skipped.`,
      );
    }

    // Primary: TCGdex. Its USD prices are TCGplayer's, so the UI keeps reading them.
    const primary = createTcgdexSource();
    console.log(`Fetching prices for ${referenced.cards.length} cards from TCGdex...`);
    const primaryPrices = await primary.fetchUsdPrices(referenced.cards);
    const primaryUsd = primaryPrices.filter((price) => (price.currency ?? "usd") === "usd");
    const cardmarketEur = primaryPrices.filter((price) => price.currency === "eur");
    const pricedByTcgdex = new Set(primaryUsd.map((price) => price.variantId));

    // Fallback: pokemontcg.io only for the variants TCGdex could not price.
    const missing = restrictToUnpriced(referenced.cards, pricedByTcgdex);
    const missingVariants = missing.reduce((total, card) => total + card.variants.length, 0);
    let fallbackUsd: FetchedPrice[] = [];
    if (missing.length > 0) {
      if (!apiKey) {
        console.log(
          "POKEMONTCG_API_KEY not set; the fallback uses the rate-limited anonymous API.",
        );
      }
      const fallback = createPokemontcgIoSource({ apiKey });
      console.log(`Falling back to ${fallback.name} for ${missingVariants} variants...`);
      try {
        fallbackUsd = await fallback.fetchUsdPrices(missing);
      } catch (error) {
        // TCGdex prices are already fetched; keep them even if the fallback is down.
        console.warn("pokemontcg.io fallback failed; TCGdex prices are still stored:", error);
      }
    }

    const pricedByPokemontcgIo = new Set(fallbackUsd.map((price) => price.variantId)).size;
    if (cardmarketEur.length > 0) {
      // pricing.ts (getLatestPrices) ignores currency and shows the newest row as US$,
      // so EUR rows stay out of price_point until that query filters by currency.
      console.warn(
        `${cardmarketEur.length} Cardmarket EUR prices fetched but not stored: the UI would show them as US$.`,
      );
    }

    const capturedAt = new Date();
    const rows = [
      ...primaryUsd.map((price) => ({
        variantId: price.variantId,
        source: primary.name,
        amount: price.amount,
      })),
      ...fallbackUsd.map((price) => ({
        variantId: price.variantId,
        source: "tcgplayer",
        amount: price.amount,
      })),
    ];
    if (rows.length > 0) {
      await db.insert(pricePoint).values(
        rows.map((row) => ({
          variantId: row.variantId,
          source: row.source,
          condition: null,
          currency: "usd",
          amount: row.amount.toFixed(2),
          capturedAt,
        })),
      );
    }

    // Prices are already stored; a failing alert step must not fail the job.
    let alertsNotified = 0;
    try {
      alertsNotified = await runPriceAlerts(db, capturedAt);
      console.log(`Price alerts: ${alertsNotified} notifications.`);
    } catch (error) {
      console.warn("Price alerts skipped; prices are stored:", error);
    }

    return {
      variantsReferenced: referenced.variantsReferenced,
      cardsQueried: referenced.cards.length,
      pricedByTcgdex: pricedByTcgdex.size,
      pricedByPokemontcgIo,
      unpriced: referenced.variantsReferenced - pricedByTcgdex.size - pricedByPokemontcgIo,
      cardmarketEur: cardmarketEur.length,
      pricesIngested: rows.length,
      rates,
      alertsNotified,
    };
  } finally {
    await db.$client.end();
  }
}

main()
  .then((summary) => {
    console.log(summary);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

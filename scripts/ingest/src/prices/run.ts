import { createDb, pricePoint } from "@sleevebook/db";
import { createPokemontcgIoSource } from "./pokemontcg-io";
import { captureUsdRates } from "./rates";
import { collectReferencedVariants } from "./referenced";

export interface PricesSummary {
  variantsReferenced: number;
  cardsQueried: number;
  pricesIngested: number;
  rates: Record<string, number> | null;
}

async function main(): Promise<PricesSummary> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const apiKey = process.env.POKEMONTCG_API_KEY || undefined;
  if (!apiKey) {
    console.log("POKEMONTCG_API_KEY not set; using the rate-limited anonymous API.");
  }

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

    const source = createPokemontcgIoSource({ apiKey });
    console.log(`Fetching prices for ${referenced.cards.length} cards from ${source.name}...`);
    const prices = await source.fetchUsdPrices(referenced.cards);

    const capturedAt = new Date();
    if (prices.length > 0) {
      await db.insert(pricePoint).values(
        prices.map((price) => ({
          variantId: price.variantId,
          source: source.name,
          condition: price.condition ?? null,
          currency: "usd",
          amount: price.amount.toFixed(2),
          capturedAt,
        })),
      );
    }

    return {
      variantsReferenced: referenced.variantsReferenced,
      cardsQueried: referenced.cards.length,
      pricesIngested: prices.length,
      rates,
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

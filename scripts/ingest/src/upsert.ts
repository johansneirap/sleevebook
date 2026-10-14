import { deriveVariants } from "@sleevebook/catalog";
import type { Database } from "@sleevebook/db";
import { card, cardVariant, externalId, game, pricePoint, set } from "@sleevebook/db";
import { and, eq } from "drizzle-orm";
import type { ImagePipelineConfig } from "./images/pipeline";
import { processVariantImage } from "./images/pipeline";
import type { CatalogSource, RawCard, RawSet } from "./source";

export const PROVIDER = "pokemontcg.io";

// Maps our derived variant names to the tcgplayer price bucket that prices
// that exact printing. Vintage-only buckets (1stEditionHolofoil, etc.) are
// intentionally not modeled here.
const TCGPLAYER_PRICE_KEY: Record<string, string> = {
  normal: "normal",
  holo: "holofoil",
  reverse: "reverseHolofoil",
  pokeball: "pokeball",
  masterball: "masterball",
};

function extractTcgplayerPriceUsd(rawCard: RawCard, variant: string): string | null {
  const key = TCGPLAYER_PRICE_KEY[variant];
  const priceData = key ? rawCard.tcgplayer?.prices?.[key] : undefined;
  const amount = priceData?.market ?? priceData?.mid;
  return typeof amount === "number" && amount > 0 ? amount.toFixed(2) : null;
}

export interface IngestSummary {
  setsUpserted: number;
  cardsUpserted: number;
  variantsUpserted: number;
  pricesIngested: number;
  needsReview: number;
}

export async function findExternalEntityId(
  db: Database,
  entityType: string,
  provider: string,
  externalIdValue: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ entityId: externalId.entityId })
    .from(externalId)
    .where(
      and(
        eq(externalId.entityType, entityType),
        eq(externalId.provider, provider),
        eq(externalId.externalId, externalIdValue),
      ),
    )
    .limit(1);
  return row?.entityId;
}

export async function linkExternalId(
  db: Database,
  entityType: string,
  entityId: string,
  provider: string,
  externalIdValue: string,
): Promise<void> {
  await db
    .insert(externalId)
    .values({ entityType, entityId, provider, externalId: externalIdValue })
    .onConflictDoNothing();
}

export async function ensurePokemonGame(db: Database): Promise<string> {
  const [existing] = await db.select({ id: game.id }).from(game).where(eq(game.name, "Pokémon"));
  if (existing) {
    return existing.id;
  }
  const [created] = await db.insert(game).values({ name: "Pokémon" }).returning({ id: game.id });
  return (created as { id: string }).id;
}

async function upsertSet(db: Database, gameId: string, raw: RawSet): Promise<string> {
  const values = {
    gameId,
    name: raw.name,
    era: raw.series ?? null,
    releasedAt: raw.releaseDate ? raw.releaseDate.replaceAll("/", "-") : null,
    printedTotal: raw.printedTotal ?? null,
    ptcgoCode: raw.ptcgoCode ?? null,
    language: "en",
  };

  const existingId = await findExternalEntityId(db, "set", PROVIDER, raw.id);
  if (existingId) {
    await db.update(set).set(values).where(eq(set.id, existingId));
    return existingId;
  }

  const [created] = await db.insert(set).values(values).returning({ id: set.id });
  const setId = (created as { id: string }).id;
  await linkExternalId(db, "set", setId, PROVIDER, raw.id);
  if (raw.ptcgoCode) {
    await linkExternalId(db, "set", setId, "ptcgo", raw.ptcgoCode);
  }
  return setId;
}

async function upsertCard(db: Database, setId: string, raw: RawCard): Promise<string> {
  const values = {
    setId,
    number: raw.number,
    name: raw.name,
    species: raw.supertype === "Pokémon" ? [raw.name] : null,
    supertype: raw.supertype,
    types: raw.types ?? null,
    rarity: raw.rarity ?? null,
    illustrator: raw.artist ?? null,
    language: "en",
  };

  const existingId = await findExternalEntityId(db, "card", PROVIDER, raw.id);
  if (existingId) {
    await db.update(card).set(values).where(eq(card.id, existingId));
    return existingId;
  }

  const [created] = await db.insert(card).values(values).returning({ id: card.id });
  const cardId = (created as { id: string }).id;
  await linkExternalId(db, "card", cardId, PROVIDER, raw.id);
  return cardId;
}

async function resolveImages(
  imagePipeline: ImagePipelineConfig | undefined,
  variantKey: string,
  images: RawCard["images"],
): Promise<Record<string, unknown> | null> {
  if (!images) {
    return null;
  }
  const sourceUrl = images.large ?? images.small;
  if (!imagePipeline || !sourceUrl) {
    return { [PROVIDER]: images };
  }
  const r2 = await processVariantImage(imagePipeline, variantKey, sourceUrl);
  return { [PROVIDER]: images, r2 };
}

async function upsertVariant(
  db: Database,
  cardId: string,
  variant: string,
  variantKey: string,
  images: RawCard["images"],
  needsReview: boolean,
  imagePipeline: ImagePipelineConfig | undefined,
): Promise<string> {
  const [existing] = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(and(eq(cardVariant.cardId, cardId), eq(cardVariant.variant, variant)));

  const imagesJson = await resolveImages(imagePipeline, variantKey, images);

  if (existing) {
    await db
      .update(cardVariant)
      .set({ images: imagesJson, needsReview })
      .where(eq(cardVariant.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(cardVariant)
    .values({ cardId, variant, images: imagesJson, needsReview })
    .returning({ id: cardVariant.id });
  return (created as { id: string }).id;
}

export async function upsertCatalog(
  db: Database,
  source: CatalogSource,
  imagePipeline?: ImagePipelineConfig,
): Promise<IngestSummary> {
  const gameId = await ensurePokemonGame(db);
  const summary: IngestSummary = {
    setsUpserted: 0,
    cardsUpserted: 0,
    variantsUpserted: 0,
    pricesIngested: 0,
    needsReview: 0,
  };

  for (const rawSet of source.sets) {
    const setId = await upsertSet(db, gameId, rawSet);
    summary.setsUpserted++;

    for (const rawCard of source.cardsBySetId.get(rawSet.id) ?? []) {
      const cardId = await upsertCard(db, setId, rawCard);
      summary.cardsUpserted++;

      const { variants, needsReview } = deriveVariants({
        rarity: rawCard.rarity,
        setName: rawSet.name,
        releasedAt: rawSet.releaseDate,
      });
      if (needsReview) {
        summary.needsReview++;
      }

      for (const variant of variants) {
        const variantKey = `${rawCard.id}-${variant}`;
        const variantId = await upsertVariant(
          db,
          cardId,
          variant,
          variantKey,
          rawCard.images,
          needsReview,
          imagePipeline,
        );
        summary.variantsUpserted++;

        const amount = extractTcgplayerPriceUsd(rawCard, variant);
        if (amount) {
          await db.insert(pricePoint).values({
            variantId,
            source: "tcgplayer",
            currency: "USD",
            amount,
          });
          summary.pricesIngested++;
        }
      }
    }
  }

  return summary;
}

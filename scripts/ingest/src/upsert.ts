import { deriveVariants } from "@sleevebook/catalog";
import type { Database } from "@sleevebook/db";
import { card, cardVariant, externalId, game, pricePoint, set } from "@sleevebook/db";
import { and, eq, inArray } from "drizzle-orm";
import type { ImagePipelineConfig } from "./images/pipeline";
import { processVariantImage } from "./images/pipeline";
import type { CatalogSource, RawCard, RawSet } from "./source";
import { pickTcgplayerAmountUsd } from "./tcgplayer-prices";

export const PROVIDER = "pokemontcg.io";

// The query-builder surface shared by a plain Database handle and the `tx`
// passed into db.transaction()'s callback -- lets the per-set upsert helpers
// run against either, so they can be used transactionally.
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Queryable = Database | Tx;

function extractTcgplayerPriceUsd(rawCard: RawCard, variant: string): string | null {
  const amount = pickTcgplayerAmountUsd(rawCard.tcgplayer?.prices, variant);
  return amount === null ? null : amount.toFixed(2);
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

function cardValues(setId: string, raw: RawCard) {
  return {
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

// Upserts every card of one set in a handful of round trips instead of one
// (or several) per card: a query-per-row approach is invisible against a
// local database but makes a full catalog ingest take hours against any
// connection with real network latency (a remote proxy, or the daily
// GitHub Actions job hitting production). Returns raw external id -> our
// card id for every card in the set, whether it was just inserted or
// already existed.
async function upsertCardsForSet(
  db: Queryable,
  setId: string,
  rawCards: RawCard[],
): Promise<Map<string, string>> {
  if (rawCards.length === 0) {
    return new Map();
  }

  const rawIds = rawCards.map((raw) => raw.id);
  const existingRows = await db
    .select({ externalId: externalId.externalId, entityId: externalId.entityId })
    .from(externalId)
    .where(
      and(
        eq(externalId.entityType, "card"),
        eq(externalId.provider, PROVIDER),
        inArray(externalId.externalId, rawIds),
      ),
    );
  const cardIdByRawId = new Map(existingRows.map((row) => [row.externalId, row.entityId]));

  const toUpdate: RawCard[] = [];
  const toInsert: RawCard[] = [];
  for (const raw of rawCards) {
    (cardIdByRawId.has(raw.id) ? toUpdate : toInsert).push(raw);
  }

  for (const raw of toUpdate) {
    const cardId = cardIdByRawId.get(raw.id) as string;
    await db.update(card).set(cardValues(setId, raw)).where(eq(card.id, cardId));
  }

  if (toInsert.length > 0) {
    const inserted = await db
      .insert(card)
      .values(toInsert.map((raw) => cardValues(setId, raw)))
      .returning({ id: card.id });
    toInsert.forEach((raw, index) => {
      const insertedRow = inserted[index] as { id: string };
      cardIdByRawId.set(raw.id, insertedRow.id);
    });
    await db.insert(externalId).values(
      toInsert.map((raw) => ({
        entityType: "card",
        entityId: cardIdByRawId.get(raw.id) as string,
        provider: PROVIDER,
        externalId: raw.id,
      })),
    );
  }

  return cardIdByRawId;
}

interface PlannedVariant {
  cardId: string;
  variant: string;
  variantKey: string;
  images: RawCard["images"];
  needsReview: boolean;
  rawCard: RawCard;
}

// Same round-trip-minimizing idea as upsertCardsForSet, applied to
// card_variant + price_point for every variant of every card in a set.
async function upsertVariantsForSet(
  db: Queryable,
  planned: PlannedVariant[],
  imagePipeline: ImagePipelineConfig | undefined,
): Promise<{ variantsUpserted: number; pricesIngested: number }> {
  if (planned.length === 0) {
    return { variantsUpserted: 0, pricesIngested: 0 };
  }

  const cardIds = [...new Set(planned.map((item) => item.cardId))];
  const existingRows = await db
    .select({ id: cardVariant.id, cardId: cardVariant.cardId, variant: cardVariant.variant })
    .from(cardVariant)
    .where(inArray(cardVariant.cardId, cardIds));
  const existingIdByKey = new Map(
    existingRows.map((row) => [`${row.cardId}:${row.variant}`, row.id]),
  );

  // Sequential on purpose: when imagePipeline is configured this fetches and
  // uploads to R2 per variant, and running a whole set's worth of those
  // concurrently would spike outbound requests well beyond what the ingest
  // has ever done before. Batching below targets DB round trips only.
  const resolvedImages: Array<Record<string, unknown> | null> = [];
  for (const item of planned) {
    resolvedImages.push(await resolveImages(imagePipeline, item.variantKey, item.images));
  }

  const toUpdate: Array<{
    id: string;
    item: PlannedVariant;
    images: Record<string, unknown> | null;
  }> = [];
  const toInsert: Array<{ item: PlannedVariant; images: Record<string, unknown> | null }> = [];
  planned.forEach((item, index) => {
    const key = `${item.cardId}:${item.variant}`;
    const existingId = existingIdByKey.get(key);
    const images = resolvedImages[index] ?? null;
    if (existingId) {
      toUpdate.push({ id: existingId, item, images });
    } else {
      toInsert.push({ item, images });
    }
  });

  for (const { id, item, images } of toUpdate) {
    await db
      .update(cardVariant)
      .set({ images, needsReview: item.needsReview })
      .where(eq(cardVariant.id, id));
  }

  const variantIdByKey = new Map(existingIdByKey);
  if (toInsert.length > 0) {
    const inserted = await db
      .insert(cardVariant)
      .values(
        toInsert.map(({ item, images }) => ({
          cardId: item.cardId,
          variant: item.variant,
          images,
          needsReview: item.needsReview,
        })),
      )
      .returning({ id: cardVariant.id });
    toInsert.forEach(({ item }, index) => {
      const insertedRow = inserted[index] as { id: string };
      variantIdByKey.set(`${item.cardId}:${item.variant}`, insertedRow.id);
    });
  }

  const priceRows = planned.flatMap((item) => {
    const amount = extractTcgplayerPriceUsd(item.rawCard, item.variant);
    const variantId = variantIdByKey.get(`${item.cardId}:${item.variant}`);
    if (!amount || !variantId) {
      return [];
    }
    return [{ variantId, source: "tcgplayer", currency: "USD", amount }];
  });
  if (priceRows.length > 0) {
    await db.insert(pricePoint).values(priceRows);
  }

  return { variantsUpserted: planned.length, pricesIngested: priceRows.length };
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

    const rawCards = source.cardsBySetId.get(rawSet.id) ?? [];

    // Everything for this set's cards + variants + prices happens inside one
    // transaction: either it all commits or it all rolls back. Without this,
    // a card insert that commits followed by a failing external_id insert
    // (e.g. a stale prefetch racing a concurrent run) leaves orphaned card
    // rows with no external_id and no variants behind -- exactly the bug
    // that corrupted 6 sets in production before this fix.
    const result = await db.transaction(async (tx) => {
      const cardIdByRawId = await upsertCardsForSet(tx, setId, rawCards);

      const planned: PlannedVariant[] = [];
      let needsReviewCount = 0;
      for (const rawCard of rawCards) {
        const cardId = cardIdByRawId.get(rawCard.id) as string;
        const { variants, needsReview } = deriveVariants({
          rarity: rawCard.rarity,
          setName: rawSet.name,
          releasedAt: rawSet.releaseDate,
        });
        if (needsReview) {
          needsReviewCount++;
        }
        for (const variant of variants) {
          planned.push({
            cardId,
            variant,
            variantKey: `${rawCard.id}-${variant}`,
            images: rawCard.images,
            needsReview,
            rawCard,
          });
        }
      }

      const variantSummary = await upsertVariantsForSet(tx, planned, imagePipeline);
      return { needsReviewCount, ...variantSummary };
    });

    summary.cardsUpserted += rawCards.length;
    summary.variantsUpserted += result.variantsUpserted;
    summary.pricesIngested += result.pricesIngested;
    summary.needsReview += result.needsReviewCount;
  }

  return summary;
}

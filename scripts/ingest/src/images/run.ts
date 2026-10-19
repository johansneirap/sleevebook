import { card, cardVariant, createDb, type Database, externalId } from "@sleevebook/db";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { collectRequestedVariantIds, isVariantId } from "../prices/referenced";
import { PROVIDER } from "../upsert";
import { type ImagePipelineConfig, processVariantImage, type VariantImageUrls } from "./pipeline";
import {
  describeError,
  hasR2Images,
  IMAGE_BATCH_SIZE,
  IMAGE_CONCURRENCY,
  IMAGE_REQUEST_DELAY_MS,
  mergeR2Images,
  parseImageArgs,
  pokemontcgSourceUrl,
  variantKeyOf,
  withRetry,
} from "./selection";
import { createS3Storage, type ImageStorage } from "./storage";

/** A variant whose pokemontcg.io image still has to be copied to R2. */
interface ImageCandidate {
  id: string;
  images: unknown;
  variantKey: string;
  sourceUrl: string;
}

interface CandidateRow {
  id: string;
  variant: string;
  images: unknown;
  externalCardId: string;
}

interface RunContext {
  db: Database;
  config: ImagePipelineConfig;
  dryRun: boolean;
  /** Source images still allowed in this run (the cap, minus those already attempted). */
  remaining: number;
  copied: number;
  failed: number;
  failures: string[];
  /** Variant ids already handled, so the catalog phase does not repeat referenced ones. */
  handled: Set<string>;
}

const MAX_PRINTED_FAILURES = 20;

function toCandidate(row: CandidateRow): ImageCandidate | null {
  const sourceUrl = pokemontcgSourceUrl(row.images);
  if (!sourceUrl) {
    return null;
  }
  return {
    id: row.id,
    images: row.images,
    variantKey: variantKeyOf(row.externalCardId, row.variant),
    sourceUrl,
  };
}

const rowSelection = {
  id: cardVariant.id,
  variant: cardVariant.variant,
  images: cardVariant.images,
  externalCardId: externalId.externalId,
};

/** Variants of the given ids, joined to their pokemontcg.io card id. */
function loadRowsByIds(db: Database, ids: string[]): Promise<CandidateRow[]> {
  return db
    .select(rowSelection)
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(
      externalId,
      and(
        eq(externalId.entityType, "card"),
        eq(externalId.provider, PROVIDER),
        eq(externalId.entityId, card.id),
      ),
    )
    .where(inArray(cardVariant.id, ids));
}

/** The next page of catalog variants that have a pokemontcg.io image but no R2 copy yet. */
function loadCatalogBatch(
  db: Database,
  after: string | null,
  size: number,
): Promise<CandidateRow[]> {
  const pending = and(
    sql`${cardVariant.images} -> 'pokemontcg.io' is not null`,
    sql`${cardVariant.images} -> 'r2' is null`,
    after ? gt(cardVariant.id, after) : undefined,
  );
  return db
    .select(rowSelection)
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(
      externalId,
      and(
        eq(externalId.entityType, "card"),
        eq(externalId.provider, PROVIDER),
        eq(externalId.entityId, card.id),
      ),
    )
    .where(pending)
    .orderBy(asc(cardVariant.id))
    .limit(size);
}

/**
 * Copies the candidates with a fixed number of workers, stopping when the run's
 * cap is spent. Each image is downloaded, derived and uploaded by the image
 * pipeline (which skips uploads that already exist), then the DB row gets its
 * images.r2 entry.
 */
async function copyCandidates(candidates: ImageCandidate[], ctx: RunContext): Promise<void> {
  let next = 0;

  const worker = async () => {
    while (next < candidates.length && ctx.remaining > 0) {
      const candidate = candidates[next++];
      if (!candidate) {
        break;
      }
      ctx.remaining--;
      ctx.handled.add(candidate.id);

      try {
        const urls: VariantImageUrls = await withRetry(() =>
          processVariantImage(ctx.config, candidate.variantKey, candidate.sourceUrl),
        );
        if (!ctx.dryRun) {
          await ctx.db
            .update(cardVariant)
            .set({ images: mergeR2Images(candidate.images, urls) })
            .where(eq(cardVariant.id, candidate.id));
        }
        ctx.copied++;
      } catch (error) {
        ctx.failed++;
        ctx.failures.push(`${candidate.variantKey}: ${describeError(error)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, IMAGE_REQUEST_DELAY_MS));
    }
  };

  await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, candidates.length) }, worker));
}

function createDryRunStorage(): ImageStorage {
  return {
    async putObject() {},
    async objectExists() {
      return false;
    },
  };
}

function requireEnv(names: string[]): Record<string, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name] as string]));
}

async function main(): Promise<void> {
  const args = parseImageArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  let config: ImagePipelineConfig;
  if (args.dryRun) {
    // Downloads and derives every image but uploads nothing and writes nothing.
    config = {
      storage: createDryRunStorage(),
      publicAssetsUrl: process.env.PUBLIC_ASSETS_URL || "dry-run://sleevebook-assets",
    };
  } else {
    const env = requireEnv([
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "PUBLIC_ASSETS_URL",
    ]);
    config = {
      storage: createS3Storage({
        endpoint: env.S3_ENDPOINT as string,
        bucket: env.S3_BUCKET as string,
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      }),
      publicAssetsUrl: env.PUBLIC_ASSETS_URL as string,
    };
  }

  const db = createDb(databaseUrl);
  try {
    const ctx: RunContext = {
      db,
      config,
      dryRun: args.dryRun,
      remaining: args.cap,
      copied: 0,
      failed: 0,
      failures: [],
      handled: new Set(),
    };

    // (a) Variants on any binder's latest layout, or in a goal: what users see.
    const requestedIds = (await collectRequestedVariantIds(db)).filter(isVariantId);
    const referencedRows = requestedIds.length > 0 ? await loadRowsByIds(db, requestedIds) : [];
    const referencedCandidates: ImageCandidate[] = [];
    let referencedAlreadyStored = 0;
    // Variants with no pokemontcg.io card, or no image URL, have nothing to copy.
    let referencedNoSource = requestedIds.length - referencedRows.length;
    for (const row of referencedRows) {
      if (hasR2Images(row.images)) {
        referencedAlreadyStored++;
        continue;
      }
      const candidate = toCandidate(row);
      if (candidate) {
        referencedCandidates.push(candidate);
      } else {
        referencedNoSource++;
      }
    }

    console.log(
      `Referenced: ${requestedIds.length} variants, ${referencedCandidates.length} to copy.`,
    );
    await copyCandidates(referencedCandidates, ctx);

    // (b) The rest of the catalog, in id order, resumable: copied rows drop out of the query.
    let catalogScanned = 0;
    if (args.all) {
      let after: string | null = null;
      let budget = args.limit ?? Number.POSITIVE_INFINITY;
      while (ctx.remaining > 0 && budget > 0) {
        const rows = await loadCatalogBatch(db, after, Math.min(IMAGE_BATCH_SIZE, budget));
        if (rows.length === 0) {
          break;
        }
        catalogScanned += rows.length;
        budget -= rows.length;
        after = rows[rows.length - 1]?.id ?? null;

        const candidates = rows
          .map(toCandidate)
          .filter((candidate): candidate is ImageCandidate => candidate !== null)
          .filter((candidate) => !ctx.handled.has(candidate.id));
        await copyCandidates(candidates, ctx);
      }
    }

    const summary = {
      mode: args.dryRun ? "dry-run (nothing uploaded or written)" : "live",
      cap: args.cap,
      referenced: {
        requested: requestedIds.length,
        alreadyStored: referencedAlreadyStored,
        noSource: referencedNoSource,
        toCopy: referencedCandidates.length,
      },
      catalog: {
        enabled: args.all,
        scanned: catalogScanned,
      },
      copied: ctx.copied,
      failed: ctx.failed,
      capReached: ctx.remaining <= 0,
    };
    console.log(summary);

    if (ctx.failures.length > 0) {
      console.warn(`First ${Math.min(ctx.failures.length, MAX_PRINTED_FAILURES)} failures:`);
      for (const failure of ctx.failures.slice(0, MAX_PRINTED_FAILURES)) {
        console.warn(`  ${failure}`);
      }
    }
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

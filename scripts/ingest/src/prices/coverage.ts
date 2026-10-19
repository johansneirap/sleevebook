import { pathToFileURL } from "node:url";
import { card, cardVariant, createDb, type Database, externalId, set } from "@sleevebook/db";
import { and, eq, inArray } from "drizzle-orm";
import { PROVIDER } from "../upsert";
import { createPokemontcgIoSource } from "./pokemontcg-io";
import { collectRequestedVariantIds, isVariantId } from "./referenced";
import { type PriceSourceCard, restrictToUnpriced } from "./source";
import { createTcgdexSource, type TcgdexOutcome, type TcgdexVariantResult } from "./tcgdex";

/**
 * Why a referenced variant has no price, as reported by `prices:coverage`.
 * The TCGdex outcomes come from the same lookups the prices job runs; the two
 * catalog reasons are checked before TCGdex is asked anything.
 */
export type CoverageReason =
  | TcgdexOutcome
  | "no-external-id"
  | "not-in-catalog"
  | "priced-fallback";

/** Reasons in report order. The priced ones come last: they are the goal, not problems. */
export const COVERAGE_REASONS: CoverageReason[] = [
  "no-external-id",
  "set-not-mapped",
  "card-not-found",
  "no-bucket-price",
  "no-set-name",
  "tcgdex-unavailable",
  "not-attempted",
  "not-in-catalog",
  "priced-fallback",
  "priced",
];

export const COVERAGE_REASON_LABELS: Record<CoverageReason, string> = {
  "no-external-id": "no pokemontcg.io external id",
  "set-not-mapped": "TCGdex set not mapped",
  "card-not-found": "card not found in the TCGdex set",
  "no-bucket-price": "card found but no price for that variant bucket",
  "no-set-name": "missing set name or card number",
  "tcgdex-unavailable": "TCGdex request failed or unavailable",
  "not-attempted": "not attempted (run deadline)",
  "not-in-catalog": "variant id not in the catalog",
  "priced-fallback": "not priced by TCGdex, priced by the pokemontcg.io fallback",
  priced: "priced by TCGdex",
};

export const COVERAGE_EXAMPLE_LIMIT = 20;

export interface CoverageRow {
  variantId: string;
  variant: string;
  setName: string | null;
  number: string | null;
  /** pokemontcg.io card id, or null when the card has no pokemontcg.io external id. */
  externalCardId: string | null;
}

export interface CoverageExample {
  variantId: string;
  variant: string;
  setName: string | null;
  number: string | null;
  externalCardId: string | null;
  tcgdexSetId?: string;
  tcgdexCardId?: string;
  tcgdexBuckets?: string[];
}

export interface CoverageReport {
  requested: number;
  counts: Record<CoverageReason, number>;
  examples: Record<CoverageReason, CoverageExample[]>;
}

/** Groups catalog rows by pokemontcg.io card, the shape the price sources batch by. */
export function toPriceSourceCards(rows: CoverageRow[]): PriceSourceCard[] {
  const byCard = new Map<string, PriceSourceCard>();
  for (const row of rows) {
    if (!row.externalCardId) {
      continue;
    }
    let entry = byCard.get(row.externalCardId);
    if (!entry) {
      entry = {
        externalCardId: row.externalCardId,
        setName: row.setName ?? undefined,
        number: row.number ?? undefined,
        variants: [],
      };
      byCard.set(row.externalCardId, entry);
    }
    entry.variants.push({ variantId: row.variantId, variant: row.variant });
  }
  return [...byCard.values()];
}

/**
 * Assigns every requested variant exactly one reason. Pure: the caller fetches
 * the rows from the database and the outcomes from the TCGdex source.
 */
export function classifyCoverage(input: {
  requestedIds: string[];
  rows: CoverageRow[];
  results: TcgdexVariantResult[];
  /** Variants TCGdex left unpriced that the pokemontcg.io fallback priced. */
  fallbackPricedIds?: ReadonlySet<string>;
}): CoverageReport {
  const rowById = new Map(input.rows.map((row) => [row.variantId, row]));
  const resultById = new Map(input.results.map((result) => [result.variantId, result]));

  const counts = Object.fromEntries(COVERAGE_REASONS.map((reason) => [reason, 0])) as Record<
    CoverageReason,
    number
  >;
  const examples = Object.fromEntries(
    COVERAGE_REASONS.map((reason) => [reason, [] as CoverageExample[]]),
  ) as Record<CoverageReason, CoverageExample[]>;

  for (const variantId of input.requestedIds) {
    const row = rowById.get(variantId);
    const result = resultById.get(variantId);
    const base = {
      variantId,
      variant: row?.variant ?? result?.variant ?? "?",
      setName: row?.setName ?? null,
      number: row?.number ?? null,
      externalCardId: row?.externalCardId ?? null,
    };

    let reason: CoverageReason;
    let extra: Partial<CoverageExample> = {};
    if (!row) {
      reason = "not-in-catalog";
    } else if (!row.externalCardId) {
      reason = "no-external-id";
    } else if (result) {
      reason = result.outcome;
      extra = {
        tcgdexSetId: result.tcgdexSetId,
        tcgdexCardId: result.tcgdexCardId,
        tcgdexBuckets: result.tcgdexBuckets,
      };
    } else {
      reason = "not-attempted";
    }
    if (reason !== "priced" && input.fallbackPricedIds?.has(variantId)) {
      reason = "priced-fallback";
    }

    counts[reason]++;
    if (reason !== "priced" && examples[reason].length < COVERAGE_EXAMPLE_LIMIT) {
      examples[reason].push({ ...base, ...extra });
    }
  }

  return { requested: input.requestedIds.length, counts, examples };
}

function describeExample(example: CoverageExample): string {
  const where = `${example.setName ?? "?"} #${example.number ?? "?"} [${example.variant}]`;
  const details = [
    example.externalCardId ? `pokemontcg ${example.externalCardId}` : null,
    example.tcgdexSetId ? `tcgdex set ${example.tcgdexSetId}` : null,
    example.tcgdexCardId ? `tcgdex card ${example.tcgdexCardId}` : null,
    example.tcgdexBuckets ? `tcgdex buckets: ${example.tcgdexBuckets.join(", ") || "none"}` : null,
    `variant ${example.variantId}`,
  ].filter((part): part is string => part !== null);
  return `    ${where} (${details.join("; ")})`;
}

/** Plain-text report: one line per reason, then up to 20 examples for each unpriced reason. */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];
  lines.push(`Referenced variants: ${report.requested}`);
  for (const reason of COVERAGE_REASONS) {
    const count = report.counts[reason];
    const percent = report.requested > 0 ? ((100 * count) / report.requested).toFixed(1) : "0.0";
    lines.push(
      `  ${String(count).padStart(6)}  ${percent.padStart(5)}%  ${COVERAGE_REASON_LABELS[reason]}`,
    );
  }
  for (const reason of COVERAGE_REASONS) {
    if (reason === "priced" || report.counts[reason] === 0) {
      continue;
    }
    lines.push("", `${COVERAGE_REASON_LABELS[reason]} (up to ${COVERAGE_EXAMPLE_LIMIT}):`);
    for (const example of report.examples[reason]) {
      lines.push(describeExample(example));
    }
  }
  return lines.join("\n");
}

async function loadRows(db: Database, ids: string[]): Promise<CoverageRow[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      variantId: cardVariant.id,
      variant: cardVariant.variant,
      setName: set.name,
      number: card.number,
      externalCardId: externalId.externalId,
    })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .leftJoin(
      externalId,
      and(
        eq(externalId.entityType, "card"),
        eq(externalId.provider, PROVIDER),
        eq(externalId.entityId, card.id),
      ),
    )
    .where(inArray(cardVariant.id, ids));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const db = createDb(databaseUrl);
  try {
    const requestedIds = await collectRequestedVariantIds(db);
    const validIds = requestedIds.filter(isVariantId);
    const rows = await loadRows(db, validIds);
    const sortedRows = [...rows].sort(
      (a, b) =>
        (a.setName ?? "").localeCompare(b.setName ?? "") ||
        (a.number ?? "").localeCompare(b.number ?? "", undefined, { numeric: true }) ||
        a.variant.localeCompare(b.variant),
    );

    const cards = toPriceSourceCards(sortedRows);
    const source = createTcgdexSource();
    console.log(`Asking TCGdex about ${sortedRows.length} referenced variants...`);
    const results = await source.diagnose(cards);

    // Same gap-filling as the prices job: pokemontcg.io prices what TCGdex did not.
    const pricedByTcgdex = new Set(
      results.filter((result) => result.outcome === "priced").map((result) => result.variantId),
    );
    const missing = restrictToUnpriced(cards, pricedByTcgdex);
    const fallbackPricedIds = new Set<string>();
    if (missing.length > 0) {
      try {
        const fallback = createPokemontcgIoSource({
          apiKey: process.env.POKEMONTCG_API_KEY || undefined,
        });
        const prices = await fallback.fetchUsdPrices(missing);
        for (const price of prices) {
          fallbackPricedIds.add(price.variantId);
        }
      } catch (error) {
        console.warn("pokemontcg.io fallback failed; its prices are not counted:", error);
      }
    }

    const report = classifyCoverage({
      requestedIds,
      rows: sortedRows,
      results,
      fallbackPricedIds,
    });
    console.log(formatCoverageReport(report));
  } finally {
    await db.$client.end();
  }
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

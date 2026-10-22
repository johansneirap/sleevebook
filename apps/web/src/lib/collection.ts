import {
  type CopyFacts,
  type CopyPlacement,
  type CopyValue,
  estimateCopyValueUsd,
  gradingLabel,
  type Layout,
  layoutSchema,
  placeCopies,
} from "@sleevebook/binder-core";
import { binder, binderVersion, cardInstance } from "@sleevebook/db";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import { getVariantDisplays, type VariantDisplay } from "./binders";
import { db } from "./db";
import { getLatestPrices } from "./pricing";

// Fase 7: physical copies ("Mi colección"). Reads only; mutations live in
// collection-actions.ts. The pure rules (labels, value estimate, placement)
// live in @sleevebook/binder-core (copy.ts).

export interface CopyRow extends CopyFacts {
  id: string;
  variantId: string;
  purchasePrice: number | null;
  purchaseCurrency: string;
  notes: string | null;
  acquiredAt: string | null;
  createdAt: string;
}

/** What a binder pocket shows about its linked copy. Safe for public pages. */
export interface PocketCopyBadge {
  copyId: string;
  language: string;
  condition: string;
  /** "PSA 10"; null when raw. */
  grading: string | null;
}

const COPY_COLUMNS = {
  id: cardInstance.id,
  variantId: cardInstance.variantId,
  language: cardInstance.language,
  condition: cardInstance.condition,
  gradingCompany: cardInstance.gradingCompany,
  gradingGrade: cardInstance.gradingGrade,
  purchasePrice: cardInstance.purchasePrice,
  purchaseCurrency: cardInstance.purchaseCurrency,
  valueUsd: cardInstance.valueUsd,
  notes: cardInstance.notes,
  acquiredAt: cardInstance.acquiredAt,
  createdAt: cardInstance.createdAt,
};

interface CopySelect {
  id: string;
  variantId: string;
  language: string;
  condition: string;
  gradingCompany: string | null;
  gradingGrade: string | null;
  purchasePrice: string | null;
  purchaseCurrency: string;
  valueUsd: string | null;
  notes: string | null;
  acquiredAt: string | null;
  createdAt: Date;
}

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toCopyRow(row: CopySelect): CopyRow {
  return {
    id: row.id,
    variantId: row.variantId,
    language: row.language,
    condition: row.condition,
    gradingCompany: row.gradingCompany,
    gradingGrade: toNumber(row.gradingGrade),
    purchasePrice: toNumber(row.purchasePrice),
    purchaseCurrency: row.purchaseCurrency,
    valueUsd: toNumber(row.valueUsd),
    notes: row.notes,
    acquiredAt: row.acquiredAt,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every copy of the user, newest first. */
export async function listCopies(userId: string): Promise<CopyRow[]> {
  const rows = await db
    .select(COPY_COLUMNS)
    .from(cardInstance)
    .where(eq(cardInstance.userId, userId))
    .orderBy(desc(cardInstance.createdAt));
  return rows.map(toCopyRow);
}

/** Copies by id, restricted to one owner (ids from someone else are dropped). */
export async function getCopies(userId: string, ids: readonly string[]): Promise<CopyRow[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .select(COPY_COLUMNS)
    .from(cardInstance)
    .where(and(eq(cardInstance.userId, userId), inArray(cardInstance.id, [...ids])));
  return rows.map(toCopyRow);
}

/** Ids of the copies linked from a layout's card pockets. */
export function linkedCopyIds(pockets: Layout["pockets"]): string[] {
  const ids = new Set<string>();
  for (const content of Object.values(pockets)) {
    if (content.kind === "card" && content.instance) {
      ids.add(content.instance);
    }
  }
  return [...ids];
}

/**
 * Badges and USD values of the copies a binder's pockets link to, keyed by
 * copy id. `ownerId` is the binder's owner: copies of anyone else are ignored.
 * `marketUsd` is the variant's NM market price lookup.
 */
export async function getPocketCopies(
  ownerId: string,
  pockets: Layout["pockets"],
  marketUsd: Record<string, number | undefined>,
): Promise<{ badges: Record<string, PocketCopyBadge>; values: Record<string, number> }> {
  const copies = await getCopies(ownerId, linkedCopyIds(pockets));
  const badges: Record<string, PocketCopyBadge> = {};
  const values: Record<string, number> = {};
  for (const copy of copies) {
    badges[copy.id] = {
      copyId: copy.id,
      language: copy.language,
      condition: copy.condition,
      grading: gradingLabel(copy),
    };
    const value = estimateCopyValueUsd(copy, marketUsd[copy.variantId]);
    if (value) {
      values[copy.id] = value.amountUsd;
    }
  }
  return { badges, values };
}

export interface UserLayout {
  binderId: string;
  binderName: string;
  mode: string;
  pockets: Layout["pockets"];
}

/** Latest layout of every binder of the user. */
export async function loadUserLayouts(userId: string): Promise<UserLayout[]> {
  const latest = db
    .select({
      binderId: binderVersion.binderId,
      latestNumber: max(binderVersion.versionNumber).as("latest_number"),
    })
    .from(binderVersion)
    .groupBy(binderVersion.binderId)
    .as("latest");

  const rows = await db
    .select({
      binderId: binder.id,
      binderName: binder.name,
      mode: binder.mode,
      layout: binderVersion.layout,
    })
    .from(binder)
    .innerJoin(latest, eq(latest.binderId, binder.id))
    .innerJoin(
      binderVersion,
      and(
        eq(binderVersion.binderId, binder.id),
        eq(binderVersion.versionNumber, latest.latestNumber),
      ),
    )
    .where(eq(binder.userId, userId))
    .orderBy(binder.name);

  return rows.map((row) => ({
    binderId: row.binderId,
    binderName: row.binderName,
    mode: row.mode,
    pockets: layoutSchema.parse(row.layout).pockets,
  }));
}

export interface CollectionEntry {
  copy: CopyRow;
  display: VariantDisplay | null;
  value: CopyValue | undefined;
  placement: (CopyPlacement & { binderName: string }) | null;
}

export interface CollectionData {
  entries: CollectionEntry[];
  /** Sum of the copies' estimated values (graded references included). */
  totalUsd: number;
  /** Card pockets across the user's binders not yet linked to a copy. */
  unlinkedPockets: number;
}

/** Everything the "Mi colección" page needs, in one call. */
export async function getCollection(userId: string): Promise<CollectionData> {
  const [copies, layouts] = await Promise.all([listCopies(userId), loadUserLayouts(userId)]);
  const variantIds = [...new Set(copies.map((copy) => copy.variantId))];
  const [displays, prices] = await Promise.all([
    getVariantDisplays(variantIds),
    getLatestPrices(variantIds),
  ]);

  const placements = placeCopies(layouts);
  const binderNames = new Map(layouts.map((layout) => [layout.binderId, layout.binderName]));
  const copyIds = new Set(copies.map((copy) => copy.id));

  let unlinkedPockets = 0;
  for (const layout of layouts) {
    for (const content of Object.values(layout.pockets)) {
      if (content.kind === "card" && !(content.instance && copyIds.has(content.instance))) {
        unlinkedPockets += 1;
      }
    }
  }

  let totalUsd = 0;
  const entries = copies.map((copy) => {
    const value = estimateCopyValueUsd(copy, prices[copy.variantId]?.amountUsd);
    totalUsd += value?.amountUsd ?? 0;
    const placement = placements.get(copy.id);
    return {
      copy,
      display: displays.get(copy.variantId) ?? null,
      value,
      placement: placement
        ? { ...placement, binderName: binderNames.get(placement.binderId) ?? "" }
        : null,
    };
  });

  return { entries, totalUsd: Math.round(totalUsd * 100) / 100, unlinkedPockets };
}

import {
  capacity,
  type Format,
  formatPocketCode,
  layoutSchema,
  pocketCodeFromGlobalIndex,
} from "@sleevebook/binder-core";
import type { Database } from "@sleevebook/db";
import {
  binder,
  binderVersion,
  card,
  cardVariant,
  DEV_USER_ID,
  ensureDevUser,
  goal,
  set,
} from "@sleevebook/db";
import { and, eq, ilike, or } from "drizzle-orm";
import { ensurePokemonGame, findExternalEntityId, linkExternalId } from "../upsert";
import type { SeedCard, SeedFile, SeedGoal } from "./seed-schema";
import { parseCatalogKey, slugifySpecialVariant } from "./variant-mapping";

const CATALOG_PROVIDER = "pokemontcg.io";
const TRACKER_PROVIDER = "tracker-seed";

export interface TrackerMigrationSummary {
  goalsUpserted: number;
  bindersUpserted: number;
  variantsResolved: number;
}

async function findOrCreateCardVariant(
  db: Database,
  cardId: string,
  variant: string,
  needsReview: boolean,
): Promise<string> {
  const [existing] = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .where(and(eq(cardVariant.cardId, cardId), eq(cardVariant.variant, variant)));

  if (existing) {
    if (needsReview) {
      await db
        .update(cardVariant)
        .set({ needsReview: true })
        .where(eq(cardVariant.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(cardVariant)
    .values({ cardId, variant, needsReview })
    .returning({ id: cardVariant.id });
  return (created as { id: string }).id;
}

async function findOrCreateSpecialSet(
  db: Database,
  gameId: string,
  label: string,
): Promise<string> {
  const existingId = await findExternalEntityId(db, "set", TRACKER_PROVIDER, label);
  if (existingId) {
    return existingId;
  }
  const [created] = await db
    .insert(set)
    .values({ gameId, name: label, language: "en" })
    .returning({ id: set.id });
  const setId = (created as { id: string }).id;
  await linkExternalId(db, "set", setId, TRACKER_PROVIDER, label);
  return setId;
}

async function findOrCreateSpecialCard(
  db: Database,
  setId: string,
  seedCard: SeedCard,
): Promise<string> {
  const existingId = await findExternalEntityId(db, "card", TRACKER_PROVIDER, seedCard.key);
  if (existingId) {
    return existingId;
  }
  const [created] = await db
    .insert(card)
    .values({
      setId,
      number: seedCard.number,
      name: seedCard.name,
      species: [seedCard.name],
      supertype: "Pokémon",
      rarity: seedCard.rarity,
      language: "en",
    })
    .returning({ id: card.id });
  const cardId = (created as { id: string }).id;
  await linkExternalId(db, "card", cardId, TRACKER_PROVIDER, seedCard.key);
  return cardId;
}

async function resolveSeedCardVariantId(
  db: Database,
  gameId: string,
  seedCard: SeedCard,
): Promise<string> {
  if (!seedCard.special) {
    const { pokemonTcgIoId, variant } = parseCatalogKey(seedCard.key);
    const cardId = await findExternalEntityId(db, "card", CATALOG_PROVIDER, pokemonTcgIoId);
    if (!cardId) {
      throw new Error(
        `Card "${pokemonTcgIoId}" (key "${seedCard.key}") not found in the catalog — run the catalog ingest first`,
      );
    }
    return findOrCreateCardVariant(db, cardId, variant, seedCard.variantToConfirm);
  }

  const setId = await findOrCreateSpecialSet(db, gameId, seedCard.set);
  const cardId = await findOrCreateSpecialCard(db, setId, seedCard);
  const variant = slugifySpecialVariant(seedCard.variant);
  return findOrCreateCardVariant(db, cardId, variant, seedCard.variantToConfirm);
}

function buildPockets(
  cardsByPocket: Map<string, string>,
  format: Format,
  sheets: number,
): Record<string, { kind: "card"; variant: string; instance: null } | { kind: "empty" }> {
  const pockets: Record<
    string,
    { kind: "card"; variant: string; instance: null } | { kind: "empty" }
  > = {};
  const total = capacity(format, sheets);

  for (let i = 0; i < total; i++) {
    const code = formatPocketCode(pocketCodeFromGlobalIndex(i, format));
    const variantId = cardsByPocket.get(code);
    pockets[code] = variantId
      ? { kind: "card", variant: variantId, instance: null }
      : { kind: "empty" };
  }

  return pockets;
}

// The master-set target is every catalog variant whose card name matches one
// of the species (e.g. "Zoroark-GX", "Hisuian Zoroark VSTAR" both match
// "Zoroark"), not just whatever the seed currently has placed in a pocket —
// so a future catalog ingest can grow the target before the binder catches up.
async function computeMasterSetTarget(db: Database, species: string[]): Promise<string[]> {
  const rows = await db
    .select({ id: cardVariant.id })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .where(or(...species.map((name) => ilike(card.name, `%${name}%`))));
  return rows.map((row) => row.id);
}

async function upsertGoal(
  db: Database,
  seedGoal: SeedGoal,
  variantIds: string[],
  species: string[],
): Promise<string> {
  const rules = { type: "master-set", seedGoalId: seedGoal.id, species };
  const existingId = await findExternalEntityId(db, "goal", TRACKER_PROVIDER, seedGoal.id);
  if (existingId) {
    await db.update(goal).set({ rules, variantIds }).where(eq(goal.id, existingId));
    return existingId;
  }
  const [created] = await db
    .insert(goal)
    .values({ type: "master-set", rules, variantIds })
    .returning({ id: goal.id });
  const goalId = (created as { id: string }).id;
  await linkExternalId(db, "goal", goalId, TRACKER_PROVIDER, seedGoal.id);
  return goalId;
}

async function upsertBinder(db: Database, seedGoal: SeedGoal, goalId: string): Promise<string> {
  const values = {
    userId: DEV_USER_ID,
    name: seedGoal.name,
    formatRows: seedGoal.format.rows,
    formatCols: seedGoal.format.cols,
    opening: "side",
    loading: "side",
    sheets: seedGoal.sheets,
    goalId,
    status: "draft",
  };
  // The (provider, externalId) pair is unique across all entity types, not
  // just within "binder" — reusing the bare seedGoal.id here would collide
  // with the goal's own external_id row (same provider, same key).
  const externalIdValue = `${seedGoal.id}-binder`;
  const existingId = await findExternalEntityId(db, "binder", TRACKER_PROVIDER, externalIdValue);
  if (existingId) {
    await db.update(binder).set(values).where(eq(binder.id, existingId));
    return existingId;
  }
  const [created] = await db.insert(binder).values(values).returning({ id: binder.id });
  const binderId = (created as { id: string }).id;
  await linkExternalId(db, "binder", binderId, TRACKER_PROVIDER, externalIdValue);
  return binderId;
}

async function upsertBinderVersion(db: Database, binderId: string, layout: unknown): Promise<void> {
  const [existing] = await db
    .select({ id: binderVersion.id })
    .from(binderVersion)
    .where(and(eq(binderVersion.binderId, binderId), eq(binderVersion.versionNumber, 1)));

  if (existing) {
    await db.update(binderVersion).set({ layout }).where(eq(binderVersion.id, existing.id));
    return;
  }

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
}

export async function migrateTracker(
  db: Database,
  seed: SeedFile,
): Promise<TrackerMigrationSummary> {
  await ensureDevUser(db);
  const gameId = await ensurePokemonGame(db);

  const summary: TrackerMigrationSummary = {
    goalsUpserted: 0,
    bindersUpserted: 0,
    variantsResolved: 0,
  };

  for (const seedGoal of seed.goals) {
    const cardsByPocket = new Map<string, string>();

    for (const seedCard of seedGoal.cards) {
      const variantId = await resolveSeedCardVariantId(db, gameId, seedCard);
      cardsByPocket.set(seedCard.pocket, variantId);
      summary.variantsResolved++;
    }

    const pockets = buildPockets(cardsByPocket, seedGoal.format, seedGoal.sheets);
    const layout = layoutSchema.parse({
      format: seedGoal.format,
      opening: "side",
      sheets: seedGoal.sheets,
      theme: { preset: "default", sleeve: "clear" },
      pockets,
    });

    const species = seedGoal.name.split("/").map((part) => part.trim());
    const targetVariantIds = await computeMasterSetTarget(db, species);
    const goalId = await upsertGoal(db, seedGoal, targetVariantIds, species);
    summary.goalsUpserted++;

    const binderId = await upsertBinder(db, seedGoal, goalId);
    summary.bindersUpserted++;

    await upsertBinderVersion(db, binderId, layout);
  }

  return summary;
}

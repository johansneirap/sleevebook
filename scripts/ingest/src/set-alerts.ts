import type { Database } from "@sleevebook/db";
import { binder, card, goal, notification, set, speciesFollow } from "@sleevebook/db";
import { eq, inArray, sql } from "drizzle-orm";

export interface FollowedSpecies {
  userId: string;
  species: string[];
}

export interface SetAlertNotification {
  userId: string;
  kind: "set-nuevo";
  title: string;
  body: string;
  href: "/avisos";
  data: { setId: string; species: string[]; count: number };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word, case-insensitive match of a species inside a card name:
 * "Lucario" matches "Lucario ex" and "Mega Lucario", not "Lucarion".
 */
export function cardNameMentionsSpecies(cardName: string, species: string): boolean {
  const name = species.trim();
  if (name.length === 0) {
    return false;
  }
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "iu");
  return pattern.test(cardName);
}

/**
 * Merges species lists case-insensitively, keeping the first spelling seen
 * and dropping blanks.
 */
export function mergeSpecies(...lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const name = raw.trim();
      const key = name.toLowerCase();
      if (name.length > 0 && !seen.has(key)) {
        seen.set(key, name);
      }
    }
  }
  return [...seen.values()];
}

/**
 * Pure rule for one new set. For each user, reports the followed species that
 * appear in the set's card names (and how many cards mention any of them).
 * Users with no match get nothing.
 */
export function decideSetAlerts(
  setId: string,
  setName: string,
  cardNames: string[],
  follows: FollowedSpecies[],
): SetAlertNotification[] {
  const notifications: SetAlertNotification[] = [];
  for (const follow of follows) {
    const matched = follow.species.filter((species) =>
      cardNames.some((cardName) => cardNameMentionsSpecies(cardName, species)),
    );
    if (matched.length === 0) {
      continue;
    }
    const count = cardNames.filter((cardName) =>
      matched.some((species) => cardNameMentionsSpecies(cardName, species)),
    ).length;
    notifications.push({
      userId: follow.userId,
      kind: "set-nuevo",
      title: `Nuevo set: ${setName}`,
      body: `${count} ${count === 1 ? "carta" : "cartas"} de ${matched.join(", ")}`,
      href: "/avisos",
      data: { setId, species: matched, count },
    });
  }
  return notifications;
}

/** True when the catalog already had at least one set before this run. */
export async function catalogHasSets(db: Database): Promise<boolean> {
  const rows = await db.select({ id: set.id }).from(set).limit(1);
  return rows.length > 0;
}

/**
 * Species each user follows: the species of their master-set goals (through
 * binder.goalId) plus their species_follow rows.
 */
export async function loadFollowedSpecies(db: Database): Promise<FollowedSpecies[]> {
  const goalRows = await db
    .select({ userId: binder.userId, rules: goal.rules })
    .from(binder)
    .innerJoin(goal, eq(goal.id, binder.goalId))
    .where(sql`${goal.rules}->>'type' = 'master-set'`);
  const followRows = await db
    .select({ userId: speciesFollow.userId, species: speciesFollow.species })
    .from(speciesFollow);

  const byUser = new Map<string, string[][]>();
  const add = (userId: string, species: string[]) => {
    const lists = byUser.get(userId) ?? [];
    lists.push(species);
    byUser.set(userId, lists);
  };
  for (const row of goalRows) {
    const rules = row.rules as { species?: unknown };
    if (Array.isArray(rules.species)) {
      add(
        row.userId,
        rules.species.filter((item): item is string => typeof item === "string"),
      );
    }
  }
  for (const row of followRows) {
    add(row.userId, [row.species]);
  }

  return [...byUser.entries()].map(([userId, lists]) => ({
    userId,
    species: mergeSpecies(...lists),
  }));
}

/**
 * Inserts one "set-nuevo" notification per user per new set. Call only when
 * the catalog already had sets before this run, so a first ingest into an
 * empty database stays silent.
 */
export async function notifyNewSets(db: Database, setIds: string[]): Promise<number> {
  if (setIds.length === 0) {
    return 0;
  }
  const follows = await loadFollowedSpecies(db);
  if (follows.length === 0) {
    return 0;
  }

  const sets = await db
    .select({ id: set.id, name: set.name })
    .from(set)
    .where(inArray(set.id, setIds));
  const cards = await db
    .select({ setId: card.setId, name: card.name })
    .from(card)
    .where(inArray(card.setId, setIds));

  const namesBySet = new Map<string, string[]>();
  for (const row of cards) {
    const names = namesBySet.get(row.setId) ?? [];
    names.push(row.name);
    namesBySet.set(row.setId, names);
  }

  const rows: SetAlertNotification[] = [];
  for (const setRow of sets) {
    rows.push(...decideSetAlerts(setRow.id, setRow.name, namesBySet.get(setRow.id) ?? [], follows));
  }
  if (rows.length > 0) {
    await db.insert(notification).values(rows);
  }
  return rows.length;
}

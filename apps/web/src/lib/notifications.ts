import { binder, goal, notification, speciesFollow } from "@sleevebook/db";
import { and, count, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "./db";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface DerivedSpecies {
  species: string;
  binderId: string;
  binderName: string;
}

export interface FollowedSpecies {
  id: string;
  species: string;
}

export const SPECIES_MIN_LENGTH = 2;
export const SPECIES_MAX_LENGTH = 40;
const SPECIES_PATTERN = /^\p{L}[\p{L} '’.-]*$/u;

/**
 * Trims, collapses inner whitespace and validates a species the user types.
 * Returns the cleaned name, or an error message in Spanish.
 */
export function parseSpeciesName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim().replace(/\s+/g, " ");
  const length = [...name].length;
  if (length < SPECIES_MIN_LENGTH || length > SPECIES_MAX_LENGTH) {
    return {
      ok: false,
      error: `La especie debe tener entre ${SPECIES_MIN_LENGTH} y ${SPECIES_MAX_LENGTH} caracteres.`,
    };
  }
  if (!SPECIES_PATTERN.test(name)) {
    return {
      ok: false,
      error: "Usa solo letras, espacios, guiones, apóstrofos o puntos.",
    };
  }
  return { ok: true, name };
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return Number(row?.value ?? 0);
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; before?: Date } = {},
): Promise<NotificationItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const rows = await db
    .select({
      id: notification.id,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
    })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        options.before ? lt(notification.createdAt, options.before) : undefined,
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);
  return rows;
}

/**
 * Species from the master-set goals of the user's binders. Read-only: they
 * follow automatically while the binder keeps the goal.
 */
export async function listDerivedSpecies(userId: string): Promise<DerivedSpecies[]> {
  const rows = await db
    .select({ binderId: binder.id, binderName: binder.name, rules: goal.rules })
    .from(binder)
    .innerJoin(goal, eq(goal.id, binder.goalId))
    .where(and(eq(binder.userId, userId), sql`${goal.rules}->>'type' = 'master-set'`))
    .orderBy(binder.name);

  const seen = new Map<string, DerivedSpecies>();
  for (const row of rows) {
    const species = (row.rules as { species?: unknown }).species;
    if (!Array.isArray(species)) {
      continue;
    }
    for (const raw of species) {
      if (typeof raw !== "string" || raw.trim() === "") {
        continue;
      }
      const name = raw.trim();
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, { species: name, binderId: row.binderId, binderName: row.binderName });
      }
    }
  }
  return [...seen.values()];
}

export async function listFollowedSpecies(userId: string): Promise<FollowedSpecies[]> {
  return db
    .select({ id: speciesFollow.id, species: speciesFollow.species })
    .from(speciesFollow)
    .where(eq(speciesFollow.userId, userId))
    .orderBy(speciesFollow.species);
}

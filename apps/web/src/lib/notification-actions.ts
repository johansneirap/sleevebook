"use server";

import { notification, speciesFollow } from "@sleevebook/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { listDerivedSpecies, parseSpeciesName } from "./notifications";
import { assertUser } from "./session";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FollowResult = { ok: true } | { ok: false; error: string };

// Only the signed-in user's own rows are ever touched: every write filters by
// the viewer's id, so a forged id from another user matches nothing.
export async function markRead(id: string): Promise<void> {
  const viewer = await assertUser();
  if (!UUID_PATTERN.test(id)) {
    return;
  }
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(eq(notification.id, id), eq(notification.userId, viewer.id), isNull(notification.readAt)),
    );
  revalidatePath("/", "layout");
}

export async function markAllRead(): Promise<void> {
  const viewer = await assertUser();
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, viewer.id), isNull(notification.readAt)));
  revalidatePath("/", "layout");
}

export async function followSpecies(raw: string): Promise<FollowResult> {
  const viewer = await assertUser();
  const parsed = parseSpeciesName(String(raw ?? ""));
  if (!parsed.ok) {
    return parsed;
  }

  const key = parsed.name.toLowerCase();
  const manual = await db
    .select({ species: speciesFollow.species })
    .from(speciesFollow)
    .where(eq(speciesFollow.userId, viewer.id));
  const derived = await listDerivedSpecies(viewer.id);
  const alreadyFollowed =
    manual.some((row) => row.species.toLowerCase() === key) ||
    derived.some((row) => row.species.toLowerCase() === key);
  if (alreadyFollowed) {
    return { ok: false, error: "Ya sigues esa especie." };
  }

  await db
    .insert(speciesFollow)
    .values({ userId: viewer.id, species: parsed.name })
    .onConflictDoNothing();
  revalidatePath("/avisos");
  return { ok: true };
}

export async function unfollowSpecies(id: string): Promise<void> {
  const viewer = await assertUser();
  if (!UUID_PATTERN.test(id)) {
    return;
  }
  await db
    .delete(speciesFollow)
    .where(and(eq(speciesFollow.id, id), eq(speciesFollow.userId, viewer.id)));
  revalidatePath("/avisos");
}

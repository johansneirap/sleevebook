import { binder } from "@sleevebook/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  handle: string;
}

/** The signed-in user, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) {
    return null;
  }
  const u = result.user as typeof result.user & { handle?: string };
  return { id: u.id, name: u.name, email: u.email, image: u.image ?? null, handle: u.handle ?? "" };
});

/** For owner pages: redirects to /entrar (and back to `next`) when signed out. */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) {
    redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  }
  return current;
}

/** True when `binderId` exists and belongs to `userId`. */
export async function ownsBinder(userId: string, binderId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(binderId)) {
    return false;
  }
  const [row] = await db
    .select({ id: binder.id })
    .from(binder)
    .where(and(eq(binder.id, binderId), eq(binder.userId, userId)));
  return Boolean(row);
}

/** For owner pages of one binder: signed in AND owner, else redirect / 404. */
export async function requireBinderOwner(binderId: string, next?: string): Promise<CurrentUser> {
  const current = await requireUser(next ?? `/binders/${binderId}`);
  if (!(await ownsBinder(current.id, binderId))) {
    notFound();
  }
  return current;
}

/**
 * For server actions and route handlers: throws instead of redirecting, so a
 * forged request can never touch someone else's binder.
 */
export async function assertBinderOwner(binderId: string): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current || !(await ownsBinder(current.id, binderId))) {
    throw new Error("No autorizado");
  }
  return current;
}

/** For server actions that aren't about one binder (e.g. creating one). */
export async function assertUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) {
    throw new Error("No autorizado");
  }
  return current;
}

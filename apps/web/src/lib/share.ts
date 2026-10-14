import { binder, shareLink } from "@sleevebook/db";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";

export function getSiteUrl(): string {
  return process.env.BETTER_AUTH_URL ?? "";
}

export interface ShareInfo {
  slug: string;
  visibility: string;
  views: number;
}

export async function getShareLinkForBinder(binderId: string): Promise<ShareInfo | null> {
  const [row] = await db.select().from(shareLink).where(eq(shareLink.binderId, binderId));
  if (!row) {
    return null;
  }
  return { slug: row.slug, visibility: row.visibility, views: row.views };
}

export interface PublicBinder {
  id: string;
  name: string;
  visibility: string;
}

export async function getPublishedBinderBySlug(slug: string): Promise<PublicBinder | null> {
  const [row] = await db
    .select({
      id: binder.id,
      name: binder.name,
      status: binder.status,
      visibility: shareLink.visibility,
    })
    .from(shareLink)
    .innerJoin(binder, eq(binder.id, shareLink.binderId))
    .where(eq(shareLink.slug, slug));
  if (row?.status !== "published") {
    return null;
  }
  return { id: row.id, name: row.name, visibility: row.visibility };
}

export async function incrementShareViews(slug: string): Promise<void> {
  await db
    .update(shareLink)
    .set({ views: sql`${shareLink.views} + 1` })
    .where(eq(shareLink.slug, slug));
}

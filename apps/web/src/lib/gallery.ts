import { binder, shareLink, user } from "@sleevebook/db";
import { and, count, desc, eq, ilike, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "./db";
import { getGoalProgress } from "./goals";

export const GALLERY_PAGE_SIZE = 24;
export const GALLERY_FEATURED_LIMIT = 6;

export type GallerySort = "recientes" | "populares";

export interface GalleryBinder {
  id: string;
  name: string;
  formatRows: number;
  formatCols: number;
  sheets: number;
  slug: string;
  views: number;
  owner: { name: string; handle: string; image: string | null };
  /** Null when the binder has no goal. */
  progress: { owned: number; total: number; percentage: number } | null;
}

export interface GalleryPage {
  featured: GalleryBinder[];
  items: GalleryBinder[];
  total: number;
  page: number;
  pageCount: number;
}

export interface GalleryQuery {
  q?: string;
  sort?: GallerySort;
  page?: number;
}

/** Escapes LIKE wildcards so the user's text is matched literally. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Only published binders whose share link is public are ever listed. */
function publicFilter(q: string | undefined): SQL | undefined {
  const term = q?.trim();
  return and(
    eq(binder.status, "published"),
    eq(shareLink.visibility, "public"),
    term ? ilike(binder.name, `%${escapeLike(term)}%`) : undefined,
  );
}

const SELECT_FIELDS = {
  id: binder.id,
  name: binder.name,
  formatRows: binder.formatRows,
  formatCols: binder.formatCols,
  sheets: binder.sheets,
  goalId: binder.goalId,
  slug: shareLink.slug,
  views: shareLink.views,
  ownerName: user.name,
  ownerHandle: user.handle,
  ownerImage: user.image,
};

type GalleryRow = Awaited<ReturnType<typeof selectRows>>[number];

function selectRows(where: SQL | undefined) {
  return db
    .select(SELECT_FIELDS)
    .from(binder)
    .innerJoin(shareLink, eq(shareLink.binderId, binder.id))
    .innerJoin(user, eq(user.id, binder.userId))
    .where(where);
}

async function toGalleryBinder(row: GalleryRow): Promise<GalleryBinder> {
  // Only binders with a goal need the (heavier) progress lookup.
  const goal = row.goalId ? await getGoalProgress(row.id) : null;
  return {
    id: row.id,
    name: row.name,
    formatRows: row.formatRows,
    formatCols: row.formatCols,
    sheets: row.sheets,
    slug: row.slug,
    views: row.views,
    owner: { name: row.ownerName, handle: row.ownerHandle, image: row.ownerImage },
    progress: goal ? { owned: goal.owned, total: goal.total, percentage: goal.percentage } : null,
  };
}

async function toGalleryBinders(rows: GalleryRow[]): Promise<GalleryBinder[]> {
  return Promise.all(rows.map(toGalleryBinder));
}

/** Featured public binders, most recently featured first. */
export async function listFeaturedGalleryBinders(
  limit = GALLERY_FEATURED_LIMIT,
  q?: string,
): Promise<GalleryBinder[]> {
  const rows = await selectRows(and(publicFilter(q), isNotNull(binder.featuredAt)))
    .orderBy(desc(binder.featuredAt))
    .limit(Math.min(limit, GALLERY_FEATURED_LIMIT));
  return toGalleryBinders(rows);
}

/**
 * One page of the public gallery. Featured binders come back separately and
 * are left out of `items`, so each binder appears once on the page.
 */
export async function listGalleryBinders({
  q,
  sort = "recientes",
  page = 1,
}: GalleryQuery): Promise<GalleryPage> {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const where = publicFilter(q);
  const regular = and(where, isNull(binder.featuredAt));

  const [countRow] = await db
    .select({ value: count() })
    .from(binder)
    .innerJoin(shareLink, eq(shareLink.binderId, binder.id))
    .innerJoin(user, eq(user.id, binder.userId))
    .where(regular);
  const total = Number(countRow?.value ?? 0);

  const order =
    sort === "populares"
      ? [desc(shareLink.views), desc(binder.createdAt)]
      : [desc(binder.createdAt)];
  const itemRows = await selectRows(regular)
    .orderBy(...order)
    .limit(GALLERY_PAGE_SIZE)
    .offset((safePage - 1) * GALLERY_PAGE_SIZE);

  const featured = await listFeaturedGalleryBinders(GALLERY_FEATURED_LIMIT, q);

  return {
    featured,
    items: await toGalleryBinders(itemRows),
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / GALLERY_PAGE_SIZE)),
  };
}

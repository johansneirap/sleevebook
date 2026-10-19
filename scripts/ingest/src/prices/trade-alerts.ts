import type { Layout, ListingStatus, TradeMatch, TradeParty } from "@sleevebook/binder-core";
import {
  collectTradeable,
  collectWants,
  computeTradeMatches,
  layoutSchema,
  listingStatusSchema,
} from "@sleevebook/binder-core";
import type { Database } from "@sleevebook/db";
import {
  binder,
  binderVersion,
  goal,
  notification,
  pocketListing,
  profile,
  user,
  wishlistItem,
} from "@sleevebook/db";
import { and, desc, eq, gte, inArray, max } from "drizzle-orm";

/** Same bound as the web side (apps/web/src/lib/trades.ts TRADE_USER_CAP). */
export const TRADE_NOTIFY_USER_CAP = 500;
/** A counterpart already notified about within this window is not re-notified. */
export const TRADE_NOTIFY_WINDOW_DAYS = 30;
/** Maximum "intercambio" notifications created per user per run. */
export const TRADE_NOTIFY_CAP_PER_USER = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TradeNotificationData {
  otherUserId: string;
  theyCanGive: string[];
  youCanGive: string[];
}

export interface TradeNotification {
  userId: string;
  kind: "intercambio";
  title: string;
  body: string;
  href: "/intercambios";
  data: TradeNotificationData;
}

/** A previously stored "intercambio" notification for one viewer. */
export interface PastTradeNotice {
  otherUserId: string;
  theyCanGive: string[];
  youCanGive: string[];
  createdAt: Date;
}

export interface DecideTradeInput {
  viewerId: string;
  /** Matches for the viewer, already sorted (mutual first) by computeTradeMatches. */
  matches: TradeMatch[];
  /** userId -> handle, for the title. */
  handles: ReadonlyMap<string, string>;
  /** The viewer's "intercambio" notifications; only the window matters. */
  past: PastTradeNotice[];
  now: Date;
  cap?: number;
}

function isSubset(part: readonly string[], whole: readonly string[]): boolean {
  const set = new Set(whole);
  return part.every((id) => set.has(id));
}

/**
 * Pure rule. A match is new unless a notice to the same counterpart from the
 * last 30 days already covers it: its theyCanGive and youCanGive contain every
 * variant of the match. Keeps the matches' order and stops at `cap`.
 */
export function decideTradeNotifications(input: DecideTradeInput): TradeNotification[] {
  const cap = input.cap ?? TRADE_NOTIFY_CAP_PER_USER;
  const windowStart = input.now.getTime() - TRADE_NOTIFY_WINDOW_DAYS * DAY_MS;
  const out: TradeNotification[] = [];

  for (const match of input.matches) {
    if (out.length >= cap) {
      break;
    }
    const covered = input.past.some(
      (notice) =>
        notice.otherUserId === match.userId &&
        notice.createdAt.getTime() >= windowStart &&
        isSubset(match.theyCanGive, notice.theyCanGive) &&
        isSubset(match.youCanGive, notice.youCanGive),
    );
    if (covered) {
      continue;
    }

    const handle = input.handles.get(match.userId);
    const who = handle ? `@${handle}` : "un coleccionista";
    const body =
      `Te puede dar ${match.theyCanGive.length} · le sirve ${match.youCanGive.length} de lo tuyo` +
      (match.mutual ? " · Intercambio mutuo" : "");
    out.push({
      userId: input.viewerId,
      kind: "intercambio",
      title: `Nuevo intercambio posible con ${who}`,
      body,
      href: "/intercambios",
      data: {
        otherUserId: match.userId,
        theyCanGive: [...match.theyCanGive],
        youCanGive: [...match.youCanGive],
      },
    });
  }
  return out;
}

/** Raw rows as loaded from the database, before grouping per user. */
export interface TradeRows {
  profiles: Array<{ userId: string; tradesOptIn: boolean }>;
  binders: Array<{
    userId: string;
    mode: string;
    layout: unknown;
    goalVariantIds: string[] | null;
    binderId: string;
  }>;
  listings: Array<{ binderId: string; pocketCode: string; status: string }>;
  wishlist: Array<{ userId: string; variantId: string }>;
}

/**
 * Groups the rows into one TradeParty per user, the same way the web loader
 * does. A binder whose layout does not parse is skipped, not fatal.
 * Users with nothing to give or want are left out.
 */
export function buildTradeParties(rows: TradeRows): TradeParty[] {
  const optedIn = new Map(rows.profiles.map((row) => [row.userId, row.tradesOptIn]));
  const listingsByBinder = new Map<string, Record<string, { status: ListingStatus }>>();
  for (const row of rows.listings) {
    const listings = listingsByBinder.get(row.binderId) ?? {};
    listings[row.pocketCode] = {
      status: listingStatusSchema.catch("disponible").parse(row.status),
    };
    listingsByBinder.set(row.binderId, listings);
  }

  const tradeLayouts = new Map<
    string,
    Array<{
      mode: "collection" | "seller";
      pockets: Layout["pockets"];
      listings: Record<string, { status: ListingStatus } | undefined>;
    }>
  >();
  const wantLayouts = new Map<
    string,
    Array<{ pockets: Layout["pockets"]; goalVariantIds: string[] }>
  >();
  for (const row of rows.binders) {
    const parsed = layoutSchema.safeParse(row.layout);
    if (!parsed.success) {
      continue;
    }
    const mode = row.mode === "seller" ? "seller" : "collection";
    const trade = tradeLayouts.get(row.userId) ?? [];
    trade.push({
      mode,
      pockets: parsed.data.pockets,
      listings: listingsByBinder.get(row.binderId) ?? {},
    });
    tradeLayouts.set(row.userId, trade);

    const wants = wantLayouts.get(row.userId) ?? [];
    wants.push({ pockets: parsed.data.pockets, goalVariantIds: row.goalVariantIds ?? [] });
    wantLayouts.set(row.userId, wants);
  }

  const wishlistByUser = new Map<string, string[]>();
  for (const row of rows.wishlist) {
    const list = wishlistByUser.get(row.userId) ?? [];
    list.push(row.variantId);
    wishlistByUser.set(row.userId, list);
  }

  const userIds = new Set([...tradeLayouts.keys(), ...wishlistByUser.keys()]);
  const parties: TradeParty[] = [];
  for (const userId of userIds) {
    const tradeable = collectTradeable(tradeLayouts.get(userId) ?? []);
    const wants = collectWants(wishlistByUser.get(userId) ?? [], wantLayouts.get(userId) ?? []);
    if (tradeable.size === 0 && wants.size === 0) {
      continue;
    }
    parties.push({
      userId,
      tradeable,
      wants,
      // A missing profile row means the defaults: opted in.
      optedIn: optedIn.get(userId) ?? true,
    });
  }
  return parties.sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Loads trade parties, computes each opted-in user's matches against the
 * others and stores the new "intercambio" notifications. Returns how many
 * were created. Bounded to TRADE_NOTIFY_USER_CAP users.
 */
export async function runTradeAlerts(db: Database, now = new Date()): Promise<number> {
  const [profileRows, binderRows, listingRows, wishRows] = await Promise.all([
    db.select({ userId: profile.userId, tradesOptIn: profile.tradesOptIn }).from(profile),
    loadLatestBinders(db),
    db
      .select({
        binderId: pocketListing.binderId,
        pocketCode: pocketListing.pocketCode,
        status: pocketListing.status,
      })
      .from(pocketListing),
    db
      .select({ userId: wishlistItem.userId, variantId: wishlistItem.variantId })
      .from(wishlistItem),
  ]);

  const parties = buildTradeParties({
    profiles: profileRows,
    binders: binderRows,
    listings: listingRows,
    wishlist: wishRows,
  });
  const candidates = parties
    .filter((party) => party.optedIn !== false)
    .slice(0, TRADE_NOTIFY_USER_CAP);
  if (candidates.length < 2) {
    return 0;
  }

  const candidateIds = candidates.map((party) => party.userId);
  const windowStart = new Date(now.getTime() - TRADE_NOTIFY_WINDOW_DAYS * DAY_MS);
  const [pastRows, userRows] = await Promise.all([
    db
      .select({
        userId: notification.userId,
        data: notification.data,
        createdAt: notification.createdAt,
      })
      .from(notification)
      .where(
        and(
          eq(notification.kind, "intercambio"),
          gte(notification.createdAt, windowStart),
          inArray(notification.userId, candidateIds),
        ),
      )
      .orderBy(desc(notification.createdAt)),
    db
      .select({ id: user.id, handle: user.handle })
      .from(user)
      .where(inArray(user.id, candidateIds)),
  ]);

  const pastByUser = new Map<string, PastTradeNotice[]>();
  for (const row of pastRows) {
    const data = parseTradeData(row.data);
    if (!data) {
      continue;
    }
    const list = pastByUser.get(row.userId) ?? [];
    list.push({ ...data, createdAt: row.createdAt });
    pastByUser.set(row.userId, list);
  }
  const handles = new Map(userRows.map((row) => [row.id, row.handle]));

  const toInsert: TradeNotification[] = [];
  for (const viewer of candidates) {
    const matches = computeTradeMatches(viewer, candidates);
    toInsert.push(
      ...decideTradeNotifications({
        viewerId: viewer.userId,
        matches,
        handles,
        past: pastByUser.get(viewer.userId) ?? [],
        now,
      }),
    );
  }

  for (let start = 0; start < toInsert.length; start += 500) {
    await db.insert(notification).values(toInsert.slice(start, start + 500));
  }
  return toInsert.length;
}

/** Validates the stored `data` of an intercambio notification. */
export function parseTradeData(
  data: unknown,
): { otherUserId: string; theyCanGive: string[]; youCanGive: string[] } | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  const { otherUserId, theyCanGive, youCanGive } = record;
  if (
    typeof otherUserId !== "string" ||
    !isStringArray(theyCanGive) ||
    !isStringArray(youCanGive)
  ) {
    return null;
  }
  return { otherUserId, theyCanGive, youCanGive };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Each binder's latest layout (highest versionNumber), with its mode and goal variants. */
async function loadLatestBinders(db: Database): Promise<TradeRows["binders"]> {
  const latest = db
    .select({
      binderId: binderVersion.binderId,
      latestNumber: max(binderVersion.versionNumber).as("latest_number"),
    })
    .from(binderVersion)
    .groupBy(binderVersion.binderId)
    .as("latest");

  return db
    .select({
      binderId: binder.id,
      userId: binder.userId,
      mode: binder.mode,
      layout: binderVersion.layout,
      goalVariantIds: goal.variantIds,
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
    .leftJoin(goal, eq(goal.id, binder.goalId));
}

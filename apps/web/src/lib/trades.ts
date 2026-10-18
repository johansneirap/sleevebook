import type {
  ListingStatus,
  SellerContact,
  TradeLayoutInput,
  TradeParty,
  WantsLayoutInput,
} from "@sleevebook/binder-core";
import {
  collectTradeable,
  collectWants,
  computeTradeMatches,
  layoutSchema,
  listingStatusSchema,
  sellerContactSchema,
} from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  goal,
  pocketListing,
  profile,
  user,
  wishlistItem,
} from "@sleevebook/db";
import { and, eq, max } from "drizzle-orm";
import { getVariantDisplays } from "./binders";
import { db } from "./db";
import { getLatestPrices } from "./pricing";

/** Upper bound on how many other users are matched per page view (closed beta). */
export const TRADE_USER_CAP = 500;

export interface TradeCard {
  variantId: string;
  name: string;
  number: string;
  setName: string;
  variant: string;
  imageUrl: string | null;
  /** Latest market price in USD, null when we have no price point yet. */
  priceUsd: number | null;
}

export interface TradeEntry {
  userId: string;
  name: string;
  handle: string;
  image: string | null;
  contact: SellerContact;
  mutual: boolean;
  /** Cards the other user can give the viewer (the viewer wants them). */
  theyCanGive: TradeCard[];
  /** Cards the viewer can give the other user (they want them). */
  youCanGive: TradeCard[];
}

export interface TradesData {
  /** False when the viewer opted out: nothing is computed or shown. */
  optedIn: boolean;
  entries: TradeEntry[];
  /** True when more than TRADE_USER_CAP users qualified and the rest were dropped. */
  truncated: boolean;
}

function compareIds(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Loads the viewer's trade matches: one query per table, grouped in memory.
 * The matching rules live in @sleevebook/binder-core (trade.ts).
 */
export async function loadTradeMatches(viewerId: string): Promise<TradesData> {
  const [profileRows, binderRows, listingRows, wishRows, userRows] = await Promise.all([
    db
      .select({
        userId: profile.userId,
        contact: profile.contact,
        tradesOptIn: profile.tradesOptIn,
      })
      .from(profile),
    loadLatestBinders(),
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
    db.select({ id: user.id, name: user.name, handle: user.handle, image: user.image }).from(user),
  ]);

  // A missing profile row means the defaults: opted in, public contact empty.
  const profileByUser = new Map(profileRows.map((row) => [row.userId, row]));
  const optedInById = (userId: string): boolean => profileByUser.get(userId)?.tradesOptIn ?? true;

  if (!optedInById(viewerId)) {
    return { optedIn: false, entries: [], truncated: false };
  }

  const listingsByBinder = new Map<string, Record<string, { status: ListingStatus }>>();
  for (const row of listingRows) {
    const listings = listingsByBinder.get(row.binderId) ?? {};
    listings[row.pocketCode] = {
      status: listingStatusSchema.catch("disponible").parse(row.status),
    };
    listingsByBinder.set(row.binderId, listings);
  }

  const tradeLayoutsByUser = new Map<string, TradeLayoutInput[]>();
  const wantLayoutsByUser = new Map<string, WantsLayoutInput[]>();
  for (const row of binderRows) {
    const layout = layoutSchema.parse(row.layout);
    const mode = row.mode === "seller" ? "seller" : "collection";
    const tradeLayouts = tradeLayoutsByUser.get(row.userId) ?? [];
    tradeLayouts.push({
      mode,
      pockets: layout.pockets,
      listings: listingsByBinder.get(row.binderId) ?? {},
    });
    tradeLayoutsByUser.set(row.userId, tradeLayouts);

    const wantLayouts = wantLayoutsByUser.get(row.userId) ?? [];
    wantLayouts.push({ pockets: layout.pockets, goalVariantIds: row.goalVariantIds ?? [] });
    wantLayoutsByUser.set(row.userId, wantLayouts);
  }

  const wishlistByUser = new Map<string, string[]>();
  for (const row of wishRows) {
    const list = wishlistByUser.get(row.userId) ?? [];
    list.push(row.variantId);
    wishlistByUser.set(row.userId, list);
  }

  // Every user with a binder or a wishlist. The opt-out rule is applied by
  // computeTradeMatches through `optedIn`, so the viewer is checked there too.
  const participantIds = new Set([
    ...tradeLayoutsByUser.keys(),
    ...wishlistByUser.keys(),
    viewerId,
  ]);
  const parties = new Map<string, TradeParty>();
  for (const userId of participantIds) {
    parties.set(userId, {
      userId,
      tradeable: collectTradeable(tradeLayoutsByUser.get(userId) ?? []),
      wants: collectWants(wishlistByUser.get(userId) ?? [], wantLayoutsByUser.get(userId) ?? []),
      optedIn: optedInById(userId),
    });
  }

  const viewer = parties.get(viewerId);
  if (!viewer) {
    return { optedIn: true, entries: [], truncated: false };
  }

  // Only other opted-in users with something to give or to want can match.
  const candidates = [...parties.values()]
    .filter(
      (party) =>
        party.userId !== viewerId &&
        party.optedIn !== false &&
        (party.tradeable.size > 0 || party.wants.size > 0),
    )
    .sort((a, b) => compareIds(a.userId, b.userId));
  const truncated = candidates.length > TRADE_USER_CAP;
  if (truncated) {
    console.warn(
      `[trades] ${candidates.length} usuarios con intercambios; solo se cruzan los primeros ${TRADE_USER_CAP}`,
    );
  }

  const matches = computeTradeMatches(viewer, candidates.slice(0, TRADE_USER_CAP));

  const variantIds = new Set<string>();
  for (const match of matches) {
    for (const id of [...match.theyCanGive, ...match.youCanGive]) {
      variantIds.add(id);
    }
  }
  const ids = [...variantIds];
  const [displays, prices] = await Promise.all([getVariantDisplays(ids), getLatestPrices(ids)]);
  const usersById = new Map(userRows.map((row) => [row.id, row]));

  const toCards = (cardIds: string[]): TradeCard[] =>
    cardIds
      .flatMap((variantId): TradeCard[] => {
        const display = displays.get(variantId);
        if (!display) {
          return [];
        }
        return [
          {
            variantId,
            name: display.name,
            number: display.number,
            setName: display.setName,
            variant: display.variant,
            imageUrl: display.imageUrl,
            priceUsd: prices[variantId]?.amountUsd ?? null,
          },
        ];
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.number.localeCompare(b.number));

  const entries: TradeEntry[] = [];
  for (const match of matches) {
    const other = usersById.get(match.userId);
    if (!other) {
      continue;
    }
    entries.push({
      userId: other.id,
      name: other.name,
      handle: other.handle,
      image: other.image,
      contact: sellerContactSchema.catch({}).parse(profileByUser.get(other.id)?.contact ?? {}),
      mutual: match.mutual,
      theyCanGive: toCards(match.theyCanGive),
      youCanGive: toCards(match.youCanGive),
    });
  }

  return { optedIn: true, entries, truncated };
}

/** Each binder's latest layout (highest versionNumber), with its mode and goal variants. */
function loadLatestBinders() {
  const latest = db
    .select({
      binderId: binderVersion.binderId,
      // Not "version_number": the outer join would reference it ambiguously.
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

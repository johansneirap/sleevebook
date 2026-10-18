import type { Layout } from "./layout-schema";
import type { BinderMode, ListingStatus } from "./seller";

// Coincidencias de intercambio: "tengo repetida lo que te falta".
//
// Two sides per user, both computed from the LATEST layout of each binder:
//
// - TRADEABLE copies of a variant:
//   - collection binders: the card pockets are summed per variant across ALL of
//     the user's collection binders, then one copy is kept for the collection
//     (extras only). Pockets count `pocket.count ?? 1`.
//   - seller binders: every card pocket whose listing is "disponible" (or has no
//     pocket_listing row, which means disponible) counts fully: it is for sale.
//     "reservado" and "vendido" never count.
// - WANTS: the user's wishlist variants, plus, for every binder with a goal, the
//   goal's variants that are not present as a card in that same binder.
//
// A match is a pair of users where at least one side has something the other
// wants. Users who opted out of trades (profile.tradesOptIn = false) take part
// in neither direction, and nobody sees matches unless they are opted in too.
// Pure: the database loading lives in apps/web/src/lib/trades.ts.

/** Listing state per pocket code. A missing entry means "disponible". */
export type TradeListings = Readonly<Record<string, { status: ListingStatus } | undefined>>;

export interface TradeLayoutInput {
  mode: BinderMode;
  pockets: Layout["pockets"];
  listings: TradeListings;
}

export interface WantsLayoutInput {
  pockets: Layout["pockets"];
  /** goal.variantIds of the binder's goal; empty when the binder has no goal. */
  goalVariantIds: readonly string[];
}

export interface TradeParty {
  userId: string;
  /** Copies this user can give away, per variant id. Absent means 0. */
  tradeable: ReadonlyMap<string, number>;
  /** Variant ids this user is looking for. */
  wants: ReadonlySet<string>;
  /** Missing (undefined) counts as opted in, like a missing profile row. */
  optedIn?: boolean;
}

export interface TradeMatch {
  userId: string;
  /** Variants the other user can give the viewer (the viewer wants them). */
  theyCanGive: string[];
  /** Variants the viewer can give the other user (the other user wants them). */
  youCanGive: string[];
  /** Both directions have at least one variant. */
  mutual: boolean;
}

function addCount(map: Map<string, number>, variantId: string, count: number): void {
  map.set(variantId, (map.get(variantId) ?? 0) + count);
}

/**
 * Tradeable copies per variant for one user, across all their binders.
 * Collection binders keep one copy for the collection; seller binders offer
 * every disponible card pocket.
 */
export function collectTradeable(layouts: readonly TradeLayoutInput[]): Map<string, number> {
  const owned = new Map<string, number>();
  const forSale = new Map<string, number>();

  for (const layout of layouts) {
    for (const [code, content] of Object.entries(layout.pockets)) {
      if (content.kind !== "card") {
        continue;
      }
      const count = content.count ?? 1;
      if (layout.mode === "seller") {
        const status = layout.listings[code]?.status ?? "disponible";
        if (status === "disponible") {
          addCount(forSale, content.variant, count);
        }
      } else {
        addCount(owned, content.variant, count);
      }
    }
  }

  const tradeable = new Map<string, number>();
  for (const [variantId, count] of owned) {
    // One copy stays in the collection; only the extras are tradeable.
    const extras = count - 1;
    if (extras > 0) {
      tradeable.set(variantId, extras);
    }
  }
  for (const [variantId, count] of forSale) {
    tradeable.set(variantId, (tradeable.get(variantId) ?? 0) + count);
  }
  return tradeable;
}

/**
 * Variants a user wants: the wishlist plus, per binder, the goal's variants
 * that the binder does not hold as a card.
 */
export function collectWants(
  wishlistVariantIds: readonly string[],
  layouts: readonly WantsLayoutInput[],
): Set<string> {
  const wants = new Set(wishlistVariantIds);
  for (const layout of layouts) {
    const held = new Set<string>();
    for (const content of Object.values(layout.pockets)) {
      if (content.kind === "card") {
        held.add(content.variant);
      }
    }
    for (const variantId of layout.goalVariantIds) {
      if (!held.has(variantId)) {
        wants.add(variantId);
      }
    }
  }
  return wants;
}

function compareMatches(a: TradeMatch, b: TradeMatch): number {
  if (a.mutual !== b.mutual) {
    return a.mutual ? -1 : 1;
  }
  const totalA = a.theyCanGive.length + a.youCanGive.length;
  const totalB = b.theyCanGive.length + b.youCanGive.length;
  if (totalA !== totalB) {
    return totalB - totalA;
  }
  return a.userId.localeCompare(b.userId);
}

/**
 * Matches for `viewer` against `others`. Returns nothing when the viewer is
 * opted out. Skips the viewer, opted-out users and users with no overlap.
 * Sorted: mutual first, then most matched variants, then userId.
 */
export function computeTradeMatches(
  viewer: TradeParty,
  others: readonly TradeParty[],
): TradeMatch[] {
  if (viewer.optedIn === false) {
    return [];
  }

  const matches: TradeMatch[] = [];
  for (const other of others) {
    if (other.userId === viewer.userId || other.optedIn === false) {
      continue;
    }
    const theyCanGive = [...other.tradeable.keys()]
      .filter((id) => (other.tradeable.get(id) ?? 0) > 0 && viewer.wants.has(id))
      .sort();
    const youCanGive = [...viewer.tradeable.keys()]
      .filter((id) => (viewer.tradeable.get(id) ?? 0) > 0 && other.wants.has(id))
      .sort();
    if (theyCanGive.length === 0 && youCanGive.length === 0) {
      continue;
    }
    matches.push({
      userId: other.userId,
      theyCanGive,
      youCanGive,
      mutual: theyCanGive.length > 0 && youCanGive.length > 0,
    });
  }
  return matches.sort(compareMatches);
}

import type { Database } from "@sleevebook/db";
import { card, cardVariant, notification, pricePoint, set, wishlistItem } from "@sleevebook/db";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

/** A wishlist item with a price target, plus the latest USD price of its variant. */
export interface WatchedItem {
  wishlistItemId: string;
  userId: string;
  variantId: string;
  targetUsd: number;
  /** When the alert last fired; null when it is armed. */
  alertedAt: Date | null;
  /** Latest USD price of the variant; null when it has no price yet. */
  latestUsd: number | null;
  cardName: string;
  setName: string;
  number: string;
}

export interface PriceAlertNotification {
  userId: string;
  kind: "precio";
  title: string;
  body: string;
  href: "/deseos";
  data: { variantId: string; price: number; target: number };
}

export interface PriceAlertDecision {
  /** Notifications to insert; each one also arms `alertedAt` for its item. */
  alerts: Array<{ wishlistItemId: string; notification: PriceAlertNotification }>;
  /** Wishlist items whose price went back above the target: clear `alertedAt`. */
  rearm: string[];
}

function formatUsd(amount: number): string {
  return `US$${amount.toFixed(2)}`;
}

/**
 * Pure rule. Notifies once per downward crossing: an armed item whose latest
 * price is at or below the target fires; a fired item whose price is above
 * the target again gets re-armed so the next crossing notifies again.
 */
export function decideAlerts(items: WatchedItem[]): PriceAlertDecision {
  const decision: PriceAlertDecision = { alerts: [], rearm: [] };
  for (const item of items) {
    if (item.latestUsd === null) {
      continue;
    }
    const atOrBelow = item.latestUsd <= item.targetUsd;
    if (atOrBelow && item.alertedAt === null) {
      decision.alerts.push({
        wishlistItemId: item.wishlistItemId,
        notification: {
          userId: item.userId,
          kind: "precio",
          title: `${item.cardName} bajó a ${formatUsd(item.latestUsd)}`,
          body: `${item.setName} · #${item.number} · tu objetivo: ${formatUsd(item.targetUsd)}`,
          href: "/deseos",
          data: { variantId: item.variantId, price: item.latestUsd, target: item.targetUsd },
        },
      });
    } else if (!atOrBelow && item.alertedAt !== null) {
      decision.rearm.push(item.wishlistItemId);
    }
  }
  return decision;
}

/**
 * Evaluates every wishlist item with a price target against the latest USD
 * price_point of its variant, then stores the notifications and the
 * alertedAt changes. Returns how many notifications were created.
 */
export async function runPriceAlerts(db: Database, now = new Date()): Promise<number> {
  const rows = await db
    .select({
      wishlistItemId: wishlistItem.id,
      userId: wishlistItem.userId,
      variantId: wishlistItem.variantId,
      targetPriceUsd: wishlistItem.targetPriceUsd,
      alertedAt: wishlistItem.alertedAt,
      cardName: card.name,
      number: card.number,
      setName: set.name,
    })
    .from(wishlistItem)
    .innerJoin(cardVariant, eq(cardVariant.id, wishlistItem.variantId))
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .where(isNotNull(wishlistItem.targetPriceUsd));

  if (rows.length === 0) {
    return 0;
  }

  const variantIds = [...new Set(rows.map((row) => row.variantId))];
  const latest = await db
    .selectDistinctOn([pricePoint.variantId], {
      variantId: pricePoint.variantId,
      amount: pricePoint.amount,
    })
    .from(pricePoint)
    .where(
      and(inArray(pricePoint.variantId, variantIds), sql`lower(${pricePoint.currency}) = 'usd'`),
    )
    .orderBy(pricePoint.variantId, desc(pricePoint.capturedAt));
  const latestByVariant = new Map(latest.map((row) => [row.variantId, Number(row.amount)]));

  const items: WatchedItem[] = rows.map((row) => ({
    wishlistItemId: row.wishlistItemId,
    userId: row.userId,
    variantId: row.variantId,
    targetUsd: Number(row.targetPriceUsd),
    alertedAt: row.alertedAt,
    latestUsd: latestByVariant.get(row.variantId) ?? null,
    cardName: row.cardName,
    setName: row.setName,
    number: row.number,
  }));

  const decision = decideAlerts(items);
  if (decision.alerts.length === 0 && decision.rearm.length === 0) {
    return 0;
  }

  await db.transaction(async (tx) => {
    if (decision.alerts.length > 0) {
      await tx.insert(notification).values(decision.alerts.map((alert) => alert.notification));
      for (const alert of decision.alerts) {
        await tx
          .update(wishlistItem)
          .set({ alertedAt: now })
          .where(eq(wishlistItem.id, alert.wishlistItemId));
      }
    }
    if (decision.rearm.length > 0) {
      await tx
        .update(wishlistItem)
        .set({ alertedAt: null })
        .where(inArray(wishlistItem.id, decision.rearm));
    }
  });

  return decision.alerts.length;
}

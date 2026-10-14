import type { Layout } from "@sleevebook/binder-core";
import { binder, goal } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { getBinderWithLayout } from "./binders";
import { db } from "./db";

export interface GoalProgress {
  goalId: string;
  total: number;
  owned: number;
  percentage: number;
  allVariantIds: string[];
  missingVariantIds: string[];
}

function collectOwnedVariantIds(layout: Layout): Set<string> {
  const owned = new Set<string>();
  for (const content of Object.values(layout.pockets)) {
    if (content.kind === "card") {
      owned.add(content.variant);
    }
  }
  return owned;
}

export async function getGoalProgress(binderId: string): Promise<GoalProgress | null> {
  const [binderRow] = await db
    .select({ goalId: binder.goalId })
    .from(binder)
    .where(eq(binder.id, binderId));
  if (!binderRow?.goalId) {
    return null;
  }

  const [goalRow] = await db
    .select({ variantIds: goal.variantIds })
    .from(goal)
    .where(eq(goal.id, binderRow.goalId));
  if (!goalRow) {
    return null;
  }

  const binderData = await getBinderWithLayout(binderId);
  if (!binderData) {
    return null;
  }

  const owned = collectOwnedVariantIds(binderData.layout);
  const target = goalRow.variantIds;
  const missingVariantIds = target.filter((id) => !owned.has(id));
  const total = target.length;
  const ownedCount = total - missingVariantIds.length;

  return {
    goalId: binderRow.goalId,
    total,
    owned: ownedCount,
    percentage: total === 0 ? 0 : Math.round((ownedCount / total) * 100),
    allVariantIds: target,
    missingVariantIds,
  };
}

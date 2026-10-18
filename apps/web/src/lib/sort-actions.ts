"use server";

import { assertBinderOwner } from "./session";
import { computeSortedLayoutUnchecked, type SortOptions, type SortResult } from "./sort-layout";

export type {
  GroupField,
  SortableField,
  SortCriterion,
  SortMove,
  SortOptions,
  SortResult,
} from "./sort-layout";

export async function computeSortedLayout(
  binderId: string,
  options: SortOptions,
): Promise<SortResult> {
  await assertBinderOwner(binderId);
  return computeSortedLayoutUnchecked(binderId, options);
}

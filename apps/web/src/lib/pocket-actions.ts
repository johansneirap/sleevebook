"use server";

import type { Layout } from "@sleevebook/binder-core";
import { layoutSchema } from "@sleevebook/binder-core";
import { binderVersion } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { assertBinderOwner } from "./session";

export type PocketValue = Layout["pockets"][string];

export interface PocketChange {
  pocketCode: string;
  content: PocketValue;
}

// Every pocket mutation -- click-to-assign, drag/swap, bulk clear, and
// undo/redo replay -- goes through this one atomic read-patch-write so a
// multi-pocket change (e.g. a swap) never persists half-applied.
export async function applyPocketChanges(binderId: string, changes: PocketChange[]): Promise<void> {
  await assertBinderOwner(binderId);
  if (changes.length === 0) {
    return;
  }

  const [versionRow] = await db
    .select({ id: binderVersion.id, layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    throw new Error(`No layout found for binder "${binderId}"`);
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const pockets = { ...layout.pockets };
  for (const change of changes) {
    pockets[change.pocketCode] = change.content;
  }

  const updatedLayout = layoutSchema.parse({ ...layout, pockets });

  await db
    .update(binderVersion)
    .set({ layout: updatedLayout })
    .where(eq(binderVersion.id, versionRow.id));

  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
}

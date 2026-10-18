"use server";

import { layoutSchema } from "@sleevebook/binder-core";
import { binderVersion } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { assertBinderOwner } from "./session";

export interface ThemeInput {
  preset: string;
  sleeve: string;
  bg?: string;
}

export async function updateBinderTheme(binderId: string, theme: ThemeInput): Promise<void> {
  await assertBinderOwner(binderId);
  const [versionRow] = await db
    .select({ id: binderVersion.id, layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return;
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const updatedLayout = layoutSchema.parse({
    ...layout,
    theme: {
      preset: theme.preset,
      sleeve: theme.sleeve,
      ...(theme.bg ? { bg: theme.bg } : {}),
    },
  });

  await db
    .update(binderVersion)
    .set({ layout: updatedLayout })
    .where(eq(binderVersion.id, versionRow.id));

  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
}

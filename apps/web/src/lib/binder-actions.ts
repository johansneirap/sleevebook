"use server";

import { createEmptyLayout } from "@sleevebook/binder-core";
import { binder, binderVersion } from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { assertBinderOwner, assertUser } from "./session";

const OPENINGS = new Set(["side", "top"]);
const MAX_FORMAT_DIMENSION = 6;
const MAX_SHEETS = 200;

function parseClampedInt(
  value: FormDataEntryValue | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

export async function createBinder(formData: FormData): Promise<void> {
  const owner = await assertUser();
  const name = String(formData.get("name") ?? "").trim() || "Binder sin nombre";
  const formatRows = parseClampedInt(formData.get("rows"), 3, 1, MAX_FORMAT_DIMENSION);
  const formatCols = parseClampedInt(formData.get("cols"), 3, 1, MAX_FORMAT_DIMENSION);
  const sheets = parseClampedInt(formData.get("sheets"), 20, 1, MAX_SHEETS);
  const openingRaw = String(formData.get("opening") ?? "side");
  const opening = OPENINGS.has(openingRaw) ? openingRaw : "side";

  const [created] = await db
    .insert(binder)
    .values({
      userId: owner.id,
      name,
      formatRows,
      formatCols,
      opening,
      loading: "side",
      sheets,
      status: "draft",
    })
    .returning({ id: binder.id });
  const binderId = (created as { id: string }).id;

  const layout = createEmptyLayout(
    { rows: formatRows, cols: formatCols },
    sheets,
    opening as "side" | "top",
  );
  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });

  revalidatePath("/binders");
  redirect(`/binders/${binderId}`);
}

export async function duplicateBinder(formData: FormData): Promise<void> {
  const sourceId = String(formData.get("binderId") ?? "");
  const owner = await assertBinderOwner(sourceId);
  const [source] = await db.select().from(binder).where(eq(binder.id, sourceId));
  if (!source) {
    return;
  }

  const [latestVersion] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, sourceId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!latestVersion) {
    return;
  }

  const [created] = await db
    .insert(binder)
    .values({
      userId: owner.id,
      name: `${source.name} (copia)`,
      formatRows: source.formatRows,
      formatCols: source.formatCols,
      opening: source.opening,
      loading: source.loading,
      sheets: source.sheets,
      goalId: source.goalId,
      status: "draft",
    })
    .returning({ id: binder.id });
  const binderId = (created as { id: string }).id;

  await db.insert(binderVersion).values({
    binderId,
    versionNumber: 1,
    layout: latestVersion.layout,
  });

  revalidatePath("/binders");
}

export async function renameBinder(formData: FormData): Promise<void> {
  const binderId = String(formData.get("binderId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!binderId || !name) {
    return;
  }
  await assertBinderOwner(binderId);
  await db.update(binder).set({ name }).where(eq(binder.id, binderId));
  revalidatePath("/binders");
  revalidatePath(`/binders/${binderId}`);
}

export async function setBinderStatus(formData: FormData): Promise<void> {
  const binderId = String(formData.get("binderId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!binderId || !["draft", "archived"].includes(status)) {
    return;
  }
  await assertBinderOwner(binderId);
  await db.update(binder).set({ status }).where(eq(binder.id, binderId));
  revalidatePath("/binders");
}

export async function deleteBinder(formData: FormData): Promise<void> {
  const binderId = String(formData.get("binderId") ?? "");
  if (!binderId) {
    return;
  }
  await assertBinderOwner(binderId);
  await db.delete(binder).where(eq(binder.id, binderId));
  revalidatePath("/binders");
}

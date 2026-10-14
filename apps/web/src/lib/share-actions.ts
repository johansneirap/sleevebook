"use server";

import { randomBytes } from "node:crypto";
import { binder, shareLink } from "@sleevebook/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";

const VISIBILITIES = new Set(["public", "unlisted"]);

function generateSlug(): string {
  return randomBytes(8).toString("base64url");
}

export async function publishBinder(formData: FormData): Promise<void> {
  const binderId = String(formData.get("binderId") ?? "");
  if (!binderId) {
    return;
  }
  const visibilityRaw = String(formData.get("visibility") ?? "unlisted");
  const visibility = VISIBILITIES.has(visibilityRaw) ? visibilityRaw : "unlisted";

  await db.update(binder).set({ status: "published" }).where(eq(binder.id, binderId));

  const [existing] = await db.select().from(shareLink).where(eq(shareLink.binderId, binderId));
  if (existing) {
    await db.update(shareLink).set({ visibility }).where(eq(shareLink.id, existing.id));
  } else {
    await db.insert(shareLink).values({ binderId, slug: generateSlug(), visibility });
  }

  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
}

export async function unpublishBinder(formData: FormData): Promise<void> {
  const binderId = String(formData.get("binderId") ?? "");
  if (!binderId) {
    return;
  }
  await db.update(binder).set({ status: "draft" }).where(eq(binder.id, binderId));
  revalidatePath(`/binders/${binderId}`);
  revalidatePath(`/binders/${binderId}/editar`);
}

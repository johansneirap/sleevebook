"use server";

import { binder, shareLink } from "@sleevebook/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { assertUser, isAdmin } from "./session";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Pins or unpins a binder in /galeria. Admin only (OWNER_EMAIL). Featuring
 * requires the binder to be publicly visible; unfeaturing is always allowed so
 * a binder that stopped being public can still be cleaned up.
 */
export async function setFeatured(binderId: string, featured: boolean): Promise<void> {
  const viewer = await assertUser();
  if (!isAdmin(viewer)) {
    throw new Error("No autorizado");
  }
  if (!UUID_PATTERN.test(binderId)) {
    throw new Error("Binder no válido");
  }

  if (featured) {
    const [visible] = await db
      .select({ id: binder.id })
      .from(binder)
      .innerJoin(shareLink, eq(shareLink.binderId, binder.id))
      .where(
        and(
          eq(binder.id, binderId),
          eq(binder.status, "published"),
          eq(shareLink.visibility, "public"),
        ),
      );
    if (!visible) {
      throw new Error("Solo se pueden destacar binders públicos");
    }
    // Already featured binders keep their original featuredAt (their place in the band).
    await db
      .update(binder)
      .set({ featuredAt: new Date() })
      .where(and(eq(binder.id, binderId), isNull(binder.featuredAt)));
  } else {
    await db.update(binder).set({ featuredAt: null }).where(eq(binder.id, binderId));
  }

  revalidatePath("/galeria");
  revalidatePath("/");
}

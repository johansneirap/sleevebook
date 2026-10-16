import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { user } from "./schema/auth";

// Login (Better Auth) isn't wired into the UI yet (Fase 1 roadmap). Every
// binder/goal created before then is owned by this one fixed user, so the
// real signup flow can later take over this same id instead of orphaning
// existing data.
export const DEV_USER_ID = "dev-user";

export async function ensureDevUser(db: Database): Promise<void> {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.id, DEV_USER_ID));
  if (existing) {
    return;
  }
  // Parallel e2e workers can all see it missing on a fresh database.
  await db
    .insert(user)
    .values({
      id: DEV_USER_ID,
      name: "Johans",
      email: "dev@sleevebook.local",
      handle: "johans",
    })
    .onConflictDoNothing();
}

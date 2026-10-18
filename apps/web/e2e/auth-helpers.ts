import type { APIRequestContext } from "@playwright/test";
import { account, type Database, user } from "@sleevebook/db";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

// Test-only credentials for the dev user (AUTH_DEV_LOGIN=1, never production).
// Every spec runs signed in as this user (see global-setup.ts).
export const DEV_USER_EMAIL = "dev@sleevebook.local";
export const DEV_USER_PASSWORD = process.env.E2E_DEV_PASSWORD ?? "sleevebook-dev-e2e";

export const TEST_USER_PASSWORD = "e2e-test-user-password";

/**
 * Creates (or recreates) a second user that can sign in with the dev login.
 * Use an id/email/handle with your spec's unique prefix; delete it in afterAll
 * with `db.delete(user).where(eq(user.id, id))` (cascades to its data).
 */
export async function createTestUser(
  db: Database,
  { id, email, handle, name }: { id: string; email: string; handle: string; name?: string },
): Promise<void> {
  await db.delete(user).where(eq(user.id, id));
  await db.insert(user).values({ id, name: name ?? handle, email, handle });
  await db.insert(account).values({
    id: `${id}-credential`,
    userId: id,
    accountId: id,
    providerId: "credential",
    password: await hashPassword(TEST_USER_PASSWORD),
  });
}

/**
 * Signs `request` (e.g. `page.request` of a context created with
 * `test.use({ storageState: { cookies: [], origins: [] } })`) in as `email`.
 * The session cookie is shared with the page of the same context.
 */
export async function signInAs(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password = TEST_USER_PASSWORD,
): Promise<void> {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
    headers: { origin: baseURL },
  });
  if (!response.ok()) {
    throw new Error(`sign-in as ${email} failed: ${response.status()}`);
  }
}

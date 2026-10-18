import { mkdirSync } from "node:fs";
import { request } from "@playwright/test";
import { account, createDb, DEV_USER_ID, ensureDevUser } from "@sleevebook/db";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { DEV_USER_EMAIL, DEV_USER_PASSWORD } from "./auth-helpers";

const STORAGE_STATE = "e2e/.auth/dev-user.json";

/**
 * Gives the fixed dev user a password for the dev-only email login
 * (AUTH_DEV_LOGIN=1), signs in once and stores the session cookie: every
 * spec runs as the owner of the fixtures it seeds with DEV_USER_ID.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = createDb(databaseUrl);
  await ensureDevUser(db);
  const password = await hashPassword(DEV_USER_PASSWORD);
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, DEV_USER_ID), eq(account.providerId, "credential")));
  if (existing) {
    await db.update(account).set({ password }).where(eq(account.id, existing.id));
  } else {
    await db.insert(account).values({
      id: `${DEV_USER_ID}-credential`,
      userId: DEV_USER_ID,
      accountId: DEV_USER_ID,
      providerId: "credential",
      password,
    });
  }
  await db.$client.end();

  const baseURL = `http://localhost:${process.env.PORT ?? 3000}`;
  const context = await request.newContext({ baseURL });
  const response = await context.post("/api/auth/sign-in/email", {
    data: { email: DEV_USER_EMAIL, password: DEV_USER_PASSWORD },
    headers: { origin: baseURL },
  });
  if (!response.ok()) {
    throw new Error(`Dev sign-in failed: ${response.status()} ${await response.text()}`);
  }
  mkdirSync("e2e/.auth", { recursive: true });
  await context.storageState({ path: STORAGE_STATE });
  await context.dispose();
}

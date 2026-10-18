import {
  account,
  artAsset,
  binder,
  cardInstance,
  DEV_USER_ID,
  session,
  user as userTable,
  verification,
} from "@sleevebook/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq, like } from "drizzle-orm";
import { env } from "../env";
import { db } from "./db";

/** Email+password login for local dev and e2e only; never in production. */
export const devLoginEnabled = env.AUTH_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
export const googleLoginEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** "Johans Neira" / "johans.neira@x" -> a free handle like "johans-neira" or "johans-neira-2". */
async function uniqueHandle(seed: string): Promise<string> {
  const base =
    seed
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "coleccionista";
  const taken = new Set(
    (
      await db
        .select({ handle: userTable.handle })
        .from(userTable)
        .where(like(userTable.handle, `${base}%`))
    ).map((row) => row.handle),
  );
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: userTable, session, account, verification },
  }),
  // Local dev and e2e run on arbitrary ports (Playwright uses PORT).
  trustedOrigins: devLoginEnabled ? ["http://localhost:*", "http://127.0.0.1:*"] : [],
  emailAndPassword: { enabled: devLoginEnabled, disableSignUp: true },
  socialProviders: googleLoginEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          prompt: "select_account",
        },
      }
    : {},
  user: {
    additionalFields: {
      handle: { type: "string", required: false, input: false },
      preferredCurrency: { type: "string", required: false, input: false, defaultValue: "usd" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({
          data: {
            ...newUser,
            handle: await uniqueHandle(newUser.name || newUser.email.split("@")[0] || ""),
          },
        }),
        // The owner's first sign-in adopts everything created before login
        // existed (owned by the placeholder DEV_USER_ID).
        after: async (created) => {
          if (!env.OWNER_EMAIL || created.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) {
            return;
          }
          await db.transaction(async (tx) => {
            await tx
              .update(binder)
              .set({ userId: created.id })
              .where(eq(binder.userId, DEV_USER_ID));
            await tx
              .update(cardInstance)
              .set({ userId: created.id })
              .where(eq(cardInstance.userId, DEV_USER_ID));
            await tx
              .update(artAsset)
              .set({ userId: created.id })
              .where(eq(artAsset.userId, DEV_USER_ID));
          });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

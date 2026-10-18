import { expect, test } from "@playwright/test";
import { createEmptyLayout } from "@sleevebook/binder-core";
import {
  account,
  binder,
  binderVersion,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  shareLink,
  user,
} from "@sleevebook/db";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const OTHER_ID = "e2e-auth-other-user";
const OTHER_EMAIL = "e2e-auth-other@sleevebook.local";
const OTHER_PASSWORD = "e2e-auth-other-password";
const SLUG = "e2e-auth-public-slug";
let binderId: string;

test.beforeAll(async () => {
  await ensureDevUser(db);
  const [row] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Auth Fixture Binder",
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "published",
    })
    .returning({ id: binder.id });
  binderId = (row as { id: string }).id;
  await db
    .insert(binderVersion)
    .values({ binderId, versionNumber: 1, layout: createEmptyLayout({ rows: 1, cols: 1 }, 1) });
  await db.insert(shareLink).values({ binderId, slug: SLUG, visibility: "unlisted" });

  await db.delete(user).where(eq(user.id, OTHER_ID));
  await db
    .insert(user)
    .values({ id: OTHER_ID, name: "Otra Persona", email: OTHER_EMAIL, handle: "e2e-auth-otra" });
  await db.insert(account).values({
    id: `${OTHER_ID}-credential`,
    userId: OTHER_ID,
    accountId: OTHER_ID,
    providerId: "credential",
    password: await hashPassword(OTHER_PASSWORD),
  });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(user).where(eq(user.id, OTHER_ID));
  await db.$client.end();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("owner pages redirect to /entrar and come back with ?next", async ({ page }) => {
    await page.goto("/binders");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fbinders$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

    await page.goto(`/binders/${binderId}/editar`);
    await expect(page).toHaveURL(
      new RegExp(`/entrar\\?next=${encodeURIComponent(`/binders/${binderId}/editar`)}`),
    );
  });

  test("owner route handlers answer 404", async ({ request }) => {
    expect((await request.get(`/binders/${binderId}/cara/S1-F/imagen`)).status()).toBe(404);
    expect((await request.get(`/binders/${binderId}/faltan/csv`)).status()).toBe(404);
  });

  test("public links stay open", async ({ page }) => {
    await page.goto(`/s/${SLUG}`);
    await expect(page.getByRole("heading", { name: "E2E Auth Fixture Binder" })).toBeVisible();
  });

  test("the dev login signs in and lands on ?next", async ({ page }) => {
    await page.goto("/entrar?next=/binders");
    await page.getByLabel("Correo").fill("dev@sleevebook.local");
    await page.getByLabel("Contraseña").fill(process.env.E2E_DEV_PASSWORD ?? "sleevebook-dev-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/binders$/);
  });

  test("?next only accepts same-site paths", async ({ page }) => {
    await page.goto("/entrar?next=//evil.example");
    await page.getByLabel("Correo").fill("dev@sleevebook.local");
    await page.getByLabel("Contraseña").fill(process.env.E2E_DEV_PASSWORD ?? "sleevebook-dev-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/binders$/);
  });
});

test.describe("another user", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("cannot see or act on someone else's binder", async ({ page, baseURL }) => {
    const signIn = await page.request.post("/api/auth/sign-in/email", {
      data: { email: OTHER_EMAIL, password: OTHER_PASSWORD },
      headers: { origin: baseURL ?? "" },
    });
    expect(signIn.ok()).toBe(true);

    for (const path of ["", "/editar", "/vender", "/imprimir"]) {
      const response = await page.goto(`/binders/${binderId}${path}`);
      expect(response?.status(), path).toBe(404);
    }
    expect((await page.request.get(`/binders/${binderId}/cara/S1-F/imagen`)).status()).toBe(404);

    await page.goto("/binders");
    await expect(page.getByText("E2E Auth Fixture Binder")).toHaveCount(0);
  });
});

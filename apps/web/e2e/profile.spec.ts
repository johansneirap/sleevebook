import { expect, test } from "@playwright/test";
import { createEmptyLayout } from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  profile,
  shareLink,
  user,
} from "@sleevebook/db";
import { eq, inArray } from "drizzle-orm";
import { createTestUser } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const OWNER_ID = "f4a-owner";
const OWNER_HANDLE = "f4a-owner";
const TAKEN_ID = "f4a-taken-user";
const TAKEN_HANDLE = "f4a-taken";
const PRIVATE_ID = "f4a-private";
const PRIVATE_HANDLE = "f4a-oculto";

const TEST_IDS = [OWNER_ID, TAKEN_ID, PRIVATE_ID];

let devOriginal: { name: string; handle: string; preferredCurrency: string };
let devProfileOriginal: typeof profile.$inferSelect | undefined;

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [devUser] = await db.select().from(user).where(eq(user.id, DEV_USER_ID));
  if (!devUser) {
    throw new Error("dev user missing");
  }
  devOriginal = {
    name: devUser.name,
    handle: devUser.handle,
    preferredCurrency: devUser.preferredCurrency,
  };
  const [devProfile] = await db.select().from(profile).where(eq(profile.userId, DEV_USER_ID));
  devProfileOriginal = devProfile;

  await db.delete(user).where(inArray(user.id, TEST_IDS));
  await createTestUser(db, {
    id: OWNER_ID,
    email: "f4a-owner@sleevebook.local",
    handle: OWNER_HANDLE,
    name: "F4A Dueña",
  });
  await createTestUser(db, {
    id: TAKEN_ID,
    email: "f4a-taken@sleevebook.local",
    handle: TAKEN_HANDLE,
    name: "F4A Tomada",
  });
  await createTestUser(db, {
    id: PRIVATE_ID,
    email: "f4a-private@sleevebook.local",
    handle: PRIVATE_HANDLE,
    name: "F4A Privada",
  });
  await db.insert(profile).values({ userId: PRIVATE_ID, isPublic: false });

  const binders = [
    { name: "F4A Binder Público", slug: "f4a-public", visibility: "public" },
    { name: "F4A Binder Oculto", slug: "f4a-unlisted", visibility: "unlisted" },
  ];
  for (const item of binders) {
    const [row] = await db
      .insert(binder)
      .values({
        userId: OWNER_ID,
        name: item.name,
        formatRows: 1,
        formatCols: 1,
        sheets: 1,
        status: "published",
      })
      .returning({ id: binder.id });
    const binderId = (row as { id: string }).id;
    await db
      .insert(binderVersion)
      .values({ binderId, versionNumber: 1, layout: createEmptyLayout({ rows: 1, cols: 1 }, 1) });
    await db.insert(shareLink).values({ binderId, slug: item.slug, visibility: item.visibility });
  }
});

test.afterAll(async () => {
  await db
    .update(user)
    .set({
      name: devOriginal.name,
      handle: devOriginal.handle,
      preferredCurrency: devOriginal.preferredCurrency,
    })
    .where(eq(user.id, DEV_USER_ID));
  if (devProfileOriginal) {
    const { userId, updatedAt, ...settings } = devProfileOriginal;
    await db
      .insert(profile)
      .values({ userId, ...settings, updatedAt })
      .onConflictDoUpdate({ target: profile.userId, set: { ...settings, updatedAt } });
  } else {
    await db.delete(profile).where(eq(profile.userId, DEV_USER_ID));
  }
  await db.delete(user).where(inArray(user.id, TEST_IDS));
  await db.$client.end();
});

test.describe("cuenta (signed in as the dev user)", () => {
  test("saves bio, WhatsApp and privacy, and they persist after reload", async ({ page }) => {
    await page.goto("/cuenta");
    await expect(page.getByRole("heading", { name: "Perfil", exact: true })).toBeVisible();

    await page.getByRole("textbox", { name: "Bio" }).fill("F4A bio de prueba");
    await page.getByLabel("WhatsApp").fill("+56 9 1234 5678");
    await page.getByRole("checkbox", { name: "Participar en intercambios" }).uncheck();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Bio" })).toHaveValue("F4A bio de prueba");
    await expect(page.getByLabel("WhatsApp")).toHaveValue("56912345678");
    await expect(
      page.getByRole("checkbox", { name: "Participar en intercambios" }),
    ).not.toBeChecked();
  });

  test("an invalid handle shows an inline error", async ({ page }) => {
    await page.goto("/cuenta");
    await page.getByLabel("Usuario").fill("A!");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(
      page.getByText("Usa de 3 a 24 letras minúsculas, números o guiones."),
    ).toBeVisible();
  });

  test("a handle taken by another user shows the taken error", async ({ page }) => {
    await page.goto("/cuenta");
    await page.getByLabel("Usuario").fill(TAKEN_HANDLE);
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Ese nombre de usuario ya está tomado")).toBeVisible();
  });
});

test.describe("public profiles", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/u/<handle> shows the public binder and not the unlisted one", async ({ page }) => {
    await page.goto(`/u/${OWNER_HANDLE}`);
    await expect(page.getByRole("heading", { name: "F4A Dueña", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "F4A Binder Público" })).toHaveAttribute(
      "href",
      "/s/f4a-public",
    );
    await expect(page.getByText("F4A Binder Oculto", { exact: true })).toHaveCount(0);
  });

  test("a private profile answers 404", async ({ page }) => {
    const response = await page.goto(`/u/${PRIVATE_HANDLE}`);
    expect(response?.status()).toBe(404);
  });

  test("/cuenta redirects signed-out visitors to /entrar", async ({ page }) => {
    await page.goto("/cuenta");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fcuenta$/);
  });
});

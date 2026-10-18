import { expect, test } from "@playwright/test";
import { createDb, DEV_USER_ID, ensureDevUser, notification, speciesFollow } from "@sleevebook/db";
import { and, eq, isNull, like } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Fixture prefix for this spec: every notification title starts with "F4F".
const PREFIX = "F4F";
const SPECIES = "Ditto Prueba";

let baselineUnread = 0;

async function unreadForDevUser(): Promise<number> {
  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(and(eq(notification.userId, DEV_USER_ID), isNull(notification.readAt)));
  return rows.length;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await ensureDevUser(db);
  await db
    .delete(notification)
    .where(and(eq(notification.userId, DEV_USER_ID), like(notification.title, `${PREFIX}%`)));
  await db
    .delete(speciesFollow)
    .where(and(eq(speciesFollow.userId, DEV_USER_ID), eq(speciesFollow.species, SPECIES)));
  baselineUnread = await unreadForDevUser();
  await db.insert(notification).values([
    {
      userId: DEV_USER_ID,
      kind: "precio",
      title: `${PREFIX} Lucario bajó a US$4.00`,
      body: "F4F Set de prueba · #1 · tu objetivo: US$5.00",
      href: "/deseos",
      data: { variantId: null, price: 4, target: 5 },
    },
    {
      userId: DEV_USER_ID,
      kind: "set-nuevo",
      title: `${PREFIX} Nuevo set: Prueba`,
      body: "1 carta de Lucario",
      href: "/avisos",
      data: { setId: null, species: ["Lucario"], count: 1 },
    },
  ]);
});

test.afterAll(async () => {
  await db
    .delete(notification)
    .where(and(eq(notification.userId, DEV_USER_ID), like(notification.title, `${PREFIX}%`)));
  await db
    .delete(speciesFollow)
    .where(and(eq(speciesFollow.userId, DEV_USER_ID), eq(speciesFollow.species, SPECIES)));
  await db.$client.end();
});

test("la campana muestra los avisos sin leer en la navegación", async ({ page }) => {
  await page.goto("/binders");
  await expect(
    page.getByRole("link", { name: `Avisos (${baselineUnread + 2} sin leer)`, exact: true }),
  ).toBeVisible();
});

test("/avisos lista los avisos con su tipo", async ({ page }) => {
  await page.goto("/avisos");
  await expect(page.getByRole("heading", { level: 1, name: "Avisos" })).toBeVisible();
  await expect(page.getByText(`${PREFIX} Lucario bajó a US$4.00`)).toBeVisible();
  await expect(page.getByText(`${PREFIX} Nuevo set: Prueba`)).toBeVisible();
  await expect(page.getByText("Precio", { exact: true })).toBeVisible();
  await expect(page.getByText("Set nuevo", { exact: true })).toBeVisible();
});

test("Marcar todo como leído limpia el contador", async ({ page }) => {
  await page.goto("/avisos");
  await page.getByRole("button", { name: "Marcar todo como leído", exact: true }).click();
  await expect(page.getByRole("link", { name: "Avisos", exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Avisos (${baselineUnread + 2} sin leer)`, exact: true }),
  ).toHaveCount(0);
});

test("sigue una especie y la quita", async ({ page }) => {
  await page.goto("/avisos");

  // Must start with a letter (digits are fine after it, e.g. Porygon2).
  await page.getByLabel("Agregar especie").fill("2F4F Pikachu");
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect(page.getByText("Usa solo letras", { exact: false })).toBeVisible();

  await page.getByLabel("Agregar especie").fill(SPECIES);
  await page.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect(page.getByText(SPECIES, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: `Dejar de seguir ${SPECIES}`, exact: true }).click();
  await expect(page.getByText(SPECIES, { exact: true })).toHaveCount(0);
});

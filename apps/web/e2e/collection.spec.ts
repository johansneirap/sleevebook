import { expect, test } from "@playwright/test";
import { formatPocketCode, layoutSchema } from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  card,
  cardInstance,
  cardVariant,
  createDb,
  ensureDevUser,
  game,
  set,
  user,
} from "@sleevebook/db";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, signInAs, TEST_USER_PASSWORD } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Every fixture name starts with F5C so the shared dev DB stays clean.
const POCKET = formatPocketCode({ sheet: 1, side: "F", index: 1 });

let gameId: string;
let setId: string;
let alfaVariantId: string;
let betaVariantId: string;
let binderId: string;

async function addCard(name: string, number: string): Promise<string> {
  const [cardRow] = await db
    .insert(card)
    .values({ setId, number, name, supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId: (cardRow as { id: string }).id, variant: "normal" })
    .returning({ id: cardVariant.id });
  return (variantRow as { id: string }).id;
}

/** Opens "Agregar copias", searches the fixture card and picks it. */
async function openAddDialogFor(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "+ Agregar copias" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const result = dialog.getByRole("button", { name: new RegExp(name) });
  // The search is debounced and its server action may still be compiling on a
  // cold dev server: retype until the result shows up.
  await expect(async () => {
    await dialog.getByLabel("Busca la carta por nombre").fill(name);
    await expect(result).toBeVisible({ timeout: 5_000 });
  })
    .toPass({ timeout: 60_000 })
    .catch(async (error) => {
      // TEMP: CI-only failure, show what the dialog rendered.
      console.log("DIALOG TEXT:", await dialog.innerText());
      throw error;
    });
  await result.click();
  return dialog;
}

// Fixtures are shared by every describe below, so the file runs in order.
test.describe.configure({ mode: "serial" });

const OWNER_ID = "e2e-collection-owner";
const OWNER_EMAIL = "e2e-collection-owner@sleevebook.local";

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F5C Collection Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F5C Collection Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  alfaVariantId = await addCard("F5C Alfa", "1");
  betaVariantId = await addCard("F5C Beta", "2");
});

test.afterAll(async () => {
  // The owner of the "crear desde binders" test cascades to its binder and copies.
  await db
    .delete(cardInstance)
    .where(inArray(cardInstance.variantId, [alfaVariantId, betaVariantId]));
  if (binderId) {
    await db.delete(binder).where(eq(binder.id, binderId));
  }
  await db.delete(cardVariant).where(inArray(cardVariant.id, [alfaVariantId, betaVariantId]));
  await db.delete(card).where(eq(card.setId, setId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.delete(user).where(eq(user.id, OWNER_ID));
  await db.$client.end();
});

test.describe
  .serial("Mi colección", () => {
    test("agrega copias JP y LP desde el diálogo", async ({ page }) => {
      // First call of the search action compiles it on a cold CI dev server.
      test.setTimeout(120_000);
      await page.goto("/coleccion");
      await expect(page.getByRole("heading", { name: "Mi colección" })).toBeVisible();
      // The dialog only works once React has hydrated the page.
      await page.waitForLoadState("networkidle");

      // Two identical Japanese copies: one row with a "×2" counter.
      let dialog = await openAddDialogFor(page, "F5C Alfa");
      await dialog.getByLabel(/^Cantidad/).fill("2");
      await dialog.getByLabel(/^Idioma/).selectOption("ja");
      await dialog.getByRole("button", { name: "Agregar copias", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // A worn English copy, kept as its own row.
      dialog = await openAddDialogFor(page, "F5C Alfa");
      await dialog.getByLabel(/^Condición/).selectOption("LP");
      await dialog.getByRole("button", { name: "Agregar copias", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      const jpRow = page.locator(".sb-col-row", { hasText: "F5C Alfa" }).filter({ hasText: "JP" });
      await expect(jpRow).toHaveCount(1);
      await expect(jpRow.locator(".sb-col-lang")).toHaveText("JP");
      await expect(jpRow.locator(".sb-col-count")).toHaveText("×2");

      const lpRow = page
        .locator(".sb-col-row", { hasText: "F5C Alfa" })
        .filter({ hasText: "Poco jugada (LP)" });
      await expect(lpRow).toHaveCount(1);
      await expect(lpRow.locator(".sb-col-lang")).toHaveText("EN");
    });

    test("edita una copia a PSA 10 y muestra el badge", async ({ page }) => {
      await page.goto("/coleccion");
      const lpRow = page
        .locator(".sb-col-row", { hasText: "F5C Alfa" })
        .filter({ hasText: "Poco jugada (LP)" });
      await lpRow.getByRole("button", { name: "Editar", exact: true }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByLabel(/^Empresa/).selectOption("PSA");
      await dialog.getByLabel("Nota del gradeo").selectOption("10");
      await dialog.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      const gradedRow = page
        .locator(".sb-col-row", { hasText: "F5C Alfa" })
        .filter({ hasText: "PSA 10" });
      await expect(gradedRow).toHaveCount(1);
      await expect(gradedRow.getByText("sin precio")).toBeVisible();
    });

    test("elimina una copia con confirmación en línea", async ({ page }) => {
      await page.goto("/coleccion");
      const gradedRow = page
        .locator(".sb-col-row", { hasText: "F5C Alfa" })
        .filter({ hasText: "PSA 10" });
      await gradedRow.getByRole("button", { name: "Eliminar", exact: true }).click();
      await gradedRow.getByRole("button", { name: "Sí, eliminar" }).click();
      await expect(gradedRow).toHaveCount(0);
      await expect(page.locator(".sb-col-row", { hasText: "F5C Alfa" })).toHaveCount(1);
    });

    test("exporta CSV con las copias", async ({ page }) => {
      await page.goto("/coleccion");
      const link = page.getByRole("link", { name: "Exportar CSV" });
      await expect(link).toHaveAttribute("href", "/coleccion/exportar");

      const response = await page.request.get("/coleccion/exportar");
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/csv");
      const csv = await response.text();
      const [header, ...lines] = csv.replace(/^﻿/, "").trim().split(/\r\n/);
      expect(header).toBe(
        "set,numero,nombre,variante,idioma,condicion,gradeo,precio_compra,moneda_compra,valor_usd_estimado,ubicacion,notas",
      );
      const alfaLines = lines.filter((line) => line.includes("F5C Alfa"));
      expect(alfaLines).toHaveLength(2);
      expect(alfaLines.some((line) => line.includes(",ja,NM,"))).toBe(true);
      expect(alfaLines.every((line) => line.includes(",ja,NM,"))).toBe(true);
    });
  });

// "Crear copias desde mis binders" acts on every binder of the user, so it
// runs as its own user: as the dev user it would also create copies for the
// fixture binders of specs running in parallel.
test.describe("crear copias desde mis binders", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeAll(async () => {
    await createTestUser(db, { id: OWNER_ID, email: OWNER_EMAIL, handle: "e2e-coleccion" });
  });

  test("crea copias para las cartas de mis binders sin copia", async ({ page, baseURL }) => {
    await signInAs(page.request, baseURL ?? "", OWNER_EMAIL, TEST_USER_PASSWORD);
    const [binderRow] = await db
      .insert(binder)
      .values({
        userId: OWNER_ID,
        name: "F5C Coleccion Binder",
        formatRows: 1,
        formatCols: 1,
        sheets: 1,
        status: "published",
      })
      .returning({ id: binder.id });
    binderId = (binderRow as { id: string }).id;
    await db.insert(binderVersion).values({
      binderId,
      versionNumber: 1,
      layout: layoutSchema.parse({
        format: { rows: 1, cols: 1 },
        opening: "side",
        sheets: 1,
        theme: { preset: "default", sleeve: "clear" },
        pockets: { [POCKET]: { kind: "card", variant: betaVariantId, instance: null } },
      }),
    });

    await page.goto("/coleccion");
    // With no copies yet the empty state offers the same button as the callout.
    await page.getByRole("button", { name: "Crear copias desde mis binders" }).click();
    await expect(page.getByText(/Creamos \d+ cop/)).toBeVisible();

    const betaRow = page.locator(".sb-col-row", { hasText: "F5C Beta" });
    await expect(betaRow).toHaveCount(1);
    await expect(betaRow.getByText("En F5C Coleccion Binder")).toBeVisible();
    await expect(betaRow.locator(".sb-col-lang")).toHaveText("EN");
    await expect(betaRow.getByText("Casi nueva (NM)")).toBeVisible();
  });
});

test.describe("Mi colección en el móvil", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("cabe en 390px y está en la barra inferior", async ({ page }) => {
    await page.goto("/coleccion");
    await expect(page.getByRole("heading", { name: "Mi colección" })).toBeVisible();
    const tabBar = page.getByRole("navigation", { name: "Navegación inferior" });
    await expect(tabBar.getByRole("link", { name: "Colección" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

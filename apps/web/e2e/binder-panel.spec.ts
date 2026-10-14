import { expect, test } from "@playwright/test";
import { layoutSchema } from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  card,
  cardVariant,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  game,
  set,
} from "@sleevebook/db";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
let binderId: string;

const TEST_ASSET_URL = "https://images.pokemontcg.io/swsh8/1_hires.png";

// 3x3, 1 sheet (9 pockets). S1·F·9 holds a real card so panel placement
// tests can exercise "won't overwrite occupied pockets"; the rest start
// empty, free for panels.
function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 3, cols: 3 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·9: { kind: "card", variant: variantId, instance: null },
    },
  });
}

async function resetLayout() {
  await db
    .update(binderVersion)
    .set({ layout: initialLayout() })
    .where(eq(binderVersion.binderId, binderId));
}

async function readLayout() {
  const [row] = await db.select().from(binderVersion).where(eq(binderVersion.binderId, binderId));
  return layoutSchema.parse(row?.layout);
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Panel Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Panel Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "1", name: "E2E Panel Card", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Panel Fixture Binder",
      formatRows: 3,
      formatCols: 3,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: initialLayout() });
});

test.beforeEach(async () => {
  await resetLayout();
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

async function openPanelForm(page: import("@playwright/test").Page) {
  await page.getByText("Paneles de arte", { exact: true }).click();
  await page.getByLabel("URL de la imagen del panel").fill(TEST_ASSET_URL);
}

test("adding a 2x2 panel covers the anchor and the other 3 pockets", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await openPanelForm(page);
  await page.getByLabel("Bolsillo de anclaje del panel").fill("S1·F·1");
  await page.getByLabel("Filas del panel").fill("2");
  await page.getByLabel("Columnas del panel").fill("2");
  await page.getByRole("button", { name: "Agregar panel" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.panels).toHaveLength(1);
    const panelId = layout.panels[0]?.id;
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "panel", panelId });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "panel", panelId });
    expect(layout.pockets["S1·F·4"]).toEqual({ kind: "panel", panelId });
    expect(layout.pockets["S1·F·5"]).toEqual({ kind: "panel", panelId });
    expect(layout.pockets["S1·F·3"]).toBeUndefined();
  }).toPass();
});

test("refuses to place a panel over an occupied pocket", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await openPanelForm(page);
  await page.getByLabel("Bolsillo de anclaje del panel").fill("S1·F·8");
  await page.getByLabel("Filas del panel").fill("1");
  await page.getByLabel("Columnas del panel").fill("2");
  await page.getByRole("button", { name: "Agregar panel" }).click();

  await expect(page.getByText(/ya tiene contenido/)).toBeVisible();
  const layout = await readLayout();
  expect(layout.panels).toHaveLength(0);
});

test("refuses a panel that runs off the side", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await openPanelForm(page);
  await page.getByLabel("Bolsillo de anclaje del panel").fill("S1·F·3");
  await page.getByLabel("Filas del panel").fill("1");
  await page.getByLabel("Columnas del panel").fill("2");
  await page.getByRole("button", { name: "Agregar panel" }).click();

  await expect(page.getByText(/no entra en esa posición/)).toBeVisible();
  const layout = await readLayout();
  expect(layout.panels).toHaveLength(0);
});

test("removing a panel frees its pockets back to empty", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await openPanelForm(page);
  await page.getByLabel("Bolsillo de anclaje del panel").fill("S1·F·1");
  await page.getByLabel("Filas del panel").fill("1");
  await page.getByLabel("Columnas del panel").fill("1");
  await page.getByRole("button", { name: "Agregar panel" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.panels).toHaveLength(1);
  }).toPass();

  await page.getByRole("button", { name: "Quitar panel" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.panels).toHaveLength(0);
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "empty" });
  }).toPass();
});

test("sorting the binder leaves a panel's pockets untouched", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await openPanelForm(page);
  await page.getByLabel("Bolsillo de anclaje del panel").fill("S1·F·1");
  await page.getByLabel("Filas del panel").fill("1");
  await page.getByLabel("Columnas del panel").fill("1");
  await page.getByRole("button", { name: "Agregar panel" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.panels).toHaveLength(1);
  }).toPass();
  const panelId = (await readLayout()).panels[0]?.id;

  await page.getByText("Reordenar binder", { exact: true }).click();
  await page.getByLabel("Criterio 1: campo").selectOption("number");
  await page.getByRole("button", { name: "Aplicar orden" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "panel", panelId });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "card", variant: variantId, instance: null });
  }).toPass();
});

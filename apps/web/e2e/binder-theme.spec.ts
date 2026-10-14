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

function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantId, instance: null },
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
    .values({ name: "E2E Theme Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Theme Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "E2E Theme Card",
      supertype: "Pokémon",
      language: "en",
    })
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
      name: "E2E Theme Fixture Binder",
      formatRows: 1,
      formatCols: 1,
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

test("saving a theme persists preset, sleeve and a custom background", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Tema", { exact: true }).click();
  await page.getByLabel("Preset de tema").selectOption("oscuro");
  await page.getByLabel("Textura de funda").selectOption("none");
  await page.getByLabel("Color de fondo personalizado").fill("#112233");
  await page.getByRole("button", { name: "Guardar tema" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.theme).toEqual({ preset: "oscuro", sleeve: "none", bg: "#112233" });
  }).toPass();
});

test("the saved theme's background renders on the viewer page", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Tema", { exact: true }).click();
  await page.getByLabel("Preset de tema").selectOption("oscuro");
  await page.getByRole("button", { name: "Guardar tema" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.theme.preset).toBe("oscuro");
  }).toPass();

  await page.goto(`/binders/${binderId}`);
  await expect(page.locator("main").first()).toHaveCSS("background-color", "rgb(20, 22, 26)");
});

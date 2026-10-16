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

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Card Focus Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Card Focus Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "E2E Focus Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "holo" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const layout = layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantId, instance: null },
    },
  });

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Card Focus Fixture Binder",
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

const CARD_NAME = /E2E Focus Card/;
const DIALOG_NAME = "E2E Card Focus Fixture Set — E2E Focus Card 1 (holo)";

async function openFocusedCard(page: import("@playwright/test").Page) {
  await page.goto(`/binders/${binderId}?spread=0`);
  await page.getByRole("button", { name: CARD_NAME }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("focused-card")).toBeVisible();
  await expect(page.getByText(DIALOG_NAME)).toBeVisible();
  return dialog;
}

test.describe("card focus (animated)", () => {
  test("clicking a card opens a focused dialog, Escape closes it", async ({ page }) => {
    await openFocusedCard(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("focused-card")).toHaveCount(0);
  });

  test("clicking the backdrop closes the focused dialog", async ({ page }) => {
    await openFocusedCard(page);

    // The centered card sits above the backdrop, so click a corner.
    await page
      .getByRole("button", { name: "Cerrar vista de carta" })
      .click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("card focus (reduced motion)", () => {
  test.use({ reducedMotion: "reduce" });

  test("opens and closes with a plain fade", async ({ page }) => {
    await openFocusedCard(page);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

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
  // /binders lists DEV_USER_ID's binders, so the fixture must own this user
  // too -- never delete it in afterAll, it's shared with real local data.
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "1", name: "E2E Test Card", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const layout = layoutSchema.parse({
    format: { rows: 3, cols: 3 },
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
      name: "E2E Fixture Binder",
      formatRows: 3,
      formatCols: 3,
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

test("binders list shows the fixture binder", async ({ page }) => {
  await page.goto("/binders");
  await expect(page.getByText("E2E Fixture Binder")).toBeVisible();
});

test("viewer renders the first spread with the fixture card", async ({ page }) => {
  await page.goto(`/binders/${binderId}`);
  await expect(page.getByRole("heading", { name: "E2E Fixture Binder" })).toBeVisible();
  await expect(page.getByText("Hoja 1 · Frente")).toBeVisible();
  await expect(page.getByText("E2E Test Card 1")).toBeVisible();
  await expect(page.getByText("Spread 1 / 2")).toBeVisible();
});

test("viewer navigates to the next (and last) spread", async ({ page }) => {
  await page.goto(`/binders/${binderId}`);
  await page.getByRole("link", { name: /Siguiente/ }).click();
  await expect(page.getByText("Hoja 1 · Reverso")).toBeVisible();
  await expect(page.getByText("Spread 2 / 2")).toBeVisible();
});

test("viewer 404s on an unknown binder id", async ({ page }) => {
  const response = await page.goto("/binders/00000000-0000-0000-0000-000000000000");
  expect(response?.status()).toBe(404);
});

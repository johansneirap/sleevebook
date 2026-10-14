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
    .values({ name: "E2E Editor Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Editor Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "7",
      name: "E2E Editor Searchable Card",
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

  const layout = layoutSchema.parse({
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {},
  });

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Editor Fixture Binder",
      formatRows: 2,
      formatCols: 2,
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

test("assigns a card to an empty pocket via search, then clears it", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await expect(page.getByRole("heading", { name: /E2E Editor Fixture Binder/ })).toBeVisible();

  await page.getByRole("button", { name: "S1·F·1" }).click();
  await expect(page.getByText("Editando")).toContainText("S1·F·1");

  await page.getByPlaceholder("Buscar carta por nombre...").fill("E2E Editor Searchable");
  await expect(page.getByText(/E2E Editor Searchable Card 7/)).toBeVisible();

  await page
    .getByRole("listitem")
    .filter({ hasText: "E2E Editor Searchable Card" })
    .getByRole("button", { name: "Usar como carta" })
    .click();

  await expect(page.getByRole("button", { name: /E2E Editor Searchable Card 7/ })).toBeVisible();

  const [afterAssign] = await db
    .select()
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId));
  const assignedLayout = layoutSchema.parse(afterAssign?.layout);
  expect(assignedLayout.pockets["S1·F·1"]).toEqual({
    kind: "card",
    variant: variantId,
    instance: null,
  });

  await page.getByRole("button", { name: /E2E Editor Searchable Card 7/ }).click();
  await page.getByRole("button", { name: "Vaciar" }).click();

  await expect(page.getByRole("button", { name: "S1·F·1" })).toBeVisible();

  const [afterClear] = await db
    .select()
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId));
  const clearedLayout = layoutSchema.parse(afterClear?.layout);
  expect(clearedLayout.pockets["S1·F·1"]).toEqual({ kind: "empty" });
});

test("assigns a placeholder pointing at a target card", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);

  await page.getByRole("button", { name: "S1·F·2" }).click();
  await page.getByPlaceholder("Buscar carta por nombre...").fill("E2E Editor Searchable");
  await page
    .getByRole("listitem")
    .filter({ hasText: "E2E Editor Searchable Card" })
    .getByRole("button", { name: "Usar como placeholder" })
    .click();

  await expect(page.getByRole("button", { name: /E2E Editor Searchable Card 7/ })).toBeVisible();

  const [row] = await db.select().from(binderVersion).where(eq(binderVersion.binderId, binderId));
  const layout = layoutSchema.parse(row?.layout);
  expect(layout.pockets["S1·F·2"]).toEqual({
    kind: "placeholder",
    variant: variantId,
    style: "ficha",
  });
});

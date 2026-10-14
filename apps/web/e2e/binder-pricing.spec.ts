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
  goal,
  pricePoint,
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
let cardPriceyId: string;
let cardBudgetId: string;
let cardVeryExpensiveId: string;
let variantPriceyId: string;
let variantBudgetId: string;
let variantVeryExpensiveId: string;
let goalId: string;
let binderId: string;

function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantPriceyId, instance: null },
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
    .values({ name: "E2E Pricing Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Pricing Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [priceyCard] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "E2E Pricey Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardPriceyId = (priceyCard as { id: string }).id;
  const [priceyVariant] = await db
    .insert(cardVariant)
    .values({ cardId: cardPriceyId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantPriceyId = (priceyVariant as { id: string }).id;

  const [budgetCard] = await db
    .insert(card)
    .values({
      setId,
      number: "2",
      name: "E2E Budget Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardBudgetId = (budgetCard as { id: string }).id;
  const [budgetVariant] = await db
    .insert(cardVariant)
    .values({ cardId: cardBudgetId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantBudgetId = (budgetVariant as { id: string }).id;

  const [veryExpensiveCard] = await db
    .insert(card)
    .values({
      setId,
      number: "3",
      name: "E2E Very Expensive Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardVeryExpensiveId = (veryExpensiveCard as { id: string }).id;
  const [veryExpensiveVariant] = await db
    .insert(cardVariant)
    .values({ cardId: cardVeryExpensiveId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantVeryExpensiveId = (veryExpensiveVariant as { id: string }).id;

  await db.insert(pricePoint).values([
    { variantId: variantPriceyId, source: "tcgplayer", currency: "USD", amount: "50.00" },
    { variantId: variantBudgetId, source: "tcgplayer", currency: "USD", amount: "5.00" },
    { variantId: variantVeryExpensiveId, source: "tcgplayer", currency: "USD", amount: "20.00" },
  ]);

  const [goalRow] = await db
    .insert(goal)
    .values({
      type: "custom",
      rules: {},
      variantIds: [variantPriceyId, variantBudgetId, variantVeryExpensiveId],
    })
    .returning({ id: goal.id });
  goalId = (goalRow as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Pricing Fixture Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      goalId,
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
  await db.delete(goal).where(eq(goal.id, goalId));
  await db.delete(pricePoint).where(eq(pricePoint.variantId, variantPriceyId));
  await db.delete(pricePoint).where(eq(pricePoint.variantId, variantBudgetId));
  await db.delete(pricePoint).where(eq(pricePoint.variantId, variantVeryExpensiveId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantPriceyId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantBudgetId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantVeryExpensiveId));
  await db.delete(card).where(eq(card.id, cardPriceyId));
  await db.delete(card).where(eq(card.id, cardBudgetId));
  await db.delete(card).where(eq(card.id, cardVeryExpensiveId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("viewer shows the total value of the owned cards only", async ({ page }) => {
  await page.goto(`/binders/${binderId}`);
  await expect(page.getByText("Valor total: $50.00 USD")).toBeVisible();
});

test("missing-cards page shows objective/missing totals sorted by price descending", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/faltan`);
  await expect(
    page.getByText("Valor del objetivo: $75.00 USD — Valor de lo que falta: $25.00 USD"),
  ).toBeVisible();

  const items = page.locator("li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Very Expensive Card");
  await expect(items.nth(0)).toContainText("$20.00 USD");
  await expect(items.nth(1)).toContainText("Budget Card");
  await expect(items.nth(1)).toContainText("$5.00 USD");
});

test("a manual price override replaces the market price in the binder total", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByRole("button", { name: /E2E Pricey Card/ }).click();
  await expect(page.getByText("Valor total del binder: $50.00 USD")).toBeVisible();
  await expect(page.getByText("Precio de mercado: $50.00 USD")).toBeVisible();

  await page.getByLabel("Precio propio en dólares").fill("30");
  await page.getByRole("button", { name: "Guardar precio propio" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantPriceyId,
      instance: null,
      priceOverrideUsd: 30,
    });
  }).toPass();
  await expect(page.getByText("Valor total del binder: $30.00 USD")).toBeVisible();

  await page.getByRole("button", { name: "Quitar precio propio" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantPriceyId,
      instance: null,
    });
  }).toPass();
  await expect(page.getByText("Valor total del binder: $50.00 USD")).toBeVisible();
});

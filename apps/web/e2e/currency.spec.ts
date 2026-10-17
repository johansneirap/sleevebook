import { expect, test } from "@playwright/test";
import { formatMoney, layoutSchema } from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  card,
  cardVariant,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  exchangeRate,
  game,
  goal,
  pricePoint,
  set,
} from "@sleevebook/db";
import { desc, eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Other agents may insert CLP rates too, and getExchangeRates takes the latest one,
// so the expected amounts are derived from whatever CLP rate is newest at test time.
let gameId: string;
let setId: string;
let cardId: string;
let ownedVariantId: string;
let holoVariantId: string;
let reverseVariantId: string;
let goalId: string;
let binderId: string;
let rateId: string;

const OWNED_USD = 5;
const HOLO_USD = 10;
const REVERSE_USD = 30;

async function latestClpRate(): Promise<number> {
  const [row] = await db
    .select({ rate: exchangeRate.rate })
    .from(exchangeRate)
    .where(eq(exchangeRate.quote, "clp"))
    .orderBy(desc(exchangeRate.capturedAt))
    .limit(1);
  if (!row) {
    throw new Error("no CLP rate in the database");
  }
  return Number(row.rate);
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F3F Currency Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F3F Currency Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "F3F Currency Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [ownedRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  ownedVariantId = (ownedRow as { id: string }).id;

  const [holoRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "holo" })
    .returning({ id: cardVariant.id });
  holoVariantId = (holoRow as { id: string }).id;

  const [reverseRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "reverse" })
    .returning({ id: cardVariant.id });
  reverseVariantId = (reverseRow as { id: string }).id;

  await db.insert(pricePoint).values([
    { variantId: ownedVariantId, source: "tcgplayer", currency: "USD", amount: String(OWNED_USD) },
    { variantId: holoVariantId, source: "tcgplayer", currency: "USD", amount: String(HOLO_USD) },
    {
      variantId: reverseVariantId,
      source: "tcgplayer",
      currency: "USD",
      amount: String(REVERSE_USD),
    },
  ]);

  // Our own CLP rate, captured now: it is the newest one unless another agent inserts later.
  const [rateRow] = await db
    .insert(exchangeRate)
    .values({ base: "usd", quote: "clp", rate: "950.250000", source: "e2e-fixture" })
    .returning({ id: exchangeRate.id });
  rateId = (rateRow as { id: string }).id;

  const [goalRow] = await db
    .insert(goal)
    .values({
      type: "master-set",
      rules: {},
      variantIds: [ownedVariantId, holoVariantId, reverseVariantId],
    })
    .returning({ id: goal.id });
  goalId = (goalRow as { id: string }).id;

  const layout = layoutSchema.parse({
    format: { rows: 3, cols: 3 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: ownedVariantId, instance: null },
    },
  });

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F3F Currency Binder",
      formatRows: 3,
      formatCols: 3,
      sheets: 1,
      goalId,
      status: "draft",
      currency: "clp",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(goal).where(eq(goal.id, goalId));
  await db.delete(exchangeRate).where(eq(exchangeRate.id, rateId));
  await db.delete(cardVariant).where(eq(cardVariant.id, ownedVariantId));
  await db.delete(cardVariant).where(eq(cardVariant.id, holoVariantId));
  await db.delete(cardVariant).where(eq(cardVariant.id, reverseVariantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("viewer shows the total value in the binder currency", async ({ page }) => {
  const rate = await latestClpRate();
  const expected = formatMoney(OWNED_USD * rate, "clp");

  await page.goto(`/binders/${binderId}`);
  await expect(page.getByText(`Valor total: ${expected}`)).toBeVisible();
  await expect(page.getByText(/tipo de cambio al /)).toBeVisible();
});

test("missing-cards page shows prices in the binder currency", async ({ page }) => {
  const rate = await latestClpRate();
  const holo = formatMoney(HOLO_USD * rate, "clp");
  const reverse = formatMoney(REVERSE_USD * rate, "clp");

  await page.goto(`/binders/${binderId}/faltan`);
  await expect(page.getByRole("heading", { name: "Me faltan (2)" })).toBeVisible();
  await expect(page.locator("li").nth(0)).toContainText(reverse);
  await expect(page.locator("li").nth(1)).toContainText(holo);
  await expect(page.getByText(/tipo de cambio al /)).toBeVisible();
});

test("?orden=precio-desc and ?orden=precio-asc order the missing cards by price", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/faltan?orden=precio-desc`);
  await expect(page.locator("li").nth(0)).toContainText("reverse");
  await expect(page.locator("li").nth(1)).toContainText("holo");

  await page.goto(`/binders/${binderId}/faltan?orden=precio-asc`);
  await expect(page.locator("li").nth(0)).toContainText("holo");
  await expect(page.locator("li").nth(1)).toContainText("reverse");
});

test("CSV export returns UTF-8 with BOM, the header row and the card rows", async ({ request }) => {
  const rate = await latestClpRate();

  const response = await request.get(`/binders/${binderId}/faltan/csv?orden=precio-desc`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/csv/);

  const bytes = await response.body();
  expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

  const lines = bytes.subarray(3).toString("utf8").split("\r\n").filter(Boolean);
  expect(lines[0]).toBe("name,set,number,variant,price,currency");
  expect(lines[1]).toBe(
    `F3F Currency Card,F3F Currency Set,1,reverse,${(REVERSE_USD * rate).toFixed(0)},CLP`,
  );
  expect(lines[2]).toBe(
    `F3F Currency Card,F3F Currency Set,1,holo,${(HOLO_USD * rate).toFixed(0)},CLP`,
  );
});

test("CSV export 404s on an unknown binder", async ({ request }) => {
  const response = await request.get("/binders/00000000-0000-0000-0000-000000000000/faltan/csv");
  expect(response.status()).toBe(404);
});

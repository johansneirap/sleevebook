import { expect, test } from "@playwright/test";
import {
  card,
  cardVariant,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  game,
  pricePoint,
  set,
  wishlistItem,
} from "@sleevebook/db";
import { and, eq, inArray } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Every fixture name starts with F5E so the shared dev DB stays clean.
const HOUR = 60 * 60 * 1000;

let gameId: string;
let setId: string;
// Has a USD market price (older) and a NEWER Cardmarket EUR average.
let mixedId: string;
// Has only a Cardmarket EUR average.
let eurOnlyId: string;
const variantIds: string[] = [];

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

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F5E EUR Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F5E EUR Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  mixedId = await addCard("F5E Mixto", "1");
  eurOnlyId = await addCard("F5E Solo Euro", "2");
  variantIds.push(mixedId, eurOnlyId);

  // Stored like the prices job stores them: TCGplayer USD (older, upper-case
  // currency as in older rows) and a newer Cardmarket EUR average.
  await db.insert(pricePoint).values([
    {
      variantId: mixedId,
      source: "tcgplayer",
      currency: "USD",
      amount: "2.00",
      capturedAt: new Date(Date.now() - HOUR),
    },
    {
      variantId: mixedId,
      source: "cardmarket",
      currency: "eur",
      amount: "12.30",
      capturedAt: new Date(),
    },
    {
      variantId: eurOnlyId,
      source: "cardmarket",
      currency: "eur",
      amount: "7.50",
      capturedAt: new Date(),
    },
  ]);

  await db.insert(wishlistItem).values([
    { userId: DEV_USER_ID, variantId: mixedId },
    { userId: DEV_USER_ID, variantId: eurOnlyId },
  ]);
});

test.afterAll(async () => {
  await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.userId, DEV_USER_ID), inArray(wishlistItem.variantId, variantIds)));
  await db.delete(pricePoint).where(inArray(pricePoint.variantId, variantIds));
  await db.delete(cardVariant).where(inArray(cardVariant.id, variantIds));
  await db.delete(card).where(eq(card.setId, setId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("the wishlist keeps the USD price and shows Cardmarket EUR as a second line", async ({
  page,
}) => {
  await page.goto("/deseos");
  const mixed = page
    .getByRole("region", { name: "Cartas en mis deseos" })
    .getByRole("listitem")
    .filter({ hasText: "F5E Mixto" });

  await expect(mixed).toBeVisible();
  // The newer EUR row must not replace the USD value.
  await expect(mixed).toContainText("$2.00");
  await expect(mixed).not.toContainText("$12");
  await expect(mixed.getByTestId("wishlist-cardmarket")).toHaveText("Cardmarket: 12,30 €");
});

test("a card with only a Cardmarket price shows sin precio and the EUR line", async ({ page }) => {
  await page.goto("/deseos");
  const eurOnly = page
    .getByRole("region", { name: "Cartas en mis deseos" })
    .getByRole("listitem")
    .filter({ hasText: "F5E Solo Euro" });

  await expect(eurOnly).toContainText("sin precio");
  await expect(eurOnly.getByTestId("wishlist-cardmarket")).toHaveText("Cardmarket: 7,50 €");
});

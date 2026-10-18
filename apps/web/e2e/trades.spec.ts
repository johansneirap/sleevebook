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
  pricePoint,
  profile,
  set,
  user,
  wishlistItem,
} from "@sleevebook/db";
import { eq, inArray } from "drizzle-orm";
import { createTestUser, signInAs, TEST_USER_PASSWORD } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const ANA_ID = "f4c-ana";
const ANA_EMAIL = "f4c-ana@sleevebook.local";
const BEA_ID = "f4c-bea";
const BEA_EMAIL = "f4c-bea@sleevebook.local";

const CARD_X = "F4C Carta X";
const CARD_Y = "F4C Carta Y";

const gameIds: string[] = [];
const setIds: string[] = [];
const cardIds: string[] = [];
const variantIds: string[] = [];
const binderIds: string[] = [];
let variantX = "";
let variantY = "";

function layoutWith(variant: string, count: number) {
  return layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant, instance: null, count },
    },
  });
}

async function insertBinder(userId: string, name: string, variant: string, count: number) {
  const [row] = await db
    .insert(binder)
    .values({ userId, name, formatRows: 1, formatCols: 1, sheets: 1, status: "draft" })
    .returning({ id: binder.id });
  const binderId = (row as { id: string }).id;
  binderIds.push(binderId);
  await db.insert(binderVersion).values({
    binderId,
    versionNumber: 1,
    layout: layoutWith(variant, count),
  });
  return binderId;
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F4C Trades Fixture Game" })
    .returning({ id: game.id });
  gameIds.push((gameRow as { id: string }).id);

  const [setRow] = await db
    .insert(set)
    .values({ gameId: gameIds[0] as string, name: "F4C Trades Fixture Set", language: "en" })
    .returning({ id: set.id });
  setIds.push((setRow as { id: string }).id);

  for (const [number, name] of [
    ["1", CARD_X],
    ["2", CARD_Y],
  ] as const) {
    const [cardRow] = await db
      .insert(card)
      .values({
        setId: setIds[0] as string,
        number,
        name,
        supertype: "Pokémon",
        language: "en",
      })
      .returning({ id: card.id });
    const cardId = (cardRow as { id: string }).id;
    cardIds.push(cardId);
    const [variantRow] = await db
      .insert(cardVariant)
      .values({ cardId, variant: "normal" })
      .returning({ id: cardVariant.id });
    variantIds.push((variantRow as { id: string }).id);
  }
  variantX = variantIds[0] as string;
  variantY = variantIds[1] as string;

  // A known price for X, so the card shows a market price.
  await db
    .insert(pricePoint)
    .values({ variantId: variantX, source: "f4c-test", currency: "usd", amount: "12.50" });

  // Ana: two copies of X (one is extra) and wants Y.
  await createTestUser(db, {
    id: ANA_ID,
    email: ANA_EMAIL,
    handle: ANA_ID,
    name: "F4C Ana",
  });
  await insertBinder(ANA_ID, "F4C Binder de Ana", variantX, 2);
  await db.insert(wishlistItem).values({ userId: ANA_ID, variantId: variantY });

  // Bea: opted out of trades, so she never shows up. Used for the viewer case.
  await createTestUser(db, {
    id: BEA_ID,
    email: BEA_EMAIL,
    handle: BEA_ID,
    name: "F4C Bea",
  });
  await db.insert(profile).values({ userId: BEA_ID, tradesOptIn: false });

  // The dev user: two copies of Y (one is extra) and wants X.
  await insertBinder(DEV_USER_ID, "F4C Binder del dev", variantY, 2);
  await db.insert(wishlistItem).values({ userId: DEV_USER_ID, variantId: variantX });
});

test.afterAll(async () => {
  await db.delete(wishlistItem).where(inArray(wishlistItem.variantId, variantIds));
  for (const binderId of binderIds) {
    await db.delete(binder).where(eq(binder.id, binderId));
  }
  await db.delete(user).where(inArray(user.id, [ANA_ID, BEA_ID]));
  for (const variantId of variantIds) {
    await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  }
  for (const cardId of cardIds) {
    await db.delete(card).where(eq(card.id, cardId));
  }
  for (const setId of setIds) {
    await db.delete(set).where(eq(set.id, setId));
  }
  for (const gameId of gameIds) {
    await db.delete(game).where(eq(game.id, gameId));
  }
  await db.$client.end();
});

test.describe("signed in as the dev user", () => {
  test("shows a mutual match with both cards on the right side", async ({ page }) => {
    await page.goto("/intercambios");
    await expect(
      page.getByRole("heading", { name: "Tengo repetida lo que te falta" }),
    ).toBeVisible();

    const entry = page.locator('[data-testid="trade-entry"][data-handle="f4c-ana"]');
    await expect(entry).toHaveCount(1);
    await expect(entry.getByText("Intercambio mutuo")).toBeVisible();
    await expect(entry.getByRole("link", { name: "@f4c-ana" })).toHaveAttribute(
      "href",
      "/u/f4c-ana",
    );

    const give = entry.getByRole("list", { name: "Te puede dar" });
    await expect(give.getByRole("img", { name: CARD_X })).toBeVisible();
    await expect(give.getByText("$12.50 USD")).toBeVisible();

    const receive = entry.getByRole("list", { name: "Le sirve de lo tuyo" });
    await expect(receive.getByRole("img", { name: CARD_Y })).toBeVisible();
    await expect(receive.getByText("sin precio")).toBeVisible();
  });

  test("a user who opts out disappears from the matches", async ({ page }) => {
    await db
      .insert(profile)
      .values({ userId: ANA_ID, tradesOptIn: false })
      .onConflictDoUpdate({
        target: profile.userId,
        set: { tradesOptIn: false },
      });
    try {
      await page.goto("/intercambios");
      await expect(
        page.getByRole("heading", { name: "Tengo repetida lo que te falta" }),
      ).toBeVisible();
      await expect(page.locator('[data-handle="f4c-ana"]')).toHaveCount(0);
    } finally {
      await db
        .insert(profile)
        .values({ userId: ANA_ID, tradesOptIn: true })
        .onConflictDoUpdate({
          target: profile.userId,
          set: { tradesOptIn: true },
        });
    }
  });
});

test.describe("opted out viewer", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("explains that trades are off and links to the account", async ({ page, baseURL }) => {
    await signInAs(page.request, baseURL ?? "", BEA_EMAIL, TEST_USER_PASSWORD);
    await page.goto("/intercambios");
    await expect(page.getByText("Tus intercambios están desactivados.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a mi cuenta" })).toHaveAttribute(
      "href",
      "/cuenta",
    );
    await expect(page.locator('[data-testid="trade-entry"]')).toHaveCount(0);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to /entrar", async ({ page }) => {
    await page.goto("/intercambios");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fintercambios$/);
  });
});

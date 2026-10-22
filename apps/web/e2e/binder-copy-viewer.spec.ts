import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { layoutSchema } from "@sleevebook/binder-core";
import {
  binder,
  binderVersion,
  card,
  cardInstance,
  cardVariant,
  createDb,
  DEV_USER_ID,
  ensureDevUser,
  game,
  pricePoint,
  set,
  shareLink,
} from "@sleevebook/db";
import { inArray } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Fase 7 fixtures are prefixed "F7C" and removed in afterAll.
const CARD_NAME = "F7C Carta Japonesa";
const POCKET = "S1·F·1";

let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
const copyIds: string[] = [];
let collectionBinderId: string;
let sellerBinderId: string;
let collectionSlug: string;
let sellerSlug: string;

function layoutFor(copyId: string) {
  return layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      [POCKET]: { kind: "card", variant: variantId, instance: copyId },
    },
  });
}

async function createBinder(
  name: string,
  mode: "seller" | "collection",
  copyId: string,
  slug: string,
): Promise<string> {
  const [row] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name,
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "published",
      mode,
      currency: "usd",
      sellerContact: mode === "seller" ? { whatsapp: "56912345678" } : {},
    })
    .returning({ id: binder.id });
  const binderId = (row as { id: string }).id;
  await db.insert(binderVersion).values({
    binderId,
    versionNumber: 1,
    layout: layoutFor(copyId),
  });
  await db.insert(shareLink).values({ binderId, slug, visibility: "unlisted" });
  return binderId;
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F7C Copy Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F7C Copy Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "1", name: CARD_NAME, supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  await db.insert(pricePoint).values({
    variantId,
    source: "f7c-test",
    currency: "USD",
    amount: "10.00",
  });

  // One copy per binder: a Japanese copy in play condition (MP = 70% of NM).
  const copyRows = await db
    .insert(cardInstance)
    .values([
      { userId: DEV_USER_ID, variantId, language: "ja", condition: "MP" },
      { userId: DEV_USER_ID, variantId, language: "ja", condition: "MP" },
    ])
    .returning({ id: cardInstance.id });
  for (const row of copyRows) {
    copyIds.push((row as { id: string }).id);
  }

  collectionSlug = `f7c-coll-${randomUUID().slice(0, 8)}`;
  sellerSlug = `f7c-seller-${randomUUID().slice(0, 8)}`;
  collectionBinderId = await createBinder(
    "F7C Copy Binder",
    "collection",
    copyIds[0] as string,
    collectionSlug,
  );
  sellerBinderId = await createBinder(
    "F7C Seller Copy Binder",
    "seller",
    copyIds[1] as string,
    sellerSlug,
  );
});

test.afterAll(async () => {
  const binderIds = [collectionBinderId, sellerBinderId].filter(Boolean);
  await db.delete(shareLink).where(inArray(shareLink.binderId, binderIds));
  await db.delete(binder).where(inArray(binder.id, binderIds));
  await db.delete(cardInstance).where(inArray(cardInstance.id, copyIds));
  await db.delete(pricePoint).where(inArray(pricePoint.variantId, [variantId]));
  await db.delete(cardVariant).where(inArray(cardVariant.id, [variantId]));
  await db.delete(card).where(inArray(card.id, [cardId]));
  await db.delete(set).where(inArray(set.id, [setId]));
  await db.delete(game).where(inArray(game.id, [gameId]));
  await db.$client.end();
});

test("owner viewer shows the language chip and the copy's condition", async ({ page }) => {
  await page.goto(`/binders/${collectionBinderId}?spread=0`);
  await expect(page.getByText("JP", { exact: true })).toBeVisible();

  await page.getByTitle(CARD_NAME, { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Idioma", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Japonés", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Condición", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Jugada (MP)", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("owner total values the copy at its condition estimate (10 x 0.7)", async ({ page }) => {
  await page.goto(`/binders/${collectionBinderId}?spread=0`);
  await expect(page.getByText("Valor total: $7.00 USD")).toBeVisible();
});

test("public link shows the language chip", async ({ page }) => {
  await page.goto(`/s/${collectionSlug}?spread=0`);
  await expect(page.getByText("JP", { exact: true })).toBeVisible();
});

test("seller mode prices the copy at its condition estimate", async ({ page }) => {
  await page.goto(`/s/${sellerSlug}?spread=0`);
  await expect(page.getByText("$7.00", { exact: true })).toBeVisible();

  await page.getByTitle(CARD_NAME, { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("estimado por condición")).toBeVisible();
  await expect(dialog.getByText("$7.00", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("seller management lists the copy chips next to the card", async ({ page }) => {
  await page.goto(`/binders/${sellerBinderId}/vender`);
  const row = page.locator(`[data-pocket="${POCKET}"]`);
  await expect(row.getByText("Japonés", { exact: true })).toBeVisible();
  await expect(row.getByText("Jugada (MP)", { exact: true })).toBeVisible();
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the copy chip and the focus sheet fit a 390px phone", async ({ page }) => {
    await page.goto(`/binders/${collectionBinderId}?spread=0`);
    await expect(page.getByText("JP", { exact: true })).toBeVisible();

    await page.getByTitle(CARD_NAME, { exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Japonés", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Jugada (MP)", { exact: true })).toBeVisible();

    // The card stays above the bottom sheet and inside the viewport width.
    // The card flies in with a spring: measure once it has settled above the sheet.
    const sheet = dialog.getByRole("region", { name: "Datos de catálogo" });
    const card = page.getByTestId("focused-card");
    await expect
      .poll(async () => {
        const cardBox = await card.boundingBox();
        const sheetBox = await sheet.boundingBox();
        if (!cardBox || !sheetBox) {
          return false;
        }
        return (
          cardBox.x >= 0 &&
          cardBox.x + cardBox.width <= 390 &&
          cardBox.y + cardBox.height <= sheetBox.y + 1
        );
      })
      .toBe(true);
  });
});

import { randomUUID } from "node:crypto";
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
  exchangeRate,
  game,
  pocketListing,
  pricePoint,
  set,
  shareLink,
} from "@sleevebook/db";
import { eq, inArray } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Fixture rows are all prefixed "F3C" and removed in afterAll.
const NAMES = ["F3C Carta Uno", "F3C Carta Dos", "F3C Carta Tres"] as const;
let gameId: string;
let setId: string;
const cardIds: string[] = [];
const variantIds: string[] = [];
let rateId: string;
let sellerBinderId: string;
let collectionBinderId: string;
let sellerSlug: string;
let collectionSlug: string;

// Pocket codes use the middle dot of pocket-code.ts.
const POCKETS = ["S1·F·1", "S1·F·2", "S1·F·3"] as const;

function layoutFor(variants: string[]) {
  return layoutSchema.parse({
    format: { rows: 1, cols: 3 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: Object.fromEntries(
      POCKETS.map((code, i) => [code, { kind: "card", variant: variants[i], instance: null }]),
    ),
  });
}

async function createBinder(name: string, mode: "seller" | "collection", slug: string) {
  const [row] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name,
      formatRows: 1,
      formatCols: 3,
      sheets: 1,
      status: "published",
      mode,
      currency: mode === "seller" ? "clp" : "usd",
      sellerContact: mode === "seller" ? { whatsapp: "56912345678" } : {},
    })
    .returning({ id: binder.id });
  const binderId = (row as { id: string }).id;
  await db.insert(binderVersion).values({
    binderId,
    versionNumber: 1,
    layout: layoutFor(variantIds),
  });
  await db.insert(shareLink).values({ binderId, slug, visibility: "unlisted" });
  // Listings exist for both binders: the collection page must ignore them.
  await db.insert(pocketListing).values([
    { binderId, pocketCode: POCKETS[1], status: "reservado", price: "15000.00", currency: "clp" },
    { binderId, pocketCode: POCKETS[2], status: "vendido", price: null, currency: "usd" },
  ]);
  return binderId;
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F3C Seller Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F3C Seller Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  for (const [i, name] of NAMES.entries()) {
    const [cardRow] = await db
      .insert(card)
      .values({ setId, number: String(i + 1), name, supertype: "Pokémon", language: "en" })
      .returning({ id: card.id });
    const cardId = (cardRow as { id: string }).id;
    cardIds.push(cardId);

    const [variantRow] = await db
      .insert(cardVariant)
      .values({ cardId, variant: "normal" })
      .returning({ id: cardVariant.id });
    const variantId = (variantRow as { id: string }).id;
    variantIds.push(variantId);

    await db.insert(pricePoint).values({
      variantId,
      source: "f3c-test",
      currency: "usd",
      amount: String(10 * (i + 1)),
    });
  }

  const [rateRow] = await db
    .insert(exchangeRate)
    .values({ quote: "clp", rate: "1000", source: "f3c-test" })
    .returning({ id: exchangeRate.id });
  rateId = (rateRow as { id: string }).id;

  sellerSlug = `f3c-seller-${randomUUID().slice(0, 8)}`;
  collectionSlug = `f3c-coll-${randomUUID().slice(0, 8)}`;
  sellerBinderId = await createBinder("F3C Seller Binder", "seller", sellerSlug);
  collectionBinderId = await createBinder("F3C Collection Binder", "collection", collectionSlug);
});

test.afterAll(async () => {
  await db
    .delete(shareLink)
    .where(inArray(shareLink.binderId, [sellerBinderId, collectionBinderId]));
  await db.delete(binder).where(inArray(binder.id, [sellerBinderId, collectionBinderId]));
  await db.delete(exchangeRate).where(eq(exchangeRate.id, rateId));
  await db.delete(cardVariant).where(inArray(cardVariant.id, variantIds));
  await db.delete(card).where(inArray(card.id, cardIds));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("seller binder shows CLP prices, listing states and a buyer list", async ({ page }) => {
  await page.goto(`/s/${sellerSlug}?spread=0`);
  await expect(page.getByRole("heading", { name: "F3C Seller Binder" })).toBeVisible();

  await expect(page.getByText("Precios en CLP", { exact: false })).toBeVisible();
  // Seller asking price in CLP, no decimals.
  await expect(page.getByText("$15.000", { exact: true })).toBeVisible();
  // Card 1 has no listing: market USD converted to CLP, so only the format is fixed.
  await expect(page.getByText(/^\$\d{1,3}(\.\d{3})*$/).first()).toBeVisible();
  await expect(page.getByText("Reservado", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Vendido", { exact: true }).first()).toBeVisible();

  // Contact button near the title, before any card is picked.
  await expect(page.getByText("Contactar al vendedor")).toBeVisible();
  await expect(page.getByTestId("seller-tray-count")).toHaveText("Vacía");

  // Add the first card from its focus overlay.
  await page.getByTitle(NAMES[0], { exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Precio", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/^\$\d{1,3}(\.\d{3})*$/)).toBeVisible();
  await dialog.getByRole("button", { name: "Agregar a mi lista" }).click();
  await expect(page.getByTestId("seller-tray-count")).toHaveText("1 carta");
  // Vendido cannot be added.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByTitle(NAMES[2], { exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Carta vendida" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  const tray = page.getByTestId("seller-tray");
  const whatsapp = tray.getByRole("link", { name: "WhatsApp" });
  const href = await whatsapp.getAttribute("href");
  expect(href).toContain("wa.me");
  expect(href).toContain(encodeURIComponent(NAMES[0]));

  // The list survives a reload (per slug, in localStorage).
  await page.reload();
  await expect(page.getByTestId("seller-tray-count")).toHaveText("1 carta");
});

test("collection binder shows no prices, states or buyer list", async ({ page }) => {
  await page.goto(`/s/${collectionSlug}?spread=0`);
  await expect(page.getByRole("heading", { name: "F3C Collection Binder" })).toBeVisible();

  await expect(page.getByTitle(NAMES[0], { exact: true })).toBeVisible();
  await expect(page.getByTestId("seller-tray")).toHaveCount(0);
  await expect(page.getByTestId("seller-contact")).toHaveCount(0);
  await expect(page.getByText(/Precios en/)).toHaveCount(0);
  await expect(page.getByText("Reservado", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Vendido", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^\$\d/)).toHaveCount(0);
});

test("the buyer tray fits a 400px phone", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  await page.goto(`/s/${sellerSlug}?spread=0`);
  const tray = page.getByTestId("seller-tray");
  await expect(tray).toBeVisible();
  const box = await tray.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.x ?? -1) >= 0).toBe(true);
  expect((box?.x ?? 0) + (box?.width ?? 0) <= 400).toBe(true);
});

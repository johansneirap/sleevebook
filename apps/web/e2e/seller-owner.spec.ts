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
  pocketListing,
  set,
} from "@sleevebook/db";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const CARD_ONE = "F3B Carta Uno";
const CARD_TWO = "F3B Carta Dos";
const POCKET_ONE = "S1·F·1";
const POCKET_TWO = "S1·F·2";

let gameId: string;
let setId: string;
const cardIds: string[] = [];
const variantIds: string[] = [];
let binderId: string;

function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 1, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      [POCKET_ONE]: { kind: "card", variant: variantIds[0], instance: null },
      [POCKET_TWO]: { kind: "card", variant: variantIds[1], instance: null },
    },
  });
}

async function resetSellerState() {
  await db
    .update(binder)
    .set({ mode: "collection", currency: "usd", sellerContact: null })
    .where(eq(binder.id, binderId));
  await db.delete(pocketListing).where(eq(pocketListing.binderId, binderId));
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F3B Seller Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F3B Seller Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  for (const [number, name] of [
    ["1", CARD_ONE],
    ["2", CARD_TWO],
  ] as const) {
    const [cardRow] = await db
      .insert(card)
      .values({ setId, number, name, supertype: "Pokémon", language: "en" })
      .returning({ id: card.id });
    const cardId = (cardRow as { id: string }).id;
    cardIds.push(cardId);

    const [variantRow] = await db
      .insert(cardVariant)
      .values({ cardId, variant: "normal" })
      .returning({ id: cardVariant.id });
    variantIds.push((variantRow as { id: string }).id);
  }

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F3B Seller Fixture Binder",
      formatRows: 1,
      formatCols: 2,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: initialLayout() });
});

test.beforeEach(async () => {
  await resetSellerState();
});

test.afterAll(async () => {
  await db.delete(pocketListing).where(eq(pocketListing.binderId, binderId));
  await db.delete(binderVersion).where(eq(binderVersion.binderId, binderId));
  await db.delete(binder).where(eq(binder.id, binderId));
  for (const variantId of variantIds) {
    await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  }
  for (const cardId of cardIds) {
    await db.delete(card).where(eq(card.id, cardId));
  }
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("configura modo venta, moneda y WhatsApp, y persiste tras recargar", async ({ page }) => {
  await page.goto(`/binders/${binderId}/vender`);

  await page.getByLabel("Venta", { exact: true }).check();
  await page.getByLabel("Moneda de precios").selectOption("clp");
  await page.getByLabel("WhatsApp").fill("56 9 1234 5678");
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Configuración guardada." }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Venta", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Moneda de precios")).toHaveValue("clp");
  await expect(page.getByLabel("WhatsApp")).toHaveValue("56912345678");
});

test("marca una carta como vendida con precio y queda guardado tras recargar", async ({ page }) => {
  await page.goto(`/binders/${binderId}/vender`);

  await page.getByLabel(`Estado de ${CARD_ONE} ${POCKET_ONE}`).selectOption("vendido");
  await page.getByLabel(`Precio de venta de ${CARD_ONE} ${POCKET_ONE}`).fill("12.5");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.getByRole("status").filter({ hasText: "1 cambio guardado." })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(`Estado de ${CARD_ONE} ${POCKET_ONE}`)).toHaveValue("vendido");
  await expect(page.getByLabel(`Precio de venta de ${CARD_ONE} ${POCKET_ONE}`)).toHaveValue("12.5");
  await expect(page.getByLabel(`Estado de ${CARD_TWO} ${POCKET_TWO}`)).toHaveValue("disponible");

  const sold = page.locator(".sb-seller-figure").filter({ hasText: "Vendidas" });
  await expect(sold).toContainText("1");
});

test("un WhatsApp inválido muestra error y no guarda nada", async ({ page }) => {
  await page.goto(`/binders/${binderId}/vender`);

  await page.getByLabel("Venta", { exact: true }).check();
  await page.getByLabel("WhatsApp").fill("+56 9 12");
  await page.getByRole("button", { name: "Guardar configuración" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Usa 8 a 15 dígitos con código de país" }),
  ).toBeVisible();
  await expect(page.getByLabel("WhatsApp")).toHaveAttribute("aria-invalid", "true");

  const [row] = await db.select().from(binder).where(eq(binder.id, binderId));
  expect(row?.mode).toBe("collection");
  expect(row?.sellerContact ?? {}).toEqual({});

  await page.reload();
  await expect(page.getByLabel("Colección", { exact: true })).toBeChecked();
});

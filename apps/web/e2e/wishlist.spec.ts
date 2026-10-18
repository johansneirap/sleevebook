import { expect, test } from "@playwright/test";
import { formatPocketCode, layoutSchema } from "@sleevebook/binder-core";
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
  shareLink,
  wishlistItem,
} from "@sleevebook/db";
import { and, eq, inArray } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Every fixture name, slug and id starts with F4B so the shared dev DB stays clean.
const PUBLIC_SLUG = "f4b-wishlist-public";
const POCKET = formatPocketCode({ sheet: 1, side: "F", index: 1 });

let gameId: string;
let setId: string;
let alfaId: string;
let betaId: string;
let gammaId: string;
let binderId: string;
let publicBinderId: string;
let goalId: string;
const variantIds: string[] = [];

function layoutWith(variantId: string) {
  return layoutSchema.parse({
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: { [POCKET]: { kind: "card", variant: variantId, instance: null } },
  });
}

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

/** Removes the dev user's wishlist rows for the F4B cards so each test starts empty. */
async function clearWishlist() {
  await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.userId, DEV_USER_ID), inArray(wishlistItem.variantId, variantIds)));
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F4B Wishlist Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F4B Wishlist Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  alfaId = await addCard("F4B Alfa", "1");
  betaId = await addCard("F4B Beta", "2");
  gammaId = await addCard("F4B Gamma", "3");
  variantIds.push(alfaId, betaId, gammaId);

  // Alfa has a market price; Beta and Gamma do not ("sin precio").
  await db.insert(pricePoint).values([
    { variantId: alfaId, source: "tcgplayer", currency: "USD", amount: "2.00" },
    { variantId: gammaId, source: "tcgplayer", currency: "USD", amount: "4.00" },
  ]);

  // A master-set style goal of three variants, of which only Alfa is owned.
  const [goalRow] = await db
    .insert(goal)
    .values({ type: "custom", rules: {}, variantIds: [alfaId, betaId, gammaId] })
    .returning({ id: goal.id });
  goalId = (goalRow as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F4B Wishlist Fixture Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "published",
      goalId,
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;
  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: layoutWith(alfaId) });

  // Published and unlisted, so the signed-out test can open it by slug.
  const [publicRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F4B Wishlist Public Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "published",
    })
    .returning({ id: binder.id });
  publicBinderId = (publicRow as { id: string }).id;
  await db
    .insert(binderVersion)
    .values({ binderId: publicBinderId, versionNumber: 1, layout: layoutWith(alfaId) });
  await db
    .insert(shareLink)
    .values({ binderId: publicBinderId, slug: PUBLIC_SLUG, visibility: "unlisted" });
});

test.afterAll(async () => {
  await db
    .delete(wishlistItem)
    .where(and(eq(wishlistItem.userId, DEV_USER_ID), inArray(wishlistItem.variantId, variantIds)));
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(binder).where(eq(binder.id, publicBinderId));
  await db.delete(goal).where(eq(goal.id, goalId));
  await db.delete(cardVariant).where(inArray(cardVariant.id, variantIds));
  await db.delete(card).where(eq(card.setId, setId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test.beforeEach(async () => {
  await clearWishlist();
});

const LIST_NAME = "Cartas en mis deseos";

test("search adds a card with its price, sets a USD target and removes it", async ({ page }) => {
  await page.goto("/deseos");
  await expect(page.getByRole("heading", { name: "Mis deseos" })).toBeVisible();

  await page.getByLabel("Buscar por nombre").fill("F4B");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("list", { name: "Resultados de búsqueda" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar F4B Alfa 1 (normal)" }).click();

  const list = page.getByRole("region", { name: LIST_NAME });
  const row = list.getByRole("listitem").filter({ hasText: "F4B Alfa" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("$2.00");

  await row.getByLabel("Avisarme bajo (US$)").fill("1.50");
  await row.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(row.getByRole("status")).toHaveText("Guardado");

  await page.reload();
  const savedRow = page
    .getByRole("region", { name: LIST_NAME })
    .getByRole("listitem")
    .filter({ hasText: "F4B Alfa" });
  await expect(savedRow.getByLabel("Avisarme bajo (US$)")).toHaveValue("1.50");

  await savedRow.getByRole("button", { name: /^Quitar F4B Alfa/ }).click();
  await expect(
    page
      .getByRole("region", { name: LIST_NAME })
      .getByRole("listitem")
      .filter({ hasText: "F4B Alfa" }),
  ).toHaveCount(0);
});

test("a card without a market price shows sin precio", async ({ page }) => {
  await page.goto("/deseos");
  await page.getByLabel("Buscar por nombre").fill("F4B Beta");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: "Agregar F4B Beta 2 (normal)" }).click();

  const row = page
    .getByRole("region", { name: LIST_NAME })
    .getByRole("listitem")
    .filter({ hasText: "F4B Beta" });
  await expect(row).toContainText("sin precio");
});

test("me faltan adds every missing card to the wishlist", async ({ page }) => {
  await page.goto(`/binders/${binderId}/faltan`);
  await expect(page.getByRole("heading", { name: "Me faltan (2)" })).toBeVisible();
  await page.getByRole("button", { name: "Agregar todo a mis deseos" }).click();
  await expect(page.getByRole("status").filter({ hasText: "2 cartas agregadas" })).toBeVisible();

  await page.goto("/deseos");
  const list = page.getByRole("region", { name: LIST_NAME });
  await expect(list.getByRole("listitem").filter({ hasText: "F4B Beta" })).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: "F4B Gamma" })).toBeVisible();
  // The dev user's list is shared with other fixtures: count only our cards.
  await expect(list.getByRole("listitem").filter({ hasText: "F4B" })).toHaveCount(2);
});

test("the card overlay toggles the card on the wishlist", async ({ page }) => {
  await page.goto(`/binders/${binderId}?spread=0`);
  await page.getByRole("button", { name: /F4B Alfa/ }).click();
  await expect(page.getByTestId("focused-card")).toBeVisible();

  const toggle = page.getByRole("button", { name: "Agregar a mis deseos" });
  await toggle.click();
  await expect(page.getByRole("button", { name: "En mis deseos" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/deseos");
  await expect(
    page
      .getByRole("region", { name: LIST_NAME })
      .getByRole("listitem")
      .filter({ hasText: "F4B Alfa" }),
  ).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/deseos redirects to /entrar", async ({ page }) => {
    await page.goto("/deseos");
    await expect(page).toHaveURL(/\/entrar\?next=%2Fdeseos$/);
  });

  test("a public binder shows the card without the wishlist toggle", async ({ page }) => {
    await page.goto(`/s/${PUBLIC_SLUG}?spread=0`);
    await page.getByRole("button", { name: /F4B Alfa/ }).click();
    await expect(page.getByTestId("focused-card")).toBeVisible();
    await expect(page.getByRole("button", { name: "Voltear carta" })).toBeVisible();
    await expect(page.getByRole("button", { name: /mis deseos/ })).toHaveCount(0);
  });
});

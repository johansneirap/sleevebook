import { expect, type Page, test } from "@playwright/test";
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

// Unique name so search results don't collide with binder-editor.spec.ts fixtures.
const CARD_NAME = "E2E Insert Target";

let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
let binderId: string;

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Insert Card Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Insert Card Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "9", name: CARD_NAME, supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Insert Card Fixture Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  // Empty layout: nothing should animate on the initial render.
  await db.insert(binderVersion).values({
    binderId,
    versionNumber: 1,
    layout: {
      format: { rows: 2, cols: 2 },
      opening: "side",
      sheets: 1,
      theme: { preset: "default", sleeve: "clear" },
      pockets: {},
    },
  });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

// Records in the page whether data-inserting="true" ever appears after the
// observer is installed. A MutationObserver sees every change, so a short
// animation can't slip past a polling assertion.
async function watchInsertingAttribute(page: Page) {
  await page.evaluate(() => {
    const win = window as unknown as { __insertingSeen: boolean };
    win.__insertingSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-inserting="true"]')) {
        win.__insertingSeen = true;
      }
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-inserting"],
    });
  });
}

function insertingSeen(page: Page) {
  return page.evaluate(() => (window as unknown as { __insertingSeen: boolean }).__insertingSeen);
}

test("adding a card via search slides it in, and undo does not animate", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await expect(page.getByRole("heading", { name: /E2E Insert Card Fixture Binder/ })).toBeVisible();

  await page.getByRole("button", { name: "S1·F·1" }).click();
  await expect(page.getByText("Editando")).toContainText("S1·F·1");

  await watchInsertingAttribute(page);

  await page.getByPlaceholder("Buscar carta por nombre...").fill(CARD_NAME);
  await expect(page.getByText(new RegExp(`${CARD_NAME} 9`))).toBeVisible();
  await page
    .getByRole("listitem")
    .filter({ hasText: CARD_NAME })
    .getByRole("button", { name: "Usar como carta" })
    .click();

  const pocket = page.getByRole("button", { name: new RegExp(`${CARD_NAME} 9`) });
  await expect(pocket).toBeVisible();

  // The insert animation ran, and has finished.
  await expect.poll(() => insertingSeen(page), { timeout: 5_000 }).toBe(true);
  await expect(pocket).not.toHaveAttribute("data-inserting", "true", { timeout: 5_000 });

  // Undo restores the empty pocket and must not trigger the insert animation.
  await page.evaluate(() => {
    (window as unknown as { __insertingSeen: boolean }).__insertingSeen = false;
  });
  await page.getByRole("button", { name: "Deshacer" }).click();
  const emptyPocket = page.getByRole("button", { name: "S1·F·1" });
  await expect(emptyPocket).toBeVisible();
  // Give any wrongly scheduled animation time to show up before asserting.
  await page.waitForTimeout(800);
  expect(await insertingSeen(page)).toBe(false);
  await expect(emptyPocket).not.toHaveAttribute("data-inserting", "true");
});

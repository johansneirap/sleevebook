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
let cardAId: string;
let cardBId: string;
let cardCId: string;
let variantAId: string;
let variantBId: string;
let variantCId: string;
let binderId: string;

function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantAId, instance: null },
      S1·F·2: { kind: "card", variant: variantBId, instance: null },
      S1·F·3: { kind: "empty" },
      S1·F·4: { kind: "empty" },
    },
  });
}

async function resetLayout() {
  await db
    .update(binderVersion)
    .set({ layout: initialLayout() })
    .where(eq(binderVersion.binderId, binderId));
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E DnD Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E DnD Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardA] = await db
    .insert(card)
    .values({ setId, number: "1", name: "E2E DnD Card A", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardAId = (cardA as { id: string }).id;
  const [variantA] = await db
    .insert(cardVariant)
    .values({ cardId: cardAId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantAId = (variantA as { id: string }).id;

  const [cardB] = await db
    .insert(card)
    .values({ setId, number: "2", name: "E2E DnD Card B", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardBId = (cardB as { id: string }).id;
  const [variantB] = await db
    .insert(cardVariant)
    .values({ cardId: cardBId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantBId = (variantB as { id: string }).id;

  const [cardC] = await db
    .insert(card)
    .values({ setId, number: "3", name: "E2E DnD Card C", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardCId = (cardC as { id: string }).id;
  const [variantC] = await db
    .insert(cardVariant)
    .values({ cardId: cardCId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantCId = (variantC as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E DnD Fixture Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
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
  await db.delete(cardVariant).where(eq(cardVariant.id, variantAId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantBId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantCId));
  await db.delete(card).where(eq(card.id, cardAId));
  await db.delete(card).where(eq(card.id, cardBId));
  await db.delete(card).where(eq(card.id, cardCId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

async function readLayout() {
  const [row] = await db.select().from(binderVersion).where(eq(binderVersion.binderId, binderId));
  return layoutSchema.parse(row?.layout);
}

// dnd-kit's PointerSensor listens to raw pointer events, not the native HTML5
// drag-and-drop event family -- Playwright's locator.dragTo() dispatches the
// latter, so it never triggers a dnd-kit drag. Simulating the mouse directly
// (down -> move in steps, to clear the activation distance -> up) does.
async function dragPocket(
  page: import("@playwright/test").Page,
  from: import("@playwright/test").Locator,
  to: import("@playwright/test").Locator,
) {
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) {
    throw new Error("Could not read bounding box for drag source/target");
  }
  const fromPoint = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
  const toPoint = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };

  await page.mouse.move(fromPoint.x, fromPoint.y);
  await page.mouse.down();
  await page.mouse.move((fromPoint.x + toPoint.x) / 2, (fromPoint.y + toPoint.y) / 2, { steps: 5 });
  await page.mouse.move(toPoint.x, toPoint.y, { steps: 5 });
  await page.mouse.up();
}

test("dragging one occupied pocket onto another swaps their contents", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  const cardA = page.getByRole("button", { name: /E2E DnD Card A/ });
  const cardB = page.getByRole("button", { name: /E2E DnD Card B/ });
  await expect(cardA).toBeVisible();

  await dragPocket(page, cardA, cardB);

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "card", variant: variantBId, instance: null });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "card", variant: variantAId, instance: null });
  }).toPass();
});

test("dragging an occupied pocket onto an empty one moves it", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  const cardA = page.getByRole("button", { name: /E2E DnD Card A/ });
  const emptySlot = page.getByRole("button", { name: "S1·F·3" });
  await expect(cardA).toBeVisible();

  await dragPocket(page, cardA, emptySlot);

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "empty" });
    expect(layout.pockets["S1·F·3"]).toEqual({ kind: "card", variant: variantAId, instance: null });
  }).toPass();
});

test("shift-click selects multiple pockets and bulk-clears them", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);

  await page.getByRole("button", { name: /E2E DnD Card A/ }).click();
  await page.getByRole("button", { name: /E2E DnD Card B/ }).click({ modifiers: ["Shift"] });
  await expect(page.getByText("2 bolsillos seleccionados")).toBeVisible();

  await page.getByRole("button", { name: "Vaciar seleccionados" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "empty" });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "empty" });
  }).toPass();
});

test("undo reverts the last change and redo reapplies it", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);

  await page.getByRole("button", { name: "S1·F·3" }).click();
  await page.getByPlaceholder("Buscar carta por nombre...").fill("E2E DnD Card C");
  await page
    .getByRole("listitem")
    .filter({ hasText: "E2E DnD Card C" })
    .getByRole("button", { name: "Usar como carta" })
    .click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·3"]).toEqual({ kind: "card", variant: variantCId, instance: null });
  }).toPass();

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·3"]).toEqual({ kind: "empty" });
  }).toPass();

  await page.getByRole("button", { name: "Rehacer" }).click();
  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·3"]).toEqual({ kind: "card", variant: variantCId, instance: null });
  }).toPass();
});

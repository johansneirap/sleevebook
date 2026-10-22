import { expect, type Page, test } from "@playwright/test";
import { type Layout, layoutSchema } from "@sleevebook/binder-core";
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
  set,
} from "@sleevebook/db";
import { eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const BINDER_NAME = "E2E Copy Fixture Binder";
const CARD_NAME = "E2E Copy Fixture Card";

let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
let binderId: string;

// Card pockets are named after their card, so they are found by DOM order:
// the first sheet's front fills row by row (S1·F·1 is index 0, S1·F·2 index 1).
function pocketAt(page: Page, index: number) {
  return page.locator(".sb-ed-pocket").nth(index);
}

async function resetPockets(pockets: Layout["pockets"]) {
  await db
    .update(binderVersion)
    .set({ layout: layoutSchema.parse({ ...baseLayout(), pockets }) })
    .where(eq(binderVersion.binderId, binderId));
}

function baseLayout() {
  return {
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {},
  };
}

/** One pocket of a layout, by its code (a variable key keeps the lint quiet). */
function pocketIn(pockets: Layout["pockets"], code: string) {
  return pockets[code];
}

async function readPockets(): Promise<Layout["pockets"]> {
  const [row] = await db.select().from(binderVersion).where(eq(binderVersion.binderId, binderId));
  return layoutSchema.parse(row?.layout).pockets;
}

async function insertCopy(language: string): Promise<string> {
  const [row] = await db
    .insert(cardInstance)
    .values({ userId: DEV_USER_ID, variantId, language, condition: "NM" })
    .returning({ id: cardInstance.id });
  return (row as { id: string }).id;
}

function cardPocket(variant: string, instance: string | null = null) {
  return { kind: "card" as const, variant, instance };
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Copy Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Copy Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "7", name: CARD_NAME, supertype: "Pokémon", language: "en" })
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
      name: BINDER_NAME,
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db
    .insert(binderVersion)
    .values({ binderId, versionNumber: 1, layout: layoutSchema.parse(baseLayout()) });
});

test.afterAll(async () => {
  // Copies reference the variant (restrict), so they go first.
  await db.delete(cardInstance).where(eq(cardInstance.variantId, variantId));
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test.beforeEach(async () => {
  await resetPockets({ S1·F·1: cardPocket(variantId), S1·F·2: { kind: "empty" } });
  // Copies from earlier tests are removed so each test starts with its own.
  await db.delete(cardInstance).where(eq(cardInstance.variantId, variantId));
});

test("nueva copia en japonés: el bolsillo muestra JP y queda vinculada", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await pocketAt(page, 0).click();
  await expect(page.getByText("Sin copia asignada")).toBeVisible();

  await page.getByRole("button", { name: "Nueva copia" }).click();
  await page.getByLabel("Idioma").selectOption("ja");
  await page.getByRole("button", { name: "Crear y asignar" }).click();

  const pocket = page.getByRole("button", { name: new RegExp(`${CARD_NAME} 7`) });
  await expect(pocket.getByText("JP", { exact: true })).toBeVisible();

  const [copy] = await db
    .select({ id: cardInstance.id, language: cardInstance.language })
    .from(cardInstance)
    .where(eq(cardInstance.variantId, variantId));
  expect(copy?.language).toBe("ja");
  await expect
    .poll(async () => pocketIn(await readPockets(), "S1·F·1"))
    .toEqual(cardPocket(variantId, copy?.id ?? null));
});

test("quitar copia deja el bolsillo sin vínculo", async ({ page }) => {
  const copyId = await insertCopy("ja");
  await resetPockets({ S1·F·1: cardPocket(variantId, copyId) });

  await page.goto(`/binders/${binderId}/editar`);
  const pocket = page.getByRole("button", { name: new RegExp(`${CARD_NAME} 7`) });
  await expect(pocket.getByText("JP", { exact: true })).toBeVisible();

  await pocket.click();
  await page.getByRole("button", { name: "Quitar copia" }).click();

  await expect(page.getByText("Sin copia asignada")).toBeVisible();
  await expect(pocket.getByText("JP", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => pocketIn(await readPockets(), "S1·F·1"))
    .toEqual(cardPocket(variantId, null));
});

test("asigna una copia suelta existente", async ({ page }) => {
  const copyId = await insertCopy("en");

  await page.goto(`/binders/${binderId}/editar`);
  await pocketAt(page, 0).click();
  await page.getByRole("button", { name: "Elegir copia" }).click();

  const option = page.getByRole("listitem").filter({ hasText: "Suelta" });
  await expect(option).toHaveCount(1);
  await option.getByRole("button", { name: "Usar" }).click();

  await expect(page.getByRole("button", { name: "Cambiar copia" })).toBeVisible();
  await expect
    .poll(async () => pocketIn(await readPockets(), "S1·F·1"))
    .toEqual(cardPocket(variantId, copyId));
});

test("mover una copia de otro bolsillo pide confirmación y la mueve", async ({ page }) => {
  const copyId = await insertCopy("ja");
  await resetPockets({
    S1·F·1: cardPocket(variantId),
    S1·F·2: cardPocket(variantId, copyId),
  });

  await page.goto(`/binders/${binderId}/editar`);
  await pocketAt(page, 0).click();
  await page.getByRole("button", { name: "Elegir copia" }).click();

  const option = page.getByRole("listitem").filter({ hasText: "S1·F·2" });
  await option.getByRole("button", { name: "Usar" }).click();

  await expect(
    page.getByText(`Esta copia está en ${BINDER_NAME} · S1·F·2. ¿Moverla aquí?`),
  ).toBeVisible();
  // Nothing moves until the owner says yes.
  expect(pocketIn(await readPockets(), "S1·F·2")).toEqual(cardPocket(variantId, copyId));

  await page.getByRole("button", { name: "Mover aquí" }).click();

  await expect
    .poll(async () => {
      const pockets = await readPockets();
      return [pocketIn(pockets, "S1·F·1"), pocketIn(pockets, "S1·F·2")];
    })
    .toEqual([cardPocket(variantId, copyId), cardPocket(variantId, null)]);
});

test("la sección de copia usable en 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/binders/${binderId}/editar`);
  await pocketAt(page, 0).click();
  await page.getByRole("button", { name: "Nueva copia" }).click();

  const createButton = page.getByRole("button", { name: "Crear y asignar" });
  await expect(createButton).toBeVisible();
  const box = await createButton.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

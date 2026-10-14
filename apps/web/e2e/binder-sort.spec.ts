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
let setBetaId: string;
let setAlphaId: string;
let setGammaId: string;
let cardXId: string;
let cardYId: string;
let cardZId: string;
let variantXId: string;
let variantYId: string;
let variantZId: string;
let binderId: string;

// X: number 2, "Beta Set" / Era Two. Y: number 10, "Alpha Set" / Era One.
// Z: number 5, "Gamma Set" / Era Three. Deliberately not pre-sorted by any
// single field, so a test that mislabels which field it's sorting by fails.
function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 1, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantYId, instance: null },
      S1·F·2: { kind: "card", variant: variantXId, instance: null },
      S1·B·1: { kind: "card", variant: variantZId, instance: null },
      S1·B·2: { kind: "empty" },
    },
  });
}

async function resetLayout() {
  await db
    .update(binderVersion)
    .set({ layout: initialLayout() })
    .where(eq(binderVersion.binderId, binderId));
}

async function readLayout() {
  const [row] = await db.select().from(binderVersion).where(eq(binderVersion.binderId, binderId));
  return layoutSchema.parse(row?.layout);
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Sort Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [betaSet] = await db
    .insert(set)
    .values({ gameId, name: "Beta Set", era: "Era Two", language: "en" })
    .returning({ id: set.id });
  setBetaId = (betaSet as { id: string }).id;
  const [alphaSet] = await db
    .insert(set)
    .values({ gameId, name: "Alpha Set", era: "Era One", language: "en" })
    .returning({ id: set.id });
  setAlphaId = (alphaSet as { id: string }).id;
  const [gammaSet] = await db
    .insert(set)
    .values({ gameId, name: "Gamma Set", era: "Era Three", language: "en" })
    .returning({ id: set.id });
  setGammaId = (gammaSet as { id: string }).id;

  const [cardX] = await db
    .insert(card)
    .values({
      setId: setBetaId,
      number: "2",
      name: "E2E Sort Card X",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardXId = (cardX as { id: string }).id;
  const [variantX] = await db
    .insert(cardVariant)
    .values({ cardId: cardXId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantXId = (variantX as { id: string }).id;

  const [cardY] = await db
    .insert(card)
    .values({
      setId: setAlphaId,
      number: "10",
      name: "E2E Sort Card Y",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardYId = (cardY as { id: string }).id;
  const [variantY] = await db
    .insert(cardVariant)
    .values({ cardId: cardYId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantYId = (variantY as { id: string }).id;

  const [cardZ] = await db
    .insert(card)
    .values({
      setId: setGammaId,
      number: "5",
      name: "E2E Sort Card Z",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardZId = (cardZ as { id: string }).id;
  const [variantZ] = await db
    .insert(cardVariant)
    .values({ cardId: cardZId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantZId = (variantZ as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Sort Fixture Binder",
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
  await resetLayout();
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantXId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantYId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantZId));
  await db.delete(card).where(eq(card.id, cardXId));
  await db.delete(card).where(eq(card.id, cardYId));
  await db.delete(card).where(eq(card.id, cardZId));
  await db.delete(set).where(eq(set.id, setBetaId));
  await db.delete(set).where(eq(set.id, setAlphaId));
  await db.delete(set).where(eq(set.id, setGammaId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("sorts by card number ascending", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Reordenar binder").click();
  await page.getByLabel("Criterio 1: campo").selectOption("number");
  await page.getByRole("button", { name: "Aplicar orden" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "card", variant: variantXId, instance: null });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "card", variant: variantZId, instance: null });
    expect(layout.pockets["S1·B·1"]).toEqual({ kind: "card", variant: variantYId, instance: null });
    expect(layout.pockets["S1·B·2"]).toEqual({ kind: "empty" });
  }).toPass();
});

test("sorts by set name ascending, independent of number", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Reordenar binder").click();
  await page.getByLabel("Criterio 1: campo").selectOption("setName");
  await page.getByRole("button", { name: "Aplicar orden" }).click();

  await expect(async () => {
    const layout = await readLayout();
    // Alpha(Y) < Beta(X) < Gamma(Z)
    expect(layout.pockets["S1·F·1"]).toEqual({ kind: "card", variant: variantYId, instance: null });
    expect(layout.pockets["S1·F·2"]).toEqual({ kind: "card", variant: variantXId, instance: null });
    expect(layout.pockets["S1·B·1"]).toEqual({ kind: "card", variant: variantZId, instance: null });
    expect(layout.pockets["S1·B·2"]).toEqual({ kind: "empty" });
  }).toPass();
});

test("grouping by era with start-on-new-side reports a capacity error instead of corrupting the layout", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Reordenar binder").click();
  await page.getByLabel("Agrupar por").selectOption("era");
  await page.getByLabel("Empezar cada sección en cara nueva").check();
  await page.getByRole("button", { name: "Aplicar orden" }).click();

  // 3 single-card eras + "start on new side" needs 5 slots in a 4-pocket
  // binder -- should fail loudly rather than silently drop a card.
  await expect(page.getByText(/No entran todas las cartas/)).toBeVisible();

  const layout = await readLayout();
  expect(layout).toEqual(initialLayout());
});

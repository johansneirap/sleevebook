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
let cardRioluId: string;
let cardZoruaId: string;
let variantRioluNormalId: string;
let variantRioluHoloId: string;
let variantZoruaId: string;
let binderId: string;

// 2x2 format, 1 sheet -> 8 pockets total (S1·F·1..4, S1·B·1..4).
// Riolu has two variants (normal/holo) so decklist/CSV imports that don't
// pin a variant land on "ambiguous"; Zorua has a single variant so it
// always resolves directly.
function emptyLayout() {
  return layoutSchema.parse({
    format: { rows: 2, cols: 2 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {},
  });
}

async function resetLayout() {
  await db
    .update(binderVersion)
    .set({ layout: emptyLayout() })
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
    .values({ name: "E2E Import Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "Test Set", ptcgoCode: "TST", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [riolu] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "E2E Import Riolu",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardRioluId = (riolu as { id: string }).id;

  const [rioluNormal] = await db
    .insert(cardVariant)
    .values({ cardId: cardRioluId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantRioluNormalId = (rioluNormal as { id: string }).id;

  const [rioluHolo] = await db
    .insert(cardVariant)
    .values({ cardId: cardRioluId, variant: "holo" })
    .returning({ id: cardVariant.id });
  variantRioluHoloId = (rioluHolo as { id: string }).id;

  const [zorua] = await db
    .insert(card)
    .values({
      setId,
      number: "2",
      name: "E2E Import Zorua",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardZoruaId = (zorua as { id: string }).id;

  const [zoruaVariant] = await db
    .insert(cardVariant)
    .values({ cardId: cardZoruaId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantZoruaId = (zoruaVariant as { id: string }).id;

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "E2E Import Fixture Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: emptyLayout() });
});

test.beforeEach(async () => {
  await resetLayout();
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantRioluNormalId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantRioluHoloId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantZoruaId));
  await db.delete(card).where(eq(card.id, cardRioluId));
  await db.delete(card).where(eq(card.id, cardZoruaId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("imports a decklist line as one copy per pocket", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("2 Zorua TST 2");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByText(/1 resueltas, 0 ambiguas, 0 no encontradas/)).toBeVisible();
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantZoruaId,
      instance: null,
    });
    expect(layout.pockets["S1·F·2"]).toEqual({
      kind: "card",
      variant: variantZoruaId,
      instance: null,
    });
    expect(layout.pockets["S1·F·3"]).toBeUndefined();
  }).toPass();
});

test('imports with "todas las copias en un bolsillo" as a single pocket with a count badge', async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("3 Zorua TST 2");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await page.getByLabel("Modo de cantidad").selectOption("singleWithCount");
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantZoruaId,
      instance: null,
      count: 3,
    });
    expect(layout.pockets["S1·F·2"]).toBeUndefined();
  }).toPass();
});

test("CSV import with an explicit variant column resolves without ambiguity", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Formato de importación").selectOption("csv");
  await page.getByLabel("Texto a importar").fill("name,set,number,variant,qty\nRiolu,TST,1,holo,1");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByText(/1 resueltas, 0 ambiguas, 0 no encontradas/)).toBeVisible();
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantRioluHoloId,
      instance: null,
    });
  }).toPass();
});

test("ambiguous printing lets the user pick a variant before applying", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("1 Riolu TST 1");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByText(/0 resueltas, 1 ambiguas, 0 no encontradas/)).toBeVisible();

  await page.getByLabel("Elegir impresión para 1 Riolu TST 1").selectOption(variantRioluHoloId);
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·1"]).toEqual({
      kind: "card",
      variant: variantRioluHoloId,
      instance: null,
    });
  }).toPass();
});

test("a not-found line is reported and blocks apply when nothing else resolved", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("3 Pikachu ZZZ 99");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await expect(page.getByText(/0 resueltas, 0 ambiguas, 1 no encontradas/)).toBeVisible();
  await expect(page.getByText(/No se encontró ZZZ 99/)).toBeVisible();

  await page.getByRole("button", { name: "Aplicar importación" }).click();
  await expect(page.getByText("No hay cartas resueltas para importar")).toBeVisible();

  const layout = await readLayout();
  expect(layout).toEqual(emptyLayout());
});

test("a specific destination pocket is respected over the next empty slot", async ({ page }) => {
  await db
    .update(binderVersion)
    .set({
      layout: layoutSchema.parse({
        ...emptyLayout(),
        pockets: { S1·F·1: { kind: "card", variant: variantRioluNormalId, instance: null } },
      }),
    })
    .where(eq(binderVersion.binderId, binderId));

  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("1 Zorua TST 2");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await page.getByLabel("Destino de importación").selectOption("pocket");
  await page.getByLabel("Bolsillo de destino").fill("S1·B·1");
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(async () => {
    const layout = await readLayout();
    expect(layout.pockets["S1·F·2"]).toBeUndefined();
    expect(layout.pockets["S1·B·1"]).toEqual({
      kind: "card",
      variant: variantZoruaId,
      instance: null,
    });
  }).toPass();
});

test("reports a capacity error instead of dropping cards silently", async ({ page }) => {
  await page.goto(`/binders/${binderId}/editar`);
  await page.getByText("Importar cartas").click();
  await page.getByLabel("Texto a importar").fill("9 Riolu TST 1");
  await page.getByRole("button", { name: "Previsualizar" }).click();
  await page.getByRole("button", { name: "Aplicar importación" }).click();

  await expect(page.getByText(/No entran todas las cartas/)).toBeVisible();

  const layout = await readLayout();
  expect(layout).toEqual(emptyLayout());
});

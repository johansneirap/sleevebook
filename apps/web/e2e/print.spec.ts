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
let cardId: string;
let normalVariantId: string;
let reverseVariantId: string;
let binderId: string;

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F3D Print Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F3D Print Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "7", name: "F3D Print Card", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [normalRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  normalVariantId = (normalRow as { id: string }).id;

  const [reverseRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "reverse" })
    .returning({ id: cardVariant.id });
  reverseVariantId = (reverseRow as { id: string }).id;

  const layout = layoutSchema.parse({
    format: { rows: 1, cols: 3 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "placeholder", variant: normalVariantId, style: "ficha" },
      S1·F·2: { kind: "placeholder", variant: reverseVariantId, style: "minimal" },
      S1·F·3: { kind: "card", variant: normalVariantId, instance: null },
    },
  });

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F3D Print Fixture Binder",
      formatRows: 1,
      formatCols: 3,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.cardId, cardId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("/imprimir lists one ficha per placeholder with its pocket code and name", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}/imprimir`);

  const fichas = page.getByTestId("print-ficha");
  await expect(fichas).toHaveCount(2);
  await expect(fichas.nth(0)).toContainText("S1·F·1");
  await expect(fichas.nth(0)).toContainText("F3D Print Card");
  await expect(fichas.nth(1)).toContainText("S1·F·2");
  await expect(fichas.nth(1)).toContainText("F3D Print Card");
});

test("the print stylesheet sizes a ficha at 63 x 88 mm", async ({ page }) => {
  await page.goto(`/binders/${binderId}/imprimir`);
  await page.emulateMedia({ media: "print" });

  const size = await page
    .getByTestId("print-ficha")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: parseFloat(style.width), height: parseFloat(style.height) };
    });
  // 63 mm and 88 mm at 96 dpi: 238.1 px and 332.6 px.
  expect(Math.abs(size.width - 238)).toBeLessThanOrEqual(2);
  expect(Math.abs(size.height - 333)).toBeLessThanOrEqual(2);
});

test("the face image route returns a non-trivial PNG", async ({ request }) => {
  const response = await request.get(`/binders/${binderId}/cara/S1-F/imagen`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect((await response.body()).byteLength).toBeGreaterThan(5000);
  expect(response.headers()["content-disposition"]).toBeUndefined();
});

test("?download=1 makes the face image an attachment", async ({ request }) => {
  const response = await request.get(`/binders/${binderId}/cara/S1-F/imagen?download=1`);
  expect(response.status()).toBe(200);
  const disposition = response.headers()["content-disposition"] ?? "";
  expect(disposition).toContain("attachment");
  expect(disposition).toContain("hoja-1-frente.png");
});

test("an unknown face is a 404", async ({ request }) => {
  const response = await request.get(`/binders/${binderId}/cara/S9-F/imagen`);
  expect(response.status()).toBe(404);
});

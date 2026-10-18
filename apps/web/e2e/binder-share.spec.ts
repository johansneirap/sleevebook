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
  shareLink,
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
let variantId: string;
let binderId: string;

function initialLayout() {
  return layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantId, instance: null },
    },
  });
}

async function resetBinderState() {
  await db.update(binder).set({ status: "draft" }).where(eq(binder.id, binderId));
  await db.delete(shareLink).where(eq(shareLink.binderId, binderId));
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "E2E Share Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "E2E Share Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "E2E Share Card",
      supertype: "Pokémon",
      language: "en",
    })
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
      name: "E2E Share Fixture Binder",
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: initialLayout() });
});

test.beforeEach(async () => {
  await resetBinderState();
});

test.afterAll(async () => {
  await db.delete(shareLink).where(eq(shareLink.binderId, binderId));
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("a non-existent share slug 404s", async ({ page }) => {
  const response = await page.goto("/s/does-not-exist");
  expect(response?.status()).toBe(404);
});

test("publishing exposes the binder on its public link, unpublishing takes it offline", async ({
  page,
}) => {
  await page.goto(`/binders/${binderId}`);
  await page.getByRole("button", { name: "Publicar" }).click();

  await expect(page.getByText(/Publicado \(no listado\)/)).toBeVisible();
  const link = page.getByRole("link", { name: /\/s\// });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/\/s\/[\w-]+$/);
  const slug = href?.split("/s/")[1] as string;

  await page.goto(`/s/${slug}`);
  await expect(page.getByRole("heading", { name: "E2E Share Fixture Binder" })).toBeVisible();

  await page.goto(`/binders/${binderId}`);
  await page.getByRole("button", { name: "Despublicar" }).click();
  await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeVisible();

  const offlineResponse = await page.goto(`/s/${slug}`);
  expect(offlineResponse?.status()).toBe(404);
});

test("changing visibility to público keeps the same slug", async ({ page }) => {
  await page.goto(`/binders/${binderId}`);
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText(/Publicado \(no listado\)/)).toBeVisible();

  const slugBefore = (
    await db
      .select({ slug: shareLink.slug })
      .from(shareLink)
      .where(eq(shareLink.binderId, binderId))
  )[0]?.slug;

  await page.getByLabel("Visibilidad").selectOption("public");
  await page.getByRole("button", { name: "Actualizar" }).click();
  await expect(page.getByText(/Publicado \(público\)/)).toBeVisible();

  const slugAfter = (
    await db
      .select({ slug: shareLink.slug })
      .from(shareLink)
      .where(eq(shareLink.binderId, binderId))
  )[0]?.slug;
  expect(slugAfter).toBe(slugBefore);
});

test("the public page's OG image endpoint responds with an image", async ({ page, request }) => {
  await page.goto(`/binders/${binderId}`);
  await page.getByRole("button", { name: "Publicar" }).click();
  const href = await page.getByRole("link", { name: /\/s\// }).getAttribute("href");
  const slug = href?.split("/s/")[1] as string;

  const response = await request.get(`/s/${slug}/opengraph-image`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

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

// Every fixture name/slug uses the F3E prefix (shared local DB, parallel agents).
const runId = Math.random().toString(16).slice(2, 10);
const publishedSlug = `f3e-embed-${runId}`;
const draftSlug = `f3e-draft-${runId}`;

let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
let publishedBinderId: string;
let draftBinderId: string;

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

async function createBinder(name: string, status: "published" | "draft", slug: string) {
  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name,
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status,
    })
    .returning({ id: binder.id });
  const binderId = (binderRow as { id: string }).id;
  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: initialLayout() });
  await db.insert(shareLink).values({ binderId, slug, visibility: "unlisted" });
  return binderId;
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F3E Embed Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F3E Embed Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({ setId, number: "1", name: "F3E Embed Card", supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "normal" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  publishedBinderId = await createBinder("F3E Embed Fixture Binder", "published", publishedSlug);
  draftBinderId = await createBinder("F3E Draft Fixture Binder", "draft", draftSlug);
});

test.afterAll(async () => {
  await db.delete(shareLink).where(eq(shareLink.slug, publishedSlug));
  await db.delete(shareLink).where(eq(shareLink.slug, draftSlug));
  await db.delete(binder).where(eq(binder.id, publishedBinderId));
  await db.delete(binder).where(eq(binder.id, draftBinderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

test("the embed route renders the published binder closed, without the site chrome", async ({
  page,
}) => {
  const response = await page.goto(`/e/${publishedSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "F3E Embed Fixture Binder" })).toBeVisible();
  await expect(page.getByTestId("closed-binder")).toBeVisible();

  const sharePageLink = page.getByRole("link", { name: "Ver en Sleevebook" });
  await expect(sharePageLink).toHaveAttribute("href", `/s/${publishedSlug}`);
  await expect(sharePageLink).toHaveAttribute("target", "_blank");
});

test("the embed route can be framed from anywhere", async ({ request }) => {
  const response = await request.get(`/e/${publishedSlug}`);
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors *");
  expect(response.headers()["x-frame-options"]).toBeUndefined();
});

test("the rest of the app only allows same-origin framing", async ({ request }) => {
  const response = await request.get("/binders");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
});

test("viewing the embed does not count as a share view", async ({ request }) => {
  const readViews = async () =>
    (
      await db
        .select({ views: shareLink.views })
        .from(shareLink)
        .where(eq(shareLink.slug, publishedSlug))
    )[0]?.views;

  const before = await readViews();
  await request.get(`/e/${publishedSlug}`);
  expect(await readViews()).toBe(before);
});

test("the QR route returns an SVG of the public link by default", async ({ request }) => {
  const response = await request.get(`/s/${publishedSlug}/qr`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
});

test("the QR route returns a PNG with ?format=png and an attachment with ?download=1", async ({
  request,
}) => {
  const png = await request.get(`/s/${publishedSlug}/qr?format=png`);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toContain("image/png");

  const download = await request.get(`/s/${publishedSlug}/qr?download=1`);
  expect(download.headers()["content-disposition"]).toBe(
    `attachment; filename="sleevebook-${publishedSlug}-qr.svg"`,
  );
});

test("unknown slugs 404 on the embed and QR routes", async ({ request }) => {
  const unknown = `f3e-missing-${runId}`;
  expect((await request.get(`/e/${unknown}`)).status()).toBe(404);
  expect((await request.get(`/s/${unknown}/qr`)).status()).toBe(404);
});

test("an unpublished binder's slug 404s on the embed and QR routes", async ({ request }) => {
  await db.update(binder).set({ status: "draft" }).where(eq(binder.id, publishedBinderId));
  try {
    expect((await request.get(`/e/${publishedSlug}`)).status()).toBe(404);
    expect((await request.get(`/s/${publishedSlug}/qr`)).status()).toBe(404);
  } finally {
    await db.update(binder).set({ status: "published" }).where(eq(binder.id, publishedBinderId));
  }
});

test("a draft binder's share slug 404s on the embed and QR routes", async ({ request }) => {
  expect((await request.get(`/e/${draftSlug}`)).status()).toBe(404);
  expect((await request.get(`/s/${draftSlug}/qr`)).status()).toBe(404);
});

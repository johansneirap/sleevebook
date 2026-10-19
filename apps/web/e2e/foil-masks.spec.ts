import { expect, test } from "@playwright/test";
import { defaultFoilMask, foilMaskSchema } from "@sleevebook/binder-core";
import { card, cardVariant, createDb, foilMask, game, set } from "@sleevebook/db";
import { eq } from "drizzle-orm";

// Fase 5 / N4: admin foil mask editor. The e2e dev user is not an admin (no
// OWNER_EMAIL in e2e), so the editor itself is covered by unit tests of the pure
// helpers in packages/binder-core and by a manual visual check. These specs
// cover the access rules and the stored-mask contract.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

const GAME_NAME = "F5B Foil Fixture Game";
let gameId: string;
let setId: string;
let cardId: string;
let variantId: string;
let secondVariantId: string;

test.beforeAll(async () => {
  const [gameRow] = await db.insert(game).values({ name: GAME_NAME }).returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F5B Foil Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "F5B Foil Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "holo" })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const [secondRow] = await db
    .insert(cardVariant)
    .values({ cardId, variant: "reverse" })
    .returning({ id: cardVariant.id });
  secondVariantId = (secondRow as { id: string }).id;
});

test.afterAll(async () => {
  await db.delete(foilMask).where(eq(foilMask.variantId, variantId));
  await db.delete(foilMask).where(eq(foilMask.variantId, secondVariantId));
  await db.delete(cardVariant).where(eq(cardVariant.cardId, cardId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
});

test.describe("admin foil mask pages (non-admin dev user)", () => {
  test("the list is a 404 for a signed-in non-admin", async ({ page }) => {
    const response = await page.goto("/admin/mascaras");
    expect(response?.status()).toBe(404);
  });

  test("the editor is a 404 for a signed-in non-admin, even for a foil variant", async ({
    page,
  }) => {
    const response = await page.goto(`/admin/mascaras/${variantId}`);
    expect(response?.status()).toBe(404);
  });

  test("the editor is a 404 for a malformed id", async ({ page }) => {
    const response = await page.goto("/admin/mascaras/no-es-un-uuid");
    expect(response?.status()).toBe(404);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the list sends a signed-out visitor to /entrar", async ({ page }) => {
    await page.goto("/admin/mascaras");
    await expect(page).toHaveURL(/\/entrar/);
  });
});

test.describe("stored foil masks", () => {
  test("a valid foil_mask row round-trips and passes foilMaskSchema", async () => {
    const mask = { mode: "inside", zones: [{ x: 0.08, y: 0.1, w: 0.84, h: 0.42 }] };
    expect(foilMaskSchema.safeParse(mask).success).toBe(true);

    await db
      .insert(foilMask)
      .values({ variantId, mask })
      .onConflictDoUpdate({ target: foilMask.variantId, set: { mask } });

    const [row] = await db.select().from(foilMask).where(eq(foilMask.variantId, variantId));
    expect(row).toBeDefined();
    expect(foilMaskSchema.parse(row?.mask)).toEqual(mask);
  });

  test("a stored row that breaks the contract is rejected by the loader's schema", async () => {
    const broken = { mode: "sparkly", zones: [{ x: 2, y: 0, w: 0.5, h: 0.5 }] };
    await db
      .insert(foilMask)
      .values({ variantId: secondVariantId, mask: broken })
      .onConflictDoUpdate({ target: foilMask.variantId, set: { mask: broken } });

    const [row] = await db.select().from(foilMask).where(eq(foilMask.variantId, secondVariantId));
    expect(foilMaskSchema.safeParse(row?.mask).success).toBe(false);
    // The loader then falls back to the default for that variant.
    expect(defaultFoilMask("reverse").mode).toBe("outside");
  });
});

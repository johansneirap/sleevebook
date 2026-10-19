import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { createEmptyLayout, formatPocketCode, layoutSchema } from "@sleevebook/binder-core";
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
  user,
} from "@sleevebook/db";
import { desc, eq, inArray } from "drizzle-orm";
import { createTestUser } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Chromium's fake camera (a moving test pattern) with permission granted up
// front. Must be set at file level: launch options force a new worker.
test.use({
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

// Every fixture name, email and id starts with f5c so the shared dev DB stays clean.
// Playwright runs from apps/web (see playwright.config.ts), so the path is stable.
const FIXTURE_PHOTO = join(process.cwd(), "e2e", "fixtures", "f5c-carta.jpg");
const OTHER_ID = "f5c-other-user";
const OTHER_EMAIL = "f5c-other@sleevebook.local";
const DISABLED_TEXT = "El escaneo aún no está disponible";

let gameId: string;
let setId: string;
const variantIds: string[] = [];
let binderId: string;
let fullBinderId: string;
let otherBinderId: string;

/** Adds a card with one variant to the F5C set and returns the variant id. */
async function addVariant(name: string, number: string): Promise<string> {
  const [cardRow] = await db
    .insert(card)
    .values({ setId, number, name, supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  const [variantRow] = await db
    .insert(cardVariant)
    .values({ cardId: (cardRow as { id: string }).id, variant: "normal" })
    .returning({ id: cardVariant.id });
  const id = (variantRow as { id: string }).id;
  variantIds.push(id);
  return id;
}

/**
 * Server action id of placeScannedCard, read from Next's server reference
 * manifest. Calling the action directly keeps the test on the real server
 * code path (session check, layout read, write) without the scan backend.
 */
function placementActionId(): string {
  // `next dev` writes the manifest under .next/dev, `next build` under .next.
  const candidates = [
    join(process.cwd(), ".next", "dev", "server", "server-reference-manifest.json"),
    join(process.cwd(), ".next", "server", "server-reference-manifest.json"),
  ];
  const manifestPath = candidates.find((path) => existsSync(path));
  if (!manifestPath) {
    throw new Error("server reference manifest not found; load /escanear once before this test");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    node: Record<string, { exportedName?: string; filename?: string }>;
  };
  const match = Object.entries(manifest.node).find(
    ([, value]) =>
      value.exportedName === "placeScannedCard" &&
      String(value.filename ?? "").includes("scan-placement-actions"),
  );
  if (!match) {
    throw new Error("placeScannedCard is missing from the server reference manifest");
  }
  return match[0];
}

interface PlacementReply {
  status?: string;
  pocketCode?: string;
  spread?: number;
}

/** Calls placeScannedCard as the signed-in request context and parses the reply. */
async function callPlacement(
  request: APIRequestContext,
  targetBinderId: string,
  variant: string,
): Promise<{ ok: boolean; body: string; reply: PlacementReply | null }> {
  // Rendering the page once makes the dev server compile the action and write its manifest.
  await request.get("/escanear");
  const response = await request.post("/escanear", {
    headers: {
      accept: "text/x-component",
      "content-type": "text/plain;charset=UTF-8",
      "next-action": placementActionId(),
    },
    data: JSON.stringify([targetBinderId, variant]),
  });
  const body = await response.text();
  // The RSC reply carries the action result as a JSON line.
  const line = body.split("\n").find((entry) => entry.includes('"status"'));
  const json = line?.slice(line.indexOf("{")) ?? null;
  let reply: PlacementReply | null = null;
  if (json) {
    try {
      reply = JSON.parse(json) as PlacementReply;
    } catch {
      reply = null;
    }
  }
  return { ok: response.ok(), body, reply };
}

/** The binder's latest layout, as the placement action reads it. */
async function layoutOf(id: string) {
  const [row] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, id))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  return layoutSchema.parse(row?.layout);
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F5C Escaneo Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;
  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F5C Escaneo Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const alfa = await addVariant("F5C Alfa", "1");
  await addVariant("F5C Beta", "2");

  // 2x2 binder, one sheet: S1·F·1 holds Alfa, so the first empty pocket is S1·F·2.
  const partial = createEmptyLayout({ rows: 2, cols: 2 }, 1);
  partial.pockets[formatPocketCode({ sheet: 1, side: "F", index: 1 })] = {
    kind: "card",
    variant: alfa,
    instance: null,
  };
  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F5C Escaneo Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "published",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;
  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout: partial });

  // 1x1 binder with both pockets taken: nothing free.
  const full = createEmptyLayout({ rows: 1, cols: 1 }, 1);
  for (const side of ["F", "B"] as const) {
    full.pockets[formatPocketCode({ sheet: 1, side, index: 1 })] = {
      kind: "card",
      variant: alfa,
      instance: null,
    };
  }
  const [fullRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F5C Full Binder",
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "published",
    })
    .returning({ id: binder.id });
  fullBinderId = (fullRow as { id: string }).id;
  await db.insert(binderVersion).values({ binderId: fullBinderId, versionNumber: 1, layout: full });

  // A binder that belongs to someone else, for the ownership check.
  await createTestUser(db, {
    id: OTHER_ID,
    email: OTHER_EMAIL,
    handle: "f5c-otra",
    name: "F5C Otra Persona",
  });
  const [otherRow] = await db
    .insert(binder)
    .values({
      userId: OTHER_ID,
      name: "F5C Other Binder",
      formatRows: 2,
      formatCols: 2,
      sheets: 1,
      status: "published",
    })
    .returning({ id: binder.id });
  otherBinderId = (otherRow as { id: string }).id;
  await db
    .insert(binderVersion)
    .values({
      binderId: otherBinderId,
      versionNumber: 1,
      layout: createEmptyLayout({ rows: 2, cols: 2 }, 1),
    });
});

test.afterAll(async () => {
  await db.delete(binder).where(inArray(binder.id, [binderId, fullBinderId, otherBinderId]));
  if (variantIds.length > 0) {
    await db.delete(cardVariant).where(inArray(cardVariant.id, variantIds));
  }
  if (setId) {
    await db.delete(card).where(eq(card.setId, setId));
    await db.delete(set).where(eq(set.id, setId));
  }
  if (gameId) {
    await db.delete(game).where(eq(game.id, gameId));
  }
  await db.delete(user).where(eq(user.id, OTHER_ID));
});

test.describe("camera and upload", () => {
  test("captures from the camera and reports that scanning is not available yet", async ({
    page,
  }) => {
    await page.goto("/escanear");
    const capture = page.getByRole("button", { name: "Capturar", exact: true });
    await expect(capture).toBeEnabled({ timeout: 20_000 });
    await expect(page.getByText("Encuadra la carta dentro del marco")).toBeVisible();

    await capture.click();
    await expect(page.getByText(DISABLED_TEXT)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Escanear otra", exact: true }).click();
    await expect(page.getByRole("button", { name: "Capturar", exact: true })).toBeEnabled();
  });

  test("uploads a photo through the file alternative", async ({ page }) => {
    await page.goto("/escanear");
    await page.getByLabel("Subir una foto").setInputFiles(FIXTURE_PHOTO);
    await expect(page.getByText(DISABLED_TEXT)).toBeVisible({ timeout: 20_000 });
  });

  test("explains a denied camera and keeps the upload alternative", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.goto("/escanear");
    await expect(page.getByText(/No tenemos permiso para usar la cámara/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Subir una foto")).toBeAttached();
  });
});

test.describe("placement action", () => {
  test("puts a variant in the first empty pocket of the binder", async ({ request }) => {
    const beta = variantIds[1] as string;
    const result = await callPlacement(request, binderId, beta);

    expect(result.ok).toBe(true);
    expect(result.reply?.status).toBe("placed");
    expect(result.reply?.pocketCode).toBe(formatPocketCode({ sheet: 1, side: "F", index: 2 }));
    expect(result.reply?.spread).toBe(0);

    const layout = await layoutOf(binderId);
    expect(layout.pockets[formatPocketCode({ sheet: 1, side: "F", index: 2 })]).toEqual({
      kind: "card",
      variant: beta,
      instance: null,
    });
  });

  test("reports a full binder without changing it", async ({ request }) => {
    const before = await layoutOf(fullBinderId);
    const result = await callPlacement(request, fullBinderId, variantIds[1] as string);

    expect(result.reply?.status).toBe("full");
    expect(await layoutOf(fullBinderId)).toEqual(before);
  });

  test("refuses to write into a binder owned by someone else", async ({ request }) => {
    // Signed in as the dev user, aiming at another user's binder.
    const before = await layoutOf(otherBinderId);

    const result = await callPlacement(request, otherBinderId, variantIds[0] as string);

    expect(result.reply?.status).not.toBe("placed");
    expect(await layoutOf(otherBinderId)).toEqual(before);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects to /entrar", async ({ page }) => {
    await page.goto("/escanear");
    await expect(page).toHaveURL(/\/entrar/);
  });
});

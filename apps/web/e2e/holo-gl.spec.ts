import { deflateSync } from "node:zlib";
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
let variantId: string;
let binderId: string;

// A small RGB PNG with a colour gradient and dark stripes, so the relief and
// foil have something to act on. Built in memory: no network dependency.
function makePngDataUrl(width: number, height: number): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) {
      c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const stripe = Math.floor(y / 6) % 3 === 0 ? 40 : 0;
      const offset = rowStart + 1 + x * 3;
      raw[offset] = Math.round((x / width) * 255) - stripe;
      raw[offset + 1] = Math.round((y / height) * 200) + 30;
      raw[offset + 2] = 180 - stripe;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

test.beforeAll(async () => {
  await ensureDevUser(db);

  const [gameRow] = await db
    .insert(game)
    .values({ name: "F5a Holo GL Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  const [setRow] = await db
    .insert(set)
    .values({ gameId, name: "F5a Holo GL Fixture Set", language: "en" })
    .returning({ id: set.id });
  setId = (setRow as { id: string }).id;

  const [cardRow] = await db
    .insert(card)
    .values({
      setId,
      number: "1",
      name: "F5a Holo Card",
      supertype: "Pokémon",
      language: "en",
    })
    .returning({ id: card.id });
  cardId = (cardRow as { id: string }).id;

  const [variantRow] = await db
    .insert(cardVariant)
    .values({
      cardId,
      variant: "holo",
      images: { "pokemontcg.io": { large: makePngDataUrl(146, 204) } },
    })
    .returning({ id: cardVariant.id });
  variantId = (variantRow as { id: string }).id;

  const layout = layoutSchema.parse({
    format: { rows: 1, cols: 1 },
    opening: "side",
    sheets: 1,
    theme: { preset: "default", sleeve: "clear" },
    pockets: {
      S1·F·1: { kind: "card", variant: variantId, instance: null },
    },
  });

  const [binderRow] = await db
    .insert(binder)
    .values({
      userId: DEV_USER_ID,
      name: "F5a Holo GL Fixture Binder",
      formatRows: 1,
      formatCols: 1,
      sheets: 1,
      status: "draft",
    })
    .returning({ id: binder.id });
  binderId = (binderRow as { id: string }).id;

  await db.insert(binderVersion).values({ binderId, versionNumber: 1, layout });
});

test.afterAll(async () => {
  await db.delete(binder).where(eq(binder.id, binderId));
  await db.delete(cardVariant).where(eq(cardVariant.id, variantId));
  await db.delete(card).where(eq(card.id, cardId));
  await db.delete(set).where(eq(set.id, setId));
  await db.delete(game).where(eq(game.id, gameId));
  await db.$client.end();
});

const CARD_NAME = /F5a Holo Card/;

async function openFocusedCard(page: import("@playwright/test").Page) {
  await page.goto(`/binders/${binderId}?spread=0`);
  await page.getByRole("button", { name: CARD_NAME }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("focused-card")).toBeVisible();
  return dialog;
}

test("the focused holo card is drawn on a WebGL canvas inside the dialog", async ({ page }) => {
  const dialog = await openFocusedCard(page);
  const canvas = dialog.getByTestId("holo-gl");
  await expect(canvas).toBeVisible();
  // The canvas backing store is set from the card size; it must not be empty.
  await expect
    .poll(async () => canvas.evaluate((el) => (el as HTMLCanvasElement).width))
    .toBeGreaterThan(0);

  // The image loads through the data URL and the shader keeps running: a
  // pointer move over the card must leave the canvas in place.
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("holo canvas has no box");
  }
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, { steps: 5 });
  await expect(canvas).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(canvas).toBeVisible();
});

test.describe("holo gl (reduced motion)", () => {
  test.use({ reducedMotion: "reduce" });

  test("still renders the WebGL canvas, without tilt", async ({ page }) => {
    const dialog = await openFocusedCard(page);
    const canvas = dialog.getByTestId("holo-gl");
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => canvas.evaluate((el) => (el as HTMLCanvasElement).width))
      .toBeGreaterThan(0);
    // Reduced motion: the tilt transform stays at rest even under a pointer move.
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("holo canvas has no box");
    }
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
    // The wrapper's transform is written every frame; with no tilt it is all zeros.
    await expect
      .poll(async () => canvas.evaluate((el) => (el.parentElement as HTMLElement).style.transform))
      .toMatch(/^rotateX\(0(deg)?\) rotateY\(0(deg)?\)$/);
  });
});

test.describe("holo gl (WebGL unavailable)", () => {
  test.beforeEach(async ({ page }) => {
    // Stub WebGL out before the app runs: every context request returns null.
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = () => null;
    });
  });

  test("falls back to the CSS holo card", async ({ page }) => {
    const dialog = await openFocusedCard(page);
    await expect(dialog.getByTestId("holo-gl")).toHaveCount(0);
    await expect(dialog.getByRole("img", { name: CARD_NAME })).toBeVisible();
  });
});

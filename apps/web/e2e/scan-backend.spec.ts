import { expect, test } from "@playwright/test";
import { card, cardVariant, createDb, game, scanLog, set, user } from "@sleevebook/db";
import { eq, inArray } from "drizzle-orm";
import { countScansToday, startOfLocalDay } from "../src/lib/scan-limit";
import { findScanCandidates } from "../src/lib/scan-match-db";
import { createTestUser } from "./auth-helpers";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
const db = createDb(databaseUrl);

// Every fixture starts with F5D so the shared dev DB stays clean.
const SCAN_USER_ID = "f5d-scan-user";
const SCAN_USER_EMAIL = "f5d-scan@sleevebook.test";
const SCAN_USER_HANDLE = "f5d-scan";

let gameId: string;
let setAId: string;
let setBId: string;
const cardIds: string[] = [];

async function addCard(
  setId: string,
  name: string,
  number: string,
  variants: string[],
): Promise<string> {
  const [cardRow] = await db
    .insert(card)
    .values({ setId, number, name, supertype: "Pokémon", language: "en" })
    .returning({ id: card.id });
  const cardId = (cardRow as { id: string }).id;
  cardIds.push(cardId);
  await db.insert(cardVariant).values(variants.map((variant) => ({ cardId, variant })));
  return cardId;
}

test.beforeAll(async () => {
  const [gameRow] = await db
    .insert(game)
    .values({ name: "F5D Scan Fixture Game" })
    .returning({ id: game.id });
  gameId = (gameRow as { id: string }).id;

  // Same card number and name in two sets: the printed total tells them apart.
  const [setA] = await db
    .insert(set)
    .values({
      gameId,
      name: "F5D Scan Fixture Set",
      printedTotal: 198,
      language: "en",
    })
    .returning({ id: set.id });
  setAId = (setA as { id: string }).id;

  const [setB] = await db
    .insert(set)
    .values({
      gameId,
      name: "F5D Scan Other Set",
      printedTotal: 102,
      language: "en",
    })
    .returning({ id: set.id });
  setBId = (setB as { id: string }).id;

  await addCard(setAId, "F5D Zarbonix", "112", ["normal", "holo"]);
  await addCard(setBId, "F5D Zarbonix", "112", ["normal"]);
  await addCard(setAId, "F5D Quelvír", "12", ["normal"]);

  await createTestUser(db, {
    id: SCAN_USER_ID,
    email: SCAN_USER_EMAIL,
    handle: SCAN_USER_HANDLE,
  });
});

test.afterAll(async () => {
  // scan_log rows go with the user (cascade).
  await db.delete(user).where(eq(user.id, SCAN_USER_ID));
  if (cardIds.length > 0) {
    await db.delete(cardVariant).where(inArray(cardVariant.cardId, cardIds));
    await db.delete(card).where(inArray(card.id, cardIds));
  }
  await db.delete(set).where(inArray(set.id, [setAId, setBId]));
  await db.delete(game).where(eq(game.id, gameId));
});

test.describe("scan matching against the catalog", () => {
  test("uses number, printed total and finish to pick the right variant", async () => {
    const candidates = await findScanCandidates(db, {
      name: "F5D Zarbonix",
      number: "112",
      setTotal: "198",
      finish: "holo",
    });

    expect(candidates[0]?.setName).toBe("F5D Scan Fixture Set");
    expect(candidates[0]?.variant).toBe("holo");
    expect(candidates[0]?.score).toBe(1);
    // Both variants of the matching card come back, the matching finish first.
    expect(candidates.slice(0, 2).map((c) => c.variant)).toEqual(["holo", "normal"]);
    // The same name and number in the other set scores lower.
    const other = candidates.find((c) => c.setName === "F5D Scan Other Set");
    expect(other).toBeDefined();
    expect(other?.score ?? 1).toBeLessThan(0.8);
  });

  test("folds accents so a reading without them still finds the card", async () => {
    const candidates = await findScanCandidates(db, {
      name: "F5D Quelvir",
      number: "12",
      setTotal: "198",
    });
    // The shared catalog also has real cards with number 12; only ours is exact.
    expect(candidates[0]?.name).toBe("F5D Quelvír");
    expect(candidates[0]?.score).toBe(1);
    expect(candidates.filter((c) => c.score >= 0.8)).toHaveLength(1);
  });

  test("returns nothing when no catalog card fits", async () => {
    expect(
      await findScanCandidates(db, { name: "F5D Nadaexiste", number: "999", setTotal: "198" }),
    ).toEqual([]);
  });
});

test.describe("daily scan limit", () => {
  test("counts today's scans in Chile local time, not UTC", async () => {
    // 2026-10-19 is in Chile's summer time (UTC-3): local midnight is 03:00Z.
    const now = new Date("2026-10-19T15:00:00Z");
    expect(startOfLocalDay(now).toISOString()).toBe("2026-10-19T03:00:00.000Z");
    expect(startOfLocalDay(new Date("2026-10-19T02:30:00Z")).toISOString()).toBe(
      "2026-10-18T03:00:00.000Z",
    );

    await db.insert(scanLog).values([
      // Local Oct 18, 23:59: yesterday in Chile, not counted.
      { userId: SCAN_USER_ID, status: "ok", createdAt: new Date("2026-10-19T02:59:00Z") },
      // Local Oct 19, 00:01: counted.
      { userId: SCAN_USER_ID, status: "no-card", createdAt: new Date("2026-10-19T03:01:00Z") },
      // Counted, even though it was an error.
      { userId: SCAN_USER_ID, status: "error", createdAt: new Date("2026-10-19T14:00:00Z") },
    ]);

    expect(await countScansToday(db, SCAN_USER_ID, now)).toBe(2);
    // At 02:00Z it is still Oct 18 in Chile, so today starts at Oct 18 03:00Z and
    // the 02:59Z row (Oct 18 23:59 local) is in it too.
    expect(await countScansToday(db, SCAN_USER_ID, new Date("2026-10-19T02:00:00Z"))).toBe(3);
  });
});

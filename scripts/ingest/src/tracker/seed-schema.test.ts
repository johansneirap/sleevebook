import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSeedTracker } from "./seed-schema";

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sleevebook-tracker-seed-test-"));
  filePath = join(dir, "master-sets.json");
  await writeFile(
    filePath,
    JSON.stringify({
      version: 1,
      generated: "2026-10-13",
      description: "test fixture",
      goals: [
        {
          id: "zoroark",
          name: "Zorua / Zoroark",
          format: { rows: 3, cols: 3 },
          sheets: 20,
          cards: [
            {
              key: "bw1-70.n",
              name: "Zorua",
              set: "Black & White",
              number: "70/114",
              year: "2011",
              rarity: "Common",
              variant: "Normal",
              special: false,
              variantToConfirm: false,
              refPriceUsd: null,
              image: "https://images.pokemontcg.io/bw1/70_hires.png",
              pocket: "S1·B·7",
            },
          ],
        },
      ],
    }),
  );
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadSeedTracker", () => {
  it("parses a valid seed file", async () => {
    const seed = await loadSeedTracker(filePath);
    expect(seed.goals).toHaveLength(1);
    expect(seed.goals[0]?.cards).toHaveLength(1);
    expect(seed.goals[0]?.cards[0]?.key).toBe("bw1-70.n");
  });
});

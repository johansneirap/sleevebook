import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCatalogSource } from "./source.js";

let extractedDir: string;

beforeEach(async () => {
  extractedDir = await mkdtemp(join(tmpdir(), "sleevebook-ingest-test-"));
  const root = join(extractedDir, "pokemon-tcg-data-master");
  await mkdir(join(root, "sets"), { recursive: true });
  await mkdir(join(root, "cards", "en"), { recursive: true });

  await writeFile(
    join(root, "sets", "en.json"),
    JSON.stringify([{ id: "base1", name: "Base", series: "Base", ptcgoCode: "BS" }]),
  );
  await writeFile(
    join(root, "cards", "en", "base1.json"),
    JSON.stringify([
      { id: "base1-4", name: "Charizard", supertype: "Pokémon", number: "4", rarity: "Rare Holo" },
    ]),
  );
});

afterEach(async () => {
  await rm(extractedDir, { recursive: true, force: true });
});

describe("loadCatalogSource", () => {
  it("reads sets and cards from the extracted repository layout", async () => {
    const source = await loadCatalogSource(extractedDir);

    expect(source.sets).toHaveLength(1);
    expect(source.sets[0]?.id).toBe("base1");

    const cards = source.cardsBySetId.get("base1");
    expect(cards).toHaveLength(1);
    expect(cards?.[0]?.name).toBe("Charizard");
  });
});

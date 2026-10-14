import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const rawSetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    series: z.string().optional(),
    printedTotal: z.number().optional(),
    ptcgoCode: z.string().optional(),
    releaseDate: z.string().optional(),
  })
  .loose();

const tcgplayerPriceSchema = z
  .object({
    market: z.number().nullable().optional(),
    mid: z.number().nullable().optional(),
  })
  .loose();

const rawCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    supertype: z.string(),
    types: z.array(z.string()).optional(),
    number: z.string(),
    artist: z.string().optional(),
    rarity: z.string().optional(),
    images: z
      .object({
        small: z.string().optional(),
        large: z.string().optional(),
      })
      .optional(),
    tcgplayer: z
      .object({
        prices: z.record(z.string(), tcgplayerPriceSchema).optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export type RawSet = z.infer<typeof rawSetSchema>;
export type RawCard = z.infer<typeof rawCardSchema>;

export interface CatalogSource {
  sets: RawSet[];
  cardsBySetId: Map<string, RawCard[]>;
}

async function findExtractedRoot(extractedDir: string): Promise<string> {
  const entries = await readdir(extractedDir, { withFileTypes: true });
  const repoDir = entries.find((entry) => entry.isDirectory());
  if (!repoDir) {
    throw new Error(`No extracted repository directory found under ${extractedDir}`);
  }
  return join(extractedDir, repoDir.name);
}

export async function loadCatalogSource(extractedDir: string): Promise<CatalogSource> {
  const root = await findExtractedRoot(extractedDir);

  const setsRaw = JSON.parse(await readFile(join(root, "sets", "en.json"), "utf-8"));
  const sets = z.array(rawSetSchema).parse(setsRaw);

  const cardsBySetId = new Map<string, RawCard[]>();
  const cardsDir = join(root, "cards", "en");
  const cardFiles = await readdir(cardsDir);

  for (const file of cardFiles) {
    if (!file.endsWith(".json")) {
      continue;
    }
    const setId = file.slice(0, -".json".length);
    const cardsRaw = JSON.parse(await readFile(join(cardsDir, file), "utf-8"));
    cardsBySetId.set(setId, z.array(rawCardSchema).parse(cardsRaw));
  }

  return { sets, cardsBySetId };
}

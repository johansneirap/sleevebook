import {
  normalizeScanNumber,
  normalizeScanText,
  rankScanCandidates,
  type ScanCatalogRow,
  type ScanMatch,
  type ScanReadingInput,
} from "@sleevebook/binder-core";
import { card, cardVariant, type Database, set } from "@sleevebook/db";
import { eq, inArray, or, sql } from "drizzle-orm";
import { extractImageUrl } from "./binders";

// Upper bound on rows fetched before ranking in memory.
const POOL_LIMIT = 400;
// Accented letters folded to ASCII so "Pokemon" finds "Pokémon" in SQL.
const ACCENTS_FROM = "àáâäãèéêëìíîïòóôöõùúûüñÀÁÂÄÃÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÑ";
const ACCENTS_TO = "aaaaaeeeeiiiiooooouuuunAAAAAEEEEIIIIOOOOOUUUUN";

/** "TG5" -> ["TG5", "TG05", "TG005"]: the spellings a printed number may take. */
function numberSpellings(key: string): string[] {
  const match = /^([A-Z]*)(\d+)([A-Z]*)$/.exec(key);
  if (!match) {
    return [key];
  }
  const [, prefix = "", digits = "", suffix = ""] = match;
  const spellings = new Set<string>();
  for (const width of [1, 2, 3]) {
    spellings.add(`${prefix}${digits.padStart(width, "0")}${suffix}`);
  }
  return [...spellings];
}

/** The longest word of the name that identifies the character, if any. */
function nameKeyword(name: string): string | null {
  const tokens = normalizeScanText(name)
    .split(" ")
    .filter((token) => token.length >= 3);
  tokens.sort((a, b) => b.length - a.length);
  return tokens[0] ?? null;
}

/**
 * Finds catalog variants that could be the card in `reading` and ranks them.
 * Pool: cards whose name contains the reading's keyword, or whose printed
 * number matches. Scoring lives in @sleevebook/binder-core (rankScanCandidates).
 */
export async function findScanCandidates(
  db: Database,
  reading: ScanReadingInput,
): Promise<ScanMatch[]> {
  const numberKey = normalizeScanNumber(reading.number);
  const keyword = nameKeyword(reading.name);

  const conditions = [];
  if (keyword) {
    conditions.push(
      sql`translate(${card.name}, ${ACCENTS_FROM}, ${ACCENTS_TO}) ilike ${`%${keyword}%`}`,
    );
  }
  if (numberKey) {
    conditions.push(inArray(card.number, numberSpellings(numberKey)));
  }
  if (conditions.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      variantId: cardVariant.id,
      cardId: card.id,
      cardName: card.name,
      number: card.number,
      setName: set.name,
      printedTotal: set.printedTotal,
      variant: cardVariant.variant,
      images: cardVariant.images,
    })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .limit(POOL_LIMIT);

  const catalog: ScanCatalogRow[] = rows.map((row) => ({
    variantId: row.variantId,
    cardId: row.cardId,
    cardName: row.cardName,
    number: row.number,
    setName: row.setName,
    printedTotal: row.printedTotal,
    variant: row.variant,
    imageUrl: extractImageUrl(row.images),
  }));

  return rankScanCandidates(reading, catalog);
}

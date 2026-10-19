// Fase 5 -- scan matching: scores catalog rows against what Claude Vision read
// off a photo. Pure, so it can be unit-tested without a database.

/** What the model read; nullable fields are "not visible on the card". */
export interface ScanReadingInput {
  name: string;
  number?: string | null;
  setName?: string | null;
  setTotal?: string | null;
  finish?: string | null;
}

/** One catalog variant joined with its card and set. */
export interface ScanCatalogRow {
  variantId: string;
  cardId: string;
  cardName: string;
  number: string;
  setName: string;
  printedTotal: number | null;
  variant: string;
  imageUrl: string | null;
}

export interface ScanMatch {
  variantId: string;
  name: string;
  setName: string;
  number: string;
  variant: string;
  imageUrl: string | null;
  /** 0..1 */
  score: number;
}

export const SCAN_MAX_CANDIDATES = 6;
/** A top candidate at or above this score is recorded as the scan's match. */
export const SCAN_MATCH_THRESHOLD = 0.8;

// Words that are part of a printed name but don't identify the character
// ("Lucario ex" -> "lucario", "Mega Lucario" -> "lucario").
const MODIFIER_TOKENS = new Set([
  "ex",
  "gx",
  "v",
  "vmax",
  "vstar",
  "lv",
  "x",
  "mega",
  "break",
  "prime",
  "star",
  "tag",
  "team",
  "rockets",
  "shiny",
  "radiant",
  "amazing",
]);

/** Lowercase, no diacritics, punctuation as spaces: "Pokémon LV.X" -> "pokemon lv x". */
export function normalizeScanText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Collector number without spaces, upper case, leading zeros dropped: "012" -> "12", "tg05" -> "TG5", "112/198" -> "112". */
export function normalizeScanNumber(raw: string | null | undefined): string | null {
  const head = (raw ?? "").split("/")[0] ?? "";
  const compact = head.replace(/\s+/g, "").toUpperCase();
  if (!compact) {
    return null;
  }
  const match = /^([A-Z]*)(\d+)([A-Z]*)$/.exec(compact);
  if (!match) {
    return compact;
  }
  return `${match[1]}${Number(match[2])}${match[3]}`;
}

/** Printed set total as a plain number string: "198" -> "198", "0198" -> "198". */
export function normalizeScanSetTotal(raw: string | null | undefined): string | null {
  const digits = /\d+/.exec(raw ?? "");
  return digits ? String(Number(digits[0])) : null;
}

/** 1 when the names are the same, 0.6 when they share the character name, else 0. */
function scoreName(readingName: string, cardName: string): number {
  const reading = normalizeScanText(readingName);
  const card = normalizeScanText(cardName);
  if (!reading || !card) {
    return 0;
  }
  if (reading === card) {
    return 1;
  }
  const base = (value: string) =>
    value
      .split(" ")
      .filter((token) => token && !MODIFIER_TOKENS.has(token))
      .join(" ");
  const readingBase = base(reading);
  return readingBase && readingBase === base(card) ? 0.6 : 0;
}

function setNameMatches(readingSetName: string | null | undefined, rowSetName: string): boolean {
  const a = normalizeScanText(readingSetName);
  const b = normalizeScanText(rowSetName);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

/**
 * How well one catalog row fits the reading, 0..1.
 * - number matches: base 0.8 (exact name), 0.6 (same character), 0.4 (other name).
 *   +0.2 when the printed set total matches, -0.3 when it differs; +0.05 for the set name.
 * - number doesn't match (or wasn't read): name-only evidence, at most 0.5 (+0.1 set name).
 *   A number that was read and disagrees halves the score.
 */
export function scoreScanRow(reading: ScanReadingInput, row: ScanCatalogRow): number {
  const name = scoreName(reading.name, row.cardName);
  const readingNumber = normalizeScanNumber(reading.number);
  const numberMatches = readingNumber !== null && readingNumber === normalizeScanNumber(row.number);
  const sameSet = setNameMatches(reading.setName, row.setName);
  let score: number;

  if (numberMatches) {
    score = name === 1 ? 0.8 : name > 0 ? 0.6 : 0.4;
    const readingTotal = normalizeScanSetTotal(reading.setTotal);
    if (readingTotal !== null && row.printedTotal !== null) {
      score += readingTotal === String(row.printedTotal) ? 0.2 : -0.3;
    }
    if (sameSet) {
      score += 0.05;
    }
  } else {
    score = name * 0.5 + (sameSet && name > 0 ? 0.1 : 0);
    if (readingNumber !== null) {
      score *= 0.5;
    }
  }

  return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
}

function finishMatches(finish: string | null | undefined, variant: string): boolean {
  return Boolean(finish) && finish?.toLowerCase() === variant.toLowerCase();
}

/**
 * Ranks catalog rows for a reading. Rows are grouped by card so that all
 * variants of the best card are returned together (the one matching the
 * visible finish first), up to `limit` candidates in total.
 */
export function rankScanCandidates(
  reading: ScanReadingInput,
  rows: ScanCatalogRow[],
  limit: number = SCAN_MAX_CANDIDATES,
): ScanMatch[] {
  const groups = new Map<
    string,
    { score: number; items: { row: ScanCatalogRow; score: number }[] }
  >();
  for (const row of rows) {
    const score = scoreScanRow(reading, row);
    if (score <= 0) {
      continue;
    }
    const group = groups.get(row.cardId) ?? { score: 0, items: [] };
    group.score = Math.max(group.score, score);
    group.items.push({ row, score });
    groups.set(row.cardId, group);
  }

  const ordered = [...groups.values()].sort(
    (a, b) =>
      b.score - a.score ||
      (a.items[0]?.row.cardName ?? "").localeCompare(b.items[0]?.row.cardName ?? ""),
  );

  const out: ScanMatch[] = [];
  for (const group of ordered) {
    const items = [...group.items].sort(
      (a, b) =>
        Number(finishMatches(reading.finish, b.row.variant)) -
          Number(finishMatches(reading.finish, a.row.variant)) ||
        a.row.variant.localeCompare(b.row.variant),
    );
    if (out.length > 0 && out.length + items.length > limit) {
      break;
    }
    for (const { row, score } of items) {
      if (out.length >= limit) {
        break;
      }
      out.push({
        variantId: row.variantId,
        name: row.cardName,
        setName: row.setName,
        number: row.number,
        variant: row.variant,
        imageUrl: row.imageUrl,
        score,
      });
    }
  }
  return out;
}

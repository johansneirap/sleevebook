export interface SortKey<T> {
  get: (item: T) => string | number;
  dir?: "asc" | "desc";
  type?: "string" | "number" | "cardNumber";
}

interface ParsedCardNumber {
  prefix: string;
  value: number;
  suffix: string;
}

const CARD_NUMBER_PATTERN = /^([A-Za-z]*)(\d+)([A-Za-z]*)$/;

// Card numbers mix plain digits ("76"), set-prefixed codes ("GG26", "SWSH291")
// and lettered variants ("55a"). They sort as (prefix, numeric value, suffix),
// each ascending, so plain numbers (empty prefix) come first.
function parseCardNumber(raw: string): ParsedCardNumber {
  const match = CARD_NUMBER_PATTERN.exec(raw);
  if (!match) {
    return { prefix: raw, value: Number.POSITIVE_INFINITY, suffix: "" };
  }
  const prefix = match[1] as string;
  const digits = match[2] as string;
  const suffix = match[3] as string;
  return { prefix, value: Number(digits), suffix };
}

export function compareCardNumbers(a: string, b: string): number {
  const left = parseCardNumber(a);
  const right = parseCardNumber(b);
  if (left.prefix !== right.prefix) {
    return left.prefix < right.prefix ? -1 : 1;
  }
  if (left.value !== right.value) {
    return left.value - right.value;
  }
  if (left.suffix !== right.suffix) {
    return left.suffix < right.suffix ? -1 : 1;
  }
  return 0;
}

function compareValues(
  a: string | number,
  b: string | number,
  type: SortKey<unknown>["type"],
): number {
  if (type === "cardNumber") {
    return compareCardNumbers(String(a), String(b));
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function sortPockets<T>(items: T[], keys: SortKey<T>[]): T[] {
  return [...items].sort((a, b) => {
    for (const key of keys) {
      const comparison =
        compareValues(key.get(a), key.get(b), key.type) * (key.dir === "desc" ? -1 : 1);
      if (comparison !== 0) {
        return comparison;
      }
    }
    return 0;
  });
}

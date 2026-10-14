export interface ParsedDecklistLine {
  raw: string;
  quantity: number;
  name: string;
  setCode: string;
  number: string;
}

export interface ParsedDecklistResult {
  lines: ParsedDecklistLine[];
  unparsed: string[];
}

const HEADER_PATTERN = /^(pok[eé]mon|trainer|energy|energ[ií]a)\s*:\s*\d*$/i;

export function parseDecklistText(text: string): ParsedDecklistResult {
  const lines: ParsedDecklistLine[] = [];
  const unparsed: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || HEADER_PATTERN.test(line)) {
      continue;
    }

    const parts = line.split(/\s+/);
    const quantity = Number.parseInt(parts[0] ?? "", 10);
    if (parts.length < 4 || !Number.isFinite(quantity) || quantity <= 0) {
      unparsed.push(line);
      continue;
    }

    const number = parts[parts.length - 1] as string;
    const setCode = parts[parts.length - 2] as string;
    const name = parts.slice(1, parts.length - 2).join(" ");
    lines.push({ raw: line, quantity, name, setCode, number });
  }

  return { lines, unparsed };
}

export interface ParsedCsvRow {
  raw: string;
  name: string;
  setCode: string;
  number: string;
  variant: string | null;
  quantity: number;
}

export interface ParsedCsvResult {
  rows: ParsedCsvRow[];
  unparsed: string[];
}

const CSV_COLUMN_ALIASES = {
  name: ["name", "card", "nombre"],
  set: ["set", "setcode", "set_code", "ptcgocode"],
  number: ["number", "num", "numero", "card_number"],
  variant: ["variant", "variante", "printing"],
  qty: ["qty", "quantity", "cantidad"],
} as const;

function splitCsvLine(line: string): string[] {
  return line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

export function parseCsvText(text: string): ParsedCsvResult {
  const allLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (allLines.length === 0) {
    return { rows: [], unparsed: [] };
  }

  const header = splitCsvLine(allLines[0] as string).map((cell) => cell.toLowerCase());
  const findColumn = (key: keyof typeof CSV_COLUMN_ALIASES) =>
    header.findIndex((cell) => (CSV_COLUMN_ALIASES[key] as readonly string[]).includes(cell));

  const nameIdx = findColumn("name");
  const setIdx = findColumn("set");
  const numberIdx = findColumn("number");
  const variantIdx = findColumn("variant");
  const qtyIdx = findColumn("qty");

  const rows: ParsedCsvRow[] = [];
  const unparsed: string[] = [];

  for (const rawLine of allLines.slice(1)) {
    const cells = splitCsvLine(rawLine);
    const setCode = setIdx >= 0 ? cells[setIdx] : undefined;
    const number = numberIdx >= 0 ? cells[numberIdx] : undefined;
    if (!setCode || !number) {
      unparsed.push(rawLine);
      continue;
    }

    const quantityRaw = qtyIdx >= 0 ? cells[qtyIdx] : undefined;
    const quantity = quantityRaw ? Number.parseInt(quantityRaw, 10) : 1;
    const variant = variantIdx >= 0 ? cells[variantIdx] : undefined;

    rows.push({
      raw: rawLine,
      name: nameIdx >= 0 ? (cells[nameIdx] ?? "") : "",
      setCode,
      number,
      variant: variant && variant.length > 0 ? variant : null,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    });
  }

  return { rows, unparsed };
}

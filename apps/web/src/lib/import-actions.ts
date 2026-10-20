"use server";

import {
  capacity,
  formatPocketCode,
  layoutSchema,
  parsePocketCode,
  pocketCodeFromGlobalIndex,
  pocketCodeToGlobalIndex,
} from "@sleevebook/binder-core";
import { binder, binderVersion, card, cardVariant, set } from "@sleevebook/db";
import { and, desc, eq, ilike } from "drizzle-orm";
import { extractImageUrl, type VariantDisplay } from "./binders";
import { db } from "./db";
import { parseCsvText, parseDecklistText } from "./import-parse";
import type { PocketValue } from "./pocket-actions";
import { assertBinderOwner, assertUser } from "./session";

export type ImportFormat = "decklist" | "csv";

interface ResolvedMatch {
  status: "resolved" | "ambiguous" | "not-found";
  variantId: string | null;
  candidates: VariantDisplay[];
  display: VariantDisplay | null;
  error: string | null;
}

export interface ImportLine extends ResolvedMatch {
  raw: string;
  quantity: number;
}

export interface ImportPreview {
  lines: ImportLine[];
  unparsed: string[];
}

async function resolveOne(
  setCode: string,
  number: string,
  variantFilter: string | null,
): Promise<ResolvedMatch> {
  const rows = await db
    .select({
      id: cardVariant.id,
      variant: cardVariant.variant,
      images: cardVariant.images,
      cardName: card.name,
      cardNumber: card.number,
      rarity: card.rarity,
      setName: set.name,
    })
    .from(cardVariant)
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .where(and(ilike(set.ptcgoCode, setCode), eq(card.number, number)));

  if (rows.length === 0) {
    return {
      status: "not-found",
      variantId: null,
      candidates: [],
      display: null,
      error: `No se encontró ${setCode} ${number} en el catálogo`,
    };
  }

  const toDisplay = (row: (typeof rows)[number]): VariantDisplay => ({
    id: row.id,
    name: row.cardName,
    number: row.cardNumber,
    rarity: row.rarity,
    setName: row.setName,
    variant: row.variant,
    imageUrl: extractImageUrl(row.images),
  });

  const filtered = variantFilter
    ? rows.filter((row) => row.variant.toLowerCase() === variantFilter.toLowerCase())
    : rows;
  const pool = filtered.length > 0 ? filtered : rows;

  if (pool.length === 1) {
    const only = pool[0] as (typeof rows)[number];
    return {
      status: "resolved",
      variantId: only.id,
      candidates: [],
      display: toDisplay(only),
      error: null,
    };
  }

  const preferred =
    pool.find((row) => row.variant === "normal") ?? (pool[0] as (typeof rows)[number]);
  return {
    status: "ambiguous",
    variantId: preferred.id,
    candidates: pool.map(toDisplay),
    display: toDisplay(preferred),
    error: null,
  };
}

export async function previewImport(format: ImportFormat, text: string): Promise<ImportPreview> {
  await assertUser();
  if (format === "decklist") {
    const { lines, unparsed } = parseDecklistText(text);
    const resolved = await Promise.all(
      lines.map(async (line) => {
        const result = await resolveOne(line.setCode, line.number, null);
        return { ...result, raw: line.raw, quantity: line.quantity };
      }),
    );
    return { lines: resolved, unparsed };
  }

  const { rows, unparsed } = parseCsvText(text);
  const resolved = await Promise.all(
    rows.map(async (row) => {
      const result = await resolveOne(row.setCode, row.number, row.variant);
      return { ...result, raw: row.raw, quantity: row.quantity };
    }),
  );
  return { lines: resolved, unparsed };
}

export type ImportDestination = "end" | "pocket" | "newSide";
export type ImportMode = "perCopy" | "singleWithCount";

export interface ApplyImportLine {
  quantity: number;
  variantId: string;
}

export interface ApplyImportOptions {
  destination: ImportDestination;
  destinationPocket: string | null;
  mode: ImportMode;
}

export type ApplyImportResult =
  | { ok: true; pockets: Record<string, PocketValue> }
  | { ok: false; error: string };

export async function computeImportLayout(
  binderId: string,
  lines: ApplyImportLine[],
  options: ApplyImportOptions,
): Promise<ApplyImportResult> {
  await assertBinderOwner(binderId);
  const [binderRow] = await db.select().from(binder).where(eq(binder.id, binderId));
  if (!binderRow) {
    return { ok: false, error: "Binder no encontrado" };
  }

  const [versionRow] = await db
    .select({ layout: binderVersion.layout })
    .from(binderVersion)
    .where(eq(binderVersion.binderId, binderId))
    .orderBy(desc(binderVersion.versionNumber))
    .limit(1);
  if (!versionRow) {
    return { ok: false, error: "No hay layout para este binder" };
  }

  const layout = layoutSchema.parse(versionRow.layout);
  const format = { rows: binderRow.formatRows, cols: binderRow.formatCols };
  const pocketsPerFace = format.rows * format.cols;
  const totalCapacity = capacity(format, binderRow.sheets);

  const toPlace: PocketValue[] = [];
  for (const line of lines) {
    if (options.mode === "singleWithCount") {
      toPlace.push(
        line.quantity > 1
          ? { kind: "card", variant: line.variantId, instance: null, count: line.quantity }
          : { kind: "card", variant: line.variantId, instance: null },
      );
    } else {
      for (let i = 0; i < line.quantity; i++) {
        toPlace.push({ kind: "card", variant: line.variantId, instance: null });
      }
    }
  }

  if (toPlace.length === 0) {
    return { ok: false, error: "No hay cartas resueltas para importar" };
  }

  let maxOccupiedIndex = -1;
  for (const [code, content] of Object.entries(layout.pockets)) {
    if (content.kind !== "empty") {
      const idx = pocketCodeToGlobalIndex(parsePocketCode(code), format);
      if (idx > maxOccupiedIndex) {
        maxOccupiedIndex = idx;
      }
    }
  }

  let startIndex: number;
  if (options.destination === "pocket") {
    if (!options.destinationPocket) {
      return { ok: false, error: "Falta indicar el bolsillo de destino" };
    }
    try {
      startIndex = pocketCodeToGlobalIndex(parsePocketCode(options.destinationPocket), format);
    } catch {
      return { ok: false, error: `Código de bolsillo inválido: ${options.destinationPocket}` };
    }
  } else {
    startIndex = maxOccupiedIndex + 1;
    if (options.destination === "newSide" && startIndex % pocketsPerFace !== 0) {
      startIndex += pocketsPerFace - (startIndex % pocketsPerFace);
    }
  }

  if (startIndex + toPlace.length > totalCapacity) {
    const available = Math.max(totalCapacity - startIndex, 0);
    return {
      ok: false,
      error: `No entran todas las cartas: se necesitan ${toPlace.length} bolsillos y hay ${available} disponibles desde ese punto. Aumenta las hojas o elige otro destino.`,
    };
  }

  const pockets: Record<string, PocketValue> = {};
  for (let i = 0; i < toPlace.length; i++) {
    const code = formatPocketCode(pocketCodeFromGlobalIndex(startIndex + i, format));
    const existing = layout.pockets[code] ?? { kind: "empty" };
    if (existing.kind !== "empty") {
      return {
        ok: false,
        error: `El bolsillo ${code} ya tiene contenido. Elige otro destino o vacía esos bolsillos primero.`,
      };
    }
    pockets[code] = toPlace[i] as PocketValue;
  }

  return { ok: true, pockets };
}

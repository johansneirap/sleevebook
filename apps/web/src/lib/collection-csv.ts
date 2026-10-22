import { gradingLabel } from "@sleevebook/binder-core";
import type { CollectionEntry } from "./collection";

// CSV of "Mi colección". Language and condition are the codes (JP, NM, ...)
// so the file can be re-imported; the grading is the readable label ("PSA 10").

export const COLLECTION_CSV_HEADER = [
  "set",
  "numero",
  "nombre",
  "variante",
  "idioma",
  "condicion",
  "gradeo",
  "precio_compra",
  "moneda_compra",
  "valor_usd_estimado",
  "ubicacion",
  "notas",
];

/** RFC 4180 quoting; cells that Excel would read as formulas get a leading quote. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function collectionCsv(entries: CollectionEntry[]): string {
  const lines = [COLLECTION_CSV_HEADER.join(",")];
  for (const { copy, display, value, placement } of entries) {
    const location = placement ? `En ${placement.binderName} · ${placement.pocketCode}` : "Suelta";
    lines.push(
      [
        display?.setName,
        display?.number,
        display?.name,
        display?.variant,
        copy.language,
        copy.condition,
        gradingLabel(copy),
        copy.purchasePrice,
        copy.purchaseCurrency,
        value?.amountUsd,
        location,
        copy.notes,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // BOM first so Excel reads the file as UTF-8 and keeps accents intact.
  return `﻿${lines.join("\r\n")}\r\n`;
}

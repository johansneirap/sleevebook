import type { Format } from "./format";
import { pocketsPerSheet, pocketsPerSide } from "./format";

export type Side = "F" | "B";

export interface PocketCode {
  sheet: number;
  side: Side;
  index: number;
}

const POCKET_CODE_PATTERN = /^S(\d+)·([FB])·(\d+)$/;
const ASCII_ALIAS_PATTERN = /^s(\d+)-([fb])-(\d+)$/i;

export class InvalidPocketCodeError extends Error {
  constructor(code: string) {
    super(`Invalid pocket code: "${code}"`);
  }
}

export function parsePocketCode(code: string): PocketCode {
  const match = POCKET_CODE_PATTERN.exec(code);
  if (!match) {
    throw new InvalidPocketCodeError(code);
  }
  const sheet = match[1] as string;
  const side = match[2] as Side;
  const index = match[3] as string;
  return { sheet: Number(sheet), side, index: Number(index) };
}

export function formatPocketCode(code: PocketCode): string {
  return `S${code.sheet}·${code.side}·${code.index}`;
}

export function toAsciiAlias(code: string | PocketCode): string {
  const parsed = typeof code === "string" ? parsePocketCode(code) : code;
  return `s${parsed.sheet}-${parsed.side.toLowerCase()}-${parsed.index}`;
}

export function fromAsciiAlias(alias: string): PocketCode {
  const match = ASCII_ALIAS_PATTERN.exec(alias);
  if (!match) {
    throw new InvalidPocketCodeError(alias);
  }
  const sheet = match[1] as string;
  const side = match[2] as string;
  const index = match[3] as string;
  return { sheet: Number(sheet), side: side.toUpperCase() as Side, index: Number(index) };
}

export function pocketCodeToGlobalIndex(code: PocketCode, format: Format): number {
  const sheetOffset = (code.sheet - 1) * pocketsPerSheet(format);
  const sideOffset = code.side === "F" ? 0 : pocketsPerSide(format);
  return sheetOffset + sideOffset + (code.index - 1);
}

export function pocketCodeFromGlobalIndex(globalIndex: number, format: Format): PocketCode {
  const perSheet = pocketsPerSheet(format);
  const perSide = pocketsPerSide(format);
  const sheet = Math.floor(globalIndex / perSheet) + 1;
  const withinSheet = globalIndex % perSheet;
  const side: Side = withinSheet < perSide ? "F" : "B";
  const index = (withinSheet % perSide) + 1;
  return { sheet, side, index };
}

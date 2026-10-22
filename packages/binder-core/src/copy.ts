import { z } from "zod";
import type { Layout } from "./layout-schema";

// Fase 7: physical copies ("copias reales"). A copy is one card the user
// owns, with its language, condition and optional grading. The catalog stays
// English-only: the language is a label on the copy, never a different image.

export const COPY_LANGUAGES = [
  { code: "en", chip: "EN", label: "Inglés" },
  { code: "es", chip: "ES", label: "Español" },
  { code: "ja", chip: "JP", label: "Japonés" },
  { code: "fr", chip: "FR", label: "Francés" },
  { code: "de", chip: "DE", label: "Alemán" },
  { code: "it", chip: "IT", label: "Italiano" },
  { code: "pt", chip: "PT", label: "Portugués" },
  { code: "ko", chip: "KO", label: "Coreano" },
  { code: "zh-tw", chip: "TC", label: "Chino tradicional" },
  { code: "zh-cn", chip: "SC", label: "Chino simplificado" },
] as const;
export type CopyLanguage = (typeof COPY_LANGUAGES)[number]["code"];
export const DEFAULT_COPY_LANGUAGE: CopyLanguage = "en";

/**
 * Conditions with the share of the (near-mint) market price they are worth.
 * Market prices from TCGplayer/Cardmarket are NM prices; there is no free
 * per-condition source, so lower conditions are an estimate.
 */
export const COPY_CONDITIONS = [
  { code: "NM", label: "Casi nueva (NM)", factor: 1 },
  { code: "LP", label: "Poco jugada (LP)", factor: 0.85 },
  { code: "MP", label: "Jugada (MP)", factor: 0.7 },
  { code: "HP", label: "Muy jugada (HP)", factor: 0.5 },
  { code: "DMG", label: "Dañada (DMG)", factor: 0.3 },
] as const;
export type CopyCondition = (typeof COPY_CONDITIONS)[number]["code"];
export const DEFAULT_COPY_CONDITION: CopyCondition = "NM";

export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "TAG", "ACE", "Otra"] as const;
export type GradingCompany = (typeof GRADING_COMPANIES)[number];

const LANGUAGE_CODES = COPY_LANGUAGES.map((l) => l.code) as [CopyLanguage, ...CopyLanguage[]];
const CONDITION_CODES = COPY_CONDITIONS.map((c) => c.code) as [CopyCondition, ...CopyCondition[]];

/** Editable fields of a copy, as sent by forms and actions. */
export const copyInputSchema = z
  .object({
    variantId: z.uuid(),
    language: z.enum(LANGUAGE_CODES).default(DEFAULT_COPY_LANGUAGE),
    condition: z.enum(CONDITION_CODES).default(DEFAULT_COPY_CONDITION),
    gradingCompany: z.enum(GRADING_COMPANIES).nullable().default(null),
    /** 1 to 10 in half steps. Required when gradingCompany is set. */
    gradingGrade: z.number().min(1).max(10).multipleOf(0.5).nullable().default(null),
    purchasePrice: z.number().nonnegative().nullable().default(null),
    purchaseCurrency: z.enum(["usd", "clp", "eur"]).default("usd"),
    valueUsd: z.number().nonnegative().nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null),
    acquiredAt: z.iso.date().nullable().default(null),
  })
  .refine((copy) => (copy.gradingCompany === null) === (copy.gradingGrade === null), {
    message: "La empresa y la nota de gradeo van juntas",
    path: ["gradingGrade"],
  });
export type CopyInput = z.infer<typeof copyInputSchema>;

/** The fields of a copy that pricing and labels need. */
export interface CopyFacts {
  language: string;
  condition: string;
  gradingCompany: string | null;
  gradingGrade: number | null;
  valueUsd: number | null;
}

export function languageChip(code: string): string {
  return COPY_LANGUAGES.find((l) => l.code === code)?.chip ?? code.toUpperCase();
}

export function languageLabel(code: string): string {
  return COPY_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function conditionLabel(code: string): string {
  return COPY_CONDITIONS.find((c) => c.code === code)?.label ?? code;
}

/** "PSA 10", "BGS 9.5"; null when the copy is raw. */
export function gradingLabel(copy: Pick<CopyFacts, "gradingCompany" | "gradingGrade">) {
  if (copy.gradingCompany === null || copy.gradingGrade === null) {
    return null;
  }
  const grade = Number.isInteger(copy.gradingGrade)
    ? String(copy.gradingGrade)
    : copy.gradingGrade.toFixed(1);
  return `${copy.gradingCompany} ${grade}`;
}

/**
 * - "manual": the owner's own valuation.
 * - "condicion": NM market price scaled by the condition factor.
 * - "mercado": NM market price as is (NM copy).
 * - "referencia": graded copy without a valuation; the raw NM market price is
 *   shown only as a reference (no free source prices graded cards).
 */
export type CopyValueOrigin = "manual" | "condicion" | "mercado" | "referencia";

export interface CopyValue {
  amountUsd: number;
  origin: CopyValueOrigin;
}

/** Estimated USD value of a copy from the NM market price of its variant. */
export function estimateCopyValueUsd(
  copy: CopyFacts,
  marketUsd: number | undefined,
): CopyValue | undefined {
  if (copy.valueUsd !== null) {
    return { amountUsd: copy.valueUsd, origin: "manual" };
  }
  if (marketUsd === undefined) {
    return undefined;
  }
  if (gradingLabel(copy) !== null) {
    return { amountUsd: marketUsd, origin: "referencia" };
  }
  const factor = COPY_CONDITIONS.find((c) => c.code === copy.condition)?.factor ?? 1;
  return {
    amountUsd: Math.round(marketUsd * factor * 100) / 100,
    origin: factor === 1 ? "mercado" : "condicion",
  };
}

export interface CopyPlacement {
  binderId: string;
  pocketCode: string;
}

/**
 * Where each copy sits, from the latest layout of every binder of the user.
 * A copy should be in at most one pocket; if a stale layout points at it twice
 * the first binder/pocket (in input order, then pocket order) wins.
 */
export function placeCopies(
  layouts: ReadonlyArray<{ binderId: string; pockets: Layout["pockets"] }>,
): Map<string, CopyPlacement> {
  const placed = new Map<string, CopyPlacement>();
  for (const { binderId, pockets } of layouts) {
    for (const [pocketCode, content] of Object.entries(pockets)) {
      if (content.kind === "card" && content.instance && !placed.has(content.instance)) {
        placed.set(content.instance, { binderId, pocketCode });
      }
    }
  }
  return placed;
}

import type { Layout } from "@sleevebook/binder-core";
import { conditionLabel, languageChip, languageLabel } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import type { PocketCopyBadge } from "../../lib/collection";

// Fase 7: what a pocket shows about the physical copy linked to it. Safe to
// send to public pages: it never carries a purchase price or an owner value.

/** Copy facts a pocket displays, keyed by pocket code in PocketCopyMap. */
export interface PocketCopy {
  language: string;
  condition: string;
  /** "PSA 10"; null when raw. */
  grading: string | null;
  /** True when the value is a condition estimate (no owner valuation). */
  estimated: boolean;
}

export type PocketCopyMap = Record<string, PocketCopy>;

/** Maps the copy badges of a binder onto its card pockets (by pocket code). */
export function pocketCopiesByCode(
  pockets: Layout["pockets"],
  badges: Record<string, PocketCopyBadge>,
): PocketCopyMap {
  const result: PocketCopyMap = {};
  for (const [code, content] of Object.entries(pockets)) {
    if (content.kind !== "card" || !content.instance) {
      continue;
    }
    const badge = badges[content.instance];
    if (badge) {
      result[code] = {
        language: badge.language,
        condition: badge.condition,
        grading: badge.grading,
        estimated: badge.estimated,
      };
    }
  }
  return result;
}

const CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 16,
  padding: "0 5px",
  borderRadius: 4,
  background: "rgba(27,32,51,0.8)",
  color: "#FFFFFF",
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};

const GRADING_CHIP: CSSProperties = {
  ...CHIP,
  background: "var(--accent)",
};

/**
 * Tiny language and grading chips for a pocket's corner. Renders nothing for a
 * raw English copy (the common case), so the grid stays quiet.
 */
export function CopyBadge({ language, grading }: { language: string; grading: string | null }) {
  if (language === "en" && grading === null) {
    return null;
  }
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {language !== "en" ? (
        <span className="sb-data" style={CHIP} title="Idioma de la carta">
          {languageChip(language)}
        </span>
      ) : null}
      {grading !== null ? (
        <span className="sb-data" style={GRADING_CHIP} title="Gradeo">
          {grading}
        </span>
      ) : null}
    </span>
  );
}

const FULL_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 20,
  padding: "0 7px",
  borderRadius: 999,
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

/** Full copy facts as text chips, for lists where the seller reads them (/vender). */
export function CopyChips({ copy }: { copy: PocketCopy }) {
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
      <span style={FULL_CHIP}>{languageLabel(copy.language)}</span>
      <span style={FULL_CHIP}>{conditionLabel(copy.condition)}</span>
      {copy.grading !== null ? <span style={FULL_CHIP}>{copy.grading}</span> : null}
    </span>
  );
}

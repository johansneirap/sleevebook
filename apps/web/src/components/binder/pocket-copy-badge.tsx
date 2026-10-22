import type { Layout } from "@sleevebook/binder-core";
import { conditionLabel, languageLabel } from "@sleevebook/binder-core";
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

export { CopyBadge } from "./copy-badge";

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

import { languageChip, languageLabel } from "@sleevebook/binder-core";

// Fase 7: small tags for a physical copy shown on a pocket. Presentational
// only (no data): the caller passes the copy's language code and grading
// label. Inline styles with tokens, so the viewer can reuse it without CSS.
// Renders nothing for an English raw copy.

export interface CopyBadgeProps {
  /** COPY_LANGUAGES code ("en", "ja", ...). English shows no chip. */
  language: string;
  /** "PSA 10"; null when the copy is raw. */
  grading: string | null;
  size?: "sm" | "md";
}

export function CopyBadge({ language, grading, size = "md" }: CopyBadgeProps) {
  const showLanguage = language !== "en";
  if (!showLanguage && grading === null) {
    return null;
  }

  const small = size === "sm";
  const tag = {
    display: "inline-flex",
    alignItems: "center",
    height: small ? 16 : 20,
    padding: small ? "0 4px" : "0 6px",
    borderRadius: 999,
    fontFamily: "var(--font-data)",
    fontSize: small ? 9 : 11,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  } as const;

  return (
    <span
      data-copy-badge=""
      style={{ display: "inline-flex", gap: 4, alignItems: "center", maxWidth: "100%" }}
    >
      {showLanguage && (
        <span
          title={languageLabel(language)}
          style={{ ...tag, background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          {languageChip(language)}
        </span>
      )}
      {grading !== null && (
        <span
          title={`Gradeo: ${grading}`}
          style={{
            ...tag,
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          {grading}
        </span>
      )}
    </span>
  );
}

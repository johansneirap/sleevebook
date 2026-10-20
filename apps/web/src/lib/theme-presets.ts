import type { CSSProperties } from "react";

// Presets dress the binder object only (cover, paper, sleeves). The app
// around it always uses the v2 tokens from globals.css.
export interface ThemeTokens {
  label: string;
  /** Binder cover color (solid). A custom `bg` overrides it. */
  background: string;
  /** Text printed on the cover. */
  foreground: string;
  /** Ornaments on the cover: stitching, spine lines. */
  accent: string;
  /** Typeface of the cover label. The app stays on Plus Jakarta Sans. */
  fontFamily: string;
  /** Paper tint of the leaves, from the spine out to the edge. */
  paper: string;
  paperEdge: string;
  /** Film color laid over the sleeves of this preset. */
  sleeveFilm: string;
}

export const THEME_PRESETS: Record<string, ThemeTokens> = {
  // "Estante" (docs/DESIGN_BRIEF.md v2): the default binder.
  default: {
    label: "Estante",
    background: "#2F4A8A",
    foreground: "#FFFFFF",
    accent: "#C9D6F5",
    fontFamily: "var(--font-ui)",
    paper: "#FBFBF7",
    paperEdge: "#ECECE4",
    sleeveFilm: "rgba(220, 224, 236, 0.35)",
  },
  clasico: {
    label: "Clásico",
    background: "#7A2E2E",
    foreground: "#FFFFFF",
    accent: "#F0D3D3",
    fontFamily: "var(--font-ui)",
    paper: "#FBF8F0",
    paperEdge: "#EFE8D6",
    sleeveFilm: "rgba(228, 220, 214, 0.35)",
  },
  oscuro: {
    label: "Oscuro",
    background: "#14161a",
    foreground: "#F0F0F0",
    accent: "#9AA7C7",
    fontFamily: "var(--font-ui)",
    paper: "#E8EAF0",
    paperEdge: "#D6D9E2",
    sleeveFilm: "rgba(200, 206, 220, 0.3)",
  },
  vintage: {
    label: "Vintage",
    background: "#2E5E4E",
    foreground: "#FFFFFF",
    accent: "#CFE6DC",
    fontFamily: "var(--font-ui)",
    paper: "#F6EEDC",
    paperEdge: "#E8DCC0",
    sleeveFilm: "rgba(246, 236, 214, 0.35)",
  },
  neon: {
    label: "Neón",
    background: "#3B2A6E",
    foreground: "#FFFFFF",
    accent: "#D9CCFF",
    fontFamily: "var(--font-ui)",
    paper: "#F4F0FF",
    paperEdge: "#E4DCFA",
    sleeveFilm: "rgba(226, 216, 255, 0.35)",
  },
};

export const DEFAULT_THEME_PRESET = "default";

export const SLEEVE_LABELS: Record<string, string> = {
  clear: "Transparente",
  frosted: "Esmerilada",
  matte: "Mate",
  none: "Sin fundas",
};

export const DEFAULT_SLEEVE = "clear";

export function resolveThemeTokens(theme: { preset: string; bg?: string }): ThemeTokens {
  const base = THEME_PRESETS[theme.preset] ?? (THEME_PRESETS[DEFAULT_THEME_PRESET] as ThemeTokens);
  return theme.bg ? { ...base, background: theme.bg } : base;
}

// Static, cheap approximation of a plastic sleeve over a pocket. Runs on every
// pocket, so it stays a plain CSS layer with no JS or per-frame cost.
export function sleeveOverlayStyle(sleeve: string): CSSProperties | null {
  switch (sleeve) {
    case "none":
      return null;
    case "frosted":
      return { background: "rgba(255,255,255,0.3)" };
    case "matte":
      return {
        background:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0 2px, transparent 2px 5px)",
        mixBlendMode: "overlay",
      };
    default:
      return {
        background:
          "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 48%, transparent 60%)",
        mixBlendMode: "overlay",
      };
  }
}

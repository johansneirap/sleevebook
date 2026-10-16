import type { CSSProperties } from "react";

export interface ThemeTokens {
  label: string;
  background: string;
  foreground: string;
  accent: string;
  fontFamily: string;
}

export const THEME_PRESETS: Record<string, ThemeTokens> = {
  // "La galería privada" (docs/DESIGN_BRIEF.md): the default experience.
  default: {
    label: "Galería",
    background: "radial-gradient(ellipse 70% 55% at 50% 42%, #2a221c 0%, #14110f 70%)",
    foreground: "#ede6da",
    accent: "#d4b77c",
    fontFamily: "var(--font-ui)",
  },
  clasico: {
    label: "Clásico",
    background: "#ffffff",
    foreground: "#111111",
    accent: "#0066cc",
    fontFamily: "system-ui, sans-serif",
  },
  oscuro: {
    label: "Oscuro",
    background: "#14161a",
    foreground: "#f0f0f0",
    accent: "#4da3ff",
    fontFamily: "system-ui, sans-serif",
  },
  vintage: {
    label: "Vintage",
    background: "#f3ead9",
    foreground: "#3b2a1a",
    accent: "#8a5a2b",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  neon: {
    label: "Neón",
    background: "linear-gradient(135deg, #1a0033, #330066)",
    foreground: "#f5f0ff",
    accent: "#ff2fd6",
    fontFamily: "'Trebuchet MS', sans-serif",
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

// Static, cheap approximation of a plastic sleeve over a pocket -- distinct
// from holo-card.tsx's dynamic pointer-driven foil, which only renders in the
// focused/enlarged view. This runs on every pocket thumbnail, so it has to
// stay a plain CSS layer with no JS or per-frame cost.
export function sleeveOverlayStyle(sleeve: string): CSSProperties | null {
  switch (sleeve) {
    case "none":
      return null;
    case "frosted":
      return { background: "rgba(255,255,255,0.22)" };
    case "matte":
      return {
        background:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 5px)",
        mixBlendMode: "overlay",
      };
    default:
      return {
        background:
          "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)",
        mixBlendMode: "overlay",
      };
  }
}

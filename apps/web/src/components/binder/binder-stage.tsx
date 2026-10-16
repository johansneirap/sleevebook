"use client";

import type { Layout } from "@sleevebook/binder-core";
import { formatPocketCode } from "@sleevebook/binder-core";
import { type ComponentProps, useState } from "react";
import { resolveThemeTokens } from "../../lib/theme-presets";
import { BinderPageTurner } from "./binder-page-turner";
import { ClosedBinder } from "./closed-binder";

type BinderPageTurnerProps = ComponentProps<typeof BinderPageTurner>;

const CLOSE_CSS = `
.sb-close {
  background: none;
  border: 0;
  padding: 4px 0;
  font-size: 11px;
  color: var(--smoke);
  opacity: 0.7;
  cursor: pointer;
  transition: color 240ms var(--ease-out-expo), opacity 240ms var(--ease-out-expo);
}
.sb-close:hover,
.sb-close:focus-visible {
  color: var(--foil);
  opacity: 1;
}
.sb-close:focus-visible {
  outline: 1px solid var(--foil);
  outline-offset: 4px;
}
`;

export interface BinderStageProps extends BinderPageTurnerProps {
  name: string;
  theme: Layout["theme"];
  startClosed: boolean;
}

// Portada = panel de página completa en la primera cara (sheet 1, front, pocket 1).
const COVER_ANCHOR = formatPocketCode({ sheet: 1, side: "F", index: 1 });

const DEFAULT_LEATHER = "#2e1f16";
const DEFAULT_FOIL = "#d9bf8c";
const DARK_COVER_MAX_LUMINANCE = 0.08;
const READABLE_ACCENT_MIN_LUMINANCE = 0.3;

// WCAG relative luminance for "#rgb" / "#rrggbb"; null for anything else
// (gradients, rgb(), named colors).
function relativeLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }
  const digits = match[1] as string;
  const hex = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Simple rule: the cover is the theme background when it is a dark solid color
// (so the binder belongs to the page); gradients and light backgrounds get a
// dark leather. The accent (rules, title) is the theme accent when it reads on
// leather, otherwise the champagne foil.
export function deriveBinderColors(theme: Layout["theme"]): {
  coverColor: string;
  accentColor: string;
} {
  const tokens = resolveThemeTokens(theme);
  const backgroundLuminance = relativeLuminance(tokens.background);
  const coverColor =
    backgroundLuminance !== null && backgroundLuminance < DARK_COVER_MAX_LUMINANCE
      ? tokens.background
      : DEFAULT_LEATHER;
  const accentLuminance = relativeLuminance(tokens.accent);
  const accentColor =
    accentLuminance !== null && accentLuminance >= READABLE_ACCENT_MIN_LUMINANCE
      ? tokens.accent
      : DEFAULT_FOIL;
  return { coverColor, accentColor };
}

export function findCoverImageUrl(
  panels: Layout["panels"],
  format: Layout["format"],
): string | null {
  const cover = panels.find(
    (panel) =>
      panel.anchor === COVER_ANCHOR &&
      panel.span.rows === format.rows &&
      panel.span.cols === format.cols,
  );
  return cover?.asset || null;
}

export function BinderStage({
  name,
  theme,
  startClosed,
  basePath,
  initialIndex,
  sheets,
  opening,
  format,
  pockets,
  panels,
  displays,
  sleeve,
}: BinderStageProps) {
  const [closed, setClosed] = useState(startClosed);
  const { coverColor, accentColor } = deriveBinderColors(theme);
  const coverImageUrl = findCoverImageUrl(panels, format);

  if (closed) {
    return (
      <ClosedBinder
        name={name}
        coverColor={coverColor}
        accentColor={accentColor}
        coverImageUrl={coverImageUrl}
        opening={opening}
        onOpen={() => setClosed(false)}
      />
    );
  }

  return (
    <div>
      <style>{CLOSE_CSS}</style>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button type="button" className="sb-label sb-close" onClick={() => setClosed(true)}>
          Cerrar binder
        </button>
      </div>
      <BinderPageTurner
        basePath={basePath}
        initialIndex={initialIndex}
        sheets={sheets}
        opening={opening}
        format={format}
        pockets={pockets}
        panels={panels}
        displays={displays}
        sleeve={sleeve}
      />
    </div>
  );
}

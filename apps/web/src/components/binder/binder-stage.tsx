"use client";

import type { Layout } from "@sleevebook/binder-core";
import { formatPocketCode } from "@sleevebook/binder-core";
import { type ComponentProps, type CSSProperties, useState } from "react";
import { resolveThemeTokens } from "../../lib/theme-presets";
import { BinderPageTurner } from "./binder-page-turner";
import { ClosedBinder } from "./closed-binder";

type BinderPageTurnerProps = ComponentProps<typeof BinderPageTurner>;

// The light desk the binder lies on: a soft white light fading into the app background.
const DESK_CSS = `
.sb-desk {
  position: relative;
  border-radius: 24px;
  padding: clamp(20px, 3vw, 32px) clamp(8px, 2vw, 24px) clamp(16px, 2vw, 24px);
  background: radial-gradient(ellipse 70% 60% at 50% 50%, #ffffff, var(--bg) 72%);
}
.sb-close {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
  transition: background-color 200ms var(--ease-out-expo);
}
.sb-close:hover:not(:disabled) {
  background: var(--surface-2);
}
`;

export interface BinderStageProps extends BinderPageTurnerProps {
  name: string;
  theme: Layout["theme"];
  startClosed: boolean;
}

// Portada = panel de página completa en la primera cara (sheet 1, front, pocket 1).
const COVER_ANCHOR = formatPocketCode({ sheet: 1, side: "F", index: 1 });

const DEFAULT_COVER = "#2F4A8A";
const DARK_INK_MIN_LUMINANCE = 0.22;
const INK_LIGHT = "#FFFFFF";
const INK_DARK = "#1B2033";

// WCAG relative luminance for "#rgb" / "#rrggbb"; null for anything else
// (gradients, rgb(), named colors).
function parseHex(color: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!match) {
    return null;
  }
  const digits = match[1] as string;
  const hex = digits.length === 3 ? [...digits].map((c) => c + c).join("") : digits;
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) {
    return null;
  }
  const [r, g, b] = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Darkens a hex color by a factor (0-1): the deep tone of the cover edge.
function shade(hex: string, factor: number): string {
  const rgb = parseHex(hex);
  if (!rgb) {
    return hex;
  }
  return `#${rgb
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value * factor)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * The cover is the theme's color (a custom background overrides the preset).
 * The ink printed on it is white on dark covers and ink on light ones.
 */
export function deriveBinderColors(theme: Layout["theme"]): {
  coverColor: string;
  accentColor: string;
} {
  const tokens = resolveThemeTokens(theme);
  const luminance = relativeLuminance(tokens.background);
  const coverColor = luminance === null ? DEFAULT_COVER : tokens.background;
  const accentColor =
    luminance !== null && luminance >= DARK_INK_MIN_LUMINANCE ? INK_DARK : INK_LIGHT;
  return { coverColor, accentColor };
}

/** The CSS variables the binder object paints with: cover, paper and sleeve film. */
export function binderMaterials(theme: Layout["theme"]): CSSProperties {
  const tokens = resolveThemeTokens(theme);
  const { coverColor } = deriveBinderColors(theme);
  return {
    "--binder-cover": coverColor,
    "--binder-cover-deep": shade(coverColor, 0.62),
    "--binder-paper": tokens.paper,
    "--binder-paper-edge": tokens.paperEdge,
    "--binder-sleeve-film": tokens.sleeveFilm,
  } as CSSProperties;
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
  pocketMeta,
  wishlistVariantIds,
  canWish,
}: BinderStageProps) {
  const [closed, setClosed] = useState(startClosed);
  const { coverColor, accentColor } = deriveBinderColors(theme);
  const coverImageUrl = findCoverImageUrl(panels, format);

  return (
    <div style={binderMaterials(theme)}>
      <style>{DESK_CSS}</style>
      <div className="sb-desk">
        {closed ? (
          <ClosedBinder
            name={name}
            coverColor={coverColor}
            accentColor={accentColor}
            coverImageUrl={coverImageUrl}
            opening={opening}
            onOpen={() => setClosed(false)}
          />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button type="button" className="sb-close" onClick={() => setClosed(true)}>
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
              pocketMeta={pocketMeta}
              wishlistVariantIds={wishlistVariantIds}
              canWish={canWish}
            />
          </>
        )}
      </div>
    </div>
  );
}

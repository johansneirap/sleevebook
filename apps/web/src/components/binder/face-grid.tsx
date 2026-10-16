"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode, panelCoverageMap } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { sleeveOverlayStyle } from "../../lib/theme-presets";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import { PanelCell } from "./panel-cell";

// Time the thumbnail stays hidden after the card is returned, so it does not
// show through the card while it flies back into the pocket.
const REVEAL_DELAY_S = 0.5;

interface FaceGridProps {
  face: SheetFace;
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  /** Pocket code of the card currently taken out of the sleeve, if any. */
  focusedCode?: string | null;
  onCardClick?: (code: string, display: VariantDisplay, rect: DOMRect) => void;
  /** Marks the face as a page-turn slot (0 = left/top, 1 = right/bottom). */
  turnSlot?: number;
  /** Decorative copy for the page-turn overlay: inert, label drawn by CSS. */
  ghost?: boolean;
}

// Page styles shared by every face. Width is fluid: two faces fit side by
// side on desktop and the spread stacks on phones (see binder-faces.tsx).
export const FACE_CSS = `
.sb-face {
  width: clamp(200px, 34vw, 320px);
}
@media (max-width: 640px) {
  .sb-face { width: min(320px, calc(100vw - 80px)); }
}
.sb-pocket {
  position: relative;
  overflow: hidden;
  border-radius: 3px;
}
.sb-pocket::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 246, 225, 0.22) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 280ms var(--ease-out-expo);
}
.sb-pocket--card:hover::after,
.sb-pocket--card:focus-visible::after {
  transform: translateX(100%);
}
.sb-pocket--card:focus-visible {
  outline: 1px solid var(--foil);
  outline-offset: 2px;
}
.sb-ghost-label::before {
  content: attr(data-label);
}
@media (prefers-reduced-motion: reduce) {
  .sb-pocket::after {
    transform: none !important;
    opacity: 0;
    transition: opacity 200ms linear;
  }
  .sb-pocket--card:hover::after {
    opacity: 1;
  }
}
`;

const POCKET_STYLE: CSSProperties = {
  position: "relative",
  aspectRatio: "63 / 88",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 4,
  fontSize: 11,
  overflow: "hidden",
  borderRadius: 3,
  // Empty sleeve: a faint outline and a barely lighter film.
  background: "linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01) 60%)",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
};

const CARD_POCKET_STYLE: CSSProperties = {
  ...POCKET_STYLE,
  background: "transparent",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14), 0 1px 2px rgba(0,0,0,0.35)",
};

const PLACEHOLDER_LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  color: "var(--smoke)",
  opacity: 0.8,
};

export function FaceGrid({
  face,
  format,
  pockets,
  panels,
  displays,
  sleeve,
  focusedCode = null,
  onCardClick,
  turnSlot,
  ghost = false,
}: FaceGridProps) {
  const reducedMotion = usePrefersReducedMotion();
  const codes = Array.from({ length: format.rows * format.cols }, (_, i) =>
    formatPocketCode({ sheet: face.sheet, side: face.side, index: i + 1 }),
  );
  const overlayStyle = sleeveOverlayStyle(sleeve);
  const coverage = panelCoverageMap(panels, format);
  const label = `Hoja ${face.sheet} · ${face.side === "F" ? "Frente" : "Reverso"}`;

  return (
    <section
      className="sb-face"
      data-turn-slot={turnSlot}
      inert={ghost || undefined}
      aria-hidden={ghost || undefined}
      style={{
        position: "relative",
        boxSizing: "border-box",
        padding: "18px 20px 22px",
        borderRadius: 2,
        background:
          "radial-gradient(ellipse at 30% 0%, rgba(255,240,210,0.07), transparent 60%), repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 3px), linear-gradient(180deg, var(--leather), var(--leather-deep))",
        // Fine inner rule, like the edge of a printed leaf.
        outline: "1px solid color-mix(in srgb, var(--foil) 16%, transparent)",
        outlineOffset: -8,
      }}
    >
      <style>{FACE_CSS}</style>
      <h2
        className="sb-label"
        style={{
          margin: "0 0 14px",
          fontSize: 11,
          fontWeight: "normal",
          color: "var(--smoke)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {ghost ? (
          // Drawn via CSS so text queries only ever find the real face.
          <span className="sb-ghost-label" data-label={label} />
        ) : (
          label
        )}
        <span aria-hidden style={{ flex: 1, height: 1, background: "var(--rule)", opacity: 0.6 }} />
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
          gap: 6,
        }}
      >
        {codes.map((code, i) => {
          const gridPosition: CSSProperties = {
            gridColumnStart: (i % format.cols) + 1,
            gridRowStart: Math.floor(i / format.cols) + 1,
          };

          const coveredBy = coverage.get(code);
          if (coveredBy) {
            if (!coveredBy.isAnchor) {
              return null;
            }
            return (
              <PanelCell
                key={code}
                asset={coveredBy.panel.asset}
                rows={coveredBy.panel.span.rows}
                cols={coveredBy.panel.span.cols}
                crop={coveredBy.panel.crop}
                style={gridPosition}
              />
            );
          }

          const content = pockets[code];
          const display =
            content?.kind === "card" || content?.kind === "placeholder"
              ? displays.get(content.variant)
              : undefined;

          if (content?.kind === "card") {
            // While the card is out, the pocket reads as physically empty.
            const isOut = focusedCode === code;
            const contentStyle: CSSProperties = isOut
              ? { opacity: 0, transition: "none" }
              : {
                  opacity: 1,
                  transition: `opacity 0s linear ${reducedMotion ? 0 : REVEAL_DELAY_S}s`,
                };
            return (
              <button
                key={code}
                type="button"
                onClick={(event) =>
                  display &&
                  onCardClick?.(code, display, event.currentTarget.getBoundingClientRect())
                }
                className={isOut ? "sb-pocket" : "sb-pocket sb-pocket--card"}
                style={{
                  ...CARD_POCKET_STYLE,
                  ...gridPosition,
                  padding: 0,
                  color: "inherit",
                  font: "inherit",
                  cursor: display ? "pointer" : "default",
                }}
                title={display?.name}
              >
                {content.count && content.count > 1 && (
                  <span
                    className="sb-data"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      zIndex: 1,
                      background: "rgba(10,8,7,0.7)",
                      color: "var(--linen)",
                      border: "1px solid var(--rule)",
                      borderRadius: 2,
                      padding: "0 4px",
                      fontSize: 10,
                      lineHeight: "16px",
                      letterSpacing: "0.04em",
                      ...contentStyle,
                    }}
                  >
                    ×{content.count}
                  </span>
                )}
                {overlayStyle && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      ...overlayStyle,
                      ...contentStyle,
                    }}
                  />
                )}
                {display?.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: viewer MVP, no next/image config yet
                  <img
                    src={display.imageUrl}
                    alt={display.name}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      ...contentStyle,
                    }}
                  />
                ) : (
                  <span style={{ ...contentStyle, padding: 4 }}>
                    {display?.name} {display?.number}
                  </span>
                )}
              </button>
            );
          }

          if (content?.kind === "placeholder") {
            return (
              <div
                key={code}
                style={{
                  ...POCKET_STYLE,
                  ...gridPosition,
                  background: "transparent",
                  boxShadow: "none",
                  outline: "1px dashed color-mix(in srgb, var(--smoke) 40%, transparent)",
                  outlineOffset: -1,
                  color: "var(--smoke)",
                }}
                title={display?.name}
              >
                <span className="sb-label" style={PLACEHOLDER_LABEL_STYLE}>
                  Falta
                </span>
                <span style={PLACEHOLDER_LABEL_STYLE}>
                  {display?.name} {display?.number}
                </span>
              </div>
            );
          }

          return <div key={code} style={{ ...POCKET_STYLE, ...gridPosition, opacity: 0.6 }} />;
        })}
      </div>
    </section>
  );
}

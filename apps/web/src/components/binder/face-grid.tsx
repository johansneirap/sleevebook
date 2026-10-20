"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode, panelCoverageMap } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { sleeveOverlayStyle } from "../../lib/theme-presets";
import { usePrefersReducedMotion } from "../../lib/use-prefers-reduced-motion";
import type { PocketMetaMap } from "../seller-public/types";
import { PanelCell } from "./panel-cell";

// Time the thumbnail stays hidden after the card is returned, so it does not
// show through the card while it flies back into the pocket.
const REVEAL_DELAY_S = 0.5;

export type PageSide = "left" | "right";

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
  /** Which side of the spine the leaf sits on: sets the paper shading. */
  side?: PageSide;
  /** Decorative copy for the page-turn overlay: inert, label drawn by CSS. */
  ghost?: boolean;
  /** Seller mode only: price tags and listing status per pocket. */
  pocketMeta?: PocketMetaMap;
}

// Vendido: the art stays readable but recedes behind the label.
const SOLD_ART_FILTER = "grayscale(0.85) brightness(0.5)";

// Page styles shared by every face. Width is fluid: two faces fit side by
// side on desktop and the spread stacks on phones (see binder-faces.tsx).
export const FACE_CSS = `
/* Sized from the binder outwards: a face is as wide as fits (a) half the
   viewport and (b) a viewport-tall page of --sb-rows x --sb-cols pockets
   (63:88 cards, 6px gaps, 36px side padding, ~70px of label + padding), so a
   whole spread is visible without zooming. */
.sb-face {
  --sb-page-h: calc(100svh - 380px);
  width: max(
    220px,
    min(
      calc(
        var(--sb-cols, 3) * ((var(--sb-page-h) - 70px - (var(--sb-rows, 3) - 1) * 8px) / var(--sb-rows, 3) * 0.716)
          + (var(--sb-cols, 3) - 1) * 8px + 36px
      ),
      calc((100vw - 220px) / 2),
      560px
    )
  );
}
.sb-pocket {
  position: relative;
  overflow: hidden;
  border-radius: 6px;
}
.sb-pocket::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.6) 50%, transparent 70%);
  transform: translateX(-100%);
  transition: transform 260ms var(--ease-out-expo);
}
.sb-pocket--card:hover::after,
.sb-pocket--card:focus-visible::after {
  transform: translateX(100%);
}
.sb-pocket--card:focus-visible {
  outline: 2px solid var(--accent);
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

const POCKET_BASE: CSSProperties = {
  position: "relative",
  aspectRatio: "63 / 88",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  fontSize: 11,
  overflow: "hidden",
  borderRadius: 6,
};

// The transparent sleeve: a film, a diagonal specular sheen and a hairline
// inside the edge. Its color comes from the binder preset (--binder-sleeve-film).
const SLEEVE: CSSProperties = {
  ...POCKET_BASE,
  background:
    "linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.55) 48%, rgba(255,255,255,0) 60%), var(--binder-sleeve-film, rgba(220,224,236,0.35))",
  boxShadow: "inset 0 0 0 1px rgba(27,32,51,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
};

// Without sleeves ("Sin fundas") the card sits on the paper with only a shadow.
const BARE: CSSProperties = {
  ...POCKET_BASE,
  background: "transparent",
  boxShadow: "none",
};

const CARD_ART_STYLE: CSSProperties = {
  position: "absolute",
  inset: 4,
  borderRadius: 4,
  boxShadow: "0 1px 3px rgba(27,32,51,0.28)",
};

const DASHED_SLOT: CSSProperties = {
  position: "absolute",
  inset: 4,
  borderRadius: 4,
  border: "1.5px dashed #CDD2E0",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  padding: 4,
};

const PLACEHOLDER_LABEL_STYLE: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--muted)",
};

const PLACEHOLDER_NAME_STYLE: CSSProperties = {
  fontSize: 9,
  color: "var(--muted)",
  overflowWrap: "anywhere",
};

/** Feeds the format into the .sb-face width formula. */
export function faceSizeVars(format: Format): CSSProperties {
  return { "--sb-rows": format.rows, "--sb-cols": format.cols } as CSSProperties;
}

/** The paper leaf: tint toward the outer edge, shadow where it meets the spine. */
export function paperStyle(side: PageSide): CSSProperties {
  return side === "left"
    ? {
        borderRadius: "8px 4px 4px 8px",
        background:
          "linear-gradient(90deg, var(--binder-paper, #FBFBF7) 85%, var(--binder-paper-edge, #ECECE4))",
        boxShadow: "inset -10px 0 18px -12px rgba(27,32,51,0.35)",
      }
    : {
        borderRadius: "4px 8px 8px 4px",
        background:
          "linear-gradient(270deg, var(--binder-paper, #FBFBF7) 85%, var(--binder-paper-edge, #ECECE4))",
        boxShadow: "inset 10px 0 18px -12px rgba(27,32,51,0.35)",
      };
}

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
  side = "right",
  ghost = false,
  pocketMeta,
}: FaceGridProps) {
  const reducedMotion = usePrefersReducedMotion();
  const codes = Array.from({ length: format.rows * format.cols }, (_, i) =>
    formatPocketCode({ sheet: face.sheet, side: face.side, index: i + 1 }),
  );
  const overlayStyle = sleeveOverlayStyle(sleeve);
  const hasSleeve = sleeve !== "none";
  const coverage = panelCoverageMap(panels, format);
  const label = `Hoja ${face.sheet} · ${face.side === "F" ? "Frente" : "Reverso"}`;
  const filled = codes.reduce(
    (count, code) => count + (coverage.has(code) || pockets[code]?.kind === "card" ? 1 : 0),
    0,
  );

  return (
    <section
      className="sb-face"
      data-turn-slot={turnSlot}
      inert={ghost || undefined}
      aria-hidden={ghost || undefined}
      style={{
        ...faceSizeVars(format),
        ...paperStyle(side),
        position: "relative",
        boxSizing: "border-box",
        padding: "16px 18px 20px",
      }}
    >
      <style>{FACE_CSS}</style>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2
          className="sb-label"
          style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}
        >
          {ghost ? (
            // Drawn via CSS so text queries only ever find the real face.
            <span className="sb-ghost-label" data-label={label} />
          ) : (
            label
          )}
        </h2>
        <span className="sb-data" style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
          {filled} / {codes.length}
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
          gap: 8,
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
            const meta = pocketMeta?.[code];
            const sold = meta?.status === "vendido";
            const reserved = meta?.status === "reservado";
            const artStyle: CSSProperties = sold
              ? { ...contentStyle, filter: SOLD_ART_FILTER }
              : contentStyle;
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
                  ...(hasSleeve ? SLEEVE : BARE),
                  ...gridPosition,
                  padding: 0,
                  border: 0,
                  color: "inherit",
                  font: "inherit",
                  textAlign: "center",
                  cursor: display ? "pointer" : "default",
                }}
                title={display?.name}
              >
                {content.count && content.count > 1 && (
                  <span
                    className="sb-data"
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      zIndex: 2,
                      background: "rgba(27,32,51,0.8)",
                      color: "#FFFFFF",
                      borderRadius: 999,
                      padding: "0 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: "18px",
                      ...contentStyle,
                    }}
                  >
                    ×{content.count}
                  </span>
                )}
                {display?.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: viewer MVP, no next/image config yet
                  <img
                    src={display.imageUrl}
                    alt={display.name}
                    style={{
                      ...CARD_ART_STYLE,
                      width: "calc(100% - 8px)",
                      height: "calc(100% - 8px)",
                      objectFit: "cover",
                      ...artStyle,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      ...CARD_ART_STYLE,
                      display: "flex",
                      alignItems: "flex-end",
                      padding: 4,
                      background: "linear-gradient(160deg, #6C8FD9, #2D4A9A)",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      ...artStyle,
                    }}
                  >
                    {display?.name} {display?.number}
                  </span>
                )}
                {overlayStyle && hasSleeve && (
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
                {reserved || sold ? (
                  <span
                    className="sb-label"
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      right: 4,
                      zIndex: 1,
                      padding: "3px 4px",
                      borderRadius: 4,
                      fontSize: 10,
                      lineHeight: "12px",
                      textAlign: "center",
                      background: reserved ? "var(--warning)" : "var(--danger)",
                      color: "#FFFFFF",
                      pointerEvents: "none",
                      ...contentStyle,
                    }}
                  >
                    {reserved ? "Reservado" : "Vendido"}
                  </span>
                ) : null}
                {meta?.price && !sold ? (
                  <span
                    className="sb-data"
                    style={{
                      position: "absolute",
                      left: 4,
                      right: 4,
                      bottom: 4,
                      zIndex: 1,
                      padding: "2px 4px",
                      fontSize: 10,
                      lineHeight: "14px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#FFFFFF",
                      background: "rgba(27,32,51,0.8)",
                      borderRadius: 4,
                      pointerEvents: "none",
                      ...contentStyle,
                    }}
                  >
                    {meta.price}
                  </span>
                ) : null}
              </button>
            );
          }

          if (content?.kind === "placeholder") {
            return (
              <div
                key={code}
                style={{ ...(hasSleeve ? SLEEVE : BARE), ...gridPosition }}
                title={display?.name}
              >
                <span style={{ ...DASHED_SLOT }}>
                  <span className="sb-label" style={PLACEHOLDER_LABEL_STYLE}>
                    Falta
                  </span>
                  <span style={PLACEHOLDER_NAME_STYLE}>
                    {display?.name} {display?.number}
                  </span>
                </span>
              </div>
            );
          }

          // Empty pocket: the sleeve alone, its slot dashed.
          return (
            <div key={code} style={{ ...(hasSleeve ? SLEEVE : BARE), ...gridPosition }}>
              <span
                aria-hidden
                style={{ ...DASHED_SLOT, border: "1.5px dashed rgba(138,144,166,0.45)" }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

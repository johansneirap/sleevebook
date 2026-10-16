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
}

const POCKET_STYLE: CSSProperties = {
  position: "relative",
  aspectRatio: "63 / 88",
  border: "1px solid #ccc",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: 4,
  fontSize: 11,
  overflow: "hidden",
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
}: FaceGridProps) {
  const reducedMotion = usePrefersReducedMotion();
  const codes = Array.from({ length: format.rows * format.cols }, (_, i) =>
    formatPocketCode({ sheet: face.sheet, side: face.side, index: i + 1 }),
  );
  const overlayStyle = sleeveOverlayStyle(sleeve);
  const coverage = panelCoverageMap(panels, format);

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: "normal" }}>
        Hoja {face.sheet} · {face.side === "F" ? "Frente" : "Reverso"}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${format.cols}, 1fr)`,
          gap: 6,
          width: 320,
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
                style={{
                  ...POCKET_STYLE,
                  ...gridPosition,
                  background: "white",
                  cursor: display ? "pointer" : "default",
                }}
                title={display?.name}
              >
                {content.count && content.count > 1 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      background: "#06c",
                      color: "white",
                      borderRadius: 4,
                      padding: "0 4px",
                      fontSize: 10,
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
                    style={{ maxWidth: "100%", maxHeight: "100%", ...contentStyle }}
                  />
                ) : (
                  <span style={contentStyle}>
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
                style={{ ...POCKET_STYLE, ...gridPosition, borderStyle: "dashed", color: "#888" }}
                title={display?.name}
              >
                <span>Falta</span>
                <span>
                  {display?.name} {display?.number}
                </span>
              </div>
            );
          }

          return <div key={code} style={{ ...POCKET_STYLE, ...gridPosition, opacity: 0.3 }} />;
        })}
      </div>
    </section>
  );
}

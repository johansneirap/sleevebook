"use client";

import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode } from "@sleevebook/binder-core";
import type { CSSProperties } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { sleeveOverlayStyle } from "../../lib/theme-presets";

interface FaceGridProps {
  face: SheetFace;
  format: Format;
  pockets: Layout["pockets"];
  displays: Map<string, VariantDisplay>;
  sleeve: string;
  onCardClick?: (display: VariantDisplay) => void;
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

export function FaceGrid({ face, format, pockets, displays, sleeve, onCardClick }: FaceGridProps) {
  const codes = Array.from({ length: format.rows * format.cols }, (_, i) =>
    formatPocketCode({ sheet: face.sheet, side: face.side, index: i + 1 }),
  );
  const overlayStyle = sleeveOverlayStyle(sleeve);

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
        {codes.map((code) => {
          const content = pockets[code];
          const display =
            content?.kind === "card" || content?.kind === "placeholder"
              ? displays.get(content.variant)
              : undefined;

          if (content?.kind === "card") {
            return (
              <button
                key={code}
                type="button"
                onClick={() => display && onCardClick?.(display)}
                style={{
                  ...POCKET_STYLE,
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
                    }}
                  />
                )}
                {display?.imageUrl ? (
                  // biome-ignore lint/performance/noImgElement: viewer MVP, no next/image config yet
                  <img
                    src={display.imageUrl}
                    alt={display.name}
                    style={{ maxWidth: "100%", maxHeight: "100%" }}
                  />
                ) : (
                  <span>
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
                style={{ ...POCKET_STYLE, borderStyle: "dashed", color: "#888" }}
                title={display?.name}
              >
                <span>Falta</span>
                <span>
                  {display?.name} {display?.number}
                </span>
              </div>
            );
          }

          return <div key={code} style={{ ...POCKET_STYLE, opacity: 0.3 }} />;
        })}
      </div>
    </section>
  );
}

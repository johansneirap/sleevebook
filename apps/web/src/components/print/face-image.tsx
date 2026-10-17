import type { Format, Layout, SheetFace } from "@sleevebook/binder-core";
import { formatPocketCode, panelCoverageMap } from "@sleevebook/binder-core";
import type { CSSProperties, ReactNode } from "react";
import type { VariantDisplay } from "../../lib/binders";
import { sideLabel } from "./print-model";

// Layout for next/og's ImageResponse (satori). Satori only understands flex
// and absolute positioning and needs plain hex colors, so every element here
// is absolutely placed with numeric pixel sizes.

export const FACE_IMAGE_WIDTH = 1200;

const PAD = 56;
const GAP = 12;
const FOOTER_SPACE = 86;
const CARD_RATIO = 88 / 63;

const COLORS = {
  velvet: "#14110f",
  leather: "#2a201a",
  leatherDeep: "#1a1411",
  linen: "#ede6da",
  smoke: "#a39a8e",
  foil: "#d4b77c",
};

interface Geometry {
  cellW: number;
  cellH: number;
}

function geometry(format: Format): Geometry {
  const cellW = (FACE_IMAGE_WIDTH - PAD * 2 - (format.cols - 1) * GAP) / format.cols;
  return { cellW, cellH: cellW * CARD_RATIO };
}

/** Pixel height of the face image for a given grid format. */
export function faceImageHeight(format: Format): number {
  const { cellH } = geometry(format);
  const gridH = format.rows * cellH + (format.rows - 1) * GAP;
  return Math.ceil(PAD + gridH + FOOTER_SPACE);
}

function cellBox(row: number, col: number, spanRows: number, spanCols: number, g: Geometry) {
  return {
    left: PAD + col * (g.cellW + GAP),
    top: PAD + row * (g.cellH + GAP),
    width: spanCols * g.cellW + (spanCols - 1) * GAP,
    height: spanRows * g.cellH + (spanRows - 1) * GAP,
  };
}

const ABSOLUTE: CSSProperties = { position: "absolute", display: "flex" };

function Placeholder({
  name,
  number,
  code,
  width,
  height,
  left,
  top,
  nameSize,
}: {
  name: string;
  number: string;
  code: string;
  width: number;
  height: number;
  left: number;
  top: number;
  nameSize: number;
}) {
  return (
    <div
      style={{
        ...ABSOLUTE,
        left,
        top,
        width,
        height,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: `2px dashed ${COLORS.smoke}`,
        padding: 8,
        color: COLORS.smoke,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", fontSize: 13, letterSpacing: 2, textTransform: "uppercase" }}>
        Falta
      </div>
      <div style={{ display: "flex", fontSize: nameSize, marginTop: 6 }}>{name}</div>
      <div style={{ display: "flex", fontSize: 14, marginTop: 4 }}>{number}</div>
      <div style={{ display: "flex", fontSize: 13, marginTop: 8 }}>{code}</div>
    </div>
  );
}

export interface FaceImageProps {
  face: SheetFace;
  format: Format;
  pockets: Layout["pockets"];
  panels: Layout["panels"];
  displays: Map<string, VariantDisplay>;
}

export function FaceImage({ face, format, pockets, panels, displays }: FaceImageProps) {
  const g = geometry(format);
  const height = faceImageHeight(format);
  const coverage = panelCoverageMap(panels, format);
  const nameSize = Math.max(12, Math.round(g.cellW * 0.075));

  const cells: ReactNode[] = [];

  for (let row = 0; row < format.rows; row++) {
    for (let col = 0; col < format.cols; col++) {
      const index = row * format.cols + col + 1;
      const code = formatPocketCode({ sheet: face.sheet, side: face.side, index });
      const box = cellBox(row, col, 1, 1, g);
      const covered = coverage.get(code);

      if (covered) {
        if (!covered.isAnchor) {
          continue;
        }
        const span = covered.panel.span;
        const panelBox = cellBox(row, col, span.rows, span.cols, g);
        const zoom = covered.panel.crop.zoom / 100;
        const imgW = zoom * panelBox.width;
        const imgH = zoom * panelBox.height;
        cells.push(
          <div
            key={code}
            style={{
              ...ABSOLUTE,
              left: panelBox.left,
              top: panelBox.top,
              width: panelBox.width,
              height: panelBox.height,
              overflow: "hidden",
              borderRadius: 8,
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: satori requires a plain <img> */}
            <img
              alt=""
              src={covered.panel.asset}
              width={imgW}
              height={imgH}
              style={{
                position: "absolute",
                left: (covered.panel.crop.x / 100) * panelBox.width - imgW / 2,
                top: (covered.panel.crop.y / 100) * panelBox.height - imgH / 2,
                width: imgW,
                height: imgH,
                objectFit: "cover",
              }}
            />
          </div>,
        );
        continue;
      }

      const content = pockets[code];
      const display =
        content?.kind === "card" || content?.kind === "placeholder"
          ? displays.get(content.variant)
          : undefined;

      if (content?.kind === "card") {
        cells.push(
          <div
            key={code}
            style={{
              ...ABSOLUTE,
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              overflow: "hidden",
              borderRadius: 8,
              background: COLORS.leatherDeep,
              border: "1px solid rgba(255, 246, 225, 0.22)",
            }}
          >
            {display?.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: satori requires a plain <img>
              <img
                alt=""
                src={display.imageUrl}
                width={box.width}
                height={box.height}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: box.width,
                  height: box.height,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  ...ABSOLUTE,
                  left: 0,
                  top: 0,
                  width: box.width,
                  height: box.height,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 8,
                  color: COLORS.linen,
                  fontSize: nameSize,
                  textAlign: "center",
                }}
              >
                {display ? `${display.name} ${display.number}` : code}
              </div>
            )}
          </div>,
        );
        continue;
      }

      if (content?.kind === "placeholder") {
        cells.push(
          <Placeholder
            key={code}
            name={display?.name ?? "Carta"}
            number={display?.number ?? ""}
            code={code}
            left={box.left}
            top={box.top}
            width={box.width}
            height={box.height}
            nameSize={nameSize}
          />,
        );
        continue;
      }

      cells.push(
        <div
          key={code}
          style={{
            ...ABSOLUTE,
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        />,
      );
    }
  }

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: FACE_IMAGE_WIDTH,
        height,
        background: `linear-gradient(180deg, ${COLORS.leather}, ${COLORS.leatherDeep})`,
        color: COLORS.linen,
      }}
    >
      <div
        style={{
          ...ABSOLUTE,
          left: 14,
          top: 14,
          right: 14,
          bottom: 14,
          border: `1px solid ${COLORS.foil}`,
          opacity: 0.3,
          borderRadius: 2,
        }}
      />
      {cells}
      <div
        style={{
          ...ABSOLUTE,
          left: PAD,
          right: PAD,
          bottom: 30,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: COLORS.smoke,
        }}
      >
        {`Binder · Hoja ${face.sheet} · ${sideLabel(face.side)}`}
      </div>
    </div>
  );
}

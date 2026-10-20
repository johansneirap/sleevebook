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

// v2 "Estante" light palette: paper page, clear sleeves, small footer.
const COLORS = {
  paper: "#fbfbf7",
  paperEdge: "#ecece4",
  sleeve: "#f1f3f8",
  sleeveLine: "#e3e6ef",
  ink: "#1b2033",
  muted: "#5b6278",
  accent: "#3451d1",
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
        border: `2px dashed ${COLORS.muted}`,
        background: "#ffffff",
        padding: 8,
        color: COLORS.muted,
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", fontSize: 13, fontWeight: 600 }}>Falta</div>
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
  binderName: string;
}

export function FaceImage({ face, format, pockets, panels, displays, binderName }: FaceImageProps) {
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
              background: COLORS.sleeve,
              border: `1px solid ${COLORS.sleeveLine}`,
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
                  color: COLORS.ink,
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
            background: "#ffffff",
            border: `1px solid ${COLORS.sleeveLine}`,
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
        background: `linear-gradient(180deg, ${COLORS.paper}, ${COLORS.paperEdge})`,
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          ...ABSOLUTE,
          left: 14,
          top: 14,
          right: 14,
          bottom: 14,
          border: `1px solid ${COLORS.sleeveLine}`,
          borderRadius: 8,
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
          fontWeight: 600,
          color: COLORS.muted,
        }}
      >
        {`${binderName} · Hoja ${face.sheet} · ${sideLabel(face.side)}`}
      </div>
    </div>
  );
}

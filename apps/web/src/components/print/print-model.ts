import type { Layout, SheetFace } from "@sleevebook/binder-core";
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  panelCoverageMap,
  parsePocketCode,
  slicePanel,
} from "@sleevebook/binder-core";

// Physical output model shared by the printable page and the per-face PNG.
// Pure functions only, so they run in server components and route handlers.

export const PAPER_SIZES = {
  a4: { label: "A4", widthMm: 210, heightMm: 297 },
  carta: { label: "Carta", widthMm: 215.9, heightMm: 279.4 },
} as const;

export type PaperId = keyof typeof PAPER_SIZES;

export type PlaceholderStyleId = "ficha" | "silueta" | "minimal" | "vacio-con-borde";

/** Each printed sheet holds a 3 x 3 grid of 63 x 88 mm pieces. */
export const PRINT_GRID = { cols: 3, rows: 3 } as const;
/** Gap between pieces; it hosts the crop marks. */
export const PRINT_GAP_MM = 4;

export function parsePaper(value: string | undefined): PaperId {
  return value === "carta" ? "carta" : "a4";
}

export interface PanelImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PrintPiece {
  /** Pocket code, e.g. "S1·F·3". */
  code: string;
  kind: "placeholder" | "panel";
  /** Placeholder pieces only. */
  variant?: string;
  style?: PlaceholderStyleId;
  /** Panel pieces only: where the panel art sits, in mm relative to the piece. */
  panelAsset?: string;
  panelBox?: PanelImageBox;
}

export interface PrintOptions {
  includePanels: boolean;
  /** Keep only placeholders whose card the binder does not own yet. */
  onlyMissing: boolean;
}

function sortKey(code: string): number {
  const { sheet, side, index } = parsePocketCode(code);
  return sheet * 1_000_000 + (side === "F" ? 0 : 500_000) + index;
}

/**
 * Every physical piece to print, in pocket order (sheet, front before back,
 * index). Placeholders always print; panel pieces only when requested.
 * Panel pieces are the real 63 x 88 mm slices of the art, seams included.
 */
export function buildPrintPieces(layout: Layout, options: PrintOptions): PrintPiece[] {
  const { format, pockets, panels } = layout;
  const coverage = panelCoverageMap(panels, format);
  const owned = new Set<string>();
  for (const content of Object.values(pockets)) {
    if (content.kind === "card") {
      owned.add(content.variant);
    }
  }

  const pieces: PrintPiece[] = [];

  for (const [code, content] of Object.entries(pockets)) {
    if (content.kind !== "placeholder" || coverage.has(code)) {
      continue;
    }
    if (options.onlyMissing && owned.has(content.variant)) {
      continue;
    }
    pieces.push({ code, kind: "placeholder", variant: content.variant, style: content.style });
  }

  if (options.includePanels) {
    for (const panel of panels) {
      const seamMm = panel.seamMm;
      const totalW = panel.span.cols * CARD_WIDTH_MM + (panel.span.cols - 1) * seamMm;
      const totalH = panel.span.rows * CARD_HEIGHT_MM + (panel.span.rows - 1) * seamMm;
      const imgW = (panel.crop.zoom / 100) * totalW;
      const imgH = (panel.crop.zoom / 100) * totalH;
      const slices = slicePanel(
        { id: panel.id, anchor: parsePocketCode(panel.anchor), span: panel.span },
        format,
        seamMm,
      );
      for (const slice of slices) {
        // Physical origin of this piece inside the whole panel (seams included).
        const originX = slice.rect.x0 * totalW;
        const originY = slice.rect.y0 * totalH;
        pieces.push({
          code: `S${slice.pocket.sheet}·${slice.pocket.side}·${slice.pocket.index}`,
          kind: "panel",
          panelAsset: panel.asset,
          panelBox: {
            left: (panel.crop.x / 100) * totalW - imgW / 2 - originX,
            top: (panel.crop.y / 100) * totalH - imgH / 2 - originY,
            width: imgW,
            height: imgH,
          },
        });
      }
    }
  }

  return pieces.sort((a, b) => sortKey(a.code) - sortKey(b.code));
}

export function chunkPieces<T>(items: T[], perSheet: number): T[][] {
  const sheets: T[][] = [];
  for (let i = 0; i < items.length; i += perSheet) {
    sheets.push(items.slice(i, i + perSheet));
  }
  return sheets;
}

/** Face parameter used in URLs: "S1-F" or "S2-B". */
export function faceParam(face: SheetFace): string {
  return `S${face.sheet}-${face.side}`;
}

export function parseFaceParam(value: string): SheetFace | null {
  const match = /^S(\d+)-([FB])$/i.exec(value);
  if (!match) {
    return null;
  }
  const sheet = Number(match[1]);
  if (!Number.isInteger(sheet) || sheet < 1) {
    return null;
  }
  return { sheet, side: (match[2] as string).toUpperCase() === "F" ? "F" : "B" };
}

export function sideLabel(side: "F" | "B"): string {
  return side === "F" ? "Frente" : "Reverso";
}

export function faceLabel(face: SheetFace): string {
  return `Hoja ${face.sheet} · ${sideLabel(face.side)}`;
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function faceFileName(binderName: string, face: SheetFace): string {
  const base = slugify(binderName) || "binder";
  return `${base}-hoja-${face.sheet}-${face.side === "F" ? "frente" : "reverso"}.png`;
}

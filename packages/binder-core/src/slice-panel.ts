import type { Format } from "./format";
import { coveredPockets, type Panel } from "./panel";
import type { PocketCode } from "./pocket-code";

// Physical sleeve size (mm) shared with the printed PDFs; see docs/PRODUCT.md NFR.
export const CARD_WIDTH_MM = 63;
export const CARD_HEIGHT_MM = 88;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PanelSlice {
  pocket: PocketCode;
  rect: Rect;
}

function axisBounds(offset: number, cellMm: number, seamMm: number, count: number) {
  const totalMm = count * cellMm + (count - 1) * seamMm;
  const start = (offset * (cellMm + seamMm)) / totalMm;
  const end = (offset * (cellMm + seamMm) + cellMm) / totalMm;
  return { start, end };
}

export function slicePanel(panel: Panel, format: Format, seamMm: number): PanelSlice[] {
  const pockets = coveredPockets(panel, format);

  return pockets.map((pocket, i) => {
    const dr = Math.floor(i / panel.span.cols);
    const dc = i % panel.span.cols;
    const x = axisBounds(dc, CARD_WIDTH_MM, seamMm, panel.span.cols);
    const y = axisBounds(dr, CARD_HEIGHT_MM, seamMm, panel.span.rows);
    return {
      pocket,
      rect: { x0: x.start, y0: y.start, x1: x.end, y1: y.end },
    };
  });
}

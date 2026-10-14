import type { Format } from "./format";
import { formatPocketCode, type PocketCode, parsePocketCode } from "./pocket-code";

export interface PanelSpan {
  rows: number;
  cols: number;
}

export interface Panel {
  id: string;
  anchor: PocketCode;
  span: PanelSpan;
}

export class PanelOutOfBoundsError extends Error {
  constructor(panelId: string) {
    super(`Panel "${panelId}" does not fit within the side`);
  }
}

export class PanelOverlapError extends Error {
  constructor(panelIdA: string, panelIdB: string) {
    super(`Panel "${panelIdA}" overlaps panel "${panelIdB}"`);
  }
}

function indexToRowCol(index: number, format: Format): { row: number; col: number } {
  return {
    row: Math.floor((index - 1) / format.cols) + 1,
    col: ((index - 1) % format.cols) + 1,
  };
}

function rowColToIndex(row: number, col: number, format: Format): number {
  return (row - 1) * format.cols + (col - 1) + 1;
}

export function coveredPockets(panel: Panel, format: Format): PocketCode[] {
  const anchorPosition = indexToRowCol(panel.anchor.index, format);
  const pockets: PocketCode[] = [];

  for (let dr = 0; dr < panel.span.rows; dr++) {
    for (let dc = 0; dc < panel.span.cols; dc++) {
      const row = anchorPosition.row + dr;
      const col = anchorPosition.col + dc;
      if (row > format.rows || col > format.cols) {
        throw new PanelOutOfBoundsError(panel.id);
      }
      pockets.push({
        sheet: panel.anchor.sheet,
        side: panel.anchor.side,
        index: rowColToIndex(row, col, format),
      });
    }
  }

  return pockets;
}

function sameFace(a: PocketCode, b: PocketCode): boolean {
  return a.sheet === b.sheet && a.side === b.side;
}

export function panelsOverlap(a: Panel, b: Panel, format: Format): boolean {
  if (!sameFace(a.anchor, b.anchor)) {
    return false;
  }
  const aIndexes = new Set(coveredPockets(a, format).map((p) => p.index));
  return coveredPockets(b, format).some((p) => aIndexes.has(p.index));
}

export function validatePanels(panels: Panel[], format: Format): void {
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i] as Panel;
    coveredPockets(panel, format);
    for (let j = i + 1; j < panels.length; j++) {
      const other = panels[j] as Panel;
      if (panelsOverlap(panel, other, format)) {
        throw new PanelOverlapError(panel.id, other.id);
      }
    }
  }
}

// The app's persisted layout stores a panel's anchor as a pocket code string
// (what the Zod schema validates), not the parsed PocketCode object this
// module works with internally. This bridges the two: accepts any panel-like
// shape with a string anchor, parses it just to compute coverage, and hands
// back the original (richer) objects -- so callers rendering a binder don't
// need to know about the string/object split at all.
export function panelCoverageMap<P extends { id: string; anchor: string; span: PanelSpan }>(
  panels: P[],
  format: Format,
): Map<string, { panel: P; isAnchor: boolean }> {
  const map = new Map<string, { panel: P; isAnchor: boolean }>();
  for (const layoutPanel of panels) {
    const panel: Panel = {
      id: layoutPanel.id,
      anchor: parsePocketCode(layoutPanel.anchor),
      span: layoutPanel.span,
    };
    for (const pocket of coveredPockets(panel, format)) {
      const code = formatPocketCode(pocket);
      map.set(code, { panel: layoutPanel, isAnchor: code === layoutPanel.anchor });
    }
  }
  return map;
}

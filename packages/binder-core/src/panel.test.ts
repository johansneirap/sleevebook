import { describe, expect, it } from "vitest";
import {
  coveredPockets,
  type Panel,
  PanelOutOfBoundsError,
  PanelOverlapError,
  validatePanels,
} from "./panel.js";

const FORMAT_3X3 = { rows: 3, cols: 3 };

describe("panel", () => {
  it("covers all 9 pockets of a full-page panel", () => {
    const panel: Panel = {
      id: "p1",
      anchor: { sheet: 1, side: "F", index: 1 },
      span: { rows: 3, cols: 3 },
    };
    const pockets = coveredPockets(panel, FORMAT_3X3);
    expect(pockets.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("covers a row of 3 pockets starting at index 7", () => {
    const panel: Panel = {
      id: "p2",
      anchor: { sheet: 2, side: "F", index: 7 },
      span: { rows: 1, cols: 3 },
    };
    const pockets = coveredPockets(panel, FORMAT_3X3);
    expect(pockets.map((p) => p.index)).toEqual([7, 8, 9]);
  });

  it("rejects a span that runs off the side", () => {
    const panel: Panel = {
      id: "p3",
      anchor: { sheet: 1, side: "F", index: 3 },
      span: { rows: 2, cols: 2 },
    };
    expect(() => coveredPockets(panel, FORMAT_3X3)).toThrow(PanelOutOfBoundsError);
  });

  it("rejects two panels that overlap on the same face", () => {
    const panels: Panel[] = [
      { id: "p1", anchor: { sheet: 1, side: "F", index: 1 }, span: { rows: 1, cols: 2 } },
      { id: "p2", anchor: { sheet: 1, side: "F", index: 2 }, span: { rows: 1, cols: 2 } },
    ];
    expect(() => validatePanels(panels, FORMAT_3X3)).toThrow(PanelOverlapError);
  });

  it("accepts panels that do not overlap", () => {
    const panels: Panel[] = [
      { id: "p1", anchor: { sheet: 1, side: "F", index: 1 }, span: { rows: 1, cols: 1 } },
      { id: "p2", anchor: { sheet: 1, side: "F", index: 2 }, span: { rows: 1, cols: 1 } },
    ];
    expect(() => validatePanels(panels, FORMAT_3X3)).not.toThrow();
  });

  it("accepts panels with the same span on different faces", () => {
    const panels: Panel[] = [
      { id: "p1", anchor: { sheet: 1, side: "F", index: 1 }, span: { rows: 1, cols: 2 } },
      { id: "p2", anchor: { sheet: 1, side: "B", index: 1 }, span: { rows: 1, cols: 2 } },
    ];
    expect(() => validatePanels(panels, FORMAT_3X3)).not.toThrow();
  });
});

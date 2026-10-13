import { describe, expect, it } from "vitest";
import type { Panel } from "./panel";
import { slicePanel } from "./slice-panel";

const FORMAT_3X3 = { rows: 3, cols: 3 };

describe("slicePanel", () => {
  it("slices a 1x3 row into three contiguous crops with no seam", () => {
    const panel: Panel = {
      id: "p1",
      anchor: { sheet: 1, side: "F", index: 1 },
      span: { rows: 1, cols: 3 },
    };
    const slices = slicePanel(panel, FORMAT_3X3, 0);

    expect(slices.map((s) => [s.rect.x0, s.rect.x1])).toEqual([
      [0, 1 / 3],
      [1 / 3, 2 / 3],
      [2 / 3, 1],
    ]);
    expect(slices.every((s) => s.rect.y0 === 0 && s.rect.y1 === 1)).toBe(true);
  });

  it("leaves a gap between crops when a seam is compensated", () => {
    const panel: Panel = {
      id: "p1",
      anchor: { sheet: 1, side: "F", index: 1 },
      span: { rows: 1, cols: 2 },
    };
    const slices = slicePanel(panel, FORMAT_3X3, 2);

    expect(slices[0]?.rect.x1).toBeLessThan(slices[1]?.rect.x0 as number);
  });
});

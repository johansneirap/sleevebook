import { describe, expect, it } from "vitest";
import { foilMaskSchema } from "./foil-mask";
import {
  addZone,
  FOIL_NUDGE_STEP,
  MAX_FOIL_ZONES,
  MIN_FOIL_ZONE_SIZE,
  moveZone,
  normalizeZone,
  nudgeForKey,
  removeZone,
  replaceZone,
  resizeZone,
  zoneFromPoints,
} from "./foil-mask-edit";

const BASE = { x: 0.2, y: 0.2, w: 0.4, h: 0.3 };

describe("normalizeZone", () => {
  it("clamps into the card and enforces the minimum size", () => {
    expect(normalizeZone({ x: -0.5, y: 1.5, w: 0, h: 2 })).toEqual({
      x: 0,
      y: 0,
      w: MIN_FOIL_ZONE_SIZE,
      h: 1,
    });
    expect(normalizeZone({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 })).toEqual({
      x: 0.5,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
  });
});

describe("zoneFromPoints", () => {
  it("builds the rectangle whatever the drag direction", () => {
    const forward = zoneFromPoints({ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.4 });
    const backward = zoneFromPoints({ x: 0.5, y: 0.4 }, { x: 0.1, y: 0.1 });
    expect(forward).toEqual(backward);
    expect(forward.x).toBeCloseTo(0.1);
    expect(forward.w).toBeCloseTo(0.4);
    expect(forward.h).toBeCloseTo(0.3);
  });
});

describe("moveZone", () => {
  it("keeps the size and stops at the card edges", () => {
    const moved = moveZone(BASE, 0.5, -0.5);
    expect(moved.w).toBe(BASE.w);
    expect(moved.h).toBe(BASE.h);
    expect(moved.x).toBeCloseTo(0.6);
    expect(moved.y).toBe(0);
    expect(moveZone(BASE, 5, 5)).toEqual({ x: 0.6, y: 0.7, w: 0.4, h: 0.3 });
  });
});

describe("resizeZone", () => {
  it("moves the right edge with the e handle", () => {
    const r = resizeZone(BASE, "e", 0.1, 0);
    expect(r.x).toBe(BASE.x);
    expect(r.w).toBeCloseTo(0.5);
  });

  it("moves the top-left corner with the nw handle", () => {
    const r = resizeZone(BASE, "nw", -0.1, -0.05);
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(0.15);
    expect(r.x + r.w).toBeCloseTo(BASE.x + BASE.w);
    expect(r.y + r.h).toBeCloseTo(BASE.y + BASE.h);
  });

  it("never shrinks below the minimum size", () => {
    const r = resizeZone(BASE, "se", -10, -10);
    expect(r.w).toBe(MIN_FOIL_ZONE_SIZE);
    expect(r.h).toBe(MIN_FOIL_ZONE_SIZE);
    const left = resizeZone(BASE, "w", 10, 0);
    expect(left.w).toBeCloseTo(MIN_FOIL_ZONE_SIZE);
    expect(left.x + left.w).toBeCloseTo(BASE.x + BASE.w);
  });

  it("stops at the card edges", () => {
    const r = resizeZone(BASE, "se", 10, 10);
    expect(r.x + r.w).toBe(1);
    expect(r.y + r.h).toBe(1);
    const t = resizeZone(BASE, "n", 0, -10);
    expect(t.y).toBe(0);
  });
});

describe("zone list helpers", () => {
  it("adds up to MAX_FOIL_ZONES zones and then refuses", () => {
    let zones: ReturnType<typeof addZone> = [];
    for (let i = 0; i < MAX_FOIL_ZONES + 3; i += 1) {
      zones = addZone(zones, BASE);
    }
    expect(zones).toHaveLength(MAX_FOIL_ZONES);
  });

  it("removes and replaces by index without mutating the input", () => {
    const zones = [BASE, { x: 0, y: 0, w: 0.1, h: 0.1 }];
    expect(removeZone(zones, 0)).toEqual([zones[1]]);
    expect(replaceZone(zones, 1, { x: 0.9, y: 0.9, w: 0.5, h: 0.5 })[1]).toEqual({
      x: 0.5,
      y: 0.5,
      w: 0.5,
      h: 0.5,
    });
    expect(zones).toHaveLength(2);
  });

  it("produces masks that pass foilMaskSchema", () => {
    const zones = addZone(addZone([], BASE), { x: 0, y: 0, w: 1, h: 1 });
    expect(foilMaskSchema.safeParse({ mode: "inside", zones }).success).toBe(true);
  });
});

describe("nudgeForKey", () => {
  it("maps arrow keys to half-percent steps", () => {
    expect(nudgeForKey("ArrowLeft")).toEqual({ dx: -FOIL_NUDGE_STEP, dy: 0 });
    expect(nudgeForKey("ArrowDown")).toEqual({ dx: 0, dy: FOIL_NUDGE_STEP });
    expect(nudgeForKey("a")).toBeNull();
  });
});

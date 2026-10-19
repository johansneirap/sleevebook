import type { FoilMask, FoilZone } from "./foil-mask";

// Pure geometry and mode helpers for the foil mask editor (admin only, render
// level N4). Coordinates are normalized 0..1 card coordinates (x→right, y→down).

export const MAX_FOIL_ZONES = 8;
/** Smallest width/height a zone can be shrunk to (2% of the card). */
export const MIN_FOIL_ZONE_SIZE = 0.02;
/** Distance an arrow key moves the selected zone (0.5% of the card). */
export const FOIL_NUDGE_STEP = 0.005;

export type FoilZoneHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const FOIL_MODE_OPTIONS: ReadonlyArray<{
  mode: FoilMask["mode"];
  label: string;
  description: string;
}> = [
  {
    mode: "inside",
    label: "Dentro de las zonas",
    description: "El foil brilla solo dentro de las zonas marcadas (holo, arte).",
  },
  {
    mode: "outside",
    label: "Fuera de las zonas",
    description: "El foil brilla en todo menos las zonas (reverse, marcos).",
  },
  {
    mode: "full",
    label: "Toda la carta",
    description: "El foil cubre la carta entera; las zonas se ignoran.",
  },
  {
    mode: "none",
    label: "Sin foil",
    description: "La carta no tiene brillo de foil.",
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamps a zone to the card and enforces the minimum size. */
export function normalizeZone(zone: FoilZone): FoilZone {
  const w = clamp(zone.w, MIN_FOIL_ZONE_SIZE, 1);
  const h = clamp(zone.h, MIN_FOIL_ZONE_SIZE, 1);
  return {
    x: clamp(zone.x, 0, 1 - w),
    y: clamp(zone.y, 0, 1 - h),
    w,
    h,
  };
}

/** The rectangle spanned by two corner points (drag start and current pointer). */
export function zoneFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): FoilZone {
  return normalizeZone({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  });
}

/** Moves a zone by (dx, dy) keeping its size, stopping at the card edges. */
export function moveZone(zone: FoilZone, dx: number, dy: number): FoilZone {
  return normalizeZone({ ...zone, x: zone.x + dx, y: zone.y + dy });
}

/** Resizes a zone by dragging one of its handles by (dx, dy). */
export function resizeZone(
  zone: FoilZone,
  handle: FoilZoneHandle,
  dx: number,
  dy: number,
): FoilZone {
  const right = zone.x + zone.w;
  const bottom = zone.y + zone.h;
  let { x, y, w, h } = zone;

  if (handle.includes("w")) {
    x = clamp(zone.x + dx, 0, right - MIN_FOIL_ZONE_SIZE);
    w = right - x;
  }
  if (handle.includes("e")) {
    w = clamp(zone.w + dx, MIN_FOIL_ZONE_SIZE, 1 - zone.x);
  }
  if (handle.includes("n")) {
    y = clamp(zone.y + dy, 0, bottom - MIN_FOIL_ZONE_SIZE);
    h = bottom - y;
  }
  if (handle.includes("s")) {
    h = clamp(zone.h + dy, MIN_FOIL_ZONE_SIZE, 1 - zone.y);
  }
  return normalizeZone({ x, y, w, h });
}

/** Adds a zone unless the mask already has MAX_FOIL_ZONES. Returns a new array. */
export function addZone(zones: readonly FoilZone[], zone: FoilZone): FoilZone[] {
  if (zones.length >= MAX_FOIL_ZONES) {
    return [...zones];
  }
  return [...zones, normalizeZone(zone)];
}

/** Removes the zone at `index`. Returns a new array. */
export function removeZone(zones: readonly FoilZone[], index: number): FoilZone[] {
  return zones.filter((_, i) => i !== index);
}

/** Replaces the zone at `index`, normalizing it. Returns a new array. */
export function replaceZone(zones: readonly FoilZone[], index: number, zone: FoilZone): FoilZone[] {
  return zones.map((current, i) => (i === index ? normalizeZone(zone) : current));
}

/** Maps an arrow key to a (dx, dy) nudge, or null for any other key. */
export function nudgeForKey(
  key: string,
  step = FOIL_NUDGE_STEP,
): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -step, dy: 0 };
    case "ArrowRight":
      return { dx: step, dy: 0 };
    case "ArrowUp":
      return { dx: 0, dy: -step };
    case "ArrowDown":
      return { dx: 0, dy: step };
    default:
      return null;
  }
}

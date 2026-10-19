import type { FoilMask } from "@sleevebook/binder-core";

// Blur (in the 0..100 viewBox units) that feathers zone edges by ~1.5% of the
// card, so the foil never looks stamped on.
const FEATHER_STD_DEV = 0.75;

function zoneRects(mask: FoilMask, fill: "white" | "black"): string {
  return mask.zones
    .map(
      (z) =>
        `<rect x='${z.x * 100}' y='${z.y * 100}' width='${z.w * 100}' height='${z.h * 100}' fill='${fill}' filter='url(#f)'/>`,
    )
    .join("");
}

/**
 * CSS `mask-image` value for a foil mask, built as an inline SVG data URL so it
 * renders the same in Chrome and Safari (no mask-composite needed). Returns null
 * when the mask has no foil at all (mode "none"). Use mask-size 100% 100%.
 */
export function foilMaskCssImage(mask: FoilMask): string | null {
  if (mask.mode === "none") {
    return null;
  }
  const filter = `<filter id='f' x='-10%' y='-10%' width='120%' height='120%'><feGaussianBlur stdDeviation='${FEATHER_STD_DEV}'/></filter>`;
  let body: string;
  if (mask.mode === "full") {
    body = "<rect width='100' height='100' fill='white'/>";
  } else if (mask.mode === "inside") {
    // White only within the zones: a luminance mask with white zones on black.
    body = `<defs>${filter}<mask id='m'><rect width='100' height='100' fill='black'/>${zoneRects(mask, "white")}</mask></defs><rect width='100' height='100' fill='white' mask='url(#m)'/>`;
  } else {
    // "outside": white everywhere except the zones (the zones are cut out).
    body = `<defs>${filter}<mask id='m'><rect width='100' height='100' fill='white'/>${zoneRects(mask, "black")}</mask></defs><rect width='100' height='100' fill='white' mask='url(#m)'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

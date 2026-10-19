import { z } from "zod";

/** A rectangle in card coordinates, normalized 0..1 (x→right, y→down). */
export const foilZoneSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().gt(0).max(1),
  h: z.number().gt(0).max(1),
});
export type FoilZone = z.infer<typeof foilZoneSchema>;

/**
 * Where a card's foil shines (render level N4). "inside": only within the
 * zones (a holo rare's art window). "outside": everywhere except the zones
 * (a reverse holo's frame). "full": the whole card (zones ignored). "none":
 * no foil at all.
 */
export const foilMaskSchema = z.object({
  mode: z.enum(["inside", "outside", "full", "none"]),
  zones: z.array(foilZoneSchema).max(8),
});
export type FoilMask = z.infer<typeof foilMaskSchema>;

/** Standard modern layout: the illustration window, upper half of the card. */
export const STANDARD_ART_WINDOW: FoilZone = { x: 0.08, y: 0.1, w: 0.84, h: 0.42 };

/** Default mask by catalog variant, used when no hand-made mask exists. */
export function defaultFoilMask(variant: string): FoilMask {
  switch (variant) {
    case "holo":
      return { mode: "inside", zones: [STANDARD_ART_WINDOW] };
    case "reverse":
    case "pokeball":
    case "masterball":
      return { mode: "outside", zones: [STANDARD_ART_WINDOW] };
    default:
      return { mode: "none", zones: [] };
  }
}

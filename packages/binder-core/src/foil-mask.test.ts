import { describe, expect, it } from "vitest";
import { defaultFoilMask, foilMaskSchema } from "./foil-mask";

describe("defaultFoilMask", () => {
  it("puts holo foil inside the art window and reverse foil outside it", () => {
    expect(defaultFoilMask("holo").mode).toBe("inside");
    expect(defaultFoilMask("reverse").mode).toBe("outside");
    expect(defaultFoilMask("normal")).toEqual({ mode: "none", zones: [] });
  });

  it("produces masks that pass the schema", () => {
    for (const v of ["holo", "reverse", "pokeball", "masterball", "normal"]) {
      expect(foilMaskSchema.safeParse(defaultFoilMask(v)).success).toBe(true);
    }
  });

  it("rejects zones outside the card", () => {
    expect(
      foilMaskSchema.safeParse({ mode: "inside", zones: [{ x: 0, y: 0, w: 1.5, h: 1 }] }).success,
    ).toBe(false);
  });
});

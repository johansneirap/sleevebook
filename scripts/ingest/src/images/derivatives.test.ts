import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deriveImageSizes } from "./derivatives";

async function makeTestImage(): Promise<Buffer> {
  return sharp({
    create: { width: 734, height: 1024, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

describe("deriveImageSizes", () => {
  it("produces a thumbnail and medium derivative sized within their bounding box", async () => {
    const original = await makeTestImage();
    const { thumbnail, medium, high } = await deriveImageSizes(original);

    const thumbnailMeta = await sharp(thumbnail).metadata();
    expect(thumbnailMeta.width).toBeLessThanOrEqual(245);
    expect(thumbnailMeta.height).toBeLessThanOrEqual(342);

    const mediumMeta = await sharp(medium).metadata();
    expect(mediumMeta.width).toBeLessThanOrEqual(490);
    expect(mediumMeta.height).toBeLessThanOrEqual(684);

    expect(high).toBe(original);
  });
});

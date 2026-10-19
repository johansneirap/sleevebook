import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deriveImageSizes } from "./derivatives";

async function makeTestImage(): Promise<Buffer> {
  return sharp({
    create: { width: 734, height: 1024, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
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

    // "high" keeps the original size, re-encoded as JPEG (stored as high.jpg).
    const highMeta = await sharp(high).metadata();
    expect(highMeta.format).toBe("jpeg");
    expect(highMeta.width).toBe(734);
    expect(highMeta.height).toBe(1024);
  });
});

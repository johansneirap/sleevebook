import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processVariantImage } from "./pipeline";
import type { ImageStorage } from "./storage";

function createFakeStorage(): ImageStorage & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async putObject(key, body) {
      objects.set(key, body);
    },
    async objectExists(key) {
      return objects.has(key);
    },
  };
}

async function makeTestImage(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 140, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toBuffer();
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("processVariantImage", () => {
  it("downloads, derives and uploads the three sizes, returning public URLs", async () => {
    const image = await makeTestImage();
    const fetchMock = vi.fn().mockResolvedValue(new Response(image, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const storage = createFakeStorage();
    const urls = await processVariantImage(
      { storage, publicAssetsUrl: "https://assets.sleevebook.com/" },
      "sv1-112-normal",
      "https://images.pokemontcg.io/sv1/112.png",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(storage.objects.has("cards/sv1-112-normal/thumbnail.jpg")).toBe(true);
    expect(storage.objects.has("cards/sv1-112-normal/medium.jpg")).toBe(true);
    expect(storage.objects.has("cards/sv1-112-normal/high.jpg")).toBe(true);
    expect(urls).toEqual({
      thumbnail: "https://assets.sleevebook.com/cards/sv1-112-normal/thumbnail.jpg",
      medium: "https://assets.sleevebook.com/cards/sv1-112-normal/medium.jpg",
      high: "https://assets.sleevebook.com/cards/sv1-112-normal/high.jpg",
    });
  });

  it("skips downloading again when the high-res image is already uploaded", async () => {
    const storage = createFakeStorage();
    storage.objects.set("cards/sv1-112-normal/high.jpg", Buffer.from("already-there"));
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await processVariantImage(
      { storage, publicAssetsUrl: "https://assets.sleevebook.com" },
      "sv1-112-normal",
      "https://images.pokemontcg.io/sv1/112.png",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the source image fails to download", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      processVariantImage(
        { storage: createFakeStorage(), publicAssetsUrl: "https://assets.sleevebook.com" },
        "missing-variant",
        "https://images.pokemontcg.io/missing.png",
      ),
    ).rejects.toThrow(/Failed to download/);
  });
});

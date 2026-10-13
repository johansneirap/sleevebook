import { deriveImageSizes } from "./derivatives.js";
import type { ImageStorage } from "./storage.js";

export interface ImagePipelineConfig {
  storage: ImageStorage;
  publicAssetsUrl: string;
}

export interface VariantImageUrls {
  thumbnail: string;
  medium: string;
  high: string;
}

type Size = "thumbnail" | "medium" | "high";

function keyFor(variantKey: string, size: Size): string {
  return `cards/${variantKey}/${size}.jpg`;
}

function urlFor(publicAssetsUrl: string, key: string): string {
  return `${publicAssetsUrl.replace(/\/$/, "")}/${key}`;
}

export async function processVariantImage(
  config: ImagePipelineConfig,
  variantKey: string,
  sourceUrl: string,
): Promise<VariantImageUrls> {
  const highKey = keyFor(variantKey, "high");

  if (!(await config.storage.objectExists(highKey))) {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${sourceUrl}: ${response.status}`);
    }
    const original = Buffer.from(await response.arrayBuffer());
    const { thumbnail, medium, high } = await deriveImageSizes(original);

    await Promise.all([
      config.storage.putObject(keyFor(variantKey, "thumbnail"), thumbnail, "image/jpeg"),
      config.storage.putObject(keyFor(variantKey, "medium"), medium, "image/jpeg"),
      config.storage.putObject(highKey, high, "image/jpeg"),
    ]);
  }

  return {
    thumbnail: urlFor(config.publicAssetsUrl, keyFor(variantKey, "thumbnail")),
    medium: urlFor(config.publicAssetsUrl, keyFor(variantKey, "medium")),
    high: urlFor(config.publicAssetsUrl, highKey),
  };
}

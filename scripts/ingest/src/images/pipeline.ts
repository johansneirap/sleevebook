import { deriveImageSizes } from "./derivatives";
import type { ImageStorage } from "./storage";

export interface ImagePipelineConfig {
  storage: ImageStorage;
  publicAssetsUrl: string;
}

export interface VariantImageUrls {
  thumbnail: string;
  medium: string;
  high: string;
}

export type ImageSize = "thumbnail" | "medium" | "high";

/** Object key of one derived size, e.g. "cards/sv1-112-normal/high.jpg". */
export function variantImageKey(variantKey: string, size: ImageSize): string {
  return `cards/${variantKey}/${size}.jpg`;
}

const keyFor = variantImageKey;

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

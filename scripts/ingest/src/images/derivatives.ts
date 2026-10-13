import sharp from "sharp";

export interface ImageDerivatives {
  thumbnail: Buffer;
  medium: Buffer;
  high: Buffer;
}

// Matches the catalog source images (~734x1024); thumbnail/medium keep the
// same aspect ratio so cards never look stretched in a binder pocket.
const THUMBNAIL_SIZE = { width: 245, height: 342 };
const MEDIUM_SIZE = { width: 490, height: 684 };

export async function deriveImageSizes(original: Buffer): Promise<ImageDerivatives> {
  const [thumbnail, medium] = await Promise.all([
    sharp(original).resize(THUMBNAIL_SIZE).jpeg().toBuffer(),
    sharp(original).resize(MEDIUM_SIZE).jpeg().toBuffer(),
  ]);

  return { thumbnail, medium, high: original };
}

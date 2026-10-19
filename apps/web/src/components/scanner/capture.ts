import { SCAN_MAX_BYTES } from "../../lib/scan-types";

/** Long side of the image sent to the scanner (px). */
export const SCAN_MAX_SIDE = 1024;
const JPEG_QUALITY_STEPS = [0.85, 0.75, 0.65] as const;

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Maps the guide frame (screen coordinates) onto the video's own pixels, for
 * a <video> drawn with object-fit: cover inside `videoBox`.
 */
export function guideSourceRect(
  videoBox: { left: number; top: number; width: number; height: number },
  guideBox: { left: number; top: number; width: number; height: number },
  videoSize: { width: number; height: number },
): PixelRect {
  const scale = Math.max(videoBox.width / videoSize.width, videoBox.height / videoSize.height);
  const offsetX = (videoBox.width - videoSize.width * scale) / 2;
  const offsetY = (videoBox.height - videoSize.height * scale) / 2;

  const x = (guideBox.left - videoBox.left - offsetX) / scale;
  const y = (guideBox.top - videoBox.top - offsetY) / scale;
  const w = guideBox.width / scale;
  const h = guideBox.height / scale;

  // Keep the crop inside the frame even if the guide was measured mid-resize.
  const clampedX = Math.max(0, Math.min(x, videoSize.width - 1));
  const clampedY = Math.max(0, Math.min(y, videoSize.height - 1));
  return {
    x: clampedX,
    y: clampedY,
    w: Math.max(1, Math.min(w, videoSize.width - clampedX)),
    h: Math.max(1, Math.min(h, videoSize.height - clampedY)),
  };
}

/** Scale factor that brings the long side down to SCAN_MAX_SIDE (never up). */
export function downscaleFactor(width: number, height: number): number {
  return Math.min(1, SCAN_MAX_SIDE / Math.max(width, height));
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Draws `source` (optionally cropped to `crop`) at most SCAN_MAX_SIDE wide and
 * encodes it as JPEG, lowering quality and then size until it fits
 * SCAN_MAX_BYTES. Returns null when the photo cannot be made small enough.
 */
export async function encodeScanJpeg(
  source: CanvasImageSource,
  size: { width: number; height: number },
  crop?: PixelRect,
): Promise<Blob | null> {
  const cropped = crop ?? { x: 0, y: 0, w: size.width, h: size.height };
  let factor = downscaleFactor(cropped.w, cropped.h);

  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(cropped.w * factor));
    canvas.height = Math.max(1, Math.round(cropped.h * factor));
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }
    context.drawImage(
      source,
      cropped.x,
      cropped.y,
      cropped.w,
      cropped.h,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await encodeJpeg(canvas, quality);
      if (blob && blob.size <= SCAN_MAX_BYTES) {
        return blob;
      }
    }
    factor *= 0.75;
  }
  return null;
}

/** Crops the live video to the guide frame and encodes it for the scanner. */
export function captureGuidedFrame(
  video: HTMLVideoElement,
  guide: HTMLElement,
): Promise<Blob | null> {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) {
    return Promise.resolve(null);
  }
  const crop = guideSourceRect(video.getBoundingClientRect(), guide.getBoundingClientRect(), {
    width: videoWidth,
    height: videoHeight,
  });
  return encodeScanJpeg(video, { width: videoWidth, height: videoHeight }, crop);
}

/** Decodes a user-picked photo (any format the browser reads) and re-encodes it. */
export async function encodeUploadedPhoto(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    return await encodeScanJpeg(bitmap, { width: bitmap.width, height: bitmap.height });
  } finally {
    bitmap.close();
  }
}

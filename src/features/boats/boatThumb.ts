import type { Boat } from '../../model/types.ts';
import { getPhoto } from '../../storage/photos.ts';

/**
 * Rectangular boat picture: the photo chosen with « 🖼 Vignette », cropped
 * around its centre (legacy `boatThumb`).
 * @param boat - Boat.
 * @param width - Output width in pixels.
 * @param height - Output height in pixels.
 * @returns A JPEG data URL, or null without a readable photo.
 */
export async function boatThumb(
  boat: Boat | null | undefined,
  width = 480,
  height = 320,
): Promise<string | null> {
  const thumb = boat?.thumb as string | null | undefined;
  if (!thumb) return null;
  const url = await getPhoto(thumb);
  if (typeof url !== 'string' || !url) return null;
  const image = await loadImage(url);
  if (!image) return null;
  const { naturalWidth, naturalHeight } = image;
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      (naturalWidth - sourceWidth) / 2,
      (naturalHeight - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Load an image (legacy `loadImg`).
 * @param source - Image address.
 * @returns The image, or null when it cannot be read.
 */
export function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => resolve(null));
    image.src = source;
  });
}

import type { Member } from '../../model/types.ts';
import { getPhoto } from '../../storage/photos.ts';

/** Framing of the face in a photo (`member.face`); `x`, `y` are the centre in 0–1, `z` the zoom. */
export interface FaceFraming {
  /** Photo id. */
  id: string;
  x: number;
  y: number;
  z: number;
}

/** A photo of a card. */
export interface MemberPhoto {
  id: string;
  /** ISO time. */
  t: string;
  /**
   * Caption.
   * @default undefined
   */
  cap?: string;
}

interface FaceDetection {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface FaceDetectorApi {
  detect: (image: HTMLImageElement) => Promise<FaceDetection[]>;
}

type FaceDetectorConstructor = new (options: {
  fastMode: boolean;
  maxDetectedFaces: number;
}) => FaceDetectorApi;

/** Default framing: the top of the photo. */
export const FACE_DEFAULT = { x: 0.5, y: 0.36, z: 1.7 } as const;

/**
 * Centre on the biggest face when the phone can detect faces, else the default
 * framing (legacy `faceAuto`).
 * @param url - Photo.
 * @returns Centre and zoom.
 */
export async function faceAuto(
  url: string | null,
): Promise<Omit<FaceFraming, 'id'>> {
  try {
    const { FaceDetector } = globalThis as {
      FaceDetector?: FaceDetectorConstructor;
    };
    if (!url || !FaceDetector) return { ...FACE_DEFAULT };
    const image = await loadImage(url);
    if (!image) return { ...FACE_DEFAULT };
    const faces = await new FaceDetector({
      fastMode: true,
      maxDetectedFaces: 5,
    }).detect(image);
    const biggest = faces.toSorted(
      (first, second) =>
        second.boundingBox.width * second.boundingBox.height -
        first.boundingBox.width * first.boundingBox.height,
    )[0]?.boundingBox;
    if (!biggest) return { ...FACE_DEFAULT };
    const { naturalWidth: width, naturalHeight: height } = image;
    return {
      x: (biggest.x + biggest.width / 2) / width,
      y: (biggest.y + biggest.height / 2) / height,
      z: Math.max(
        1,
        Math.min(
          6,
          Math.min(width, height) /
            (Math.max(biggest.width, biggest.height) * 2),
        ),
      ),
    };
  } catch {
    return { ...FACE_DEFAULT };
  }
}

/**
 * Keep the framed square inside the photo (legacy `faceClamp`).
 * @param face - Framing.
 * @param width - Photo width.
 * @param height - Photo height.
 * @returns The framing with its centre clamped.
 */
export function faceClamp<T extends { x: number; y: number; z: number }>(
  face: T,
  width: number,
  height: number,
): T {
  const side = Math.min(width, height) / face.z;
  return {
    ...face,
    x: Math.max(side / 2 / width, Math.min(1 - side / 2 / width, face.x)),
    y: Math.max(side / 2 / height, Math.min(1 - side / 2 / height, face.y)),
  };
}

/**
 * Round face thumbnail of a member (legacy `memberAvatar`, lake.js:1937).
 * @param member - Member card, or a copy being edited.
 * @param size - Side of the square image in pixels.
 * @returns A JPEG data URL, or null without a usable photo.
 */
export async function memberAvatar(
  member: Pick<Member, 'photos' | 'face'>,
  size = 320,
): Promise<string | null> {
  const photos = (member.photos ?? []) as readonly MemberPhoto[];
  const first = photos[0];
  if (!first) return null;
  const saved = member.face as FaceFraming | undefined;
  const known = saved && photos.some((photo) => photo.id === saved.id);
  const framing = { ...FACE_DEFAULT, ...(known ? saved : { id: first.id }) };
  const url = await getPhoto(framing.id || first.id);
  if (typeof url !== 'string') return null;
  const image = await loadImage(url);
  if (!image) return null;
  const { naturalWidth: width, naturalHeight: height } = image;
  const face = faceClamp(framing, width, height);
  const side = Math.min(width, height) / face.z;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    ?.drawImage(
      image,
      face.x * width - side / 2,
      face.y * height - side / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );
  return canvas.toDataURL('image/jpeg', 0.85);
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => resolve(null));
    image.src = url;
  });
}

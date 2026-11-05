import type { ComponentPropsWithoutRef } from 'react';

import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useCaptionLight } from '../../components/shared/useCaptionLight.ts';
import { fmtTime } from '../../lib/format.ts';

import type { CruisePhoto } from './photos.ts';
import { usePhotoUrl } from './usePhotoUrl.ts';

/** Props of {@link PhotoImg}. */
export interface PhotoImgProps extends Omit<
  ComponentPropsWithoutRef<'img'>,
  'src' | 'id'
> {
  /** Photo id (`data-photo`). */
  photoId: string;
}

/**
 * An `img[data-photo]` filled from the phone's photo store (legacy `fillPhotos`).
 * @param props - Photo id and image attributes.
 * @returns The image; it stays without source while the photo is missing.
 */
export function PhotoImg({ photoId, alt = '', ...rest }: PhotoImgProps) {
  const url = usePhotoUrl(photoId);
  return (
    <img {...rest} data-photo={photoId} alt={alt} src={url ?? undefined} />
  );
}

/** Props of {@link PhotoStrip}. */
export interface PhotoStripProps {
  /** Photos to show. */
  photos: readonly CruisePhoto[];
  /**
   * Offers the ✕ of each photo, confirmed by a long press (legacy `removable`).
   * @default undefined
   */
  onRemove?: (id: string) => void;
}

/**
 * Thumbnails of photos with their time (legacy `photoStrip` + `fillPhotos`); a
 * photo missing from the phone disappears. A touch opens the full-screen viewer.
 * @param props - Photos and removal.
 * @returns The strip, or nothing without photos.
 */
export function PhotoStrip({ photos, onRemove }: PhotoStripProps) {
  if (photos.length === 0) return null;
  return (
    <div className="photo-strip">
      {photos.map((photo) => (
        <PhotoFigure key={photo.id} photo={photo} onRemove={onRemove} />
      ))}
    </div>
  );
}

function PhotoFigure({
  photo,
  onRemove,
}: {
  photo: CruisePhoto;
  onRemove: ((id: string) => void) | undefined;
}) {
  const url = usePhotoUrl(photo.id);
  const caption = useCaptionLight('photo');
  if (url === null) return null;
  return (
    <figure className={caption.className}>
      <img
        data-photo={photo.id}
        alt="Photo"
        src={url}
        onLoad={caption.onLoad}
      />
      <figcaption>{fmtTime(new Date(photo.t))}</figcaption>
      {onRemove ? (
        <HoldDeleteButton
          className="btn danger photo-del"
          data-pdel={photo.id}
          aria-label="Supprimer la photo"
          armedLabel="🗑"
          onDelete={() => onRemove(photo.id)}
        >
          ✕
        </HoldDeleteButton>
      ) : null}
    </figure>
  );
}

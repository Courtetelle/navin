import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { getPhoto } from '../../storage/photos.ts';
import { PhotoImg } from '../onwater/index.ts';
import { PubModal } from '../publish/index.ts';

import type { FaceFraming } from './avatar.ts';
import { FACE_DEFAULT, faceAuto, faceClamp } from './avatar.ts';
import { photosOf } from './ficheRecord.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FaceFrame}. */
export interface FaceFrameProps {
  /** The card. */
  record: FicheRecord;
  /** The window closes. */
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Framing of the round thumbnail (legacy `faceFrame`, lake.js:1948): drag the
 * photo to centre the face, cursor or pinch to zoom, saved at once.
 * @param props - The card and the close action.
 * @returns The window.
 */
export function FaceFrame({ record, onClose }: FaceFrameProps) {
  const photos = photosOf(record.data);
  const [face, setFace] = useState<FaceFraming>(() => initialFace(record));
  const faceRef = useRef(face);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const zoom = useRef<HTMLInputElement>(null);
  const size = useRef({ width: 1, height: 1 });
  const points = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const save = () => {
    record.change({ ...record.latest(), face: faceRef.current });
    record.persist();
  };
  const paint = () => {
    const box = frame.current;
    const picture = image.current;
    if (!box || !picture) return;
    const { width, height } = size.current;
    const clamped = faceClamp(faceRef.current, width, height);
    faceRef.current = clamped;
    const side = Math.min(width, height) / clamped.z;
    const scale = box.clientWidth / side;
    const left = -(clamped.x * width - side / 2) * scale;
    const top = -(clamped.y * height - side / 2) * scale;
    picture.style.width = `${width}px`;
    picture.style.height = `${height}px`;
    picture.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  };
  const load = async (photoId: string, auto: boolean) => {
    const url = await getPhoto(photoId);
    const picture = image.current;
    if (typeof url !== 'string' || !picture) return;
    picture.addEventListener(
      'load',
      () => {
        size.current = {
          width: picture.naturalWidth,
          height: picture.naturalHeight,
        };
        void finishLoad(url, auto);
      },
      { once: true },
    );
    picture.src = url;
  };
  const finishLoad = async (url: string, auto: boolean) => {
    if (auto) {
      faceRef.current = { ...faceRef.current, ...(await faceAuto(url)) };
      if (zoom.current) zoom.current.value = String(faceRef.current.z);
      save();
    }
    paint();
  };
  const startup = useRef({ load, save, record });
  useEffect(() => {
    const { record: card, load: open, save: saveNow } = startup.current;
    if (card.latest().face !== faceRef.current) {
      card.change({ ...card.latest(), face: faceRef.current });
    }
    void open(faceRef.current.id, false);
    const input = zoom.current;
    input?.addEventListener('change', saveNow);
    return () => input?.removeEventListener('change', saveNow);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    try {
      frame.current?.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone.
    }
    points.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (points.current.size !== 2) return;
    pinch.current = {
      distance: spread(points.current) || 1,
      zoom: faceRef.current.z,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = points.current.get(event.pointerId);
    if (!point) return;
    const moved = { x: event.clientX, y: event.clientY };
    if (points.current.size === 2 && pinch.current) {
      points.current.set(event.pointerId, moved);
      const start = pinch.current;
      const next = (start.zoom * spread(points.current)) / start.distance;
      const z = Math.max(1, Math.min(6, next));
      faceRef.current = { ...faceRef.current, z };
      if (zoom.current) zoom.current.value = String(z);
      paint();
      return;
    }
    const { width, height } = size.current;
    const side = Math.min(width, height) / faceRef.current.z;
    const scale = (frame.current?.clientWidth ?? 0) / side;
    faceRef.current = {
      ...faceRef.current,
      x: faceRef.current.x - (moved.x - point.x) / (scale * width),
      y: faceRef.current.y - (moved.y - point.y) / (scale * height),
    };
    points.current.set(event.pointerId, moved);
    paint();
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!points.current.delete(event.pointerId)) return;
    if (points.current.size < 2) pinch.current = null;
    save();
  };

  return (
    <PubModal head="🙂 Vignette du visage" pubBox={false} onClose={onClose}>
      <p className="help">
        Glisser la photo pour centrer le visage ; curseur (ou pincer) pour
        l’agrandir. Enregistré tout seul.
      </p>
      <div
        ref={frame}
        className="face-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <img ref={image} alt="" />
      </div>
      <input
        ref={zoom}
        type="range"
        className="face-z"
        min="1"
        max="6"
        step="0.05"
        defaultValue={face.z}
        aria-label="Agrandir"
        onChange={(event) => {
          faceRef.current = {
            ...faceRef.current,
            z: Number(event.target.value),
          };
          paint();
        }}
      />
      {photos.length > 1 ? (
        <>
          <p className="help lx-sec-h">Photo de la vignette</p>
          <div className="face-picks">
            {photos.map((photo) => (
              <Button
                key={photo.id}
                type="button"
                data-fpick={photo.id}
                className={photo.id === face.id ? 'on' : undefined}
                onClick={() => {
                  const picked = { id: photo.id, ...FACE_DEFAULT };
                  faceRef.current = picked;
                  setFace(picked);
                  void load(photo.id, true);
                }}
              >
                <PhotoImg photoId={photo.id} />
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </PubModal>
  );
}

function initialFace(record: FicheRecord): FaceFraming {
  const data = record.latest();
  const photos = photosOf(data);
  const face = data.face as FaceFraming | undefined;
  if (face && photos.some((photo) => photo.id === face.id)) return face;
  return { id: photos[0]?.id ?? '', ...FACE_DEFAULT };
}

function spread(points: ReadonlyMap<number, Point>): number {
  const [first, second] = [...points.values()];
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';

import { FaceFrame } from './FaceFrame.tsx';
import { memberAvatar } from './avatar.ts';
import { photosOf } from './ficheRecord.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FicheAvatar}. */
export interface FicheAvatarProps {
  /** The card. */
  record: FicheRecord;
}

/**
 * Round face thumbnail in the head of a card; a tap opens the framing
 * (lake.js:2262).
 * @param props - The card.
 * @returns The button, and the window while it is open.
 */
export function FicheAvatar({ record }: FicheAvatarProps) {
  const { data } = record;
  const { photos, face } = data;
  const [url, setUrl] = useState<string | null>(null);
  const [framing, setFraming] = useState(false);
  const hasPhotos = photosOf(data).length > 0;
  useEffect(() => {
    if (!hasPhotos) return undefined;
    let current = true;
    void memberAvatar({ photos, face }, 200).then((avatar) => {
      if (current && avatar) setUrl(avatar);
    });
    return () => {
      current = false;
    };
  }, [photos, face, hasPhotos]);
  return (
    <>
      <Button
        type="button"
        className="f-av no-navact"
        id="fAv"
        aria-label="Cadrer le visage"
        hidden={!hasPhotos}
        onClick={() => {
          buzz();
          setFraming(true);
        }}
      >
        {url ? <img src={url} alt="" /> : null}
      </Button>
      {framing ? (
        <FaceFrame record={record} onClose={() => setFraming(false)} />
      ) : null}
    </>
  );
}

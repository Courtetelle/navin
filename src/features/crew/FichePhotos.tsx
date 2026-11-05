import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useCaptionLight } from '../../components/shared/useCaptionLight.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';
import { usePhotoUrl } from '../onwater/index.ts';

import type { MemberPhoto } from './avatar.ts';
import { addFichePhotos, removeFichePhoto } from './fichePhotoActions.ts';
import { photosOf } from './ficheRecord.ts';
import type { FicheRecord } from './useFicheRecord.ts';

/** Props of {@link FichePhotos}. */
export interface FichePhotosProps {
  /** The card. */
  record: FicheRecord;
}

/**
 * Photos of a card: identity document, portrait… (lake.js:2256-2281).
 * @param props - The card.
 * @returns `div.f-photos`.
 */
export function FichePhotos({ record }: FichePhotosProps) {
  const tr = useTr();
  const photos = photosOf(record.data);
  return (
    <div className="f-photos">
      <HelpText className="lx-sec-h">Photos</HelpText>
      <div id="fPhList">
        {photos.length > 0 ? (
          <div className="photo-strip">
            {photos.map((photo) => (
              <PhotoFigure key={photo.id} photo={photo} record={record} />
            ))}
          </div>
        ) : null}
      </div>
      <ButtonRow>
        <Button
          className="btn big no-navact"
          id="fPhAdd"
          onClick={() => {
            buzz();
            if (record.persist()) {
              addFichePhotos(record);
            } else {
              toast('Saisissez d’abord le prénom');
              record.prenomInput.current?.focus();
            }
          }}
        >
          {tr('📷 + photo')}
          <small>{tr('photothèque, fichier ou appareil photo')}</small>
        </Button>
      </ButtonRow>
    </div>
  );
}

interface PhotoFigureProps {
  photo: MemberPhoto;
  record: FicheRecord;
}

function PhotoFigure({ photo, record }: PhotoFigureProps) {
  const url = usePhotoUrl(photo.id);
  const figure = useCaptionLight('photo');
  if (url === null) return null;
  return (
    <figure className={figure.className}>
      <img data-photo={photo.id} alt="Photo" src={url} onLoad={figure.onLoad} />
      <figcaption>{photo.cap || fmtTime(new Date(photo.t))}</figcaption>
      <HoldDeleteButton
        className="btn danger photo-del"
        data-mpdel={photo.id}
        aria-label="Supprimer la photo"
        armedLabel="🗑"
        onClick={buzz}
        onDelete={() => removeFichePhoto(record, photo.id)}
      >
        ✕
      </HoldDeleteButton>
    </figure>
  );
}

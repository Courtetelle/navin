import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useCaptionLight } from '../../components/shared/useCaptionLight.ts';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { CrewSet } from '../../model/types.ts';
import { usePhotoUrl } from '../onwater/index.ts';

import { setCrewPhotoCaption } from './crewsEdit.ts';
import { pickCrewPhoto, removeCrewPhoto } from './crewsPhotoActions.ts';

/** Props of {@link CrewsPhoto}. */
interface CrewsPhotoProps {
  /** Saved composition, when there is one. */
  base: CrewSet | undefined;
}

/**
 * Group photo of a composition, with a caption over its bottom (prep.js:799).
 * @param props - Saved composition.
 * @returns The section.
 */
export function CrewsPhoto({ base }: CrewsPhotoProps) {
  const tr = useTr();
  const photo = base?.photo as string | undefined;
  return (
    <section className="field crew-photo-sec">
      <h3>{tr('Photo de groupe')}</h3>
      {base && photo ? (
        <PhotoShown
          photo={photo}
          caption={base.photoCap as string | undefined}
        />
      ) : (
        <ButtonRow>
          <Button
            className="btn big"
            id="cePhoto"
            onClick={() => {
              buzz();
              pickCrewPhoto();
            }}
          >
            {tr('📷 + photo')}
            <small>
              {tr('photo de groupe : photothèque, fichier ou appareil photo')}
            </small>
          </Button>
        </ButtonRow>
      )}
    </section>
  );
}

interface PhotoShownProps {
  photo: string;
  caption: string | undefined;
}

function PhotoShown({ photo, caption }: PhotoShownProps) {
  const tr = useTr();
  const url = usePhotoUrl(photo);
  const [shownCaption, setShownCaption] = useState(caption ?? '');
  const figure = useCaptionLight('crew-photo');
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  return (
    <>
      <figure className={figure.className}>
        <img
          data-cphoto={photo}
          alt="Photo de groupe"
          src={url ?? undefined}
          onLoad={figure.onLoad}
        />
        <figcaption id="ceCapShow" hidden={!shownCaption}>
          {shownCaption}
        </figcaption>
      </figure>
      <input
        ref={input}
        className="text"
        id="ceCap"
        defaultValue={caption ?? ''}
        placeholder={tr.placeholder('Légende (au centre, en bas de la photo)')}
        autoComplete="off"
        onChange={(event) => {
          const text = event.target.value.trim();
          setShownCaption(text);
          setCrewPhotoCaption(text);
        }}
      />
      <ButtonRow className="row c2">
        <Button
          className="btn"
          id="cePhoto"
          onClick={() => {
            buzz();
            pickCrewPhoto();
          }}
        >
          {tr('📷 Changer la photo')}
        </Button>
        <HoldDeleteButton
          className="btn danger"
          id="cePhotoDel"
          onClick={buzz}
          onDelete={removeCrewPhoto}
        >
          {tr('🗑 Retirer la photo')}
        </HoldDeleteButton>
      </ButtonRow>
    </>
  );
}

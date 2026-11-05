import { useSignals } from '@preact/signals-react/runtime';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz, openLink } from '../../lib/dom.ts';
import type { Boat } from '../../model/types.ts';
import { toast } from '../../state/index.ts';
import { getPhoto } from '../../storage/photos.ts';
import { usePhotoUrl } from '../onwater/index.ts';

import {
  docCaption,
  removeBoatDoc,
  setBoatDocCaption,
  toggleBoatThumb,
} from './boatActions.ts';
import { addBoatDoc } from './boatDocUpload.ts';
import type { BoatDocument } from './boatDocs.ts';
import { boatDocs } from './boatDocs.ts';

/** Props of {@link BoatPhotos}. */
export interface BoatPhotosProps {
  /** Boat. */
  boat: Boat;
  /** The list must be drawn again with this boat open. */
  onRefresh: () => void;
}

/**
 * Photos and official papers of a boat in Mes bateaux: caption, thumbnail,
 * PDF scans, deletion by long press.
 * @param props - Boat and refresh.
 * @returns The section.
 */
export function BoatPhotos({ boat, onRefresh }: BoatPhotosProps) {
  const tr = useTr();
  const documents = boatDocs(boat);
  return (
    <section className="boat-pics" data-bp={boat.id}>
      <h3 className="sub-h">{tr('📷 Photos et papiers officiels')}</h3>
      {documents.length > 0 ? (
        <div className="bp-list photo-strip">
          {documents.map((document) => (
            <BoatPhoto
              key={document.id}
              boat={boat}
              document={document}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : null}
      <ButtonRow>
        <Button
          className="btn"
          data-bpadd={boat.id}
          onClick={(event) => {
            event.preventDefault();
            buzz();
            addBoatDoc(boat.id, 'autre', () => {
              onRefresh();
              setTimeout(() => focusLastCaption(boat.id), 200);
            });
          }}
        >
          {tr('📷 + photo')}
          <small>{tr('photothèque, fichier, appareil photo ou PDF')}</small>
        </Button>
      </ButtonRow>
    </section>
  );
}

interface BoatPhotoProps {
  boat: Boat;
  document: BoatDocument;
  onRefresh: () => void;
}

function BoatPhoto({ boat, document, onRefresh }: BoatPhotoProps) {
  useSignals();
  const tr = useTr();
  const caption = useRef<HTMLInputElement>(null);
  useMarquee(caption);
  const url = usePhotoUrl(document.pdf ? '' : document.id);
  if (!document.pdf && url === null) return null;
  const isThumb = boat.thumb === document.id;
  return (
    <figure className="bp-item">
      {document.pdf ? (
        <Button
          type="button"
          className="bp-pdf"
          data-pdfopen={document.id}
          onClick={(event) => {
            event.preventDefault();
            buzz();
            void openScan(document.id);
          }}
        >
          📄<small>{tr('Scan PDF · toucher pour ouvrir')}</small>
        </Button>
      ) : (
        <img
          data-photo={document.id}
          data-cap={docCaption(document)}
          alt="Photo"
          src={url ?? undefined}
        />
      )}
      <input
        ref={caption}
        className="text bp-cap"
        data-dcap={document.id}
        defaultValue={document.cap ?? ''}
        placeholder={tr.placeholder('Libellé')}
        onInput={(event) => {
          setBoatDocCaption(document.id, event.currentTarget.value);
        }}
      />
      {document.pdf ? null : (
        <Button
          type="button"
          className={isThumb ? 'btn bp-thumb on' : 'btn bp-thumb'}
          data-bpthumb={document.id}
          data-bt={boat.id}
          onClick={(event) => {
            event.preventDefault();
            buzz();
            toggleBoatThumb(boat.id, document.id);
            onRefresh();
          }}
        >
          {tr(`🖼 ${isThumb ? 'Vignette ✔' : 'Vignette'}`)}
        </Button>
      )}
      <HoldDeleteButton
        className="btn danger bp-del"
        data-bpdel={document.id}
        aria-label="Supprimer la photo"
        onClick={(event) => {
          event.preventDefault();
          buzz();
        }}
        onDelete={() => {
          removeBoatDoc(document.id);
          toast('Photo supprimée');
          onRefresh();
        }}
      >
        🗑
      </HoldDeleteButton>
    </figure>
  );
}

async function openScan(id: string): Promise<void> {
  const url = await getPhoto(id);
  if (typeof url !== 'string' || !url) {
    toast('Scan introuvable');
    return;
  }
  const response = await fetch(url);
  openLink(URL.createObjectURL(await response.blob()));
}

function focusLastCaption(boatId: string): void {
  const captions = document.querySelectorAll<HTMLInputElement>(
    `[data-bp="${CSS.escape(boatId)}"] .bp-cap`,
  );
  const last = [...captions].at(-1);
  last?.scrollIntoView({ block: 'center' });
  last?.focus();
}

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useCaptionLight } from '../../components/shared/useCaptionLight.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';
import { usePhotoUrl } from '../onwater/index.ts';

import { removeBoatDoc } from './boatActions.ts';
import { addBoatDoc } from './boatDocUpload.ts';
import type { BoatDocument } from './boatDocs.ts';
import { boatDocs, docKindLabel, docKindName } from './boatDocs.ts';

/** Props of {@link DocumentKind}. */
interface DocumentKindProps {
  /** Boat. */
  boat: Boat;
  /** Kind of document. */
  kind: string;
  /** Label of the kind. */
  label: string;
  /** Draw the sheet again. */
  onRefresh: () => void;
  /**
   * Read-only: nothing shown without a photo.
   * @default false
   */
  reading?: boolean;
}

/**
 * The photos of one kind of document of a boat, and the button adding one.
 * @param props - Boat, kind and refresh.
 * @returns The title, the photos and the button.
 */
export function DocumentKind({
  boat,
  kind,
  label,
  onRefresh,
  reading = false,
}: DocumentKindProps) {
  const tr = useTr();
  const documents = boatDocs(boat).filter(
    (document) => document.kind === kind && !document.pdf,
  );
  if (reading && documents.length === 0) return null;
  return (
    <>
      <h3 className="sub-h">{tr(label)}</h3>
      {documents.length > 0 ? (
        <div className="photo-strip">
          {documents.map((document) => (
            <DocumentFigure
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
          data-dadd={kind}
          onClick={() => {
            buzz();
            addBoatDoc(boat.id, kind, onRefresh);
          }}
        >
          {tr('📷 + photo')}
          <small>{tr('photothèque, fichier, appareil photo ou PDF')}</small>
        </Button>
      </ButtonRow>
    </>
  );
}

function DocumentFigure({
  boat,
  document,
  onRefresh,
}: {
  boat: Boat;
  document: BoatDocument;
  onRefresh: () => void;
}) {
  const url = usePhotoUrl(document.id);
  const figure = useCaptionLight('photo');
  if (url === null) return null;
  return (
    <figure className={figure.className}>
      <img
        data-photo={document.id}
        data-cap={`${boat.info.boat ?? ''} · ${docKindName(document.kind)}`}
        alt={docKindLabel(document.kind)}
        src={url}
        onLoad={figure.onLoad}
      />
      <figcaption>{fmtShortDate(new Date(document.t))}</figcaption>
      <ArmedButton
        className="btn danger photo-del"
        data-ddel={document.id}
        aria-label="Supprimer"
        armedLabel="✕ ?"
        onClick={buzz}
        onConfirm={() => {
          removeBoatDoc(document.id);
          onRefresh();
        }}
      >
        ✕
      </ArmedButton>
    </figure>
  );
}

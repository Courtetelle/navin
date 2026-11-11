import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { boatSections, boatSub } from '../../model/boatSheet.ts';
import type { Boat } from '../../model/types.ts';
import { removeBoat, state } from '../../state/index.ts';
import { CompactForm } from '../logbook/index.ts';
import { PhotoImg } from '../onwater/index.ts';
import { SwipeRow } from '../prep/index.ts';
import { openListPublish } from '../publish/index.ts';

import { BoatPhotos } from './BoatPhotos.tsx';
import { BoatVersionsButton } from './BoatVersions.tsx';
import { saveBoatInfo } from './boatActions.ts';
import { boatThumbId } from './boatDocs.ts';

/** Props of {@link BoatCard}. */
interface BoatCardProps {
  /** Boat. */
  boat: Boat;
  /** The card starts open. */
  open: boolean;
  /** Read-only: only what is filled shows. */
  reading: boolean;
  /** The card was opened or closed. */
  onToggle: (open: boolean) => void;
  /** Draw the list again with this boat open. */
  onRefresh: () => void;
  /** The boat was deleted. */
  onRemoved: () => void;
  /** Opens the label editor. */
  onFields: () => void;
  /** Opens the previous versions. */
  onVersions: () => void;
}

/**
 * One boat of Mes bateaux (`details[data-b]`): sheet, photos, publishing,
 * deletion by long press or 🗑.
 * @param props - Boat and actions.
 * @returns The card.
 */
export function BoatCard({
  boat,
  open,
  reading,
  onToggle,
  onRefresh,
  onRemoved,
  onFields,
  onVersions,
}: BoatCardProps) {
  useSignals();
  const tr = useTr();
  const [opened, setOpened] = useState(false);
  const everOpened = open || opened;
  // Legacy wrote these once; only the boat name followed the typing.
  const [drawn] = useState(() => ({
    sub: boatSub(boat.info),
    versions: boat,
    deleteLabel: `Supprimer ce bateau${
      state.data.boats.value.length > 1
        ? ` : ${boat.info.boat || 'sans nom'}`
        : ''
    }`,
  }));
  const thumb = boatThumbId(boat);
  return (
    <SwipeRow
      id={boat.id}
      name={boat.info.boat || 'ce bateau'}
      onDelete={(id) => {
        removeBoat(id);
        onRemoved();
      }}
    >
      <details
        className="section"
        data-b={boat.id}
        open={open}
        onToggle={(event) => {
          const shown = event.currentTarget.open;
          if (shown) setOpened(true);
          onToggle(shown);
        }}
      >
        <summary>
          {thumb ? <PhotoImg className="b-thumb" photoId={thumb} /> : '🚤 '}
          <span className="b-nm">
            {boat.info.boat || tr('Nouveau bateau')}
          </span>{' '}
          <small>{drawn.sub}</small>
          <Button
            type="button"
            className="btn ck-editbtn b-editbtn no-navact"
            data-fields={boat.id}
            aria-label="Modifier les libellés"
            onClick={(event) => {
              event.preventDefault();
              buzz();
              onFields();
            }}
          >
            ✎
          </Button>
        </summary>
        {reading ? null : (
          <HelpText
            style={{ padding: '12px 14px 0', margin: 0 }}
            introLead={everOpened}
          >
            Informations du bateau : touchez une case pour saisir ou corriger
            (enregistrement automatique).
          </HelpText>
        )}
        <div data-form={boat.id}>
          <CompactForm
            sections={boatSections(boat).filter(
              (section) => section.title !== 'Numéros utiles (page SOS)',
            )}
            data={boat.info}
            filledOnly={reading}
            onChange={(next) => saveBoatInfo(boat.id, next)}
            formKey={boat.id}
          />
        </div>
        <BoatPhotos boat={boat} reading={reading} onRefresh={onRefresh} />
        <ButtonRow className="row ck-pub-row" style={{ padding: '0 14px' }}>
          <Button
            className="btn big ck-pub"
            data-bpub={boat.id}
            onClick={(event) => {
              event.preventDefault();
              buzz();
              openListPublish('boats', boat.id);
            }}
          >
            {tr('📤 Publier')}
            <small>{tr('cette fiche en image ou PDF, avec les photos')}</small>
          </Button>
        </ButtonRow>
        <BoatVersionsButton boat={drawn.versions} onOpen={onVersions} />
        <ButtonRow className="row b-delrow" style={{ padding: '0 14px 14px' }}>
          <HoldDeleteButton
            className="btn danger"
            data-del={boat.id}
            onClick={(event) => {
              event.preventDefault();
              buzz();
            }}
            onDelete={() => {
              removeBoat(boat.id);
              onRemoved();
            }}
          >
            {tr(drawn.deleteLabel)}
          </HoldDeleteButton>
        </ButtonRow>
      </details>
    </SwipeRow>
  );
}

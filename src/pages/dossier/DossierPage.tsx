import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { BoatDossier } from '../../features/boats/BoatDossier.tsx';
import {
  addBoat,
  keepSeaBoat,
  seaBoatsNotKept,
} from '../../features/boats/boatActions.ts';
import { boatDocs } from '../../features/boats/boatDocs.ts';
import { boatsByNav } from '../../features/boats/navOrder.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { boatSub } from '../../model/boatSheet.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { boatById } from '../../state/index.ts';

/**
 * Screen `dossier` (legacy `VIEWS.dossier`): the boats collection, or the sheet
 * of one boat with the photos of its documents.
 * @param props - Page props; `arg` is the id of the boat to open.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function DossierPage({ arg }: PageProps) {
  useSignals();
  const [boatId, setBoatId] = useState(() =>
    typeof arg === 'string' ? arg : null,
  );
  if (boatId && boatById(boatId)) return <BoatDossier boatId={boatId} />;
  return <BoatCollection onOpen={setBoatId} />;
}

function BoatCollection({ onOpen }: { onOpen: (id: string) => void }) {
  const tr = useTr();
  const sea = seaBoatsNotKept();
  return (
    <>
      <PageTitle
        helps={[
          'Une fiche par bateau avec toutes ses informations et les photos de ses documents. Gardé sur ce téléphone et dans la sauvegarde.',
        ]}
      >
        Recueil des bateaux
      </PageTitle>
      <div className="checks">
        {boatsByNav().map((boat) => {
          const count = boatDocs(boat).length;
          const documents = count
            ? ` · ${count} document${count > 1 ? 's' : ''}`
            : '';
          const sub = [boatSub(boat.info), boat.info.reg]
            .filter(Boolean)
            .join(' · ');
          return (
            <Button
              key={boat.id}
              className="btn big"
              data-dos={boat.id}
              onClick={() => {
                buzz();
                onOpen(boat.id);
              }}
            >
              {tr(`🚤 ${boat.info.boat || 'Bateau sans nom'}`)}
              <small>{`${sub}${documents}`}</small>
            </Button>
          );
        })}
      </div>
      {sea.length > 0 ? (
        <>
          <h2 className="sub-h">{tr('Bateaux de mes croisières en mer')}</h2>
          {sea.map((item) => (
            <ButtonRow key={item.cruiseId}>
              <Button
                className="btn"
                data-keep={item.cruiseId}
                onClick={() => {
                  buzz();
                  const id = keepSeaBoat(item.cruiseId);
                  if (id) onOpen(id);
                }}
              >
                {tr(`＋ Ajouter ${item.name} au recueil`)}
                <small>{item.cruiseName}</small>
              </Button>
            </ButtonRow>
          ))}
        </>
      ) : null}
      <ButtonRow style={{ marginTop: 12 }}>
        <Button
          className="btn big primary"
          id="dosAdd"
          onClick={() => {
            buzz();
            go('boats', addBoat());
          }}
        >
          {tr('＋ Nouveau bateau')}
        </Button>
      </ButtonRow>
    </>
  );
}

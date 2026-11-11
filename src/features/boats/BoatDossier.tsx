import { useSignals } from '@preact/signals-react/runtime';
import { produce } from 'immer';
import { useLayoutEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useReadingMarquee } from '../../components/shared/useReadingMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { boatSections } from '../../model/boatSheet.ts';
import type { Boat } from '../../model/types.ts';
import { PageBack, PageValidate } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { useNavEdit } from '../../shell/navbar/useNavEdit.ts';
import { go } from '../../shell/router.ts';
import { boatById, state, toast } from '../../state/index.ts';
import { CompactForm } from '../logbook/index.ts';
import { BoatFieldsEditor } from '../onwater/index.ts';

import { BoatVersions, BoatVersionsButton } from './BoatVersions.tsx';
import { DocumentKind } from './DocumentKind.tsx';
import { DossierPublish } from './DossierPublish.tsx';
import { saveBoatInfo } from './boatActions.ts';
import { BOAT_DOC_KINDS, boatDocs } from './boatDocs.ts';

/** Props of {@link BoatDossier}. */
interface BoatDossierProps {
  /** Boat id. */
  boatId: string;
}

/**
 * Sheet of one boat of the collection, editable in place, with the photos of
 * its documents and its publishing (legacy `renderBoatDossier`).
 * @param props - Boat.
 * @returns The screen content.
 */
export function BoatDossier({ boatId }: BoatDossierProps) {
  useSignals();
  const [screen, setScreen] = useState<'sheet' | 'fields' | 'versions'>(
    'sheet',
  );
  const [drawn, setDrawn] = useState(() => ({
    count: 0,
    fresh: true,
    name: boatById(boatId)?.info.boat,
  }));
  const draw = (fresh: boolean) => {
    const name = boatById(boatId)?.info.boat;
    setDrawn((last) => ({
      count: last.count + 1,
      fresh: fresh || name !== last.name,
      name,
    }));
  };
  const showSheet = () => {
    setScreen('sheet');
    draw(true);
  };
  useLayoutEffect(() => {
    if (boatById(boatId)?.docs) return;
    state.data.boats.value = produce(state.data.boats.value, (boats) => {
      const boat = boats.find((item) => item.id === boatId);
      if (boat) boat.docs ??= [];
    });
  }, [boatId]);
  const boat = boatById(boatId);
  if (!boat) return null;
  if (screen === 'fields') {
    return <BoatFieldsEditor boatId={boatId} onDone={showSheet} />;
  }
  if (screen === 'versions') {
    return <BoatVersions boatId={boatId} onBack={showSheet} />;
  }
  return (
    <DossierSheet
      key={drawn.count}
      boat={boat}
      fresh={drawn.fresh}
      onRefresh={() => draw(false)}
      onFields={() => setScreen('fields')}
      onVersions={() => setScreen('versions')}
    />
  );
}

interface DossierSheetProps {
  boat: Boat;
  fresh: boolean;
  onRefresh: () => void;
  onFields: () => void;
  onVersions: () => void;
}

function DossierSheet({
  boat,
  fresh,
  onRefresh,
  onFields,
  onVersions,
}: DossierSheetProps) {
  const tr = useTr();
  useNavFields();
  const [reading, setReading] = useState(true);
  useNavEdit(reading, () => setReading(false));
  const sheet = useRef<HTMLDivElement>(null);
  useReadingMarquee(reading, sheet);
  const [publishing, setPublishing] = useState(false);
  const [versioned] = useState(() => boat);
  const name = boat.info.boat || 'Bateau sans nom';
  const hasDocs = boatDocs(boat).length > 0;
  return (
    <>
      <PageBack
        label="◀ Mes bateaux"
        id="dosBack"
        onClick={() => {
          buzz();
          go('boats', boat.id);
        }}
      >
        {tr('◀ Mes bateaux')}
      </PageBack>
      {reading ? null : (
        <PageValidate
          label="Valider"
          onClick={() => {
            setReading(true);
            toast('Fiche du bateau validée');
          }}
          hidden
        >
          {tr('Valider')}
        </PageValidate>
      )}
      <PageTitle
        atTop={fresh}
        titleText={`🚤 ${name}✎`}
        helps={[
          'Touchez une case pour saisir ou corriger : enregistrement automatique. « ＋ Ajouter un libellé », en bas, ajoute une case où vous voulez dans la fiche.',
        ]}
      >
        <>
          {tr(`🚤 ${name}`)}
          <Button
            type="button"
            className="btn ck-editbtn no-navact"
            id="dosFields"
            aria-label="Modifier les libellés"
            onClick={() => {
              buzz();
              onFields();
            }}
          >
            ✎
          </Button>
        </>
      </PageTitle>
      <div
        ref={sheet}
        id="dosForm"
        className={reading ? 'fiche-reading' : undefined}
      >
        <CompactForm
          sections={boatSections(boat)}
          data={boat.info}
          filledOnly={reading}
          onChange={(next) => saveBoatInfo(boat.id, next)}
        />
      </div>
      <BoatVersionsButton boat={versioned} onOpen={onVersions} />
      {reading && !hasDocs ? null : (
        <FoldSection title="Documents (photos)">
          <div className={reading ? 'fiche-reading' : undefined}>
            {BOAT_DOC_KINDS.map(([kind, label]) => (
              <DocumentKind
                key={kind}
                boat={boat}
                kind={kind}
                label={label}
                reading={reading}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </FoldSection>
      )}
      <h2 className="sub-h">{tr('Envoyer la fiche')}</h2>
      <ButtonRow className="row ck-pub-row">
        <Button
          className="btn big ck-pub"
          id="dosPub"
          onClick={() => {
            buzz();
            setPublishing(true);
          }}
        >
          {tr('📤 Publier')}
          <small>{tr('fiche et documents, image ou PDF')}</small>
        </Button>
      </ButtonRow>
      {publishing ? (
        <DossierPublish boat={boat} onClose={() => setPublishing(false)} />
      ) : null}
    </>
  );
}

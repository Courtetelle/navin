import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LabelButton } from '../../components/shared/EditableLinks.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  bathyAscImport,
  bathyAscShare,
} from '../../features/map/bathyImport.ts';
import { bathyAscNote } from '../../features/map/bathyStore.ts';
import { lakesNote, lakesNoteVersion } from '../../features/map/lakes.ts';
import {
  fetchLemanVec,
  lemanVecNote,
  lemanVecProgress,
} from '../../features/map/lemanVector.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { store } from '../../storage/store.ts';

const BUILT_IN = '🗺 Cartes intégrées (sans réseau) : ';

/**
 * What NavIn keeps of Lake Geneva on this device: the OpenStreetMap data
 * (buoys, harbours, shore zones), the shallow lines of swissBATHY3D, and the
 * state of the built-in lake maps.
 * @returns The rows.
 */
export function LemanTools() {
  useSignals();
  const tr = useTr();
  const [ascNote, setAscNote] = useState(bathyAscNote);
  const note = lakesNote();
  useEffect(
    () => () => {
      lemanVecProgress.value = null;
    },
    [],
  );
  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    await bathyAscImport(files, setAscNote);
  };
  return (
    <>
      <ButtonRow>
        <Button
          className="btn"
          id="mapVec"
          onClick={() => {
            buzz();
            void fetchLemanVec();
          }}
        >
          {tr('⬇ Données du Léman (OpenStreetMap)')}
          <small>
            {tr(
              'balises, ports, débarcadères, rives : zones 150 / 300 m et baignade',
            )}
          </small>
          <small id="mapVecSub">
            {tr(lemanVecProgress.value ?? lemanVecNote())}
          </small>
        </Button>
      </ButtonRow>
      <div className="row">
        <LabelButton className="btn" id="mapAsc">
          {tr('⛰ Courbes 1 à 5 m (swissBATHY3D)')}
          <small>{tr('calculées sur l’appareil, hors ligne')}</small>
          <small id="mapAscSub">{tr(ascNote)}</small>
          <input
            type="file"
            id="mapAscFile"
            multiple
            hidden
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void importFiles(files);
            }}
          />
        </LabelButton>
      </div>
      {store.get('ldb.bathyAscAt', null) ? (
        <ButtonRow>
          <Button
            className="btn"
            id="mapAscShare"
            onClick={() => {
              buzz();
              void bathyAscShare();
            }}
          >
            {tr('📤 Envoyer les courbes à l’autre appareil')}
            <small>
              {tr('fichier JSON à importer avec le bouton ci-dessus')}
            </small>
          </Button>
        </ButtonRow>
      ) : null}
      <HelpText text={`${BUILT_IN}${note}`}>
        <>
          {tr(BUILT_IN, { help: true })}
          <span key={lakesNoteVersion.value} id="mapOffSub">
            {tr(note, { help: true })}
          </span>
        </>
      </HelpText>
    </>
  );
}

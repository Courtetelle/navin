import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import {
  LabelButton,
  LinkButton,
} from '../../components/shared/EditableLinks.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  bathyAscImport,
  bathyAscShare,
} from '../../features/map/bathyImport.ts';
import { bathyAscNote } from '../../features/map/bathyStore.ts';
import { LEMAN_ARCGIS } from '../../features/map/constants.ts';
import { lakesNote, lakesNoteVersion } from '../../features/map/lakes.ts';
import {
  fetchLemanVec,
  lemanVecNote,
  lemanVecProgress,
} from '../../features/map/lemanVector.ts';
import { zoneList } from '../../features/map/zoneStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { isLake } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

const BUILT_IN = '🗺 Cartes intégrées (sans réseau) : ';

/** Props of {@link MapExtras}. */
export interface MapExtrasProps {
  /** Day shown, `null` for the whole cruise. */
  day: string | null;
  /** Draw the screen again. */
  onShowDay: (day: string) => void;
}

/**
 * Below the map: offline zones and, on the lake, the ArcGIS chart, the OSM data,
 * the shallow lines and the state of the built-in maps.
 * @param props - Day shown.
 * @returns The rows.
 */
export function MapExtras({ day, onShowDay }: MapExtrasProps) {
  useSignals();
  const tr = useTr();
  const lake = isLake();
  const zones = zoneList();
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
    const done = await bathyAscImport(files, setAscNote);
    if (done) onShowDay(day ?? 'all');
  };
  return (
    <>
      {lake ? (
        <ButtonRow>
          <LinkButton
            className="btn link-btn"
            href={LEMAN_ARCGIS}
            target="_blank"
            rel="noopener"
          >
            {tr('🌐 Carte interactive du Léman (ArcGIS)')}
            <small>{tr('en ligne, s’ouvre dans le navigateur')}</small>
          </LinkButton>
        </ButtonRow>
      ) : null}
      <ButtonRow>
        <Button
          className="btn"
          data-go="zones"
          onClick={() => {
            buzz();
            go('zones');
          }}
        >
          {tr('🗺 Zones hors ligne')}
          <small>
            {tr(
              'plan OpenStreetMap + balisage OpenSeaMap, zone choisie à la main',
            )}
          </small>
          <small>
            {zones.length > 0
              ? zones.map((zone) => zone.name).join(', ')
              : tr('aucune zone enregistrée')}
          </small>
        </Button>
      </ButtonRow>
      {lake ? (
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
      ) : null}
    </>
  );
}

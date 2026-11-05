import { useSignals } from '@preact/signals-react/runtime';
import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { cruiseBackupJson } from '../../features/data/backup.ts';
import { csvDays, csvEntries } from '../../features/data/csv.ts';
import { restoreFile } from '../../features/data/restoreFile.ts';
import {
  GpxImportScreen,
  gpxImportPlan,
  importGpxFile,
} from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import {
  daysWithData,
  deliver,
  fileName,
  isLake,
  loadTrack,
  state,
  toast,
  trackToGpx,
} from '../../state/index.ts';

const HELP =
  'Les données restent sur ce téléphone. Faites une sauvegarde régulièrement et avant de changer de téléphone.';
const LAKE_HELP =
  'Sortie lacustre : la trace vient uniquement du GPS du téléphone (onglet Saisir › Départ).';

function exportEntries(): void {
  buzz();
  const cruise = state.data.cruise.value;
  if (!cruise?.entries.length) {
    toast('Journal vide');
    return;
  }
  void deliver(csvEntries(cruise), fileName('-entrees', 'csv'), 'text/csv');
}

function exportDays(): void {
  buzz();
  const cruise = state.data.cruise.value;
  if (!cruise || daysWithData().length === 0) {
    toast('Aucune journée');
    return;
  }
  void deliver(csvDays(cruise), fileName('-journees', 'csv'), 'text/csv');
}

function exportTrack(): void {
  buzz();
  void deliver(
    trackToGpx(loadTrack()),
    fileName('-trace', 'gpx'),
    'application/gpx+xml',
  );
}

function saveCruiseFile(): void {
  buzz();
  const cruise = state.data.cruise.value;
  if (!cruise) return;
  void deliver(
    cruiseBackupJson(cruise),
    fileName('-sauvegarde', 'json'),
    'application/json',
  );
}

function takeFile(event: ChangeEvent<HTMLInputElement>): File | undefined {
  const file = event.target.files?.[0];
  event.target.value = '';
  return file;
}

/**
 * Screen `export` (legacy `VIEWS.export`): spreadsheets, GPS track, backup and
 * restoration of the open cruise; GPX import at sea.
 * @returns The screen.
 */
export function ExportPage() {
  useSignals();
  const tr = useTr();
  const trackLength = loadTrack().length;
  const lake = isLake();
  if (gpxImportPlan.value) return <GpxImportScreen />;
  return (
    <>
      <PageTitle helps={lake ? [HELP, LAKE_HELP] : [HELP]}>
        Échanges de fichiers
      </PageTitle>
      {lake ? null : <GpxImport />}
      <h2 className="sub-h">{tr('Exporter')}</h2>
      <ButtonRow>
        <Button className="btn big" id="csvBtn" onClick={exportEntries}>
          {tr('Tableur des entrées (CSV)')}
        </Button>
        <Button className="btn big" id="csvDayBtn" onClick={exportDays}>
          {tr('Tableur des journées (CSV)')}
        </Button>
        <Button
          className="btn big"
          id="gpxOut"
          disabled={trackLength === 0}
          onClick={exportTrack}
        >
          {tr('Trace GPS enregistrée (GPX)')}
          <small>{tr(`${trackLength} points`)}</small>
        </Button>
      </ButtonRow>
      <BackupRow />
    </>
  );
}

function GpxImport() {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <h2 className="sub-h">
        {tr('Importer une trace (Navionics, Navimetrix…)')}
      </h2>
      <HelpText>
        Exportez la trace en GPX depuis votre appli de navigation, puis
        choisissez le fichier ici. Le livre crée les entrées de départ,
        d’arrivée, des changements de cap et une par heure, puis ajoute vent,
        mer et baro du modèle météo s’il y a du réseau.
      </HelpText>
      <ButtonRow>
        <Button
          className="btn big"
          id="gpxBtn"
          onClick={() => input.current?.click()}
        >
          {tr('🛰 Importer une trace GPX')}
        </Button>
      </ButtonRow>
      <input
        type="file"
        id="gpxFile"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        hidden
        ref={input}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importGpxFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}

function BackupRow() {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <h2 className="sub-h">{tr('Sauvegarde')}</h2>
      <ButtonRow>
        <Button className="btn big" id="jsonBtn" onClick={saveCruiseFile}>
          {tr('Sauvegarder la croisière')}
        </Button>
        <Button
          className="btn big"
          id="importBtn"
          onClick={() => input.current?.click()}
        >
          {tr('Restaurer une sauvegarde')}
        </Button>
      </ButtonRow>
      <input
        type="file"
        id="importFile"
        accept=".json,application/json"
        hidden
        ref={input}
        onChange={(event) => {
          const file = takeFile(event);
          if (file) void restoreFile(file);
        }}
      />
    </>
  );
}

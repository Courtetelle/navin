import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtShortDate, fmtTime, fr } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

import { applyImport, gpxImportPlan } from './gpxImport.ts';
import type { ImportPlan } from './gpxPlan.ts';

/**
 * Confirmation of an import, shown in place of the page that started it while
 * `gpxImportPlan` is set (legacy `importGpxFile`, auto.js:577-622).
 * @returns The screen, or nothing without import.
 */
export function GpxImportScreen() {
  useSignals();
  const plan = gpxImportPlan.value;
  return plan ? <ImportPreview plan={plan} /> : null;
}

function ImportPreview({ plan }: { plan: ImportPlan }) {
  const tr = useTr();
  const [keep, setKeep] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const { fresh, fills, legs, points, lastTime, name, distance, navigationMs } =
    plan;
  const first = new Date(points[0]?.t ?? 0);
  const last = new Date(lastTime);
  const settings = state.preferences.settings.value;
  const canApply = (fresh.length > 0 || fills.length > 0) && !running;
  return (
    <>
      <PageTitle>Importer la trace</PageTitle>
      <FoldSection className="field" title={name}>
        <HelpText>
          {`${points.length} points · du ${fmtShortDate(first)} ${fmtTime(first)} au ${fmtShortDate(last)} ${fmtTime(last)}`}
        </HelpText>
        <div className="auto-stats">
          <div>
            <b>{fr(distance)}</b>
            <small>{tr('NM')}</small>
          </div>
          <div>
            <b>{fmtDur(navigationMs)}</b>
            <small>{tr('navigation')}</small>
          </div>
          <div>
            <b>{fresh.length}</b>
            <small>{tr('entrées')}</small>
          </div>
        </div>
        {fills.length > 0 ? (
          <HelpText>{fillsText(fills.length)}</HelpText>
        ) : null}
        <ul className="preview">
          {fresh.map((event) => (
            <li key={event.t}>
              <b>{fmtTime(new Date(event.t))}</b>{' '}
              {tr(event.kind || 'point de route')}
            </li>
          ))}
        </ul>
        <HelpText nextIsRow>
          {`${legs.length > 1 ? `${legs.length} navigations séparées. ` : ''}Départ, arrivée et environ ${perHourText(settings.autoPerHour)} au plus, moins si la navigation est longue (modifiable dans Réglages).${settings.autoWeather ? ' La météo du modèle complète ce qui manque s’il y a du réseau.' : ''}`}
        </HelpText>
        <ButtonRow className="row c2">
          <Button className="btn" id="gpxCancel" onClick={() => go('export')}>
            {tr('Annuler')}
          </Button>
          <Button
            className="btn primary"
            id="gpxGo"
            disabled={!canApply}
            onClick={() => {
              buzz();
              setRunning(true);
              void applyImport(plan, keep, setProgress).then((created) => {
                toast(`${created} entrées créées`);
                go('log');
              });
            }}
          >
            {progress ??
              tr(
                `✔ ${fresh.length > 0 ? `Créer ${fresh.length} entrées` : 'Compléter les entrées'}`,
              )}
          </Button>
        </ButtonRow>
        <div className="row">
          <Button
            className={keep ? 'btn on' : 'btn'}
            id="gpxKeep"
            onClick={() => {
              buzz();
              setKeep(!keep);
            }}
          >
            {tr('Garder la trace pour la carte')}
          </Button>
        </div>
      </FoldSection>
    </>
  );
}

function fillsText(count: number): string {
  const plural = count > 1;
  return `${count} entrée${plural ? 's' : ''} notée${plural ? 's' : ''} pendant la navigation ${plural ? 'seront complétées' : 'sera complétée'} avec la position, la vitesse, le cap et le vent de la trace.`;
}

function perHourText(perHour: number): string {
  if (perHour === 2) return 'deux entrées';
  return perHour === 0.5
    ? 'une entrée toutes les deux heures'
    : 'une entrée par heure';
}

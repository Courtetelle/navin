import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtTime, fr, pad } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';
import {
  isLake,
  lastTripKey,
  state,
  toast,
  tripKey,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { addAutoEntry } from './autoEntries.ts';
import { entryBudget } from './entrySelection.ts';
import { startTracking, stopTracking, stopping } from './liveTracking.ts';
import { trkChooseStart } from './trackerLink.ts';
import type { LiveTrip } from './tripState.ts';

/**
 * The automatic log card of the `new` screen (legacy `renderAutoCard`):
 * start button, recording in progress, or interrupted recording, then the
 * tracker button on a lake. Renders `<div id="autoCard">`.
 * @returns The card.
 */
export function AutoCard() {
  useSignals();
  const live = state.view.tracking.value || stopping.value;
  const current = state.view.trip.value as LiveTrip | null;
  const trip = live ? current : store.get<LiveTrip | null>(tripKey(), null);
  useEffect(() => {
    // The stored trip becomes the current one, for ▶ Reprendre and ■ Arrivée.
    if (!live) {
      state.view.trip.value = store.get<LiveTrip | null>(tripKey(), null);
    }
  }, [live]);
  return (
    <div id="autoCard">
      {live && trip ? <RunningCard trip={trip} /> : null}
      {!live && trip ? <InterruptedCard trip={trip} /> : null}
      {trip ? null : <StartButton />}
      {isLake() ? <TrackerButton /> : null}
    </div>
  );
}

function RunningCard({ trip }: { trip: LiveTrip }) {
  const tr = useTr();
  const { det: detector, start } = trip;
  const duration = elapsedSince(start);
  const help = `Départ ${fmtTime(new Date(start))} · en route depuis ${fmtDur(duration)}. À l’arrivée, le livre gardera environ ${entryBudget(duration / 3_600_000)} entrée(s) intermédiaire(s), de préférence aux changements de cap. Laissez l’appli ouverte, l’écran reste allumé. Si l’appli est quittée, l’enregistrement reprend au retour et le trou est complété en ligne droite.`;
  return (
    <section className="field autocard on">
      <h2>
        <span>{tr('🛰 Journal automatique en route')}</span>
      </h2>
      <div className="auto-stats">
        <div>
          <b>{fr(detector.dist)}</b>
          <small>{tr('NM')}</small>
        </div>
        <div>
          <b>{detector.lastSog == null ? '–' : fr(detector.lastSog)}</b>
          <small>{tr('nd')}</small>
        </div>
        <div>
          <b>
            {detector.lastCog == null ? '–' : `${pad(detector.lastCog, 3)}°`}
          </b>
          <small>{tr('route fond')}</small>
        </div>
      </div>
      <HelpText nextIsRow>{help}</HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          id="autoNow"
          onClick={() => {
            buzz();
            pointNow(trip);
          }}
        >
          {tr('Point maintenant')}
        </Button>
        <ArmedButton
          className="btn danger"
          id="autoStop"
          armedLabel={tr('Toucher encore : arrivée')}
          onConfirm={arrive}
        >
          {tr('■ Arrivée')}
        </ArmedButton>
      </ButtonRow>
    </section>
  );
}

function InterruptedCard({ trip }: { trip: LiveTrip }) {
  const tr = useTr();
  return (
    <section className="field autocard">
      <h2>
        <span>{tr('🛰 Suivi interrompu')}</span>
      </h2>
      <HelpText nextIsRow>
        {`Le suivi parti à ${fmtTime(new Date(trip.start))} a été interrompu (appli fermée ou écran éteint).`}
      </HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn primary"
          id="autoResume"
          onClick={() => {
            buzz();
            startTracking(true);
          }}
        >
          {tr('▶ Reprendre')}
        </Button>
        <ArmedButton
          className="btn"
          id="autoEnd"
          armedLabel={tr('Toucher encore : arrivée')}
          onConfirm={arrive}
        >
          {tr('■ Arrivée')}
        </ArmedButton>
      </ButtonRow>
    </section>
  );
}

function StartButton() {
  const tr = useTr();
  return (
    <ButtonRow className="row" style={{ marginBottom: 16 }}>
      <Button
        className="btn big auto-start"
        id="autoStart"
        onClick={() => {
          buzz();
          if (store.get(lastTripKey(), null)) {
            go('tracker');
            setTimeout(trkChooseStart, 50);
            return;
          }
          startTracking(false);
        }}
      >
        {tr('🛰 Départ : journal automatique')}
        <small>
          {tr(
            isLake()
              ? 'GPS du téléphone : heures, trace et milles notés seuls'
              : 'position, route, vitesse, loch et météo notés seuls',
          )}
        </small>
      </Button>
    </ButtonRow>
  );
}

function TrackerButton() {
  const tr = useTr();
  return (
    <ButtonRow className="row" style={{ marginBottom: 16 }}>
      <Button
        className="btn big"
        id="goTracker"
        onClick={() => {
          buzz();
          go('tracker');
        }}
      >
        {tr('🧭 Traceur')}
        <small>{tr('carte, trace en direct, vitesse, cap, mes traces')}</small>
      </Button>
    </ButtonRow>
  );
}

function elapsedSince(start: number): number {
  return Date.now() - start;
}

function pointNow({ det: detector, lochBase }: LiveTrip): void {
  const point = detector.lastPt;
  if (!point) {
    toast('En attente du premier point GPS');
    return;
  }
  void addAutoEntry(
    {
      kind: null,
      t: Date.now(),
      lat: point.lat,
      lon: point.lon,
      cog: detector.lastCog,
      sog: detector.lastSog,
      dist: detector.dist,
    },
    lochBase,
  );
  toast('Point enregistré');
}

function arrive(): void {
  buzz();
  void stopTracking(true);
}

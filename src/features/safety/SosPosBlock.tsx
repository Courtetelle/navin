import { useSignals } from '@preact/signals-react/runtime';
import { Fragment } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { bearing, distNM, fmtPos } from '../../lib/geo.ts';
import type { SosLog } from '../../model/types.ts';
import { lastKnownPos, sosLogActive, state } from '../../state/index.ts';

import { keyedItems } from './keyedItems.ts';
import { sosExOn, sosSimulation } from './sosExercise.ts';
import { sosPlaceWords } from './sosPlaces.ts';

/** A position of the block, with its time. */
interface ShownPosition {
  lat: number;
  lon: number;
  at?: string;
  text?: unknown;
}

/**
 * The SOS position block (legacy `sosPosBlock`): the position frozen when SOS
 * was touched, the current position, and the course back to it.
 * @returns The section, or nothing when no procedure or simulation runs.
 */
export function SosPosBlock() {
  useSignals();
  const log = sosLogActive();
  const simulation = sosSimulation();
  if (!log && !simulation) return null;
  const frozen = frozenPosition(log);
  const current = state.view.sosLive.value ?? lastKnownPos();
  return (
    <section className="field sos-pos" id="sosPosBox">
      <div className="sp-row">
        <span className="sp-k">
          🆘 Position GPS au déclenchement du bouton SOS
          <RowTime at={frozen?.at} />
        </span>
        <PositionValue position={frozen} />
      </div>
      <div className="sp-row">
        <span className="sp-k">
          📍 Position actuelle mise à jour toutes les 5 secondes
          <RowTime at={current?.at} />
        </span>
        <PositionValue position={current} />
      </div>
      <div className="sp-row">
        <span className="sp-k">➜ Go To vers la position SOS</span>
        <GoToValue from={current} to={frozen} />
      </div>
      {simulation && !sosExOn() ? (
        <ButtonRow>
          <Button type="button" className="btn" data-sossim="stop">
            ⏹ Arrêter la simulation
          </Button>
        </ButtonRow>
      ) : null}
    </section>
  );
}

function frozenPosition(log: SosLog | null): ShownPosition | null {
  const simulation = sosSimulation();
  if (simulation) {
    return {
      lat: simulation.lat,
      lon: simulation.lon,
      at: new Date(simulation.t0).toISOString(),
    };
  }
  const fix = log?.events.find((event) => event.type === 'pos' && event.pos);
  if (fix?.pos) return { ...fix.pos, at: fix.t };
  return log?.pos0 ?? null;
}

function RowTime({ at }: { at: string | undefined }) {
  if (!at) return null;
  return (
    <>
      {' · '}
      <TzTime date={new Date(at)} seconds />
    </>
  );
}

function PositionValue({ position }: { position: ShownPosition | null }) {
  if (!position) {
    return (
      <>
        <b>– –</b>
        <small>GPS en attente</small>
      </>
    );
  }
  const words = sosPlaceWords(position);
  const coordinates = fmtPos(position).split(/\s{2,}/);
  return (
    <>
      <b>
        {keyedItems(coordinates, String).map(({ key, item, index }) => (
          <Fragment key={key}>
            {index > 0 ? ' ' : null}
            <span className="sp-c">{item}</span>
          </Fragment>
        ))}
      </b>
      {words ? <small>{words}</small> : null}
    </>
  );
}

function GoToValue({
  from,
  to,
}: {
  from: ShownPosition | null;
  to: ShownPosition | null;
}) {
  if (!to || from?.lat == null) return <b>– –</b>;
  const nauticalMiles = distNM(from, to);
  const metres = nauticalMiles * 1852;
  if (metres < 15) return <b>Vous êtes sur la position SOS</b>;
  const course = String(Math.round(bearing(from, to))).padStart(3, '0');
  const miles = (
    nauticalMiles < 10 ? nauticalMiles.toFixed(2) : nauticalMiles.toFixed(1)
  ).replace('.', ',');
  const distance =
    metres < 1000
      ? `${Math.round(metres)} m`
      : `${(metres / 1000).toFixed(1).replace('.', ',')} km`;
  return (
    <>
      <b>
        Cap {course}° · {miles} NM
      </b>
      <small>{distance}</small>
    </>
  );
}

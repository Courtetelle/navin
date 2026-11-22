import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { FIELDS } from '../../model/fields.ts';
import type { RealPolar } from '../../model/realPolar.ts';
import { realMinutes, realToPolar } from '../../model/realPolar.ts';
import type { Boat } from '../../model/types.ts';
import { seaCruiseBoat, toast, updateBoat } from '../../state/index.ts';
import { allLakeTracks } from '../map/trackStats.ts';
import {
  currentSails,
  realPolarsOf,
  sailsNow,
  setSailsNow,
} from '../tracking/polarRecorder.ts';
import { addTraceToPolar, tracesInPolar } from '../tracking/tracePolar.ts';

/**
 * The choices of a logbook field (main sail, head sail).
 * @param key - `gv` or `avant`.
 * @returns The choices.
 */
function choicesOf(key: string): string[] {
  const field = FIELDS.find((item) => item.key === key);
  return (field?.options ?? []).map((option) => option[0]);
}

/**
 * The sails of a boat beyond those of the logbook (`boat.sails`).
 * @param boat - The boat.
 * @returns Their names.
 */
function boatSails(boat: Boat): string[] {
  return Array.isArray(boat.sails)
    ? boat.sails.filter((sail): sail is string => typeof sail === 'string')
    : [];
}

/** Props of {@link RealPolars}. */
interface RealPolarsProps {
  boat: Boat;
}

/**
 * Bateaux › polaire › « Polaire réelle »: the sails of the boat, the sails
 * up, and what the boat made under each set of sails.
 * @param props - The boat.
 * @returns The section.
 */
export function RealPolars({ boat }: RealPolarsProps) {
  useSignals();
  const tr = useTr();
  // Read so that a change of sails draws again.
  const set = sailsNow.value;
  const now = currentSails();
  const extra = boatSails(boat);
  const heads = [...new Set([...choicesOf('avant'), ...extra])];
  const reals = realPolarsOf(boat);
  const [added, setAdded] = useState('');
  return (
    <>
      <h2 className="sub-h">{tr('Polaire réelle (vos navigations)')}</h2>
      <HelpText>
        Pendant une navigation enregistrée, NavIn compte chaque minute où le cap
        et le vent restent stables, avec le vent réel des instruments (NMEA),
        pour la voilure en place. Chaque voilure a sa polaire. Sans instruments,
        une trace du bateau s’ajoute avec le vent du modèle à l’heure et au lieu
        de chaque minute (polaire marquée « vent modèle », moins précise), la
        voilure étant celle du journal de bord.
      </HelpText>
      <div className="section rp-sails" id="sailsNow" data-at={set.at}>
        <p>
          <b>{tr('Voilure en place')}</b>
        </p>
        <label>
          {tr('Grand-voile')}{' '}
          <select
            id="sailGv"
            value={now.gv}
            onChange={(event) => {
              setSailsNow({ ...now, gv: event.target.value });
            }}
          >
            {choicesOf('gv').map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        </label>{' '}
        <label>
          {tr('Avant')}{' '}
          <select
            id="sailHead"
            value={now.avant}
            onChange={(event) => {
              setSailsNow({ ...now, avant: event.target.value });
            }}
          >
            {heads.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        </label>
        <HelpText>
          Une voilure notée dans le journal de bord prend aussi la suite.
        </HelpText>
        <p>
          <b>{tr('Voiles du bateau en plus')}</b>
        </p>
        <ul className="rp-extra" id="sailsExtra">
          {extra.map((sail) => (
            <li key={sail}>
              {sail}{' '}
              <button
                type="button"
                className="btn rp-x"
                aria-label={`Retirer ${sail}`}
                onClick={() => {
                  buzz();
                  updateBoat(boat.id, (draft) => {
                    draft.sails = boatSails(draft).filter(
                      (item) => item !== sail,
                    );
                  });
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          className="pol-search"
          onSubmit={(event) => {
            event.preventDefault();
            const name = added.trim();
            if (!name) return;
            buzz();
            updateBoat(boat.id, (draft) => {
              draft.sails = [...new Set([...boatSails(draft), name])];
            });
            setAdded('');
            toast(`${name} ajoutée aux voiles du bateau`);
          }}
        >
          <input
            type="text"
            id="sailAdd"
            placeholder={tr('Code 0, spi asymétrique…')}
            value={added}
            onChange={(event) => setAdded(event.target.value)}
          />
          <Button className="btn" id="sailAddBtn" type="submit">
            {tr('＋ Ajouter')}
          </Button>
        </form>
      </div>
      <TracesToPolar boat={boat} />
      {reals.length === 0 ? (
        <HelpText>{tr('Aucune minute enregistrée pour ce bateau.')}</HelpText>
      ) : (
        reals.map((real) => (
          <RealCard key={real.sails} boatId={boat.id} real={real} />
        ))
      )}
    </>
  );
}

interface RealCardProps {
  boatId: string;
  real: RealPolar;
}

function RealCard({ boatId, real }: RealCardProps) {
  const tr = useTr();
  const polar = realToPolar(real);
  const minutes = realMinutes(real);
  return (
    <details className="section rp-real" data-real={real.sails}>
      <summary>
        <b>{real.sails}</b>{' '}
        <small>
          {`${minutes} min · ${fmtShortDate(new Date(real.from))} → ${fmtShortDate(new Date(real.to))}`}
        </small>
      </summary>
      <div className="pol-wrap">
        <table className="pol-table">
          <thead>
            <tr>
              <th scope="col">{tr(String.raw`Angle \ vent (nd)`)}</th>
              {polar.tws.map((tws) => (
                <th key={tws} scope="col">
                  {tws}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {polar.twa.map((twa, row) => (
              <tr key={twa}>
                <th scope="row">{`${twa}°`}</th>
                {polar.tws.map((tws, column) => {
                  const kn = polar.kn[row]?.[column] ?? 0;
                  return (
                    <td key={tws}>
                      {kn > 0 ? kn.toFixed(1).replace('.', ',') : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{tr('Vitesse du bateau en nd')}</th>
              {polar.tws.map((tws) => (
                <th key={tws}>{tws}</th>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <ButtonRow>
        <ArmedButton
          className="btn danger"
          armedLabel="Toucher encore : effacer"
          onClick={buzz}
          onConfirm={() => {
            updateBoat(boatId, (draft) => {
              draft.realPolars = realPolarsOf(draft).filter(
                (item) => item.sails !== real.sails,
              );
            });
            toast('Polaire réelle effacée');
          }}
        >
          {tr('🗑 Effacer cette polaire réelle')}
        </ArmedButton>
      </ButtonRow>
    </details>
  );
}

/**
 * The traces of a boat, each one to add to its real polars with the wind of
 * the model.
 * @param props - The boat.
 * @returns The list.
 */
function TracesToPolar({ boat }: RealPolarsProps) {
  const tr = useTr();
  const [busy, setBusy] = useState<string | null>(null);
  const done = new Set(tracesInPolar(boat));
  const traces = allLakeTracks().filter(({ cruise }) =>
    cruise
      ? cruise.boatId === boat.id || seaCruiseBoat(cruise)?.id === boat.id
      : false,
  );
  if (traces.length === 0) return null;
  return (
    <details className="section rp-traces" id="rpTraces">
      <summary>{tr('📈 Ajouter une trace (vent du modèle)')}</summary>
      <ul className="pol-found">
        {traces.map((trace) => (
          <li key={trace.id}>
            <button
              type="button"
              className="btn pol-take"
              data-trace-polar={trace.id}
              disabled={busy !== null || done.has(trace.id)}
              onClick={() => {
                buzz();
                setBusy(trace.id);
                void addTraceToPolar(
                  boat.id,
                  trace.id,
                  trace.track,
                  trace.cruise,
                ).then((answer) => {
                  setBusy(null);
                  if ('error' in answer) {
                    toast(answer.error);
                    return;
                  }
                  toast(
                    `${answer.counted} minute${answer.counted > 1 ? 's' : ''} ajoutée${answer.counted > 1 ? 's' : ''} à la polaire réelle`,
                  );
                });
              }}
            >
              <b>{trace.name}</b>
              <small>
                {busy === trace.id
                  ? tr('Calcul…')
                  : done.has(trace.id)
                    ? tr('Ajoutée')
                    : tr('Toucher pour l’ajouter')}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

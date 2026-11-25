import { useSignals } from '@preact/signals-react/runtime';
import { useMemo, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { boatsByNav } from '../../features/boats/navOrder.ts';
import { shownMap } from '../../features/map/mapFull.ts';
import { editRoute } from '../../features/map/routeEditor.ts';
import type {
  RoutingPrefs,
  RoutingRun,
} from '../../features/map/routingRun.ts';
import {
  routingPrefs,
  runRouting,
  saveRoutingPrefs,
} from '../../features/map/routingRun.ts';
import {
  clearRouting,
  fitRouting,
  gotoRouting,
  showRouting,
} from '../../features/map/routingShown.ts';
import type {
  RoutingStats,
  SavedRouting,
} from '../../features/map/routingState.ts';
import {
  removeRouting,
  renameRouting,
  routingShape,
  saveRouting,
  savedRoutings,
  shownRouting,
} from '../../features/map/routingState.ts';
import { ROUTING_MODELS } from '../../features/map/routingWeather.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { utcMark } from '../../lib/clockMode.ts';
import { buzz } from '../../lib/dom.ts';
import {
  fmtDateTime,
  fmtDur,
  fmtTime,
  fromLocalInput,
  pad,
  toLocalInput,
  toPhoneInput,
  uid,
} from '../../lib/format.ts';
import { isBoatPolar } from '../../model/polars.ts';
import type { NavRoute } from '../../model/routes.ts';
import { routeLabel } from '../../model/routes.ts';
import type { RoutingResult, RoutingStep } from '../../model/sailRouting.ts';
import { routingTurns } from '../../model/sailRouting.ts';
import { go } from '../../shell/router.ts';
import { deliver, saveRoute, state, toast } from '../../state/index.ts';

type Done = Extract<RoutingResult, { kind: 'done' }>;

/**
 * The next full hour, for an input `datetime-local`.
 * @returns « 2027-06-12T07:00 ».
 */
function nextHour(): string {
  const date = new Date(Date.now() + 3_600_000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

function when(ms: number): string {
  return fmtDateTime(new Date(ms));
}

/** A choice among a few: big buttons, easy on a boat that pitches. */
function Choice<T extends string>({
  id,
  label,
  choices,
  value,
  onPick,
}: {
  id: string;
  label: string;
  choices: ReadonlyArray<{ key: T; text: string }>;
  value: T;
  onPick: (key: T) => void;
}) {
  const tr = useTr();
  return (
    <div className="rtg-choice" id={id} role="group" aria-label={tr(label)}>
      <span className="rtg-choice-title">{tr(label)}</span>
      <ButtonRow className="row c2">
        {choices.map(({ key, text }) => (
          <Button
            key={key}
            type="button"
            className={key === value ? 'btn on' : 'btn'}
            aria-pressed={key === value}
            data-choice={key}
            onClick={() => {
              buzz();
              onPick(key);
            }}
          >
            {tr(text)}
          </Button>
        ))}
      </ButtonRow>
    </div>
  );
}

function kn(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Routes › « ⛵ Routage »: a route drawn, a boat with its polar, a departure
 * date and time, a weather model and the motor threshold; then the routing.
 * @returns The part of the page.
 */
export function RoutingPanel() {
  useSignals();
  const tr = useTr();
  const routes = state.data.routes.value.toSorted((a, b) =>
    (b.mod || '').localeCompare(a.mod || ''),
  );
  const boats = boatsByNav();
  const [prefs, setPrefs] = useState<RoutingPrefs>(() => routingPrefs());
  const [routeId, setRouteId] = useState(() => routes[0]?.id ?? '');
  const [depart, setDepart] = useState(nextHour);
  const [run, setRun] = useState<RoutingRun | 'busy' | null>(null);
  const boatId =
    boats.find((boat) => boat.id === prefs.boatId)?.id ??
    boats.find((boat) => isBoatPolar(boat.polar))?.id ??
    boats[0]?.id ??
    '';
  const boat = boats.find((item) => item.id === boatId);
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const change = (next: Partial<RoutingPrefs>) => {
    const merged = { ...prefs, boatId, ...next };
    setPrefs(merged);
    saveRoutingPrefs(merged);
  };
  if (routes.length === 0) {
    return (
      <HelpText>
        Aucune route pour l’instant : dessinez d’abord la route (partie « Route
        »), même grossièrement. Le routage part de son premier point, passe par
        les suivants et finit au dernier.
      </HelpText>
    );
  }
  return (
    <>
      <HelpText>
        Le routage suit la route dessinée de point en point, avec le vent prévu
        là où le bateau sera, à l’heure où il y sera, et la polaire du bateau
        (ou mieux, sa polaire réelle). Au près il tire des bords, au vent
        arrière il empanne. La vitesse du bateau vient de ses polaires, à
        l’angle et à la force du vent prévus : quand elle passe sous le seuil
        choisi, le moteur remplace ou appuie les voiles, en ligne droite, et
        l’heure d’arrivée suit. Avec une carte hors ligne (Fonds de cartes) qui
        couvre la route, les bords s’arrêtent avant la terre. Le courant
        (Copernicus, marée comprise) pousse le bateau : en ligne droite il
        remonte le courant pour tenir la route, et la vitesse fond donne l’heure
        d’arrivée. Les vagues de plus d’un mètre ralentissent, surtout au près.
      </HelpText>
      <SavedRoutings />
      <div className="section rtg-form" id="rtgForm">
        <Choice
          id="rtgRoute"
          label="Route"
          choices={routes.map((item) => ({ key: item.id, text: item.name }))}
          value={route?.id ?? ''}
          onPick={setRouteId}
        />
        <Choice
          id="rtgBoat"
          label="Bateau"
          choices={boats.map((item) => ({
            key: item.id,
            text: `${item.info.boat || 'Bateau'}${isBoatPolar(item.polar) ? '' : ' (sans polaire)'}`,
          }))}
          value={boatId}
          onPick={(key) => change({ boatId: key })}
        />
        <label>
          {tr('Départ (date et heure)')}
          <input
            type="datetime-local"
            id="rtgDepart"
            // Kept in the time of the device, shown and typed in UTC when
            // the clock shows UTC.
            value={toLocalInput(new Date(depart))}
            onChange={(event) => {
              const typed = fromLocalInput(event.target.value);
              setDepart(
                Number.isFinite(typed)
                  ? toPhoneInput(new Date(typed))
                  : event.target.value,
              );
            }}
          />
        </label>
        <Choice
          id="rtgModel"
          label="Modèle météo"
          choices={ROUTING_MODELS.map((model) => ({
            key: model.id,
            text: model.name,
          }))}
          value={prefs.model}
          onPick={(key) => change({ model: key })}
        />
        <label>
          {tr('Moteur quand la vitesse du bateau (polaires) passe sous (nd)')}
          <input
            type="number"
            id="rtgMotorBelow"
            min={0}
            max={15}
            step={0.5}
            inputMode="decimal"
            value={prefs.motorBelow}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value >= 0 && value <= 15) change({ motorBelow: value });
            }}
          />
        </label>
        <Choice
          id="rtgMotorAssist"
          label="Le moteur"
          choices={[
            { key: 'replace', text: 'remplace les voiles (en ligne droite)' },
            {
              key: 'assist',
              text: 'appuie les voiles (voiles + moteur, en ligne droite)',
            },
          ]}
          value={prefs.motorAssist ? 'assist' : 'replace'}
          onPick={(key) => change({ motorAssist: key === 'assist' })}
        />
        <label>
          {tr('Vitesse au moteur (nd)')}
          <input
            type="number"
            id="rtgMotorKn"
            min={1}
            max={15}
            step={0.5}
            inputMode="decimal"
            value={prefs.motorKn}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value >= 1 && value <= 15) change({ motorKn: value });
            }}
          />
        </label>
      </div>
      <ButtonRow>
        <Button
          className="btn primary big"
          id="rtgRun"
          disabled={run === 'busy' || !route || !boat}
          onClick={() => {
            if (!route || !boat) return;
            buzz();
            setRun('busy');
            const departMs = new Date(depart).getTime();
            void runRouting(route, boat, departMs, { ...prefs, boatId }).then(
              setRun,
            );
          }}
        >
          {tr(run === 'busy' ? 'Calcul…' : '⛵ Calculer le routage')}
        </Button>
      </ButtonRow>
      {run && run !== 'busy' && route ? (
        <RoutingOutcome run={run} route={route} prefs={{ ...prefs, boatId }} />
      ) : null}
    </>
  );
}

interface OutcomeProps {
  run: RoutingRun;
  route: NavRoute;
  /** The boat, the motor and the model asked. */
  prefs: RoutingPrefs;
}

function RoutingOutcome({ run, route, prefs }: OutcomeProps) {
  const tr = useTr();
  const id = useMemo(() => (run ? uid() : ''), [run]);
  if (run.kind === 'error') {
    return (
      <p className="help rtg-msg" id="rtgMsg">
        {run.error}
      </p>
    );
  }
  const { result, landSeen, seaSeen, wind } = run;
  if (result.kind === 'no-wind') {
    return (
      <p className="help rtg-msg" id="rtgMsg">
        {`La prévision de ce modèle s’arrête avant l’arrivée (vers le ${when(result.ms)}) : choisissez un départ plus proche ou un modèle qui voit plus loin (ECMWF, GFS).`}
      </p>
    );
  }
  if (result.kind === 'too-long') {
    return (
      <p className="help rtg-msg" id="rtgMsg">
        {tr('Plus de 14 jours de route : vérifiez la route et le bateau.')}
      </p>
    );
  }
  const depart = result.steps[0]?.ms ?? result.arriveMs;
  const summary = routingSummary(result, depart);
  // Kept in « Routages » under one id, however many buttons are touched.
  const keep = () => {
    const shape = routingShape(
      `Routage ${when(depart)}${utcMark()}`,
      result,
      route.points,
    );
    const shown = {
      ...shape,
      id,
      plan: {
        routeId: route.id,
        boatId: prefs.boatId,
        motorBelow: prefs.motorBelow,
        motorKn: prefs.motorKn,
        motorAssist: prefs.motorAssist,
        model: prefs.model,
        base: {
          departMs: depart,
          arriveMs: result.arriveMs,
          stats: shape.stats as RoutingStats,
        },
      },
    };
    saveRouting({
      id,
      at: new Date().toISOString(),
      departMs: depart,
      arriveMs: result.arriveMs,
      nm: result.nm,
      summary,
      model: wind.model,
      route: routeLabel(route, state.data.routes.peek()),
      shown,
    });
    return shown;
  };
  return (
    <div className="section rtg-result" id="rtgResult">
      <p className="rtg-eta">
        <b>{`Arrivée ${when(result.arriveMs)}`}</b>
      </p>
      <p>{summary}</p>
      <p className="help" id="rtgLand">
        {tr(
          landSeen
            ? 'Terre évitée pendant les bords (carte hors ligne du téléphone ; roches et hauts-fonds non vus).'
            : 'Terre non vue pendant les bords : aucune carte hors ligne ne couvre la route (Fonds de cartes).',
        )}
      </p>
      <p className="help" id="rtgSea">
        {tr(
          seaSeen
            ? 'Courants et vagues pris en compte (Open-Meteo marine, Copernicus, marée comprise).'
            : 'Courants et vagues inconnus ici : routage en mer plate, sans courant.',
        )}
      </p>
      <h3 className="sub-h">{tr('Par segment')}</h3>
      <LegTable result={result} route={route} />
      <h3 className="sub-h">{tr('Heure par heure')}</h3>
      <StepTable steps={hourly(result.steps)} />
      <ButtonRow>
        <Button
          className="btn primary"
          id="rtgShow"
          onClick={() => {
            buzz();
            showRouting(keep());
            go('tracker');
            // The map opens, then the whole routing is shown.
            setTimeout(() => {
              const map = tracker.current?.map ?? shownMap();
              if (map) fitRouting(map);
            }, 700);
          }}
        >
          {tr('✓ Terminer : voir le routage sur la carte')}
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          id="rtgGoto"
          onClick={() => {
            buzz();
            showRouting(keep());
            go('tracker');
            gotoRouting();
          }}
        >
          {tr('🎯 Go to le long du routage, segment par segment')}
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          id="rtgSave"
          onClick={() => {
            buzz();
            keep();
            toast('Routage enregistré dans Routages');
          }}
        >
          {tr('💾 Enregistrer dans Routages')}
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          id="rtgKeep"
          onClick={() => {
            buzz();
            const hours = (result.arriveMs - depart) / 3_600_000;
            const kept = saveRoute({
              name: `${routeLabel(route, state.data.routes.peek())} · routage`,
              points: routingTurns(result, route.points),
              speed: hours > 0 ? Math.round((result.nm / hours) * 10) / 10 : 0,
              depart: new Date(depart).toISOString(),
              how: 'auto',
            });
            toast('Routage gardé comme route');
            editRoute(kept.id);
          }}
        >
          {tr('🗺 Garder comme route (à modifier)')}
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button
          className="btn"
          id="rtgShare"
          onClick={() => {
            buzz();
            void deliver(
              routingText(result, route, depart),
              'routage.txt',
              'text/plain',
            );
          }}
        >
          {tr('📤 Partager le routage')}
        </Button>
      </ButtonRow>
    </div>
  );
}

function routingSummary(result: Done, depart: number): string {
  const parts = [
    `${fmtDur(result.arriveMs - depart)} de route`,
    `${kn(result.nm)} NM`,
    `voile ${fmtDur(result.sailMin * 60_000)}`,
    `moteur ${fmtDur(result.motorMin * 60_000)}`,
    `${result.tacks} virement${result.tacks > 1 ? 's' : ''}`,
    `${result.gybes} empannage${result.gybes > 1 ? 's' : ''}`,
  ];
  return parts.join(' · ');
}

/**
 * One step an hour, and every change of mode or sails.
 * @param steps - All the steps.
 * @returns The steps to show.
 */
function hourly(steps: readonly RoutingStep[]): RoutingStep[] {
  const shown: RoutingStep[] = [];
  let last: RoutingStep | undefined;
  for (const step of steps) {
    if (
      !last ||
      step.ms - last.ms >= 3_600_000 ||
      step.mode !== last.mode ||
      step.sails !== last.sails ||
      step.side !== last.side
    ) {
      shown.push(step);
      last = step;
    }
  }
  return shown;
}

function LegTable({ result, route }: { result: Done; route: NavRoute }) {
  const tr = useTr();
  const name = (rank: number) => route.points[rank]?.name || `P${rank + 1}`;
  const head = (
    <tr>
      <th scope="col">{tr('Segment')}</th>
      <th scope="col">{tr('Arrivée')}</th>
      <th scope="col">{tr('NM')}</th>
      <th scope="col">{tr('Voile (h)')}</th>
      <th scope="col">{tr('Moteur (h)')}</th>
      <th scope="col">{tr('Virements')}</th>
      <th scope="col">{tr('Empannages')}</th>
    </tr>
  );
  return (
    <div className="pol-wrap">
      <table className="pol-table rtg-table" id="rtgLegs">
        <thead>{head}</thead>
        <tbody>
          {result.legs.map((leg) => (
            <tr key={leg.to}>
              <th scope="row">{`${name(leg.from)} → ${name(leg.to)}`}</th>
              <td>{when(leg.arriveMs)}</td>
              <td>{kn(leg.nm)}</td>
              <td>{fmtDur(leg.sailMin * 60_000)}</td>
              <td>{fmtDur(leg.motorMin * 60_000)}</td>
              <td>{leg.tacks}</td>
              <td>{leg.gybes}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>{head}</tfoot>
      </table>
    </div>
  );
}

function StepTable({ steps }: { steps: readonly RoutingStep[] }) {
  const tr = useTr();
  const head = (
    <tr>
      <th scope="col">{tr('Heure')}</th>
      <th scope="col">{tr('Cap (°)')}</th>
      <th scope="col">{tr('Vitesse surface (nd)')}</th>
      <th scope="col">{tr('Route fond (° / nd)')}</th>
      <th scope="col">{tr('Vent (° / nd)')}</th>
      <th scope="col">{tr('Courant (vers ° / nd)')}</th>
      <th scope="col">{tr('Vagues (m)')}</th>
      <th scope="col">{tr('Angle au vent (°)')}</th>
      <th scope="col">{tr('Voiles')}</th>
    </tr>
  );
  return (
    <div className="pol-wrap">
      <table className="pol-table rtg-table" id="rtgSteps">
        <thead>{head}</thead>
        <tbody>
          {steps.map((step) => (
            <tr
              key={step.ms}
              className={step.mode === 'motor' ? 'rtg-motor' : undefined}
            >
              <td>{fmtTime(new Date(step.ms))}</td>
              <td>{step.course}</td>
              <td>{kn(step.kn)}</td>
              <td>{`${step.cog} / ${kn(step.sog)}`}</td>
              <td>{`${step.twd} / ${kn(step.tws)}`}</td>
              <td>
                {step.driftKn > 0
                  ? `${step.setDeg} / ${kn(step.driftKn)}`
                  : '·'}
              </td>
              <td>{Number.isFinite(step.waveM) ? kn(step.waveM) : '·'}</td>
              <td>
                {step.mode === 'motor' ? '·' : `${step.twa} ${step.side}`}
              </td>
              <td>{step.sails}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>{head}</tfoot>
      </table>
    </div>
  );
}

/**
 * The routing as a text to share.
 * @param result - The routing.
 * @param route - The route.
 * @param depart - Departure, epoch ms.
 * @returns The text.
 */
function routingText(result: Done, route: NavRoute, depart: number): string {
  const lines = [
    `Routage NavIn · ${routeLabel(route, state.data.routes.peek())}`,
    `Départ ${when(depart)}${utcMark()} · arrivée ${when(result.arriveMs)}${utcMark()}`,
    routingSummary(result, depart),
    '',
    `Heure${utcMark()} · cap (°) · vitesse surface (nd) · route fond (° / nd) · vent (° / nd) · courant (vers ° / nd) · vagues (m) · angle au vent · voiles`,
  ];
  for (const step of hourly(result.steps)) {
    lines.push(
      `${fmtTime(new Date(step.ms))} · ${step.course} · ${kn(step.kn)} · ${step.cog} / ${kn(step.sog)} · ${step.twd} / ${kn(step.tws)} · ${step.driftKn > 0 ? `${step.setDeg} / ${kn(step.driftKn)}` : '-'} · ${Number.isFinite(step.waveM) ? kn(step.waveM) : '-'} · ${step.mode === 'motor' ? '-' : `${step.twa}° ${step.side}`} · ${step.sails}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function openOnMap(saved: SavedRouting): void {
  buzz();
  showRouting(saved.shown);
  go('tracker');
  setTimeout(() => {
    const map = tracker.current?.map ?? shownMap();
    if (map) fitRouting(map);
  }, 700);
}

/**
 * The routings kept, as the routes of « Route »: a touch shows one on the
 * map, a long press changes its name; swiped, 🎯 Go to along it and 🗑.
 * @returns The list.
 */
function SavedRoutings() {
  useSignals();
  const tr = useTr();
  const list = savedRoutings.value;
  return (
    <section className="field" id="rtgSaved">
      <h3 className="sub-h">{tr('📚 Routages')}</h3>
      {list.length > 0 ? (
        list.map((saved) => <SavedItem key={saved.id} saved={saved} />)
      ) : (
        <p className="help">
          {tr(
            'Aucun routage enregistré : calculez-en un, puis « Enregistrer » ou « Terminer ».',
            { help: true },
          )}
        </p>
      )}
    </section>
  );
}

function SavedItem({ saved }: { saved: SavedRouting }) {
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const press = useLongPress(() => setEditing(saved.shown.name));
  const { name } = saved.shown;
  return (
    <SwipeRow
      id={saved.id}
      name={name}
      onView={() => {
        openOnMap(saved);
        gotoRouting();
      }}
      viewAs={{ icon: '🎯', label: 'Go to' }}
      onDelete={(id) => {
        if (shownRouting.peek()?.id === id) clearRouting();
        removeRouting(id);
      }}
    >
      <div className="section mark-item rt-band" data-routing={saved.id}>
        {editing === null ? (
          <button
            type="button"
            className={`mark-head${press.hit ? ' lp-hit' : ''}`}
            aria-label={tr(
              `${name} · toucher : sur la carte · appui long : changer le nom`,
            )}
            onClick={() => openOnMap(saved)}
            {...press.handlers}
          >
            <span className="mk-pin" aria-hidden="true">
              ⛵
            </span>
            <span className="mk-text">
              <b className="b-nm">{name}</b>
              <small>
                {tr(
                  `${saved.route ? `${saved.route} · ` : ''}Arrivée ${when(saved.arriveMs)} · ${saved.summary}`,
                )}
              </small>
            </span>
          </button>
        ) : (
          <form
            className="mark-head mark-edit"
            onSubmit={(event) => {
              event.preventDefault();
              setEditing(null);
              if (editing.trim()) renameRouting(saved.id, editing);
            }}
          >
            <span className="mk-pin" aria-hidden="true">
              ⛵
            </span>
            <input
              className="text"
              // Opened by a long press, to be written in at once.
              autoFocus
              value={editing}
              onChange={(event) => setEditing(event.target.value)}
              onBlur={() => {
                setEditing(null);
                if (editing.trim()) renameRouting(saved.id, editing);
              }}
            />
          </form>
        )}
      </div>
    </SwipeRow>
  );
}

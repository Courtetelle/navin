import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { boatSailSpeed, routingPrefs } from '../../features/map/routingRun.ts';
import type {
  BriefingData,
  BriefingDay,
  Packets,
  SeaMeasure,
} from '../../features/onwater/briefing.ts';
import {
  LIGHTS,
  WINDOW,
  briefingDays,
  dayName,
  keepMeasure,
  keepPackets,
  keptMeasure,
  keptPackets,
  promptOf,
  readBriefing,
} from '../../features/onwater/briefing.ts';
import { scalePoint } from '../../features/onwater/pointSea.ts';
import type {
  RouteBriefing,
  RouteForecast,
  RoutingBoat,
} from '../../features/onwater/routeBriefing.ts';
import {
  keepRoutePacket,
  keptRouteForecast,
  legWords,
  readRouteForecast,
  routeBriefing,
  routePrompt,
  routeTrack,
} from '../../features/onwater/routeBriefing.ts';
import { shareCards } from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { showsUtc, utcMark } from '../../lib/clockMode.ts';
import { buzz } from '../../lib/dom.ts';
import {
  fromLocalInput,
  shownTimeOptions,
  toLocalInput,
  toPhoneInput,
} from '../../lib/format.ts';
import { compassPoint } from '../../lib/wind.ts';
import { parseTyped } from '../../model/beaufortDouglas.ts';
import { inInland } from '../../model/contacts.ts';
import type { BoatProfile, Thresholds } from '../../model/goNoGo.ts';
import {
  NOGO_WIND_MAX,
  REFERENCE,
  TIDE_RULES,
  boatKindOf,
  boatLength,
  thresholdsOf,
} from '../../model/goNoGo.ts';
import { isBoatPolar } from '../../model/polars.ts';
import { isRealPolar } from '../../model/realPolar.ts';
import type { Boat } from '../../model/recordTypes.ts';
import type { NavRoute } from '../../model/routes.ts';
import { routeNm } from '../../model/routes.ts';
import { boatById, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

const BOAT_KEY = 'navin.gngBoat';
const PROFILES_KEY = 'navin.gngProfiles';
const COURSE_KEY = 'navin.gngCourse';
/** The route planned, by its id ('' : none, the point of the zone). */
const ROUTE_KEY = 'navin.gngRoute';
/** Departure (local, `YYYY-MM-DDTHH:MM`) and speed planned, per route. */
const PLANS_KEY = 'navin.gngRoutePlans';

interface RoutePlan {
  depart: string;
  speed: number;
}
/** The reference boat, chosen when no boat of the list is. */
const REF = 'ref';

type Settings = Pick<BoatProfile, 'smallCrew'>;
const DEFAULT_SETTINGS: Settings = { smallCrew: false };

const fr = (value: number, digits = 0) =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',');

/**
 * A time for an input `datetime-local`, in the time of the device.
 * @param ms - Epoch ms.
 * @returns `YYYY-MM-DDTHH:MM`.
 */
function localInput(ms: number): string {
  return toPhoneInput(new Date(ms));
}

/**
 * The plan of a route: the one kept here, else its own departure when to
 * come, else tomorrow at 8 h; its own speed.
 * @param route - The route.
 * @param plans - The plans kept.
 * @returns The plan.
 */
function planOf(route: NavRoute, plans: Record<string, RoutePlan>): RoutePlan {
  const kept = plans[route.id];
  if (kept) return kept;
  const own = route.depart ? Date.parse(route.depart) : Number.NaN;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return {
    depart: localInput(
      Number.isFinite(own) && own > Date.now() ? own : tomorrow.getTime(),
    ),
    speed: route.speed,
  };
}

/**
 * The boat of the cruise in progress: a cruise open, with its boat, whose
 * dates (when given) hold today.
 * @returns The boat, or undefined.
 */
function cruiseBoat(): Boat | undefined {
  const cruise = state.data.cruise.value;
  if (!cruise?.boatId) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  const { du, au } = cruise.info ?? {};
  const from = typeof du === 'string' && du ? du : '';
  const to = typeof au === 'string' && au ? au : '';
  if ((from && from > today) || (to && to < today)) return undefined;
  return boatById(cruise.boatId);
}

/**
 * The thresholds of a boat (the reference one when undefined): category and
 * kind from its sheet, crew from the settings of this page.
 * @param boat - The boat.
 * @param settings - Its settings here.
 * @returns The thresholds.
 */
function limitsOf(boat: Boat | undefined, settings: Settings): Thresholds {
  const sheet = boatKindOf(boat?.info);
  const profile: BoatProfile = {
    loa: boat ? boatLength(boat.info) : 13.6,
    ce: sheet.ce,
    kind: sheet.kind ?? 'monocoque',
    smallCrew: settings.smallCrew,
  };
  return thresholdsOf(profile);
}

/**
 * The days of the go / no-go as this page gives them (same boat, settings,
 * course and point), for a summary elsewhere: 'asking' while no boat is
 * chosen, 'reading', or null without forecast.
 * @returns The days, or the state.
 */
function useGoNoGoDays(): BriefingDay[] | 'asking' | 'reading' | null {
  useSignals();
  const boats = state.data.boats.value;
  const fromCruise = cruiseBoat();
  const chosen = store.get<string>(BOAT_KEY, '');
  const boat = fromCruise ?? (chosen === REF ? undefined : boatById(chosen));
  const asking = !fromCruise && !boat && (chosen !== REF || boats.length > 0);
  const [point] = useState(() => scalePoint(null));
  const lake = point.kind === 'zone-lake' || inInland(point);
  const [data, setData] = useState<BriefingData | null | 'reading'>('reading');
  useEffect(() => {
    let closed = false;
    void readBriefing(point, lake)
      .catch(() => null)
      .then((found) => {
        if (!closed) setData(found);
      });
    return () => {
      closed = true;
    };
  }, [point, lake]);
  if (asking) return 'asking';
  if (data === 'reading') return 'reading';
  if (!data) return null;
  const settings =
    store.get<Record<string, Settings>>(PROFILES_KEY, {})[boat?.id ?? REF] ??
    DEFAULT_SETTINGS;
  const course = parseTyped(store.get<string>(COURSE_KEY, ''));
  return briefingDays(
    data,
    limitsOf(boat, settings),
    course == null ? null : course % 360,
    keptMeasure(),
  );
}

function boatName(boat: Boat | undefined): string {
  if (!boat) return 'Dufour 445 Grand Large (bateau de référence, 13,6 m)';
  const loa = boatLength(boat.info);
  return `${boat.info.boat || 'Bateau sans nom'}${boat.info.model ? ` (${boat.info.model})` : ''}${loa ? `, ${fr(loa, 1)} m` : ''}`;
}

/**
 * The go / no-go of the next days at the point (the zone chosen with NavIn,
 * else the GPS), for the boat of the cruise in progress, else the boat chosen
 * in the list: a light per day with its reasons and its sentences, by rules
 * and without AI. At sea, a measure typed corrects the next 6 hours. The
 * page shares itself, writes a prompt for any AI, and keeps a packet for
 * offline (complete and ultra-light).
 * @returns The block.
 */
export function GoNoGo() {
  useSignals();
  const tr = useTr();
  const boats = state.data.boats.value;
  const fromCruise = cruiseBoat();
  const [chosen, setChosen] = useState(() => store.get<string>(BOAT_KEY, ''));
  const boat = fromCruise ?? (chosen === REF ? undefined : boatById(chosen));
  // The reference boat only while NavIn has no boat of its own.
  const asking = !fromCruise && !boat && (chosen !== REF || boats.length > 0);
  const boatKey = boat?.id ?? REF;
  const [profiles, setProfiles] = useState(() =>
    store.get<Record<string, Settings>>(PROFILES_KEY, {}),
  );
  const settings = profiles[boatKey] ?? DEFAULT_SETTINGS;
  const limits = limitsOf(boat, settings);
  const setSettings = (next: Partial<Settings>) => {
    buzz();
    const all = { ...profiles, [boatKey]: { ...settings, ...next } };
    store.set(PROFILES_KEY, all);
    setProfiles(all);
  };
  const [course, setCourse] = useState(() => store.get<string>(COURSE_KEY, ''));
  const courseDeg = parseTyped(course);
  const [point] = useState(() => scalePoint(null));
  const lake = point.kind === 'zone-lake' || inInland(point);
  const routes = state.data.routes.value.toSorted((a, b) =>
    b.mod.localeCompare(a.mod),
  );
  const [routeId, setRouteId] = useState(() =>
    store.get<string>(ROUTE_KEY, ''),
  );
  const route = routes.find((one) => one.id === routeId);
  const [plans, setPlans] = useState(() =>
    store.get<Record<string, RoutePlan>>(PLANS_KEY, {}),
  );
  const plan = route ? planOf(route, plans) : null;
  const setPlan = (next: Partial<RoutePlan>) => {
    if (!route || !plan) return;
    const all = { ...plans, [route.id]: { ...plan, ...next } };
    store.set(PLANS_KEY, all);
    setPlans(all);
  };
  const routeRead = useRouteForecast(route);
  const [read, setRead] = useState<
    { data: BriefingData | null; live: boolean } | 'reading'
  >('reading');
  const [packets, setPackets] = useState<Packets>(keptPackets);
  useEffect(() => {
    let closed = false;
    void readBriefing(point, lake)
      .catch(() => null)
      .then((data) => {
        if (closed) return;
        if (data) {
          setRead({ data, live: true });
          return;
        }
        // Offline: the packet kept, the full one else the light one.
        const kept = keptPackets();
        setRead({ data: kept.full ?? kept.light, live: false });
      });
    return () => {
      closed = true;
    };
  }, [point, lake]);
  const [measure, setMeasure] = useState<SeaMeasure | null>(keptMeasure);
  const data = read === 'reading' ? null : read.data;
  const days = data
    ? briefingDays(
        data,
        limits,
        courseDeg == null ? null : courseDeg % 360,
        measure,
      )
    : [];
  const departMs = plan ? new Date(plan.depart).getTime() : Number.NaN;
  const routingBoat = routingBoatOf(boat);
  let trackNote: string | null = null;
  let onRoute: RouteBriefing | { error: string } | null = null;
  if (route && plan && routeRead !== 'reading') {
    if (!routeRead) {
      onRoute = {
        error:
          'Pas de prévision le long de la route : hors réseau et rien de gardé pour cette route, ou Open-Meteo refuse pour l’instant.',
      };
    } else if (Number.isFinite(departMs)) {
      const { track, note } = routeTrack(
        route.points,
        departMs,
        routeRead.forecast,
        routingBoat,
        plan.speed,
      );
      trackNote = note;
      onRoute = routeBriefing(
        route.points,
        track,
        routeRead.forecast,
        limits,
        measure,
      );
    } else {
      onRoute = { error: 'Indiquez l’heure de départ.' };
    }
  }
  const boatWords = `${boatName(boat)} · ${limitsWords(limits)}`;
  return (
    <div className="gng" data-gng="page">
      <p className="bd-point" data-gng-point={point.kind}>
        {tr(`📍 ${point.name}`)}
      </p>
      {asking ? (
        <BoatChooser
          boats={boats}
          onChoose={(id) => {
            buzz();
            store.set(BOAT_KEY, id);
            setChosen(id);
          }}
        />
      ) : (
        <section className="gng-boat" data-gng="boat">
          <p>
            <b>{tr(`⛵ ${boatName(boat)}`)}</b>
            <small>
              {tr(
                fromCruise
                  ? 'bateau de la croisière en cours'
                  : boat
                    ? 'choisi dans la liste des bateaux'
                    : 'seuils de référence, à corriger',
              )}
            </small>
          </p>
          {fromCruise ? null : (
            <Button
              className="btn"
              data-gng="change-boat"
              onClick={() => {
                buzz();
                store.set(BOAT_KEY, '');
                setChosen('');
              }}
            >
              {tr('Changer de bateau')}
            </Button>
          )}
          <div className="gng-settings">
            <div className="gng-chips" role="group" aria-label={tr('Équipage')}>
              <Button
                className={settings.smallCrew ? 'btn on' : 'btn'}
                aria-pressed={settings.smallCrew}
                data-gng="crew"
                onClick={() => setSettings({ smallCrew: !settings.smallCrew })}
              >
                {tr('Équipage réduit')}
              </Button>
            </div>
            <RouteChooser
              routes={routes}
              route={route}
              plan={plan}
              routing={routingBoat}
              onRoute={(id) => {
                buzz();
                store.set(ROUTE_KEY, id);
                setRouteId(id);
              }}
              onPlan={setPlan}
            />
            {route ? null : (
              <label className="gng-course">
                {tr('Cap prévu (°), pour l’allure ; vide : au près')}
                <input
                  className="text"
                  inputMode="numeric"
                  value={course}
                  onChange={(event) => {
                    setCourse(event.target.value);
                    store.set(COURSE_KEY, event.target.value);
                  }}
                />
              </label>
            )}
          </div>
        </section>
      )}
      {!asking && route ? (
        <RouteBlock
          name={route.name}
          briefing={onRoute}
          reading={routeRead === 'reading'}
          note={trackNote}
          keptAt={
            routeRead && routeRead !== 'reading' && !routeRead.live
              ? (routeRead.forecast.data[0]?.at ?? null)
              : null
          }
        />
      ) : null}
      {asking ? null : read === 'reading' ? (
        <p className="bd-how">{tr('Lecture de la prévision au point…')}</p>
      ) : data ? (
        <>
          {read.live ? null : (
            <p className="fx-draft" role="status">
              {tr(
                `Hors réseau : paquet ${data.light ? 'ultra-léger' : 'complet'} du ${new Date(data.at).toLocaleString('fr-CH', shownTimeOptions({ weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}.`,
              )}
            </p>
          )}
          {measure ? (
            <p className="gng-corrected" data-gng="corrected">
              {tr(
                `Corrigé d’après votre saisie de ${new Date(measure.t).toLocaleTimeString('fr-CH', shownTimeOptions({ hour: '2-digit', minute: '2-digit' })).replace(':', ' h ')}${utcMark()} (s’efface sur 6 h).`,
              )}
            </p>
          ) : null}
          {route ? (
            <h3 className="gng-at-point" data-gng="at-point">
              {tr(`Au point ${point.name}, jours suivants`)}
            </h3>
          ) : null}
          <Overview days={days} />
          {days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
          <SeaCorrection
            data={data}
            measure={measure}
            onMeasure={(next) => {
              keepMeasure(next);
              setMeasure(next);
            }}
          />
          <div className="gng-actions">
            <AiPrompt
              text={
                promptOf(data, days, boatWords) +
                (route && onRoute && !('error' in onRoute)
                  ? routePrompt(route.name, onRoute)
                  : '')
              }
            />
            <Button
              className="btn"
              data-gng="packet"
              onClick={() => {
                buzz();
                if (!read.live) {
                  toast('Hors réseau : le paquet gardé est celui affiché');
                  return;
                }
                setPackets(keepPackets(data));
                toast('Paquet gardé pour la consultation hors ligne');
              }}
            >
              {tr('📥 Garder pour hors ligne')}
            </Button>
          </div>
          <PacketState packets={packets} />
          <ThresholdTable limits={limits} />
          <HelpText>
            {`Prévision ${data.src}, vagues Open-Meteo, lue le ${new Date(data.at).toLocaleString('fr-CH', shownTimeOptions())}. Fenêtre de navigation ${WINDOW.from} h à ${WINDOW.to} h${showsUtc() ? ', heure locale' : ''}. Règles sans IA : un critère compte s’il est dépassé 2 heures de suite ; le feu du jour est le pire ; deux critères orange en même temps donnent rouge ; une rafale orange ne compte que 12 nœuds au-dessus du vent moyen (toujours pour un multicoque). Seuils du Dufour 445 GL décalés selon la longueur (−6 nœuds et −1 m sous 8 m, −3 et −0,5 de 8 à 11 m, +3 et +0,5 au-delà de 14 m), plafonnés par la catégorie CE ; catégorie CE et type (monocoque, multicoque, dériveur) lus dans la fiche du bateau, Données techniques ; quel que soit le bateau, no-go dès ${NOGO_WIND_MAX} nœuds de vent moyen, sous force 7 ; équipage réduit : −3 nœuds et −0,5 m. Ce sont des valeurs de départ, à corriger. Toujours lire le bulletin côtier, le BMS en cours et la vigilance.`}
          </HelpText>
          <ShareButton
            data-gng="share"
            onShare={(format) => {
              void shareBriefing(
                data,
                days,
                boatWords,
                format,
                route && onRoute && !('error' in onRoute)
                  ? { name: route.name, briefing: onRoute }
                  : null,
              );
            }}
          />
        </>
      ) : (
        <p className="fx-draft" role="status">
          {tr(
            'Pas de prévision : hors réseau et aucun paquet gardé. Gardez le paquet avant de partir (bouton « Garder pour hors ligne »).',
          )}
        </p>
      )}
    </div>
  );
}

/** The forecast of a route: read now, or kept for offline. */
interface RouteRead {
  forecast: RouteForecast;
  live: boolean;
}

/**
 * The forecast along a route, read again when its points change, kept for
 * offline at each reading; offline, the one kept.
 * @param route - The route, or undefined.
 * @returns The forecast, null without, or 'reading'.
 */
function useRouteForecast(
  route: NavRoute | undefined,
): RouteRead | null | 'reading' {
  const [read, setRead] = useState<{
    key: string;
    found: RouteRead | null;
  } | null>(null);
  const key = route ? JSON.stringify([route.id, route.points]) : '';
  useEffect(() => {
    if (!key) return undefined;
    let closed = false;
    const [id, points] = JSON.parse(key) as [string, NavRoute['points']];
    const first = points[0];
    const lake = first ? inInland(first) : false;
    void readRouteForecast(points, lake)
      .catch(() => null)
      .then((forecast) => {
        if (closed) return;
        if (forecast) {
          keepRoutePacket(id, points, forecast);
          setRead({ key, found: { forecast, live: true } });
          return;
        }
        const kept = keptRouteForecast(id, points);
        setRead({ key, found: kept ? { forecast: kept, live: false } : null });
      });
    return () => {
      closed = true;
    };
  }, [key]);
  if (!key) return null;
  return read?.key === key ? read.found : 'reading';
}

/**
 * The polar and the motor of a boat for the routing: its polar (better, its
 * real polars), the motor of the routing settings; null without a polar.
 * @param boat - The boat, or undefined (the reference one).
 * @returns What the routing needs, or null.
 */
function routingBoatOf(boat: Boat | undefined): RoutingBoat | null {
  const polar = isBoatPolar(boat?.polar) ? boat.polar : null;
  if (!boat || !polar) return null;
  const reals = Array.isArray(boat.realPolars)
    ? boat.realPolars.filter(isRealPolar)
    : [];
  const prefs = routingPrefs();
  return {
    polar: polar.polar,
    sailSpeed: boatSailSpeed(polar, reals),
    motorBelow: prefs.motorBelow,
    motorKn: prefs.motorKn,
  };
}

/**
 * The route planned: one of the routes kept in NavIn, with its departure
 * and its speed (hence the time to sail it).
 * @param props - The routes and the choice.
 * @param props.routes - The routes kept.
 * @param props.route - The route chosen, or undefined.
 * @param props.plan - Its departure and speed.
 * @param props.routing - The polar and motor of the boat, or null.
 * @param props.onRoute - Choose a route by its id ('' : none).
 * @param props.onPlan - Change the departure or the speed.
 * @returns The block.
 */
function RouteChooser({
  routes,
  route,
  plan,
  routing,
  onRoute,
  onPlan,
}: {
  routes: readonly NavRoute[];
  route: NavRoute | undefined;
  plan: RoutePlan | null;
  routing: RoutingBoat | null;
  onRoute: (id: string) => void;
  onPlan: (plan: Partial<RoutePlan>) => void;
}) {
  const tr = useTr();
  // The speed as typed (« 6, » on the way to « 6,5 »), again per route.
  const [typed, setTyped] = useState({ id: '', text: '' });
  const speedText =
    typed.id !== '' && route?.id === typed.id
      ? typed.text
      : fr(plan?.speed ?? 0, 1);
  const setSpeedText = (text: string) =>
    setTyped({ id: route?.id ?? '', text });
  return (
    <div className="gng-route" data-gng="route">
      <label>
        {tr('Routage prévu')}
        <select
          className="text"
          data-gng="route-select"
          value={route?.id ?? ''}
          onChange={(event) => onRoute(event.target.value)}
        >
          <option value="">{tr('Aucun : météo au point de la zone')}</option>
          {routes.map((one) => (
            <option key={one.id} value={one.id}>
              {tr(`${one.name} · ${fr(routeNm(one.points), 1)} NM`)}
            </option>
          ))}
        </select>
      </label>
      {routes.length === 0 ? (
        <small className="bd-how">
          {tr('Aucune route enregistrée : dessinez-en une dans Routes.')}
        </small>
      ) : null}
      {route && plan ? (
        <div className="bd-fields">
          <div className="bd-field">
            <label htmlFor="gng-depart">{tr('Départ prévu')}</label>
            <input
              className="text"
              id="gng-depart"
              type="datetime-local"
              data-gng="route-depart"
              // Kept in the time of the device, shown and typed in UTC when
              // the clock shows UTC.
              value={toLocalInput(new Date(plan.depart))}
              onChange={(event) => {
                const typed = fromLocalInput(event.target.value);
                onPlan({
                  depart: Number.isFinite(typed)
                    ? localInput(typed)
                    : event.target.value,
                });
              }}
            />
          </div>
          {routing ? (
            <p className="bd-how" data-gng="route-routing">
              {tr(
                `Durée : routage polaire du bateau avec le vent, les vagues et les courants prévus, moteur sous ${fr(routing.motorBelow, 1)} nd à ${fr(routing.motorKn, 1)} nd (réglages de Routes › Routage météo).`,
              )}
            </p>
          ) : null}
          <div className="bd-field">
            <label htmlFor="gng-speed">
              {tr(
                routing
                  ? 'Vitesse prévue (nd), si le routage manque de vent'
                  : 'Vitesse prévue (nd)',
              )}
            </label>
            <input
              className="text"
              id="gng-speed"
              inputMode="decimal"
              data-gng="route-speed"
              value={speedText}
              onChange={(event) => {
                setSpeedText(event.target.value);
                const speed = parseTyped(event.target.value);
                if (speed != null && speed > 0) onPlan({ speed });
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The go / no-go along the route: its light, its reasons, its sentences and
 * its legs (units at top and bottom).
 * @param props - The route.
 * @param props.name - Its name.
 * @param props.briefing - The briefing, or why there is none.
 * @param props.reading - Still reading.
 * @param props.note - Why the planned speed rather than the routing, or null.
 * @param props.keptAt - Offline: when the forecast kept was read, else null.
 * @returns The block.
 */
function RouteBlock({
  name,
  briefing,
  reading,
  note,
  keptAt,
}: {
  name: string;
  briefing: RouteBriefing | { error: string } | null;
  reading: boolean;
  note: string | null;
  keptAt: number | null;
}) {
  const tr = useTr();
  if (reading || !briefing) {
    return (
      <p className="bd-how" data-gng="route-reading">
        {tr('Lecture de la prévision le long de la route…')}
      </p>
    );
  }
  if ('error' in briefing) {
    return (
      <p className="fx-draft" role="status" data-gng="route-error">
        {tr(briefing.error)}
      </p>
    );
  }
  const { light, reasons, isolated } = briefing.verdict;
  return (
    <section className={`gng-day gng-${light}`} data-gng="route-block">
      <h3>
        {tr(`${LIGHTS[light].sign} Route ${name} : ${LIGHTS[light].word}`)}
      </h3>
      {keptAt == null ? null : (
        <p className="fx-draft" role="status" data-gng="route-offline">
          {tr(
            `Hors réseau : prévision de la route gardée du ${new Date(keptAt).toLocaleString('fr-CH', shownTimeOptions({ weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}.`,
          )}
        </p>
      )}
      {note ? (
        <p className="bd-how" data-gng="route-note">
          {tr(note)}
        </p>
      ) : null}
      {reasons.length > 0 ? (
        <p className="gng-why">{tr(`Pourquoi : ${reasons.join(' ; ')}.`)}</p>
      ) : null}
      <ul>
        {briefing.lines.map((line) => (
          <li key={line}>{tr(line)}</li>
        ))}
        {isolated.map((line) => (
          <li key={line} className="gng-isolated">
            {tr(`À noter : ${line}.`)}
          </li>
        ))}
      </ul>
      <h4>{tr('Bord par bord')}</h4>
      <ul className="gng-legs" data-gng="route-legs">
        {briefing.legs.map((leg) => (
          <li key={leg.leg} data-gng-leg={leg.leg}>
            {tr(`${LIGHTS[leg.light].sign} ${legWords(leg, briefing.offset)}`)}
          </li>
        ))}
      </ul>
      <p className="bd-how">
        {tr(
          `Prévision ${briefing.src} et vagues Open-Meteo en plusieurs points le long de la route, lue le ${new Date(briefing.at).toLocaleString('fr-CH', shownTimeOptions())}. Chaque heure, le bateau est placé là où le routage polaire le met (vent, vagues et courants prévus, virements et empannages, moteur sous le seuil), sinon à la vitesse prévue ; l’allure vient du cap tenu et du vent de l’heure. Courants du modèle de mer d’Open-Meteo, côté Atlantique et dans les détroits connus de Méditerranée ; vent contre courant : orange dès ${TIDE_RULES.against.orange[0]} nd de courant et ${TIDE_RULES.against.orange[1]} nd de vent, rouge dès ${TIDE_RULES.against.red[0]} nd et ${TIDE_RULES.against.red[1]} nd, courant seul de ${TIDE_RULES.strong} nd ou plus orange (valeurs de départ, à corriger). Mêmes règles qu’au point, sans fenêtre 8 h – 18 h : toutes les heures de la route comptent. La prévision de la route est gardée pour hors ligne à chaque lecture (4 routes au plus).`,
        )}
      </p>
    </section>
  );
}

function limitsWords(limits: Thresholds): string {
  return `vent au près ${limits.wind.pres[0]}/${limits.wind.pres[1]} nd, rafales ${limits.gust.pres[0]}/${limits.gust.pres[1]} nd, Hs ${fr(limits.hs[0], 1)}/${fr(limits.hs[1], 1)} m (orange/rouge)${limits.cap ? `, catégorie CE : ${limits.cap.windKn} nd et ${fr(limits.cap.hs, 1)} m au plus` : ''}`;
}

/**
 * Out of a cruise, the boat is chosen in the list of the boats of NavIn.
 * @param props - The boats and the choice.
 * @param props.boats - The boats.
 * @param props.onChoose - Choose one (its id, or the reference boat).
 * @returns The block.
 */
function BoatChooser({
  boats,
  onChoose,
}: {
  boats: readonly Boat[];
  onChoose: (id: string) => void;
}) {
  const tr = useTr();
  return (
    <section className="gng-choose" data-gng="choose">
      <h2>{tr('Pour quel bateau ?')}</h2>
      <p className="bd-how">
        {tr(
          'Aucune croisière en cours : choisissez le bateau, ses seuils en dépendent.',
        )}
      </p>
      {boats.map((one) => (
        <Button
          key={one.id}
          className="btn big"
          data-gng-boat={one.id}
          onClick={() => onChoose(one.id)}
        >
          {tr(`⛵ ${boatName(one)}`)}
        </Button>
      ))}
      {boats.length === 0 ? (
        // No boat in NavIn yet: the reference one, until one is added.
        <Button
          className="btn"
          data-gng-boat={REF}
          onClick={() => onChoose(REF)}
        >
          {tr('Aucun bateau dans NavIn : seuils du Dufour 445 Grand Large')}
        </Button>
      ) : null}
    </section>
  );
}

/**
 * The days at a glance: light, Beaufort / Douglas, wind and gusts.
 * @param props - The days.
 * @param props.days - The days.
 * @returns The table.
 */
function Overview({ days }: { days: readonly BriefingDay[] }) {
  const tr = useTr();
  const head = (
    <tr>
      <th>{tr('Jour')}</th>
      <th>{tr('Feu')}</th>
      <th>{tr('B / D')}</th>
      <th>{tr('Vent / rafales (nd)')}</th>
    </tr>
  );
  return (
    <table className="bd-cmp-tbl gng-tbl" data-gng="overview">
      <thead>{head}</thead>
      <tbody>
        {days.map((day) => (
          <tr key={day.date}>
            <td>
              {tr(
                `${dayName(day.date)}${day.rank === 0 ? ' (J0)' : ` (J${day.rank})`}`,
              )}
            </td>
            <td>{LIGHTS[day.verdict.light].sign}</td>
            <td>{`${day.force ?? '–'}/${day.degree ?? '–'}`}</td>
            <td>
              {`${day.windMax == null ? '–' : Math.round(day.windMax)}/${day.gustMax == null ? '–' : Math.round(day.gustMax)}`}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>{head}</tfoot>
    </table>
  );
}

/**
 * One day: its light, its reasons, its sentences.
 * @param props - The day.
 * @param props.day - The day.
 * @returns The card.
 */
function DayCard({ day }: { day: BriefingDay }) {
  const tr = useTr();
  const { light, reasons, isolated } = day.verdict;
  return (
    <section className={`gng-day gng-${light}`} data-gng-day={day.rank}>
      <h3>
        {tr(
          `${LIGHTS[light].sign} ${dayName(day.date)} (J${day.rank}) : ${LIGHTS[light].word}`,
        )}
      </h3>
      {reasons.length > 0 ? (
        <p className="gng-why">{tr(`Pourquoi : ${reasons.join(' ; ')}.`)}</p>
      ) : null}
      <ul>
        {day.lines.map((line) => (
          <li key={line}>{tr(line)}</li>
        ))}
        {isolated.map((line) => (
          <li key={line} className="gng-isolated">
            {tr(`À noter : ${line}.`)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * At sea: the wind and the sea measured, typed in a few seconds, correct the
 * forecast of the next hours (fully now, nothing after 6 h).
 * @param props - The data and the measure.
 * @param props.data - The forecast.
 * @param props.measure - The measure kept, or null.
 * @param props.onMeasure - Keep a new one, or clear it.
 * @returns The block.
 */
function SeaCorrection({
  data,
  measure,
  onMeasure,
}: {
  data: BriefingData;
  measure: SeaMeasure | null;
  onMeasure: (measure: SeaMeasure | null) => void;
}) {
  const tr = useTr();
  const [wind, setWind] = useState('');
  const [from, setFrom] = useState('');
  const [hs, setHs] = useState('');
  const [now] = useState(() => Date.now());
  let index = 0;
  for (const [at, time] of data.t.entries()) {
    if (Math.abs(time - now) < Math.abs((data.t[index] ?? 0) - now)) index = at;
  }
  const model = (name: string) => data.v[name]?.[index] ?? null;
  const modelWind = model('wind_speed_10m');
  const modelFrom = model('wind_direction_10m');
  const modelHs = model('wave_height');
  return (
    <section className="gng-sea" data-gng="correct">
      <h3>{tr('🧭 En mer : corriger avec vos mesures')}</h3>
      <p className="bd-how">
        {tr(
          `Prévu maintenant : ${modelWind == null ? '–' : Math.round(modelWind)} nd${modelFrom == null ? '' : ` du ${compassPoint(modelFrom)}`}${modelHs == null ? '' : `, Hs ${fr(modelHs, 1)} m`}. Saisissez ce que vous mesurez : l’écart s’applique en plein maintenant et s’efface sur 6 h.`,
        )}
      </p>
      <div className="bd-fields">
        <Measure
          id="gng-wind"
          label="Vent réel (nd)"
          value={wind}
          onChange={setWind}
        />
        <Measure
          id="gng-from"
          label="Vient du (°)"
          value={from}
          onChange={setFrom}
        />
        <Measure
          id="gng-hs"
          label="Vagues Hs (m)"
          value={hs}
          onChange={setHs}
        />
      </div>
      <div className="gng-actions">
        <Button
          className="btn primary"
          data-gng="apply"
          onClick={() => {
            buzz();
            const next: SeaMeasure = {
              t: Date.now(),
              windKn: parseTyped(wind),
              windFrom: parseTyped(from),
              hs: parseTyped(hs),
            };
            if (
              next.windKn == null &&
              next.windFrom == null &&
              next.hs == null
            ) {
              toast('Saisissez au moins le vent ou la mer');
              return;
            }
            onMeasure(next);
          }}
        >
          {tr('Corriger la prévision')}
        </Button>
        {measure ? (
          <Button
            className="btn"
            data-gng="clear"
            onClick={() => {
              buzz();
              onMeasure(null);
            }}
          >
            {tr('Revenir à la prévision')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function Measure({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const tr = useTr();
  return (
    <div className="bd-field">
      <label htmlFor={id}>{tr(label)}</label>
      <input
        className="text"
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** The free AIs the prompt can open in, with its text when they take it. */
const AIS: ReadonlyArray<readonly [string, (text: string) => string]> = [
  ['ChatGPT', (text) => `https://chatgpt.com/?q=${encodeURIComponent(text)}`],
  ['Claude', (text) => `https://claude.ai/new?q=${encodeURIComponent(text)}`],
  [
    'Le Chat (Mistral)',
    (text) => `https://chat.mistral.ai/chat?q=${encodeURIComponent(text)}`,
  ],
  ['Gemini', () => 'https://gemini.google.com/app'],
];

/**
 * The prompt for a counter-analysis by any AI: copied, and opened in the AI
 * chosen (Gemini: pasted by hand).
 * @param props - The text.
 * @param props.text - The prompt.
 * @returns The block.
 */
function AiPrompt({ text }: { text: string }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Prompt copié');
    } catch {
      toast('Copie impossible : sélectionnez le texte');
    }
  };
  return (
    <>
      <Button
        className="btn"
        data-gng="prompt"
        onClick={() => {
          buzz();
          setOpen(!open);
          void copy();
        }}
      >
        {tr('🤖 Prompt pour une IA')}
      </Button>
      {open ? (
        <div className="gng-prompt" data-gng="prompt-box">
          <p className="bd-how">
            {tr(
              'Copié. Ouvrez une IA gratuite (le texte y est déjà, sauf Gemini où il se colle), pour une contre-analyse de t, J1, J2, J3 :',
            )}
          </p>
          <div className="gng-actions">
            {AIS.map(([name, url]) => (
              <a
                key={name}
                className="btn"
                href={url(text)}
                target="_blank"
                rel="noreferrer"
              >
                {name}
              </a>
            ))}
            {typeof navigator.share === 'function' ? (
              <Button
                className="btn"
                onClick={() => {
                  void navigator.share({ text }).catch(() => undefined);
                }}
              >
                {tr('Autre app…')}
              </Button>
            ) : null}
          </div>
          <textarea
            className="text gng-prompt-text"
            readOnly
            value={text}
            rows={8}
          />
        </div>
      ) : null}
    </>
  );
}

function packetWhen(data: BriefingData | null): string {
  return data
    ? new Date(data.at).toLocaleString(
        'fr-CH',
        shownTimeOptions({
          weekday: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    : '';
}

function PacketState({ packets }: { packets: Packets }) {
  const tr = useTr();
  return (
    <p className="bd-how" data-gng="packets">
      {tr(
        packets.full || packets.light
          ? `Hors ligne : ${packets.full ? `paquet complet du ${packetWhen(packets.full)} (${Math.ceil(packets.fullBytes / 1024)} Ko)` : 'pas de paquet complet'} ; ${packets.light ? `ultra-léger (toutes les 3 h sur 72 h) ${Math.ceil(packets.lightBytes / 1024)} Ko` : 'pas d’ultra-léger'}.`
          : 'Hors ligne : aucun paquet gardé. L’ultra-léger (quelques Ko) est gardé en premier, puis le complet.',
      )}
    </p>
  );
}

/**
 * The thresholds of the boat, units at top and bottom.
 * @param props - The thresholds.
 * @param props.limits - The thresholds.
 * @returns The table.
 */
function ThresholdTable({ limits }: { limits: Thresholds }) {
  const tr = useTr();
  const rows: Array<[string, string, string, string]> = [
    [
      'Vent moyen au près',
      'nd',
      `≥ ${limits.wind.pres[0]}`,
      `≥ ${limits.wind.pres[1]}`,
    ],
    [
      'Vent moyen au travers',
      'nd',
      `≥ ${limits.wind.travers[0]}`,
      `≥ ${limits.wind.travers[1]}`,
    ],
    [
      'Vent moyen au portant',
      'nd',
      `≥ ${limits.wind.portant[0]}`,
      `≥ ${limits.wind.portant[1]}`,
    ],
    [
      'Rafales (près, travers)',
      'nd',
      `≥ ${limits.gust.pres[0]}`,
      `≥ ${limits.gust.pres[1]}`,
    ],
    [
      'Rafales (portant)',
      'nd',
      `≥ ${limits.gust.portant[0]}`,
      `≥ ${limits.gust.portant[1]}`,
    ],
    ['Hauteur Hs', 'm', `≥ ${fr(limits.hs[0], 1)}`, `≥ ${fr(limits.hs[1], 1)}`],
    [
      'Mer courte (période < 6 s)',
      'm',
      `≥ ${fr(limits.shortHs[0], 1)}`,
      `≥ ${fr(limits.shortHs[1], 1)}`,
    ],
    ['CAPE (CIN faible)', 'J/kg', `≥ ${limits.cape[0]}`, `≥ ${limits.cape[1]}`],
    [
      'Chute de pression en 3 h',
      'hPa',
      `≥ ${limits.fall[0]}`,
      `≥ ${limits.fall[1]}`,
    ],
  ];
  if (limits.cap) {
    rows.push(
      ['Limite CE : vent', 'nd', '', `> ${limits.cap.windKn}`],
      ['Limite CE : Hs', 'm', '', `> ${fr(limits.cap.hs, 1)}`],
    );
  }
  const head = (
    <tr>
      <th>{tr('Critère')}</th>
      <th>{tr('Unité')}</th>
      <th>{tr('🟠')}</th>
      <th>{tr('🔴')}</th>
    </tr>
  );
  return (
    <details className="gng-limits">
      <summary>{tr('Seuils de ce bateau')}</summary>
      <table className="bd-cmp-tbl" data-gng="limits">
        <thead>{head}</thead>
        <tbody>
          {rows.map(([label, unit, orange, red]) => (
            <tr key={label}>
              <td>{tr(label)}</td>
              <td>{tr(unit)}</td>
              <td>{orange}</td>
              <td>{red}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>{head}</tfoot>
      </table>
      <p className="bd-how">
        {tr(
          `Référence Dufour 445 GL : vent au près ${REFERENCE.wind.pres.join(' / ')} nd, Hs ${REFERENCE.hs.map((value) => fr(value, 1)).join(' / ')} m. Mer du vent raide (≥ 1/25) orange, critique (≥ 1/12) rouge, si elle dépasse 1 m ; mer croisée à 45°–135° : deux trains ≥ 1 m orange, ≥ 2 m rouge.`,
        )}
      </p>
    </details>
  );
}

/**
 * Share the briefing as an image or a PDF.
 * @param data - The forecast.
 * @param days - The days.
 * @param boat - The words of the boat.
 * @param format - Image or PDF.
 */
async function shareBriefing(
  data: BriefingData,
  days: readonly BriefingDay[],
  boat: string,
  format: ShareFormat,
  onRoute: { name: string; briefing: RouteBriefing } | null,
): Promise<void> {
  const routeSections = onRoute
    ? [
        {
          title: `${LIGHTS[onRoute.briefing.verdict.light].sign} Route ${onRoute.name} : ${LIGHTS[onRoute.briefing.verdict.light].word}`,
          rows: [
            ...(onRoute.briefing.verdict.reasons.length > 0
              ? [
                  [
                    'Pourquoi',
                    onRoute.briefing.verdict.reasons.join(' ; '),
                  ] as [string, string],
                ]
              : []),
            ...onRoute.briefing.lines.map((line, index): [string, string] => [
              index === 0 ? 'Route' : '',
              line,
            ]),
          ],
        },
      ]
    : [];
  await shareCards(
    {
      title: `GoNoGo · ${onRoute ? onRoute.name : data.name}`,
      kicker: 'Briefing météo',
      sub: boat,
      sections: [
        ...routeSections,
        ...days.map((day) => ({
          title: `${LIGHTS[day.verdict.light].sign} ${dayName(day.date)} : ${LIGHTS[day.verdict.light].word}`,
          rows: [
            ...(day.verdict.reasons.length > 0
              ? [
                  ['Pourquoi', day.verdict.reasons.join(' ; ')] as [
                    string,
                    string,
                  ],
                ]
              : []),
            ...day.lines.map((line, index): [string, string] => [
              index === 0 ? 'Prévision' : '',
              line,
            ]),
          ],
        })),
      ],
      photos: [],
      photosTitle: '',
    },
    `NavIn-briefing-${data.name.replaceAll(/[^\w-]+/g, '-')}`,
    format,
  );
}

/**
 * The go / no-go in one button, for the forecast page: today's light, or the
 * lights of the next days; touched, the go / no-go page.
 * @param props - The part and the action.
 * @param props.part - Today, or the next days.
 * @param props.onOpen - Open the go / no-go page.
 * @returns The button.
 */
export function GoNoGoLink({
  part,
  onOpen,
}: {
  part: 'today' | 'next';
  onOpen: () => void;
}) {
  const tr = useTr();
  const days = useGoNoGoDays();
  const today = Array.isArray(days) ? days.find((day) => day.rank === 0) : null;
  const next = Array.isArray(days) ? days.filter((day) => day.rank > 0) : [];
  const words =
    days === 'asking'
      ? 'choisissez le bateau pour voir le feu'
      : days === 'reading'
        ? 'lecture de la prévision…'
        : days === null
          ? 'prévision indisponible pour le moment'
          : part === 'today'
            ? today
              ? today.verdict.reasons.join(', ') ||
                `rien au-dessus des seuils de ${WINDOW.from} h à ${WINDOW.to} h`
              : `la fenêtre de ${WINDOW.from} h à ${WINDOW.to} h est passée`
            : next
                .map(
                  (day) =>
                    `${dayName(day.date)} ${LIGHTS[day.verdict.light].sign}`,
                )
                .join(' · ');
  const title =
    part === 'today'
      ? today
        ? `GoNoGo aujourd’hui : ${LIGHTS[today.verdict.light].word}`
        : 'GoNoGo aujourd’hui'
      : 'GoNoGo des jours suivants';
  return (
    <Button
      type="button"
      className="btn page-link"
      data-page-link={part === 'today' ? 'gonogo-today' : 'gonogo'}
      onClick={onOpen}
    >
      <span className="page-link-ico" aria-hidden="true">
        {part === 'today' && today ? LIGHTS[today.verdict.light].sign : '🚦'}
      </span>
      <span className="page-link-txt">
        <b>{tr(title)}</b>
        <small>{tr(words)}</small>
      </span>
      <span className="page-link-go" aria-hidden="true">
        ›
      </span>
    </Button>
  );
}

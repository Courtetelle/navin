import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
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
import { shareCards } from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { compassPoint } from '../../lib/wind.ts';
import { parseTyped } from '../../model/beaufortDouglas.ts';
import { inInland } from '../../model/contacts.ts';
import type {
  BoatKind,
  BoatProfile,
  CeCategory,
  Thresholds,
} from '../../model/goNoGo.ts';
import {
  NOGO_WIND_MAX,
  REFERENCE,
  boatLength,
  thresholdsOf,
} from '../../model/goNoGo.ts';
import type { Boat } from '../../model/recordTypes.ts';
import { boatById, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

const BOAT_KEY = 'navin.gngBoat';
const PROFILES_KEY = 'navin.gngProfiles';
const COURSE_KEY = 'navin.gngCourse';
/** The reference boat, chosen when no boat of the list is. */
const REF = 'ref';

type Settings = Pick<BoatProfile, 'ce' | 'kind' | 'smallCrew'>;
const DEFAULT_SETTINGS: Settings = {
  ce: '',
  kind: 'monocoque',
  smallCrew: false,
};

const fr = (value: number, digits = 0) =>
  (Math.round(value * 10 ** digits) / 10 ** digits)
    .toString()
    .replace('.', ',');

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
  const asking = !fromCruise && !boat && chosen !== REF;
  const boatKey = boat?.id ?? REF;
  const [profiles, setProfiles] = useState(() =>
    store.get<Record<string, Settings>>(PROFILES_KEY, {}),
  );
  const settings = profiles[boatKey] ?? DEFAULT_SETTINGS;
  const profile: BoatProfile = {
    loa: boat ? boatLength(boat.info) : 13.6,
    ...settings,
  };
  const limits = thresholdsOf(profile);
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
          <details className="gng-settings">
            <summary>
              {tr(
                `Réglages : catégorie CE ${settings.ce || '?'} · ${settings.kind} · équipage ${settings.smallCrew ? 'réduit' : 'normal'} · cap ${courseDeg == null ? 'non donné (au près)' : `${Math.round(courseDeg)}°`}`,
              )}
            </summary>
            <div
              className="gng-chips"
              role="group"
              aria-label={tr('Catégorie CE')}
            >
              <span>{tr('Catégorie CE')}</span>
              {(['', 'A', 'B', 'C', 'D'] as const).map((ce: CeCategory) => (
                <Button
                  key={ce || 'none'}
                  className={settings.ce === ce ? 'btn on' : 'btn'}
                  aria-pressed={settings.ce === ce}
                  onClick={() => setSettings({ ce })}
                >
                  {ce || '?'}
                </Button>
              ))}
            </div>
            <div className="gng-chips" role="group" aria-label={tr('Type')}>
              {(
                [
                  ['monocoque', 'Monocoque'],
                  ['multicoque', 'Multicoque'],
                  ['deriveur', 'Dériveur'],
                ] as const
              ).map(([kind, label]: readonly [BoatKind, string]) => (
                <Button
                  key={kind}
                  className={settings.kind === kind ? 'btn on' : 'btn'}
                  aria-pressed={settings.kind === kind}
                  onClick={() => setSettings({ kind })}
                >
                  {tr(label)}
                </Button>
              ))}
              <Button
                className={settings.smallCrew ? 'btn on' : 'btn'}
                aria-pressed={settings.smallCrew}
                data-gng="crew"
                onClick={() => setSettings({ smallCrew: !settings.smallCrew })}
              >
                {tr('Équipage réduit')}
              </Button>
            </div>
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
          </details>
        </section>
      )}
      {asking ? null : read === 'reading' ? (
        <p className="bd-how">{tr('Lecture de la prévision au point…')}</p>
      ) : data ? (
        <>
          {read.live ? null : (
            <p className="fx-draft" role="status">
              {tr(
                `Hors réseau : paquet ${data.light ? 'ultra-léger' : 'complet'} du ${new Date(data.at).toLocaleString('fr-CH', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
              )}
            </p>
          )}
          {measure ? (
            <p className="gng-corrected" data-gng="corrected">
              {tr(
                `Corrigé d’après votre saisie de ${new Date(measure.t).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')} (s’efface sur 6 h).`,
              )}
            </p>
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
            <AiPrompt text={promptOf(data, days, boatWords)} />
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
            {`Prévision ${data.src}, vagues Open-Meteo, lue le ${new Date(data.at).toLocaleString('fr-CH')}. Fenêtre de navigation ${WINDOW.from} h à ${WINDOW.to} h. Règles sans IA : un critère compte s’il est dépassé 2 heures de suite ; le feu du jour est le pire ; deux critères orange en même temps donnent rouge ; une rafale orange ne compte que 12 nœuds au-dessus du vent moyen (toujours pour un multicoque). Seuils du Dufour 445 GL décalés selon la longueur (−6 nœuds et −1 m sous 8 m, −3 et −0,5 de 8 à 11 m, +3 et +0,5 au-delà de 14 m), plafonnés par la catégorie CE ; quel que soit le bateau, no-go dès ${NOGO_WIND_MAX} nœuds de vent moyen, sous force 7 ; équipage réduit : −3 nœuds et −0,5 m. Ce sont des valeurs de départ, à corriger. Toujours lire le bulletin côtier, le BMS en cours et la vigilance.`}
          </HelpText>
          <ShareButton
            data-gng="share"
            onShare={(format) => {
              void shareBriefing(data, days, boatWords, format);
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
      <Button className="btn" data-gng-boat={REF} onClick={() => onChoose(REF)}>
        {tr('Bateau de référence : Dufour 445 Grand Large')}
      </Button>
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
    ? new Date(data.at).toLocaleString('fr-CH', {
        weekday: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
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
): Promise<void> {
  await shareCards(
    {
      title: `Go / no-go · ${data.name}`,
      kicker: 'Briefing météo',
      sub: boat,
      sections: days.map((day) => ({
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
      photos: [],
      photosTitle: '',
    },
    `NavIn-briefing-${data.name.replaceAll(/[^\w-]+/g, '-')}`,
    format,
  );
}

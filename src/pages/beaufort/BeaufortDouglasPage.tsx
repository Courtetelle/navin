import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { bdCrossPoint } from '../../features/map/bdPlace.ts';
import type { PointKind, PointSea } from '../../features/onwater/pointSea.ts';
import { readPointSea, scalePoint } from '../../features/onwater/pointSea.ts';
import { steepnessOf } from '../../features/onwater/steepness.ts';
import { ScaleLanguage } from '../../features/safety/ScaleLanguage.tsx';
import { useScaleEnglish } from '../../features/safety/useScaleEnglish.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { bft, compassPoint } from '../../lib/wind.ts';
import type { Combined, ScaleGroup } from '../../model/beaufortDouglas.ts';
import {
  SEA_OF_FORCE,
  assembledReading,
  brokenDownReading,
  combine,
  degreeOfHeight,
  englishHeight,
  groupOfDegree,
  groupOfForce,
  parseTyped,
} from '../../model/beaufortDouglas.ts';
import { inInland } from '../../model/contacts.ts';
import { OPEN_FETCH_KM } from '../../model/fetchWaves.ts';
import { BEAUFORT_TBL, DOUGLAS, DOUGLAS_EN } from '../../model/lists.ts';

/**
 * Screens `beaufort` and `douglas`: the two scales in one table, read
 * together (« B / D » with a colour per kind of conditions), and a tool that
 * combines a wind and a sea, either one corrected by hand.
 * @returns The screen content.
 */
export function BeaufortDouglasPage() {
  const english = useScaleEnglish();
  const tr = useTr();
  return (
    <>
      {/* No back of its own: ◀ goes back where the scale was opened from. */}
      <TitleInNav>
        <h1>
          {tr(english ? '🌬🌊 Beaufort and Douglas' : '🌬🌊 Beaufort et Douglas')}
        </h1>
      </TitleInNav>
      <ScaleLanguage />
      <CombineTool english={english} />
      <ScaleTable english={english} />
      <HelpText>
        {english
          ? 'WMO scales. Wind rounded to the nearest knot (km/h = knots × 1.852); significant wave height (WMO sea state code, table 3700). Each row: the sea this wind raises in open sea, wind established. Near a coast, on a lake or when the wind has just risen, the sea is smaller; swell from elsewhere makes it bigger.'
          : 'Échelles de l’OMM. Vent arrondi au nœud entier (km/h = nœuds × 1,852) ; hauteur des vagues significatives (code de l’état de la mer, table 3700, termes des bulletins Météo-France). Chaque ligne : la mer que ce vent lève en pleine mer, vent établi. Près d’une côte, sur un lac ou quand le vent vient de se lever, la mer est plus petite ; une houle venue d’ailleurs la grossit.'}
      </HelpText>
    </>
  );
}

/**
 * One colour chip: « 5 / 4 », a colour per side when they differ.
 * @param props - The reading.
 * @param props.force - Beaufort force.
 * @param props.degree - Douglas degree.
 * @param props.tail - After the note, the period.
 * @returns The chip.
 */
function BdChip({
  force,
  degree,
  tail = '',
}: {
  force: number;
  degree: number;
  tail?: string;
}) {
  const wind = groupOfForce(force);
  const sea = groupOfDegree(degree);
  return (
    <span className="bd-chip" data-bd={`${force}/${degree}`}>
      <span style={paint(wind)}>{force}</span>
      <span className="bd-slash">/</span>
      <span style={paint(sea)}>{degree}</span>
      {tail ? <span className="bd-tail">{tail}</span> : null}
    </span>
  );
}

function paint(group: ScaleGroup) {
  return { background: group.color, color: group.ink };
}

/**
 * The two scales in one table, a row per Beaufort force with the sea it
 * raises in open sea.
 * @param props - Language.
 * @param props.english - In English.
 * @returns The table.
 */
function ScaleTable({ english }: { english: boolean }) {
  const tr = useTr();
  return (
    <table className="scale-tbl bd-tbl">
      <thead>
        <tr>
          <th>{tr('B / D')}</th>
          <th>{tr(english ? 'Wind (knots)' : 'Vent (nœuds)')}</th>
          <th>
            {tr(english ? 'Sea (wave height)' : 'Mer (hauteur des vagues)')}
          </th>
        </tr>
      </thead>
      <tbody>
        {BEAUFORT_TBL.map(([force, knots, nameFr, nameEn, seaFr, seaEn]) => {
          const degree = SEA_OF_FORCE[force] as number;
          const group = groupOfForce(force);
          const first = group.forces[0] === force;
          const height = DOUGLAS[degree]?.[2] as string;
          const seaName = english
            ? (DOUGLAS_EN[degree] as string)
            : capital(DOUGLAS[degree]?.[1] as string);
          return (
            <tr key={force} className={`bf-${force}`}>
              <td className="sc-n bd-cell">
                <BdChip force={force} degree={degree} />
                {first ? (
                  <small className="bd-group">
                    {tr(english ? group.en : group.fr)}
                  </small>
                ) : null}
              </td>
              <td>
                <b>{tr(english ? nameEn : nameFr)}</b>
                <small className="sc-kn">{tr(knots)}</small>
              </td>
              <td>
                <b>{tr(seaName)}</b>
                <small className="sc-kn">
                  {tr(english ? englishHeight(height) : height)}
                </small>
                <small>{tr(english ? seaEn : seaFr)}</small>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th>{tr('B / D')}</th>
          <th>{tr(english ? 'Wind (knots)' : 'Vent (nœuds)')}</th>
          <th>
            {tr(english ? 'Sea (wave height)' : 'Mer (hauteur des vagues)')}
          </th>
        </tr>
      </tfoot>
    </table>
  );
}

function knotsOf(force: number): string {
  return BEAUFORT_TBL[force]?.[1] ?? '';
}

function capital(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** Where the point comes from, said under the title. */
const POINT_KINDS: Readonly<Record<PointKind, readonly [string, string]>> = {
  cross: ['point de la croix', 'point of the cross'],
  'zone-sea': ['zone mer choisie dans NavIn', 'sea zone chosen in NavIn'],
  'zone-lake': ['zone lac choisie dans NavIn', 'lake zone chosen in NavIn'],
  gps: ['position GPS', 'GPS position'],
  map: ['centre de la carte', 'centre of the map'],
};

const degreeOf = (hs: number) => String(degreeOfHeight(hs));

const one = (value: number) =>
  (Math.round(value * 10) / 10).toString().replace('.', ',');

/**
 * The combining tool at the point considered: the cross when opened from it,
 * else the zone chosen with NavIn, else the GPS. The fields are filled with
 * the wind of the model and the sea of Open-Meteo (on a lake, the sea of the
 * fetch); each can be typed over, emptied (the open-sea theory), and they are
 * filled again each time the page opens.
 * @param props - Language.
 * @param props.english - In English.
 * @returns The tool.
 */
function CombineTool({ english }: { english: boolean }) {
  const tr = useTr();
  const [point] = useState(() => {
    const cross = bdCrossPoint.peek();
    bdCrossPoint.value = null;
    return scalePoint(cross);
  });
  const lake = point.kind === 'zone-lake' || inInland(point);
  const [read, setRead] = useState<PointSea | null | 'reading'>('reading');
  useEffect(() => {
    let closed = false;
    void readPointSea(point, lake)
      .catch(() => null)
      .then((found) => {
        if (!closed) setRead(found);
      });
    return () => {
      closed = true;
    };
  }, [point, lake]);
  const found = read === 'reading' ? null : read;
  // Nothing read at all (no network): as if nothing came.
  const data =
    found && (found.wind || found.sea || found.fetchSea) ? found : null;
  const auto = autoValues(data);
  const [wind, setWind] = useState<string | null>(null);
  const [sea, setSea] = useState<string | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const windText = wind ?? auto.wind;
  const seaText = sea ?? auto.sea;
  const periodText = period ?? auto.period;
  const windKn = parseTyped(windText);
  const waveM = parseTyped(seaText);
  const periodS = parseTyped(periodText);
  const combined = combine({ windKn, waveM, periodS }, bft);
  const windHint =
    combined?.windAuto === true
      ? `${english ? 'theory' : 'théorique'} : ${knotsOf(combined.force)}`
      : '';
  const seaHint =
    combined?.seaAuto === true
      ? `${english ? 'theory' : 'théorique'} : ${DOUGLAS[combined.degree]?.[2] ?? ''}`
      : '';
  const typed = wind !== null || sea !== null || period !== null;
  const [kindFr, kindEn] = POINT_KINDS[point.kind];
  const from = (own: string | null, origin: string) =>
    own === null ? origin : english ? 'typed by hand' : 'saisi à la main';
  return (
    <section className="bd-tool" aria-label={english ? 'Combine' : 'Combiner'}>
      <h2>{tr(english ? 'Read wind and sea together' : 'Lecture combinée')}</h2>
      <p className="bd-point" data-bd-point={point.kind}>
        {tr(`📍 ${point.name} · ${english ? kindEn : kindFr}`)}
      </p>
      <p className="bd-how">
        {tr(
          read === 'reading'
            ? english
              ? 'Reading the wind and the sea at the point…'
              : 'Lecture du vent et de la mer au point…'
            : english
              ? 'Filled with the wind of the model and the sea of Open-Meteo at the point (on a lake, the sea of the fetch). Type over a field to correct it; an empty field is the open-sea theory. Opened again, the page reads the point again.'
              : 'Rempli avec le vent du modèle et la mer d’Open-Meteo au point (sur un lac, la mer calculée par le fetch). Écrivez dans une case pour la corriger ; une case vide est la théorie en pleine mer. Rouverte, la page relit le point.',
        )}
      </p>
      <div className="bd-fields">
        <Field
          id="bd-wind"
          label={english ? '🌬 Wind (knots)' : '🌬 Vent (nœuds)'}
          value={windText}
          hint={windHint}
          origin={windText === '' ? '' : from(wind, auto.windFrom)}
          onChange={setWind}
          clearLabel={english ? 'Back to theory' : 'Revenir à la théorie'}
        />
        <Field
          id="bd-sea"
          label={english ? '🌊 Waves Hs (m)' : '🌊 Vagues Hs (m)'}
          value={seaText}
          hint={seaHint}
          origin={seaText === '' ? '' : from(sea, auto.seaFrom)}
          onChange={setSea}
          clearLabel={english ? 'Back to theory' : 'Revenir à la théorie'}
        />
        <Field
          id="bd-period"
          label={
            english ? '⏱ Period (s), optional' : '⏱ Période (s), facultatif'
          }
          value={periodText}
          hint=""
          origin={periodText === '' ? '' : from(period, auto.seaFrom)}
          onChange={setPeriod}
          clearLabel={english ? 'Clear' : 'Effacer'}
        />
      </div>
      {typed ? (
        <Button
          className="btn bd-reload"
          type="button"
          data-bd="reload"
          onClick={() => {
            buzz();
            setWind(null);
            setSea(null);
            setPeriod(null);
          }}
        >
          {tr(english ? '↺ Data of the point' : '↺ Données du point')}
        </Button>
      ) : null}
      {combined ? (
        <Result
          combined={combined}
          english={english}
          waveM={waveM}
          periodS={periodS}
        />
      ) : null}
      {data ? <Compare data={data} english={english} lake={lake} /> : null}
      {read !== 'reading' && !data ? (
        <p className="bd-how">
          {tr(
            english
              ? 'No data at the point (no network?): type the wind or the sea.'
              : 'Pas de données au point (hors réseau ?) : saisissez le vent ou la mer.',
          )}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The values the fields are filled with, and where they come from.
 * @param data - What was read at the point.
 * @returns The texts.
 */
function autoValues(data: PointSea | null): {
  wind: string;
  sea: string;
  period: string;
  windFrom: string;
  seaFrom: string;
} {
  const wind = data?.wind ? String(Math.round(data.wind.kn)) : '';
  const total = data?.sea?.total;
  if (total) {
    return {
      wind,
      sea: one(total.height),
      period: total.period == null ? '' : one(total.period),
      windFrom: 'modèle',
      seaFrom: 'Open-Meteo',
    };
  }
  const fetched = data?.fetchSea;
  return {
    wind,
    sea: fetched ? one(fetched.hs) : '',
    period: fetched ? one(fetched.period) : '',
    windFrom: 'modèle',
    seaFrom: 'fetch',
  };
}

/**
 * The sea at the point three ways: the model of waves (Open-Meteo), the sea
 * the wind raises over the fetch, the open-sea theory of the wind.
 * @param props - What was read.
 * @param props.data - The reading at the point.
 * @param props.english - In English.
 * @param props.lake - On a lake (no model of waves).
 * @returns The table.
 */
function Compare({
  data,
  english,
  lake,
}: {
  data: PointSea;
  english: boolean;
  lake: boolean;
}) {
  const tr = useTr();
  const { wind, sea, fetch, fetchSea: raised } = data;
  const rows: Array<[string, string, string, string]> = [];
  if (sea) {
    rows.push([
      english ? 'Open-Meteo, whole sea' : 'Open-Meteo, mer totale',
      one(sea.total.height),
      sea.total.period == null ? '–' : one(sea.total.period),
      degreeOf(sea.total.height),
    ]);
    if (sea.windSea) {
      rows.push([
        english ? '  of which wind sea' : '  dont mer du vent',
        one(sea.windSea.height),
        sea.windSea.period == null ? '–' : one(sea.windSea.period),
        degreeOf(sea.windSea.height),
      ]);
    }
    if (sea.swell) {
      rows.push([
        english ? '  of which swell' : '  dont houle',
        one(sea.swell.height),
        sea.swell.period == null ? '–' : one(sea.swell.period),
        degreeOf(sea.swell.height),
      ]);
    }
  } else if (!lake) {
    rows.push([
      english ? 'Open-Meteo (no answer)' : 'Open-Meteo (pas de réponse)',
      '–',
      '–',
      '–',
    ]);
  }
  if (raised) {
    rows.push([
      english ? 'Computed from the fetch' : 'Calculée par le fetch',
      one(raised.hs),
      one(raised.period),
      degreeOf(raised.hs),
    ]);
  }
  if (wind) {
    const force = bft(wind.kn);
    const degree = SEA_OF_FORCE[force] as number;
    rows.push([
      english ? 'Open-sea theory' : 'Théorie pleine mer',
      DOUGLAS[degree]?.[2] ?? '–',
      '–',
      String(degree),
    ]);
  }
  const head = (
    <tr>
      <th>{tr(english ? 'Source' : 'Source')}</th>
      <th>{tr('Hs (m)')}</th>
      <th>{tr(english ? 'Period (s)' : 'Période (s)')}</th>
      <th>{tr('Douglas')}</th>
    </tr>
  );
  return (
    <div className="bd-compare" data-bd="compare">
      <h3>{tr(english ? 'The sea at the point' : 'La mer au point')}</h3>
      {wind ? (
        <p>
          {tr(
            english
              ? `Wind of the model: ${Math.round(wind.kn)} kn from ${compassPoint(wind.from)}${wind.gust == null ? '' : `, gusts ${Math.round(wind.gust)} kn`} (${wind.src}).`
              : `Vent du modèle : ${Math.round(wind.kn)} nœuds du ${compassPoint(wind.from)}${wind.gust == null ? '' : `, rafales ${Math.round(wind.gust)} nœuds`} (${wind.src}).`,
          )}
        </p>
      ) : null}
      {fetch ? (
        <p data-bd="fetch">
          {tr(
            fetch.open
              ? english
                ? `Fetch: more than ${OPEN_FETCH_KM} km of water up the wind: an open-sea wind, the sea can build fully.`
                : `Fetch : plus de ${OPEN_FETCH_KM} km d’eau au vent : vent du large, la mer peut se former entièrement.`
              : english
                ? `Fetch: ${Math.round(fetch.km)} km of water up the wind (${Math.round(fetch.straightKm)} km straight from ${compassPoint(wind?.from ?? 0)}): the length over which this wind raises the waves before the point.`
                : `Fetch : ${Math.round(fetch.km)} km d’eau au vent (${Math.round(fetch.straightKm)} km droit vers le ${compassPoint(wind?.from ?? 0)}) : la longueur sur laquelle ce vent lève les vagues avant le point.`,
          )}
        </p>
      ) : wind ? (
        <p>
          {tr(
            english
              ? 'Fetch: not computed here (point on land, or the coast map is not read).'
              : 'Fetch : pas calculé ici (point à terre, ou carte des côtes non lue).',
          )}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <table className="scale-tbl bd-cmp-tbl">
          <thead>{head}</thead>
          <tbody>
            {rows.map(([label, hs, period, degree]) => (
              <tr key={label}>
                <td className={label.startsWith('  ') ? 'bd-sub' : ''}>
                  {tr(label.trim())}
                </td>
                <td>{tr(hs)}</td>
                <td>{tr(period)}</td>
                <td>{tr(degree)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>{head}</tfoot>
        </table>
      ) : null}
      <p className="keep-help">
        {tr(
          english
            ? 'Open-Meteo: forecast of a model of waves, not a measure; none on the lakes. Fetch: rays every 6° over ±24° around the wind, on the coast map of NavIn (about 500 m; an island narrower than 2 km is not seen). Sea of the fetch: Young and Verhagen (1996), deep water, wind established. A large gap between the model and the fetch: swell from elsewhere, or a wind that has just turned.'
            : 'Open-Meteo : prévision d’un modèle de vagues, pas une mesure ; rien sur les lacs. Fetch : rayons tous les 6° sur ±24° autour du vent, sur la carte des côtes de NavIn (environ 500 m ; une île de moins de 2 km de large n’est pas vue). Mer du fetch : Young et Verhagen (1996), eau profonde, vent établi. Un grand écart entre le modèle et le fetch : une houle venue d’ailleurs, ou un vent qui vient de tourner.',
        )}
      </p>
    </div>
  );
}

/**
 * One field of the tool, with its ✕.
 * @param props - The field.
 * @param props.id - Element id.
 * @param props.label - Label.
 * @param props.value - Text typed.
 * @param props.hint - The theory, shown while empty.
 * @param props.origin - Where the value comes from, under the field.
 * @param props.onChange - New text.
 * @param props.clearLabel - Name of the ✕ button.
 * @returns The field.
 */
function Field({
  id,
  label,
  value,
  hint,
  origin,
  onChange,
  clearLabel,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  origin: string;
  onChange: (value: string) => void;
  clearLabel: string;
}) {
  const tr = useTr();
  return (
    <div className="bd-field">
      <label htmlFor={id}>{tr(label)}</label>
      <div className="bd-input">
        <input
          className="text"
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          placeholder={hint}
          onChange={(event) => onChange(event.target.value)}
        />
        {value === '' ? null : (
          <Button
            className="btn bd-clear"
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              buzz();
              onChange('');
            }}
          >
            ✕
          </Button>
        )}
      </div>
      {origin ? <small className="bd-origin">{tr(origin)}</small> : null}
    </div>
  );
}

/**
 * The result: the chip, the assembled reading, the broken-down one, the
 * steepness with a period.
 * @param props - The reading.
 * @param props.combined - The combination.
 * @param props.english - In English.
 * @param props.waveM - Waves typed, metres.
 * @param props.periodS - Period typed, seconds.
 * @returns The result.
 */
function Result({
  combined,
  english,
  waveM,
  periodS,
}: {
  combined: Combined;
  english: boolean;
  waveM: number | null;
  periodS: number | null;
}) {
  const tr = useTr();
  const height = waveM ?? null;
  const steep = steepnessOf(height, periodS);
  const tail = combined.note.includes('(')
    ? combined.note.slice(combined.note.indexOf('('))
    : '';
  return (
    <div className="bd-result" aria-live="polite">
      <div className="bd-big">
        <BdChip force={combined.force} degree={combined.degree} tail={tail} />
      </div>
      <h3>{tr(english ? 'Assembled' : 'Lecture assemblée')}</h3>
      {assembledReading(combined, english).map((line) => (
        <p key={line}>{tr(line)}</p>
      ))}
      <h3>{tr(english ? 'Broken down' : 'Lecture décomposée')}</h3>
      <ul>
        {brokenDownReading(combined, knotsOf, english).map((line) => (
          <li key={line}>{tr(line)}</li>
        ))}
        {steep ? (
          <li>
            {tr(
              english
                ? `Steepness 1/${steep.oneIn} (wavelength ≈ ${Math.round(steep.length)} m): ${steep.steep.name}${steep.small ? ', waves under 1 m: discomfort rather than danger' : ''}.`
                : `Cambrure 1/${steep.oneIn} (longueur ≈ ${Math.round(steep.length)} m) : ${steep.steep.name}, ${steep.steep.text}${steep.small ? ' ; vagues de moins de 1 m : inconfort plutôt que danger' : ''}.`,
            )}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

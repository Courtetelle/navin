import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { steepnessOf } from '../../features/onwater/steepness.ts';
import { ScaleLanguage } from '../../features/safety/ScaleLanguage.tsx';
import { useScaleEnglish } from '../../features/safety/useScaleEnglish.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { bft } from '../../lib/wind.ts';
import type { Combined, ScaleGroup } from '../../model/beaufortDouglas.ts';
import {
  SEA_OF_FORCE,
  assembledReading,
  brokenDownReading,
  combine,
  englishHeight,
  groupOfDegree,
  groupOfForce,
  parseTyped,
} from '../../model/beaufortDouglas.ts';
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

/**
 * The combining tool: a wind in knots, a sea in metres, a period; the side
 * left empty is the open-sea theory, shown in its field, and either side can
 * be corrected by hand.
 * @param props - Language.
 * @param props.english - In English.
 * @returns The tool.
 */
function CombineTool({ english }: { english: boolean }) {
  const tr = useTr();
  const [wind, setWind] = useState('');
  const [sea, setSea] = useState('');
  const [period, setPeriod] = useState('');
  const windKn = parseTyped(wind);
  const waveM = parseTyped(sea);
  const periodS = parseTyped(period);
  const combined = combine({ windKn, waveM, periodS }, bft);
  const windHint =
    combined?.windAuto === true
      ? `${english ? 'theory' : 'théorique'} : ${knotsOf(combined.force)}`
      : '';
  const seaHint =
    combined?.seaAuto === true
      ? `${english ? 'theory' : 'théorique'} : ${DOUGLAS[combined.degree]?.[2] ?? ''}`
      : '';
  return (
    <section className="bd-tool" aria-label={english ? 'Combine' : 'Combiner'}>
      <h2>{tr(english ? 'Read wind and sea together' : 'Lecture combinée')}</h2>
      <p className="bd-how">
        {tr(
          english
            ? 'Type the wind, the sea, or both. The side left empty is the open-sea theory; type over it to correct it.'
            : 'Saisissez le vent, la mer, ou les deux. Le côté laissé vide est la théorie en pleine mer ; écrivez dessus pour le corriger.',
        )}
      </p>
      <div className="bd-fields">
        <Field
          id="bd-wind"
          label={english ? '🌬 Wind (knots)' : '🌬 Vent (nœuds)'}
          value={wind}
          hint={windHint}
          onChange={setWind}
          clearLabel={english ? 'Back to theory' : 'Revenir à la théorie'}
        />
        <Field
          id="bd-sea"
          label={english ? '🌊 Waves Hs (m)' : '🌊 Vagues Hs (m)'}
          value={sea}
          hint={seaHint}
          onChange={setSea}
          clearLabel={english ? 'Back to theory' : 'Revenir à la théorie'}
        />
        <Field
          id="bd-period"
          label={
            english ? '⏱ Period (s), optional' : '⏱ Période (s), facultatif'
          }
          value={period}
          hint=""
          onChange={setPeriod}
          clearLabel={english ? 'Clear' : 'Effacer'}
        />
      </div>
      {combined ? (
        <Result
          combined={combined}
          english={english}
          waveM={waveM}
          periodS={periodS}
        />
      ) : null}
    </section>
  );
}

/**
 * One field of the tool, with its ✕.
 * @param props - The field.
 * @param props.id - Element id.
 * @param props.label - Label.
 * @param props.value - Text typed.
 * @param props.hint - The theory, shown while empty.
 * @param props.onChange - New text.
 * @param props.clearLabel - Name of the ✕ button.
 * @returns The field.
 */
function Field({
  id,
  label,
  value,
  hint,
  onChange,
  clearLabel,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
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

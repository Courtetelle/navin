import { useSignals } from '@preact/signals-react/runtime';
import type { ComponentType, MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { HelpText } from '../../../components/shared/HelpText.tsx';
import { TzTime } from '../../../components/shared/TzTime.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { fmtDur, fmtTime, fr, stringOf, textOf } from '../../../lib/format.ts';
import type { CalcKind, FieldDefinition } from '../../../model/field.ts';
import { navForDay, shownDay, state } from '../../../state/index.ts';
import { navDur, outingTimes } from '../../boats/index.ts';
import { useCompactForm } from '../compact/compactContext.ts';

import { engineFigures, milesFigures } from './calcValues.ts';

const CALC_BLOCKS: Record<CalcKind, ComponentType> = {
  engine: EngineCalc,
  nav: NavCalc,
  miles: MilesCalc,
  lake: LakeCalc,
};

/**
 * Computed block of the day sheet (legacy `calcEngine`, `calcNav`, `calcMiles`,
 * `calcLake`), refreshed after each change.
 * @param props - The field.
 * @param props.field - Field definition (`calc`).
 * @returns The block.
 */
export function CalcBlock({ field }: { field: FieldDefinition }) {
  useSignals();
  if (!state.data.cruise.value || !field.calc) return null;
  const Block = CALC_BLOCKS[field.calc];
  return <Block />;
}

function EngineCalc() {
  useSignals();
  const form = useCompactForm();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const figures = engineFigures(cruise, form.values, shownDay());
  return (
    <>
      <table className="calc-t">
        <tbody>
          <tr>
            <td>{tr('Heures relevées ce soir')}</td>
            <td>{tr(`${fr(figures.evening)} h`)}</td>
          </tr>
          <tr>
            <td>{tr('− heures au départ')}</td>
            <td>{tr(`${fr(figures.start)} h`)}</td>
          </tr>
          <tr>
            <th>{tr('= heures effectuées')}</th>
            <th>{tr(`${fr(figures.hours)} h`)}</th>
          </tr>
          <tr>
            <td>{tr(`Consommation (${fr(figures.consumption)} l/h)`)}</td>
            <td>{tr(`${fr(figures.burnt, 0)} l`)}</td>
          </tr>
          <tr>
            <td>
              {tr(`Carburant au départ${figures.refuelled ? ' + pleins' : ''}`)}
            </td>
            <td>{tr(`${fr(figures.loaded, 0)} l`)}</td>
          </tr>
          <tr>
            <th>{tr('Carburant disponible')}</th>
            <th>{tr(`${fr(figures.available, 0)} l`)}</th>
          </tr>
        </tbody>
      </table>
      {figures.incomplete ? (
        <HelpText>
          Renseignez ci-dessus le compteur et le carburant au départ, et la
          consommation dans la fiche du bateau.
        </HelpText>
      ) : null}
    </>
  );
}

function NavCalc() {
  useSignals();
  const form = useCompactForm();
  const tr = useTr();
  const navigation = navForDay(shownDay());
  if (navigation.legs.length === 0) {
    return (
      <HelpText>
        Aucune navigation « Départ → Arrivée » ce jour au journal.
      </HelpText>
    );
  }
  return (
    <table className="calc-t">
      <tbody>
        {navigation.legs.map((leg) => (
          <tr key={leg.dep.id}>
            <td>
              {tr(
                `${fmtTime(new Date(leg.dep.t))} → ${fmtTime(new Date(leg.arr.t))}`,
              )}
            </td>
            <td>
              {tr(
                `${fmtDur(leg.ms)}${leg.dist > 0 ? ` · ${fr(leg.dist)} NM` : ''}`,
              )}
            </td>
          </tr>
        ))}
        <tr>
          <th>{tr('Durée de navigation')}</th>
          <th>{textOf(form.values.dureeNav) || tr(fmtDur(navigation.ms))}</th>
        </tr>
      </tbody>
    </table>
  );
}

function MilesCalc() {
  useSignals();
  const form = useCompactForm();
  const tr = useTr();
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const figures = milesFigures(cruise, form.values, shownDay());
  const { suggestion, today, previous, speed, engineTotal, engineToday } =
    figures;
  const total = previous + (today ?? 0);
  return (
    <>
      {suggestion != null && suggestion !== today ? (
        <Button
          className="btn"
          data-use="nmJour"
          data-val={stringOf(suggestion).replace('.', ',')}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            buzz();
            form.set('nmJour', stringOf(suggestion).replace('.', ','));
          }}
        >
          {tr(`Utiliser le loch : ${fr(suggestion)} NM`)}
        </Button>
      ) : null}
      <table className="calc-t">
        <tbody>
          <tr>
            <td>{tr('Total des jours précédents')}</td>
            <td>{tr(`${fr(previous)} NM`)}</td>
          </tr>
          <tr>
            <td>{tr('+ effectués ce jour')}</td>
            <td>{tr(`${fr(today)} NM`)}</td>
          </tr>
          <tr>
            <th>{tr('= total effectué')}</th>
            <th>{tr(`${fr(total)} NM`)}</th>
          </tr>
          <tr>
            <td colSpan={2} className="sub">
              {tr(`dont au moteur (heures × ${fr(speed)} nd)`)}
            </td>
          </tr>
          <tr>
            <td>{tr('Total moteur')}</td>
            <td>{tr(`${fr(engineTotal)} NM`)}</td>
          </tr>
          <tr>
            <td>{tr('Moteur ce jour')}</td>
            <td>{tr(`${fr(engineToday)} NM`)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function LakeCalc() {
  useSignals();
  const tr = useTr();
  const key = shownDay();
  const outing = outingTimes(key);
  const { t0, t1, nm, live } = outing;
  const navigation = navDur(key) || (t0 && t1 ? fmtDur(t1 - t0) : '');
  if (!t0) {
    return (
      <HelpText>
        Au départ, lancez le journal automatique (onglet Saisir) : heures, durée
        et milles se rempliront seuls avec le GPS.
      </HelpText>
    );
  }
  let back = <>{live ? tr('en cours…') : '–'}</>;
  if (t1) back = <TzTime date={new Date(t1)} />;
  return (
    <table className="calc-t">
      <tbody>
        <tr>
          <td>{tr('Départ')}</td>
          <td>
            <TzTime date={new Date(t0)} />
          </td>
        </tr>
        <tr>
          <td>{tr('Retour')}</td>
          <td>{back}</td>
        </tr>
        {navigation ? (
          <tr>
            <th>{tr('Navigation')}</th>
            <th>{tr(navigation)}</th>
          </tr>
        ) : null}
        {nm > 0.05 ? (
          <tr>
            <td>{tr('Trace GPS')}</td>
            <td>{tr(`${fr(nm)} NM`)}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

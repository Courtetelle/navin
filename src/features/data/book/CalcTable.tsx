import { fmtDur, fmtTime, fr, textOf } from '../../../lib/format.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import type { Cruise, Day } from '../../../model/types.ts';
import { navForDay } from '../../../state/index.ts';
import { engineFigures, milesFigures } from '../../logbook/index.ts';

interface FiguresProps {
  cruise: Cruise;
  day: Day;
  dayId: string;
}

/** Props of {@link CalcTable}. */
export interface CalcTableProps extends FiguresProps {
  /** Block printed. */
  kind: FieldDefinition['calc'];
}

/**
 * Computed block of a printed sea day (legacy `f.calc(d)` without its buttons
 * and help texts).
 * @param props - Block, cruise and day.
 * @returns The table.
 */
export function CalcTable({ kind, ...figures }: CalcTableProps) {
  if (kind === 'engine') return <EngineTable {...figures} />;
  if (kind === 'miles') return <MilesTable {...figures} />;
  return <NavigationTable {...figures} />;
}

function EngineTable({ cruise, day, dayId }: FiguresProps) {
  const figures = engineFigures(cruise, day, dayId);
  return (
    <table className="calc-t">
      <tbody>
        <tr>
          <td>Heures relevées ce soir</td>
          <td>{`${fr(figures.evening)} h`}</td>
        </tr>
        <tr>
          <td>− heures au départ</td>
          <td>{`${fr(figures.start)} h`}</td>
        </tr>
        <tr>
          <th>= heures effectuées</th>
          <th>{`${fr(figures.hours)} h`}</th>
        </tr>
        <tr>
          <td>{`Consommation (${fr(figures.consumption)} l/h)`}</td>
          <td>{`${fr(figures.burnt, 0)} l`}</td>
        </tr>
        <tr>
          <td>{`Carburant au départ${figures.refuelled ? ' + pleins' : ''}`}</td>
          <td>{`${fr(figures.loaded, 0)} l`}</td>
        </tr>
        <tr>
          <th>Carburant disponible</th>
          <th>{`${fr(figures.available, 0)} l`}</th>
        </tr>
      </tbody>
    </table>
  );
}

function NavigationTable({ cruise, day, dayId }: FiguresProps) {
  const navigation = navForDay(dayId, cruise);
  return (
    <table className="calc-t">
      <tbody>
        {navigation.legs.map((leg) => (
          <tr key={leg.dep.id}>
            <td>
              {`${fmtTime(new Date(leg.dep.t))} → ${fmtTime(new Date(leg.arr.t))}`}
            </td>
            <td>
              {`${fmtDur(leg.ms)}${leg.dist > 0 ? ` · ${fr(leg.dist)} NM` : ''}`}
            </td>
          </tr>
        ))}
        <tr>
          <th>Durée de navigation</th>
          <th>{textOf(day.dureeNav) || fmtDur(navigation.ms)}</th>
        </tr>
      </tbody>
    </table>
  );
}

function MilesTable({ cruise, day, dayId }: FiguresProps) {
  const figures = milesFigures(cruise, day, dayId);
  const { today, previous, speed, engineTotal, engineToday } = figures;
  return (
    <table className="calc-t">
      <tbody>
        <tr>
          <td>Total des jours précédents</td>
          <td>{`${fr(previous)} NM`}</td>
        </tr>
        <tr>
          <td>+ effectués ce jour</td>
          <td>{`${fr(today)} NM`}</td>
        </tr>
        <tr>
          <th>= total effectué</th>
          <th>{`${fr(previous + (today ?? 0))} NM`}</th>
        </tr>
        <tr>
          <td colSpan={2} className="sub">
            {`dont au moteur (heures × ${fr(speed)} nd)`}
          </td>
        </tr>
        <tr>
          <td>Total moteur</td>
          <td>{`${fr(engineTotal)} NM`}</td>
        </tr>
        <tr>
          <td>Moteur ce jour</td>
          <td>{`${fr(engineToday)} NM`}</td>
        </tr>
      </tbody>
    </table>
  );
}

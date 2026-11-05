import type { ReactNode } from 'react';

import { fmtValue } from '../../../lib/fieldFormat.ts';
import {
  dayKey,
  fmtDate,
  fmtTime,
  fmtUtc,
  keyToDate,
  textOf,
} from '../../../lib/format.ts';
import { DAY_SECTIONS } from '../../../model/daySections.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import type { Cruise, Day } from '../../../model/types.ts';
import { activeSections, navLabel } from '../../../state/index.ts';
import type { TideRow } from '../csv.ts';

import { CalcTable } from './CalcTable.tsx';
import { kvRows } from './kvRows.tsx';
import { printedCalcs } from './printedCalcs.ts';

const NOT_PRINTED: ReadonlySet<string> = new Set(['Étape', 'Signatures']);

/** Props of {@link DayPage}. */
export interface DayPageProps {
  /** Cruise printed. */
  cruise: Cruise;
  /** Day key. */
  dayId: string;
  /** Logbook columns, without the time. */
  columns: readonly FieldDefinition[];
}

/**
 * Printed page of a sea day: day sheet blocks, hourly table and signatures.
 * @param props - Cruise, day and columns.
 * @returns The page.
 */
export function DayPage({ cruise, dayId, columns }: DayPageProps) {
  const day: Day = cruise.days[dayId] ?? {};
  const entries = cruise.entries.filter(
    (entry) => dayKey(new Date(entry.t)) === dayId,
  );
  const navigation = navLabel(dayId, cruise);
  const route =
    day.de || day.a
      ? ` · de ${textOf(day.de) || '…'} à ${textOf(day.a) || '…'}`
      : '';
  return (
    <section className="pg">
      <h1>
        {`${fmtDate(keyToDate(dayId))}${route}${navigation ? ` · navigation ${navigation}` : ''}`}
      </h1>
      <div className="cols">
        {activeSections(DAY_SECTIONS)
          .filter((section) => !NOT_PRINTED.has(section.title ?? ''))
          .map((section) => (
            <DayBlock
              key={section.title}
              title={section.title ?? ''}
              fields={section.fields}
              cruise={cruise}
              day={day}
              dayId={dayId}
            />
          ))}
      </div>
      {entries.length > 0 ? (
        <table className="hourly">
          <tbody>
            <tr>
              <th>Heure</th>
              {columns.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
            </tr>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {`${fmtTime(new Date(entry.t))}${entry.auto ? '*' : ''}`}
                  <br />
                  <small>{fmtUtc(new Date(entry.t))}</small>
                </td>
                {columns.map((field) => (
                  <td key={field.key}>{fmtValue(field, entry.v[field.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {entries.some((entry) => entry.auto) ? (
        <p className="note">
          * entrée créée automatiquement par le suivi GPS ; vent, mer et baro
          marqués comme modèle météo quand ils viennent d’Open-Meteo.
        </p>
      ) : null}
      <SignatureTable day={day} />
    </section>
  );
}

interface DayBlockProps {
  title: string;
  fields: readonly FieldDefinition[];
  cruise: Cruise;
  day: Day;
  dayId: string;
}

function DayBlock({ title, fields, cruise, day, dayId }: DayBlockProps) {
  const rows = kvRows(fields, day);
  const tides = title === 'Marées' ? tideRow(day.marees) : null;
  const calcs = printedCalcs(fields, cruise, dayId);
  const hasCalc = calcs.length > 0 && Object.keys(day).length > 0;
  if (rows.length === 0 && !tides && !hasCalc) return null;
  return (
    <div className="blk">
      <h3>{title}</h3>
      <table>
        {rows.length > 0 || tides ? (
          <tbody>
            {rows}
            {tides}
          </tbody>
        ) : null}
      </table>
      {calcs.map((field) => (
        <CalcTable
          key={field.key}
          kind={field.calc}
          cruise={cruise}
          day={day}
          dayId={dayId}
        />
      ))}
    </div>
  );
}

function tideRow(tides: unknown): ReactNode {
  const texts: string[] = [];
  for (const row of (tides ?? []) as readonly TideRow[]) {
    if (!row.type && !row.h) continue;
    texts.push(`${row.type || ''} ${row.h || ''} ${row.m ? `${row.m} m` : ''}`);
  }
  if (texts.length === 0) return null;
  return (
    <tr>
      <th>Marées</th>
      <td>{texts.join(' · ')}</td>
    </tr>
  );
}

function SignatureTable({ day }: { day: Day }) {
  return (
    <table className="sign">
      <tbody>
        <tr>
          <th>Navigateur</th>
          <td>{textOf(day.navigateur)}</td>
          <th>Signature</th>
          <td>{signature(day.sigNav)}</td>
          <th>Skipper</th>
          <td>{textOf(day.skipper)}</td>
          <th>Signature</th>
          <td>{signature(day.sigSkip)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function signature(source: unknown): ReactNode {
  return source ? <img src={textOf(source)} alt="" /> : null;
}

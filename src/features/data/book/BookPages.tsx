import type { ReactNode } from 'react';

import { radioDesc } from '../../../lib/boatDescription.ts';
import { textOf } from '../../../lib/format.ts';
import { CREW_FIELDS } from '../../../model/crewFields.ts';
import type { FieldDefinition } from '../../../model/field.ts';
import { INFO_SECTIONS } from '../../../model/infoSections.ts';
import { TECH_FIELDS } from '../../../model/techFields.ts';
import type { Cruise } from '../../../model/types.ts';
import { constatKey } from '../../../model/views.ts';
import { constatTitle } from '../../../state/index.ts';
import { spell } from '../../safety/index.ts';

import { kvRows } from './kvRows.tsx';

const TITLE_SECTIONS: ReadonlySet<string> = new Set([
  'Croisière',
  'Données techniques',
  'Radio et identification',
  'Loueur, base',
]);
const TECH_SECTIONS: ReadonlySet<string> = new Set([
  'Données techniques',
  'Informations',
  'Données moteur',
  'Calculs moteur et carburant',
]);

/** Props of a printed page about a cruise. */
interface BookPageProps {
  /** Cruise printed. */
  cruise: Cruise;
}

/**
 * Title page: cruise and boat, then the takeover and end observations.
 * @param props - Cruise.
 * @returns The page.
 */
export function TitlePage({ cruise }: BookPageProps) {
  const { info } = cruise;
  return (
    <section className="pg">
      <h1>NavIn · Journal de bord / Log book</h1>
      <h2>{info.name || ''}</h2>
      <table>
        <tbody>
          {INFO_SECTIONS.filter((section) =>
            TITLE_SECTIONS.has(section.title ?? ''),
          ).map((section) =>
            kvRows(
              section.fields.filter(
                (field: FieldDefinition) => !TECH_FIELDS.includes(field),
              ),
              info,
            ),
          )}
        </tbody>
      </table>
      {['dep', 'quit'].map((list) => {
        const text = cruise[constatKey(list)];
        if (!text) return null;
        return [
          <h3 key={`${list}-title`}>{constatTitle(list)}</h3>,
          <p key={list} className="pre">
            {textOf(text)}
          </p>,
        ];
      })}
    </section>
  );
}

/**
 * Technical sheet of the boat.
 * @param props - Cruise.
 * @returns The page.
 */
export function TechPage({ cruise }: BookPageProps) {
  return (
    <section className="pg">
      <h1>Données bateau / Yacht data</h1>
      <table>
        <tbody>
          {INFO_SECTIONS.filter((section) =>
            TECH_SECTIONS.has(section.title ?? ''),
          ).map((section) => kvRows(section.fields, cruise.info))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Crew list.
 * @param props - Cruise.
 * @returns The page.
 */
export function CrewListPage({ cruise }: BookPageProps) {
  return (
    <section className="pg">
      <h1>Liste d’équipage / Crew list</h1>
      <table className="small">
        <tbody>
          <tr>
            <th>n°</th>
            {CREW_FIELDS.map((field) => (
              <th key={field.key}>{field.label}</th>
            ))}
          </tr>
          {crewRows(cruise)}
        </tbody>
      </table>
    </section>
  );
}

function crewRows(cruise: Cruise): ReactNode[] {
  const rows: ReactNode[] = [];
  for (const [position, member] of cruise.crew.entries()) {
    rows.push(
      <tr key={position}>
        <td>{position + 1}</td>
        {CREW_FIELDS.map((field) => (
          <td key={field.key}>{textOf(member[field.key])}</td>
        ))}
      </tr>,
    );
  }
  return rows;
}

/**
 * Safety page: useful numbers, weather, radio identity, boat to boat channels.
 * @param props - Cruise.
 * @returns The page.
 */
export function SafetyPage({ cruise }: BookPageProps) {
  const { info } = cruise;
  return (
    <section className="pg">
      <h1>Sécurité, secours et météo</h1>
      <h3>Numéros utiles</h3>
      <p className="pre">{info.contacts || ''}</p>
      <h3>Météo</h3>
      <p className="pre">{textOf(info.meteo)}</p>
      <h3>Identité radio</h3>
      <p>
        {`${info.boat || ''} · Indicatif ${textOf(info.callsign)} (${spell(info.callsign)}) · MMSI ${textOf(info.mmsi)}`}
      </p>
      <p>{radioDesc(info, 'en')}</p>
      <h3>Canaux bateau à bateau</h3>
      <p>6 · 8 · 72 · 77</p>
    </section>
  );
}

const BLANK_ROWS = Array.from({ length: 16 }, (_, row) => row);

/** Props of {@link BlankPage}. */
interface BlankPageProps {
  /** Logbook columns (labels, without the time). */
  columns: readonly FieldDefinition[];
}

/**
 * Empty page to fill by hand, when the phone cannot be used.
 * @param props - Columns.
 * @returns The page.
 */
export function BlankPage({ columns }: BlankPageProps) {
  return (
    <section className="pg">
      <h1>Date : ____________ · de ____________ à ____________</h1>
      <table className="hourly blank">
        <tbody>
          <tr>
            <th>Heure</th>
            {columns.map((field) => (
              <th key={field.key}>{field.label}</th>
            ))}
          </tr>
          {BLANK_ROWS.map((row) => (
            <tr key={row}>
              <td />
              {columns.map((field) => (
                <td key={field.key} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="sign">
        <tbody>
          <tr>
            <th>Navigateur</th>
            <td />
            <th>Signature</th>
            <td />
            <th>Skipper</th>
            <td />
            <th>Signature</th>
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  );
}

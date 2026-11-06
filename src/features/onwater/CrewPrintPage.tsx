import type { ReactNode } from 'react';

import { fmtShortDate } from '../../lib/format.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import { state } from '../../state/index.ts';

import { crewListCols, crewListHead, crewRole } from './crewList.ts';

/**
 * The crew list on one A4 landscape page (legacy `printCrewList`).
 * @returns The page.
 */
export function CrewPrintPage() {
  const head = crewListHead();
  const columns = crewListCols();
  const crew = state.data.cruise.value?.crew ?? [];
  const skipper = crew.find((member) => member.fonction === 'Skipper');
  const rows: ReactNode[] = [];
  const lines = keyedItems(
    crew,
    (member) => member.memberId ?? member.nom ?? '',
  );
  for (const { key: lineKey, item: member, index } of lines) {
    rows.push(
      <tr key={lineKey}>
        <td>{index + 1}</td>
        {columns.map(([key]) => (
          <td key={key}>
            {key === 'fonction'
              ? crewRole(member)
              : ((member[key] as string | undefined) ?? '')}
          </td>
        ))}
      </tr>,
    );
  }
  return (
    <section className="pg">
      <h1>{head.title}</h1>
      <p>
        <b>Bateau :</b> {head.boat || '–'} · <b>Dates :</b> {head.dates || '–'}{' '}
        · <b>Personnes à bord :</b> {head.n}
      </p>
      <table className="crew-tbl">
        <thead>
          <tr>
            <th>n°</th>
            {columns.map(([key, label]) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p className="crew-foot">
        Établie le {fmtShortDate(new Date())}
        {skipper ? ` · Skipper : ${skipper.nom || ''}` : ''} · Signature :
        ____________________
      </p>
    </section>
  );
}

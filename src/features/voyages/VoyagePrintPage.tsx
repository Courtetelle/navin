import { fmtShortDate } from '../../lib/format.ts';
import type { VoyageSection } from '../../model/voyages.ts';

/**
 * The tables on one A4 page.
 * @param props - Title and tables.
 * @param props.title - Title of the page.
 * @param props.sections - The tables.
 * @returns The page.
 */
export function VoyagePrintPage({
  title,
  sections,
}: {
  title: string;
  sections: readonly VoyageSection[];
}) {
  return (
    <section className="pg">
      <h1>{title}</h1>
      {sections.map((section, index) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed list, printed once
        <div key={index}>
          <h2>{section.title}</h2>
          <table>
            <tbody>
              {section.rows.map(([label, value], row) => (
                // eslint-disable-next-line react/no-array-index-key -- fixed list, printed once
                <tr key={row}>
                  <td>{label}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="voy-foot">NavIn · {fmtShortDate(new Date())}</p>
    </section>
  );
}

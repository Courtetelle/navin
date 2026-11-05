import { printInHolder } from '../publish/index.ts';

import { blankLabel, blankLanguage } from './blankSheet.ts';
import { BLANK_FIELDS, BLANK_I18N } from './blankTexts.ts';

const PRINT_CSS =
  '@media print { main { display:none } @page { size: A4 portrait; margin: 10mm } .blank-tbl td { height: 11mm; width: 60% } }';

/** Print the blank sheet to fill in by hand (legacy `blankPdf`, lake.js:2115). */
export function blankPdf(): void {
  const shown = blankLanguage();
  const texts = shown === 'fr' ? null : BLANK_I18N[shown];
  const rows: Array<[string, string]> = [];
  for (const [key] of BLANK_FIELDS) {
    if (key === 'piecePP') continue;
    const label =
      key === 'pieceCI'
        ? (texts?.pdfDocument ?? 'Carte d’identité ou passeport (entourer)')
        : blankLabel(key, shown);
    rows.push([key, label]);
  }
  printInHolder({
    className: 'print-only book lx-print',
    title: 'navin-fiche-coequipier-vide',
    delay: 150,
    css: PRINT_CSS,
    content: (
      <section className="pg">
        <h1>{texts?.pdfTitle ?? 'Fiche coéquipier·ère'}</h1>
        <p className="lx-date">
          {texts?.pdfSubtitle ?? 'NavIn · à compléter et à renvoyer'}
        </p>
        <table className="dos-tbl blank-tbl">
          <tbody>
            {rows.map(([key, label]) => (
              <tr key={key}>
                <th>{label}</th>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ),
  });
}

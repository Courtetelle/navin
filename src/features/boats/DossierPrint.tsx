import { Fragment } from 'react';

import { fmtShortDate } from '../../lib/format.ts';
import type { Boat } from '../../model/types.ts';

import type { BoatDocument } from './boatDocs.ts';
import { docKindName } from './boatDocs.ts';
import { boatInfoRows } from './boatInfoRows.ts';
import { withKeys } from './withKeys.ts';

/** A photo of a document, read from the photo store. */
export interface DocumentPicture {
  document: BoatDocument;
  /** Data URL. */
  url: string;
}

/** Props of {@link DossierPrint}. */
interface DossierPrintProps {
  /** Boat. */
  boat: Boat;
  /** Photos of its documents. */
  pictures: readonly DocumentPicture[];
}

/**
 * A4 pages of a boat sheet and its documents.
 * @param props - Boat and photos.
 * @returns The pages.
 */
export function DossierPrint({ boat, pictures }: DossierPrintProps) {
  const name = boat.info.boat ?? '';
  return (
    <>
      <section className="pg">
        <h1>Fiche bateau · {name}</h1>
        {boatInfoRows(boat).map((section) => (
          <Fragment key={section.title}>
            <h2>{section.title}</h2>
            <table className="dos-tbl">
              <tbody>
                {section.rows.map(([label, value]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{withLineBreaks(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Fragment>
        ))}
        <p className="crew-foot">Établie le {fmtShortDate(new Date())}</p>
      </section>
      {pictures.length > 0 ? (
        <section className="pg">
          <h1>Documents · {name}</h1>
          <div className="dos-docs">
            {pictures.map(({ document, url }) => (
              <figure key={document.id}>
                <img src={url} alt="" />
                <figcaption>
                  {document.cap || docKindName(document.kind)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function withLineBreaks(text: string) {
  return withKeys(text.split('\n'), String).map(({ key, item }, index) => (
    <Fragment key={key}>
      {index > 0 ? <br /> : null}
      {item}
    </Fragment>
  ));
}

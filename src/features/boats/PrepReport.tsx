import { Fragment } from 'react';

import { fmtShortDate } from '../../lib/format.ts';
import type { CardsPhoto, CardsRow, LxTheme } from '../publish/index.ts';

import type { PrepReportDocument } from './prepReportData.ts';
import { cachedPrepReport } from './prepReportData.ts';
import { withKeys } from './withKeys.ts';

/** Props of {@link PrepReport}. */
export interface PrepReportProps {
  /** The report. */
  document: PrepReportDocument;
  /** Layout. */
  theme: LxTheme;
}

/**
 * A4 page of the PréP + check-in report, same template as the printed lists:
 * `.lx-doc` + `.lx-th-<theme>` (legacy `prepReportHtml`).
 * @param props - Report and layout.
 * @returns The page.
 */
export function PrepReport({ document, theme }: PrepReportProps) {
  return (
    <div className={`lx-th-${theme}`}>
      <section className={`pg lx-doc prep-print lx-th-${theme}`}>
        <header className="lx-hd">
          <div className="lx-k">⛵ NavIn · {document.kicker}</div>
          <h1>{document.title}</h1>
          <p>{document.sub}</p>
        </header>
        {document.sections.map((section) => (
          <section key={section.title} className="lx-card">
            <h2>{section.title}</h2>
            <div className="lx-rows">
              {withKeys(section.rows, rowKey).map(({ key, item }) => (
                <div key={key} className="lx-r">
                  <b>{item[0]}</b>
                  <span>
                    {withLineBreaks(item[1])}
                    <RowPhotos photos={item[2] ?? []} />
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
        {document.photos.length > 0 ? (
          <section className="lx-card lx-phs">
            <h2>Photos</h2>
            {document.photos.map((photo) => (
              <figure key={photo.url} className="lx-ph">
                <img src={photo.url} alt="" />
                <figcaption>{photo.cap}</figcaption>
              </figure>
            ))}
          </section>
        ) : null}
        <footer className="lx-ft">NavIn · {fmtShortDate(new Date())}</footer>
      </section>
    </div>
  );
}

/**
 * The prepared report inside the printed log book, or the message asking to
 * try again while the photos are being read (legacy `printBook`, page `prep`).
 * @returns The page.
 */
export function CachedPrepReportPage() {
  const report = cachedPrepReport();
  if (report?.document) {
    return <PrepReport document={report.document} theme={report.theme} />;
  }
  return (
    <section className="pg">
      <h1>PréP et check-in</h1>
      <p>Photos en cours de lecture : réessayez dans un instant.</p>
    </section>
  );
}

function RowPhotos({ photos }: { photos: readonly CardsPhoto[] }) {
  if (photos.length === 0) return null;
  return (
    <span className="prep-rph">
      {photos.map((photo) => (
        <img key={photo.url} src={photo.url} alt="" />
      ))}
    </span>
  );
}

function rowKey(row: CardsRow): string {
  return `${row[0]}|${row[1]}`;
}

function withLineBreaks(text: string) {
  return withKeys(text.split('\n'), String).map(({ key, item }, index) => (
    <Fragment key={key}>
      {index > 0 ? <br /> : null}
      {item}
    </Fragment>
  ));
}

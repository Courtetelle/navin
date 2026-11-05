import { useSignals } from '@preact/signals-react/runtime';
import { Fragment, useEffect, useState } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { PHOTO_CTX } from '../../storage/photos.ts';
import { PhotoStrip, traceImage } from '../onwater/index.ts';

import type {
  PickedSheet,
  SheetChecklist,
  SheetLogRow,
  SheetRow,
} from './sheetTypes.ts';
import { withKeys } from './withKeys.ts';

/** Props of {@link LakeSheet}. */
export interface LakeSheetProps {
  /** The sheet, reduced to the chosen parts (`pickSheet`). */
  sheet: PickedSheet;
}

/**
 * The lake day sheet (legacy `sheetHtml`, `div#sheet`), on the screen and in
 * the printed log book.
 * @param props - Sheet.
 * @returns The sheet.
 */
export function LakeSheet({ sheet }: LakeSheetProps) {
  useSignals();
  const tr = useTr();
  return (
    <div className="sheet" id="sheet">
      <h2>{tr(sheet.title)}</h2>
      {sheet.sections.map((section) => (
        <Fragment key={section.title}>
          <h3>{tr(section.title)}</h3>
          <table>
            <tbody>
              {withKeys(section.rows, rowKey).map(({ key, item }) => (
                <tr key={key}>
                  <th>{tr(item[0])}</th>
                  <td>{tr(item[1])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Fragment>
      ))}
      {sheet.traceK ? (
        <>
          <h3>{tr('Trace du jour')}</h3>
          <SheetTrace day={sheet.traceK} />
        </>
      ) : null}
      {sheet.extract.length > 0 ? (
        <>
          <h3>{tr(sheet.extractTitle || 'Extrait du journal')}</h3>
          <table className="sheet-log">
            <tbody>
              {withKeys(sheet.extract, logRowKey).map(({ key, item: row }) => (
                <tr key={key}>
                  <th>{row.time}</th>
                  <td>
                    <b>{tr(row.what)}</b>
                    {row.more ? (
                      <>
                        <br />
                        <small>{row.more}</small>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
      {sheet.showObs ? (
        <>
          <h3>{tr('2 · Observations, constatations, propositions')}</h3>
          <p>{sheet.obs || '–'}</p>
        </>
      ) : null}
      {sheet.photos.length > 0 ? (
        <>
          <h3>{tr('Photos')}</h3>
          {Object.entries(PHOTO_CTX).map(([context, label]) => {
            const photos = sheet.photos.filter(
              (photo) => photo.ctx === context,
            );
            return photos.length > 0 ? (
              <Fragment key={context}>
                <p className="sig-line">{tr(label)}</p>
                <PhotoStrip photos={photos} />
              </Fragment>
            ) : null;
          })}
        </>
      ) : null}
      {sheet.sig ? (
        <>
          <p className="sig-line">
            {tr(`Signature${sheet.sigName ? ` · ${sheet.sigName}` : ''}`)}
          </p>
          <img src={sheet.sig} alt="Signature" />
        </>
      ) : null}
      {withKeys(sheet.checks, listKey).map(
        ({ key: listId, item: list }, position) => (
          <Fragment key={listId}>
            <h3>{tr(`${position ? '' : '3 · '}${list.name}`)}</h3>
            <ul className="sheet-checks">
              {withKeys(list.items, itemKey).map(({ key, item }) => (
                <li key={key} className={item.ok ? 'ok' : undefined}>
                  {tr(`${item.ok ? '☑' : '☐'} ${item.label}`)}
                </li>
              ))}
            </ul>
          </Fragment>
        ),
      )}
    </div>
  );
}

function rowKey(row: SheetRow): string {
  return `${row[0]}|${row[1]}`;
}

function listKey(list: SheetChecklist): string {
  return list.name;
}

function logRowKey(row: SheetLogRow): string {
  return `${row.time}|${row.what}`;
}

function itemKey(item: { label: string }): string {
  return item.label;
}

function SheetTrace({ day }: { day: string }) {
  const tr = useTr();
  const [drawn, setDrawn] = useState<{
    day: string;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void traceImage(day).then((url) => {
      if (alive) setDrawn({ day, url });
    });
    return () => {
      alive = false;
    };
  }, [day]);
  let content = <span>{tr('Carte en préparation…')}</span>;
  if (drawn?.day === day) {
    content = drawn.url ? (
      <img src={drawn.url} alt="Trace du jour" />
    ) : (
      <span>{tr('Trace indisponible')}</span>
    );
  }
  return <div className="sheet-trace">{content}</div>;
}

import { useSignals } from '@preact/signals-react/runtime';
import { Fragment, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import type {
  RecordKind,
  RecordLine,
} from '../../features/voyages/recordKinds.ts';
import {
  deleteRecord,
  moveRecord,
  openRecord,
  recordKind,
  recordLines,
  renameRecord,
} from '../../features/voyages/recordKinds.ts';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  freeRecords,
  voyageRecords,
} from '../../features/voyages/voyageRecords.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

/** Another cruise or outing a record can go to. */
interface Elsewhere {
  id: string;
  name: string;
}

/**
 * One record being changed: its name, « ↪ Déplacer » to another cruise or
 * outing, « Retirer » and « 🗑 Effacer » (touched twice).
 * @param props - The record and where it can go.
 * @param props.kind - Its kind.
 * @param props.line - The record.
 * @param props.elsewhere - The other cruises and outings.
 * @returns The line.
 */
function EditLine({
  kind,
  line,
  elsewhere,
}: {
  kind: RecordKind;
  line: RecordLine;
  elsewhere: readonly Elsewhere[];
}) {
  const tr = useTr();
  const [name, setName] = useState(line.name);
  const [moving, setMoving] = useState(false);
  const [sure, setSure] = useState(false);
  return (
    <Fragment>
      <div className="voy-record" data-voyrec={`${kind}:${line.id}`}>
        <span className="voy-record-text">
          {line.renamable ? (
            <input
              className="text"
              data-voyrecname={`${kind}:${line.id}`}
              aria-label={tr('Nom')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => {
                if (name.trim() && name !== line.name) {
                  renameRecord(kind, line.id, name);
                }
              }}
            />
          ) : (
            <b>{line.name}</b>
          )}
          {line.when ? <small>{line.when}</small> : null}
        </span>
        {elsewhere.length > 0 ? (
          <Button
            className={`btn ${moving ? 'on' : ''}`}
            data-voyrecto={`${kind}:${line.id}`}
            onClick={() => {
              buzz();
              setMoving(!moving);
            }}
          >
            {tr('↪ Déplacer')}
          </Button>
        ) : null}
        <Button
          className="btn"
          data-voyrecmove={`${kind}:${line.id}`}
          onClick={() => {
            buzz();
            moveRecord(kind, line.id, undefined);
          }}
        >
          {tr('Retirer')}
        </Button>
        <Button
          className={`btn ${sure ? 'danger' : ''}`}
          data-voyrecdel={`${kind}:${line.id}`}
          onClick={() => {
            buzz();
            if (!sure) {
              setSure(true);
              return;
            }
            deleteRecord(kind, line.id);
            toast(`« ${line.name} » ${tr('mis à la Poubelle (30 jours)')}`);
          }}
        >
          {tr(sure ? '🗑 Confirmer' : '🗑 Effacer')}
        </Button>
      </div>
      {moving ? (
        <div className="voy-record-to">
          {elsewhere.map((other) => (
            <Button
              key={other.id}
              className="btn"
              data-voyrecdest={other.id}
              onClick={() => {
                buzz();
                setMoving(false);
                moveRecord(kind, line.id, other.id);
                toast(`« ${line.name} » ${tr('déplacé dans')} ${other.name}`);
              }}
            >
              {other.name}
            </Button>
          ))}
        </div>
      ) : null}
    </Fragment>
  );
}

/**
 * Screen `vrecs` (a cruise › Enregistrements › Traces, Routes, Routages or
 * Marques): its records of that kind. Read: a touch opens one. With the
 * pencil at the top: move one to another cruise or outing, rename it,
 * delete it, or add one made before; the green ✔ ends.
 * @returns The screen content.
 */
export function VoyageRecordListPage() {
  useSignals();
  const tr = useTr();
  const arg: unknown = state.view.viewArg.value;
  const info = recordKind(typeof arg === 'string' ? arg : null);
  const voyage = state.data.voyages.value;
  const mine = voyage.id
    ? recordLines(info.kind, voyageRecords(voyage.id))
    : [];
  const { editing, validate } = useChapterEdit(undefined, mine.length === 0);
  const back = (
    <PageBack
      label="◀ Enregistrements"
      data-go="vrecords"
      onClick={() => {
        buzz();
        go('vrecords');
      }}
    >
      {tr('◀ Enregistrements')}
    </PageBack>
  );
  if (!voyage.id) {
    return (
      <>
        {back}
        <NoVoyage />
      </>
    );
  }
  const word = voyage.lake ? 'sortie' : 'croisière';
  const free = recordLines(info.kind, freeRecords());
  const elsewhere: Elsewhere[] = state.data.voyageStore.value.list
    .filter((item) => item.id !== voyage.id)
    .map((item) => ({
      id: item.id,
      name: `${item.lake ? '🏞' : '⛵'} ${item.name}`,
    }));
  return (
    <>
      {back}
      {validate}
      <PageTitle
        helps={[
          `Les ${info.title.toLowerCase()} de la ${word}. Toucher : l’ouvrir. Le crayon en haut permet de les déplacer dans une autre croisière ou sortie, de les renommer, de les effacer (elles restent 30 jours dans Paramètres › Poubelle) ou d’y ajouter celles d’avant ; la coche verte termine.`,
        ]}
      >
        {`${info.icon} ${info.title} · ${mine.length}`}
      </PageTitle>
      <h2 className="sub-h">{voyage.name}</h2>
      {mine.length === 0 ? (
        <HelpText>{`Rien dans cette ${word} pour l’instant.`}</HelpText>
      ) : null}
      <div className="voy-records">
        {mine.map((line) =>
          editing ? (
            <EditLine
              key={line.id}
              kind={info.kind}
              line={line}
              elsewhere={elsewhere}
            />
          ) : (
            <Button
              key={line.id}
              className="btn big voy-record-open"
              data-voyrecopen={`${info.kind}:${line.id}`}
              onClick={() => openRecord(info.kind, line.id)}
            >
              {`${info.icon} ${line.name}`}
              {line.when ? <small>{line.when}</small> : null}
            </Button>
          ),
        )}
      </div>
      {editing ? (
        <>
          <h2 className="sub-h">{tr(`＋ Ajouter à la ${word}`)}</h2>
          {free.length === 0 ? (
            <HelpText>Rien d’autre à ajouter.</HelpText>
          ) : (
            <div className="voy-records">
              {free.map((line) => (
                <div
                  key={line.id}
                  className="voy-record"
                  data-voyrec={`${info.kind}:${line.id}`}
                >
                  <span className="voy-record-text">
                    <b>{line.name}</b>
                    {line.when ? <small>{line.when}</small> : null}
                  </span>
                  <Button
                    className="btn act-add"
                    data-voyrecadd={`${info.kind}:${line.id}`}
                    onClick={() => {
                      buzz();
                      moveRecord(info.kind, line.id, voyage.id);
                    }}
                  >
                    {tr('＋ Ajouter')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

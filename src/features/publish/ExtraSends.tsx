import type { ReactElement } from 'react';
import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import {
  boatById,
  deliver,
  sosLogText,
  state,
  toast,
} from '../../state/index.ts';

import {
  blankImport,
  blankPdf,
  blankSend,
  boatDocs,
  printBoatDossier,
} from './crossDomain.ts';
import { blankSheet } from './listDocument.ts';
import { LIST_TITLES, listItems } from './listKinds.ts';
import { listChoice } from './listPublishState.ts';
import { chosenItems } from './listSelection.ts';
import { printList } from './printList.tsx';
import { closeListPublish } from './publishWindowState.ts';
import type { ListKind } from './types.ts';

/** Props of {@link ExtraSends}. */
export interface ExtraSendsProps {
  /** The list. */
  kind: ListKind;
}

/**
 * Sends of a list besides its elements: blank sheets, dossier, log text.
 * @param props - List kind.
 * @returns The buttons of the « Autres envois » part.
 */
export function ExtraSends({ kind }: ExtraSendsProps): ReactElement | null {
  if (kind === 'people') return <PeopleSends />;
  if (kind === 'soslogs') return <SosLogSends />;
  if (kind === 'crews') {
    return (
      <div className="row">
        <BlankSheetButton kind={kind}>
          📄 Fiche équipage vide de contrôle
          <small>PDF à imprimer et remplir à la main</small>
        </BlankSheetButton>
      </div>
    );
  }
  if (kind === 'boats') return <BoatSends />;
  return null;
}

function PeopleSends(): ReactElement {
  const received = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <div className="row c2">
        <Button
          type="button"
          className="btn big"
          data-lxx="blSend"
          onClick={() => {
            void blankSend();
          }}
        >
          💬 Fiche vide<small>texte WhatsApp, Messages…</small>
        </Button>
        <Button
          type="button"
          className="btn big"
          data-lxx="blPdf"
          onClick={() => {
            closeListPublish();
            blankPdf();
          }}
        >
          📄 Fiche vide<small>PDF à imprimer</small>
        </Button>
      </div>
      <textarea
        ref={received}
        className="text"
        id="lxBlIn"
        rows={4}
        placeholder="Collez ici le message complété (une ou plusieurs fiches)"
      />
      <div className="row">
        <Button
          type="button"
          className="btn big primary"
          data-lxx="blRead"
          onClick={() => {
            const text = received.current?.value ?? '';
            closeListPublish();
            blankImport(text);
          }}
        >
          📥 Charger la fiche reçue
        </Button>
      </div>
    </>
  );
}

function SosLogSends(): ReactElement {
  return (
    <div className="row">
      <Button
        type="button"
        className="btn big"
        data-lxx="sostxt"
        onClick={sendLogTexts}
      >
        💬 Texte des logs cochés<small>WhatsApp, Messages, e-mail…</small>
      </Button>
    </div>
  );
}

function BoatSends(): ReactElement {
  const withScans = state.data.boats.value.some((boat) =>
    boatDocs(boat).some((document) => document.pdf),
  );
  return (
    <>
      <div className="row">
        <BlankSheetButton kind="boats">
          📄 Fiche bateau vide de contrôle
          <small>PDF à imprimer et remplir à la main</small>
        </BlankSheetButton>
      </div>
      {withScans ? (
        <div className="row">
          <Button
            type="button"
            className="btn big"
            data-lxx="dos"
            onClick={printCheckedDossier}
          >
            📎 Dossier avec les scans PDF
            <small>fiche et documents du bateau coché</small>
          </Button>
        </div>
      ) : null}
    </>
  );
}

function BlankSheetButton({
  kind,
  children,
}: {
  kind: ListKind;
  children: ReactElement | ReactElement[] | Array<string | ReactElement>;
}): ReactElement {
  return (
    <Button
      type="button"
      className="btn big"
      data-lxx="blank"
      onClick={() => {
        const sheet = blankSheet(kind, LIST_TITLES[kind], listItems(kind)[0]);
        closeListPublish();
        void printList(kind, [sheet]);
      }}
    >
      {children}
    </Button>
  );
}

function sendLogTexts(): void {
  const logs = chosenItems(listItems('soslogs'), listChoice('soslogs'))
    .map((item) => state.data.sosLogs.value.find((log) => log.id === item.id))
    .filter((log) => log !== undefined);
  const [first] = logs;
  if (!first) {
    toast('Rien de coché');
    return;
  }
  const text = logs.map((log) => sosLogText(log)).join('\n\n――――――――\n\n');
  const stamp = first.start.slice(0, 16).replaceAll(/[:T]/g, '-');
  void deliver(text, `log-sos-${stamp}.txt`, 'text/plain');
}

function printCheckedDossier(): void {
  const list = chosenItems(listItems('boats'), listChoice('boats'));
  const item =
    list.find((entry) =>
      boatDocumentsOf(entry.id).some((document) => document.pdf),
    ) ?? list[0];
  const boat = item ? boatById(item.id) : undefined;
  if (!boat) {
    toast('Rien de coché');
    return;
  }
  closeListPublish();
  void printBoatDossier(boat);
}

function boatDocumentsOf(id: string) {
  const boat = boatById(id);
  return boat ? boatDocs(boat) : [];
}

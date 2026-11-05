import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import type { StoredDocument } from '../../features/onwater/docStore.ts';
import {
  delDoc,
  getDoc,
  openDocBlob,
  putDoc,
} from '../../features/onwater/docStore.ts';
import { LEMAN_ARCGIS } from '../../features/onwater/externals.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import type { LemanDocument } from './lemanDocs.ts';
import { LEMAN_DOCS } from './lemanDocs.ts';

/** Documents whose site refused the direct download, for this session. */
const noDirectFetch = new Set<string>();

type DocumentRecords = Record<string, StoredDocument | null>;

/**
 * Screen `docs`: the documents required on board, kept in the app to open
 * without network (legacy `VIEWS.docs`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function DocsPage() {
  useSignals();
  const tr = useTr();
  const [records, setRecords] = useState<DocumentRecords>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const keepRecord = (id: string, record: StoredDocument | null) => {
    setRecords((known) => ({ ...known, [id]: record }));
  };
  const refresh = () => readRecords(keepRecord);
  useEffect(() => {
    let current = true;
    void readRecords((id, record) => {
      if (current) setRecords((known) => ({ ...known, [id]: record }));
    });
    return () => {
      current = false;
    };
  }, []);
  const chooseFile = (id: string) => {
    target.current = id;
    fileInput.current?.click();
  };
  const storeFile = async (file: File | undefined) => {
    if (!file || !target.current) return;
    await putDoc(target.current, {
      name: file.name,
      type: file.type,
      blob: file,
      at: new Date().toISOString(),
    });
    toast('Document gardé dans l’appli');
    await refresh();
  };
  return (
    <>
      <PageBack label="◀ Plus" data-go="more" onClick={() => go('more')}>
        {tr('◀ Plus')}
      </PageBack>
      <PageTitle
        helps={[
          'Exigés à bord de tout bateau autorisé à s’éloigner à plus de 300 m de la rive. Au-delà de 3,7 km de la rive, il faut en plus une carte de navigation du Léman (papier, ou électronique sur un GPS par exemple).',
        ]}
      >
        Documents obligatoires à bord
      </PageTitle>
      <a
        className="btn big link-btn"
        href={LEMAN_ARCGIS}
        target="_blank"
        rel="noopener"
      >
        {tr('🌐 Carte interactive du Léman (ArcGIS)')}
        <small>{tr('en ligne')}</small>
      </a>
      <div id="docList">
        {LEMAN_DOCS.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            record={records[document.id]}
            onChooseFile={chooseFile}
            onChanged={refresh}
          />
        ))}
      </div>
      <input
        ref={fileInput}
        type="file"
        id="docFile"
        accept="application/pdf,image/*"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          void storeFile(file);
        }}
      />
      <HelpText>
        Source : port de plaisance de Sciez, « Documents obligatoires à bord ».
        Les documents gardés dans l’appli restent sur ce téléphone seulement.
      </HelpText>
    </>
  );
}

async function readRecords(
  onRecord: (id: string, record: StoredDocument | null) => void,
): Promise<void> {
  /* eslint-disable no-await-in-loop -- five small reads, in the order shown */
  for (const document of LEMAN_DOCS) {
    onRecord(document.id, await getDoc(document.id));
  }
  /* eslint-enable no-await-in-loop */
}

interface DocumentCardProps {
  document: LemanDocument;
  /** Kept document; null when absent, undefined while reading. */
  record: StoredDocument | null | undefined;
  onChooseFile: (id: string) => void;
  onChanged: () => Promise<void>;
}

function DocumentCard({
  document,
  record,
  onChooseFile,
  onChanged,
}: DocumentCardProps) {
  const tr = useTr();
  const id = document.id;
  const url = document.url;
  const keepLabel = document.perso ? '📷 + photo' : '⬇ Garder dans l’appli';
  const [keepText, setKeepText] = useState(keepLabel);
  const [busy, setBusy] = useState(false);
  const keep = async () => {
    buzz();
    if (!url || noDirectFetch.has(id) || !navigator.onLine) {
      onChooseFile(id);
      return;
    }
    setBusy(true);
    setKeepText('Téléchargement…');
    try {
      const reply = await fetch(url, { mode: 'cors' });
      if (!reply.ok) throw new Error(String(reply.status));
      await putDoc(id, {
        name: url.split('/').pop() ?? '',
        type: 'application/pdf',
        blob: await reply.blob(),
        at: new Date().toISOString(),
      });
      toast('PDF gardé dans l’appli');
      setKeepText('⬇ Garder dans l’appli');
    } catch {
      noDirectFetch.add(id);
      setKeepText('📂 Choisir le PDF enregistré');
      toast(
        'Téléchargement direct refusé par le site : ouvrez-le en ligne, enregistrez-le dans Fichiers, puis « Choisir le PDF enregistré »',
      );
    }
    setBusy(false);
    await onChanged();
  };
  return (
    <FoldSection className="field doc" data-doc={id} title={document.title}>
      <HelpText>{document.note}</HelpText>
      <div className="doc-state" data-st={id}>
        <DocumentState document={document} record={record} />
      </div>
      <ButtonRow className="row c2">
        <Button
          className="btn primary"
          data-open={id}
          hidden={!record}
          onClick={() => {
            buzz();
            void getDoc(id).then((kept) => {
              if (kept) openDocBlob(kept);
            });
          }}
        >
          {tr('📄 Ouvrir')}
        </Button>
        {url ? (
          <a className="btn" href={url} target="_blank" rel="noopener">
            {tr('🌐 Ouvrir en ligne')}
          </a>
        ) : null}
        <Button
          className="btn"
          data-keep={id}
          disabled={busy}
          onClick={() => void keep()}
        >
          {tr(keepText)}
        </Button>
        <ArmedButton
          className="btn"
          data-del={id}
          hidden={!record}
          armedLabel="Confirmer ?"
          onClick={buzz}
          onConfirm={() => {
            void delDoc(id).then(onChanged);
          }}
        >
          {tr('🗑 Retirer')}
        </ArmedButton>
      </ButtonRow>
    </FoldSection>
  );
}

function DocumentState({
  document,
  record,
}: Pick<DocumentCardProps, 'document' | 'record'>) {
  const tr = useTr();
  if (record === undefined) return '…';
  if (record) {
    return (
      <>
        {tr('✅ Dans l’appli, disponible sans réseau ')}
        <small>
          ({record.name}, {fmtShortDate(new Date(record.at))})
        </small>
      </>
    );
  }
  return tr(
    document.url
      ? 'Pas encore dans l’appli : ouvrir en ligne, ou le garder pour l’avoir sans réseau.'
      : 'Ajoutez une photo ou un PDF de votre document.',
  );
}

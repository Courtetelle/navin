import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import type { StoredDocument } from '../../features/onwater/docStore.ts';
import { getDoc, putDoc } from '../../features/onwater/docStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import { DocumentCard } from './DocumentCard.tsx';
import { DOCS_HELP, LEMAN_DOCS } from './lemanDocs.ts';

type DocumentRecords = Record<string, StoredDocument | null>;

/**
 * Screen `docs`: the documents required on board, kept in the app to open
 * without network (legacy `VIEWS.docs`). Its content is also at the end of
 * Règles du Léman (Corban, 27/11).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function DocsPage() {
  useSignals();
  const tr = useTr();
  return (
    <>
      <PageBack label="◀ Plus" data-go="more" onClick={() => go('more')}>
        {tr('◀ Plus')}
      </PageBack>
      <PageTitle helps={[DOCS_HELP]}>Documents obligatoires à bord</PageTitle>
      <DocsBody />
    </>
  );
}

/**
 * The documents required on board, each with its file kept in the app.
 * @returns The list.
 */
export function DocsBody() {
  useSignals();
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
      <SiteLink id="docs-arcgis-leman" />
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

import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import type { StoredDocument } from '../../features/onwater/docStore.ts';
import { getDoc, putDoc } from '../../features/onwater/docStore.ts';
import { LEMAN_ARCGIS } from '../../features/onwater/externals.ts';
import { useTr } from '../../i18n/useTr.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import { DocumentCard } from './DocumentCard.tsx';
import { LEMAN_DOCS } from './lemanDocs.ts';

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
      <LinkButton
        className="btn big link-btn"
        href={LEMAN_ARCGIS}
        target="_blank"
        rel="noopener"
      >
        {tr('🌐 Carte interactive du Léman (ArcGIS)')}
        <small>{tr('en ligne')}</small>
      </LinkButton>
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

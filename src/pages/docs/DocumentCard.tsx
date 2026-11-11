import { useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { StoredDocument } from '../../features/onwater/docStore.ts';
import {
  delDoc,
  getDoc,
  openDocBlob,
  putDoc,
} from '../../features/onwater/docStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';

import type { LemanDocument } from './lemanDocs.ts';

/** Documents whose site refused the direct download, for this session. */
const noDirectFetch = new Set<string>();

/** Props of {@link DocumentCard}. */
interface DocumentCardProps {
  /** The document. */
  document: LemanDocument;
  /** Kept document; null when absent, undefined while reading. */
  record: StoredDocument | null | undefined;
  /** Ask the user for a file for this document. */
  onChooseFile: (id: string) => void;
  /** The kept document changed. */
  onChanged: () => Promise<void>;
}

/**
 * One document: its state and the buttons to open, keep or remove it.
 * @param props - Document and actions.
 * @returns The section.
 */
export function DocumentCard({
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
          <LinkButton className="btn" href={url} target="_blank" rel="noopener">
            {tr('🌐 Ouvrir en ligne')}
          </LinkButton>
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

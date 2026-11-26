import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { closeVoyageDoc, docShown } from './docShown.ts';

/**
 * The viewer of the app: the PDF or the photo over the whole page, with a
 * big ✖ Fermer at the top and « Ouvrir à part » when the device reads it
 * better in its own reader.
 * @param props - The document band it belongs to.
 * @param props.docId - Id of the document.
 * @returns The viewer, or nothing when another document is shown.
 */
export function DocViewer({ docId }: { docId: string }) {
  useSignals();
  const tr = useTr();
  const shown = docShown.value;
  const open = shown?.id === docId;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVoyageDoc();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => {
      globalThis.removeEventListener('keydown', onKey);
      // Leaving the page closes it too.
      if (docShown.value?.id === docId) closeVoyageDoc();
    };
  }, [open, docId]);
  if (!shown || !open) return null;
  return createPortal(
    <div
      className="doc-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={shown.title}
      data-docviewer={docId}
    >
      <div className="doc-viewer-bar">
        <b className="doc-viewer-title">{shown.title}</b>
        <a
          className="btn doc-viewer-out"
          href={shown.url}
          target="_blank"
          rel="noopener"
          onClick={buzz}
        >
          {tr('↗ Ouvrir à part')}
        </a>
        <button
          type="button"
          className="btn primary doc-viewer-close"
          data-docviewerclose={docId}
          onClick={() => {
            buzz();
            closeVoyageDoc();
          }}
        >
          {tr('✖ Fermer')}
        </button>
      </div>
      {shown.image ? (
        <div className="doc-viewer-body">
          <img src={shown.url} alt={shown.title} />
        </div>
      ) : (
        <iframe
          className="doc-viewer-body"
          src={shown.url}
          title={shown.title}
        />
      )}
    </div>,
    document.body,
  );
}

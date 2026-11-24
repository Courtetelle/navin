import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import type { VoyageDoc } from '../../model/voyages.ts';
import { OTHER_CAT, docCategories } from '../../model/voyages.ts';
import { state } from '../../state/index.ts';

import {
  docsOf,
  editVoyageDoc,
  importVoyageDoc,
  openVoyageDoc,
  removeVoyageDoc,
  shareVoyageDoc,
  titleFromName,
} from './voyageFiles.ts';

/**
 * The categories as buttons, the chosen one lit.
 * @param props - Chosen category and its change.
 * @param props.cat - Chosen category id.
 * @param props.onPick - A category was touched.
 * @returns The buttons.
 */
function CategoryPick({
  cat,
  onPick,
}: {
  cat: string;
  onPick: (cat: string) => void;
}) {
  const tr = useTr();
  return (
    <div className="chips voy-catpick">
      {docCategories(state.data.voyages.value).map((item) => (
        <Button
          key={item.id}
          choice
          className={`btn ${item.id === cat ? 'on' : ''}`}
          data-voycat={item.id}
          onClick={() => {
            buzz();
            onPick(item.id);
          }}
        >
          {tr(item.name)}
        </Button>
      ))}
    </div>
  );
}

/**
 * The title and the category of a document, before it is kept or when it
 * is changed.
 * @param props - Starting values and the two endings.
 * @param props.title - Title proposed.
 * @param props.cat - Category proposed.
 * @param props.okLabel - Words of the button that keeps.
 * @param props.onOk - Keep with this title and category.
 * @param props.onCancel - Give up.
 * @returns The form.
 */
function DocForm({
  title,
  cat,
  okLabel,
  onOk,
  onCancel,
}: {
  title: string;
  cat: string;
  okLabel: string;
  onOk: (title: string, cat: string) => void;
  onCancel: () => void;
}) {
  const tr = useTr();
  const [text, setText] = useState(title);
  const [chosen, setChosen] = useState(cat);
  return (
    <div className="voy-docform">
      <div className="cgrid">
        <div className="cf wide">
          <label htmlFor="voyDocTitle">{tr('Titre')}</label>
          <input
            id="voyDocTitle"
            className="text"
            value={text}
            placeholder={tr.placeholder('ex. Contrat de location')}
            autoComplete="off"
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      <h3 className="sub-h">{tr('Catégorie')}</h3>
      <CategoryPick cat={chosen} onPick={setChosen} />
      <ButtonRow className="row c2">
        <Button
          className="btn big primary"
          data-voydoc="ok"
          onClick={() => {
            buzz();
            onOk(text, chosen);
          }}
        >
          {tr(okLabel)}
        </Button>
        <Button
          className="btn big"
          data-voydoc="cancel"
          onClick={() => {
            buzz();
            onCancel();
          }}
        >
          {tr('Annuler')}
        </Button>
      </ButtonRow>
    </div>
  );
}

/**
 * The two import buttons, PDF and photo; the file chosen then gets its
 * title and category before it is kept.
 * @param props - Category proposed.
 * @param props.cat - Category proposed for the file.
 * @returns The buttons, or the form of the file chosen.
 */
export function DocImport({ cat = OTHER_CAT }: { cat?: string }) {
  const tr = useTr();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const choose = (accept: string, capture: boolean) => {
    const element = input.current;
    if (!element) return;
    buzz();
    element.accept = accept;
    if (capture) element.setAttribute('capture', 'environment');
    else element.removeAttribute('capture');
    element.click();
  };
  return (
    <div className="voy-import">
      {file ? (
        <>
          <p className="voy-file">
            {file.type.startsWith('image/') ? '🖼 ' : '📄 '}
            {file.name}
          </p>
          <DocForm
            title={titleFromName(file.name)}
            cat={cat}
            okLabel={busy ? 'Enregistrement…' : '✔ Garder le document'}
            onOk={(title, chosen) => {
              if (busy) return;
              setBusy(true);
              void importVoyageDoc(file, chosen, title).then(() => {
                setBusy(false);
                setFile(null);
              });
            }}
            onCancel={() => setFile(null)}
          />
        </>
      ) : (
        <ButtonRow className="row c3">
          <Button
            className="btn big act-add"
            data-voyadd="pdf"
            onClick={() => choose('application/pdf', false)}
          >
            {tr('＋ 📄 PDF')}
          </Button>
          <Button
            className="btn big act-add"
            data-voyadd="image"
            onClick={() => choose('image/*', false)}
          >
            {tr('＋ 🖼 Photo enregistrée')}
          </Button>
          <Button
            className="btn big act-add"
            data-voyadd="camera"
            onClick={() => choose('image/*', true)}
          >
            {tr('＋ 📷 Prendre une photo')}
          </Button>
        </ButtonRow>
      )}
      <input
        ref={input}
        type="file"
        hidden
        data-voyfile
        onChange={(event) => {
          const chosen = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = '';
          setFile(chosen);
        }}
      />
    </div>
  );
}

/**
 * One document: a touch opens it; below, change, delete, and share last.
 * @param props - The document.
 * @param props.doc - The document.
 * @param props.editing - The chapter is being changed: change and delete too.
 * @returns The band.
 */
function DocRow({ doc, editing }: { doc: VoyageDoc; editing: boolean }) {
  const tr = useTr();
  const [changing, setChanging] = useState(false);
  const image = doc.type.startsWith('image/');
  return (
    <div className="voy-doc" data-voydocid={doc.id}>
      <button
        type="button"
        className="section site-band voy-doc-band"
        onClick={() => {
          buzz();
          void openVoyageDoc(doc);
        }}
      >
        <span className="site-band-text">
          <b>
            {image ? '🖼 ' : '📄 '}
            {doc.title || doc.name}
          </b>
          <small>
            {doc.name}
            {doc.at ? ` · ${fmtShortDate(new Date(doc.at))}` : ''}
          </small>
        </span>
      </button>
      {changing ? (
        <DocForm
          title={doc.title}
          cat={doc.cat}
          okLabel="✔ Enregistrer"
          onOk={(title, cat) => {
            editVoyageDoc(doc.id, { title: title.trim() || doc.title, cat });
            setChanging(false);
          }}
          onCancel={() => setChanging(false)}
        />
      ) : (
        <ButtonRow className={editing ? 'row c3' : 'row'}>
          {editing ? (
            <Button
              className="btn"
              data-voydocedit={doc.id}
              onClick={() => {
                buzz();
                setChanging(true);
              }}
            >
              {tr('✏️ Modifier')}
            </Button>
          ) : null}
          {editing ? (
            <HoldDeleteButton
              className="btn danger"
              data-voydocdel={doc.id}
              onClick={buzz}
              onDelete={() => removeVoyageDoc(doc.id)}
            >
              {tr('🗑 Supprimer')}
            </HoldDeleteButton>
          ) : null}
          <Button
            className="btn ck-pub share-btn"
            data-voydocshare={doc.id}
            onClick={() => {
              buzz();
              void shareVoyageDoc(doc);
            }}
          >
            {tr('📤 Partager')}
          </Button>
        </ButtonRow>
      )}
    </div>
  );
}

/**
 * The documents of a category.
 * @param props - The category.
 * @param props.cat - Category id.
 * @param props.editing - The chapter is being changed.
 * @returns The bands, or a line saying there is none.
 */
export function DocList({ cat, editing }: { cat: string; editing: boolean }) {
  useSignals();
  const docs = docsOf(cat);
  if (docs.length === 0) {
    return <HelpText>Aucun document dans cette catégorie.</HelpText>;
  }
  return (
    <div className="voy-docs">
      {docs.map((doc) => (
        <DocRow key={doc.id} doc={doc} editing={editing} />
      ))}
    </div>
  );
}

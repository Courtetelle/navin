import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import type { UiEdit } from '../../model/logTypes.ts';
import { state, toast, updateUiEdits } from '../../state/index.ts';
import { setBodyClass } from '../bodyClass.ts';

import type { EditorTarget } from './uiEditState.ts';
import { editorTarget, uiEditMode, uiEditPick } from './uiEditState.ts';

const SIZES = [
  ['s', 'Petit'],
  ['m', 'Normal'],
  ['l', 'Grand'],
  ['xl', 'Très grand'],
] as const;
const WRAPS = [
  ['wrap', 'Retour à la ligne'],
  ['clip', 'Une ligne (coupée)'],
  ['roll', 'Déroulant au toucher'],
] as const;

/**
 * The label edit mode chrome (ui-edit.js:133-210): the bottom bar
 * (`#uiEditBar`: message, Naviguer / Modifier, ✔ Terminer) and the editor
 * sheet (`#uiEditor`) of the touched button.
 * @returns The bar and the sheet, in portals on `<body>`.
 */
export function UiEditor() {
  useSignals();
  const editing = uiEditMode.value;
  const pick = uiEditPick.value;
  const target = editorTarget.value;
  useEffect(() => {
    setBodyClass('ui-editing', editing);
    setBodyClass('ui-edit-nav', editing && !pick);
  }, [editing, pick]);
  return (
    <>
      {editing
        ? createPortal(
            <div id="uiEditBar">
              <span id="uiEditMsg">
                {pick
                  ? '✎ Touchez un bouton pour le modifier'
                  : '➜ Navigation : allez à la page voulue'}
              </span>
              <Button
                noUiEdit
                className="btn"
                id="uiEditNav"
                onClick={() => {
                  buzz();
                  uiEditPick.value = !uiEditPick.value;
                }}
              >
                {pick ? '➜ Naviguer' : '✎ Modifier'}
              </Button>
              <Button
                noUiEdit
                className="btn"
                id="uiEditDone"
                onClick={finishEditing}
              >
                ✔ Terminer
              </Button>
            </div>,
            document.body,
          )
        : null}
      {target
        ? createPortal(
            <EditorSheet key={target.key} target={target} />,
            document.body,
          )
        : null}
    </>
  );
}

function closeEditor(): void {
  editorTarget.value = null;
}

function finishEditing(): void {
  buzz();
  uiEditMode.value = false;
  toast(
    `${Object.keys(state.data.uiEdits.value).length} bouton(s) modifié(s). Exportez-les depuis Réglages pour les envoyer à Claude.`,
  );
}

function EditorSheet({ target }: { target: EditorTarget }) {
  useSignals();
  const stored = state.data.uiEdits.value[target.key];
  const [size, setSize] = useState(stored?.size ?? 'm');
  const [wrap, setWrap] = useState(stored?.wrap ?? 'wrap');
  const [label, setLabel] = useState(stored?.label || target.orig);
  const [sub, setSub] = useState(stored?.sub || target.origSub || '');
  const save = () => {
    const record: UiEdit = {
      view: target.key.split('|', 1)[0],
      orig: target.orig,
      at: new Date().toISOString(),
    };
    if (target.origSub != null) record.origSub = target.origSub;
    if (label.trim() && label.trim() !== target.orig) {
      record.label = label.trim();
    }
    if (sub.trim() && sub.trim() !== (target.origSub || '')) {
      record.sub = sub.trim();
    }
    if (size !== 'm') record.size = size;
    if (wrap !== 'wrap') record.wrap = wrap;
    updateUiEdits((edits) => {
      if (record.label || record.sub || size !== 'm' || record.wrap) {
        edits[target.key] = record;
      } else {
        Reflect.deleteProperty(edits, target.key);
      }
    });
    closeEditor();
    toast('Bouton modifié');
  };
  const reset = () => {
    updateUiEdits((edits) => {
      Reflect.deleteProperty(edits, target.key);
    });
    closeEditor();
    toast('Bouton remis d’origine');
  };
  return (
    <div
      id="uiEditor"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeEditor();
        else if ((event.target as Element).closest('button')) buzz();
      }}
    >
      <div className="ue-sheet">
        <h2>Modifier le bouton</h2>
        <p className="help">
          D’origine : <b>{target.orig || '(sans texte)'}</b>
          {target.origSub ? (
            <>
              <br />
              <small>{target.origSub}</small>
            </>
          ) : null}
        </p>
        <div className="cf">
          <label htmlFor="ueLabel">Texte du bouton</label>
          <input
            className="text"
            id="ueLabel"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        {target.origSub != null || stored?.sub ? (
          <div className="cf">
            <label htmlFor="ueSub">Petit texte</label>
            <input
              className="text"
              id="ueSub"
              type="text"
              value={sub}
              onChange={(event) => setSub(event.target.value)}
            />
          </div>
        ) : null}
        <h3>Taille du texte</h3>
        <div className="row c4">
          {SIZES.map(([value, text]) => (
            <Button
              noUiEdit
              key={value}
              className={size === value ? 'btn on' : 'btn'}
              data-uesize={value}
              onClick={() => setSize(value)}
            >
              {text}
            </Button>
          ))}
        </div>
        <h3>Texte long</h3>
        <div className="row c3">
          {WRAPS.map(([value, text]) => (
            <Button
              noUiEdit
              key={value}
              className={wrap === value ? 'btn on' : 'btn'}
              data-uewrap={value}
              onClick={() => setWrap(value)}
            >
              {text}
            </Button>
          ))}
        </div>
        <div className="row c2" style={{ marginTop: '14px' }}>
          <Button
            noUiEdit
            className="btn big primary"
            id="ueSave"
            onClick={save}
          >
            ✔ Enregistrer
          </Button>
          <Button
            noUiEdit
            className="btn big"
            id="ueCancel"
            onClick={closeEditor}
          >
            Annuler
          </Button>
        </div>
        {stored ? (
          <div className="row">
            <Button
              noUiEdit
              className="btn danger"
              id="ueReset"
              onClick={reset}
            >
              ↺ Revenir au bouton d’origine
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

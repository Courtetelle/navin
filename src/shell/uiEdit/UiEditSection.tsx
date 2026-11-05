import { useSignals } from '@preact/signals-react/runtime';
import { useRef } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { buzz } from '../../lib/dom.ts';
import { state, toast, updateUiEdits } from '../../state/index.ts';

import { exportEdits, importEdits } from './uiEditFiles.ts';
import { startUiEditing } from './uiEditState.ts';

/**
 * Settings › 🛠 Mode développeur › « ✎ Mode édition des boutons » (legacy
 * `uiEditHtml` + `bindUiEdit`, ui-edit.js:223-254): turn the edit mode on,
 * export / import the edits, reset every button.
 * @returns The settings section.
 */
export function UiEditSection() {
  useSignals();
  const count = Object.keys(state.data.uiEdits.value).length;
  const file = useRef<HTMLInputElement>(null);
  const plural = count > 1 ? 's' : '';
  return (
    <FoldSection title="✎ Mode édition des boutons">
      <HelpText nextIsRow>
        {`Renommer un bouton, changer la taille du texte, le retour à la ligne ou le texte déroulant. ${count} bouton${plural} modifié${plural}.`}
      </HelpText>
      <div className="row set-stack">
        <Button
          className="btn big primary"
          id="uiEditOn"
          onClick={() => {
            buzz();
            startUiEditing();
            toast('Touchez un bouton pour le modifier');
          }}
        >
          ✎ Activer le mode édition
          <small>toucher ensuite un bouton pour le modifier</small>
        </Button>
        <Button
          className="btn big"
          id="uiEditExport"
          disabled={count === 0}
          onClick={exportEdits}
        >
          ⇪ Exporter les modifications<small>fichier à envoyer à Claude</small>
        </Button>
        <Button
          className="btn big"
          id="uiEditImport"
          onClick={() => {
            buzz();
            file.current?.click();
          }}
        >
          ⇩ Importer<small>fichier de modifications</small>
        </Button>
        {count > 0 ? (
          <ArmedButton
            className="btn big danger"
            id="uiEditClear"
            armedLabel="Toucher encore : tout remettre d’origine"
            onConfirm={() => {
              updateUiEdits((edits) => {
                for (const key of Object.keys(edits)) {
                  Reflect.deleteProperty(edits, key);
                }
              });
              globalThis.location.reload();
            }}
          >
            ↺ Remettre tous les boutons d’origine
            <small>efface les modifications</small>
          </ArmedButton>
        ) : null}
      </div>
      <input
        type="file"
        id="uiEditFile"
        accept=".json,application/json"
        hidden
        ref={file}
        onChange={(event) => void importEdits(event.currentTarget)}
      />
    </FoldSection>
  );
}

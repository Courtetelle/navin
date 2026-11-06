import { useSignals } from '@preact/signals-react/runtime';
import { useRef } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
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
  const tr = useTr();
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
          {tr('✎ Activer le mode édition')}
          <small>{tr('toucher ensuite un bouton pour le modifier')}</small>
        </Button>
        <Button
          className="btn big"
          id="uiEditExport"
          disabled={count === 0}
          onClick={exportEdits}
        >
          {tr('⇪ Exporter les modifications')}
          <small>{tr('fichier à envoyer à Claude')}</small>
        </Button>
        <Button
          className="btn big"
          id="uiEditImport"
          onClick={() => {
            buzz();
            file.current?.click();
          }}
        >
          {tr('⇩ Importer')}
          <small>{tr('fichier de modifications')}</small>
        </Button>
        {count > 0 ? (
          <ArmedButton
            className="btn big danger"
            id="uiEditClear"
            armedLabel={tr('Toucher encore : tout remettre d’origine')}
            onConfirm={() => {
              updateUiEdits((edits) => {
                for (const key of Object.keys(edits)) {
                  Reflect.deleteProperty(edits, key);
                }
              });
              globalThis.location.reload();
            }}
          >
            {tr('↺ Remettre tous les boutons d’origine')}
            <small>{tr('efface les modifications')}</small>
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

import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { toast } from '../../state/index.ts';

import { activeTemplate, listTemplatesOf } from './listPublishState.ts';
import {
  addTemplate,
  renameTemplate,
  selectTemplate,
} from './listTemplateActions.ts';
import type { ListKind } from './types.ts';

/**
 * Print templates of a list: a button each, ＋ to add one, and the name of the
 * active one (emptied, it deletes the template).
 * @param props - The list.
 * @param props.kind - List kind.
 * @returns The block.
 */
export function TemplateChoice({ kind }: { kind: ListKind }): ReactElement {
  const { act, list } = listTemplatesOf(kind);
  const { id: activeId, name } = activeTemplate(kind);
  const input = useRef<HTMLInputElement>(null);
  const focusName = useRef(false);

  useEffect(() => {
    const element = input.current;
    if (!element) return undefined;
    if (focusName.current) {
      focusName.current = false;
      element.focus();
      element.select();
    }
    // The native `change` fires when the field is left, unlike React's onChange.
    const onChange = () => {
      element.value = element.value.trim();
      if (renameTemplate(kind, element.value)) toast('Modèle supprimé');
    };
    element.addEventListener('change', onChange);
    return () => {
      element.removeEventListener('change', onChange);
    };
  }, [kind, activeId, name]);

  return (
    <>
      <p className="help lx-sec-h">Modèles d’impression</p>
      <div className="lx-tpl">
        {list.map((template) => (
          <Button
            key={template.id}
            type="button"
            className={`btn no-navact ${template.id === act ? 'on' : ''}`}
            data-lxt={template.id}
            onClick={() => {
              selectTemplate(kind, template.id);
            }}
          >
            {template.name}
          </Button>
        ))}
        <Button
          type="button"
          className="btn no-navact lx-tadd"
          data-lxtadd="1"
          aria-label="Nouveau modèle"
          onClick={() => {
            focusName.current = true;
            addTemplate(kind);
          }}
        >
          ＋
        </Button>
      </div>
      <input
        key={`${activeId}|${name}`}
        ref={input}
        className="text lx-tname"
        data-lxtname="1"
        type="text"
        defaultValue={name}
        placeholder="Nom du modèle (effacer = supprimer le modèle)"
      />
    </>
  );
}

import type { FieldDefinition } from '../../model/field.ts';
import { state, updateDraft } from '../../state/index.ts';

/**
 * Free text of the hourly form (legacy `text`): every key stroke is saved, the
 * card itself is not redrawn while typing.
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The text area.
 */
export function TextEntry({ field }: { field: FieldDefinition }) {
  const value = state.data.draft.peek()?.v[field.key];
  return (
    <textarea
      className="text"
      placeholder="Le micro du clavier permet de dicter"
      defaultValue={typeof value === 'string' ? value : ''}
      onChange={(event) => {
        const text = event.target.value;
        updateDraft((draft) => {
          if (text) draft.v[field.key] = text;
          else Reflect.deleteProperty(draft.v, field.key);
        });
      }}
    />
  );
}

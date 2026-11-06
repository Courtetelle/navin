import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import { CK_UNITS } from '../../model/checklistSeeds.ts';

import type { EditableItem } from './checklistEditing.ts';

/** Props of {@link ItemsEditor}. */
export interface ItemsEditorProps {
  /** Items as read when the screen was drawn. */
  items: readonly EditableItem[];
  /** Changes the stored items and saves them. */
  onUpdate: (recipe: (items: EditableItem[]) => void) => void;
  /** Draws the screen again. */
  onRedraw: () => void;
}

/**
 * Rows of label, note, unit, ▲ and ✕, shared by lists and bases (legacy
 * `itemsEditHtml`, `itemsEditInput` and `itemsEditClick`).
 * @param props - Items and callbacks.
 * @returns The `.ck-edit` block.
 */
export function ItemsEditor({ items, onUpdate, onRedraw }: ItemsEditorProps) {
  const tr = useTr();
  const change = (index: number, recipe: (item: EditableItem) => void) => {
    onUpdate((stored) => {
      const item = stored[index];
      if (item) recipe(item);
    });
  };
  const rows = [];
  for (const { key, item, index } of keyedItems(items, itemName)) {
    rows.push(
      <div className="ck-row" key={key}>
        <textarea
          className="text"
          rows={2}
          data-lab={index}
          aria-label={`Point ${index + 1}`}
          defaultValue={item.label}
          onChange={(event) => {
            const value = event.target.value.trim();
            if (!value) return;
            change(index, (stored) => {
              stored.label = value;
            });
          }}
        />
        <textarea
          className="text ck-note-in"
          rows={1}
          data-note={index}
          placeholder={tr.placeholder('Action, précision (facultatif)')}
          defaultValue={item.note ?? ''}
          onChange={(event) => {
            const value = event.target.value.trim();
            change(index, (stored) => {
              if (value) stored.note = value;
              else Reflect.deleteProperty(stored, 'note');
            });
          }}
        />
        <label className="ck-unit">
          {tr('Valeur à saisir ')}
          <select
            data-unit={index}
            defaultValue={item.unit ?? ''}
            onChange={(event) => {
              const { value } = event.target;
              change(index, (stored) => {
                if (value) stored.unit = value;
                else Reflect.deleteProperty(stored, 'unit');
              });
            }}
          >
            {CK_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {tr(unitOption(unit))}
              </option>
            ))}
          </select>
        </label>
        <div className="ck-tools">
          <Button
            className="btn"
            data-up={index}
            disabled={index === 0}
            aria-label="Monter"
            onClick={() => {
              buzz();
              onUpdate((stored) => swap(stored, index - 1, index));
              onRedraw();
            }}
          >
            ▲
          </Button>
          <ArmedButton
            className="btn danger"
            data-del={index}
            aria-label="Supprimer"
            armedLabel={tr('Sûr ?')}
            onClick={() => buzz()}
            onConfirm={() => {
              onUpdate((stored) => {
                stored.splice(index, 1);
              });
              onRedraw();
            }}
          >
            ✕
          </ArmedButton>
        </div>
      </div>,
    );
  }
  return <div className="ck-edit">{rows}</div>;
}

function itemName(item: EditableItem): string {
  return item.id ?? item.label;
}

function unitOption(unit: string): string {
  if (!unit) return 'aucune';
  return unit === 'nb' ? 'nombre' : unit;
}

function swap(items: EditableItem[], first: number, second: number): void {
  const item = items[first];
  const other = items[second];
  if (!item || !other) return;
  items[first] = other;
  items[second] = item;
}

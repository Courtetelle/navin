import { useRef } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import {
  checklistCopyText,
  ckUnitLabel,
} from '../../features/checklists/checklistEditing.ts';
import {
  checklistOwner,
  ownerItems,
} from '../../features/checklists/checklistOwner.ts';
import { updateOwner } from '../../features/checklists/ownerUpdates.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import { CK_UNITS } from '../../model/checklistSeeds.ts';
import type { ChecklistItem } from '../../model/types.ts';
import { ckColon } from '../../state/boatMigrations.ts';
import { toast } from '../../state/index.ts';

import type { ChecklistModel } from './checklistModel.ts';

/** Props of {@link ChecklistQuickEdit}. */
export interface ChecklistQuickEditProps {
  model: ChecklistModel;
  /** Draws the screen again. */
  onRedraw: () => void;
  /** Draws the screen again, then centres the new point field. */
  onAdded: () => void;
}

/**
 * Edit mode of the ✎ button: text, order ▲▼, deletion and new points, in place
 * of the list (legacy `ckEditRows`).
 * @param props - Model and callbacks.
 * @returns The `.ck-ed` block.
 */
export function ChecklistQuickEdit({
  model,
  onRedraw,
  onAdded,
}: ChecklistQuickEditProps) {
  const tr = useTr();
  const newPoint = useRef<HTMLTextAreaElement>(null);
  const units = useRef(new Map<number, HTMLSelectElement>());
  const { items, ownerId, mode, property, boatName } = model;
  const update = (recipe: (items: ChecklistItem[]) => void) => {
    updateOwner(ownerId, mode, (owner) => {
      recipe(owner[property] as ChecklistItem[]);
    });
  };
  const change = (index: number, recipe: (item: ChecklistItem) => void) => {
    update((stored) => {
      const item = stored[index];
      if (item) recipe(item);
    });
  };
  const move = (from: number, to: number) => {
    buzz();
    update((stored) => {
      const [item] = stored.splice(from, 1);
      if (item) stored.splice(to, 0, item);
    });
    onRedraw();
  };
  const rows = [];
  for (const [index, item] of items.entries()) {
    rows.push(
      <div className="ck-ed-row" key={item.id}>
        <div className="ck-ed-arr">
          <Button
            type="button"
            className="btn"
            data-edup={index}
            disabled={index === 0}
            aria-label="Monter"
            onClick={() => move(index, index - 1)}
          >
            ▲
          </Button>
          <Button
            type="button"
            className="btn"
            data-eddn={index}
            disabled={index === items.length - 1}
            aria-label="Descendre"
            onClick={() => move(index, index + 1)}
          >
            ▼
          </Button>
        </div>
        <div className="ck-ed-mid">
          <textarea
            className="text"
            rows={2}
            data-edlab={index}
            aria-label={`Point ${index + 1}`}
            defaultValue={item.label}
            onChange={(event) => {
              const label = event.target.value.trim();
              if (!label) return;
              let unit: string | undefined;
              change(index, (stored) => {
                const hadUnit = Boolean(stored.unit);
                stored.label = label;
                ckColon(stored);
                if (!hadUnit) unit = stored.unit;
              });
              const select = units.current.get(index);
              if (unit && select) select.value = unit;
            }}
          />
          <label className="ck-ed-unit">
            {tr('Valeur ')}
            <select
              ref={(select) => {
                if (select) units.current.set(index, select);
                else units.current.delete(index);
              }}
              data-edunit={index}
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
                  {tr(ckUnitLabel(unit))}
                </option>
              ))}
            </select>
          </label>
        </div>
        <HoldDeleteButton
          type="button"
          className="btn danger ck-ed-del"
          data-eddel={index}
          aria-label="Supprimer"
          armedLabel="🗑"
          onClick={() => buzz()}
          onDelete={() => {
            update((stored) => {
              stored.splice(index, 1);
            });
            onRedraw();
          }}
        >
          🗑
        </HoldDeleteButton>
      </div>,
    );
  }
  return (
    <div className="ck-ed">
      {rows}
      <div className="ck-ed-new">
        <textarea
          ref={newPoint}
          className="text"
          rows={2}
          id="ckEdNew"
          placeholder={tr.placeholder(
            'Nouveau point, ex. Fermer la vanne des WC (finir par « : » pour saisir une valeur)',
          )}
        />
        <Button
          type="button"
          className="btn"
          id="ckEdAdd"
          onClick={() => {
            buzz();
            const label = (newPoint.current?.value ?? '').trim();
            if (!label) {
              toast('Écrivez le point à ajouter');
              newPoint.current?.focus();
              return;
            }
            const item: ChecklistItem = { id: uid(), label };
            ckColon(item);
            update((stored) => {
              stored.push(item);
            });
            toast(
              item.unit
                ? 'Point à valeur ajouté : choisissez l’unité'
                : 'Point ajouté',
            );
            onAdded();
          }}
        >
          {tr('＋ Ajouter ce point')}
        </Button>
      </div>
      <Button
        type="button"
        className="btn"
        id="ckEdCopy"
        onClick={() => {
          buzz();
          copyList(
            checklistCopyText(
              ownerId ? boatName : null,
              ownerItems(checklistOwner(), property),
            ),
          );
        }}
      >
        {tr('📋 Copier la liste (pour me l’envoyer)')}
      </Button>
    </div>
  );
}

function copyList(text: string): void {
  const { prompt: askToCopy } = globalThis;
  // `navigator.clipboard` is missing outside secure contexts.
  const written = navigator.clipboard
    ? navigator.clipboard.writeText(text)
    : Promise.reject(new Error('no clipboard'));
  written.then(
    () => toast('Liste copiée : collez-la dans le fil avec Claude'),
    () => {
      askToCopy('Copiez la liste :', text);
    },
  );
}

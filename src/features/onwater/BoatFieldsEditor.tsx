import { useSignals } from '@preact/signals-react/runtime';
import { produce } from 'immer';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { buzz } from '../../lib/dom.ts';
import type { Boat } from '../../model/types.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import {
  boatById,
  state,
  syncCruiseFromBoat,
  toast,
  updateBoat,
} from '../../state/index.ts';

import { TextInput } from './TextInput.tsx';
import {
  addLabel,
  flatLabels,
  moveLabel,
  removeLabel,
  renameStandard,
  standardLabel,
} from './boatFields.ts';

/** Props of {@link BoatFieldsEditor}. */
export interface BoatFieldsEditorProps {
  /** Boat edited. */
  boatId: string;
  /** Runs on the ✔ of the title (legacy `fieldsBack`). */
  onDone: () => void;
}

const HELP =
  'Mode ✎ : touchez un libellé pour le renommer (vide = libellé d’origine). Vos libellés : ▲ ▼ pour l’ordre, 🗑 appui long pour supprimer. Tout est enregistré tout seul.';

/**
 * Labels of a boat sheet, like the checklists' ✎ mode: rename, ▲ ▼ for the
 * order, 🗑 long press to delete, ＋ to add (legacy `renderBoatFields`).
 * @param props - Boat and exit.
 * @returns The screen content.
 */
export function BoatFieldsEditor({ boatId, onDone }: BoatFieldsEditorProps) {
  useSignals();
  useNavFields();
  const boat = boatById(boatId) as Boat;
  const [revision, setRevision] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const newLabel = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Legacy opened the sheet with these two lists set; the next save keeps them.
    state.data.boats.value = produce(state.data.boats.value, (boats) => {
      const draft = boats.find((item) => item.id === boatId);
      if (!draft) return;
      draft.custom ??= [];
      draft.hidden = [];
    });
  }, [boatId]);
  useEffect(() => {
    if (!flash) return undefined;
    // After the bubble measured the button it may cover, like legacy.
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`#lab_${flash}`)
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [flash, revision]);

  const change = (recipe: (draft: Boat) => void, focus?: string) => {
    updateBoat(boatId, recipe);
    const saved = boatById(boatId);
    if (saved) syncCruiseFromBoat(saved);
    setRevision((count) => count + 1);
    setFlash(focus ?? null);
  };
  const add = () => {
    buzz();
    const input = newLabel.current;
    const label = input?.value.trim();
    if (!label) {
      toast('Écrivez le nouveau libellé');
      input?.focus();
      return;
    }
    let id = '';
    updateBoat(boatId, (draft) => {
      id = addLabel(draft, label);
    });
    toast('Libellé ajouté : placez-le avec ▲ ▼');
    if (input) input.value = '';
    change(() => undefined, id);
  };
  const move = (id: string, step: number) => {
    buzz();
    if (moveLabel(structuredClone(boat), id, step)) {
      change((draft) => moveLabel(draft, id, step), id);
    }
  };
  const lines = flatLabels(boat);
  return (
    <>
      <PageTitle
        helps={[HELP]}
        titleText={boat.info.boat || 'Bateau'}
        atTop={revision === 0}
      >
        {boat.info.boat || 'Bateau'}
        <Button
          type="button"
          className="btn ck-editbtn on"
          id="cBack"
          aria-label="Terminer"
          onClick={() => {
            buzz();
            onDone();
          }}
        >
          ✔
        </Button>
      </PageTitle>
      <section className="field lab-order">
        {lines.map((line, index) => {
          if (line.sec) {
            return (
              <h3 key={`§${line.sec}`} className="sub-h">
                {line.sec}
              </h3>
            );
          }
          const { cid, key = '', label } = line;
          if (!cid) {
            return (
              <div key={key} className="lab-row lab-std">
                <TextInput
                  className="text"
                  data-slab={key}
                  defaultValue={label}
                  placeholder={standardLabel(key)}
                  aria-label="Libellé"
                  onInput={(event) => {
                    const { value } = event.currentTarget;
                    updateBoat(boatId, (draft) =>
                      renameStandard(draft, key, value),
                    );
                  }}
                />
              </div>
            );
          }
          return (
            <div
              key={`${cid}:${revision}`}
              className={
                flash === cid ? 'lab-row lab-own lab-flash' : 'lab-row lab-own'
              }
              id={`lab_${cid}`}
            >
              <TextInput
                className="text"
                data-clab={cid}
                defaultValue={label}
                aria-label="Libellé"
                onInput={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (!value) return;
                  updateBoat(boatId, (draft) => {
                    const custom = draft.custom?.find((c) => c.id === cid);
                    if (custom) custom.label = value;
                  });
                }}
              />
              <Button
                className="btn"
                data-cmv={cid}
                data-dir="-1"
                disabled={index <= 1}
                aria-label="Monter"
                onClick={() => move(cid, -1)}
              >
                ▲
              </Button>
              <Button
                className="btn"
                data-cmv={cid}
                data-dir="1"
                disabled={index >= lines.length - 1}
                aria-label="Descendre"
                onClick={() => move(cid, 1)}
              >
                ▼
              </Button>
              <HoldDeleteButton
                className="btn danger"
                data-cdel={cid}
                aria-label="Supprimer"
                onDelete={() => change((draft) => removeLabel(draft, cid))}
              >
                🗑
              </HoldDeleteButton>
            </div>
          );
        })}
      </section>
      <section className="field">
        <h3>Nouveau libellé</h3>
        <input
          ref={newLabel}
          className="text"
          id="cNew"
          type="text"
          placeholder="ex. Code du cadenas, Place au port…"
        />
        <ButtonRow className="row">
          <Button
            className="btn big primary no-navact act-add"
            id="cAdd"
            onClick={add}
          >
            ＋ Ajouter ce libellé
          </Button>
        </ButtonRow>
      </section>
    </>
  );
}

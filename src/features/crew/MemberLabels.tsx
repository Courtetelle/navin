import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { MEMBER_FIELDS } from '../../model/crewFields.ts';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { state, toast } from '../../state/index.ts';
import { MarqueeInput } from '../logbook/index.ts';

import {
  addCustomLabel,
  moveCustomLabel,
  removeCustomLabel,
  renameCustomLabel,
  renameMemberLabel,
} from './memberLabels.ts';

/** Props of {@link MemberLabels}. */
export interface MemberLabelsProps {
  /** Leaves the mode. */
  back: () => void;
  /** The title differs from the screen drawn before. */
  lead: boolean;
}

/**
 * The ✎ mode of the labels of the cards (legacy `renderMemberLabels`,
 * lake.js:1896): common to all the cards, saved at each change.
 * @param props - Exit action.
 * @returns The screen.
 */
export function MemberLabels({ back, lead }: MemberLabelsProps) {
  useSignals();
  useNavFields();
  const tr = useTr();
  const settings = state.preferences.settings.value;
  const alias = settings.memberAlias ?? {};
  const custom = settings.memberCustom ?? [];
  const newLabel = useRef<HTMLInputElement>(null);
  useMarquee(newLabel);
  const [flashed, setFlashed] = useState<string | null>(null);
  const [redrawn, setRedrawn] = useState(false);
  const flash = (id: string) => {
    setFlashed(id);
    setRedrawn(true);
    requestAnimationFrame(() => {
      document
        .querySelector(`#mlab_${CSS.escape(id)}`)
        ?.scrollIntoView({ block: 'center' });
    });
  };
  const add = () => {
    buzz();
    const input = newLabel.current;
    const text = input?.value.trim();
    if (!input || !text) {
      toast('Écrivez le nouveau libellé');
      input?.focus();
      return;
    }
    // The bubble places itself against the button, before the new row moves it.
    flushSync(() => toast('Libellé ajouté à toutes les fiches'));
    const id = addCustomLabel(text);
    input.value = '';
    flash(id);
  };
  return (
    <>
      <PageTitle
        atTop={lead && !redrawn}
        titleText="Fiches coéquipier·ère"
        helps={[
          'Mode ✎ : les libellés valent pour toutes les fiches. Touchez un libellé pour le renommer (vide = libellé d’origine). Vos libellés : ▲ ▼ pour l’ordre, 🗑 appui long pour supprimer. Tout est enregistré tout seul.',
        ]}
      >
        {tr('Fiches coéquipier·ère')}
        <Button
          type="button"
          className="btn ck-editbtn on no-navact"
          id="mlBack"
          aria-label="Terminer"
          onClick={() => {
            buzz();
            back();
          }}
        >
          ✔
        </Button>
      </PageTitle>
      <section className="field lab-order">
        {MEMBER_FIELDS.map((field) => (
          <div key={field.key} className="lab-row lab-std">
            <MarqueeInput
              className="text"
              data-mlab={field.key}
              defaultValue={alias[field.key] || field.label}
              placeholder={tr.placeholder(field.label ?? '')}
              aria-label="Libellé"
              onChange={(event) =>
                renameMemberLabel(field, event.target.value.trim())
              }
            />
          </div>
        ))}
        {custom.map((label, index) => (
          <div
            key={label.id}
            className={
              flashed === label.id
                ? 'lab-row lab-own lab-flash'
                : 'lab-row lab-own'
            }
            id={`mlab_${label.id}`}
          >
            <MarqueeInput
              className="text"
              data-mclab={label.id}
              defaultValue={label.label}
              aria-label="Libellé"
              onChange={(event) =>
                renameCustomLabel(label.id, event.target.value.trim())
              }
            />
            <Button
              className="btn"
              data-mmv={label.id}
              data-dir="-1"
              disabled={index === 0}
              aria-label="Monter"
              onClick={() => {
                buzz();
                moveCustomLabel(label.id, -1);
                flash(label.id);
              }}
            >
              ▲
            </Button>
            <Button
              className="btn"
              data-mmv={label.id}
              data-dir="1"
              disabled={index === custom.length - 1}
              aria-label="Descendre"
              onClick={() => {
                buzz();
                moveCustomLabel(label.id, 1);
                flash(label.id);
              }}
            >
              ▼
            </Button>
            <HoldDeleteButton
              className="btn danger"
              data-mdel={label.id}
              aria-label="Supprimer"
              onDelete={() => {
                removeCustomLabel(label.id);
                setFlashed(null);
                setRedrawn(true);
              }}
            >
              🗑
            </HoldDeleteButton>
          </div>
        ))}
      </section>
      <section className="field">
        <h3>{tr('Nouveau libellé')}</h3>
        <input
          ref={newLabel}
          className="text"
          id="mlNew"
          type="text"
          placeholder={tr.placeholder('ex. Taille de gilet, Club…')}
        />
        <ButtonRow>
          <Button
            className="btn big primary no-navact act-add"
            id="mlAdd"
            onClick={add}
          >
            {tr('＋ Ajouter ce libellé')}
          </Button>
        </ButtonRow>
      </section>
    </>
  );
}

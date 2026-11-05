import { untracked } from '@preact/signals-react';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { MarqueeInput } from '../../features/safety/MarqueeInput.tsx';
import { keyedItems } from '../../features/safety/keyedItems.ts';
import type { MobSection } from '../../features/safety/mobDefaults.ts';
import {
  mobSections,
  updateMobSections,
} from '../../features/safety/mobProcedures.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack, PageDone } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { toast } from '../../state/index.ts';

import { MobStepEditor } from './MobStepEditor.tsx';

/** Props of {@link MobEditSection}. */
export interface MobEditSectionProps {
  /** Index of the section. */
  index: number;
  onBack: () => void;
  onRedraw: () => void;
}

/**
 * Editor of one section: title, introduction, steps (legacy `renderMobEdit(si)`).
 * Fields save as they change; the title on screen stays until the next redraw.
 * @param props - Section and screen actions.
 * @returns The screen content.
 */
export function MobEditSection({
  index,
  onBack,
  onRedraw,
}: MobEditSectionProps) {
  useNavFields();
  const tr = useTr();
  const [section] = useState(() => untracked(mobSections)[index] as MobSection);
  const newTitle = useRef<HTMLInputElement>(null);
  const newDetails = useRef<HTMLTextAreaElement>(null);
  const position = useRef<HTMLSelectElement>(null);
  const steps = section.steps.length;
  const edit = (recipe: (target: MobSection) => void) => {
    updateMobSections((list) => {
      recipe(list[index] as MobSection);
    });
  };
  const back = () => {
    buzz();
    onBack();
  };
  return (
    <>
      <PageBack label="◀ Sections" id="meBack" onClick={back}>
        {tr('◀ Sections')}
      </PageBack>
      <h1>{tr(section.title)}</h1>
      <FoldSection title="Section">
        <MarqueeInput
          className="text"
          id="msTitle"
          defaultValue={section.title}
          autoComplete="off"
          onChange={(event) => {
            const title = event.target.value.trim();
            if (title) edit((target) => (target.title = title));
          }}
        />
        <textarea
          className="text"
          id="msIntro"
          rows={2}
          placeholder={tr.placeholder('Phrase d’introduction (facultatif)')}
          defaultValue={section.intro ?? ''}
          onChange={(event) => {
            const intro = event.target.value.trim();
            edit((target) => {
              if (intro) target.intro = intro;
              else delete target.intro;
            });
          }}
        />
        <label className="cf wide">
          <span>
            <input
              type="checkbox"
              id="msAl"
              defaultChecked={Boolean(section.allure)}
              onChange={(event) => {
                const { checked } = event.target;
                edit((target) => {
                  if (checked) target.allure = true;
                  else delete target.allure;
                });
              }}
            />
            {tr(' Option du barreur selon l’allure')}
          </span>
        </label>
      </FoldSection>
      <div className="ck-edit">
        {keyedItems(section.steps, (item) => item[0]).map(
          ({ key, item, index: step }) => (
            <MobStepEditor
              key={key}
              step={step}
              title={item[0]}
              details={item[1]}
              onEdit={edit}
              onRedraw={onRedraw}
            />
          ),
        )}
      </div>
      <FoldSection title="Nouvelle étape">
        <MarqueeInput
          ref={newTitle}
          className="text"
          id="meNew"
          placeholder={tr.placeholder('Titre de l’étape')}
          autoComplete="off"
        />
        <textarea
          ref={newDetails}
          className="text"
          id="meNewD"
          rows={2}
          placeholder={tr.placeholder('Détail (facultatif)')}
        />
        <label className="cf wide">
          <span>{tr('Placer après l’étape')}</span>
          <select
            ref={position}
            className="text"
            id="meAt"
            defaultValue={steps}
          >
            {keyedItems(section.steps, (item) => item[0]).map(
              ({ key, index: step }) => (
                <option key={key} value={step + 1}>
                  {step + 1}
                </option>
              ),
            )}
            <option value="0">{tr('au début')}</option>
          </select>
        </label>
        <ButtonRow>
          <Button
            className="btn big primary"
            id="meAdd"
            onClick={() => {
              buzz();
              const title = newTitle.current?.value.trim();
              if (!title) {
                toast('Écrivez le titre de l’étape');
                newTitle.current?.focus();
                return;
              }
              const details = newDetails.current?.value.trim() ?? '';
              const at = Number(position.current?.value);
              edit((target) => {
                target.steps.splice(at, 0, [title, details]);
              });
              toast('Étape ajoutée');
              onRedraw();
            }}
          >
            {tr('＋ Ajouter l’étape')}
          </Button>
        </ButtonRow>
      </FoldSection>
      <ButtonRow className="row c2">
        <PageDone
          label="✔ Terminé"
          className="btn big"
          id="meDone"
          onClick={back}
        >
          {tr('✔ Terminé')}
        </PageDone>
        <HoldDeleteButton
          className="btn danger"
          id="msDel"
          onClick={buzz}
          onDelete={() => {
            updateMobSections((list) => {
              list.splice(index, 1);
            });
            onBack();
          }}
        >
          {tr('🗑 Supprimer la section')}
        </HoldDeleteButton>
      </ButtonRow>
    </>
  );
}

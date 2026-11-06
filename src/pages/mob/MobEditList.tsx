import { untracked } from '@preact/signals-react';
import { useRef } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { MarqueeInput } from '../../features/logbook/index.ts';
import { MOB_KINDS } from '../../features/safety/mobDefaults.ts';
import {
  mobKind,
  mobSections,
  resetMobSections,
  updateMobSections,
} from '../../features/safety/mobProcedures.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import { PageBack, PageDone } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { toast } from '../../state/index.ts';

/** Props of {@link MobEditList}. */
export interface MobEditListProps {
  /** The screen shown before had another title (its help is then a lead). */
  freshTitle: boolean;
  onBack: () => void;
  onSection: (index: number) => void;
  onRedraw: () => void;
}

/**
 * Editor of a procedure: its sections (legacy `renderMobEdit(null)`).
 * @param props - Screen actions.
 * @returns The screen content.
 */
export function MobEditList({
  freshTitle,
  onBack,
  onSection,
  onRedraw,
}: MobEditListProps) {
  useNavFields();
  const tr = useTr();
  const titleInput = useRef<HTMLInputElement>(null);
  const optionInput = useRef<HTMLInputElement>(null);
  const sections = untracked(mobSections);
  const kind = untracked(() => mobKind.value);
  const back = () => {
    buzz();
    onBack();
  };
  return (
    <>
      <PageBack label="◀ Homme à la mer" id="meBack" onClick={back}>
        {tr('◀ Homme à la mer')}
      </PageBack>
      <PageTitle
        atTop={freshTitle}
        titleText={`Modifier : ${MOB_KINDS[kind]}`}
        helps={[
          'Touchez une section pour modifier ses étapes. Les sections « allure » sont les options du barreur.',
        ]}
      >
        {tr(`Modifier : ${MOB_KINDS[kind]}`)}
      </PageTitle>
      <div className="checks">
        {keyedItems(sections, (section) => section.title).map(
          ({ key, item: section, index }) => {
            const steps = section.steps.length;
            return (
              <div key={key} className="mob-sec-row">
                <Button
                  className="btn"
                  data-sec={index}
                  onClick={() => {
                    buzz();
                    onSection(index);
                  }}
                >
                  {tr(`${section.allure ? '⛵ ' : ''}${section.title}`)}
                  <small>
                    {tr(
                      `${steps} étape${steps > 1 ? 's' : ''}${section.allure ? ' · option du barreur' : ''}`,
                    )}
                  </small>
                </Button>
                <Button
                  className="btn"
                  data-sup={index}
                  disabled={index === 0}
                  aria-label="Monter"
                  onClick={() => {
                    buzz();
                    updateMobSections((list) => {
                      const moved = list[index] as (typeof list)[number];
                      list[index] = list[index - 1] as (typeof list)[number];
                      list[index - 1] = moved;
                    });
                    onRedraw();
                  }}
                >
                  ▲
                </Button>
              </div>
            );
          },
        )}
      </div>
      <FoldSection title="Nouvelle section">
        <MarqueeInput
          ref={titleInput}
          className="text"
          id="msNew"
          placeholder={tr.placeholder(
            'ex. Au largue, Récupération, Premiers secours',
          )}
          autoComplete="off"
        />
        <label className="cf wide">
          <span>
            <input ref={optionInput} type="checkbox" id="msAllure" />
            {tr(' Option du barreur selon l’allure')}
          </span>
        </label>
        <ButtonRow>
          <Button
            className="btn big primary"
            id="msAdd"
            onClick={() => {
              buzz();
              const title = titleInput.current?.value.trim();
              if (!title) {
                toast('Écrivez le titre de la section');
                titleInput.current?.focus();
                return;
              }
              const allure = optionInput.current?.checked;
              updateMobSections((list) => {
                list.push({
                  title,
                  steps: [],
                  ...(allure ? { allure: true } : {}),
                });
              });
              onSection(sections.length);
            }}
          >
            {tr('＋ Ajouter la section')}
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
        <ArmedButton
          className="btn"
          id="meReset"
          armedLabel={tr('Toucher encore : version d’origine')}
          onClick={buzz}
          onConfirm={() => {
            resetMobSections();
            onRedraw();
          }}
        >
          {tr('↺ Version d’origine')}
        </ArmedButton>
      </ButtonRow>
    </>
  );
}

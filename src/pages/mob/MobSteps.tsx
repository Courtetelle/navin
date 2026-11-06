import { untracked } from '@preact/signals-react';
import { Fragment } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import type { MobSection } from '../../features/safety/mobDefaults.ts';
import type { MobLogRecord } from '../../features/safety/mobLog.ts';
import {
  mobActive,
  mobLog,
  mobStepDone,
} from '../../features/safety/mobLog.ts';
import { mobAllure, mobSections } from '../../features/safety/mobProcedures.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { keyedItems } from '../../lib/keyedItems.ts';

/** Props of {@link MobSteps}. */
export interface MobStepsProps {
  log: MobLogRecord | null;
  onRedraw: () => void;
}

/**
 * The sections of the procedure, numbered across sections; the helmsman options
 * show as one group with a single option open.
 * @param props - Log and redraw.
 * @returns The sections.
 */
export function MobSteps({ log, onRedraw }: MobStepsProps) {
  const tr = useTr();
  const sections = untracked(mobSections);
  const options: MobSection[] = [];
  for (const section of sections) if (section.allure) options.push(section);
  const chosen = untracked(() => mobAllure.value);
  let number = 0;
  let optionsShown = false;
  const blocks = [];
  for (const section of sections) {
    if (!section.allure) {
      blocks.push(
        <Fragment key={`${section.title}-${blocks.length}`}>
          <h2 className="sub-h">{tr(section.title)}</h2>
          <StepList
            section={section}
            first={number}
            log={log}
            onRedraw={onRedraw}
          />
        </Fragment>,
      );
      number += section.steps.length;
    } else if (!optionsShown) {
      optionsShown = true;
      const current = options[chosen] as MobSection;
      blocks.push(
        <Fragment key={`allure-${blocks.length}`}>
          <h2 className="sub-h">{tr('Le barreur, selon l’allure')}</h2>
          <div className="row c3 mob-allures">
            {keyedItems(options, (option) => option.title).map(
              ({ key, item, index }) => (
                <Button
                  key={key}
                  className={index === chosen ? 'btn on' : 'btn'}
                  data-allure={index}
                  onClick={() => {
                    buzz();
                    mobAllure.value = index;
                    if (mobActive()) {
                      mobLog(`Allure choisie : ${item.title}`, {
                        type: 'allure',
                      });
                    }
                    onRedraw();
                  }}
                >
                  {tr(item.title)}
                </Button>
              ),
            )}
          </div>
          <StepList
            section={current}
            first={number}
            log={log}
            onRedraw={onRedraw}
          />
        </Fragment>,
      );
      number += current.steps.length;
    }
  }
  return blocks;
}

interface StepListProps extends MobStepsProps {
  section: MobSection;
  /** Number of steps before this list. */
  first: number;
}

function StepList({ section, first, log, onRedraw }: StepListProps) {
  const tr = useTr();
  return (
    <>
      {section.intro ? <p className="mob-intro">{tr(section.intro)}</p> : null}
      <ol
        className="mob-steps"
        start={first + 1}
        style={{ counterReset: `mob ${first}` }}
      >
        {keyedItems(section.steps, (step) => step[0]).map(
          ({ key: listKey, item: [title, details], index }) => {
            const key = `${section.id ?? section.title}#${index}`;
            const label = `${first + index + 1}. ${title}`;
            const done = mobStepDone(log, key);
            return (
              <li
                key={listKey}
                className={done ? 'mob-step done' : 'mob-step'}
                data-step={key}
                data-label={label}
                role="button"
                tabIndex={0}
                onClick={() => {
                  buzz();
                  if (mobStepDone(untracked(mobActive), key)) {
                    mobLog(`Annulé : ${label}`, { type: 'undo', key });
                  } else {
                    mobLog(label, { type: 'step', key });
                  }
                  onRedraw();
                }}
              >
                <b>{tr(title)}</b>
                {details ? <StepDetails text={details} /> : null}
                {done ? (
                  <em className="mob-done">
                    {tr('✓ fait à ')}
                    <TzTime date={done.t} seconds />
                  </em>
                ) : null}
              </li>
            );
          },
        )}
      </ol>
    </>
  );
}

function StepDetails({ text }: { text: string }) {
  const tr = useTr();
  return (
    <span>
      {keyedItems(text.split('\n'), String).map(({ key, item, index }) => (
        <Fragment key={key}>
          {index > 0 ? <br /> : null}
          {tr(item)}
        </Fragment>
      ))}
    </span>
  );
}

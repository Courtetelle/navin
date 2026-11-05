import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { ArmedButton } from '../../../components/shared/ArmedButton.tsx';
import { Button } from '../../../components/shared/Button.tsx';
import { ButtonRow } from '../../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../../components/shared/FoldSection.tsx';
import { HelpText } from '../../../components/shared/HelpText.tsx';
import { PageTitle } from '../../../components/shared/PageTitle.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { dayKey } from '../../../lib/format.ts';
import { TASK_TPL_DEFAULT } from '../../../model/taskTemplate.ts';
import type { Cruise } from '../../../model/types.ts';
import { go } from '../../../shell/router.ts';
import { state, updateCruise } from '../../../state/index.ts';

import { DayCard } from './DayCard.tsx';
import { aboardCrew, aboardPlan } from './aboardPlan.ts';
import { useKeepScroll } from './useKeepScroll.ts';

/** Props of {@link AboardPlanView}. */
export interface AboardPlanViewProps {
  /** Opens the template. */
  onEdit: () => void;
  /** Replace the person of a slot on a day. */
  onPick: (key: string, slot: number) => void;
}

/**
 * The rotation: people on board, today's tasks, the whole plan, crew, roles
 * (legacy `VIEWS.aboard`). Every change rebuilds the screen, so the sections
 * close again, like the legacy render.
 * @param props - Actions.
 * @returns The screen content.
 */
export function AboardPlanView({ onEdit, onPick }: AboardPlanViewProps) {
  const [revision, setRevision] = useState(0);
  const keepScroll = useKeepScroll();
  return (
    <PlanContent
      key={revision}
      onEdit={onEdit}
      onPick={onPick}
      onChanged={() => {
        keepScroll();
        setRevision((count) => count + 1);
      }}
    />
  );
}

function crewLines(crew: readonly string[]): ReactNode[] {
  const lines: ReactNode[] = [];
  for (const [index, name] of crew.entries()) {
    lines.push(<li key={index}>{name}</li>);
  }
  return lines;
}

function PlanContent({
  onEdit,
  onPick,
  onChanged,
}: AboardPlanViewProps & { onChanged: () => void }) {
  useSignals();
  const tr = useTr();
  const cruise = state.data.cruise.value as Cruise;
  const template = state.data.taskTpl.value ?? TASK_TPL_DEFAULT;
  const crew = aboardCrew(cruise);
  const plan = aboardPlan(cruise, template);
  const today = dayKey(new Date());
  const current = plan.find((day) => day.key === today);
  const named = cruise.crew.filter((member) =>
    (member.nom ?? '').trim(),
  ).length;
  const swapped = Object.keys(cruise.taskOv ?? {}).length > 0;
  const hasRoles =
    template.tasks.some((task) => task.desc) || Boolean(template.note);
  const setCount = (step: number) => {
    buzz();
    updateCruise((draft) => {
      draft.taskN = Math.max(1, Math.min(20, crew.length + step));
    });
    onChanged();
  };
  return (
    <>
      <PageTitle>À bord</PageTitle>
      <FoldSection title="Personnes à bord">
        {named ? (
          <>
            <div className="value" style={{ fontSize: '40px' }}>
              {crew.length}
            </div>
            <HelpText nextIsRow>
              {`D’après la liste d’équipage (${named} nom${named > 1 ? 's' : ''}).`}
            </HelpText>
          </>
        ) : (
          <>
            <ButtonRow className="row c3">
              <Button
                className="btn step"
                data-n="-1"
                onClick={() => setCount(-1)}
              >
                −1
              </Button>
              <div className="value" style={{ fontSize: '40px' }}>
                {crew.length}
              </div>
              <Button
                className="btn step"
                data-n="1"
                onClick={() => setCount(1)}
              >
                +1
              </Button>
            </ButtonRow>
            <HelpText nextIsRow>
              Ajoutez l’équipage pour voir les prénoms.
            </HelpText>
          </>
        )}
        <ButtonRow className="row">
          <Button
            className="btn"
            data-go="crew"
            onClick={() => {
              buzz();
              go('crew');
            }}
          >
            {tr('👥 Équipage')}
          </Button>
        </ButtonRow>
      </FoldSection>
      {current ? (
        <DayCard
          day={current}
          crew={crew}
          today={today}
          onPick={onPick}
          onChanged={onChanged}
        />
      ) : (
        <HelpText>
          La croisière n’a pas commencé ou est terminée : voir le plan complet
          ci-dessous.
        </HelpText>
      )}
      <details className="section" open={!current}>
        <summary>{tr(`Plan complet (${plan.length} jours)`)}</summary>
        <div className="aboard-all">
          {plan
            .filter((day) => day !== current)
            .map((day) => (
              <DayCard
                key={day.key}
                day={day}
                crew={crew}
                today={today}
                onPick={onPick}
                onChanged={onChanged}
              />
            ))}
        </div>
      </details>
      <details className="section">
        <summary>{tr('Équipiers')}</summary>
        <ol className="aboard-crew">{crewLines(crew)}</ol>
      </details>
      {hasRoles ? (
        <details className="section">
          <summary>{tr('Rôles')}</summary>
          <div className="aboard-roles">
            {template.tasks
              .filter((task) => task.desc)
              .map((task) => (
                <p key={task.id}>
                  <b>{tr(task.name)}</b>
                  {tr(` : ${task.desc}`)}
                </p>
              ))}
            {template.note ? <p>{tr(template.note)}</p> : null}
          </div>
        </details>
      ) : null}
      <HelpText nextIsRow>
        Chaque jour, chacun avance d’une tâche. Touchez un nom pour le remplacer
        ce jour-là, la case à gauche quand la tâche est faite.
      </HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          data-edit="1"
          onClick={() => {
            buzz();
            onEdit();
          }}
        >
          {tr('✎ Modifier le modèle')}
        </Button>
        <ArmedButton
          className="btn"
          data-reset="1"
          disabled={!swapped}
          armedLabel="Sûr ?"
          onClick={buzz}
          onConfirm={() => {
            updateCruise((draft) => {
              delete draft.taskOv;
            });
            onChanged();
          }}
        >
          {tr('↺ Effacer les échanges')}
        </ArmedButton>
      </ButtonRow>
    </>
  );
}

import type { ReactNode } from 'react';
import { Fragment } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { FoldSection } from '../../../components/shared/FoldSection.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { buzz } from '../../../lib/dom.ts';
import { keyToDate } from '../../../lib/format.ts';
import { DOW_LONG, TASK_TPL_DEFAULT } from '../../../model/taskTemplate.ts';
import { state, updateCruise } from '../../../state/index.ts';

import type { PlanDay, PlanRow } from './aboardPlan.ts';
import { slotIndex } from './aboardPlan.ts';

/** Props of {@link DayCard}. */
export interface DayCardProps {
  day: PlanDay;
  /** Crew names. */
  crew: readonly string[];
  /** Today's key. */
  today: string;
  /** Replace the person of a slot on a day. */
  onPick: (key: string, slot: number) => void;
  /** Rebuild the screen. */
  onChanged: () => void;
}

/**
 * The tasks of a day (legacy `dayCard`).
 * @param props - Day, crew and actions.
 * @returns The section.
 */
export function DayCard({ day, crew, today, onPick, onChanged }: DayCardProps) {
  const tr = useTr();
  const template = state.data.taskTpl.value ?? TASK_TPL_DEFAULT;
  const doneAll = (state.data.cruise.value?.taskDone ?? {}) as Record<
    string,
    string[] | undefined
  >;
  const done = new Set(doneAll[day.key]);
  const date = keyToDate(day.key);
  const isToday = day.key === today;
  let moment = '';
  if (day.first) moment = ' · arrivée';
  else if (day.last) moment = ' · départ';
  const title = `${DOW_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}${isToday ? ' · aujourd’hui' : ''}${moment}`;
  const items = day.rows
    .filter((row) => !row.off)
    .map((row) => (
      <TaskRow
        key={row.task.id}
        row={row}
        dayKey={day.key}
        crew={crew}
        done={done.has(row.task.id)}
        onToggle={() => {
          toggleDone(day.key, row.task.id);
          onChanged();
        }}
        onPick={(rank) => {
          buzz();
          onPick(day.key, slotIndex(template, row.task.id, rank));
        }}
      />
    ));
  if (day.last && template.end) {
    items.push(
      <p key="end" className="aboard-end">
        🧽 {tr(template.end)}
      </p>,
    );
  }
  return (
    <FoldSection
      className={isToday ? 'field aboard-day today' : 'field aboard-day'}
      data-day={day.key}
      title={tr(title)}
      titleText={title}
    >
      {items.length > 0 ? items : undefined}
    </FoldSection>
  );
}

function toggleDone(key: string, taskId: string): void {
  buzz();
  updateCruise((draft) => {
    const all = (draft.taskDone ?? {}) as Record<string, string[]>;
    const done = new Set(all[key]);
    if (done.has(taskId)) done.delete(taskId);
    else done.add(taskId);
    all[key] = [...done];
    draft.taskDone = all;
  });
}

function TaskRow({
  row,
  dayKey,
  crew,
  done,
  onToggle,
  onPick,
}: {
  row: PlanRow;
  dayKey: string;
  crew: readonly string[];
  done: boolean;
  onToggle: () => void;
  onPick: (rank: number) => void;
}) {
  const tr = useTr();
  const people: ReactNode[] = [];
  for (const [rank, person] of row.people.entries()) {
    people.push(
      <Fragment key={rank}>
        {rank > 0 ? ' ' : ''}
        <Button
          className="aboard-who"
          data-who={`${dayKey}|${row.task.id}|${rank}`}
          onClick={() => onPick(rank)}
        >
          {person + 1}. {crew[person]}
        </Button>
      </Fragment>,
    );
  }
  return (
    <div className={done ? 'aboard-row ok' : 'aboard-row'}>
      <Button
        className="btn aboard-done"
        data-done={`${dayKey}|${row.task.id}`}
        aria-label="Fait"
        onClick={onToggle}
      >
        {done ? '✔' : ''}
      </Button>
      <div className="aboard-task">
        <b>{tr(row.task.name)}</b>
        <span>{people}</span>
      </div>
    </div>
  );
}

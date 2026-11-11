import { dayKey, keyToDate } from '../../../lib/format.ts';
import type { Cruise, Task, TaskTemplate } from '../../../model/types.ts';

/** One place of the day: one person for one task. */
interface TaskSlot {
  task: Task;
  /** Rank of the person within the task. */
  rank: number;
}

/** A task of a day with the crew indexes doing it. */
export interface PlanRow {
  task: Task;
  /** Not done that day (first and last days). */
  off: boolean;
  people: number[];
}

/** One day of the plan. */
export interface PlanDay {
  /** Day key. */
  key: string;
  first: boolean;
  last: boolean;
  rows: PlanRow[];
}

const DAY_MS = 86_400_000;

/**
 * Crew of the rotation: the names of the crew list, else « Équipier n » for
 * the number of people chosen (legacy `aboardCrew`).
 * @param cruise - Cruise.
 * @returns One name per person.
 */
export function aboardCrew(cruise: Cruise): string[] {
  const names: string[] = [];
  for (const member of cruise.crew) {
    const name = (member.nom ?? '').trim();
    if (name) names.push(name);
  }
  const count = names.length || (cruise.taskN as number | undefined) || 8;
  return Array.from(
    { length: count },
    (_, index) => names[index] ?? `Équipier ${index + 1}`,
  );
}

/**
 * Days of the cruise: from its dates, else a week from its creation; 60 at most
 * (legacy `aboardDays`).
 * @param cruise - Cruise.
 * @returns Day keys.
 */
export function aboardDays(cruise: Cruise): string[] {
  const { du: from, au: to } = cruise.info;
  const start = from
    ? keyToDate(from)
    : keyToDate(dayKey(new Date(cruise.created || Date.now())));
  let end = to ? keyToDate(to) : null;
  if (!end || end < start) end = new Date(start.getTime() + 7 * DAY_MS);
  const days: string[] = [];
  for (
    let day = new Date(start);
    day <= end && days.length < 60;
    day = new Date(day.getTime() + DAY_MS)
  ) {
    days.push(dayKey(day));
  }
  return days;
}

/**
 * Number of people of a task; old templates may hold it as text.
 * @param task - Task.
 * @returns The number, 1 at least.
 */
export function taskPlaces(task: Task): number {
  const places: unknown = task.n;
  return Math.max(1, Number(places) || 1);
}

/**
 * The places of a day: one per person and per task, in the template's order
 * (legacy `taskSlots`).
 * @param template - Task template.
 * @returns The slots.
 */
export function taskSlots(template: TaskTemplate): TaskSlot[] {
  const slots: TaskSlot[] = [];
  for (const task of template.tasks) {
    const places = taskPlaces(task);
    for (let rank = 0; rank < places; rank++) slots.push({ task, rank });
  }
  return slots;
}

/**
 * The rotation: each day everyone moves on by one task, replacements of the day
 * taking over (legacy `aboardPlan`).
 * @param cruise - Cruise.
 * @param template - Task template.
 * @returns The plan.
 */
export function aboardPlan(cruise: Cruise, template: TaskTemplate): PlanDay[] {
  const size = aboardCrew(cruise).length;
  const days = aboardDays(cruise);
  const slots = taskSlots(template);
  const firstTask = Math.max(
    0,
    template.tasks.findIndex((task) => task.id === template.first),
  );
  const lastTask = template.tasks.findIndex(
    (task) => task.id === template.last,
  );
  const swaps = (cruise.taskOv ?? {}) as Record<
    string,
    Record<string, number> | undefined
  >;
  return days.map((key, day) => {
    const first = day === 0;
    const last = day === days.length - 1 && days.length > 1;
    const rows = template.tasks.map((task, taskIndex): PlanRow => {
      const people: number[] = [];
      for (const [slotIndex, slot] of slots.entries()) {
        if (slot.task !== task) continue;
        const swap = swaps[key]?.[slotIndex];
        people.push(
          swap != null && swap < size
            ? swap
            : (((slotIndex - day) % size) + size) % size,
        );
      }
      const off =
        (first && taskIndex < firstTask) ||
        (last && (lastTask === -1 || taskIndex > lastTask));
      return { task, off, people };
    });
    return { key, first, last, rows };
  });
}

/**
 * Slot index of a person of a task (legacy `data-who`).
 * @param template - Task template.
 * @param taskId - Task id.
 * @param rank - Rank of the person within the task.
 * @returns The index in {@link taskSlots}.
 */
export function slotIndex(
  template: TaskTemplate,
  taskId: string,
  rank: number,
): number {
  let seen = 0;
  for (const [index, slot] of taskSlots(template).entries()) {
    if (slot.task.id !== taskId) continue;
    if (seen === rank) return index;
    seen++;
  }
  return -1;
}

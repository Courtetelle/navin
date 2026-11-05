import { dayKey } from '../../lib/format.ts';
import type { NavigationEvent } from '../../shell/router.ts';
import {
  ensureDay,
  isLake,
  newDraft,
  saveDraft,
  setDraft,
  state,
  updateDraft,
} from '../../state/index.ts';
import { autoFillLakeDay } from '../boats/index.ts';

/**
 * Open the hourly form (start of legacy `VIEWS.new`): a draft is created when
 * missing, and the time follows the clock until it is set by hand.
 */
export function openDraft(): void {
  if (!state.data.draft.value) setDraft(newDraft());
  const draft = state.data.draft.value;
  if (draft && !draft.id && !draft.tManual) {
    updateDraft((form) => {
      form.t = new Date().toISOString();
    });
  } else {
    saveDraft();
  }
}

/**
 * Open a day sheet (start of legacy `VIEWS.day`): the day shown is kept, the
 * day exists from then on, and a lake day fills what it can.
 * @param arg - Day to show; otherwise the last day shown, or today.
 */
export function openDay(arg: unknown): void {
  const key =
    (typeof arg === 'string' && arg) ||
    state.view.currentDay.value ||
    dayKey(new Date());
  state.view.currentDay.value = key;
  ensureDay(key);
  if (isLake()) autoFillLakeDay(key);
}

/**
 * Prepare the screens of the logbook before they render, like the start of
 * their legacy `VIEWS.x`.
 * @param event - Navigation event.
 */
export function prepareScreen(event: NavigationEvent): void {
  if (event.phase !== 'after') return;
  if (event.to === 'new') openDraft();
  if (event.to === 'day') openDay(event.arg);
}

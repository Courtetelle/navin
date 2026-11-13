import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import {
  clearItem,
  saveObservation,
} from '../../features/checklists/checklistActions.ts';
import {
  photosFor,
  prepPublishDialog,
  prepReportCache,
  removePhoto,
  takePhoto,
} from '../../features/checklists/neighbours.ts';
import type { ChecklistItem } from '../../model/types.ts';
import { constatKey } from '../../model/views.ts';

/** How the list screen draws itself and the other screens of the page. */
export interface ChecklistNavigation {
  /** Draws the list again, then centres a field. */
  redraw: (centerOn?: string | null) => void;
  /** Shows another list. */
  showList: (list: string) => void;
  /** Opens the editor of the list. */
  showEdit: () => void;
  /** Opens the screen of a new list. */
  showNew: () => void;
  /** Deletes a photo, then draws the list again. */
  removePhoto: (id: string) => void;
  /** Asks whether the photos of an item put back to white are deleted. */
  askPhoto: (id: string) => void;
}

/**
 * Restart a list: every item white, without value nor photo.
 * @param list - List id.
 * @param items - Items of the list.
 */
export function resetList(list: string, items: readonly ChecklistItem[]): void {
  for (const item of items) {
    clearItem(item);
    for (const photo of photosFor(list)) {
      if (photo.item === item.id) removePhoto(photo.id);
    }
  }
}

/**
 * Write the observations of a list.
 * @param list - `dep` or `quit`.
 * @param text - Text typed.
 */
export function saveObservationText(list: string, text: string): void {
  saveObservation(constatKey(list), text);
}

/**
 * Add photos to the observations of a list, then draw again.
 * @param list - List id.
 * @param redraw - Draws the list again.
 */
export function addPhotoAndRedraw(list: string, redraw: () => void): void {
  takePhoto(list, () => redraw());
}

/**
 * Open the window sharing the PréP + check-in report.
 * @param format - The format chosen with « Partager ».
 */
export function publishChecklist(format: ShareFormat): void {
  prepPublishDialog(format);
}

/**
 * Prepare the report of the arrival list in the background, so that printing
 * starts from the tap.
 * @param list - List shown.
 */
export function warmReport(list: string): void {
  if (list === 'dep') prepReportCache();
}

/**
 * Centre a field in the screen once drawn.
 * @param selector - Selector of the field, if any.
 */
export function centerField(selector: string | null): void {
  if (!selector) return;
  document.querySelector(selector)?.scrollIntoView({ block: 'center' });
}

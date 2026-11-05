import { uid } from '../../lib/format.ts';
import type { CustomField } from '../../model/boatSheet.ts';
import { BOAT_SECTIONS, boatSections } from '../../model/boatSheet.ts';
import type { Boat } from '../../model/types.ts';

/** One line of the flat list of a boat sheet: a section title or a label. */
export interface LabelLine {
  /**
   * Section title.
   * @default undefined
   */
  sec?: string;
  /**
   * Field key.
   * @default undefined
   */
  key?: string;
  /**
   * Label shown.
   * @default undefined
   */
  label?: string;
  /**
   * Id of a custom field, null for a standard one.
   * @default undefined
   */
  cid?: string | null;
}

/**
 * Section titles and labels of a boat sheet, in the order shown.
 * @param boat - Boat.
 * @returns The lines.
 */
export function flatLabels(boat: Boat): LabelLine[] {
  const lines: LabelLine[] = [];
  for (const section of boatSections(boat)) {
    lines.push({ sec: section.title });
    for (const field of section.fields) {
      if (!field.label) continue;
      lines.push({
        key: field.key,
        label: field.label,
        cid: field.key.startsWith('x_') ? field.key.slice(2) : null,
      });
    }
  }
  return lines;
}

/**
 * Original label of a standard field.
 * @param key - Field key.
 * @returns The label, or `''`.
 */
export function standardLabel(key: string): string {
  for (const section of BOAT_SECTIONS) {
    const field = section.fields.find((item) => item.key === key);
    if (field) return field.label ?? '';
  }
  return '';
}

/**
 * Rename a standard label; empty or back to the original drops the renaming.
 * @param boat - Draft boat.
 * @param key - Field key.
 * @param text - Typed text.
 */
export function renameStandard(boat: Boat, key: string, text: string): void {
  const value = text.trim();
  boat.alias ??= {};
  if (value && value !== standardLabel(key)) boat.alias[key] = value;
  else Reflect.deleteProperty(boat.alias, key);
  if (Object.keys(boat.alias).length === 0) delete boat.alias;
}

/**
 * Add a custom label at the end of the « Informations » section.
 * @param boat - Draft boat.
 * @param label - New label.
 * @returns Its id.
 */
export function addLabel(boat: Boat, label: string): string {
  const lines = flatLabels(boat);
  const section = lines.findLastIndex((line) => line.sec === 'Informations');
  let last = lines.at(-1);
  if (section !== -1) {
    let index = section;
    while (index + 1 < lines.length && !lines[index + 1]?.sec) index++;
    last = lines[index];
  }
  const custom: CustomField = {
    id: uid(),
    label,
    after: anchorOf(last),
  };
  boat.custom ??= [];
  boat.custom.push(custom);
  return custom.id;
}

/**
 * Move a custom label one line up or down.
 * @param boat - Draft boat.
 * @param id - Custom field id.
 * @param step - `-1` or `1`.
 * @returns `true` when moved.
 */
export function moveLabel(boat: Boat, id: string, step: number): boolean {
  const lines = flatLabels(boat);
  const from = lines.findIndex((line) => line.cid === id);
  const to = from + step;
  if (from < 0 || to < 1 || to >= lines.length) return false;
  const [moved] = lines.splice(from, 1);
  lines.splice(to, 0, moved as LabelLine);
  reanchor(boat, lines);
  return true;
}

/**
 * Delete a custom label and its value.
 * @param boat - Draft boat.
 * @param id - Custom field id.
 */
export function removeLabel(boat: Boat, id: string): void {
  const position = boat.custom?.findIndex((custom) => custom.id === id) ?? -1;
  if (position < 0) return;
  reanchor(
    boat,
    flatLabels(boat).filter((line) => line.cid !== id),
  );
  boat.custom?.splice(position, 1);
  Reflect.deleteProperty(boat.info, `x_${id}`);
}

function anchorOf(line: LabelLine | undefined): string | undefined {
  return line?.sec ? `§${line.sec}` : line?.key;
}

function reanchor(boat: Boat, lines: LabelLine[]): void {
  for (const [index, line] of lines.entries()) {
    if (!line.cid) continue;
    const custom = boat.custom?.find((item) => item.id === line.cid);
    const previous = lines[index - 1];
    if (custom && previous) custom.after = anchorOf(previous);
  }
}

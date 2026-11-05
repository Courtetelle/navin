import { uid } from '../../lib/format.ts';
import type { ChecklistBase, ChecklistItem } from '../../model/types.ts';

/** An item as the editors see it: bases have no ids. */
export interface EditableItem {
  /** @default undefined */
  id?: string;
  label: string;
  /** @default undefined */
  action?: string;
  /** @default undefined */
  unit?: string;
  /** @default undefined */
  key?: string;
  /** @default undefined */
  note?: string;
  [key: string]: unknown;
}

/**
 * Items of a base, as the editors see them.
 * @param base - Checklist base.
 * @returns Its items.
 */
export function baseItems(base: ChecklistBase): EditableItem[] {
  return base.items as EditableItem[];
}

/**
 * Icon of a list (legacy `ckIcon`).
 * @param list - List id.
 * @returns ⛵, 🔒 or 📋.
 */
export function ckIcon(list: string): string {
  if (list === 'dep') return '⛵';
  return list === 'quit' ? '🔒' : '📋';
}

/**
 * Label of a unit in the in-place editor (legacy `ckUnitLab`).
 * @param unit - Unit.
 * @returns The label.
 */
export function ckUnitLabel(unit: string): string {
  if (!unit) return 'pas de valeur';
  return unit === 'nb' ? 'nombre sans unité' : unit;
}

/**
 * Items of a list as stored in a base: no id, no reading (legacy `toBaseItems`).
 * @param items - List items.
 * @returns Base items.
 */
export function toBaseItems(
  items: readonly EditableItem[],
): Array<Omit<ChecklistItem, 'id'>> {
  const out: Array<Omit<ChecklistItem, 'id'>> = [];
  for (const item of items) {
    if (item.key || item.action === 'releves') continue;
    out.push({
      label: item.label,
      ...(item.unit ? { unit: item.unit } : {}),
      ...(item.note ? { note: item.note } : {}),
    });
  }
  return out;
}

/**
 * Items of a base with new ids (legacy `fromBaseItems`).
 * @param items - Base items.
 * @returns List items.
 */
export function fromBaseItems(items: readonly EditableItem[]): ChecklistItem[] {
  return items.map((item) => ({ ...item, id: uid() }));
}

/**
 * Text of a list copied to the clipboard (legacy `ckEdCopy`).
 * @param boatName - Boat name, `null` for a cruise list.
 * @param items - List items.
 * @returns The text.
 */
export function checklistCopyText(
  boatName: string | null,
  items: readonly ChecklistItem[],
): string {
  const lines = items.map((item, index) => {
    const unit = item.unit === 'nb' ? 'nombre' : item.unit;
    return `${index + 1}. ${item.label}${item.unit ? ` [${unit}]` : ''}`;
  });
  return `Check-in ${boatName ?? ''} :\n${lines.join('\n')}`;
}

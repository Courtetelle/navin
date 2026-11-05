import type { ChecklistSlot, ModeKey } from '../../model/modes.ts';
import { CK_BUILTIN_CATS, CK_DEFS, isCkBuiltin } from '../../model/modes.ts';
import type {
  Boat,
  ChecklistDefinition,
  ChecklistItem,
  Cruise,
} from '../../model/types.ts';
import { boatById, curMode, state } from '../../state/index.ts';

/** Name and categories given to a built-in list (`owner.ckMeta[mode][list]`). */
export interface ChecklistListMeta {
  /** @default undefined */
  name?: string;
  /** @default undefined */
  cats?: string[];
}

/** Checklist fields shared by boats and cruises. */
export interface ChecklistFields {
  /** @default undefined */
  briefSeeded?: boolean;
  /** @default undefined */
  ckLists?: ChecklistDefinition[];
  /** @default undefined */
  ckMeta?: Partial<Record<ModeKey, Record<string, ChecklistListMeta>>>;
}

/** What owns the checklists: the boat of a lake outing, or a sea cruise. */
export type ChecklistOwnerRecord = (Boat | Cruise) & ChecklistFields;

/**
 * Id of the boat owning the lists, `null` when the open cruise owns them.
 * @param boatId - Boat asked for; the boat of the open lake outing by default.
 * @returns The boat id, if the boat exists.
 */
export function ownerBoatId(boatId?: string | null): string | null {
  const cruise = state.data.cruise.value;
  const wanted = boatId || (cruise?.type === 'lac' ? cruise.boatId : undefined);
  return boatById(wanted)?.id ?? null;
}

/**
 * Lists of the outing's boat, otherwise the lists of the cruise (selector part
 * of legacy `checklistOwner`, see {@link ensureChecklistOwner} for its seeding).
 * @param boatId - Boat asked for.
 * @returns The owner; `null` without boat nor open cruise.
 */
export function checklistOwner(
  boatId?: string | null,
): ChecklistOwnerRecord | null {
  const id = ownerBoatId(boatId);
  return (id ? boatById(id) : state.data.cruise.value) ?? null;
}

/**
 * Named lists of a mode: `[list id, owner property, name]` (legacy `ckDefs`).
 * @param mode - Mode, the current one by default.
 * @param owner - Owner, the one of the open cruise by default.
 * @returns The built-in lists, then the free lists.
 */
export function ckDefs(
  mode: ModeKey = curMode(),
  owner?: ChecklistOwnerRecord | null,
): ChecklistSlot[] {
  const record = ownerFor(mode, owner);
  const meta = record?.ckMeta?.[mode] ?? {};
  const builtin = CK_DEFS[mode].map(([list, property, name]): ChecklistSlot => [
    list,
    property,
    meta[list]?.name || name,
  ]);
  const free = (record?.ckLists ?? []).map((list): ChecklistSlot => [
    list.id,
    `ckx_${list.id}`,
    list.name,
  ]);
  return [...builtin, ...free];
}

/**
 * Owner property holding a list (legacy `ckProp`).
 * @param list - List id.
 * @param mode - Mode.
 * @param owner - Owner.
 * @returns The property name.
 */
export function ckProp(
  list: string,
  mode?: ModeKey,
  owner?: ChecklistOwnerRecord | null,
): string {
  const slot = ckDefs(mode, owner).find((item) => item[0] === list);
  return slot ? slot[1] : `ckx_${list}`;
}

/**
 * Name of a list (legacy `ckName`).
 * @param list - List id.
 * @param mode - Mode.
 * @param owner - Owner.
 * @returns The name, empty when unknown.
 */
export function ckName(
  list: string,
  mode?: ModeKey,
  owner?: ChecklistOwnerRecord | null,
): string {
  const slot = ckDefs(mode, owner).find((item) => item[0] === list);
  return slot ? slot[2] : '';
}

/**
 * Categories of a list (legacy `ckCats`).
 * @param list - List id.
 * @param mode - Mode, the current one by default.
 * @param owner - Owner.
 * @returns The categories.
 */
export function ckCats(
  list: string,
  mode: ModeKey = curMode(),
  owner?: ChecklistOwnerRecord | null,
): readonly string[] {
  const record = ownerFor(mode, owner);
  if (isCkBuiltin(list)) {
    return (
      record?.ckMeta?.[mode]?.[list]?.cats ??
      CK_BUILTIN_CATS[mode][list as 'dep' | 'quit']
    );
  }
  return record?.ckLists?.find((item) => item.id === list)?.cats ?? [];
}

/**
 * Items of an owner property; a sea cruise not opened yet reads the template.
 * @param owner - Owner.
 * @param property - Owner property.
 * @returns The items.
 */
export function ownerItems(
  owner: ChecklistOwnerRecord | null | undefined,
  property: string,
): readonly ChecklistItem[] {
  if (!owner) return [];
  const items = owner[property] as ChecklistItem[] | undefined;
  if (items) return items;
  if (owner !== state.data.cruise.value) return [];
  const template = state.data.seaTpl.value[property] as
    ChecklistItem[] | undefined;
  return template ?? [];
}

function ownerFor(
  mode: ModeKey,
  owner?: ChecklistOwnerRecord | null,
): ChecklistOwnerRecord | null {
  if (owner) return owner;
  return state.data.cruise.value && mode === curMode()
    ? checklistOwner()
    : null;
}

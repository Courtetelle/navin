import { roleLabel } from '../../model/crewFields.ts';
import type { FieldDefinition } from '../../model/field.ts';
import type { CrewSet, Member } from '../../model/types.ts';

import type { PublishItem, PublishRowData } from './types.ts';

/** A boat sheet section, as the boats domain gives it. */
export interface BoatSheetSection {
  /** Section title. */
  title: string;
  /** Its lines. */
  rows: readonly PublishRowData[];
}

/** The boat fields the list uses. */
export interface PublishableBoat {
  /** Id. */
  id: string;
  /** Boat name. */
  name: string;
  /** Sheet sections. */
  sections: readonly BoatSheetSection[];
  /** Document used as thumbnail, when it still exists. */
  hasThumb: boolean;
  /** Pictures among its documents. */
  photos: ReadonlyArray<{ id: string; cap?: string }>;
}

/**
 * Lines of a crew member sheet: every filled field, with its displayed label.
 * @param member - Member.
 * @param fields - Member fields, custom ones included.
 * @returns The lines.
 */
export function memberRows(
  member: Member,
  fields: readonly FieldDefinition[],
): PublishRowData[] {
  const rows: PublishRowData[] = [];
  for (const field of fields) {
    let value = member[field.key];
    if (!isFilled(value)) continue;
    let label = field.label ?? '';
    if (field.labelCycle) {
      const { key, options, suffix } = field.labelCycle;
      label = `${textValue(member[key]) || options[0]}${suffix ?? ''}`;
    }
    const shown = field.show?.[String(value)];
    if (shown) value = shown;
    if (field.key === 'sexe') label = '♂ / ♀';
    label = label.replace(/\s*\((?:avec indicatif|un par ligne)[^)]*\)/i, '');
    rows.push([label, Array.isArray(value) ? value.join(', ') : String(value)]);
  }
  return rows;
}

/**
 * Elements of the crew member list, sorted by name.
 * @param members - Members.
 * @param fields - Member fields, custom ones included.
 * @param nameOf - Name of a member.
 * @returns The elements.
 */
export function peopleItems(
  members: readonly Member[],
  fields: readonly FieldDefinition[],
  nameOf: (member: Member) => string,
): PublishItem[] {
  return members
    .toSorted((first, second) =>
      nameOf(first).localeCompare(nameOf(second), 'fr'),
    )
    .map((member) => {
      const name = nameOf(member) || '…';
      const photos = (member.photos ?? []) as Array<{
        id: string;
        cap?: string;
      }>;
      return {
        id: member.id,
        name,
        sections: [{ title: name, rows: memberRows(member, fields) }],
        photos: photos.map((photo, index) => ({
          id: photo.id,
          cap: photo.cap || `Photo ${index + 1}`,
        })),
        face: member.id,
      };
    });
}

/** Crew-set helpers of the state layer. */
export interface CrewSetHelpers {
  /** Name of a composition. */
  nameOf: (set: CrewSet) => string;
  /** Date line of a composition. */
  dateOf: (set: CrewSet) => string;
  /** Name of a member. */
  memberNameOf: (member: Member) => string;
}

/**
 * Elements of the crews list, sorted by name.
 * @param sets - Crew compositions.
 * @param members - Members.
 * @param helpers - Names and dates.
 * @returns The elements.
 */
export function crewItems(
  sets: readonly CrewSet[],
  members: readonly Member[],
  { nameOf, dateOf, memberNameOf }: CrewSetHelpers,
): PublishItem[] {
  return sets
    .toSorted((first, second) =>
      nameOf(first).localeCompare(nameOf(second), 'fr'),
    )
    .map((set) => {
      const people = set.crew.map((line, index) => {
        const member = members.find((item) => item.id === line.memberId);
        const role = line.fonction
          ? ` · ${roleLabel(line.fonction, member?.sexe)}`
          : '';
        return `${index + 1}. ${member ? memberNameOf(member) : '?'}${role}`;
      });
      const rows: PublishRowData[] = [['Personnes', people.join('\n') || '–']];
      if (set.name && set.ident) rows.unshift(['Numéro', set.ident]);
      const date = dateOf(set);
      if (date) rows.push(['Date', date]);
      const caption = set.photoCap as string | undefined;
      if (caption) rows.push(['Photo', caption]);
      const photo = set.photo as string | undefined;
      return {
        id: set.id,
        name: nameOf(set),
        sections: [{ title: nameOf(set), rows }],
        photos: photo ? [{ id: photo, cap: caption || 'Photo de groupe' }] : [],
      };
    });
}

/**
 * Elements of the boats list; the sheet sections can be switched off.
 * @param boats - Boats, with their sheets.
 * @returns The elements.
 */
export function boatItems(boats: readonly PublishableBoat[]): PublishItem[] {
  return boats.map((boat) => ({
    id: boat.id,
    name: boat.name,
    face: boat.hasThumb ? boat.id : null,
    faceRect: true,
    sections: boat.sections
      .map((section, index) => ({
        sk: section.title,
        title: `${index > 0 ? '' : `${boat.name} · `}${section.title}`,
        rows: section.rows.filter(([label]) => label !== 'Nom du bateau'),
      }))
      .filter((section) => section.rows.length > 0),
    photos: boat.photos.map((photo, index) => ({
      id: photo.id,
      cap: photo.cap || `Photo ${index + 1}`,
    })),
  }));
}

function isFilled(value: unknown): boolean {
  if (value == null || value === '') return false;
  return !(Array.isArray(value) && value.length === 0);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

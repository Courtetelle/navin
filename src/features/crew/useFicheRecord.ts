import type { RefObject } from 'react';
import { useRef, useState } from 'react';

import { uid } from '../../lib/format.ts';
import type { FieldData } from '../../model/field.ts';
import type { Member } from '../../model/types.ts';
import {
  memberKeysX,
  memberName,
  state,
  updateMembers,
} from '../../state/index.ts';

import { syncCrewFromMember } from './crewActions.ts';
import { cardFromForm } from './ficheRecord.ts';

/** The card being edited, saved at each change. */
export interface FicheRecord {
  /** The screen opened on a new card. */
  isNew: boolean;
  /** Current values (first and last name are in the inputs). */
  data: FieldData;
  /** Latest values, also between two renders. */
  latest: () => FieldData;
  /** Id of the saved card: null until the first name was typed. */
  recordId: string | null;
  /** Latest id. */
  latestId: () => string | null;
  /** Text of the title. */
  title: string;
  /** First name input. */
  prenomInput: RefObject<HTMLInputElement | null>;
  /** Last name input. */
  nomInput: RefObject<HTMLInputElement | null>;
  /** Replace the values, without saving. */
  change: (next: FieldData) => void;
  /** Save the card; returns null without a first name. */
  persist: () => Member | null;
}

/**
 * State of a card (legacy `renderFiche`): the card is created as soon as the
 * first name is typed, then saved at each change (lake.js:2204).
 * @param id - Member id, or `new`.
 * @returns The record.
 */
export function useFicheRecord(id: string): FicheRecord {
  const isNew = id === 'new';
  const [initial] = useState<Member | null>(
    () => state.data.members.peek().find((member) => member.id === id) ?? null,
  );
  const [data, setData] = useState<FieldData>(() => ({ ...initial }));
  const [recordId, setRecordId] = useState(isNew ? null : id);
  const [title, setTitle] = useState(
    initial ? memberName(initial) : 'Nouvelle fiche',
  );
  const dataRef = useRef(data);
  const idRef = useRef(recordId);
  const prenomInput = useRef<HTMLInputElement>(null);
  const nomInput = useRef<HTMLInputElement>(null);
  const change = (next: FieldData) => {
    dataRef.current = next;
    setData(next);
  };
  const persist = () => {
    const prenom = prenomInput.current?.value.trim() ?? '';
    const nom = nomInput.current?.value.trim() ?? '';
    if (!prenom) return null;
    const card = cardFromForm(
      idRef.current ?? uid(),
      { prenom, nom },
      dataRef.current,
      memberKeysX(),
    );
    const index = state.data.members
      .peek()
      .findIndex((member) => member.id === card.id);
    updateMembers((members) => {
      if (index === -1) members.push(card);
      else members[index] = card;
    });
    if (index === -1) {
      idRef.current = card.id;
      setRecordId(card.id);
    }
    if (state.data.cruise.peek() && !isNew) syncCrewFromMember(card);
    setTitle(memberName(card));
    return card;
  };
  return {
    isNew,
    data,
    latest: () => dataRef.current,
    recordId,
    latestId: () => idRef.current,
    title,
    prenomInput,
    nomInput,
    change,
    persist,
  };
}

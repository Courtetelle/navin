import { uid } from '../../lib/format.ts';
import { BOAT_KEYS } from '../../model/boatSheet.ts';
import { LAKE_CONTACTS } from '../../model/contacts.ts';
import type { FieldData } from '../../model/field.ts';
import type { Boat, Cruise, CruiseInfo } from '../../model/types.ts';
import {
  boatById,
  state,
  syncCruiseFromBoat,
  toast,
  updateBoat,
  updateBoats,
} from '../../state/index.ts';
import { delPhoto } from '../../storage/photos.ts';
import { store } from '../../storage/store.ts';

import type { BoatDocument } from './boatDocs.ts';
import { boatDocs, docKindName } from './boatDocs.ts';

/** A boat of a sea cruise not yet in the collection. */
export interface SeaBoat {
  name: string;
  cruiseId: string;
  cruiseName: string;
}

/**
 * Add an empty boat.
 * @returns Its id.
 */
export function addBoat(): string {
  const boat = newBoat({ contacts: LAKE_CONTACTS });
  updateBoats((boats) => {
    boats.push(boat);
  });
  return boat.id;
}

/**
 * Store new sheet values of a boat; the open outing of this boat follows.
 * @param id - Boat id.
 * @param info - The whole sheet values.
 */
export function saveBoatInfo(id: string, info: FieldData): void {
  updateBoat(id, (boat) => {
    boat.info = info;
  });
  const boat = boatById(id);
  if (boat) syncCruiseFromBoat(boat);
}

/**
 * Boats of the sea cruises that are not in the collection yet (legacy `seaBoatsNotKept`).
 * @returns One line per boat.
 */
export function seaBoatsNotKept(): SeaBoat[] {
  const seen = new Set(
    state.data.boats.value.map((boat) =>
      (boat.info.boat ?? '').trim().toLowerCase(),
    ),
  );
  const out: SeaBoat[] = [];
  for (const meta of state.data.index.value) {
    if (meta.type === 'lac') continue;
    const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    const name = (cruise?.info?.boat ?? '').trim();
    if (!cruise || !name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, cruiseId: meta.id, cruiseName: cruise.info.name ?? '' });
  }
  return out;
}

/**
 * Add the boat of a sea cruise to the collection.
 * @param cruiseId - Cruise id.
 * @returns The new boat id, null when the cruise is gone.
 */
export function keepSeaBoat(cruiseId: string): string | null {
  const cruise = store.get<Cruise | null>(`ldb.cruise.${cruiseId}`, null);
  if (!cruise) return null;
  const info: CruiseInfo = { contacts: cruise.info?.contacts ?? '' };
  for (const key of BOAT_KEYS) {
    const value = cruise.info[key];
    if (value != null && value !== '') info[key] = structuredClone(value);
  }
  const { id, ...lists } = newBoat(info);
  updateBoats((boats) => {
    boats.push({ id, sea: true, ...lists });
  });
  toast(`${info.boat ?? ''} ajouté au recueil`);
  return id;
}

/**
 * Change the caption of a document; the kind names a document without caption.
 * @param documentId - Document id.
 * @param value - Text typed.
 */
export function setBoatDocCaption(documentId: string, value: string): void {
  const owner = docOwner(documentId);
  if (!owner) return;
  updateBoat(owner.id, (boat) => {
    const document = (boat.docs as BoatDocument[]).find(
      (item) => item.id === documentId,
    );
    if (!document) return;
    const caption = value.trim();
    if (caption) document.cap = caption;
    else delete document.cap;
  });
}

/**
 * Text of `data-cap` for a document of Mes bateaux.
 * @param document - Document.
 * @returns Its caption, else the name of its kind.
 */
export function docCaption(document: BoatDocument): string {
  return document.cap || docKindName(document.kind);
}

/**
 * Delete a document and its photo.
 * @param documentId - Document id.
 */
export function removeBoatDoc(documentId: string): void {
  const owner = docOwner(documentId);
  if (!owner) return;
  updateBoat(owner.id, (boat) => {
    boat.docs = (boat.docs as BoatDocument[]).filter(
      (item) => item.id !== documentId,
    );
  });
  void delPhoto(documentId);
}

/**
 * Choose a photo as the thumbnail of a boat, or remove it when it already is.
 * @param id - Boat id.
 * @param documentId - Document id.
 */
export function toggleBoatThumb(id: string, documentId: string): void {
  let chosen = false;
  updateBoat(id, (boat) => {
    boat.thumb = boat.thumb === documentId ? null : documentId;
    chosen = Boolean(boat.thumb);
  });
  toast(chosen ? 'Vignette du bateau choisie' : 'Vignette retirée');
}

function newBoat(info: CruiseInfo): Boat {
  return {
    id: uid(),
    info,
    checklist: [],
    checklistDep: [],
    checklistX: [],
    checklistDepX: [],
  };
}

function docOwner(documentId: string): Boat | undefined {
  return state.data.boats.value.find((boat) =>
    boatDocs(boat).some((document) => document.id === documentId),
  );
}

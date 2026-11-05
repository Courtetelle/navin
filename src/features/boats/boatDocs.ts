import type { Boat } from '../../model/types.ts';

/** A photo or scan attached to a boat (`boat.docs[]`); the data lives in IndexedDB. */
export interface BoatDocument {
  id: string;
  /** Kind of document, one of {@link BOAT_DOC_KINDS}. */
  kind: string;
  /** ISO time it was added. */
  t: string;
  /**
   * A PDF scan rather than a photo.
   * @default undefined
   */
  pdf?: boolean;
  /**
   * Caption typed by the user.
   * @default undefined
   */
  cap?: string;
}

/** Document kinds of the boats collection: key and label. */
export const BOAT_DOC_KINDS: ReadonlyArray<readonly [string, string]> = [
  ['permis', '🪪 Permis de navigation'],
  ['titre', '📄 Carte grise / titre de navigation'],
  ['assurance', '🛡 Assurance'],
  ['fiche', '⛵ Fiche bateau / certificat'],
  ['autre', '📎 Autre document'],
];

/**
 * Label of a document kind (legacy `docKindLabel`).
 * @param kind - Kind key.
 * @returns The label with its icon.
 */
export function docKindLabel(kind: string): string {
  return (
    BOAT_DOC_KINDS.find((entry) => entry[0] === kind)?.[1] ?? '📎 Document'
  );
}

/**
 * Label of a document kind without its icon.
 * @param kind - Kind key.
 * @returns The label.
 */
export function docKindName(kind: string): string {
  return docKindLabel(kind).replace(/^\S+ /, '');
}

/**
 * Documents of a boat.
 * @param boat - Boat.
 * @returns Its documents, an empty list when it has none.
 */
export function boatDocs(boat: Boat): readonly BoatDocument[] {
  return (boat.docs as readonly BoatDocument[] | undefined) ?? [];
}

/**
 * Id of the thumbnail photo of a boat, when that photo still exists.
 * @param boat - Boat.
 * @returns The document id, or null.
 */
export function boatThumbId(boat: Boat): string | null {
  const thumb = boat.thumb as string | null | undefined;
  if (!thumb) return null;
  return boatDocs(boat).some((document) => document.id === thumb)
    ? thumb
    : null;
}

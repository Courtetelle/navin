/** Data lists that can be published through the « 📤 Publier » window. */
export type ListKind =
  'people' | 'crews' | 'boats' | 'traces' | 'marks' | 'ckbases' | 'soslogs';

/** Layout of the printed or image output. */
export type LxTheme = 'cards' | 'carnet' | 'mini';

/** One line of a published sheet: label and value. */
export type PublishRowData = [label: string, value: string];

/** A section of a published sheet. */
export interface PublishSection {
  /**
   * Key of a section the user can switch off (boat sheets: its title).
   * @default undefined
   */
  sk?: string;
  /** Title. */
  title: string;
  /** Lines. */
  rows: PublishRowData[];
}

/** A photo of a list item, by its id in the photo store. */
export interface PublishPhoto {
  /** Id in the photo store. */
  id: string;
  /** Caption. */
  cap: string;
}

/** One element of a data list, as the Publier window sees it. */
export interface PublishItem {
  /** Id. */
  id: string;
  /** Name in the list. */
  name: string;
  /** Sheet of the element. */
  sections: PublishSection[];
  /**
   * Full photos.
   * @default []
   */
  photos?: PublishPhoto[];
  /**
   * Id of the record whose thumbnail shows next to the name.
   * @default undefined
   */
  face?: string | null;
  /**
   * The thumbnail is a boat rectangle rather than a round face.
   * @default false
   */
  faceRect?: boolean;
}

/** A print template of a list: what is switched off, and the layout. */
export interface PublishTemplate {
  /** Id. */
  id: string;
  /** Name shown on its button. */
  name: string;
  /** Sections switched off (keys, `§photos`, `§face`). */
  offSec: string[];
  /** Section rows switched off (`section|label`). */
  offRow: string[];
  /**
   * Photos switched off.
   * @default []
   */
  offPh?: string[];
  /**
   * Layout.
   * @default 'cards'
   */
  theme?: LxTheme;
}

/** The print templates of one list. */
export interface ListTemplates {
  /** Id of the active template. */
  act: string;
  /** All templates. */
  list: PublishTemplate[];
}

/** What is switched off in a list. */
export interface ListChoice {
  /** Items switched off (session only). */
  off: string[];
  /** Sections switched off. */
  offSec: string[];
  /** Section rows switched off. */
  offRow: string[];
  /** Photos switched off. */
  offPh: string[];
}

/** A picture of an image card, with its caption. */
export interface CardsPhoto {
  /** Data URL of the picture. */
  url: string;
  /**
   * Caption written over the bottom of the picture.
   * @default ''
   */
  cap?: string;
}

/** One line of a card: label, value and the pictures drawn right under it. */
export type CardsRow = [
  label: string,
  value: string,
  photos?: readonly CardsPhoto[],
];

/** A titled block of lines. */
export interface CardsSection {
  /**
   * Section title; no title line when empty.
   * @default ''
   */
  title?: string;
  /** Lines of the section. */
  rows: readonly CardsRow[];
}

/** Everything {@link cardsPng} draws. */
export interface CardsDocument {
  /** Main title. */
  title: string;
  /**
   * Small line above the title (shown by the `mini` layout only).
   * @default ''
   */
  kicker?: string;
  /**
   * Line under the title.
   * @default ''
   */
  sub?: string;
  /**
   * Layout.
   * @default 'cards'
   */
  theme?: LxTheme;
  /**
   * Sections, in order.
   * @default []
   */
  sections?: readonly CardsSection[];
  /**
   * Full-width pictures at the end.
   * @default []
   */
  photos?: readonly CardsPhoto[];
  /**
   * Title of the pictures block.
   * @default 'Photos'
   */
  photosTitle?: string;
  /**
   * Data URL of the thumbnail next to the title.
   * @default null
   */
  avatar?: string | null;
  /**
   * The thumbnail is a rectangle (a boat) rather than a round face.
   * @default false
   */
  avatarRect?: boolean;
}

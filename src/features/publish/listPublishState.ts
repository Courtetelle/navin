import { signal } from '@preact/signals-react';
import type { Draft } from 'immer';
import { produce } from 'immer';

import { store } from '../../storage/store.ts';

import type {
  ListChoice,
  ListKind,
  ListTemplates,
  LxTheme,
  PublishTemplate,
} from './types.ts';

const STORAGE_KEY = 'ldb.lxTpl';

type Templates = Partial<Record<ListKind, ListTemplates>>;

/** Everything the Publier windows remember. */
interface PublishState {
  /** Print templates, as stored. */
  templates: Templates;
  /** What is switched off in each list, for this session. */
  choices: Partial<Record<ListKind, ListChoice>>;
  /** Lists whose active template was read into their choice. */
  loaded: Partial<Record<ListKind, boolean>>;
}

const NO_CHOICE: ListChoice = { off: [], offSec: [], offRow: [], offPh: [] };

const publishState = signal<PublishState | null>(null);

/**
 * What is switched off in a list.
 * @param kind - List kind.
 * @returns The choice.
 */
export function listChoice(kind: ListKind): ListChoice {
  return read().choices[kind] ?? NO_CHOICE;
}

/**
 * The print templates of a list.
 * @param kind - List kind.
 * @returns The templates (a default one when none was created yet).
 */
export function listTemplatesOf(kind: ListKind): ListTemplates {
  return read().templates[kind] ?? { act: 't1', list: [blankTemplate()] };
}

/**
 * The active print template of a list.
 * @param kind - List kind.
 * @returns The template.
 */
export function activeTemplate(kind: ListKind): PublishTemplate {
  const { act, list } = listTemplatesOf(kind);
  return list.find((template) => template.id === act) ?? blankTemplate();
}

/**
 * Layout chosen for a list (legacy `window.lxTheme`).
 * @param kind - List kind.
 * @returns The layout of its active template.
 */
export function listTheme(kind: ListKind): LxTheme {
  prepareList(kind);
  return activeTemplate(kind).theme ?? 'cards';
}

/**
 * Make sure a list has its templates and read the active one into its choice,
 * once per session.
 * @param kind - List kind.
 */
export function prepareList(kind: ListKind): void {
  update((draft) => {
    templatesIn(draft, kind);
    if (!draft.loaded[kind]) loadChoice(draft, kind);
  });
}

/** Forget everything read from the storage (tests). */
export function resetListPublishState(): void {
  publishState.value = null;
}

function read(): PublishState {
  publishState.value ??= {
    templates: store.get<Templates>(STORAGE_KEY, {}),
    choices: {},
    loaded: {},
  };
  return publishState.value;
}

/**
 * Change the state.
 * @param recipe - Immer recipe.
 */
export function update(recipe: (draft: Draft<PublishState>) => void): void {
  publishState.value = produce(read(), recipe);
}

/** Store the print templates. */
export function persist(): void {
  store.set(STORAGE_KEY, read().templates);
}

function blankTemplate(): PublishTemplate {
  return { id: 't1', name: 'Modèle 1', offSec: [], offRow: [] };
}

/**
 * The templates of a list in a draft, created and repaired when needed.
 * @param draft - State draft.
 * @param kind - List kind.
 * @returns The templates.
 */
export function templatesIn(
  draft: Draft<PublishState>,
  kind: ListKind,
): ListTemplates {
  draft.templates[kind] ??= { act: 't1', list: [blankTemplate()] };
  const templates = draft.templates[kind];
  if (templates.list.length === 0) templates.list.push(blankTemplate());
  if (!templates.list.some((template) => template.id === templates.act)) {
    templates.act = (templates.list[0] as PublishTemplate).id;
  }
  return templates;
}

/**
 * The active template of a list in a draft.
 * @param draft - State draft.
 * @param kind - List kind.
 * @returns The template.
 */
export function currentIn(
  draft: Draft<PublishState>,
  kind: ListKind,
): PublishTemplate {
  const { act, list } = templatesIn(draft, kind);
  return list.find((template) => template.id === act) as PublishTemplate;
}

/**
 * The choice of a list in a draft.
 * @param draft - State draft.
 * @param kind - List kind.
 * @returns The choice.
 */
export function choiceIn(
  draft: Draft<PublishState>,
  kind: ListKind,
): ListChoice {
  draft.choices[kind] ??= { ...NO_CHOICE };
  return draft.choices[kind];
}

/**
 * Read the active template into the choice of a list.
 * @param draft - State draft.
 * @param kind - List kind.
 */
export function loadChoice(draft: Draft<PublishState>, kind: ListKind): void {
  const current = currentIn(draft, kind);
  const choice = choiceIn(draft, kind);
  choice.offSec = [...current.offSec];
  choice.offRow = [...current.offRow];
  choice.offPh = [...(current.offPh ?? [])];
  draft.loaded[kind] = true;
}

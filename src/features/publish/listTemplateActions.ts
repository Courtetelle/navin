import {
  currentIn,
  loadChoice,
  persist,
  templatesIn,
  update,
} from './listPublishState.ts';
import type { ListKind } from './types.ts';

/**
 * Activate a template.
 * @param kind - List kind.
 * @param id - Template id.
 */
export function selectTemplate(kind: ListKind, id: string): void {
  update((draft) => {
    templatesIn(draft, kind).act = id;
  });
  persist();
  update((draft) => {
    loadChoice(draft, kind);
  });
}

/**
 * Add a template, a copy of the active one, and activate it.
 * @param kind - List kind.
 */
export function addTemplate(kind: ListKind): void {
  update((draft) => {
    const templates = templatesIn(draft, kind);
    const current = currentIn(draft, kind);
    const id = `t${Date.now().toString(36)}`;
    templates.list.push({
      id,
      name: `Modèle ${templates.list.length + 1}`,
      offSec: [...current.offSec],
      offRow: [...current.offRow],
      offPh: [...(current.offPh ?? [])],
      theme: current.theme ?? 'cards',
    });
    templates.act = id;
  });
  persist();
  update((draft) => {
    loadChoice(draft, kind);
  });
}

/**
 * Rename the active template; an empty name deletes it.
 * @param kind - List kind.
 * @param name - New name, trimmed.
 * @returns Whether the template was deleted.
 */
export function renameTemplate(kind: ListKind, name: string): boolean {
  update((draft) => {
    const templates = templatesIn(draft, kind);
    const current = currentIn(draft, kind);
    if (name) current.name = name;
    else templates.list = templates.list.filter((item) => item !== current);
    templatesIn(draft, kind);
  });
  persist();
  update((draft) => {
    loadChoice(draft, kind);
  });
  return !name;
}

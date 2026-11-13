import { CK_DEFS } from '../../model/modes.ts';
import { deliver, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** Properties of a boat that hold its lists, never its data. */
const LIST_PROPERTIES = new Set([
  ...Object.values(CK_DEFS).flatMap((slots) =>
    slots.map(([, property]) => property),
  ),
  'ckLists',
  'ckMeta',
]);

/** The menus of the app as the sailor shaped them, without any personal data. */
export interface MenusFile {
  kind: 'navin-menus';
  version: 1;
  /** ISO time of the export. */
  at: string;
  /** The lists of each boat (check-in, check-out, free lists, names, categories). */
  boats: Array<{ id: string; name: string; lists: Record<string, unknown> }>;
  /** The checklist bases. */
  bases: unknown;
  /** The lists a new sea cruise starts from. */
  seaTemplate: unknown;
  /** The task templates. */
  taskTemplates: unknown;
  /** The buttons renamed or reshaped with the pencil. */
  buttons: unknown;
  /** The weather checks before leaving, lake and sea. */
  weatherChecks: unknown;
}

/**
 * The menus of the app: the lists of each boat, the checklist bases, the
 * sea template, the task templates, the buttons changed with the pencil and
 * the weather checks. No crew card, no logbook, no key.
 * @returns The file content.
 */
export function menusFile(): MenusFile {
  return {
    kind: 'navin-menus',
    version: 1,
    at: new Date().toISOString(),
    boats: state.data.boats.value.map((boat) => ({
      id: boat.id,
      name: typeof boat.info.boat === 'string' ? boat.info.boat : '',
      lists: Object.fromEntries(
        Object.entries(boat).filter(
          ([key]) => LIST_PROPERTIES.has(key) || key.startsWith('ckx_'),
        ),
      ),
    })),
    bases: state.data.ckLib.value,
    seaTemplate: state.data.seaTpl.value,
    taskTemplates: store.get('ldb.taskTpl', null),
    buttons: state.data.uiEdits.value,
    weatherChecks: store.get('ldb.wx.list', null),
  };
}

/** Make the file of the menus and hand it over (share sheet: AirDrop to the Mac). */
export async function sendMenus(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await deliver(
    JSON.stringify(menusFile(), null, 2),
    `navin-menus-${date}.json`,
    'application/json',
  );
}

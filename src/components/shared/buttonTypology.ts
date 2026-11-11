/** Screens of the data tab whose button rows are stacked (nav.js:1179). */
const DATA_VIEWS: ReadonlySet<string> = new Set([
  'people',
  'crew',
  'crews',
  'boats',
  'ckbases',
  'marks',
  'traces',
  'docs',
  'lists',
  'cruises',
  'soslogs',
  'tasktpl',
  'dossier',
  'info',
  'export',
  'print',
  'stats',
  'rules',
  'cartes',
  'aboard',
  'log',
  'day',
  'nmea',
]);

const CHOICE_DATA = new Set([
  'data-sel',
  'data-v',
  'data-s',
  'data-set',
  'data-pick',
  'data-cat',
  'data-bcat',
  'data-theme',
  'data-crole',
  'data-cm',
  'data-f',
]);

/** A child of a `.row`, as the typology rules see it. */
export interface RowChild {
  /** Text content, trimmed by the rules. */
  text: string;
  /** Class attribute. */
  className: string;
  /**
   * `button` or `a` (other tags break the row rules).
   * @default 'button'
   */
  tag?: string;
  /**
   * Names of its `data-*` attributes.
   * @default []
   */
  data?: readonly string[];
  /**
   * Inside `.chips`, `.ck-tabs`, `.seg` or `.lang-row`.
   * @default false
   */
  inChoiceGroup?: boolean;
}

/** Classes computed for a row and its children. */
interface RowTypology {
  /** The row gets `row-stack`. */
  stacked: boolean;
  /** Final class attribute of each child, same order. */
  classNames: string[];
}

/**
 * Button typology of a `.row` (legacy `dataButtonsLayout` nav.js:1177-1193 on
 * data screens, then `plusTypology` nav.js:1223-1241 everywhere): a row of
 * plain action buttons (no choice button) is stacked full width, `＋` buttons
 * are blue (`act-add`, plus `primary` on data screens), the others white
 * (`act-plain`, `primary` removed) except `danger` and `auto-start`.
 * @param view - Current view.
 * @param children - Children of the row, in order.
 * @returns Whether the row is stacked and the classes of its children.
 */
export function rowTypology(
  view: string,
  children: readonly RowChild[],
): RowTypology {
  const classes = children.map(
    (child) => new Set(child.className.split(/\s+/).filter(Boolean)),
  );
  let stacked = false;
  if (DATA_VIEWS.has(view) && dataRowApplies(children, classes)) {
    stacked = true;
    for (const [index, child] of children.entries()) {
      const set = classes[index];
      if (!set) continue;
      if (isPlus(child.text)) {
        set.add('primary');
        set.add('act-add');
      } else if (!set.has('danger') && !set.has('auto-start')) {
        set.delete('primary');
        set.add('act-plain');
      }
    }
  }
  const plusRow = children.every(
    (child) =>
      (child.tag ?? 'button') === 'button' ||
      (child.tag === 'a' && hasClass(child, 'btn')),
  );
  const anyChoice = children.some((child) => isPlusChoice(child));
  for (const [index, child] of children.entries()) {
    const set = classes[index];
    if (!set || !isPlus(child.text) || isPlusChoice(child)) continue;
    set.add('act-add');
    if (!plusRow || anyChoice) continue;
    stacked = true;
    for (const [otherIndex, other] of children.entries()) {
      const otherSet = classes[otherIndex];
      if (!otherSet || otherIndex === index || isPlus(other.text)) continue;
      if (otherSet.has('danger') || otherSet.has('auto-start')) continue;
      otherSet.delete('primary');
      otherSet.add('act-plain');
    }
  }
  return { stacked, classNames: classes.map((set) => [...set].join(' ')) };
}

/**
 * Class of a `＋` button outside any `.row` (plusTypology): `act-add` unless it
 * is a choice button.
 * @param child - The button.
 * @returns Its final class attribute.
 */
export function plusButtonClass(child: RowChild): string {
  if (!isPlus(child.text) || isPlusChoice(child)) return child.className;
  if (hasClass(child, 'act-add')) return child.className;
  return `${child.className} act-add`.trim();
}

function isPlus(text: string): boolean {
  return /^(?:＋|\+)/.test(text.trim());
}

function hasClass(child: RowChild, name: string): boolean {
  return child.className.split(/\s+/).includes(name);
}

function hasChoiceData(child: RowChild): boolean {
  for (const name of child.data ?? []) if (CHOICE_DATA.has(name)) return true;
  return false;
}

function dataRowApplies(
  children: readonly RowChild[],
  classes: Array<Set<string>>,
): boolean {
  if (children.length === 0) return false;
  for (const [index, child] of children.entries()) {
    const tag = child.tag ?? 'button';
    if ((tag !== 'button' && tag !== 'a') || !classes[index]?.has('btn')) {
      return false;
    }
    if (
      hasChoiceData(child) ||
      hasClass(child, 'on') ||
      hasClass(child, 'chip') ||
      child.inChoiceGroup
    ) {
      return false;
    }
  }
  return true;
}

function isPlusChoice(child: RowChild): boolean {
  return (
    hasChoiceData(child) ||
    hasClass(child, 'chip') ||
    hasClass(child, 'top-tab') ||
    hasClass(child, 'cyc') ||
    Boolean(child.inChoiceGroup)
  );
}

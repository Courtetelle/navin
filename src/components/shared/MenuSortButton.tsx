import { useSignals } from '@preact/signals-react/runtime';

import type { SortedMenu } from '../../features/data/dataOrder.ts';
import { sortOf, toggleMenuSort } from '../../features/data/dataOrder.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

/** The other order of a menu, besides the alphabetical one. */
interface OtherOrder {
  /** Icon of the button. */
  icon: 'bars' | 'clock';
  /** « l’ordre … », after « toucher pour ». */
  name: string;
  /** The order said. */
  said: string;
  /** Said when chosen. */
  toast: string;
}

const USE_ORDER: OtherOrder = {
  icon: 'bars',
  name: 'l’ordre selon l’usage',
  said: 'Ordre selon l’usage',
  toast: 'Ordre selon l’usage : les plus ouverts montent',
};

const OTHER_ORDER: Partial<Record<SortedMenu, OtherOrder>> = {
  people: {
    icon: 'bars',
    name: 'l’ordre des sorties',
    said: 'Ordre des sorties',
    toast: 'Ordre des sorties : les plus souvent à bord en premier',
  },
  boats: {
    icon: 'bars',
    name: 'l’ordre des sorties',
    said: 'Ordre des sorties',
    toast: 'Ordre des sorties : les plus souvent pris en premier',
  },
  crews: {
    icon: 'clock',
    name: 'l’ordre de création',
    said: 'Ordre de création',
    toast: 'Ordre de création',
  },
  marks: {
    icon: 'clock',
    name: 'les plus récentes d’abord',
    said: 'Les plus récentes d’abord',
    toast: 'Les plus récentes d’abord',
  },
};

/**
 * The button at the right of the title of a menu: alphabetical order, or the
 * order of use (the entries opened most move up); each touch turns to the
 * other, kept until the next touch.
 * @param props - The menu.
 * @param props.menu - Which menu.
 * @returns The button.
 */
export function MenuSortButton({ menu }: { menu: SortedMenu }) {
  useSignals();
  const tr = useTr();
  const order = sortOf(menu);
  const other = OTHER_ORDER[menu] ?? USE_ORDER;
  const people = menu === 'people';
  return (
    <button
      type="button"
      className="btn menu-sort no-navact"
      data-menu-sort={menu}
      data-order={order}
      aria-label={tr(sortSaid(order, other, people))}
      onClick={() => {
        buzz();
        toggleMenuSort(menu);
        toast(sortToast(sortOf(menu), other, people));
      }}
    >
      <SortIcon icon={iconOf(order, other, people)} />
    </button>
  );
}

type Icon = 'alpha' | 'first' | 'family' | 'bars' | 'clock';

function iconOf(order: string, other: OtherOrder, people: boolean): Icon {
  if (order === 'family') return 'family';
  if (order === 'alpha') return people ? 'first' : 'alpha';
  return other.icon;
}

function nameOf(order: string, other: OtherOrder, people: boolean): string {
  if (order === 'family') return 'l’ordre alphabétique des noms';
  if (order === 'alpha') {
    return people ? 'l’ordre alphabétique des prénoms' : 'l’ordre alphabétique';
  }
  return other.name;
}

function nextOf(order: string, people: boolean): string {
  if (people) {
    return order === 'alpha' ? 'family' : order === 'family' ? 'use' : 'alpha';
  }
  return order === 'alpha' ? 'use' : 'alpha';
}

function sortSaid(order: string, other: OtherOrder, people: boolean): string {
  const now = nameOf(order, other, people);
  const next = nameOf(nextOf(order, people), other, people);
  return `${now.charAt(2).toUpperCase()}${now.slice(3)} : toucher pour ${next}`;
}

function sortToast(order: string, other: OtherOrder, people: boolean): string {
  if (order === 'family') return 'Ordre alphabétique des noms';
  if (order === 'alpha') {
    return people ? 'Ordre alphabétique des prénoms' : 'Ordre alphabétique';
  }
  return other.toast;
}

/**
 * The drawing of an order, in the colour of the text: a down arrow with A over
 * Z (alphabetical), with bars getting shorter (most used first), or a clock
 * (by date).
 * @param props - The order.
 * @param props.icon - Which drawing.
 * @returns The icon.
 */
function SortIcon({ icon }: { icon: Icon }) {
  // First names (P) or last names (N): the A→Z drawing with its letter.
  const badge = icon === 'first' ? 'P' : icon === 'family' ? 'N' : null;
  const wide = badge !== null;
  return (
    <svg
      className={wide ? 'menu-sort-icon wide' : 'menu-sort-icon'}
      viewBox={wide ? '0 0 36 24' : '0 0 24 24'}
      width={wide ? 36 : 24}
      height="24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === 'clock' ? (
        <>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 6.5V12l3.8 2.4" />
        </>
      ) : (
        <>
          <path d="M5 3v17M1.8 16.8 5 20.2l3.2-3.4" />
          {icon === 'bars' ? (
            <path d="M12 4h10M12 10h7.5M12 16h5M12 21.5h2.5" />
          ) : (
            <>
              <path d="M12.5 10.5 16.5 2l4 8.5M14 7.4h5" strokeWidth="2.2" />
              <path d="M12.8 13.5h7.4l-7.4 8h7.4" strokeWidth="2.2" />
            </>
          )}
          {badge ? (
            <>
              <rect
                x="24"
                y="5"
                width="11"
                height="14"
                rx="3"
                fill="currentColor"
                stroke="none"
              />
              <text
                x="29.5"
                y="15.8"
                textAnchor="middle"
                fontSize="11"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
                className="menu-sort-badge"
                stroke="none"
              >
                {badge}
              </text>
            </>
          ) : null}
        </>
      )}
    </svg>
  );
}

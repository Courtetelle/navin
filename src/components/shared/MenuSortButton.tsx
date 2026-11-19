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
  const alpha = sortOf(menu) === 'alpha';
  const other = OTHER_ORDER[menu] ?? USE_ORDER;
  return (
    <button
      type="button"
      className="btn menu-sort no-navact"
      data-menu-sort={menu}
      aria-label={tr(
        alpha
          ? `Ordre alphabétique : toucher pour ${other.name}`
          : `${other.said} : toucher pour l’ordre alphabétique`,
      )}
      onClick={() => {
        buzz();
        toggleMenuSort(menu);
        toast(alpha ? other.toast : 'Ordre alphabétique');
      }}
    >
      <SortIcon icon={alpha ? 'alpha' : other.icon} />
    </button>
  );
}

/**
 * The drawing of an order, in the colour of the text: a down arrow with A over
 * Z (alphabetical), with bars getting shorter (most used first), or a clock
 * (by date).
 * @param props - The order.
 * @param props.icon - Which drawing.
 * @returns The icon.
 */
function SortIcon({ icon }: { icon: 'alpha' | 'bars' | 'clock' }) {
  return (
    <svg
      className="menu-sort-icon"
      viewBox="0 0 24 24"
      width="24"
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
          {icon === 'alpha' ? (
            <>
              <path d="M12.5 10.5 16.5 2l4 8.5M14 7.4h5" strokeWidth="2.2" />
              <path d="M12.8 13.5h7.4l-7.4 8h7.4" strokeWidth="2.2" />
            </>
          ) : (
            <path d="M12 4h10M12 10h7.5M12 16h5M12 21.5h2.5" />
          )}
        </>
      )}
    </svg>
  );
}

import { useSignals } from '@preact/signals-react/runtime';

import type { SortedMenu } from '../../features/data/dataOrder.ts';
import { sortOf, toggleMenuSort } from '../../features/data/dataOrder.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

/** The other order of a menu, besides the alphabetical one. */
interface OtherOrder {
  /** Text of the button. */
  button: string;
  /** « l’ordre … », after « toucher pour ». */
  name: string;
  /** The order said. */
  said: string;
  /** Said when chosen. */
  toast: string;
}

const USE_ORDER: OtherOrder = {
  button: 'Usage',
  name: 'l’ordre selon l’usage',
  said: 'Ordre selon l’usage',
  toast: 'Ordre selon l’usage : les plus ouverts montent',
};

const OTHER_ORDER: Partial<Record<SortedMenu, OtherOrder>> = {
  people: {
    button: 'Sorties',
    name: 'l’ordre des sorties',
    said: 'Ordre des sorties',
    toast: 'Ordre des sorties : les plus souvent à bord en premier',
  },
  boats: {
    button: 'Sorties',
    name: 'l’ordre des sorties',
    said: 'Ordre des sorties',
    toast: 'Ordre des sorties : les plus souvent pris en premier',
  },
  crews: {
    button: 'Création',
    name: 'l’ordre de création',
    said: 'Ordre de création',
    toast: 'Ordre de création',
  },
  marks: {
    button: 'Récentes',
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
      {alpha ? 'A→Z' : tr(other.button)}
    </button>
  );
}

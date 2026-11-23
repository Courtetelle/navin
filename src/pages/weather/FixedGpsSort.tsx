import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { SortIcon } from '../../components/shared/MenuSortButton.tsx';
import { sortOf, toggleMenuSort } from '../../features/data/dataOrder.ts';
import { lastBoatSeen } from '../../features/map/trackerState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast } from '../../state/index.ts';

import { fixedNear } from './fixedSort.ts';

/** The last position known without asking the GPS. */
function knownPosition(): { lat: number; lon: number } | null {
  return state.view.lastFix.peek() ?? state.view.myPos.peek() ?? lastBoatSeen();
}

/** The three orders of the fixed alerts, in the turn of the button. */
type FixedOrder = 'alpha' | 'use' | 'gps';

const SAID: Record<FixedOrder, string> = {
  alpha: 'Ordre alphabétique, mer par mer : toucher pour l’ordre selon l’usage',
  use: 'Ordre selon l’usage, mer par mer : toucher pour trier selon la distance à votre position GPS',
  gps: 'Tri GPS, du plus proche au plus éloigné : toucher pour l’ordre alphabétique',
};

/**
 * The one sort button at the right of the title of the fixed alerts: each
 * touch turns to the next order, A → Z sea by sea, by use sea by sea, then
 * the whole list from the nearest zone to the farthest (GPS), and back.
 * @returns The button.
 */
export function FixedGpsSort() {
  useSignals();
  const tr = useTr();
  const [searching, setSearching] = useState(false);
  const on = fixedNear.value !== null;
  const order: FixedOrder = on
    ? 'gps'
    : sortOf('fixed') === 'use'
      ? 'use'
      : 'alpha';
  const sortFrom = (from: { lat: number; lon: number }) => {
    fixedNear.value = { lat: from.lat, lon: from.lon };
    toast('Tri GPS : de la zone la plus proche à la plus éloignée');
  };
  return (
    <button
      type="button"
      className={`btn menu-sort fx-gps no-navact${on ? ' on' : ''}${searching ? ' refreshing' : ''}`}
      data-fixed-gps={on ? 'on' : 'off'}
      data-fixed-order={order}
      aria-pressed={on}
      aria-busy={searching}
      disabled={searching}
      aria-label={tr(SAID[order])}
      onClick={() => {
        buzz();
        if (order === 'gps') {
          fixedNear.value = null;
          if (sortOf('fixed') !== 'alpha') toggleMenuSort('fixed');
          toast('Ordre alphabétique, mer par mer');
          return;
        }
        if (order === 'alpha') {
          toggleMenuSort('fixed');
          toast('Ordre selon l’usage : les plus ouvertes montent');
          return;
        }
        const known = knownPosition();
        if (!('geolocation' in navigator)) {
          if (known) sortFrom(known);
          else toast('GPS non disponible sur cet appareil');
          return;
        }
        setSearching(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setSearching(false);
            sortFrom({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },
          (error) => {
            setSearching(false);
            if (known) {
              sortFrom(known);
            } else {
              toast(
                error.code === 1
                  ? 'Autorisez la localisation dans les réglages'
                  : 'Pas de signal GPS, réessayez',
              );
            }
          },
          { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
        );
      }}
    >
      {order === 'gps' ? (
        <GpsIcon />
      ) : (
        <SortIcon icon={order === 'use' ? 'bars' : 'alpha'} />
      )}
    </button>
  );
}

function GpsIcon() {
  return (
    <svg
      className="menu-sort-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </svg>
  );
}

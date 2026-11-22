import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { lastBoatSeen } from '../../features/map/trackerState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast } from '../../state/index.ts';

import { fixedNear } from './fixedSort.ts';

/** The last position known without asking the GPS. */
function knownPosition(): { lat: number; lon: number } | null {
  return state.view.lastFix.peek() ?? state.view.myPos.peek() ?? lastBoatSeen();
}

/**
 * The GPS button at the right of the title of the fixed alerts: touched, the
 * whole list from the nearest zone to the farthest; touched again, sea by sea.
 * @returns The button.
 */
export function FixedGpsSort() {
  useSignals();
  const tr = useTr();
  const [searching, setSearching] = useState(false);
  const on = fixedNear.value !== null;
  const sortFrom = (from: { lat: number; lon: number }) => {
    fixedNear.value = { lat: from.lat, lon: from.lon };
    toast('Tri GPS : de la zone la plus proche à la plus éloignée');
  };
  return (
    <button
      type="button"
      className={`btn menu-sort fx-gps no-navact${on ? ' on' : ''}${searching ? ' refreshing' : ''}`}
      data-fixed-gps={on ? 'on' : 'off'}
      aria-pressed={on}
      aria-busy={searching}
      disabled={searching}
      aria-label={tr(
        on
          ? 'Tri GPS, du plus proche au plus éloigné : toucher pour le tri par mer'
          : 'Toucher pour trier selon la distance à votre position GPS',
      )}
      onClick={() => {
        buzz();
        if (on) {
          fixedNear.value = null;
          toast('Tri par mer');
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
    </button>
  );
}

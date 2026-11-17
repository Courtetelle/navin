import { useState } from 'react';

import type { ButtonProps } from '../../components/shared/Button.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

/** Props of {@link GpsButton}. */
interface GpsButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Receives the position read. */
  onPosition: (position: GeolocationPosition) => void;
}

/**
 * A button that reads the GPS (legacy `getGps`): disabled with « ⏳ Recherche
 * GPS… » meanwhile, a bubble when no position comes.
 * @param props - Button props and the position action.
 * @returns The button.
 */
export function GpsButton({ onPosition, children, ...rest }: GpsButtonProps) {
  const [searching, setSearching] = useState(false);
  return (
    <Button
      {...rest}
      // The rule of the « Actualiser » buttons: the look « en cours ».
      className={`${rest.className ?? 'btn'} refresh-btn${searching ? ' refreshing' : ''}`}
      data-refresh={searching ? 'running' : 'idle'}
      aria-busy={searching}
      disabled={searching}
      onClick={() => {
        buzz();
        if (!('geolocation' in navigator)) {
          toast('GPS non disponible sur cet appareil');
          return;
        }
        setSearching(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setSearching(false);
            onPosition(position);
          },
          (error) => {
            setSearching(false);
            toast(
              error.code === 1
                ? 'Autorisez la localisation dans les réglages'
                : 'Pas de signal GPS, réessayez',
            );
          },
          { enableHighAccuracy: true, timeout: 30_000, maximumAge: 10_000 },
        );
      }}
    >
      {searching ? (
        <>
          <span className="refresh-spin" aria-hidden="true">
            ↻
          </span>{' '}
          Recherche GPS en cours…
        </>
      ) : (
        children
      )}
    </Button>
  );
}

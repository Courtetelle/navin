import { toast } from '../../state/index.ts';

/**
 * Ask for one precise position (legacy `getGps`). Legacy disabled its button and
 * wrote `⏳ Recherche GPS…` in it: the caller does this from `onBusy`.
 * @param onBusy - Called with `true` while searching, then `false`.
 * @param onFix - Receives the position.
 */
export function getGps(
  onBusy: (busy: boolean) => void,
  onFix: (position: GeolocationPosition) => void,
): void {
  if (!('geolocation' in navigator)) {
    toast('GPS non disponible sur cet appareil');
    return;
  }
  onBusy(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onBusy(false);
      onFix(position);
    },
    (error) => {
      onBusy(false);
      toast(
        error.code === 1
          ? 'Autorisez la localisation dans les réglages'
          : 'Pas de signal GPS, réessayez',
      );
    },
    { enableHighAccuracy: true, timeout: 30_000, maximumAge: 10_000 },
  );
}

import { dayKey } from '../../lib/format.ts';
import { toast, updateDay } from '../../state/index.ts';

import { smnMeasure, wxNext } from './externals.ts';
import { lakeFix } from './lakeFix.ts';
import type { WeatherNow } from './weatherLogic.ts';
import { applyWeather } from './weatherLogic.ts';

/** How an update reports to the screen. */
interface LakeWeatherOptions {
  /**
   * No bubble: the automatic update of the screen.
   * @default false
   */
  quiet?: boolean;
  /**
   * Runs when the update really starts.
   * @default undefined
   */
  onStart?: () => void;
  /**
   * Runs when it ends without weather.
   * @default undefined
   */
  onFail?: () => void;
  /**
   * Runs after the weather is stored.
   * @default undefined
   */
  onDone?: () => void;
}

let busy = false;

/**
 * Read the closest MeteoSwiss station and the forecast at the boat's position,
 * keep them in today's sheet (legacy `updateLakeWx`).
 * @param options - Reporting.
 */
export function updateLakeWx(options: LakeWeatherOptions = {}): void {
  const { quiet = false, onStart, onFail, onDone } = options;
  if (busy) return;
  if (!navigator.onLine) {
    if (!quiet) toast('Pas de réseau : la dernière météo reste affichée');
    return;
  }
  busy = true;
  onStart?.();
  lakeFix((position) => {
    if (!position) {
      busy = false;
      onFail?.();
      if (!quiet) toast('Position GPS indisponible');
      return;
    }
    const { lat, lon } = position;
    void Promise.all([
      smnMeasure(lat, lon, new Date()).catch(() => null),
      wxNext(lat, lon, 9).catch(() => null),
    ]).then(([measure, forecast]) => {
      busy = false;
      if (!measure && !forecast) {
        onFail?.();
        if (!quiet) toast('Météo indisponible pour le moment');
        return;
      }
      const weather: WeatherNow = {
        at: Date.now(),
        meas: measure,
        fc: forecast,
      };
      updateDay(dayKey(new Date()), (day) => applyWeather(day, weather));
      if (!quiet) toast('🌤 Météo mise à jour');
      onDone?.();
    });
  });
}

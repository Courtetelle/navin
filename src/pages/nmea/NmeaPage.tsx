import { useSignals } from '@preact/signals-react/runtime';

import {
  GpxImportScreen,
  gpxImportPlan,
} from '../../features/tracking/index.ts';

import { NmeaScreen } from './NmeaScreen.tsx';

/**
 * Screen `nmea` (legacy `VIEWS.nmea`): the boat instruments, or the
 * confirmation of a file import.
 * @returns The screen content.
 */
export function NmeaPage() {
  useSignals();
  return gpxImportPlan.value ? <GpxImportScreen /> : <NmeaScreen />;
}

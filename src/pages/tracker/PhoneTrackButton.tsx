import { useSignals } from '@preact/signals-react/runtime';

import { useRails } from '../../lib/useWide.ts';
import { state } from '../../state/index.ts';

import { StartButton } from './StartButton.tsx';
import { TrackDoneButton, TrackRailButton } from './TrackRailButton.tsx';
import { trackDone } from './trackDone.ts';

/**
 * The phone's own track button, on the map: START at a short touch, then
 * every step of the track in itself (recording, pause, FIN, the tick), as on
 * the tablet. NavIn keeps none of them.
 * @returns The button, or nothing on the tablet (its column has it).
 */
export function PhoneTrackButton() {
  useSignals();
  // X and T have START in their buttons around the map.
  const rails = useRails();
  if (rails) return null;
  const tracking = state.view.tracking.value;
  return (
    <div className="phone-track">
      {tracking ? (
        <TrackRailButton />
      ) : trackDone.value ? (
        <TrackDoneButton />
      ) : (
        <StartButton />
      )}
    </div>
  );
}

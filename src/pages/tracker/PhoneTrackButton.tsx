import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { useRails } from '../../lib/useWide.ts';
import { domainActions } from '../../shell/topbar/tabDisplays.ts';
import { START_SVG } from '../../shell/topbar/tabIcons.ts';
import { state } from '../../state/index.ts';

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
  const tr = useTr();
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
        <Button
          type="button"
          noUiEdit
          className="rail-btn rail-start"
          aria-label={tr('START : démarrer la trace')}
          onClick={() => {
            buzz();
            domainActions.quickStart();
          }}
        >
          <span className="rail-icon">{markupToReact(START_SVG)}</span>
        </Button>
      )}
    </div>
  );
}

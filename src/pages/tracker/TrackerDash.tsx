import { useSignals } from '@preact/signals-react/runtime';

import { trackerDash } from '../../features/map/trackerDash.ts';
import { BarChevron } from '../../shell/BarChevron.tsx';

/**
 * The tracker dashboard: speed, course, distance, duration, top speed.
 * @returns `#trkDash`.
 */
export function TrackerDash() {
  useSignals();
  const dash = trackerDash.value;
  return (
    <div className="trk-dash" id="trkDash">
      <BarChevron bar="bottom" />
      <div>
        <b>{dash.speed}</b>
        <small>{dash.speedUnit}</small>
      </div>
      <div>
        <b>{dash.course}</b>
        <small>cap fond</small>
      </div>
      <div>
        <b>{dash.distance}</b>
        <small>NM</small>
      </div>
      <div>
        <b>{dash.duration}</b>
        <small>{dash.durationLabel}</small>
      </div>
      <div>
        <b>{dash.top}</b>
        <small>nd max</small>
      </div>
    </div>
  );
}

import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { trackerDash } from '../../features/map/trackerDash.ts';
import { nmeaFresh, nmeaLink } from '../../features/tracking/nmeaLive.ts';
import { fr, pad } from '../../lib/format.ts';
import { BarChevron } from '../../shell/BarChevron.tsx';

import { DASH_PACKETS, dashPage } from './railPages.ts';

/** How often the figures of the instruments are read again (ms). */
const INSTRUMENTS_MS = 2000;

/** One white figure: the value, and under it what it is. */
interface DashCell {
  key: string;
  value: string;
  label: string;
}

/**
 * A figure of the instruments, while fresh.
 * @param key - The instrument value.
 * @returns The value, or null.
 */
function live(key: 'depth' | 'tws' | 'twd' | 'stw' | 'hdg' | 'wtemp') {
  return nmeaFresh(key) ? (nmeaLink.live[key] ?? null) : null;
}

/**
 * The white figures, packet by packet: the track (speed, course, distance,
 * duration, top speed) and the instruments when connected (depth, true wind,
 * speed through the water, heading, water temperature), « – » otherwise.
 * @returns The packets of five.
 */
function dashCells(): DashCell[][] {
  const dash = trackerDash.value;
  const depth = live('depth');
  const tws = live('tws');
  const twd = live('twd');
  const stw = live('stw');
  const hdg = live('hdg');
  const water = live('wtemp');
  return [
    [
      { key: 'speed', value: dash.speed, label: dash.speedUnit },
      { key: 'course', value: dash.course, label: 'cap fond' },
      {
        key: 'depth',
        value: depth === null ? '–' : fr(depth),
        label: 'm sonde',
      },
      {
        key: 'wind',
        value: tws === null ? '–' : fr(tws, 0),
        label:
          twd === null
            ? 'nd vent'
            : `nd vent ${pad(Math.round(twd) % 360, 3)}°`,
      },
      { key: 'distance', value: dash.distance, label: 'NM' },
    ],
    [
      { key: 'duration', value: dash.duration, label: dash.durationLabel },
      { key: 'top', value: dash.top, label: 'nd max' },
      {
        key: 'stw',
        value: stw === null ? '–' : fr(stw),
        label: 'nd surface',
      },
      {
        key: 'heading',
        value: hdg === null ? '–' : `${pad(Math.round(hdg) % 360, 3)}°`,
        label: 'cap compas',
      },
      {
        key: 'water',
        value: water === null ? '–' : fr(water),
        label: '°C eau',
      },
    ],
  ];
}

/**
 * The tracker dashboard: white figures five at a time, a swipe left or right
 * shows the other five, two dots say which.
 * @returns `#trkDash`.
 */
export function TrackerDash() {
  useSignals();
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setTick((tick) => tick + 1),
      INSTRUMENTS_MS,
    );
    return () => clearInterval(timer);
  }, []);
  const packets = dashCells();
  const page = Math.min(dashPage.value, DASH_PACKETS - 1);
  return (
    <div className="trk-dash" id="trkDash" data-dash-page={page}>
      <BarChevron bar="bottom" />
      {(packets[page] ?? []).map((cell) => (
        <div key={cell.key} data-dash={cell.key}>
          <b>{cell.value}</b>
          <small>{cell.label}</small>
        </div>
      ))}
      <span className="trk-dash-dots" aria-hidden="true">
        {packets.map((_packet, index) => (
          // eslint-disable-next-line react/no-array-index-key -- the packets never move
          <i key={index} className={index === page ? 'on' : undefined} />
        ))}
      </span>
    </div>
  );
}

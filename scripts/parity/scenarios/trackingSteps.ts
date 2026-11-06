import type { Step } from '../types.ts';

export const quiet = { 'ldb.tipIdx': '6' };

/** A WebSocket replaced in both apps: `__ws.emit(type, data)` plays the server. */
export const FAKE_SOCKET = `
  class FakeSocket extends EventTarget {
    constructor(url) { super(); this.url = url; window.__ws = this; }
    emit(type, data) {
      const event = new MessageEvent(type, { data });
      this.dispatchEvent(event);
      const handler = this['on' + type];
      if (handler) handler(event);
    }
    send() {}
    close() { this.emit('close'); }
  }
  window.WebSocket = FakeSocket;
`;

/** Keeps the position callbacks: `__fix(position)`, `__gpsError(error)`. */
export const FAKE_GPS = `
  navigator.geolocation.watchPosition = (ok, error) => {
    window.__fix = ok;
    window.__gpsError = error;
    return 7;
  };
  navigator.geolocation.clearWatch = () => {};
`;

/** Copies stored keys into the page, so that a snapshot compares the data too. */
export function dump(pattern: string): Step {
  return {
    eval: String.raw`(() => {
      const keys = Object.keys(localStorage).filter((key) => /${pattern}/.test(key)).sort();
      const box = document.getElementById('parityDump') ?? document.body.appendChild(document.createElement('pre'));
      box.id = 'parityDump';
      box.hidden = true;
      box.textContent = keys.map((key) => key + ' = ' + localStorage.getItem(key)).join('\n');
    })()`,
  };
}

/** The settings print the address of the app, which differs between the two servers. */
export const MASK_ORIGIN: Step = {
  eval: String.raw`(() => {
    const walker = document.createTreeWalker(document.getElementById('view'), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/localhost:43/.test(node.data)) node.data = node.data.replaceAll(/localhost:430\d/g, 'localhost');
    }
    scrollTo(0, 0);
  })()`,
};

/** Leaflet numbers its radio groups with a counter shared by everything it creates. */
export const MASK_LEAFLET: Step = {
  eval: `for (const input of document.querySelectorAll('.leaflet-control-layers-selector')) input.name = 'layers';`,
};

/** The built-in charts load 6 s after the start: their note must have settled. */
export const CHARTS_SETTLED: Step = { wait: 7500 };

/** A click can leave the page scrolled differently, depending on when it landed. */
export const MASK_SCROLL: Step = { eval: `scrollTo(0, 0);` };

/** Positions of the sea scenarios start off Split. */
export const AT_SEA: Step = {
  eval: `window.__pos = { lat: 43.2, lon: 16.4 };`,
};

/** Puts a text file in a file input and fires its change event. */
export function chooseFile(input: string, name: string, content: string): Step {
  return {
    eval: `(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)}));
      const input = document.querySelector(${JSON.stringify(input)});
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`,
  };
}

export const NMEA_FILE = [
  '$WIMWV,45.0,R,12.0,N,A',
  '$GPGGA,080000,4630.000,N,00636.000,E,1,08,0.9,372.0,M,46.9,M,,',
  '$GPRMC,080030,A,4630.040,N,00636.040,E,5.0,45.0,150726,,',
  ...Array.from({ length: 40 }, (_, index) => {
    const seconds = 60 + index * 60;
    const time = `08${String(Math.floor(seconds / 60)).padStart(2, '0')}${String(seconds % 60).padStart(2, '0')}`;
    const lat = (30.04 + 0.08 * (index + 1)).toFixed(3);
    const lon = (36.04 + 0.1 * (index + 1)).toFixed(3).padStart(6, '0');
    return `$GPRMC,${time},A,46${lat},N,006${lon},E,5.0,45.0,150726,,`;
  }),
].join('\n');

const GPX_POINTS = Array.from({ length: 90 }, (_, index) => {
  const time = new Date(Date.UTC(2026, 6, 14, 7, 0, 0) + index * 60_000);
  const lat = 43.5 + index * 0.0015;
  const lon = 16.4 + (index < 45 ? index : 90 - index) * 0.0015;
  return `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><time>${time.toISOString()}</time><extensions><navx:sog>5.4</navx:sog><navx:twd>300</navx:twd><navx:tws>12.4</navx:tws></extensions></trkpt>`;
}).join('\n');
export const GPX_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:navx="urn:navx">
<trk><name>Hvar &amp; Vis</name><trkseg>
${GPX_POINTS}
</trkseg></trk></gpx>`;
export const GPX_NO_TIME = `<?xml version="1.0"?><gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`;

/** Plays `count` positions every 30 s, ending at the frozen time of the scenario. */
export function feedPositions(
  count: number,
  course: number,
  knots: number,
  endsMinutesAgo = 0,
): Step {
  return {
    eval: `(() => {
      window.__pos ??= { lat: 46.5, lon: 6.6 };
      const end = Date.parse('2026-07-15T10:30:00+02:00') - ${endsMinutesAgo} * 60000;
      const radians = ${course} * Math.PI / 180;
      const step = ${knots} * 30 / 3600 / 60;
      for (let index = 0; index < ${count}; index++) {
        __pos.lat += step * Math.cos(radians);
        __pos.lon += step * Math.sin(radians) / Math.cos(46.5 * Math.PI / 180);
        __fix({
          timestamp: end - (${count} - 1 - index) * 30000,
          coords: { latitude: __pos.lat, longitude: __pos.lon, accuracy: 5, speed: ${knots} / 1.94384, heading: ${course} },
        });
      }
    })()`,
  };
}

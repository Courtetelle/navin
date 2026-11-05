import type { Scenario, Step } from '../types.ts';

const quiet = { 'ldb.tipIdx': '6' };

/** A WebSocket replaced in both apps: `__ws.emit(type, data)` plays the server. */
const FAKE_SOCKET = `
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
const FAKE_GPS = `
  navigator.geolocation.watchPosition = (ok, error) => {
    window.__fix = ok;
    window.__gpsError = error;
    return 7;
  };
  navigator.geolocation.clearWatch = () => {};
`;

/** Copies stored keys into the page, so that a snapshot compares the data too. */
function dump(pattern: string): Step {
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

/**
 * The settings print the address of the app, which differs between the two
 * servers, and the state of the built-in charts, loaded in the background.
 */
const MASK_ORIGIN: Step = {
  eval: String.raw`(() => {
    const walker = document.createTreeWalker(document.getElementById('view'), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/localhost:43/.test(node.data)) node.data = node.data.replaceAll(/localhost:430\d/g, 'localhost');
      if (node.data.includes('Cartes intégrées :')) node.data = '🗺 Cartes intégrées : état chargé en arrière-plan, masqué ici';
    }
    scrollTo(0, 0);
  })()`,
};

/** Leaflet numbers its radio groups with a counter shared by everything it creates. */
const MASK_LEAFLET: Step = {
  eval: `for (const input of document.querySelectorAll('.leaflet-control-layers-selector')) input.name = 'layers';`,
};

/** A click can leave the page scrolled differently, depending on when it landed. */
const MASK_SCROLL: Step = { eval: `scrollTo(0, 0);` };

/** Positions of the sea scenarios start off Split. */
const AT_SEA: Step = { eval: `window.__pos = { lat: 43.2, lon: 16.4 };` };

/** Puts a text file in a file input and fires its change event. */
function chooseFile(input: string, name: string, content: string): Step {
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

const NMEA_FILE = [
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
const GPX_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:navx="urn:navx">
<trk><name>Hvar &amp; Vis</name><trkseg>
${GPX_POINTS}
</trkseg></trk></gpx>`;
const GPX_NO_TIME = `<?xml version="1.0"?><gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>`;

/** Plays `count` positions every 30 s, ending at the frozen time of the scenario. */
function feedPositions(
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

export const scenarios: Scenario[] = [
  {
    name: 'nmea-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [{ go: 'nmea' }, { wait: 1500 }, { snapshot: 'screen' }],
  },
  {
    name: 'nmea-cruise',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'nmea' },
      { wait: 1500 },
      { snapshot: 'screen' },
      { click: '#nmGo' },
      { snapshot: 'no-address' },
      { fill: '#nmUrl', value: ' wss://boat.example.org/stream ' },
      dump('ldb.settings'),
      { snapshot: 'address-typed' },
      { go: 'nmea' },
      { wait: 1500 },
      { snapshot: 'address-kept' },
    ],
  },
  {
    name: 'nmea-live',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { eval: FAKE_SOCKET },
      { go: 'nmea' },
      { wait: 1500 },
      { fill: '#nmUrl', value: 'wss://boat.example.org/stream' },
      { click: '#nmGo' },
      { snapshot: 'waiting' },
      { eval: `__ws.emit('open')` },
      { snapshot: 'connected' },
      { wait: 3000 },
      {
        eval: `__ws.emit('message', JSON.stringify({ name: 'signalk-server', version: '2.8.0' }))`,
      },
      {
        eval: String.raw`__ws.emit('message', '$GPRMC,123519,A,4807.038,N,01131.000,E,6.4,84.4,150726,,\r\n$HEHDT,90.5,T\r\n$WIMWV,300.0,R,12.0,N,A\r\n$SDDBT,,f,12.2,M,,F\r\n$YXMTW,18.5,C\r\n$VWVHW,,T,,M,6.3,N,11.7,K')`,
      },
      { snapshot: 'nmea-0183' },
      {
        eval: `__ws.emit('message', JSON.stringify({ updates: [{ values: [
          { path: 'navigation.position', value: { latitude: 43.5, longitude: 16.25 } },
          { path: 'navigation.speedOverGround', value: 3 },
          { path: 'navigation.courseOverGroundTrue', value: 1.5 },
          { path: 'environment.wind.speedTrue', value: 8 },
          { path: 'environment.wind.directionTrue', value: 4 },
          { path: 'environment.water.temperature', value: 295.15 },
          { path: 'environment.depth.belowTransducer', value: 7.5 },
        ] }] }))`,
      },
      { snapshot: 'signal-k' },
      { eval: `__ws.close()` },
      { snapshot: 'lost' },
      { click: '#nmGo' },
      { snapshot: 'disconnected' },
    ],
  },
  {
    name: 'nmea-file',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'nmea' },
      { wait: 1500 },
      chooseFile('#nmFile', 'bord.nmea', 'rien du tout'),
      { snapshot: 'unreadable' },
      chooseFile('#nmFile', 'bord.nmea', NMEA_FILE),
      { snapshot: 'preview' },
      { click: '#view section.field h2' },
      { snapshot: 'preview-open' },
      { click: '#gpxKeep' },
      { snapshot: 'keep-off' },
      { click: '#gpxCancel' },
      { snapshot: 'cancelled' },
    ],
  },
  {
    name: 'nmea-file-apply',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'nmea' },
      { wait: 1500 },
      chooseFile('#nmFile', 'bord.nmea', NMEA_FILE),
      { click: '#view section.field h2' },
      { click: '#gpxGo' },
      { wait: 500 },
      dump('ldb.(cruise|track)'),
      { snapshot: 'applied' },
    ],
  },
  {
    name: 'autocard-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [{ go: 'new' }, { wait: 1500 }, { snapshot: 'idle' }],
  },
  {
    name: 'autocard-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [{ go: 'new' }, { wait: 1500 }, { snapshot: 'idle' }],
  },
  {
    name: 'tracking-run',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { eval: FAKE_GPS },
      AT_SEA,
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      { snapshot: 'started' },
      { click: '#autoNow' },
      { snapshot: 'no-point-yet' },
      feedPositions(1, 45, 6, 120),
      { wait: 500 },
      dump('ldb.(cruise|trip|track|trkSegs)'),
      { snapshot: 'departure' },
      feedPositions(100, 45, 6, 70),
      feedPositions(100, 135, 6, 20),
      feedPositions(40, 135, 6),
      { wait: 3000 },
      dump('ldb.(cruise|trip|track|trkSegs)'),
      { snapshot: 'under-way' },
      { click: '#autoNow' },
      { wait: 500 },
      dump('ldb.cruise'),
      { snapshot: 'point' },
      { wait: 3000 },
      { click: '#autoStop' },
      MASK_SCROLL,
      { snapshot: 'armed' },
      { click: '#autoStop' },
      { wait: 1500 },
      dump('ldb.(cruise|trip|lastTrip|track|trkSegs)'),
      { snapshot: 'arrived' },
    ],
  },
  {
    name: 'tracking-denied',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { eval: FAKE_GPS },
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      feedPositions(3, 90, 5),
      { wait: 500 },
      { eval: `__gpsError({ code: 1 })` },
      dump('ldb.(trip|lastTrip|track)'),
      { snapshot: 'interrupted' },
      { wait: 3000 },
      { click: '#autoResume' },
      { wait: 1500 },
      { snapshot: 'resumed' },
      { wait: 3000 },
      { eval: `__gpsError({ code: 1 })` },
      { wait: 3000 },
      { click: '#autoEnd' },
      { snapshot: 'armed' },
      { click: '#autoEnd' },
      { wait: 1500 },
      dump('ldb.(cruise|trip|lastTrip|track)'),
      { snapshot: 'ended' },
    ],
  },
  {
    name: 'tracking-gap',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { eval: FAKE_GPS },
      AT_SEA,
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      feedPositions(3, 90, 5, 60),
      { wait: 500 },
      feedPositions(3, 90, 5, 10),
      { wait: 500 },
      dump('ldb.(cruise|trip|track)'),
      { snapshot: 'completed' },
    ],
  },
  {
    name: 'tracking-reload',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { eval: FAKE_GPS },
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      feedPositions(12, 90, 5),
      { wait: 500 },
      { eval: `location.reload()` },
      { wait: 6000 },
      dump('ldb.(trip|lastTrip|track)'),
      { snapshot: 'resumed-alone' },
      { go: 'new' },
      { wait: 1500 },
      { snapshot: 'card-after-reload' },
    ],
  },
  {
    name: 'tracking-second-trip',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { eval: FAKE_GPS },
      AT_SEA,
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      feedPositions(12, 90, 5, 30),
      { wait: 500 },
      { click: '#autoStop' },
      { click: '#autoStop' },
      { wait: 1500 },
      { go: 'new' },
      { wait: 1500 },
      { click: '#autoStart' },
      { wait: 500 },
      MASK_LEAFLET,
      { snapshot: 'choice' },
    ],
  },
  {
    name: 'zone-settings',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'settings' },
      { wait: 1500 },
      { click: 'details[data-sec="zone"] summary' },
      MASK_ORIGIN,
      { snapshot: 'auto' },
      { click: '[data-zonesim]' },
      dump('ldb.zoneSim'),
      MASK_ORIGIN,
      { snapshot: 'lake' },
      { wait: 3000 },
      { click: '[data-zonesim]' },
      dump('ldb.zoneSim'),
      MASK_ORIGIN,
      { snapshot: 'sea' },
      { wait: 3000 },
      { click: '[data-zonesim]' },
      dump('ldb.zoneSim'),
      MASK_ORIGIN,
      { snapshot: 'back-to-auto' },
    ],
  },
  {
    name: 'depth-settings',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'settings' },
      { wait: 1500 },
      { click: 'details[data-sec="alert"] summary' },
      MASK_ORIGIN,
      { snapshot: 'open' },
      { click: '[data-dset="depthStart"][data-v="1.5"]' },
      { click: '[data-dset="depthVol"][data-v="0.3"]' },
      { click: '[data-dset="depthFlash"]' },
      { click: '[data-dset="depthVib"]' },
      { click: '[data-depthon]' },
      dump('ldb.settings'),
      MASK_ORIGIN,
      { snapshot: 'changed' },
      { click: '[data-depthon]' },
      { click: '[data-dset="depthVib"]' },
      dump('ldb.settings'),
      MASK_ORIGIN,
      { snapshot: 'restored' },
    ],
  },
  {
    name: 'depth-test',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'settings' },
      { wait: 1500 },
      { click: 'details[data-sec="tests"] summary' },
      MASK_ORIGIN,
      { snapshot: 'open' },
      { eval: `document.querySelector('[data-depthtest="vite"]').click()` },
      { wait: 100 },
      { eval: `document.querySelector('#daStop')?.click()` },
      { wait: 300 },
      MASK_ORIGIN,
      { snapshot: 'stopped' },
    ],
  },
  {
    name: 'nmea-english',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.lang': 'en', 'ldb.lang2': 'en' },
    steps: [
      { go: 'nmea' },
      { wait: 1500 },
      { snapshot: 'screen' },
      chooseFile('#nmFile', 'bord.nmea', NMEA_FILE),
      { click: '#view section.field h2' },
      { snapshot: 'preview' },
    ],
  },
  {
    name: 'gpx-import',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { go: 'export' },
      { wait: 1500 },
      chooseFile('#gpxFile', 'trace.gpx', '<gpx'),
      { snapshot: 'unreadable' },
      chooseFile('#gpxFile', 'trace.gpx', '<gpx></gpx>'),
      { snapshot: 'no-point' },
      chooseFile('#gpxFile', 'trace.gpx', GPX_NO_TIME),
      { snapshot: 'no-time' },
      chooseFile('#gpxFile', 'trace.gpx', GPX_FILE),
      { snapshot: 'preview' },
      { click: '#view section.field h2' },
      { snapshot: 'preview-open' },
      { click: '#gpxGo' },
      { wait: 1000 },
      dump('ldb.(cruise|track)'),
      { snapshot: 'applied' },
    ],
  },
  {
    name: 'depth-alarm',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'settings' },
      { wait: 1500 },
      { click: 'details[data-sec="tests"] summary' },
      { eval: `window.__started = Date.now();` },
      { click: '[data-depthtest="vite"]' },
      { wait: 400 },
      MASK_ORIGIN,
      { snapshot: 'start' },
      { eval: `Date.now = () => __started + 3000;` },
      { wait: 400 },
      MASK_ORIGIN,
      { snapshot: 'rising' },
      { eval: `Date.now = () => __started + 8000;` },
      { wait: 400 },
      MASK_ORIGIN,
      { snapshot: 'danger' },
      { click: '#daMute' },
      { wait: 400 },
      MASK_ORIGIN,
      { snapshot: 'muted' },
      { click: '#daStop' },
      { wait: 400 },
      MASK_ORIGIN,
      { snapshot: 'stopped' },
    ],
  },
];

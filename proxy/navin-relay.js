/**
 * The relay of NavIn (a Cloudflare Worker, free plan): it fetches for the app
 * the public data whose servers do not let a web page read them (no CORS),
 * and gives them back with the permission. Only the hosts below, only GET,
 * only for the NavIn site; each answer is cached 5 minutes.
 *
 * Install: dash.cloudflare.com › Workers & Pages › Create › Worker, paste
 * this file, Deploy; then copy its address (https://….workers.dev) into
 * NavIn › Réglages › Clés météo › Relais des METAR et bouées.
 *
 * Recording (optional): with a KV namespace bound as « NAVIN » and a Cron
 * trigger « *\/10 * * * * », the relay keeps 24 hours of the stations around
 * the points the devices sent (the GPS and the three zones), NavIn closed:
 * every run it reads the OpenWindMap beacons and the METAR, then a few of
 * the other networks NavIn reads, in turn (those around the points only,
 * the longest unread first): MeteoSwiss, the NOAA buoys, ItaliaMeteo,
 * Puertos del Estado, SOCIB, Rijkswaterstaat, IPMA, DMI, SMHI, FMI, DHMZ;
 * and each device sends what it read, so that T, P and X share one past.
 *
 * Keyed networks NavIn closed (optional), each read only with its secret:
 * « MF_KEY » (Météo-France), « AEMET_KEY » (AEMET), « METOFFICE_KEY » (Met
 * Office Weather DataHub, land observations) and « FROST_KEY » (the client
 * ID of MET Norway, Frost). The keys are typed by the skipper in
 * Cloudflare, kept there as secrets, and never sent back.
 */

/** The only hosts the relay asks. */
const HOSTS = new Set([
  'aviationweather.gov',
  'www.ndbc.noaa.gov',
  'vrijeme.hr',
  'www.meteoschweiz.admin.ch',
  'frost.met.no',
  'api.dataplatform.knmi.nl',
  'ddapi20-waterwebservices.rijkswaterstaat.nl',
]);

/** The services that need the key of the skipper, sent as `Authorization`. */
const KEYED = new Set(['frost.met.no', 'api.dataplatform.knmi.nl']);

/** The services asked with a POST of JSON. */
const POSTED = new Set(['ddapi20-waterwebservices.rijkswaterstaat.nl']);

/**
 * The only pages allowed to use the relay: the site, the test server, and
 * NavIn packed as an app (Android APK for the tablet, iOS app).
 */
const ORIGINS = [
  'https://courtetelle.github.io',
  'http://localhost:11106',
  'https://localhost',
  'capacitor://localhost',
];

/**
 * The synchronisation between devices: each device leaves its data there,
 * encrypted on the device with a key the relay never sees. A space is the
 * hash of that key (64 hex), a device or a photo a short name.
 */
const SYNC_PATH =
  /^\/sync\/(?<space>[0-9a-f]{64})\/(?<kind>index|dev|ph)(?:\/(?<name>[0-9A-Za-z_-]{1,64}))?$/u;
/** The free plan keeps values up to 25 MB. */
const SYNC_MOST = 24 * 1024 * 1024;

/** The menus of the app (lists, buttons): a few hundred kB at most. */
const MENUS_MOST = 2 * 1024 * 1024;

/** Seconds an answer is kept. */
const CACHE_SECONDS = 300;

/** The past kept, and the readings kept per station. */
const KEEP_MS = 24 * 3600 * 1000;
const STEP_MS = 9 * 60 * 1000;
/** A device that has sent nothing for a week is forgotten. */
const POINTS_MS = 7 * 24 * 3600 * 1000;
const KN_PER_KMH = 1 / 1.852;
const KN_PER_MS = 3600 / 1852;

/** Météo-France: its observations, and the gusts whatever their name. */
const MF_BASE = 'https://public-api.meteofrance.fr/public/DPObs/v1/';
const MF_GUSTS = ['raf10', 'fxi10', 'fxi', 'fxi3s', 'fxy', 'fx'];
/** Its list of stations is read again once a day. */
const LIST_MS = 24 * 3600 * 1000;
/** A station without wind is not asked again for a week. */
const NO_WIND_MS = 7 * 24 * 3600 * 1000;
/** A measurement older than this is not kept. */
const FRESH_MS = 40 * 60 * 1000;
/**
 * Requests to other servers in one run (the free plan allows 50): what the
 * beacons and the airports leave goes to the keyed networks.
 */
const RUN_REQUESTS = 46;
const AEMET_API = 'https://opendata.aemet.es/opendata/api';
/** AEMET: two requests a station, the closest ones only. */
const AEMET_MOST = 4;

/** Where the state of the turns is kept in `past-relay` (never a station). */
const STATE_KEY = '~';
/**
 * The work of one run beyond the beacons and the airports, in rough
 * milliseconds of CPU to read the answers (the free plan allows about 10):
 * the networks are read in turn, the longest unread first.
 */
const RUN_WEIGHT = 5;
const HOUR_MS = 3600 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;
/** Stations kept per point of a network read whole (NavIn shows 25). */
const AREA_MOST = 25;
/** A server answering slower than this is asked again next time. */
const WAIT_MS = 20_000;

function distKm(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6371;
}

async function readJson(env, key, fallback) {
  const text = await env.NAVIN.get(key);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** Add readings `{k, t, a, g, d}` to the past, keeping 24 h. */
function addReadings(past, readings, now) {
  for (const r of readings) {
    if (typeof r?.k !== 'string' || r.k.length > 120) continue;
    if (!Number.isFinite(r.t) || !Number.isFinite(r.a)) continue;
    const list = (past[r.k] ?? []).filter(([t]) => t > now - KEEP_MS);
    const last = list.at(-1);
    if (!last || r.t - last[0] >= STEP_MS) {
      list.push([
        r.t,
        Math.round(r.a * 10) / 10,
        Number.isFinite(r.g) ? Math.round(r.g * 10) / 10 : null,
        Number.isFinite(r.d) ? Math.round(r.d) : null,
      ]);
    }
    past[r.k] = list;
  }
  for (const key of Object.keys(past)) {
    if (!past[key].some(([t]) => t > now - KEEP_MS)) delete past[key];
  }
  return past;
}

/** Two pasts of a station in one, oldest first, one point a minute. */
function mergePast(first, second) {
  const all = [...first, ...second].toSorted((a, b) => a[0] - b[0]);
  return all.filter(
    (point, i) => i === 0 || point[0] - all[i - 1][0] >= 60_000,
  );
}

function allPoints(devices, now) {
  return Object.values(devices)
    .filter((device) => now - device.at < POINTS_MS)
    .flatMap((device) => device.points);
}

/**
 * The points of every device in one list: points closer than 10 km to
 * each other are one (the widest radius kept), twelve at most.
 */
function mergedPoints(points) {
  const kept = [];
  for (const p of points) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) continue;
    const same = kept.find((one) => distKm(one, p) < 10);
    if (same) same.km = Math.max(same.km, p.km ?? 60);
    else kept.push({ lat: p.lat, lon: p.lon, km: p.km ?? 60 });
  }
  return kept.slice(0, 12);
}

/**
 * Every 10 minutes (or 5): the beacons and the airports around the points,
 * then a few other networks in turn (see `readNets`).
 */
async function record(env) {
  const now = Date.now();
  const points = mergedPoints(
    allPoints(await readJson(env, 'points', {}), now),
  );
  if (points.length === 0) return;
  const near = (lat, lon) =>
    points.some((p) => distKm(p, { lat, lon }) < (p.km ?? 60));
  const readings = [];
  try {
    const reply = await fetch('https://api.pioupiou.fr/v1/live/all');
    const answer = await reply.json();
    const data = answer.data ?? [];
    for (const beacon of data) {
      const at = beacon.location ?? {};
      const m = beacon.measurements ?? {};
      if (at.latitude == null || m.wind_speed_avg == null) continue;
      if (!near(at.latitude, at.longitude)) continue;
      readings.push({
        k: `OpenWindMap:${beacon.id}`,
        t: Date.parse(m.date),
        a: m.wind_speed_avg * KN_PER_KMH,
        g: m.wind_speed_max == null ? null : m.wind_speed_max * KN_PER_KMH,
        d: m.wind_heading,
      });
    }
  } catch {
    // The beacons next time.
  }
  /* eslint-disable no-await-in-loop -- one point after the other */
  for (const p of points) {
    try {
      const d = (p.km ?? 60) / 111;
      const box = [p.lat - d, p.lon - d * 1.5, p.lat + d, p.lon + d * 1.5]
        .map((v) => v.toFixed(2))
        .join(',');
      const reply = await fetch(
        `https://aviationweather.gov/api/data/metar?bbox=${box}&format=json`,
        { headers: { 'User-Agent': 'NavIn relay' } },
      );
      for (const m of (await reply.json()) ?? []) {
        if (m.wspd == null || !m.icaoId) continue;
        readings.push({
          k: `METAR:${m.icaoId}`,
          t: m.obsTime * 1000,
          a: m.wspd,
          g: m.wgst ?? null,
          d: typeof m.wdir === 'number' ? m.wdir : null,
        });
      }
    } catch {
      // The airports next time.
    }
  }
  /* eslint-enable no-await-in-loop */
  // Its own record: what the devices send goes to `past`, so that neither
  // writes over the other. The state of the turns is kept in it too (one
  // write a run, no more).
  const { [STATE_KEY]: kept, ...past } = await readJson(env, 'past-relay', {});
  const state = kept && typeof kept === 'object' ? kept : {};
  readings.push(
    ...(await readNets(
      env,
      points,
      now,
      RUN_REQUESTS - 1 - points.length,
      state,
    )),
  );
  addReadings(past, readings, now);
  past[STATE_KEY] = state;
  await env.NAVIN.put('past-relay', JSON.stringify(past));
}

/** The networks the relay reads itself, with the keys it was given. */
function keyedNets(env) {
  return [
    'OpenWindMap',
    'METAR',
    ...NETS.filter((net) => !net.key || env[net.key]).map((net) => net.name),
  ];
}

function near(stations, p, km) {
  return stations
    .map((s) => ({ s, km: distKm(p, { lat: s[2], lon: s[3] }) }))
    .filter((one) => one.km < km)
    .toSorted((a, b) => a.km - b.km)
    .map((one) => one.s);
}

/** The Météo-France stations `[id, lat, lon]`, read once a day. */
async function mfStations(env, now) {
  const kept = await readJson(env, 'mf-list', null);
  if (kept && now - kept.at < LIST_MS) return { list: kept.list, asked: 0 };
  const reply = await fetch(`${MF_BASE}liste-stations`, {
    headers: { apikey: env.MF_KEY },
  });
  if (!reply.ok) return { list: kept?.list ?? [], asked: 1 };
  const raw = await reply.text();
  const text = raw.trim();
  const lines = text.split(/\r?\n/u).map((line) => line.split(';'));
  const head = (lines.shift() ?? []).map((name) => name.trim().toLowerCase());
  const at = (names) => names.map((n) => head.indexOf(n)).find((i) => i >= 0);
  const [id, lat, lon] = [
    at(['id_station', 'id', 'geo_id_insee']),
    at(['latitude', 'lat']),
    at(['longitude', 'lon']),
  ];
  const list = [];
  for (const cells of lines) {
    const station = [
      cells[id]?.trim(),
      '',
      Number(cells[lat]),
      Number(cells[lon]),
    ];
    if (
      station[0] &&
      Number.isFinite(station[2]) &&
      Number.isFinite(station[3])
    ) {
      list.push(station);
    }
  }
  if (list.length > 0) {
    await env.NAVIN.put('mf-list', JSON.stringify({ at: now, list }));
  }
  return { list, asked: 1 };
}

/**
 * The Météo-France stations around the points: the closest at each run,
 * the next ones in turn (each about every half hour), as many as the
 * requests left allow.
 */
async function mfRead(env, points, now, left) {
  const { list, asked } = await mfStations(env, now);
  let budget = left - asked;
  if (budget <= 0 || list.length === 0) return [];
  const noWind = await readJson(env, 'mf-nowind', {});
  const windy = list.filter(([id]) => !(now - (noWind[id] ?? 0) < NO_WIND_MS));
  const each = Math.max(1, Math.floor(budget / points.length));
  const fixed = Math.ceil(each / 2);
  const turn = Math.floor(now / 600_000) % 3;
  const chosen = new Set();
  for (const p of points) {
    const around = near(windy, p, p.km ?? 60);
    const rest = around.slice(fixed, fixed + (each - fixed) * 3);
    const share = Math.max(1, each - fixed);
    for (const s of [
      ...around.slice(0, fixed),
      ...rest.slice(turn * share, (turn + 1) * share),
    ]) {
      chosen.add(s[0]);
    }
  }
  const readings = [];
  let learnt = false;
  /* eslint-disable no-await-in-loop -- Météo-France allows 50 requests a minute */
  for (const id of chosen) {
    if (budget <= 0) break;
    budget -= 1;
    try {
      const reply = await fetch(
        `${MF_BASE}station/infrahoraire-6m?id_station=${encodeURIComponent(id)}&format=json`,
        { headers: { apikey: env.MF_KEY } },
      );
      if (!reply.ok) continue;
      const rows = await reply.json();
      if (!Array.isArray(rows)) continue;
      const row = rows
        .filter((r) => r.ff != null)
        .map((r) => ({ r, t: Date.parse(r.validity_time ?? r.reference_time) }))
        .filter((one) => Number.isFinite(one.t))
        .toSorted((a, b) => b.t - a.t)[0];
      if (!row) {
        if (rows.length > 0 && !rows.some((r) => 'ff' in r)) {
          noWind[id] = now;
          learnt = true;
        }
        continue;
      }
      if (now - row.t > FRESH_MS) continue;
      const gust = MF_GUSTS.map((name) => row.r[name]).find(
        (v) => typeof v === 'number' && Number.isFinite(v),
      );
      readings.push({
        k: `Météo-France:${id}`,
        t: row.t,
        a: row.r.ff * KN_PER_MS,
        g: gust == null ? null : gust * KN_PER_MS,
        d: typeof row.r.dd === 'number' ? row.r.dd : null,
      });
    } catch {
      // This station next time.
    }
  }
  /* eslint-enable no-await-in-loop */
  if (learnt) {
    for (const [id, at] of Object.entries(noWind)) {
      if (now - at > NO_WIND_MS) delete noWind[id];
    }
    await env.NAVIN.put('mf-nowind', JSON.stringify(noWind));
  }
  return readings;
}

function nearSpain(p) {
  const margin = (p.km ?? 60) / 100;
  return (
    (p.lat > 35.5 - margin &&
      p.lat < 44 + margin &&
      p.lon > -9.6 - margin * 1.3 &&
      p.lon < 4.6 + margin * 1.3) ||
    (p.lat > 27.4 - margin &&
      p.lat < 29.5 + margin &&
      p.lon > -18.3 - margin &&
      p.lon < -13.3 + margin)
  );
}

/** AEMET answers in two steps: a link, then the data (ISO-8859-15). */
async function aemetData(env, path) {
  const glue = path.includes('?') ? '&' : '?';
  const first = await fetch(
    `${AEMET_API}${path}${glue}api_key=${encodeURIComponent(env.AEMET_KEY)}`,
  );
  if (!first.ok) throw new Error(String(first.status));
  const answer = await first.json();
  const link = answer.datos;
  if (!link) throw new Error('no data');
  const second = await fetch(link);
  if (!second.ok) throw new Error(String(second.status));
  return JSON.parse(
    new TextDecoder('iso-8859-15').decode(await second.arrayBuffer()),
  );
}

function aemetDegrees(text) {
  const found = /^(?<digits>\d{6,7})(?<side>[NSEW])$/u.exec(
    String(text).trim(),
  );
  if (!found) return Number.NaN;
  const { digits, side } = found.groups;
  const value =
    Number(digits.slice(0, -4)) +
    Number(digits.slice(-4, -2)) / 60 +
    Number(digits.slice(-2)) / 3600;
  return side === 'S' || side === 'W' ? -value : value;
}

/** The AEMET stations closest to the points near Spain. */
async function aemetRead(env, points, now, left) {
  const spain = points.filter(nearSpain);
  if (spain.length === 0 || left < 4) return { readings: [], asked: 0 };
  let asked = 0;
  let kept = await readJson(env, 'aemet-list', null);
  if (!kept || now - kept.at > 30 * LIST_MS) {
    try {
      asked += 2;
      const inventory = await aemetData(
        env,
        '/valores/climatologicos/inventarioestaciones/todasestaciones',
      );
      const list = inventory
        .map((one) => [
          one.indicativo,
          '',
          aemetDegrees(one.latitud ?? ''),
          aemetDegrees(one.longitud ?? ''),
        ])
        .filter((one) => one[0] && Number.isFinite(one[2]));
      kept = { at: now, list };
      await env.NAVIN.put('aemet-list', JSON.stringify(kept));
    } catch {
      return { readings: [], asked };
    }
  }
  const ids = new Set();
  for (const p of spain) {
    for (const s of near(kept.list, p, p.km ?? 60).slice(0, AEMET_MOST)) {
      ids.add(s[0]);
    }
  }
  const readings = [];
  /* eslint-disable no-await-in-loop -- one station after the other */
  for (const id of ids) {
    if (asked + 2 > Math.min(left, 2 + 2 * AEMET_MOST)) break;
    asked += 2;
    try {
      const rows = await aemetData(
        env,
        `/observacion/convencional/datos/estacion/${encodeURIComponent(id)}`,
      );
      const row = rows.findLast((one) => one.vv != null && one.fint);
      if (!row) continue;
      const t = Date.parse(
        /[Z+]/u.test(row.fint.slice(10)) ? row.fint : `${row.fint}Z`,
      );
      if (!(now - t < FRESH_MS + 60 * 60 * 1000)) continue;
      readings.push({
        k: `AEMET:${id}`,
        t,
        a: row.vv * KN_PER_MS,
        g: row.vmax == null ? null : row.vmax * KN_PER_MS,
        d: row.dv ?? null,
      });
    } catch {
      // This station next time.
    }
  }
  /* eslint-enable no-await-in-loop */
  return { readings, asked };
}

/* ------------------------------------------- the other networks, in turn */

/*
 * Each network below is read the way NavIn reads it on a device (same
 * addresses, same units, same `net:id` keys), so that the past the relay
 * keeps is the one NavIn asks for. A run reads only the networks around the
 * points, the longest unread first, within RUN_WEIGHT and the requests left.
 */

/** Whether the circle of a point touches a box: south, west, north, east. */
function touches(p, [south, west, north, east]) {
  const km = p.km ?? 60;
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
  return (
    p.lat + dLat >= south &&
    p.lat - dLat <= north &&
    p.lon + dLon >= west &&
    p.lon - dLon <= east
  );
}

function fresh(t, now, most) {
  return Number.isFinite(t) && now - t < most && t - now < 10 * 60_000;
}

function knots(metres) {
  return typeof metres === 'number' && Number.isFinite(metres)
    ? metres * KN_PER_MS
    : null;
}

/** One request of a run, counted; a refusal is an error. */
async function ask(run, url, init = {}) {
  if (run.left <= 0) throw new Error('no request left');
  run.left -= 1;
  const reply = await fetch(url, {
    ...init,
    headers: { 'User-Agent': 'NavIn relay', ...init.headers },
    signal: AbortSignal.timeout(WAIT_MS),
  });
  if (!reply.ok) throw new Error(String(reply.status));
  return reply;
}

/** The text of one request of a run. */
async function textOf(run, url, init) {
  const reply = await ask(run, url, init);
  return reply.text();
}

/** A list of stations `[id, '', lat, lon]` kept in the KV, read again weekly. */
async function keptList(run, key, load) {
  const kept = await readJson(run.env, key, null);
  if (kept?.list?.length > 0 && run.now - kept.at < WEEK_MS) return kept.list;
  try {
    const list = await load();
    if (list.length > 0) {
      await run.env.NAVIN.put(key, JSON.stringify({ at: run.now, list }));
      return list;
    }
  } catch {
    // The list kept, if any.
  }
  return kept?.list ?? [];
}

/**
 * The stations of a list to read this run, `most` at most: the closest of
 * each point every time, the others in turn from `run.o` (kept for the
 * next run), so that all of them are read every few runs.
 */
function inTurn(run, list, most) {
  const rank = new Map();
  for (const p of run.points) {
    for (const [i, s] of near(list, p, p.km ?? 60).entries()) {
      if (!(rank.get(s) <= i)) rank.set(s, i);
    }
  }
  const ordered = [...rank].toSorted((a, b) => a[1] - b[1]).map(([s]) => s);
  if (most <= 0) return [];
  if (ordered.length <= most) return ordered;
  const fixed = Math.ceil(most / 2);
  const rest = ordered.slice(fixed);
  const start = (run.o ?? 0) % rest.length;
  const taken = [...rest, ...rest].slice(start, start + most - fixed);
  run.o = (start + taken.length) % rest.length;
  return [...ordered.slice(0, fixed), ...taken];
}

/** Every chosen station read at once; one failing alone. */
async function eachStation(stations, read) {
  const readings = await Promise.all(
    stations.map((s) => read(s).catch(() => null)),
  );
  return readings.filter(Boolean);
}

/**
 * The readings `{k, …, lat, lon}` of a whole-network answer kept: the
 * AREA_MOST closest of each point within its radius (the past of every
 * station read each run would grow too long to read again in time).
 */
function closest(run, readings) {
  const kept = new Set();
  for (const p of run.points) {
    const around = readings
      .map((r) => ({ r, km: distKm(p, r) }))
      .filter((one) => one.km < (p.km ?? 60))
      .toSorted((a, b) => a.km - b.km)
      .slice(0, AREA_MOST);
    for (const one of around) kept.add(one.r);
  }
  return readings.filter((r) => kept.has(r));
}

/* MeteoSwiss (SwissMetNet): one small CSV a station, km/h, UTC. */

const SMN_BASE = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/';
const SWITZERLAND = [45.7, 5.8, 47.9, 10.6];

function smnStationsOf(text) {
  const rows = text
    .trim()
    .split(/\r?\n/u)
    .map((line) => line.split(';'));
  const head = rows.shift() ?? [];
  const column = (name) => head.indexOf(name);
  const [id, lat, lon, height] = [
    column('station_abbr'),
    column('station_coordinates_wgs84_lat'),
    column('station_coordinates_wgs84_lon'),
    column('station_height_masl'),
  ];
  // As NavIn: the stations below 800 m only.
  return rows
    .map((cells) => [
      cells[id],
      '',
      Number(cells[lat]),
      Number(cells[lon]),
      Number(cells[height]) || 0,
    ])
    .filter((s) => s[0] && Number.isFinite(s[2]) && s[4] < 800)
    .map((s) => s.slice(0, 4));
}

/** The latest wind of a `_t_now.csv` (`DD.MM.YYYY HH:MM`, UTC). */
function smnReadingOf(text, id, now) {
  const lines = text.trim().split(/\r?\n/u);
  const head = (lines[0] ?? '').split(';');
  const [at, avg, gust, dir] = [
    'reference_timestamp',
    'fu3010z0',
    'fu3010z1',
    'dkl010z0',
  ].map((name) => head.indexOf(name));
  for (let i = lines.length - 1; i > 0; i -= 1) {
    const cells = lines[i].split(';');
    if (avg < 0 || !cells[avg]) continue;
    const [day, month, year, hours, minutes] = (cells[at] ?? '')
      .split(/[. :]/u)
      .map(Number);
    const t = Date.UTC(year, month - 1, day, hours, minutes);
    if (!Number.isFinite(t)) continue;
    if (now - t > FRESH_MS) return null;
    return {
      k: `MeteoSwiss:${id}`,
      t,
      a: Number(cells[avg]) * KN_PER_KMH,
      g: cells[gust] ? Number(cells[gust]) * KN_PER_KMH : null,
      d: cells[dir] ? Number(cells[dir]) : null,
    };
  }
  return null;
}

async function smnRead(run) {
  const list = await keptList(run, 'smn-list', async () => {
    const reply = await ask(run, `${SMN_BASE}ogd-smn_meta_stations.csv`);
    return smnStationsOf(await reply.text());
  });
  return eachStation(inTurn(run, list, run.left), async ([id]) => {
    const lower = id.toLowerCase();
    const reply = await ask(
      run,
      `${SMN_BASE}${lower}/ogd-smn_${lower}_t_now.csv`,
    );
    return smnReadingOf(await reply.text(), id, run.now);
  });
}

/* NOAA NDBC: buoys and lightships (the Met Office ones among them), m/s. */

const NDBC = 'https://www.ndbc.noaa.gov';

function tagField(tag, name) {
  return new RegExp(String.raw`\s${name}="(?<value>[^"]*)"`, 'u').exec(tag)
    ?.groups.value;
}

function ndbcStationsOf(xml) {
  const list = [];
  for (const found of xml.matchAll(/<station\s[^>]*>/gu)) {
    const tag = found[0];
    const id = tagField(tag, 'id');
    const lat = Number(tagField(tag, 'lat'));
    const lon = Number(tagField(tag, 'lon'));
    if (!id || tagField(tag, 'met') !== 'y') continue;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      list.push([id, '', lat, lon]);
    }
  }
  return list;
}

/** The latest line of a `realtime2` text; hourly, kept 3 hours. */
function ndbcReadingOf(text, id, now) {
  const lines = text.split('\n', 12);
  const head = (lines[0] ?? '').replace(/^#/u, '').trim().split(/\s+/u);
  const row = lines.find((line) => line.trim() && !line.startsWith('#'));
  if (!row) return null;
  const cells = row.trim().split(/\s+/u);
  const cell = (name) => {
    const value = cells[head.indexOf(name)];
    const number = Number(value);
    return value == null || value === 'MM' || !Number.isFinite(number)
      ? null
      : number;
  };
  const [year, month, day, hour, minute] = ['YY', 'MM', 'DD', 'hh', 'mm'].map(
    (name) => Number(cells[head.indexOf(name)]),
  );
  const t = Date.UTC(year, month - 1, day, hour, minute);
  const avg = cell('WSPD');
  if (avg == null || !fresh(t, now, 3 * HOUR_MS)) return null;
  return {
    k: `NOAA NDBC:${id}`,
    t,
    a: knots(avg),
    g: knots(cell('GST')),
    d: cell('WDIR'),
  };
}

async function ndbcRead(run) {
  const list = await keptList(run, 'ndbc-list', async () => {
    const reply = await ask(run, `${NDBC}/activestations.xml`);
    return ndbcStationsOf(await reply.text());
  });
  return eachStation(inTurn(run, list, run.left), async ([id]) => {
    const reply = await ask(run, `${NDBC}/data/realtime2/${id}.txt`);
    return ndbcReadingOf(await reply.text(), id, run.now);
  });
}

/* Met Office land stations (key): 360 calls a day, read once an hour. */

const MET_OFFICE_API =
  'https://data.hub.api.metoffice.gov.uk/observation-land/1';

function nearBritain(p) {
  const margin = (p.km ?? 60) / 100;
  return (
    p.lat > 49.8 - margin &&
    p.lat < 61 + margin &&
    p.lon > -8.7 - margin * 1.6 &&
    p.lon < 2 + margin * 1.6
  );
}

function metOfficeReadingOf(observations, id, now) {
  if (!Array.isArray(observations)) return null;
  const last = observations.findLast(
    (one) => one.wind_speed != null && one.datetime,
  );
  if (!last) return null;
  const t = Date.parse(last.datetime);
  if (!Number.isFinite(t) || now - t > 2 * HOUR_MS) return null;
  return {
    k: `Met Office:${id}`,
    t,
    a: knots(last.wind_speed),
    g: knots(last.wind_gust),
    d: last.wind_direction ?? null,
  };
}

async function metOfficeRead(run) {
  const headers = { apikey: run.env.METOFFICE_KEY, accept: 'application/json' };
  const asked = new Set();
  const readings = [];
  /* eslint-disable no-await-in-loop -- few calls a day: one after the other */
  for (const p of run.points) {
    if (run.left < 2) break;
    try {
      const reply = await ask(
        run,
        `${MET_OFFICE_API}/nearest?lat=${p.lat.toFixed(3)}&lon=${p.lon.toFixed(3)}`,
        { headers },
      );
      const answer = await reply.json();
      const places = Array.isArray(answer) ? answer : [answer];
      for (const place of places.slice(0, 3)) {
        const { geohash, latitude, longitude } = place ?? {};
        if (!geohash || asked.has(geohash) || run.left <= 0) continue;
        asked.add(geohash);
        const here = { lat: latitude ?? p.lat, lon: longitude ?? p.lon };
        if (!(distKm(p, here) < (p.km ?? 60))) continue;
        const data = await ask(run, `${MET_OFFICE_API}/${geohash}`, {
          headers,
        });
        const reading = metOfficeReadingOf(await data.json(), geohash, run.now);
        if (reading) readings.push(reading);
      }
    } catch {
      // This point next hour.
    }
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

/* ItaliaMeteo (MeteoHub): the whole of Italy in one answer, m/s, UTC. */

function nearItaly(p) {
  const margin = (p.km ?? 60) / 100;
  return (
    p.lat > 35.2 - margin &&
    p.lat < 47.2 + margin &&
    p.lon > 6.5 - margin * 1.4 &&
    p.lon < 18.6 + margin * 1.4
  );
}

function hubLatest(station, code) {
  const values = station.prod?.find((one) => one.var === code)?.val ?? [];
  let latest = null;
  for (const value of values) {
    const t = Date.parse(`${value.ref}Z`);
    if (Number.isFinite(t) && (!latest || t > latest.t)) {
      latest = { val: value.val, t };
    }
  }
  return latest;
}

function hubReadingOf(station, now) {
  const avg = hubLatest(station, 'B11002');
  if (!avg || !fresh(avg.t, now, 70 * 60_000)) return null;
  const gust = hubLatest(station, 'B11041');
  const dir = hubLatest(station, 'B11001');
  return {
    k: `ItaliaMeteo:${station.stat.net}:${station.stat.lat},${station.stat.lon}`,
    t: avg.t,
    a: knots(avg.val) ?? 0,
    g: gust && Math.abs(gust.t - avg.t) < 70 * 60_000 ? knots(gust.val) : null,
    d: dir ? dir.val : null,
  };
}

function hubTime(at) {
  return new Date(at).toISOString().slice(0, 16).replace('T', ' ');
}

async function hubRead(run) {
  const query = `reftime:>=${hubTime(run.now - 70 * 60_000)},<=${hubTime(run.now)};product:B11002 or B11001 or B11041;license:CCBY_COMPLIANT`;
  const reply = await ask(
    run,
    `https://meteohub.agenziaitaliameteo.it/api/observations?q=${encodeURIComponent(query)}`,
  );
  const answer = await reply.json();
  const readings = [];
  for (const station of Array.isArray(answer.data) ? answer.data : []) {
    const { lat, lon } = station.stat ?? {};
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const reading = hubReadingOf(station, run.now);
    if (reading) readings.push({ ...reading, lat, lon });
  }
  return closest(run, readings);
}

/* Puertos del Estado: buoys, tide gauges and ports of Spain, m/s, UTC. */

const PORTUS = 'https://portus.puertos.es/portussvr/api';

function portusReadingOf(data, id, now) {
  const t = data?.fecha
    ? Date.parse(`${data.fecha.replace(' ', 'T').replace(/\.\d+$/u, '')}Z`)
    : Number.NaN;
  if (!fresh(t, now, 70 * 60_000)) return null;
  const value = (column) => {
    const row = data.datos?.find((one) => one.nombreColumna === column);
    const number = Number(row?.valor);
    if (row?.valor == null || !Number.isFinite(number)) return null;
    return number / (row.factor || 1);
  };
  const avg = value('vv_md');
  if (avg == null) return null;
  return {
    k: `Puertos del Estado:${id}`,
    t,
    a: knots(avg),
    g: knots(value('vv_mx')),
    d: value('dv_md'),
  };
}

async function portusRead(run) {
  const list = await keptList(run, 'portus-list', async () => {
    const reply = await ask(run, `${PORTUS}/estaciones/hist/WIND?locale=es`);
    const answer = await reply.json();
    return (Array.isArray(answer) ? answer : [])
      .filter((one) => one.id != null && one.latitud != null)
      .map((one) => [String(one.id), '', one.latitud, one.longitud]);
  });
  return eachStation(inTurn(run, list, run.left), async ([id]) => {
    const reply = await ask(run, `${PORTUS}/lastData/station/${id}?locale=es`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '["WIND"]',
    });
    return portusReadingOf(await reply.json(), id, run.now);
  });
}

/* SOCIB: the stations and buoys of the Balearics (OPeNDAP), m/s. */

const SOCIB_DODS =
  'https://thredds.socib.es/thredds/dodsC/mooring/weather_station';
/** The instruments NavIn reads (its list of 15.11.2026): folder, file, place. */
const SOCIB_STATIONS = [
  [
    'station_parcbit-scb_met023',
    'dep0001_station-parcbit_scb-met023',
    39.635733,
    2.631877,
  ],
  [
    'station_lamola-scb_met018',
    'dep0001_station-lamola_scb-met018',
    39.870965,
    4.310051,
  ],
  [
    'station_galfi-scb_met013',
    'dep0002_station-galfi_scb-met013',
    38.951869,
    1.219817,
  ],
  [
    'station_cabrera-scb_met027',
    'dep0001_station-cabrera_scb-met027',
    39.15071,
    2.93101,
  ],
  [
    'station_barbaria-scb_met006',
    'dep0003_station-barbaria_scb-met006',
    38.676944,
    1.392222,
  ],
  [
    'mobims_sonbou-scb_met021',
    'dep0001_mobims-sonbou_scb-met021',
    39.898481,
    4.076663,
  ],
  [
    'mobims_muro-scb_met016',
    'dep0001_mobims-muro_scb-met016',
    39.81221688,
    3.11656481,
  ],
  [
    'mobims_calamillor-scb_met012',
    'dep0004_mobims-calamillor_scb-met012',
    39.596277,
    3.383145,
  ],
  [
    'buoy_soller-scb_met024',
    'dep0005_buoy-soller_scb-met024',
    39.865058,
    2.665055,
  ],
  [
    'buoy_portocolom-scb_met028',
    'dep0003_buoy-portocolom_scb-met028',
    39.403056,
    3.286667,
  ],
  [
    'buoy_bahiadepalma-scb_met029',
    'dep0002_buoy-bahiadepalma_scb-met029',
    39.498883,
    2.702133,
  ],
];
const SOCIB_FIELDS = ['time', 'WIN_SPE', 'WIN_SPE_GUS', 'WIN_DIR'];

function numbersOf(part) {
  return part
    .split(',')
    .map((one) => Number(one.trim()))
    .filter((one) => Number.isFinite(one));
}

/** The numbers of an OPeNDAP ASCII answer, by variable. */
function opendapValues(text) {
  const data = text.split(/^-{10,}$/mu, 2)[1] ?? '';
  const values = {};
  let current = '';
  for (const raw of data.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head =
      /^(?<name>[A-Za-z_]\w*)(?:\[\d+\])?(?:,\s*(?<rest>.*))?$/u.exec(
        line,
      )?.groups;
    if (head) {
      current = head.name;
      values[current] = head.rest === undefined ? [] : numbersOf(head.rest);
    } else if (current) {
      values[current].push(...numbersOf(line));
    }
  }
  return values;
}

function socibReadingOf(values, id, now) {
  const times = values.time ?? [];
  const index = times.length - 1;
  const avg = values.WIN_SPE?.[index];
  if (times[index] == null || avg == null) return null;
  const t = times[index] * 1000;
  if (!fresh(t, now, 70 * 60_000)) return null;
  return {
    k: `SOCIB:${id}`,
    t,
    a: knots(avg),
    g: knots(values.WIN_SPE_GUS?.[index]),
    d: values.WIN_DIR?.[index] ?? null,
  };
}

async function socibRead(run) {
  // Two requests a station.
  const chosen = inTurn(run, SOCIB_STATIONS, Math.floor(run.left / 2));
  return eachStation(chosen, async ([folder, file]) => {
    const base = `${SOCIB_DODS}/${folder}/L1/${file}_L1_latest.nc`;
    const dds = await textOf(run, `${base}.dds`);
    const size = Number(/time\[time = (?<size>\d+)\]/u.exec(dds)?.groups.size);
    if (!Number.isFinite(size) || size < 1) return null;
    const last = `%5B${size - 1}%5D`;
    const query = SOCIB_FIELDS.filter(
      (field) => field === 'time' || dds.includes(` ${field}[`),
    )
      .map((field) => `${field}${last}`)
      .join(',');
    const text = await textOf(run, `${base}.ascii?${query}`);
    return socibReadingOf(opendapValues(text), folder, run.now);
  });
}

/* Rijkswaterstaat: the Dutch coast, the platforms, the IJsselmeer (POST). */

const RWS_BASE = 'https://ddapi20-waterwebservices.rijkswaterstaat.nl';
const NETHERLANDS = [50.7, 2, 55.5, 7.3];
/** A measurement older than this is not kept (Rijkswaterstaat, Frost). */
const NORTH_AGE_MS = 90 * 60_000;
/** Places asked in one request. */
const RWS_MOST = 40;

function rwsPlacesOf(catalog) {
  const wind = new Set(
    (catalog?.AquoMetadataLijst ?? [])
      .filter((meta) => meta.Grootheid?.Code === 'WINDSHD')
      .map((meta) => meta.AquoMetadata_MessageID),
  );
  const at = new Set(
    (catalog?.AquoMetadataLocatieLijst ?? [])
      .filter((link) => wind.has(link.AquoMetaData_MessageID))
      .map((link) => link.Locatie_MessageID),
  );
  return (catalog?.LocatieLijst ?? [])
    .filter(
      (place) =>
        at.has(place.Locatie_MessageID) &&
        place.Code &&
        Number.isFinite(place.Lat) &&
        Number.isFinite(place.Lon),
    )
    .map((place) => [place.Code, '', place.Lat, place.Lon]);
}

/** The newest value of each place and quantity (`code|WINDSHD`). */
function rwsNewest(answer, now) {
  const newest = new Map();
  for (const one of answer?.WaarnemingenLijst ?? []) {
    const place = one.Locatie?.Code;
    const what = one.AquoMetadata?.Grootheid?.Code;
    if (!place || !what) continue;
    for (const measure of one.MetingenLijst ?? []) {
      const t = Date.parse(measure.Tijdstip ?? '');
      const value = measure.Meetwaarde?.Waarde_Numeriek;
      if (!Number.isFinite(t) || typeof value !== 'number') continue;
      if (now - t > NORTH_AGE_MS || value > 900) continue;
      const key = `${place}|${what}`;
      if (!(newest.get(key)?.t >= t)) newest.set(key, { t, value });
    }
  }
  return newest;
}

async function rwsRead(run) {
  const list = await keptList(run, 'rws-list', async () => {
    const reply = await ask(
      run,
      `${RWS_BASE}/METADATASERVICES/OphalenCatalogus`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CatalogusFilter: { Grootheden: true, Compartimenten: true },
        }),
      },
    );
    return rwsPlacesOf(await reply.json());
  });
  const chosen = inTurn(run, list, run.left > 0 ? RWS_MOST : 0);
  if (chosen.length === 0) return [];
  const reply = await ask(
    run,
    `${RWS_BASE}/ONLINEWAARNEMINGENSERVICES/OphalenLaatsteWaarnemingen`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        LocatieLijst: chosen.map(([id]) => ({ Code: id })),
        AquoPlusWaarnemingMetadataLijst: ['WINDSHD', 'WINDST', 'WINDRTG'].map(
          (code) => ({ AquoMetadata: { Grootheid: { Code: code } } }),
        ),
      }),
    },
  );
  const newest = rwsNewest(await reply.json(), run.now);
  return chosen.flatMap(([id]) => {
    const speed = newest.get(`${id}|WINDSHD`);
    if (!speed) return [];
    const gust = newest.get(`${id}|WINDST`);
    const dir = newest.get(`${id}|WINDRTG`);
    return [
      {
        k: `Rijkswaterstaat (Pays-Bas):${id}`,
        t: speed.t,
        a: speed.value * KN_PER_MS,
        g: gust ? gust.value * KN_PER_MS : null,
        d: dir ? dir.value : null,
      },
    ];
  });
}

/* MET Norway, Frost (client ID): the coast of Norway, two calls a point. */

const FROST_BASE = 'https://frost.met.no';
const NORWAY = [57.5, 4, 71.5, 31.5];
const FROST_MOST = 30;

async function frostRead(run) {
  const headers = { Authorization: `Basic ${btoa(`${run.env.FROST_KEY}:`)}` };
  const elements = [
    'wind_speed',
    'wind_from_direction',
    'max(wind_speed_of_gust PT10M)',
    'max(wind_speed_of_gust PT1H)',
  ].join(',');
  const done = new Set();
  const readings = [];
  /* eslint-disable no-await-in-loop -- one point after the other */
  for (const p of run.points) {
    if (run.left < 2) break;
    try {
      const sources = await ask(
        run,
        `${FROST_BASE}/sources/v0.jsonld?types=SensorSystem&elements=wind_speed&geometry=nearest(POINT(${p.lon.toFixed(4)} ${p.lat.toFixed(4)}))&nearestmaxcount=${FROST_MOST}&fields=id,name,shortName,geometry`,
        { headers },
      );
      const found = await sources.json();
      const ids = (found.data ?? [])
        .filter((source) => {
          const [lon, lat] = source.geometry?.coordinates ?? [];
          return (
            source.id &&
            !done.has(source.id) &&
            Number.isFinite(lat) &&
            distKm(p, { lat, lon }) < (p.km ?? 60)
          );
        })
        .map((source) => source.id);
      if (ids.length === 0) continue;
      for (const id of ids) done.add(id);
      const observations = await ask(
        run,
        `${FROST_BASE}/observations/v0.jsonld?sources=${ids.join(',')}&elements=${encodeURIComponent(elements)}&referencetime=latest&maxage=PT2H`,
        { headers },
      );
      const answer = await observations.json();
      const newest = new Map();
      for (const entry of answer.data ?? []) {
        const id = (entry.sourceId ?? '').split(':', 1)[0];
        const t = Date.parse(entry.referenceTime ?? '');
        if (!id || !Number.isFinite(t) || run.now - t > NORTH_AGE_MS) continue;
        for (const one of entry.observations ?? []) {
          if (!one.elementId || typeof one.value !== 'number') continue;
          const key = `${id}|${one.elementId}`;
          if (!(newest.get(key)?.t >= t)) {
            newest.set(key, { t, value: one.value });
          }
        }
      }
      for (const id of ids) {
        const speed = newest.get(`${id}|wind_speed`);
        if (!speed) continue;
        const gust =
          newest.get(`${id}|max(wind_speed_of_gust PT10M)`) ??
          newest.get(`${id}|max(wind_speed_of_gust PT1H)`);
        const dir = newest.get(`${id}|wind_from_direction`);
        readings.push({
          k: `MET Norway (Norvège):${id}`,
          t: speed.t,
          a: speed.value * KN_PER_MS,
          g: gust ? gust.value * KN_PER_MS : null,
          d: dir ? dir.value : null,
        });
      }
    } catch {
      // This point next time.
    }
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

/* IPMA: Portugal, Madeira, the Azores; hourly, about two hours late. */

const IPMA_DATA =
  'https://api.ipma.pt/open-data/observation/meteorology/stations';
const PORTUGAL = [30, -32, 42.3, -6];
/** The eight points of IPMA (1 = north … 8 = north-west). */
const IPMA_POINTS = [null, 0, 45, 90, 135, 180, 225, 270, 315, null];

async function ipmaRead(run) {
  const list = await keptList(run, 'ipma-list', async () => {
    const reply = await ask(run, `${IPMA_DATA}/stations.json`);
    const answer = await reply.json();
    return (Array.isArray(answer) ? answer : []).flatMap(
      ({ geometry, properties }) => {
        const [lon, lat] = geometry?.coordinates ?? [];
        return properties?.idEstacao != null && lat != null && lon != null
          ? [[String(properties.idEstacao), '', lat, lon]]
          : [];
      },
    );
  });
  const ids = run.points.flatMap((p) =>
    near(list, p, p.km ?? 60)
      .slice(0, AREA_MOST)
      .map(([id]) => id),
  );
  if (ids.length === 0) return [];
  const answer = await ask(run, `${IPMA_DATA}/observations.json`);
  const hours = await answer.json();
  const times = Object.keys(hours).toSorted().toReversed();
  const readings = [];
  for (const id of new Set(ids)) {
    for (const time of times) {
      const hour = hours[time]?.[id];
      const speed = hour?.intensidadeVento;
      if (!hour || speed == null || speed < 0) continue;
      const t = Date.parse(`${time}:00Z`);
      if (fresh(t, run.now, 4 * HOUR_MS)) {
        readings.push({
          k: `IPMA (Portugal):${id}`,
          t,
          a: knots(speed),
          g: null,
          d: IPMA_POINTS[hour.idDireccVento ?? -1] ?? null,
        });
      }
      break;
    }
  }
  return readings;
}

/* DMI: Denmark, its coasts and islands; three answers for the box. */

const DMI_API = 'https://opendataapi.dmi.dk/v2/metObs/collections';
const DENMARK = [54, 7, 58.5, 16];

/** The box of the points within a country: west,south,east,north. */
function boxOf(points, [south, west, north, east]) {
  const sides = points.map((p) => {
    const dLat = (p.km ?? 60) / 111;
    const dLon =
      (p.km ?? 60) / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
    return [p.lat - dLat, p.lon - dLon, p.lat + dLat, p.lon + dLon];
  });
  return [
    Math.max(west, Math.min(...sides.map((s) => s[1]))),
    Math.max(south, Math.min(...sides.map((s) => s[0]))),
    Math.min(east, Math.max(...sides.map((s) => s[3]))),
    Math.min(north, Math.max(...sides.map((s) => s[2]))),
  ]
    .map((value) => value.toFixed(2))
    .join(',');
}

async function dmiRead(run) {
  const box = boxOf(run.points, DENMARK);
  const lists = await Promise.all(
    ['wind_speed', 'wind_dir', 'wind_max'].map(async (parameter) => {
      try {
        const reply = await ask(
          run,
          `${DMI_API}/observation/items?parameterId=${parameter}&bbox=${box}&period=latest-hour&limit=10000`,
        );
        const answer = await reply.json();
        return answer.features ?? [];
      } catch {
        return [];
      }
    }),
  );
  const stations = new Map();
  for (const { geometry, properties } of lists.flat()) {
    const id = properties?.stationId;
    const [lon, lat] = geometry?.coordinates ?? [];
    const t = Date.parse(properties?.observed ?? '');
    if (!id || lat == null || lon == null || properties.value == null) continue;
    const station = stations.get(id) ?? { lat, lon, t, values: {} };
    const parameter = properties.parameterId ?? '';
    if (t >= station.t || station.values[parameter] == null) {
      station.values[parameter] = properties.value;
      station.t = Math.max(station.t, t);
    }
    stations.set(id, station);
  }
  const readings = [...stations]
    .filter(
      ([, s]) =>
        s.values.wind_speed != null && fresh(s.t, run.now, 70 * 60_000),
    )
    .map(([id, s]) => ({
      k: `DMI (Danemark):${id}`,
      t: s.t,
      a: knots(s.values.wind_speed),
      g: knots(s.values.wind_max),
      d: s.values.wind_dir ?? null,
      lat: s.lat,
      lon: s.lon,
    }));
  return closest(run, readings);
}

/* SMHI: Sweden, the Baltic; the latest hour of every station, three asks. */

const SMHI_API =
  'https://opendata-download-metobs.smhi.se/api/version/1.0/parameter';
const SWEDEN = [55, 10.5, 69.5, 24.5];

/** The latest value of each SMHI station of one parameter. */
function smhiLast(stations) {
  return new Map(
    stations.map((s) => {
      const last = s.value?.at(-1);
      return [s.key ?? '', last ? Number(last.value) : Number.NaN];
    }),
  );
}

async function smhiRead(run) {
  const [speed, direction, gust] = await Promise.all(
    [4, 3, 21].map(async (parameter) => {
      try {
        const reply = await ask(
          run,
          `${SMHI_API}/${parameter}/station-set/all/period/latest-hour/data.json`,
        );
        const answer = await reply.json();
        return answer.station ?? [];
      } catch {
        return [];
      }
    }),
  );
  const directions = smhiLast(direction);
  const gusts = smhiLast(gust);
  const readings = [];
  for (const s of speed) {
    const last = s.value?.at(-1);
    const value = Number(last?.value);
    if (!s.key || s.latitude == null || s.longitude == null) continue;
    if (!Number.isFinite(value)) continue;
    if (!fresh(last?.date ?? Number.NaN, run.now, 2 * HOUR_MS)) continue;
    const dir = directions.get(s.key);
    const most = gusts.get(s.key);
    readings.push({
      k: `SMHI (Suède):${s.key}`,
      t: last.date,
      a: knots(value),
      g: most != null && Number.isFinite(most) ? knots(most) : null,
      d: dir != null && Number.isFinite(dir) ? dir : null,
      lat: s.latitude,
      lon: s.longitude,
    });
  }
  return closest(run, readings);
}

/* FMI: Finland, the Åland islands, the gulfs; one WFS answer a point. */

const FMI_WFS = 'https://opendata.fmi.fi/wfs';
const FINLAND = [59.3, 19, 70.2, 31.6];

function fmiReadingsOf(xml, now) {
  const stations = new Map();
  for (const member of xml.split('<wfs:member>').slice(1)) {
    const pos = /<gml:pos>(?<lat>[\d.-]+)\s+(?<lon>[\d.-]+)/u.exec(
      member,
    )?.groups;
    const parameter = /gml:id="obs-obs-\d+-\d+-(?<parameter>[a-z]+)"/u.exec(
      member,
    )?.groups.parameter;
    if (!/locationcode\/name">[^<]+</u.test(member) || !pos || !parameter) {
      continue;
    }
    let t = Number.NaN;
    let value = Number.NaN;
    for (const point of member.matchAll(
      /<wml2:time>(?<time>[^<]+)<\/wml2:time>\s*<wml2:value>(?<value>[^<]+)<\/wml2:value>/gu,
    )) {
      const number = Number(point.groups.value);
      if (Number.isFinite(number)) {
        t = Date.parse(point.groups.time);
        value = number;
      }
    }
    if (!Number.isFinite(value)) continue;
    const id = `${pos.lat},${pos.lon}`;
    const station = stations.get(id) ?? {
      lat: Number(pos.lat),
      lon: Number(pos.lon),
      t,
      values: {},
    };
    station.values[parameter] = value;
    station.t = Number.isFinite(station.t) ? Math.max(station.t, t) : t;
    stations.set(id, station);
  }
  return [...stations]
    .filter(
      ([, s]) => s.values.windspeedms != null && fresh(s.t, now, 70 * 60_000),
    )
    .map(([id, s]) => ({
      k: `FMI (Finlande):${id}`,
      t: s.t,
      a: knots(s.values.windspeedms),
      g: knots(s.values.windgust),
      d: s.values.winddirection ?? null,
      lat: s.lat,
      lon: s.lon,
    }));
}

async function fmiRead(run) {
  const start = new Date(run.now - HOUR_MS).toISOString().slice(0, 16);
  const found = new Map();
  /* eslint-disable no-await-in-loop -- one point after the other */
  for (const p of run.points) {
    if (run.left <= 0) break;
    try {
      const reply = await ask(
        run,
        `${FMI_WFS}?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&bbox=${boxOf([p], [-90, -180, 90, 180])}&parameters=windspeedms,winddirection,windgust&starttime=${start}:00Z`,
      );
      const answer = await reply.text();
      for (const one of closest(
        { points: [p] },
        fmiReadingsOf(answer, run.now),
      )) {
        found.set(one.k, one);
      }
    } catch {
      // This point next time.
    }
  }
  /* eslint-enable no-await-in-loop */
  return [...found.values()];
}

/* DHMZ: Croatia, the coast and the islands; one XML, local hour of Zagreb. */

const DHMZ_XML = 'https://vrijeme.hr/hrvatska_n.xml';
const CROATIA = [42.3, 13.4, 46.6, 19.5];
const DHMZ_POINTS = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/**
 * A local hour of Zagreb in epoch ms: summer time (+2 h) from the last
 * Sunday of March to the last Sunday of October at 01:00 UTC, else +1 h.
 */
function zagrebTime(day, hour) {
  const [d, m, y] = day.split('.').map(Number);
  if (!d || !m || !y || !Number.isFinite(hour)) return Number.NaN;
  const lastSunday = (month) => {
    const end = new Date(Date.UTC(y, month + 1, 0));
    return Date.UTC(y, month, end.getUTCDate() - end.getUTCDay(), 1);
  };
  const guess = Date.UTC(y, m - 1, d, hour);
  const summer =
    guess - 2 * HOUR_MS >= lastSunday(2) && guess - HOUR_MS < lastSunday(9);
  return guess - (summer ? 2 : 1) * HOUR_MS;
}

function xmlField(text, name) {
  return (
    new RegExp(`<${name}>(?<value>[^<]*)</${name}>`, 'u')
      .exec(text)
      ?.groups.value.trim() ?? ''
  );
}

async function dhmzRead(run) {
  const xml = await textOf(run, DHMZ_XML);
  const t = zagrebTime(
    xmlField(xml, 'Datum'),
    Number(xmlField(xml, 'Termin') || Number.NaN),
  );
  if (!fresh(t, run.now, 2 * HOUR_MS)) return [];
  const readings = xml
    .split('<Grad ')
    .slice(1)
    .flatMap((part) => {
      const name = xmlField(part, 'GradIme');
      const lat = Number(xmlField(part, 'Lat'));
      const lon = Number(xmlField(part, 'Lon'));
      const speed = xmlField(part, 'VjetarBrzina');
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      if (speed === '' || !Number.isFinite(Number(speed))) return [];
      return [
        {
          k: `DHMZ (Croatie):${name}`,
          t,
          a: knots(Number(speed)),
          g: null,
          d: DHMZ_POINTS[xmlField(part, 'VjetarSmjer')] ?? null,
          lat,
          lon,
        },
      ];
    });
  return closest(run, readings);
}

/**
 * The networks read in turn, with the names NavIn gives them. `covers`: a
 * point it may hold stations for; `weight`: rough ms of CPU to read it;
 * `every`: read no more often (their data are hourly); `need`: the
 * requests it takes for its points (the networks without it read one
 * station a request or two, and share what the others leave); `least`:
 * fewer requests left, it waits for the next run; `share`: its part.
 */
const NETS = [
  {
    name: 'Météo-France',
    key: 'MF_KEY',
    covers: () => true,
    weight: 1,
    least: 2,
    share: 2,
    read: (run) => mfRead(run.env, run.points, run.now, run.left),
  },
  {
    name: 'AEMET',
    key: 'AEMET_KEY',
    covers: nearSpain,
    weight: 1,
    every: HOUR_MS,
    need: () => 2 + 2 * AEMET_MOST,
    least: 4,
    read: async (run) => {
      const spain = await aemetRead(run.env, run.points, run.now, run.left);
      return spain.readings;
    },
  },
  {
    name: 'MeteoSwiss',
    covers: (p) => touches(p, SWITZERLAND),
    weight: 1,
    least: 2,
    share: 2,
    read: smnRead,
  },
  {
    name: 'NOAA NDBC',
    covers: () => true,
    weight: 1,
    every: HOUR_MS / 2,
    least: 2,
    read: ndbcRead,
  },
  {
    name: 'Met Office',
    key: 'METOFFICE_KEY',
    covers: nearBritain,
    weight: 1,
    every: HOUR_MS,
    need: (points) => 4 * points.length,
    least: 2,
    read: metOfficeRead,
  },
  {
    name: 'ItaliaMeteo',
    covers: nearItaly,
    weight: 2,
    need: () => 1,
    read: hubRead,
  },
  {
    name: 'Puertos del Estado',
    covers: nearSpain,
    weight: 1,
    least: 2,
    read: portusRead,
  },
  {
    name: 'SOCIB',
    covers: (p) => distKm(p, { lat: 39.5, lon: 2.9 }) <= (p.km ?? 60) + 250,
    weight: 1,
    least: 2,
    read: socibRead,
  },
  {
    name: 'Rijkswaterstaat (Pays-Bas)',
    covers: (p) => touches(p, NETHERLANDS),
    weight: 1,
    need: () => 2,
    read: rwsRead,
  },
  {
    name: 'MET Norway (Norvège)',
    key: 'FROST_KEY',
    covers: (p) => touches(p, NORWAY),
    weight: 1,
    need: (points) => 2 * points.length,
    least: 2,
    read: frostRead,
  },
  {
    name: 'IPMA (Portugal)',
    covers: (p) => touches(p, PORTUGAL),
    weight: 2,
    every: HOUR_MS,
    need: () => 2,
    read: ipmaRead,
  },
  {
    name: 'DMI (Danemark)',
    covers: (p) => touches(p, DENMARK),
    weight: 1,
    need: () => 3,
    read: dmiRead,
  },
  {
    name: 'SMHI (Suède)',
    covers: (p) => touches(p, SWEDEN),
    weight: 1,
    every: HOUR_MS / 2,
    need: () => 3,
    read: smhiRead,
  },
  {
    name: 'FMI (Finlande)',
    covers: (p) => touches(p, FINLAND),
    weight: 2,
    need: (points) => points.length,
    read: fmiRead,
  },
  {
    name: 'DHMZ (Croatie)',
    covers: (p) => touches(p, CROATIA),
    weight: 1,
    every: HOUR_MS / 2,
    need: () => 1,
    read: dhmzRead,
  },
];

/**
 * The networks of this run: those around the points, the longest unread
 * first, while RUN_WEIGHT and the requests allow; the networks read a
 * station at a time share the requests the others leave. `state` keeps,
 * per network, when it was read (`at`) and where its turn of stations is
 * (`o`).
 */
async function readNets(env, points, now, left, state) {
  state.at ??= {};
  state.o ??= {};
  const ready = NETS.filter(
    (net) =>
      (!net.key || env[net.key]) &&
      now - (state.at[net.name] ?? 0) >= (net.every ?? 0) - 60_000 &&
      points.some((p) => net.covers(p)),
  ).toSorted((a, b) => (state.at[a.name] ?? 0) - (state.at[b.name] ?? 0));
  const picked = [];
  let weight = 0;
  let spare = left;
  for (const net of ready) {
    if (picked.length > 0 && weight + net.weight > RUN_WEIGHT) continue;
    const near = points.filter((p) => net.covers(p));
    const asked = Math.min(net.need ? net.need(near) : net.least, spare);
    if (asked < (net.least ?? 1)) continue;
    picked.push({ net, near, asked });
    weight += net.weight;
    spare -= asked;
  }
  const parts = picked
    .filter((one) => !one.net.need)
    .reduce((sum, one) => sum + (one.net.share ?? 1), 0);
  for (const one of picked) {
    if (!one.net.need) {
      one.asked += Math.floor((spare * (one.net.share ?? 1)) / parts);
    }
  }
  const readings = [];
  /* eslint-disable no-await-in-loop -- one network after the other */
  for (const { net, near, asked } of picked) {
    const run = { env, now, points: near, left: asked, o: state.o[net.name] };
    try {
      readings.push(...(await net.read(run)));
    } catch {
      // This network next turn.
    }
    state.at[net.name] = now;
    if (run.o) state.o[net.name] = run.o;
    else delete state.o[net.name];
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

function permission(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin)
      ? origin
      : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body, origin) {
  return Response.json(body, {
    headers: { ...permission(origin), 'Content-Type': 'application/json' },
  });
}

/**
 * The synchronisation: `index` lists the devices and when each sent; `dev`
 * and `ph` keep what a device or a photo sent, as text never read here.
 * @param {Request} request - The request.
 * @param {{ NAVIN?: KVNamespace }} env - The KV of the relay.
 * @param {{ space: string, kind: string, name?: string }} where - The path.
 * @param {string} origin - The page asking.
 * @returns {Promise<Response>} The answer.
 */
async function syncAnswer(request, env, where, origin) {
  if (!env?.NAVIN) {
    return new Response('No storage', {
      status: 501,
      headers: permission(origin),
    });
  }
  const { space, kind, name } = where;
  const indexKey = `sync:${space}:index`;
  if (kind === 'index') {
    return json(await readJson(env, indexKey, {}), origin);
  }
  if (!name) return new Response('Bad name', { status: 400 });
  const key = `sync:${space}:${kind}:${name}`;
  if (request.method === 'GET') {
    const text = await env.NAVIN.get(key);
    return text == null
      ? new Response('None', { status: 404, headers: permission(origin) })
      : new Response(text, {
          headers: { ...permission(origin), 'Content-Type': 'text/plain' },
        });
  }
  if (request.method !== 'PUT') {
    return new Response('Forbidden', { status: 403 });
  }
  const text = await request.text();
  if (text.length > SYNC_MOST) {
    return new Response('Too big', {
      status: 413,
      headers: permission(origin),
    });
  }
  await env.NAVIN.put(key, text);
  // A device says when it sent: the others read it again only then.
  if (kind === 'dev') {
    const index = await readJson(env, indexKey, {});
    index[name] = { at: Date.now(), size: text.length };
    await env.NAVIN.put(indexKey, JSON.stringify(index));
  }
  return json({ ok: true }, origin);
}

export default {
  async scheduled(event, env) {
    if (env.NAVIN) await record(env);
  },
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...permission(origin),
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    const url = new URL(request.url);
    // The menus, without any personal data, read from the Mac as well.
    if (url.pathname === '/menus' && request.method === 'GET') {
      const text = env?.NAVIN ? await env.NAVIN.get('menus') : null;
      return text == null
        ? new Response('None', { status: 404, headers: permission(origin) })
        : new Response(text, {
            headers: {
              ...permission(origin),
              'Content-Type': 'application/json',
            },
          });
    }
    if (!ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (url.pathname === '/menus' && request.method === 'PUT') {
      if (!env?.NAVIN) return new Response('No storage', { status: 501 });
      const text = await request.text();
      if (text.length > MENUS_MOST) {
        return new Response('Too big', {
          status: 413,
          headers: permission(origin),
        });
      }
      await env.NAVIN.put('menus', text);
      return json({ ok: true }, origin);
    }
    const sync = SYNC_PATH.exec(url.pathname);
    if (sync?.groups) return syncAnswer(request, env, sync.groups, origin);
    // The recording: a device sends its points and what it read.
    if (url.pathname === '/record') {
      if (!env?.NAVIN) return json({ recording: false }, origin);
      if (request.method !== 'POST') {
        return json({ recording: true, reads: keyedNets(env) }, origin);
      }
      const body = await request.json().catch(() => ({}));
      const now = Date.now();
      if (typeof body.device === 'string' && Array.isArray(body.points)) {
        const devices = await readJson(env, 'points', {});
        devices[body.device.slice(0, 40)] = {
          at: now,
          points: body.points
            .slice(0, 8)
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
            .map((p) => ({
              lat: p.lat,
              lon: p.lon,
              km: Math.min(250, p.km ?? 60),
            })),
        };
        await env.NAVIN.put('points', JSON.stringify(devices));
      }
      if (Array.isArray(body.readings) && body.readings.length > 0) {
        const past = addReadings(
          await readJson(env, 'past', {}),
          body.readings.slice(0, 2000),
          now,
        );
        await env.NAVIN.put('past', JSON.stringify(past));
      }
      return json({ recording: true }, origin);
    }
    // The past of stations: `?k=net:id` (several, comma-separated).
    if (url.pathname === '/history') {
      if (!env?.NAVIN) return json({}, origin);
      const [sent, read] = await Promise.all([
        readJson(env, 'past', {}),
        readJson(env, 'past-relay', {}),
      ]);
      const keys = (url.searchParams.get('k') ?? '').split(',').slice(0, 50);
      const listOf = (past, k) =>
        k !== STATE_KEY && Array.isArray(past[k]) ? past[k] : [];
      return json(
        Object.fromEntries(
          keys.map((k) => [k, mergePast(listOf(sent, k), listOf(read, k))]),
        ),
        origin,
      );
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Forbidden', { status: 403 });
    }
    const asked = url.searchParams.get('url') ?? '';
    let target;
    try {
      target = new URL(asked);
    } catch {
      return new Response('Bad url', {
        status: 400,
        headers: permission(origin),
      });
    }
    if (target.protocol !== 'https:' || !HOSTS.has(target.hostname)) {
      return new Response('Host not allowed', {
        status: 403,
        headers: permission(origin),
      });
    }
    const posted = request.method === 'POST';
    if (posted && !POSTED.has(target.hostname)) {
      return new Response('Forbidden', {
        status: 403,
        headers: permission(origin),
      });
    }
    const sent = { 'User-Agent': 'NavIn relay' };
    const key = request.headers.get('Authorization');
    if (key && KEYED.has(target.hostname)) sent.Authorization = key;
    const answer = posted
      ? await fetch(target.toString(), {
          method: 'POST',
          headers: { ...sent, 'Content-Type': 'application/json' },
          body: await request.text(),
        })
      : await fetch(target.toString(), {
          headers: sent,
          // A keyed answer is never kept for another key.
          ...(key
            ? {}
            : { cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true } }),
        });
    const headers = new Headers(answer.headers);
    for (const [name, value] of Object.entries(permission(origin))) {
      headers.set(name, value);
    }
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    return new Response(answer.body, { status: answer.status, headers });
  },
};

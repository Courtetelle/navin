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
 * the points the devices sent (the GPS and the three zones): every 10
 * minutes it reads the OpenWindMap beacons and the METAR itself, NavIn
 * closed; and each device sends what it read (Météo-France, AEMET…), so
 * that T, P and X share one past.
 *
 * Keyed networks NavIn closed (optional): with the secret « MF_KEY » (the
 * Météo-France key) the relay reads every 10 minutes the Météo-France
 * stations around the points; with « AEMET_KEY », the AEMET stations near
 * Spain. The keys are typed by the skipper in Cloudflare, kept there as
 * secrets, and never sent back.
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

/** The only pages allowed to use the relay. */
const ORIGINS = ['https://courtetelle.github.io', 'http://localhost:11106'];

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

/** Every 10 minutes: the beacons and the airports around the points. */
async function record(env) {
  const now = Date.now();
  const points = allPoints(await readJson(env, 'points', {}), now);
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
  let left = RUN_REQUESTS - 1 - points.length;
  if (env.AEMET_KEY) {
    const spain = await aemetRead(env, points, now, left);
    left -= spain.asked;
    readings.push(...spain.readings);
  }
  if (env.MF_KEY) readings.push(...(await mfRead(env, points, now, left)));
  // Its own record: what the devices send goes to `past`, so that neither
  // writes over the other.
  const past = addReadings(
    await readJson(env, 'past-relay', {}),
    readings,
    now,
  );
  await env.NAVIN.put('past-relay', JSON.stringify(past));
}

/** The networks the relay reads itself, with the keys it was given. */
function keyedNets(env) {
  return [env.MF_KEY && 'Météo-France', env.AEMET_KEY && 'AEMET'].filter(
    Boolean,
  );
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

function permission(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin)
      ? origin
      : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body, origin) {
  return Response.json(body, {
    headers: { ...permission(origin), 'Content-Type': 'application/json' },
  });
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
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }
    if (!ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
    const url = new URL(request.url);
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
      return json(
        Object.fromEntries(
          keys.map((k) => [k, mergePast(sent[k] ?? [], read[k] ?? [])]),
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

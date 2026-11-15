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
 */

/** The only hosts the relay asks. */
const HOSTS = new Set([
  'aviationweather.gov',
  'www.ndbc.noaa.gov',
  'vrijeme.hr',
]);

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
  const past = addReadings(await readJson(env, 'past', {}), readings, now);
  await env.NAVIN.put('past', JSON.stringify(past));
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
          'Access-Control-Allow-Headers': 'Content-Type',
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
      if (request.method !== 'POST') return json({ recording: true }, origin);
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
      const past = await readJson(env, 'past', {});
      const keys = (url.searchParams.get('k') ?? '').split(',').slice(0, 50);
      return json(
        Object.fromEntries(keys.map((k) => [k, past[k] ?? []])),
        origin,
      );
    }
    if (request.method !== 'GET') {
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
    const answer = await fetch(target.toString(), {
      headers: { 'User-Agent': 'NavIn relay' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    const headers = new Headers(answer.headers);
    for (const [name, value] of Object.entries(permission(origin))) {
      headers.set(name, value);
    }
    headers.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    return new Response(answer.body, { status: answer.status, headers });
  },
};

/**
 * The relay of NavIn (a Cloudflare Worker, free plan): it fetches for the app
 * the public data whose servers do not let a web page read them (no CORS),
 * and gives them back with the permission. Only the hosts below, only GET,
 * only for the NavIn site; each answer is cached 5 minutes.
 *
 * Install: dash.cloudflare.com › Workers & Pages › Create › Worker, paste
 * this file, Deploy; then copy its address (https://….workers.dev) into
 * NavIn › Réglages › Clés météo › Relais des METAR et bouées.
 */

/** The only hosts the relay asks. */
const HOSTS = new Set(['aviationweather.gov', 'www.ndbc.noaa.gov']);

/** The only pages allowed to use the relay. */
const ORIGINS = ['https://courtetelle.github.io', 'http://localhost:11106'];

/** Seconds an answer is kept. */
const CACHE_SECONDS = 300;

function permission(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin)
      ? origin
      : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: permission(origin) });
    }
    if (request.method !== 'GET' || !ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
    const asked = new URL(request.url).searchParams.get('url') ?? '';
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

// Cache de l'appli : tout fonctionne sans réseau, une fois l'appli ouverte une première fois.
const CACHE = 'livre-de-bord-v453';
const TILES = 'livre-de-bord-tuiles'; // tuiles de carte déjà vues, gardées d'une version à l'autre
const MAX_TILES = 10000;
const ICONS = ['navin5', 'navin6', 'navin1', 'navin2', 'navin3', 'navin4', 'compas', 'voilier', 'ancre', 'barre', 'livre', 'nuit'];
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'auto.js', 'map.js', 'chart.js', 'ui-edit.js', 'marks.js', 'prep.js', 'lake.js', 'nmea.js', 'nav.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png',
  ...ICONS.flatMap((i) => [`icons/${i}-180.png`, `icons/${i}-512.png`, `icons/${i}.svg`, `icons/manifest-${i}.webmanifest`])];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILES && k !== 'livre-de-bord-zones').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isTile = (url) => /tile\.openstreetmap\.org|tiles\.openseamap\.org|basemaps\.cartocdn\.com|wmts\.geo\.admin\.ch|ogc\.vd\.ch/.test(url.hostname);

// WMS : même image quel que soit l'ordre des paramètres ou les décimales du cadre (téléchargement hors ligne).
function tileKey(url, req) {
  if (!/ogc\.vd\.ch/.test(url.hostname) || !/getmap/i.test(url.search)) return req;
  const ps = [...url.searchParams].map(([k, v]) => [k.toLowerCase(), k.toLowerCase() === 'bbox' ? v.split(',').map((n) => Math.round(Number(n))).join(',') : v]);
  ps.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return url.origin + url.pathname + '?' + ps.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
let puts = 0;
async function trimTiles() {
  if (++puts % 100) return; // on ne fait le ménage que de temps en temps
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await c.delete(k);
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Tuiles : celles déjà vues s'affichent depuis le téléphone, même en mer.
  if (isTile(url)) {
    const key = tileKey(url, e.request);
    // D'abord les zones téléchargées à la main (jamais vidées), puis les tuiles déjà vues.
    e.respondWith(caches.open('livre-de-bord-zones').then((z) => z.match(key, { ignoreVary: true })).then((zhit) => zhit || caches.open(TILES).then((c) => c.match(key).then((hit) => hit || fetch(e.request).then((res) => {
      // Les images WMS vaudoises arrivent sans CORS (réponse opaque) : on les garde quand même.
      if (res.ok || (res.type === 'opaque' && /ogc\.vd\.ch/.test(url.hostname))) { c.put(key, res.clone()); trimTiles(); }
      return res;
    })))));
    return;
  }
  // Météo et autres services : réseau seulement, l'appli fait sans quand il n'y en a pas.
  if (url.origin !== self.location.origin) return;
  // Fichiers de l'appli : réseau d'abord (mises à jour au port), sinon le téléphone. Au large, 4 s maximum.
  const net = Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(rej, 4000))]);
  e.respondWith(
    net
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});

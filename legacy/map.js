'use strict';

/* =====================================================================
   Carte : trace et entrées du journal sur fond OpenStreetMap + balisage
   OpenSeaMap. La carte de fond demande du réseau (les zones déjà vues
   restent en cache) ; sans réseau, la trace s'affiche seule.
   ===================================================================== */
// Leaflet 1.9.4 est fourni avec l'appli (dossier vendor) : la carte s'ouvre même sans réseau.
const LEAFLET = 'vendor/leaflet/';
let leafletP = null;
let mapObj = null;
let mapDay = null; // null = toute la croisière
let mapWatch = null;
function stopMapWatch() { if (mapWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(mapWatch); mapWatch = null; }
// Carte nationale suisse en couleur (swisstopo, données libres) : montre les courbes de profondeur des lacs.
const SWISS_TILES = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';
const SWISS_BOUNDS = [[45.75, 5.85], [47.9, 10.6]];
const LEMAN_CENTER = [46.43, 6.55];
// Carte en ligne fournie par Corban (2026-10-31).
const LEMAN_ARCGIS = 'https://www.arcgis.com/apps/instant/sidebar/index.html?appid=37cabc11c62a446faa17e32a035850c0&locale=fr&center=6.5218;46.366&level=10';
const LEMAN_BBOX = { s: 46.18, n: 46.56, w: 6.10, e: 6.95 };
const inSwissArea = (p) => p && p.lat > 45.75 && p.lat < 47.9 && p.lon > 5.85 && p.lon < 10.6;
// Images WMS des isobathes vaudoises, zoom 10 à 15, moitié nord du lac (eaux suisses vaudoises).
const VD_WATERS = { s: 46.18, n: 46.53, w: 6.10, e: 6.95 }; // tout le Léman : le WMS vaudois couvre peut-être aussi Genève (v72)
function vdWmsTiles(layers) {
  const out = [], E = 20037508.342789244;
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const ty = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };
  for (let z = 10; z <= 15; z++) {
    const size = (2 * E) / 2 ** z;
    for (let x = tx(VD_WATERS.w, z); x <= tx(VD_WATERS.e, z); x++)
      for (let y = ty(VD_WATERS.n, z); y <= ty(VD_WATERS.s, z); y++) {
        const x0 = -E + x * size, y1 = E - y * size;
        out.push(`https://www.ogc.vd.ch/public/services/OGC/wmsVD/Mapserver/WMSServer?service=WMS&request=GetMap&layers=${encodeURIComponent(layers)}&styles=&format=image%2Fpng&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG%3A3857&bbox=${x0},${y1 - size},${x0 + size},${y1}`);
      }
  }
  return out;
}
/* ---------- Cartes des lacs toujours dans l'appli (Corban, 2026-10-31) ----------
   Léman et lac de Neuchâtel : carte nationale suisse (swisstopo) jusqu'au zoom 14, balisage OpenSeaMap et,
   pour le Léman, les isobathes vaudoises. Pas de bouton : l'appli les télécharge d'elle-même dès qu'elle a du
   réseau (au premier lancement, puis reprise si c'était interrompu), dans le cache des zones qui n'est jamais vidé. */
const LEMAN_ZMAX = 14;
const BASE_LAKES = [
  { id: 'leman', name: 'Léman', b: LEMAN_BBOX },
  { id: 'neuch', name: 'lac de Neuchâtel', b: { s: 46.74, n: 47.03, w: 6.60, e: 7.12 } },
];
function lakeTileUrls(lake) {
  const out = [];
  for (const t of zoneTileXY(lake.b, LEMAN_ZMAX)) {
    if (t[0] < 8) continue;
    out.push([zoneUrl(SWISS_TILES, t), 'cors']);
    if (t[0] >= 9) out.push([zoneUrl(ZONE_SEA, t), 'no-cors']);
  }
  return out;
}
// Même clé que le service worker pour les images WMS (paramètres triés, cadre arrondi au mètre).
function wmsKey(u) {
  const url = new URL(u);
  const ps = [...url.searchParams].map(([k, v]) => [k.toLowerCase(), k.toLowerCase() === 'bbox' ? v.split(',').map((n) => Math.round(Number(n))).join(',') : v]);
  ps.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return url.origin + url.pathname + '?' + ps.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
}
function lakesNote() {
  const st = store.get('ldb.lakesBase', {});
  return BASE_LAKES.map((l) => st[l.id] && st[l.id].done ? `${l.name} : intégrée` : `${l.name} : ${lakesBusy ? 'en cours…' : 'au prochain réseau'}`).join(' · ');
}
let lakesBusy = false;
async function autoLakes() {
  if (lakesBusy || !navigator.onLine || !('caches' in window)) return;
  if (navigator.connection && navigator.connection.saveData) return;
  const st = store.get('ldb.lakesBase', {});
  const todo = BASE_LAKES.filter((l) => !(st[l.id] && st[l.id].done));
  const vd = typeof vdIsobathLayers === 'function' && !(st.vd2 && st.vd2.done) ? await vdIsobathLayers().catch(() => []) : [];
  if (!todo.length && !vd.length) return;
  lakesBusy = true;
  const c = await caches.open(ZONE_CACHE);
  const run = async (jobs, onEnd) => {
    let i = 0, ok = 0, ko = 0;
    const worker = async () => {
      while (i < jobs.length) {
        const [u, mode, key] = jobs[i++];
        try {
          if (await c.match(key || u, { ignoreVary: true })) { ok++; continue; }
          // CORS d'abord : une réponse opaque compte pour plusieurs Mo dans le quota du navigateur.
          let r = null;
          try { r = await fetch(u, { mode: 'cors' }); } catch { r = mode === 'no-cors' ? await fetch(u, { mode: 'no-cors' }) : null; }
          if (r && (r.ok || r.type === 'opaque')) { await c.put(key || u, r); ok++; } else ko++;
        } catch { ko++; }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    onEnd(ok, ko, jobs.length);
  };
  for (const l of todo) {
    await run(lakeTileUrls(l), (ok, ko, n) => { const s2 = store.get('ldb.lakesBase', {}); s2[l.id] = { at: new Date().toISOString(), ok, n, done: ko <= n * 0.02 }; store.set('ldb.lakesBase', s2); });
  }
  if (vd.length) {
    const jobs = vdWmsTiles(vd.map((x) => x.name).join(',')).map((u) => [u, 'no-cors', wmsKey(u)]);
    await run(jobs, (ok, ko, n) => { const s2 = store.get('ldb.lakesBase', {}); s2.vd2 = { at: new Date().toISOString(), ok, n, done: ko <= n * 0.02 }; store.set('ldb.lakesBase', s2); });
  }
  lakesBusy = false;
  const s3 = store.get('ldb.lakesBase', {});
  if (BASE_LAKES.every((l) => s3[l.id] && s3[l.id].done) && !s3.toldDone) { s3.toldDone = true; store.set('ldb.lakesBase', s3); toast('Cartes du Léman et du lac de Neuchâtel intégrées : elles marchent sans réseau'); }
  const sub = $('#mapOffSub'); if (sub && sub.isConnected) sub.textContent = lakesNote();
}
setTimeout(autoLakes, 6000);
window.addEventListener('online', () => setTimeout(autoLakes, 3000));

/* ---------- Zones de navigation hors ligne (Corban, 2026-10-31) ----------
   Corban choisit à la main la zone où il va naviguer : on télécharge pour elle le plan (données OpenStreetMap,
   tuiles CARTO Voyager, car les serveurs d'OpenStreetMap interdisent le téléchargement de zones) et le balisage
   OpenSeaMap, gardés dans un cache à part ('livre-de-bord-zones') jamais vidé automatiquement.
   Chaque zone peut être supprimée. OpenSeaMap ne remplace pas une carte marine officielle. */
const ZONE_CACHE = 'livre-de-bord-zones';
const ZONE_BASE = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const ZONE_SEA = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';
const ZONE_MAX = 8000; // tuiles par couche et par zone, pour rester raisonnable
const zoneList = () => store.get('ldb.zones', []);
const zoneSave = (l) => store.set('ldb.zones', l);
function zoneTileXY(b, zmax) {
  const out = [];
  const tx = (lon, z) => Math.max(0, Math.min(2 ** z - 1, Math.floor(((lon + 180) / 360) * 2 ** z)));
  const ty = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.max(0, Math.min(2 ** z - 1, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z))); };
  for (let z = 6; z <= zmax; z++)
    for (let x = tx(b.w, z); x <= tx(b.e, z); x++)
      for (let y = ty(b.n, z); y <= ty(b.s, z); y++) out.push([z, x, y]);
  return out;
}
const zoneUrl = (tpl, [z, x, y]) => tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
function zoneLayer() {
  return window.L.tileLayer(ZONE_BASE, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, attribution: '© OpenStreetMap © CARTO' });
}
const zoneAt = (ll) => zoneList().find((z) => ll && ll[0] >= z.b.s && ll[0] <= z.b.n && ll[1] >= z.b.w && ll[1] <= z.b.e);
let zoneBusy = false;
async function zoneDownload(zone, onProg) {
  const tiles = zoneTileXY(zone.b, zone.zmax);
  const c = await caches.open(ZONE_CACHE);
  let i = 0, ok = 0, ko = 0;
  const jobs = [];
  for (const t of tiles) { jobs.push([zoneUrl(ZONE_BASE, t), 'cors']); if (t[0] >= 9) jobs.push([zoneUrl(ZONE_SEA, t), 'no-cors']); }
  const worker = async () => {
    while (i < jobs.length) {
      const [u, mode] = jobs[i++];
      try {
        if (await c.match(u, { ignoreVary: true })) { ok++; continue; }
        let r = null;
        try { r = await fetch(u, { mode: 'cors' }); } catch { r = mode === 'no-cors' ? await fetch(u, { mode: 'no-cors' }) : null; }
        if (r && (r.ok || r.type === 'opaque')) { await c.put(u, r); ok++; } else ko++;
      } catch { ko++; }
      if ((ok + ko) % 20 === 0) onProg(ok + ko, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  onProg(jobs.length, jobs.length);
  return { ok, ko, n: jobs.length };
}
async function zoneDelete(id) {
  const all = zoneList(), z = all.find((x) => x.id === id);
  if (!z) return;
  const rest = all.filter((x) => x.id !== id);
  const keep = new Set();
  for (const l of BASE_LAKES) for (const [u] of lakeTileUrls(l)) keep.add(u);
  for (const o of rest) for (const t of zoneTileXY(o.b, o.zmax)) { keep.add(zoneUrl(ZONE_BASE, t)); keep.add(zoneUrl(ZONE_SEA, t)); }
  const c = await caches.open(ZONE_CACHE);
  for (const t of zoneTileXY(z.b, z.zmax)) for (const u of [zoneUrl(ZONE_BASE, t), zoneUrl(ZONE_SEA, t)]) if (!keep.has(u)) await c.delete(u);
  zoneSave(rest);
}
const ZONE_ZOOMS = [[12, 'Large'], [13, 'Côtier'], [14, 'Détaillé'], [15, 'Très détaillé']];
VIEWS.zones = function renderZones() {
  const main = $('#view');
  const list = zoneList();
  let zmax = 14;
  main.innerHTML = `
    <button class="btn" data-go="${cruise ? 'map' : 'more'}">◀ ${cruise ? 'Carte' : 'Plus'}</button>
    <h1>Zones hors ligne</h1>
    <p class="help">Cadrez la carte sur la zone où vous allez naviguer, choisissez le niveau de détail, puis téléchargez (Wi-Fi conseillé). Le plan (données OpenStreetMap) et le balisage OpenSeaMap restent alors sur l’appareil, même sans réseau. Le balisage OpenSeaMap est incomplet par endroits et ne remplace pas une carte marine officielle.</p>
    <div id="zoneMap" class="map"></div>
    <h3>Détail</h3>
    <div class="row c4" id="zoneZ">${ZONE_ZOOMS.map(([z, l]) => `<button class="btn ${z === zmax ? 'on' : ''}" data-z="${z}">${l}<small>zoom ${z}</small></button>`).join('')}</div>
    <div class="cf"><label for="zoneName">Nom de la zone</label><input class="text" id="zoneName" type="text" placeholder="ex. Split – Hvar"></div>
    <p class="help" id="zoneEst"></p>
    <div class="row"><button class="btn big primary" id="zoneGo">⬇ Télécharger cette zone</button></div>
    <h2>Mes zones</h2>
    <div id="zoneList">${list.length ? list.map((z) => `<section class="field"><h3>${esc(z.name)}</h3><p class="help">${esc(fmtShortDate(new Date(z.at)))} · zoom ${z.zmax} · ${z.ok} tuiles${z.ko ? ` (${z.ko} manquantes)` : ''}</p>
      <div class="row c2"><button class="btn" data-show="${z.id}">🗺 Voir</button><button class="btn danger" data-del="${z.id}">🗑 Supprimer</button></div></section>`).join('') : '<p class="help">Aucune zone enregistrée.</p>'}</div>`;
  let m = null;
  const bounds = () => { const b = m.getBounds(); return { s: b.getSouth(), n: b.getNorth(), w: b.getWest(), e: b.getEast() }; };
  const est = () => {
    if (!m) return;
    const n = zoneTileXY(bounds(), zmax).length;
    const el = $('#zoneEst');
    if (el) el.textContent = n > ZONE_MAX ? `Zone trop grande pour ce détail (${n} tuiles par couche, maximum ${ZONE_MAX}) : rapprochez la carte ou baissez le détail.` : `Environ ${n * 2} tuiles (plan + balisage), ≈ ${Math.max(1, Math.round(n * 2 * 0.018))} Mo.`;
    $('#zoneGo').disabled = n > ZONE_MAX;
  };
  loadLeaflet().then(() => {
    const box = $('#zoneMap');
    if (!box || !box.isConnected) return;
    const L = window.L;
    m = L.map(box, { zoomControl: true, tap: true });
    zoneLayer().addTo(m);
    L.tileLayer(ZONE_SEA, { maxZoom: 19, maxNativeZoom: 18, attribution: '© OpenSeaMap' }).addTo(m);
    for (const z of zoneList()) L.rectangle([[z.b.s, z.b.w], [z.b.n, z.b.e]], { color: '#0050d0', weight: 2, fillOpacity: 0.08 }).bindTooltip(z.name).addTo(m);
    const p = lastFix ? [lastFix.lat, lastFix.lon] : (cruise && isLake()) ? LEMAN_CENTER : [43.1, 5.9];
    m.setView(p, 10);
    m.on('moveend zoomend', est);
    addFullscreenControl(m);
    est();
  }).catch(() => { const b = $('#zoneMap'); if (b) b.innerHTML = '<div class="empty-state">Carte indisponible.</div>'; });
  main.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go) { buzz(); return go(t.dataset.go); }
    if (t.dataset.z) { buzz(); zmax = Number(t.dataset.z); main.querySelectorAll('[data-z]').forEach((x) => x.classList.toggle('on', x === t)); est(); }
    if (t.dataset.show && m) { buzz(); const z = zoneList().find((x) => x.id === t.dataset.show); if (z) { m.fitBounds([[z.b.s, z.b.w], [z.b.n, z.b.e]]); scrollTo(0, 0); } }
    if (t.dataset.del) {
      buzz();
      const z = zoneList().find((x) => x.id === t.dataset.del);
      if (!z || !confirm(`Supprimer la zone « ${z.name} » de l’appareil ?`)) return;
      await zoneDelete(z.id); toast('Zone supprimée'); VIEWS.zones();
    }
    if (t.id === 'zoneGo' && m) {
      buzz();
      if (zoneBusy) return;
      if (!navigator.onLine) return toast('Il faut du réseau pour télécharger');
      const b = bounds(); const n = zoneTileXY(b, zmax).length;
      if (n > ZONE_MAX) return toast('Zone trop grande');
      const name = ($('#zoneName').value || '').trim() || `Zone du ${fmtShortDate(new Date())}`;
      const zone = { id: Date.now().toString(36), name, b, zmax, at: new Date().toISOString() };
      zoneBusy = true; t.disabled = true;
      const r = await zoneDownload(zone, (d, all) => { if (t.isConnected) t.textContent = `⬇ ${d} / ${all} tuiles…`; });
      zoneBusy = false;
      if (!r.ok) { t.disabled = false; t.textContent = '⬇ Télécharger cette zone'; return toast('Téléchargement impossible'); }
      zone.ok = r.ok; zone.ko = r.ko;
      zoneSave([...zoneList(), zone]);
      toast(`Zone « ${name} » gardée hors ligne (${r.ok} tuiles${r.ko ? `, ${r.ko} manquantes` : ''})`);
      VIEWS.zones();
    }
  };
};

/* ---------- Cartes (Corban, v209) : un seul appui charge OpenStreetMap (plan CARTO, données OSM) et OpenSeaMap
   dans un rayon autour de ma position (50 km par défaut, réglable dans la roue dentée). Le détail s'adapte au rayon. */
const mapRadius = () => Number(settings.mapRadius) || 50;
function radiusBounds(lat, lon, km) {
  const dLat = km / 111.32, dLon = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon };
}
function radiusZoom(b) { for (let z = 14; z >= 9; z--) if (zoneTileXY(b, z).length <= ZONE_MAX) return z; return 9; }
function cartesPos() {
  return new Promise((res) => {
    const fb = () => { const p = typeof lastKnownPos === 'function' ? lastKnownPos() : null; res(p && p.lat != null ? { lat: p.lat, lon: p.lon, old: true } : null); };
    if (!navigator.geolocation) return fb();
    navigator.geolocation.getCurrentPosition((g) => res({ lat: g.coords.latitude, lon: g.coords.longitude }), fb, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}
VIEWS.cartes = function renderCartes() {
  const main = $('#view');
  const km = mapRadius(), list = zoneList();
  main.innerHTML = `
    <h1>Mes cartes</h1>
    <p class="help">Un appui charge le plan OpenStreetMap et le balisage OpenSeaMap dans un rayon de <b>${km} km</b> autour de vous. Elles restent ensuite sur l’appareil, sans réseau. Rayon réglable dans la roue dentée. Wi-Fi conseillé. OpenSeaMap ne remplace pas une carte marine officielle.</p>
    <div class="row"><button class="btn big primary" id="cartesGo">⬇ Charger les cartes autour de moi<small>rayon ${km} km</small></button></div>
    <p class="help" id="cartesState"></p>
    <section class="field"><h2>Cartes enregistrées</h2>
    ${list.length ? list.map((z) => `<div class="cartes-z"><div><b>${esc(z.name)}</b><small>${esc(fmtShortDate(new Date(z.at)))} · détail ${z.zmax} · ${z.ok || 0} morceaux${z.ko ? ` (${z.ko} manquants)` : ''}</small></div><button class="btn danger" data-cdel="${z.id}">🗑</button></div>`).join('') : '<p class="help">Aucune carte chargée pour l’instant.</p>'}
    </section>
    <div class="row"><button class="btn" data-go="zones">✋ Choisir une zone à la main sur la carte</button></div>
    <section class="field"><h2>🌐 Cartes en ligne</h2><p class="help">Réseau nécessaire, s’ouvrent dans le navigateur.</p>
    <div class="row"><a class="btn big link-btn" href="${LEMAN_ARCGIS}" target="_blank" rel="noopener">🌐 Carte ArcGIS du Léman<small>carte en ligne, réseau nécessaire</small></a></div></section>`; // v437 (Corban) : rassemblée ici depuis data
  main.onclick = async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.go) { buzz(); return go(t.dataset.go); }
    if (t.dataset.cdel) return holdDel(t, async () => { await zoneDelete(t.dataset.cdel); toast('Carte supprimée de l’appareil'); VIEWS.cartes(); });
    if (t.id !== 'cartesGo') return;
    buzz();
    if (zoneBusy) return toast('Chargement déjà en cours');
    if (!navigator.onLine) return toast('Il faut du réseau pour charger les cartes');
    const st = $('#cartesState');
    t.disabled = true; st.textContent = '📍 Recherche de votre position…';
    const p = await cartesPos();
    if (!p) { t.disabled = false; st.textContent = ''; return toast('Position GPS introuvable : autorisez la localisation puis réessayez'); }
    const b = radiusBounds(p.lat, p.lon, km), zmax = radiusZoom(b);
    const name = `Autour de moi · ${km} km`;
    const zone = { id: Date.now().toString(36), name, b, zmax, at: new Date().toISOString(), center: [p.lat, p.lon], km };
    st.textContent = `${p.old ? 'Dernière position connue' : 'Position'} : ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)} · détail jusqu’au zoom ${zmax}`;
    zoneBusy = true;
    const r = await zoneDownload(zone, (d, all) => { if (t.isConnected) t.innerHTML = `⬇ ${d} / ${all} morceaux…<small>laissez l’appli ouverte</small>`; });
    zoneBusy = false;
    if (!r.ok) { if (t.isConnected) { t.disabled = false; t.innerHTML = `⬇ Charger les cartes autour de moi<small>rayon ${km} km</small>`; } return toast('Chargement impossible'); }
    zone.ok = r.ok; zone.ko = r.ko;
    zoneSave([...zoneList(), zone]);
    toast(`✓ Cartes chargées sur ${km} km autour de vous (${r.ok} morceaux${r.ko ? `, ${r.ko} manquants` : ''})`);
    if (currentView === 'cartes') VIEWS.cartes();
  };
};

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (!leafletP) {
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET + 'leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = LEAFLET + 'leaflet.js';
      js.onload = () => (window.L ? res() : rej(new Error('leaflet')));
      js.onerror = () => { leafletP = null; js.remove(); rej(new Error('leaflet')); };
      document.head.appendChild(js);
    });
  }
  return leafletP;
}

function mapData(day) {
  const inDay = (t) => !day || dayKey(new Date(t)) === day;
  let line = loadTrack().filter(([t]) => inDay(t)).map(([t, lat, lon]) => ({ t, lat, lon }));
  const ents = cruise.entries.filter((e) => inDay(e.t) && e.v.pos && !e.v.pos.text);
  // Sans trace enregistrée, on relie les positions des entrées.
  if (line.length < 2) line = ents.map((e) => ({ t: Date.parse(e.t), lat: e.v.pos.lat, lon: e.v.pos.lon }));
  let nm = 0;
  for (let i = 1; i < line.length; i++) if (line[i].t - line[i - 1].t < 45 * 60000) nm += distNM(line[i - 1], line[i]);
  return { line, ents, nm };
}
// Coupe la trace aux escales pour ne pas tracer de ligne droite entre deux journées.
function segments(line) {
  const segs = [];
  let cur = [];
  for (let i = 0; i < line.length; i++) {
    if (i && line[i].t - line[i - 1].t > 45 * 60000) { if (cur.length > 1) segs.push(cur); cur = []; }
    cur.push([line[i].lat, line[i].lon]);
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}
function entryPopup(e) {
  const v = e.v;
  const bits = [
    v.cog != null ? `COG ${pad(v.cog, 3)}°` : '', v.sog != null ? `${fr(v.sog)} nd` : '',
    v.twd != null ? `vent ${pad(v.twd, 3)}° ${v.tws != null ? windTxt(v.tws) : ''}` : '', v.allure || '', v.loch != null ? `loch ${fr(Number(v.loch))} NM` : '',
  ].filter(Boolean);
  return `<b>${fmtShortDate(new Date(e.t))} ${fmtTime(new Date(e.t))}</b> ${esc((v.evt || []).join(', '))}<br>${esc(bits.join(' · '))}${v.note ? `<br><i>${esc(v.note)}</i>` : ''}`;
}
const entryColor = (e) => ((e.v.evt || []).includes('Départ') ? '#00a040' : (e.v.evt || []).includes('Arrivée') ? '#d00000' : '#0a2a5c');

VIEWS.map = function renderMap(day) {
  if (day !== undefined && day !== null) mapDay = day;
  if (day === 'all') mapDay = null;
  const days = daysWithData();
  const { line, ents, nm } = mapData(mapDay);
  const main = $('#view');
  stopMapWatch();
  if (mapObj) { mapObj.remove(); mapObj = null; }
  main.innerHTML = `
    <div class="daynav">
      <button class="btn" data-md="-1" aria-label="Jour précédent">◀</button>
      <div><div class="dn-date">${mapDay ? esc(fmtDate(keyToDate(mapDay))) : 'Toute la croisière'}</div>
        <div class="dn-sub">${fr(nm)} NM${mapDay && navLabel(mapDay) ? ` · navigation ${esc(navLabel(mapDay))}` : ''} · ${ents.length} entrée${ents.length > 1 ? 's' : ''}</div></div>
      <button class="btn" data-md="1" aria-label="Jour suivant">▶</button>
    </div>
    ${mapDay ? '<div class="row" style="margin-bottom:10px"><button class="btn" data-md="all">Toute la croisière</button></div>' : ''}
    <div id="map" class="map"></div>
    <p class="help" id="mapNote"></p>
    <div class="row c2"><button class="btn" id="mapFit">⤢ Recentrer</button><button class="btn primary" id="mapMe">📍 Suivre ma position</button></div>
    ${isLake() ? `<div class="row"><a class="btn link-btn" href="${LEMAN_ARCGIS}" target="_blank" rel="noopener">🌐 Carte interactive du Léman (ArcGIS)<small>en ligne, s’ouvre dans le navigateur</small></a></div>` : ''}
    <div class="row"><button class="btn" data-go="zones">🗺 Zones hors ligne<small>plan OpenStreetMap + balisage OpenSeaMap, zone choisie à la main</small><small>${zoneList().length ? esc(zoneList().map((z) => z.name).join(', ')) : 'aucune zone enregistrée'}</small></button></div>
    ${isLake() ? `<div class="row"><button class="btn" id="mapVec">⬇ Données du Léman (OpenStreetMap)<small>balises, ports, débarcadères, rives : zones 150 / 300 m et baignade</small><small id="mapVecSub">${esc(lemanVecNote())}</small></button></div>` : ''}
    ${isLake() ? `<div class="row"><label class="btn" id="mapAsc">⛰ Courbes 1 à 5 m (swissBATHY3D)<small>calculées sur l’appareil, hors ligne</small><small id="mapAscSub">${esc(bathyAscNote())}</small><input type="file" id="mapAscFile" multiple hidden></label></div>
      ${store.get('ldb.bathyAscAt', null) ? '<div class="row"><button class="btn" id="mapAscShare">📤 Envoyer les courbes à l’autre appareil<small>fichier JSON à importer avec le bouton ci-dessus</small></button></div>' : ''}` : ''}
    ${isLake() ? `<p class="help">🗺 Cartes intégrées (sans réseau) : <span id="mapOffSub">${esc(lakesNote())}</span></p>` : ''}`;
  main.onclick = (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { buzz(); return go(g.dataset.go); }
    const b = e.target.closest('[data-md]');
    if (!b) return;
    buzz();
    if (b.dataset.md === 'all') return VIEWS.map('all');
    if (!days.length) return;
    const i = mapDay ? days.indexOf(mapDay) : (Number(b.dataset.md) > 0 ? -1 : days.length);
    const j = Math.min(days.length - 1, Math.max(0, i + Number(b.dataset.md)));
    VIEWS.map(days[j]);
  };
  const box = $('#map');
  if ($('#mapVec')) $('#mapVec').onclick = () => { buzz(); fetchLemanVec(); };
  if ($('#mapAscFile')) $('#mapAscFile').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    if (await bathyAscImport(files, $('#mapAscSub'))) VIEWS.map(mapDay);
  };
  if ($('#mapAscShare')) $('#mapAscShare').onclick = () => { buzz(); bathyAscShare(); };
  if (!line.length && !ents.length && !isLake()) {
    box.innerHTML = '<div class="empty-state">Pas encore de trace ni de position pour cette période.<br><br>Lancez le journal automatique ou importez une trace GPX.</div>';
    $('#mapFit').disabled = true;
  }
  if (!navigator.onLine) $('#mapNote').textContent = 'Hors ligne : seul le fond des zones déjà affichées avec du réseau est disponible.';
  loadLeaflet().then(() => drawLeaflet(box, line, ents)).catch(() => {
    drawSvg(box, line, ents);
    $('#mapNote').textContent = 'Carte de fond indisponible sans réseau : la trace est affichée seule.';
  });
};

function drawLeaflet(box, line, ents) {
  if (!box.isConnected) return;
  box.innerHTML = '';
  const L = window.L;
  mapObj = L.map(box, { zoomControl: true, attributionControl: true, tap: true });
  // Fonds : plan OpenStreetMap, ou carte nationale suisse (swisstopo, profondeurs du Léman) sur le lac.
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, attribution: '© OpenStreetMap' });
  const swiss = L.tileLayer(SWISS_TILES, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, bounds: SWISS_BOUNDS, attribution: '© swisstopo' });
  const seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: '© OpenSeaMap' });
  const useSwiss = isLake() || (line.length ? inSwissArea(line[line.length - 1]) : ents.length ? inSwissArea({ lat: ents[0].v.pos.lat, lon: ents[0].v.pos.lon }) : false);
  // Plan des zones hors ligne : choisi d'office quand la navigation est dans une zone téléchargée.
  const zbase = zoneLayer();
  const here = line.length ? [line[line.length - 1].lat, line[line.length - 1].lon] : ents.length ? [ents[0].v.pos.lat, ents[0].v.pos.lon] : lastFix ? [lastFix.lat, lastFix.lon] : null;
  (useSwiss ? swiss : zoneAt(here) ? zbase : osm).addTo(mapObj);
  seamark.addTo(mapObj);
  const ctrl = L.control.layers({ 'Carte nationale suisse (Léman)': swiss, 'Plan OpenStreetMap': osm, 'Plan des zones hors ligne': zbase }, { 'Balisage OpenSeaMap': seamark }, { position: 'topright' }).addTo(mapObj);
  if (useSwiss) addLemanVector(mapObj, ctrl, seamark);
  simChartWire(mapObj, ctrl, [swiss, osm, zbase]);
  addFullscreenControl(mapObj);
  // Si les tuiles swisstopo ne passent pas, on revient au plan OSM.
  let swOk = 0, swErr = 0;
  swiss.on('tileload', () => swOk++);
  swiss.on('tileerror', () => { if (++swErr === 6 && !swOk && navigator.onLine && mapObj && mapObj.hasLayer(swiss)) { mapObj.removeLayer(swiss); osm.addTo(mapObj); const n = $('#mapNote'); if (n) n.textContent = 'Carte suisse indisponible pour le moment : plan OpenStreetMap affiché.'; } });
  const pts = [];
  for (const seg of segments(line)) { L.polyline(seg, { color: '#d00000', weight: 5, opacity: 0.85 }).addTo(mapObj); pts.push(...seg); }
  for (const e of ents) {
    const ll = [e.v.pos.lat, e.v.pos.lon];
    pts.push(ll);
    L.circleMarker(ll, { radius: 11, color: '#000', weight: 3, fillColor: entryColor(e), fillOpacity: 1 }).addTo(mapObj).bindPopup(entryPopup(e));
  }
  const fit = () => { if (pts.length) mapObj.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 }); else if (useSwiss) mapObj.setView(LEMAN_CENTER, 10); else mapObj.setView([43.1, 5.9], 8); };
  fit();
  $('#mapFit').onclick = () => { buzz(); fit(); };
  // Position GPS suivie en continu (le bouton active / arrête le suivi).
  let me = null, acc = null, first = true;
  const meBtn = $('#mapMe');
  const show = (p) => {
    if (!mapObj) return stopMapWatch();
    const ll = [p.coords.latitude, p.coords.longitude];
    if (!me) {
      acc = L.circle(ll, { radius: p.coords.accuracy || 10, color: '#0077ff', weight: 1, fillOpacity: 0.12 }).addTo(mapObj);
      me = L.circleMarker(ll, { radius: 11, color: '#fff', weight: 4, fillColor: '#0077ff', fillOpacity: 1 }).addTo(mapObj);
    } else { me.setLatLng(ll); acc.setLatLng(ll).setRadius(p.coords.accuracy || 10); }
    if (first) { mapObj.setView(ll, Math.max(mapObj.getZoom(), 14)); first = false; } else if (!mapObj.getBounds().pad(-0.15).contains(ll)) mapObj.panTo(ll);
    const sog = p.coords.speed != null && p.coords.speed >= 0 ? `${fr(p.coords.speed * 1.943844)} nd` : '';
    const n = $('#mapNote'); if (n) n.textContent = `📍 ${fmtPos({ lat: ll[0], lon: ll[1] })}${sog ? ' · ' + sog : ''} · ± ${Math.round(p.coords.accuracy || 0)} m`;
  };
  meBtn.onclick = () => {
    buzz();
    if (mapWatch != null) { stopMapWatch(); meBtn.textContent = '📍 Suivre ma position'; return; }
    if (!navigator.geolocation) return toast('GPS indisponible');
    first = true;
    mapWatch = navigator.geolocation.watchPosition(show, () => toast('Position GPS introuvable'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    meBtn.textContent = '⏹ Arrêter le suivi';
  };
  setTimeout(() => mapObj && mapObj.invalidateSize(), 100);
}

// Secours hors ligne : la trace dessinée sans fond de carte.
function drawSvg(box, line, ents) {
  const all = line.concat(ents.map((e) => ({ lat: e.v.pos.lat, lon: e.v.pos.lon })));
  if (!all.length) return;
  const lat0 = all.reduce((s, p) => s + p.lat, 0) / all.length;
  const k = Math.cos(rad(lat0));
  const xs = all.map((p) => p.lon * k), ys = all.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 0.01;
  const P = (p) => `${(((p.lon * k - minX) / span) * 340 + 10).toFixed(1)},${(((-p.lat - minY) / span) * 340 + 10).toFixed(1)}`;
  const segs = segments(line).map((seg) => seg.map(([lat, lon]) => P({ lat, lon })).join(' '));
  box.innerHTML = `<svg viewBox="0 0 360 360" class="map-svg">
    ${segs.map((s) => `<polyline points="${s}" fill="none" stroke="#d00000" stroke-width="3" stroke-linejoin="round"/>`).join('')}
    ${ents.map((e) => { const [x, y] = P({ lat: e.v.pos.lat, lon: e.v.pos.lon }).split(','); return `<circle cx="${x}" cy="${y}" r="6" fill="${entryColor(e)}" stroke="#000" stroke-width="2"/>`; }).join('')}
  </svg>`;
  $('#mapFit').disabled = true;
  $('#mapMe').disabled = true;
}

/* =====================================================================
   TRACEUR (Léman) : carte plein écran, trace en direct, vitesse, cap, distance,
   et toutes les traces enregistrées des sorties. La trace est celle du journal
   automatique (ldb.track.<id>), elle reste donc dans le journal et s'exporte en GPX.
   ===================================================================== */
let trk = null; // { map, live, me, acc, follow, others }
function trackStats(track) {
  let nm = 0, max = 0, moving = 0;
  for (let i = 1; i < track.length; i++) {
    const a = { lat: track[i - 1][1], lon: track[i - 1][2] }, b = { lat: track[i][1], lon: track[i][2] };
    const dt = (track[i][0] - track[i - 1][0]) / 3600000;
    if (dt <= 0 || dt > 0.75) continue;
    const d = distNM(a, b); nm += d;
    const v = d / dt; if (dt >= 10 / 3600 && v < 40) { max = Math.max(max, v); if (v > 0.5) moving += dt; }
  }
  return { nm, max, moving, start: track.length ? track[0][0] : null, end: track.length ? track[track.length - 1][0] : null };
}
// Une navigation peut contenir plusieurs traces (« Nouvelle trace », v88) : débuts dans ldb.trkSegs.<id>.
function allLakeTracks() {
  const out = [];
  for (const x of index) {
    const t = store.get('ldb.track.' + x.id, []);
    const segs = [0, ...store.get('ldb.trkSegs.' + x.id, []).filter((i) => i > 0 && i < t.length)].sort((a, b) => a - b);
    segs.forEach((a, k) => {
      const part = t.slice(a, segs[k + 1] ?? t.length);
      if (part.length > 1) out.push({ id: segs.length > 1 ? `${x.id}#${k}` : x.id, name: segs.length > 1 ? `${x.name} · trace ${k + 1}` : x.name, track: part });
    });
  }
  return out.sort((a, b) => b.track[0][0] - a.track[0][0]);
}
VIEWS.tracker = function renderTracker() {
  const main = $('#view');
  stopMapWatch();
  if (mapObj) { mapObj.remove(); mapObj = null; }
  if (trk && trk.map) { trk.map.remove(); }
  trk = { follow: true, others: null };
  // Premier écran de l'appli (Corban, 2026-10-31, v73) : la navigation pilote tout, on démarre d'ici.
  // Carte en plein écran sous le bandeau, sans boutons en bas : tout passe par le bandeau (Corban, 2026-11-01, v102).
  main.innerHTML = `
    <div class="trk-full">
      <div id="trkMap" class="map trk-map"></div>
      <div class="trk-dash" id="trkDash"></div>
      <div class="trk-over" id="trkBtns"></div>
    </div>`;
  main.onclick = (e) => {
    const n = e.target.closest('[data-newnav]');
    if (n) { buzz(); newType = n.dataset.newnav; nameDirty = false; return go('cruises'); }
    const g = e.target.closest('[data-go]');
    if (g) { buzz(); return go(g.dataset.go); }
  };
  drawTrkButtons();
  drawTrkList();
  document.body.classList.add('trk-mode');
  updateTrkDash();
  loadLeaflet().then(() => {
    const box = $('#trkMap');
    if (!box || !box.isConnected) return;
    const L = window.L;
    const m = L.map(box, { zoomControl: true, tap: true });
    trk.map = m;
    const swiss = L.tileLayer(SWISS_TILES, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, bounds: SWISS_BOUNDS, attribution: '© swisstopo' });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, attribution: '© OpenStreetMap' });
    const seamark = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: '© OpenSeaMap' });
    const zbase = zoneLayer();
    const simSea = simSeaMode();
    let here = lastFix ? [lastFix.lat, lastFix.lon] : null;
    if (simSea && here && inSwissArea({ lat: here[0], lon: here[1] })) here = null; // v417 : mer simulée, la position réelle en Suisse n'impose plus le Léman
    const useSwiss = !simSea && ((cruise && isLake()) || (here ? inSwissArea({ lat: here[0], lon: here[1] }) : !cruise));
    (useSwiss ? swiss : zoneAt(here) ? zbase : osm).addTo(m); seamark.addTo(m);
    const ctrl = L.control.layers({ 'Carte nationale suisse': swiss, 'Plan OpenStreetMap': osm, 'Plan des zones hors ligne': zbase }, { 'Balisage OpenSeaMap': seamark }, { position: 'topright' }).addTo(m);
    if (useSwiss) addLemanVector(m, ctrl, seamark);
    simChartWire(m, ctrl, [swiss, osm, zbase]);
    addFullscreenControl(m);
    setFollow(!(simSea && !here));
    let ok = 0, err = 0;
    swiss.on('tileload', () => ok++);
    swiss.on('tileerror', () => { if (++err === 6 && !ok && navigator.onLine && m.hasLayer(swiss)) { m.removeLayer(swiss); osm.addTo(m); } });
    // Suivi du bateau : coupé quand on déplace la carte, relancé par la flèche bleue (bouton texte supprimé, Corban v89).
    m.on('dragstart', () => setFollow(false));
    trk.live = L.polyline([], { color: '#d00000', weight: 5, opacity: 0.9 }).addTo(m);
    const t = currentTrack();
    trkDrawPins();
    if (t.length > 1) { trk.live.setLatLngs(t.map(([, la, lo]) => [la, lo])); m.fitBounds(trk.live.getBounds(), { padding: [30, 30], maxZoom: 15 }); }
    else if (here) m.setView(here, 14);
    else if (useSwiss) m.setView(LEMAN_CENTER, 10);
    else m.setView(SIM_MED_CENTER, 9);
    // Position affichée même sans enregistrement.
    if (!tracking && navigator.geolocation) mapWatch = navigator.geolocation.watchPosition((p) => (window.nmeaPosFresh && window.nmeaPosFresh()) || trkFix({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, sog: p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 1.943844 : null, cog: p.coords.heading }), () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
    else if (lastFix) trkFix({ lat: lastFix.lat, lon: lastFix.lon });
    setTimeout(() => m.invalidateSize(), 100);
    if (trkShowPending) { const id = trkShowPending; trkShowPending = null; const x = allLakeTracks().find((y) => y.id === id); if (x) setTimeout(() => trkShowTrack(x), 200); }
  }).catch(() => { const b = $('#trkMap'); if (b) b.innerHTML = '<div class="empty-state">Carte indisponible.</div>'; });
};
// Points posés avec « Point » : épingle rouge sur la trace (Corban, v298). Sans GPS, un point simulé est posé
// sur la trace (dernier point, sinon dernière position, sinon centre de la carte) sans rien écrire au journal.
let trkSimPins = []; // points simulés de la session (jamais au journal)
const PIN_HTML = (sim) => `<svg viewBox="0 0 24 34" width="26" height="36"><path d="M12 1C6 1 1.5 5.6 1.5 11.4 1.5 19.5 12 33 12 33S22.5 19.5 22.5 11.4C22.5 5.6 18 1 12 1z" fill="${sim ? '#ff6b6b' : '#e02020'}" stroke="#fff" stroke-width="2"${sim ? ' stroke-dasharray="3 2"' : ''}/><circle cx="12" cy="11.5" r="4.2" fill="#fff"/></svg>`;
function trkPin(ll, sim, txt) {
  if (!trk || !trk.map || !window.L) return null;
  const L = window.L;
  const m = L.marker(ll, { icon: L.divIcon({ className: 'trk-pin', html: PIN_HTML(sim), iconSize: [26, 36], iconAnchor: [13, 35] }), zIndexOffset: 500 }).addTo(trk.map);
  if (txt) m.bindPopup(txt);
  return m;
}
function trkDrawPins() {
  if (!trk || !trk.map || !cruise || !trip || !trip.start) return;
  for (const e of cruise.entries) if (e.pt && e.v && e.v.pos && Date.parse(e.t) >= trip.start - 60000) trkPin([e.v.pos.lat, e.v.pos.lon], false, '📌 Point · ' + fmtTime(new Date(e.t)));
  for (const q of trkSimPins) trkPin(q.ll, true, '📌 Point simulé · ' + fmtTime(new Date(q.t)));
}
async function trkPointNow() {
  const lp = typeof trip !== 'undefined' && trip && trip.det.lastPt;
  if (lp) {
    const e = await addAutoEntry({ kind: null, t: Date.now(), lat: lp.lat, lon: lp.lon, cog: trip.det.lastCog, sog: trip.det.lastSog, dist: trip.det.dist }, trip.lochBase);
    if (e) { e.pt = true; saveCruise(); }
    if (currentView === 'tracker') trkPin([lp.lat, lp.lon], false, '📌 Point · ' + fmtTime(new Date()));
    return toast('📌 Point enregistré');
  }
  if (!trk || !trk.map || currentView !== 'tracker') return toast('En attente du premier point GPS');
  const t = currentTrack(), last = t.length ? t[t.length - 1] : null;
  const c = trk.map.getCenter();
  const ll = last ? [last[1], last[2]] : lastFix ? [lastFix.lat, lastFix.lon] : [c.lat, c.lng];
  trkSimPins.push({ ll, t: Date.now() });
  const m = trkPin(ll, true, '📌 Point simulé · ' + fmtTime(new Date()));
  if (m && !trk.map.getBounds().contains(m.getLatLng())) trk.map.panTo(ll);
  toast('📌 Point simulé sur la trace · pas encore de GPS, rien n’est écrit au journal');
}
// Popup « Naviguer » (Corban, 2026-10-31, v82) : les infos propres à la navigation, sans quitter la carte.
function closeNavPop() { const o = $('#navPop'); if (o) o.remove(); document.body.classList.remove('pop-open'); }
function openNavPop() {
  closeNavPop();
  if (!cruise) {
    toast('Démarrez d’abord une navigation');
    const sn = $('#trkStartNav'); if (sn) sn.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const ov = document.createElement('div');
  ov.id = 'navPop'; ov.className = 'nav-pop';
  const sea = !isLake();
  ov.innerHTML = `<div class="nav-pop-box">
      <div class="nav-pop-head"><h1>🧭 Naviguer</h1><button class="btn" data-close="1" aria-label="Fermer">✕</button></div>
      <p class="help">${esc(MODES[curMode()].icon + ' ' + (cruise.info.name || ''))} · chaque bouton note l’heure et la position au journal.</p>
      <div id="lakeBtns"></div>
      ${tracking ? '<div class="row"><button class="btn big" data-pt="1">📌 Point maintenant</button></div>' : ''}
      ${sea ? '<div class="row"><button class="btn big" data-gopop="vhf">📻 VHF : appels de routine</button></div>' : ''}
      <div class="row c2"><button class="btn" data-gopop="new">📝 Saisir une entrée<small>cap, vent, mer, observations</small></button><button class="btn" data-gopop="checklist">✅ Check-lists</button></div>
      ${tracking ? `<div class="row"><button class="btn big" data-gopop="dock">⚓ Accostage<small>hauteur d’eau, pare-battages, amarres, gaffe</small></button></div>
      <div class="row"><button class="btn big danger" data-moor="1">🔒 Amarrage<small>fin de la trace, puis check-out</small></button></div>` : ''}
      <div class="row"><button class="btn" data-close="1">Fermer</button></div>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('pop-open');
  renderLakeButtons();
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) { buzz(); return closeNavPop(); }
    if (e.target.closest('[data-full]')) { buzz(); closeNavPop(); return go('new'); }
    const g = e.target.closest('[data-gopop]'); if (g) { buzz(); closeNavPop(); return go(g.dataset.gopop); }
    if (e.target.closest('[data-pt]')) { buzz(); const lp = trip && trip.det.lastPt; if (!lp) return toast('En attente du premier point GPS'); addAutoEntry({ kind: null, t: Date.now(), lat: lp.lat, lon: lp.lon, cog: trip.det.lastCog, sog: trip.det.lastSog, dist: trip.det.dist }, trip.lochBase); return toast('Point enregistré'); }
    const m = e.target.closest('[data-moor]'); if (m) return armed(m, 'Toucher encore : amarré', () => { closeNavPop(); moorNow(); });
  });
}
// Le traceur ne montre que l'enregistrement en cours : après « Arrivée », l'écran revient à zéro
// et un nouvel enregistrement repart de rien (Corban, 2026-10-31, v88). Les anciennes traces restent dans « Mes traces ».
const currentTrack = () => {
  const t0 = trip && trip.start;
  if (!t0) return [];
  const all = tracking && trackBuf ? trackBuf : loadTrack();
  return trip.from != null ? all.slice(trip.from) : all.filter((p) => p[0] >= t0 - 60000);
};
function trkFix(p) {
  if (!trk || !trk.map || currentView !== 'tracker') return;
  const L = window.L, ll = [p.lat, p.lon];
  if (!trk.me) {
    trk.acc = L.circle(ll, { radius: p.acc || 10, color: '#0077ff', weight: 1, fillOpacity: 0.1 }).addTo(trk.map);
    trk.me = L.marker(ll, { icon: L.divIcon({ className: 'trk-boat', html: '<div class="trk-arrow">▲</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(trk.map);
  } else { trk.me.setLatLng(ll); trk.acc.setLatLng(ll); if (p.acc) trk.acc.setRadius(p.acc); }
  const a = trk.me.getElement && trk.me.getElement();
  if (a && p.cog != null && !Number.isNaN(p.cog)) a.firstChild.style.transform = `rotate(${Math.round(p.cog)}deg)`;
  if (trk.follow) { if (trk.map.getZoom() < 13) trk.map.setView(ll, 15); else trk.map.panTo(ll, { animate: true }); }
  trk.lastSog = p.sog; trk.lastCog = p.cog;
  updateTrkDash();
}
// Appelé à chaque point du journal automatique.
function trackerTick() {
  if (!trk || currentView !== 'tracker') return;
  const t = currentTrack();
  if (trk.live) trk.live.setLatLngs(t.map(([, la, lo]) => [la, lo]));
  if (lastFix) trkFix({ lat: lastFix.lat, lon: lastFix.lon, sog: trip && trip.det.lastSog, cog: trip && trip.det.lastCog });
  else updateTrkDash();
}
function setFollow(v) {
  if (!trk) return;
  trk.follow = v;
  const a = trk.map && trk.map.getContainer().querySelector('.map-locate-btn');
  if (a) a.classList.toggle('on', v);
}
function trkReset() {
  if (!trk) return;
  trk.lastSog = null; trk.lastCog = null; trkSimPins = [];
  if (trk.live) trk.live.setLatLngs([]);
}
function updateTrkDash() {
  const d = $('#trkDash');
  if (!d) return;
  const st = trackStats(currentTrack());
  const sog = tracking && trip ? trip.det.lastSog : trk && trk.lastSog;
  const cog = tracking && trip ? trip.det.lastCog : trk && trk.lastCog;
  const dur = tracking && trip ? Date.now() - trip.start : st.start ? st.end - st.start : 0;
  d.innerHTML = `
    <div><b>${sog != null ? fr(sog) : '–'}</b><small>nd${sog != null ? ` · ${Math.round(sog * 1.852)} km/h` : ''}</small></div>
    <div><b>${cog != null && !Number.isNaN(cog) ? pad(Math.round(cog) % 360, 3) + '°' : '–'}</b><small>cap fond</small></div>
    <div><b>${fr(tracking && trip ? trip.det.dist : st.nm)}</b><small>NM</small></div>
    <div><b>${dur ? fmtDur(dur) : '–'}</b><small>${tracking ? '⏺ en route' : 'durée'}</small></div>
    <div><b>${st.max ? fr(st.max) : '–'}</b><small>nd max</small></div>`;
}
// Choix au départ : prolonger la trace précédente ou en commencer une nouvelle (Corban, 2026-10-31, v88).
function trkChooseStart() {
  const box = $('#trkBtns');
  const last = store.get(lastTripKey(), null);
  if (!box || !last) return;
  const end = last.end ? fmtTime(new Date(last.end)) : '';
  box.innerHTML = `<div class="trk-choose" style="grid-column:1/-1">
    <p class="help" style="margin:0 0 8px">Une trace a déjà été enregistrée${end ? ` (arrivée à ${end}, ${fr(last.det ? last.det.dist : 0)} NM)` : ''}. Que voulez-vous faire ?</p>
    <div class="row c2">
      <button class="btn big" id="trkExtend">↪ Prolonger<small>la trace précédente</small></button>
      <button class="btn big primary" id="trkNew">⏺ Nouvelle trace<small>repartir de zéro</small></button>
    </div>
    <div class="row"><button class="btn" id="trkCancel">Annuler</button></div>
  </div>`;
  const go2 = (fn) => { buzz(); stopMapWatch(); fn(); drawTrkButtons(); trackerTick(); updateTrkDash(); };
  $('#trkExtend').onclick = () => go2(extendLastTrip);
  $('#trkNew').onclick = () => go2(() => { store.del(lastTripKey()); startTracking(false); });
  $('#trkCancel').onclick = () => { buzz(); drawTrkButtons(); };
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function drawTrkButtons() {
  const box = $('#trkBtns');
  if (!box) return;
  box.innerHTML = ''; // l'aide passe par les bulles en bas d'écran (v110)
  if (typeof gpsDenied !== 'undefined' && gpsDenied && !tracking) box.insertAdjacentHTML('afterbegin', '<p class="gps-denied" style="grid-column:1/-1">📍 La localisation est refusée : la trace ne peut pas s’enregistrer. Sur iPhone : Réglages › Confidentialité › Service de localisation › Safari (ou NavIn) › « Lorsque l’app est active ». Dans l’aperçu ouvert depuis Claude, le GPS est souvent bloqué : l’essai réel se fera dans l’appli installée.</p>' + (document.documentElement.classList.contains('in-frame') ? '<button class="btn big" id="simGps" style="grid-column:1/-1">▶ Simuler une trace<small>bateau fictif devant Morges, pour voir l’effet dans l’aperçu</small></button>' : ''));
  if ($('#simGps')) $('#simGps').onclick = () => { simGps = true; gpsDenied = false; toast('Simulation : trace fictive'); quickStart(); };

  if ($('#trkStart')) $('#trkStart').onclick = () => {
    buzz();
    const resume = !!store.get(tripKey(), null);
    if (!resume && store.get(lastTripKey(), null)) return trkChooseStart();
    stopMapWatch(); if (resume) trip = store.get(tripKey(), null); startTracking(resume); drawTrkButtons(); updateTrkDash();
  };
  if ($('#trkStop')) $('#trkStop').onclick = (e) => armed(e.currentTarget, 'Toucher encore : arrivée', async () => { buzz(); await stopTracking(true); trkReset(); drawTrkButtons(); updateTrkDash(); drawTrkList(); const sn = $('#trkStartNav'); if (sn) sn.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  if ($('#trkPoint')) $('#trkPoint').onclick = () => {
    buzz();
    const lp = trip && trip.det.lastPt;
    if (!lp) return toast('En attente du premier point GPS');
    addAutoEntry({ kind: null, t: Date.now(), lat: lp.lat, lon: lp.lon, cog: trip.det.lastCog, sog: trip.det.lastSog, dist: trip.det.dist }, trip.lochBase);
    toast('Point enregistré');
  };
  if (typeof navPageRefresh === 'function') navPageRefresh();
}
function drawTrkList() {
  const box = $('#trkList');
  if (!box) return;
  const all = allLakeTracks();
  box.innerHTML = all.length ? all.map((x) => {
    const s = trackStats(x.track);
    return `<div class="trk-item"><div><b>${esc(x.name)}</b><small>${fmtShortDate(new Date(s.start))} · ${fr(s.nm)} NM · ${fmtDur(s.end - s.start)}${s.max ? ` · max ${fr(s.max)} nd` : ''}</small></div>
      <button class="btn" data-show="${x.id}">🗺</button><button class="btn" data-gpx="${x.id}">GPX</button></div>`;
  }).join('') : '<p class="help">Aucune trace enregistrée pour l’instant.</p>';
  box.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    const x = all.find((y) => y.id === (b.dataset.show || b.dataset.gpx));
    if (!x) return;
    if (b.dataset.gpx) return deliver(trackToGpx(x.track, x.name), `${x.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-trace.gpx`, 'application/gpx+xml');
    if (currentView !== 'tracker' || !trk || !trk.map) { trkShowPending = x.id; return go('tracker'); }
    trkShowTrack(x);
  };
}
// Mes traces : rangées dans DatA (Corban, 2026-11-01, v94). 🗺 ouvre NavIn et dessine la trace en violet.
let trkShowPending = null;
VIEWS.traces = function renderTraces() {
  $('#view').innerHTML = `<h1>🛰 Mes traces</h1><p class="help">Toutes les traces enregistrées. 🗺 l’affiche en violet sur la carte de NavIn, GPX l’exporte. Glisser une trace vers la gauche : la supprimer (avec confirmation).</p><section class="field"><div id="trkList"></div></section>`;
  drawTrkList();
};
function trkShowTrack(x) {
    if (trk.others) trk.others.remove();
    trk.others = window.L.polyline(x.track.map(([, la, lo]) => [la, lo]), { color: '#7b2cbf', weight: 4, opacity: 0.85 }).addTo(trk.map);
    setFollow(false);
    trk.map.fitBounds(trk.others.getBounds(), { padding: [30, 30], maxZoom: 15 });
    window.scrollTo(0, 0);
    toast(`Trace « ${x.name} » en violet`);
}

/* ---------- Plein écran pour la carte et le traceur (Corban, 2026-10-31) ----------
   La carte occupe tout l'écran (le tableau de bord du traceur reste visible en haut) ;
   le même bouton revient au mode normal. Sur iPad, le navigateur passe aussi en vrai plein écran. */
function setMapFull(map, on) {
  const box = map.getContainer();
  document.body.classList.toggle('map-full', on);
  box.classList.toggle('map-full-box', on);
  const btn = box.querySelector('.map-full-btn');
  if (btn) { btn.textContent = on ? '✕' : '⛶'; btn.title = on ? 'Revenir au mode normal' : 'Plein écran'; }
  try {
    const de = document.documentElement;
    if (on && de.requestFullscreen && !document.fullscreenElement) de.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  } catch {}
  const fit = () => { try { if (map._container && map._container.isConnected && map._mapPane) map.invalidateSize(); } catch {} };
  setTimeout(fit, 60);
  setTimeout(fit, 400);
}
function addFullscreenControl(map) {
  const L = window.L;
  const Ctl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const a = L.DomUtil.create('a', 'leaflet-bar map-full-btn');
      a.href = '#'; a.role = 'button'; a.title = 'Plein écran'; a.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; // v438 : même dessin que les autres boutons
      L.DomEvent.on(a, 'click', (e) => { L.DomEvent.stop(e); buzz(); setMapFull(map, !document.body.classList.contains('map-full')); });
      L.DomEvent.disableClickPropagation(a);
      return a;
    },
  });
  map.addControl(new Ctl());
  addLocateControl(map);
}
// Flèche « ma position » (Corban, 2026-10-31, v77) : recentre la carte sur le bateau et reprend le suivi.
function addLocateControl(map) {
  const L = window.L;
  const Ctl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const a = L.DomUtil.create('a', 'leaflet-bar map-full-btn map-locate-btn');
      a.href = '#'; a.role = 'button'; a.title = 'Recentrer sur ma position';
      a.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 3 3 10.5l7.5 3 3 7.5z" fill="currentColor"/></svg>';
      L.DomEvent.on(a, 'click', (e) => {
        L.DomEvent.stop(e); buzz();
        const center = (p) => { map.setView([p.lat, p.lon], Math.max(map.getZoom(), 14)); };
        if (typeof trk !== 'undefined' && trk && trk.map === map) setFollow(true);
        const known = typeof herePos === 'function' ? herePos() : lastFix;
        if (known) center(known);
        if (navigator.geolocation) {
          a.classList.add('busy');
          navigator.geolocation.getCurrentPosition((g) => { a.classList.remove('busy'); center({ lat: g.coords.latitude, lon: g.coords.longitude }); }, () => { a.classList.remove('busy'); if (!known) toast('Position GPS introuvable'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        } else if (!known) toast('GPS indisponible');
      });
      L.DomEvent.disableClickPropagation(a);
      return a;
    },
  });
  map.addControl(new Ctl());
}
// En quittant la vue (ou si le navigateur sort du plein écran), on revient au mode normal.
function exitMapFull() {
  document.body.classList.remove('map-full');
  document.querySelectorAll('.map-full-box').forEach((b) => b.classList.remove('map-full-box'));
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch {}
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('map-full')) {
    const m = (typeof trk !== 'undefined' && trk && trk.map) || mapObj;
    if (m) setMapFull(m, false); else exitMapFull();
  }
});

/* v210 (Corban) : boutons de la carte cachés ; un balayage depuis le bord gauche vers le centre les montre 4 s.
   Ils disparaissent s'ils ne servent pas, ou dès qu'on touche ailleurs sur la carte. Chaque usage relance les 4 s. */
// v438 (Corban) : tous les boutons de carte redessinés (même taille, même style) et rangés en une colonne à gauche :
// ma position, zoom +, zoom −, fonds de carte, plein écran. Le sélecteur de fonds quitte le coin droit (il cachait la rose).
function ctlArrange(map) {
  const c = map.getContainer(); if (!c) return;
  const left = c.querySelector('.leaflet-top.leaflet-left'); if (!left) return;
  left.classList.add('ctl-col');
  const lay = c.querySelector('.leaflet-top.leaflet-right .leaflet-control-layers'); if (lay) left.appendChild(lay);
}
function ctlAutoAttach(map) {
  const c = map.getContainer(); if (!c || c._ctlAuto) return; c._ctlAuto = true;
  [0, 300, 1200].forEach((ms) => setTimeout(() => ctlArrange(map), ms));
  c.classList.add('ctl-auto');
  const edge = document.createElement('div'); edge.className = 'ctl-edge'; c.appendChild(edge);
  let t = null, sx = null, sy = 0;
  const hide = () => { clearTimeout(t); c.classList.remove('ctl-show'); const lc = c.querySelector('.leaflet-control-layers-expanded'); if (lc) lc.classList.remove('leaflet-control-layers-expanded'); };
  const arm = () => { clearTimeout(t); }; // v439 (Corban) : plus de masquage automatique, seulement sur action volontaire (bouton ‹)
  const show = () => { ctlArrange(map); addHide(); if (!c.classList.contains('ctl-show') && typeof buzz === 'function') buzz(); c.classList.add('ctl-show'); arm(); };
  const stop = (e) => { e.stopPropagation(); };
  ['mousedown', 'touchstart', 'dblclick', 'click', 'wheel'].forEach((ev) => edge.addEventListener(ev, stop));
  edge.addEventListener('pointerdown', (e) => { e.stopPropagation(); sx = e.clientX; sy = e.clientY; try { edge.setPointerCapture(e.pointerId); } catch (er) { /* rien */ } });
  edge.addEventListener('pointermove', (e) => { if (sx == null) return; e.stopPropagation(); if (e.clientX - sx > 40 && Math.abs(e.clientY - sy) < 90) { sx = null; show(); } });
  ['pointerup', 'pointercancel'].forEach((ev) => edge.addEventListener(ev, () => { sx = null; }));
  c.addEventListener('pointerdown', (e) => {
    if (!c.classList.contains('ctl-show')) return;
    if (e.target.closest('.leaflet-control-container .leaflet-control:not(.leaflet-control-attribution)')) arm();
  }, true);
  c.addEventListener('click', (e) => { if (c.classList.contains('ctl-show') && e.target.closest('.leaflet-control-container')) arm(); }, true);
  // v439 : bouton ‹ en bas de la colonne pour ranger les boutons volontairement
  const addHide = () => { const left = c.querySelector('.leaflet-top.leaflet-left'); if (!left || left.querySelector('.ctl-hide-btn')) return;
    const h = document.createElement('a'); h.href = '#'; h.role = 'button'; h.className = 'leaflet-control map-full-btn ctl-hide-btn'; h.title = 'Ranger les boutons'; h.setAttribute('aria-label', 'Ranger les boutons');
    h.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    ['mousedown', 'touchstart', 'dblclick', 'pointerdown', 'wheel'].forEach((ev) => h.addEventListener(ev, (e) => e.stopPropagation()));
    h.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hide(); }); left.appendChild(h); };
  [0, 300, 1200].forEach((ms) => setTimeout(addHide, ms));
}

/* ---------- v407 (Corban) : carte maritime simulée ----------
   Fond dessiné dans l'appli, sans aucune tuile externe : rives du Léman approchées, terre couleur chamois,
   eau en trois teintes (près des rives, intermédiaire, large) comme une carte marine, quadrillage lat / lon et
   rose des vents. Les teintes d'eau suivent la distance à la rive, PAS des profondeurs réelles (aucun chiffre
   de sonde affiché). Prise d'office quand les vraies cartes ne se chargent pas (aperçu, réseau coupé),
   toujours au choix dans le sélecteur de fonds. */
const SIM_LEMAN = [[46.205,6.16],[46.215,6.18],[46.255,6.215],[46.302,6.243],[46.33,6.28],[46.372,6.326],[46.36,6.345],[46.348,6.36],[46.335,6.38],[46.345,6.41],[46.355,6.43],[46.378,6.48],[46.398,6.53],[46.401,6.59],[46.405,6.655],[46.408,6.72],[46.393,6.805],[46.39,6.86],[46.386,6.878],[46.398,6.925],[46.43,6.912],[46.46,6.845],[46.488,6.73],[46.503,6.685],[46.506,6.627],[46.508,6.56],[46.507,6.497],[46.478,6.455],[46.46,6.34],[46.42,6.28],[46.383,6.24],[46.345,6.215],[46.315,6.19],[46.28,6.17],[46.255,6.155],[46.212,6.152]];
// Rive lissée (Chaikin, 3 passes) pour éviter les angles.
const SIM_LEMAN_S = (() => { let p = SIM_LEMAN; for (let k = 0; k < 3; k++) { const q = []; p.forEach((a, i) => { const b = p[(i + 1) % p.length]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }); p = q; } return p; })();
// v417 (Corban) : en mer simulée, côte de Méditerranée (Provence, de Marseille à Saint-Raphaël, îles d'Hyères).
// Tracé approché à la main, pour l'aperçu seulement : PAS une carte pour naviguer.
const SIM_MED = [
  [[45.5,4.0],[43.45,4.0],[43.45,4.6],[43.4,4.85],[43.33,5.05],[43.335,5.2],[43.36,5.3],[43.33,5.345],[43.296,5.362],[43.265,5.372],[43.235,5.355],[43.212,5.34],[43.205,5.4],[43.212,5.45],[43.205,5.5],[43.212,5.54],[43.19,5.58],[43.172,5.605],[43.16,5.622],[43.178,5.66],[43.18,5.7],[43.135,5.75],[43.118,5.8],[43.075,5.795],[43.045,5.86],[43.07,5.9],[43.1,5.885],[43.118,5.93],[43.104,5.945],[43.09,5.975],[43.088,6.02],[43.078,6.075],[43.07,6.12],[43.04,6.105],[43.028,6.115],[43.03,6.16],[43.045,6.155],[43.07,6.15],[43.1,6.19],[43.115,6.25],[43.12,6.31],[43.135,6.37],[43.145,6.44],[43.17,6.53],[43.19,6.6],[43.2,6.68],[43.24,6.69],[43.27,6.66],[43.29,6.6],[43.31,6.635],[43.34,6.7],[43.4,6.76],[43.41,6.85],[43.47,6.94],[43.55,7.02],[43.7,7.25],[43.75,7.5],[43.78,7.6],[45.5,7.6]],
  [[43.005,6.16],[43.01,6.2],[43.0,6.245],[42.985,6.24],[42.99,6.19],[42.992,6.16]],
  [[43.012,6.37],[43.016,6.4],[43.003,6.415],[42.995,6.385]],
  [[43.03,6.43],[43.05,6.49],[43.046,6.512],[43.022,6.452]],
];
const SIM_MED_S = SIM_MED.map((ring, k) => { let p = ring; for (let n = 0; n < 2; n++) { const q = []; p.forEach((a, i) => { const b = p[(i + 1) % p.length]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }); p = q; } return p; });
const SIM_MED_CENTER = [43.0, 5.95];
const simSeaMode = () => typeof zoneSimV !== 'undefined' && zoneSimV === 'mer';
// v418 (Corban) : changement de zone sur le traceur ouvert : la carte se recentre (mer simulée = Méditerranée, eaux intérieures = Léman).
function trkZoneRecenter(v) {
  const m = typeof trk !== 'undefined' && trk.map; if (!m || !m._container || !m._container.isConnected) return;
  const fixCH = lastFix && inSwissArea({ lat: lastFix.lat, lon: lastFix.lon });
  if (v === 'mer') { setFollow(!!(lastFix && !fixCH)); if (fixCH || !lastFix) m.setView(SIM_MED_CENTER, 9); else m.setView([lastFix.lat, lastFix.lon], 14); }
  else if (v === 'lac') { if (fixCH) { setFollow(true); m.setView([lastFix.lat, lastFix.lon], 14); } else { setFollow(false); m.setView(LEMAN_CENTER, 10); } }
  else if (lastFix) { setFollow(true); m.setView([lastFix.lat, lastFix.lon], 14); }
  else if (cruise && !isLake()) m.setView(SIM_MED_CENTER, 9);
  else m.setView(LEMAN_CENTER, 10);
}
function simChartLayer(L) {
  const Sim = L.GridLayer.extend({
    createTile(c) {
      const t = document.createElement('canvas'), S = 256; t.width = S; t.height = S;
      const g = t.getContext('2d'), z = c.z, ox = c.x * S, oy = c.y * S;
      // v409 (Corban) : palette de nuit propre, contrastée (eau sombre, rive claire), au lieu du filtre qui noircissait tout.
      const N = document.documentElement.dataset.theme === 'night';
      const P = N ? { sea: '#0d2236', land: '#3a3020', b1: '#2e5f86', b2: '#1a3d5c', shore: '#f0d080', grid: 'rgba(230,220,150,.45)', txt: 'rgba(240,230,170,.95)', lake: 'rgba(150,200,255,.9)' }
        : { sea: '#fdfdf8', land: '#f3e3ac', b1: '#93cdec', b2: '#c9e6f6', shore: '#5a4a2a', grid: 'rgba(70,90,120,.35)', txt: 'rgba(50,70,100,.8)', lake: 'rgba(40,90,150,.7)' };
      const px = (la, lo) => { const p = this._map.project([la, lo], z); return [p.x - ox, p.y - oy]; };
      const poly = SIM_LEMAN_S.map(([a, b]) => px(a, b));
      // Hors du Léman : le large (blanc) ; le polygone du lac posé sur la terre.
      const minX = Math.min(...poly.map((p) => p[0])), maxX = Math.max(...poly.map((p) => p[0])), minY = Math.min(...poly.map((p) => p[1])), maxY = Math.max(...poly.map((p) => p[1]));
      const pad = (maxX - minX) * 0.6;
      const nearLeman = maxX > -pad && minX < S + pad && maxY > -pad && minY < S + pad;
      if (!nearLeman) { g.fillStyle = P.sea; g.fillRect(0, 0, S, S); }
      else {
        g.fillStyle = P.land; g.fillRect(0, 0, S, S);
        g.save(); g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip();
        g.fillStyle = P.sea; g.fillRect(0, 0, S, S);
        // Teintes d'eau selon la distance à la rive : la rive tracée en traits épais, coupés à l'intérieur du lac.
        const mpp = 40075016 * Math.cos(46.4 * Math.PI / 180) / (256 * Math.pow(2, z));
        const path = () => { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
        g.lineJoin = 'round';
        [[1200, P.b2], [300, P.b1]].forEach(([m, col]) => { path(); g.strokeStyle = col; g.lineWidth = 2 * m / mpp; g.stroke(); });
        g.restore();
        g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
        g.strokeStyle = P.shore; g.lineWidth = z >= 13 ? (N ? 2.2 : 1.6) : (N ? 1.5 : 1); g.stroke();
        if (z >= 9 && z <= 12) { const c = px(46.44, 6.56); if (c[0] > -80 && c[0] < S + 80 && c[1] > -20 && c[1] < S + 20) { g.font = `italic ${z * 2}px serif`; g.fillStyle = P.lake; g.textAlign = 'center'; g.fillText('L É M A N', c[0], c[1]); g.textAlign = 'left'; } }
      }
      // Côte de Méditerranée : bandes d'eau le long de la rive, puis la terre par-dessus.
      const medRings = SIM_MED_S.map((r) => r.map(([a, b]) => px(a, b)));
      const all = medRings[0];
      const mx0 = Math.min(...all.map((p) => p[0])), mx1 = Math.max(...all.map((p) => p[0])), my0 = Math.min(...all.map((p) => p[1])), my1 = Math.max(...all.map((p) => p[1]));
      if (mx1 > -S && mx0 < 2 * S && my1 > -S && my0 < 2 * S + (my1 - my0) * 0.4) {
        const mpp2 = 40075016 * Math.cos(43.1 * Math.PI / 180) / (256 * Math.pow(2, z));
        const ring = (r) => { g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
        g.lineJoin = 'round';
        [[2500, P.b2], [600, P.b1]].forEach(([m, col]) => medRings.forEach((r) => { ring(r); g.strokeStyle = col; g.lineWidth = 2 * m / mpp2; g.stroke(); }));
        medRings.forEach((r) => { ring(r); g.fillStyle = P.land; g.fill(); g.strokeStyle = P.shore; g.lineWidth = z >= 13 ? (N ? 2.2 : 1.6) : (N ? 1.5 : 1); g.stroke(); });
        if (z >= 8 && z <= 11) { const c = px(42.88, 5.95); if (c[0] > -200 && c[0] < S + 200 && c[1] > -20 && c[1] < S + 20) { g.font = `italic ${z * 2.2}px serif`; g.fillStyle = P.lake; g.textAlign = 'center'; g.fillText('M É D I T E R R A N É E', c[0], c[1]); g.textAlign = 'left'; } }
      }
      // Quadrillage lat / lon (pas adapté au zoom) avec graduations.
      const step = z >= 15 ? 1 / 120 : z >= 13 ? 1 / 30 : z >= 11 ? 1 / 12 : z >= 9 ? 1 / 4 : 1;
      const nw = this._map.unproject([ox, oy], z), se = this._map.unproject([ox + S, oy + S], z);
      g.strokeStyle = P.grid; g.lineWidth = 1; g.fillStyle = P.txt; g.font = '10px sans-serif';
      const lab = (v) => { const d = Math.floor(Math.abs(v)), mn = (Math.abs(v) - d) * 60; return `${d}°${mn.toFixed(step < 1 / 60 ? 1 : 0).padStart(2, '0')}′`; };
      for (let la = Math.ceil(se.lat / step) * step; la <= nw.lat; la += step) { const y = px(la, nw.lng)[1]; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); g.fillText(lab(la) + ' N', 3, y - 3); }
      for (let lo = Math.ceil(nw.lng / step) * step; lo <= se.lng; lo += step) { const x = px(nw.lat, lo)[0]; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); g.fillText(lab(lo) + ' E', x + 3, 12); }
      return t;
    },
  });
  const lay = new Sim({ maxZoom: 19, className: 'sim-tiles', attribution: 'Carte simulée (aperçu, pas pour naviguer)' });
  // Passage jour / nuit : la carte simulée se redessine avec la bonne palette.
  const mo = new MutationObserver(() => { if (lay._map) lay.redraw(); else mo.disconnect(); });
  lay.on('add', () => mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }));
  lay.on('remove', () => mo.disconnect());
  lay.on('add', () => { const m = lay._map; if (!m || m._simRose) return; const r = document.createElement('div'); r.className = 'sim-rose no-print'; r.innerHTML = `<svg viewBox="-50 -50 100 100" width="84" height="84"><circle r="44" fill="rgba(255,255,255,.55)" stroke="#7a5c8a" stroke-width="1.2"/><circle r="36" fill="none" stroke="#7a5c8a" stroke-width=".6"/>${Array.from({ length: 36 }, (_, i) => { const a = i * 10 * Math.PI / 180, r1 = i % 9 ? 40 : 36; return `<line x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * 44}" y2="${-Math.cos(a) * 44}" stroke="#7a5c8a" stroke-width=".7"/>`; }).join('')}<path d="M0-34 6-6 34 0 6 6 0 34-6 6-34 0-6-6Z" fill="#7a5c8a" opacity=".85"/><path d="M0-34 6-6 0 0Z M34 0 6 6 0 0Z M0 34-6 6 0 0Z M-34 0-6-6 0 0Z" fill="#fff"/><text y="-46" text-anchor="middle" font-size="10" font-weight="700" fill="#7a5c8a" dy="-1">N</text></svg>`; m.getContainer().appendChild(r); m._simRose = r; const n = document.createElement('div'); n.className = 'sim-note no-print'; n.textContent = 'Carte maritime simulée (aperçu)'; m.getContainer().appendChild(n); m._simNote = n; });
  return lay;
}
// Ajoute la carte simulée au sélecteur et la prend d'office si le fond réel ne donne aucune tuile.
function simChartWire(map, ctrl, bases) {
  const L = window.L, sim = simChartLayer(L);
  ctrl.addBaseLayer(sim, 'Carte maritime simulée');
  const hide = () => { if (map._simRose) { map._simRose.remove(); map._simRose = null; } if (map._simNote) { map._simNote.remove(); map._simNote = null; } };
  map.on('baselayerchange', (e) => { if (e.layer !== sim) hide(); });
  let ok = 0, err = 0, done = false;
  const swap = () => { if (done || ok) return; done = true; bases.forEach((b) => { if (map.hasLayer(b)) map.removeLayer(b); }); sim.addTo(map); };
  bases.forEach((b) => { b.on('tileload', () => ok++); b.on('tileerror', () => { if (++err >= 4) swap(); }); });
  // Rien chargé après 4 s (tuiles bloquées sans erreur) : on bascule aussi.
  setTimeout(() => { if (map._container && map._container.isConnected) swap(); }, 4000);
  return sim;
}

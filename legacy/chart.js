/* =====================================================================
   CARTE VECTORIELLE DU LÉMAN
   Balises, feux, ports, jetées et zones extraits d'OpenStreetMap (norme Seamark)
   via l'API Overpass, une fois avec du réseau, puis gardés sur le téléphone
   et dessinés en vectoriel par-dessus le fond de carte.
   ===================================================================== */
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const LEMAN_OSM_QUERY = `[out:json][timeout:90];
(
  nwr["seamark:type"](${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e});
  nwr["leisure"="marina"](${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e});
  way["man_made"~"^(pier|breakwater|groyne)$"](${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e});
  nwr["amenity"="ferry_terminal"](${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e});
);
out tags geom;`;

const SEAMARK_FR = {
  light_major: 'Feu principal', light_minor: 'Feu', light: 'Feu', light_float: 'Feu flottant',
  buoy_lateral: 'Bouée latérale', buoy_cardinal: 'Bouée cardinale', buoy_isolated_danger: 'Bouée de danger isolé',
  buoy_safe_water: 'Bouée d’eaux saines', buoy_special_purpose: 'Bouée spéciale', buoy_installation: 'Bouée',
  beacon_lateral: 'Balise latérale', beacon_cardinal: 'Balise cardinale', beacon_isolated_danger: 'Balise de danger isolé',
  beacon_special_purpose: 'Balise spéciale', beacon_safe_water: 'Balise d’eaux saines',
  mooring: 'Corps-mort / duc-d’Albe', harbour: 'Port', small_craft_facility: 'Équipement de plaisance',
  restricted_area: 'Zone réglementée', fairway: 'Chenal', anchorage: 'Mouillage', rock: 'Roche', wreck: 'Épave',
  obstruction: 'Obstruction', landmark: 'Amer', signal_station_warning: 'Feu d’avis de tempête', bridge: 'Pont',
  cable_submarine: 'Câble sous-marin', pipeline_submarine: 'Conduite sous-marine', notice: 'Panneau', distance_mark: 'Borne',
};
const OSM_COLOURS = { red: '#d40000', green: '#008a2e', yellow: '#ffd400', white: '#ffffff', black: '#111111', orange: '#ff8c00', blue: '#0050d0' };

let lemanVec = null; // { at, feats } chargé depuis IndexedDB

function osmKind(t) {
  if (t['seamark:type']) return t['seamark:type'];
  if (t.leisure === 'marina') return 'harbour';
  if (t.amenity === 'ferry_terminal') return 'ferry';
  if (t.man_made) return 'pier';
  return 'other';
}
function osmToFeats(json) {
  const keep = (t) => {
    const o = {};
    for (const [k, v] of Object.entries(t || {})) if (k === 'name' || k === 'ref' || k === 'man_made' || k === 'leisure' || k === 'amenity' || k === 'operator' || k.startsWith('seamark:')) o[k] = v;
    return o;
  };
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  const feats = [];
  for (const el of json.elements || []) {
    const tags = keep(el.tags);
    const k = osmKind(el.tags || {});
    if (el.type === 'node') feats.push({ k, g: 'p', c: [r5(el.lat), r5(el.lon)], t: tags });
    else if (el.type === 'way' && el.geometry) {
      const line = el.geometry.map((p) => [r5(p.lat), r5(p.lon)]);
      const closed = line.length > 3 && line[0][0] === line[line.length - 1][0] && line[0][1] === line[line.length - 1][1];
      // Ports et marinas : un point au centre suffit pour l'icône, le contour reste dessiné.
      if (k === 'ferry') { const n = line.length; feats.push({ k, g: 'p', c: [r5(line.reduce((a, p) => a + p[0], 0) / n), r5(line.reduce((a, p) => a + p[1], 0) / n)], t: tags }); continue; }
      feats.push({ k, g: closed && k !== 'pier' ? 'a' : 'l', c: line, t: tags });
    } else if (el.type === 'relation' && el.members) {
      const rings = el.members.filter((m) => m.geometry && m.role !== 'inner').map((m) => m.geometry.map((p) => [r5(p.lat), r5(p.lon)]));
      if (rings.length) feats.push({ k, g: 'm', c: rings, t: tags });
    }
  }
  return feats;
}

async function lemanVecLoad() {
  if (lemanVec) return lemanVec;
  try {
    const st = await docStore('readonly');
    lemanVec = await new Promise((res) => { const r = st.get('leman-osm'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch { lemanVec = null; }
  return lemanVec;
}
async function lemanVecSave(v) {
  lemanVec = v;
  const st = await docStore('readwrite');
  await new Promise((res, rej) => { const r = st.put(v, 'leman-osm'); r.onsuccess = res; r.onerror = () => rej(r.error); });
  store.set('ldb.lemanVecAt', { at: v.at, n: v.feats.length });
}
function lemanVecNote() {
  const d = store.get('ldb.lemanVecAt', null);
  return d ? `téléchargés le ${fmtShortDate(new Date(d.at))} (${d.n} éléments)` : 'à télécharger une fois avec du réseau (Wi-Fi conseillé)';
}

let vecFetching = false;
async function fetchLemanVec() {
  if (vecFetching) return;
  if (!navigator.onLine) return toast('Il faut du réseau pour télécharger les balises');
  vecFetching = true;
  const sub = $('#mapVecSub');
  if (sub) sub.textContent = 'téléchargement depuis OpenStreetMap…';
  let json = null;
  for (const u of OVERPASS_URLS) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(LEMAN_OSM_QUERY), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.ok) { json = await r.json(); break; }
    } catch {}
  }
  vecFetching = false;
  if (!json) { if (sub && sub.isConnected) sub.textContent = 'échec : réessayer plus tard avec du réseau'; return toast('OpenStreetMap ne répond pas, réessayez plus tard'); }
  const feats = osmToFeats(json);
  // Contour du lac (rives et îles), pour dessiner les zones de 150 m et 300 m.
  let shore = null;
  if (sub && sub.isConnected) sub.textContent = 'contour du lac…';
  for (const u of OVERPASS_URLS) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(LEMAN_SHORE_QUERY), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.ok) { shore = shoreRings(await r.json()); if (shore.length) break; }
    } catch {}
  }
  if (!shore || !shore.length) shore = (lemanVec && lemanVec.shore) || null;
  try { await lemanVecSave({ at: new Date().toISOString(), feats, shore }); } catch { return toast('⚠ Impossible d’enregistrer les balises sur ce téléphone'); }
  if (sub && sub.isConnected) sub.textContent = lemanVecNote();
  toast(`${feats.length} éléments${shore && shore.length ? ' et le contour du lac' : ''} gardés hors ligne`);
  if (VIEWS.map && $('#map')) VIEWS.map(mapDay || null);
}

function seamarkColour(t) {
  const type = t['seamark:type'] || '';
  const c = t[`seamark:${type}:colour`] || t['seamark:light:colour'] || Object.entries(t).find(([k]) => k.endsWith(':colour'))?.[1] || '';
  const cols = c.split(';').map((x) => OSM_COLOURS[x.trim()]).filter(Boolean);
  return cols.length ? cols : null;
}
function seamarkPopup(f) {
  const t = f.t;
  const type = t['seamark:type'] || (f.k === 'harbour' ? 'harbour' : f.k);
  const name = t['seamark:name'] || t.name || '';
  const lines = [`<b>${esc(name || SEAMARK_FR[type] || (f.k === 'pier' ? 'Jetée' : type.replace(/_/g, ' ')))}</b>`];
  if (name) lines.push(esc(SEAMARK_FR[type] || type.replace(/_/g, ' ')));
  const ch = t['seamark:light:character'];
  if (ch) lines.push(`Feu ${esc(ch)}${t['seamark:light:group'] ? `(${esc(t['seamark:light:group'])})` : ''} ${esc(t['seamark:light:colour'] || '')}${t['seamark:light:period'] ? ` ${esc(t['seamark:light:period'])} s` : ''}`);
  const cat = t[`seamark:${type}:category`]; if (cat) lines.push(esc(cat.replace(/_/g, ' ')));
  if (t['seamark:restricted_area:restriction']) lines.push(esc(t['seamark:restricted_area:restriction'].replace(/_/g, ' ')));
  if (t['seamark:information'] || t['seamark:notice:information']) lines.push(esc(t['seamark:information'] || t['seamark:notice:information']));
  if (t.ref) lines.push(`Réf. ${esc(t.ref)}`);
  return lines.join('<br>');
}

// Calque vectoriel, dessiné sur canvas (rapide sur téléphone).
function lemanVecLayer(L) {
  if (!lemanVec || !lemanVec.feats.length) return null;
  const rd = L.canvas({ padding: 0.3 });
  const g = L.layerGroup();
  const pts = [];
  for (const f of lemanVec.feats) {
    const t = f.t, type = t['seamark:type'] || '';
    const cols = seamarkColour(t);
    if (f.k === 'pier' && f.g !== 'p') { L.polyline(f.c, { renderer: rd, color: '#5b4636', weight: 4, opacity: 0.9 }).bindPopup(seamarkPopup(f)).addTo(g); continue; }
    if (f.g === 'a' || f.g === 'm') {
      const zone = /restricted|fairway|anchorage/.test(type);
      L.polygon(f.c, { renderer: rd, color: zone ? '#c0006a' : '#0050d0', weight: 2, dashArray: zone ? '6 6' : null, fillOpacity: zone ? 0.06 : 0.1 }).bindPopup(seamarkPopup(f)).addTo(g);
      if (f.k === 'harbour') { const c = L.polygon(f.c).getBounds().getCenter(); pts.push({ f, ll: [c.lat, c.lng] }); }
      continue;
    }
    if (f.g === 'l') { L.polyline(f.c, { renderer: rd, color: /cable|pipeline/.test(type) ? '#8a2be2' : '#c0006a', weight: 2, dashArray: '6 6' }).bindPopup(seamarkPopup(f)).addTo(g); continue; }
    pts.push({ f, ll: f.c, cols });
  }
  for (const { f, ll, cols } of pts) {
    const type = f.t['seamark:type'] || '';
    if (f.k === 'ferry') {
      L.marker(ll, { icon: L.divIcon({ className: 'vec-port vec-ferry', html: '⛴', iconSize: [26, 26] }) }).bindPopup(`<b>${esc(f.t.name || 'Débarcadère')}</b><br>Débarcadère${f.t.operator ? ' · ' + esc(f.t.operator) : ''}`).addTo(g);
      continue;
    }
    if (f.k === 'harbour' || type === 'harbour' || type === 'small_craft_facility') {
      L.marker(ll, { icon: L.divIcon({ className: 'vec-port', html: '⚓', iconSize: [26, 26] }) }).bindPopup(seamarkPopup(f)).addTo(g);
      continue;
    }
    const light = /^light/.test(type) || f.t['seamark:light:character'];
    const fill = cols ? cols[0] : light ? '#ffd400' : '#9aa5b1';
    const radius = light && /major/.test(type) ? 9 : light ? 7 : /mooring/.test(type) ? 4 : 6;
    L.circleMarker(ll, { renderer: rd, radius, color: cols && cols[1] ? cols[1] : '#000', weight: cols && cols[1] ? 4 : 2, fillColor: fill, fillOpacity: 1 }).bindPopup(seamarkPopup(f)).addTo(g);
    if (light && cols && fill !== '#ffd400') L.circleMarker(ll, { renderer: rd, radius: radius + 5, color: '#ffd400', weight: 2, fill: false, interactive: false }).addTo(g);
  }
  return g;
}

/* ---------- Baignade interdite à moins de 100 m d'une entrée de port ou d'un débarcadère (ONI art. 77) ----------
   Entrées de port : les feux et balises d'OpenStreetMap à moins de 200 m d'un port ; débarcadères : amenity=ferry_terminal. */
function bathPoints(feats) {
  const ports = feats.filter((f) => f.k === 'harbour' || f.t['seamark:type'] === 'harbour');
  const portPts = ports.map((f) => (f.g === 'p' ? f.c : f.g === 'm' ? f.c[0][0] : f.c[0])).filter(Boolean);
  const near = (p, q, m) => { const ky = 111320, kx = 111320 * Math.cos(rad(p[0])); return Math.hypot((p[0] - q[0]) * ky, (p[1] - q[1]) * kx) < m; };
  const nearPort = (p) => ports.some((f) => (f.g === 'a' || f.g === 'm' ? (f.g === 'a' ? [f.c] : f.c).some((ring) => ring.some((q) => near(p, q, 200))) : near(p, f.c, 200)));
  const out = [];
  for (const f of feats) {
    if (f.g !== 'p') continue;
    const type = f.t['seamark:type'] || '';
    if (f.k === 'ferry') out.push({ ll: f.c, what: 'débarcadère', name: f.t.name || '' });
    else if ((/^light|^beacon/.test(type) || f.t['seamark:light:character']) && nearPort(f.c)) out.push({ ll: f.c, what: 'entrée de port', name: f.t['seamark:name'] || f.t.name || '' });
  }
  // Pas deux cercles presque au même endroit.
  return out.filter((x, i) => !out.slice(0, i).some((y) => near(x.ll, y.ll, 30)));
}
const BATH_RULE = 'Baignade interdite à moins de 100 m de l’entrée d’un port ou d’un débarcadère de la CGN (ONI art. 77). Les bateaux y manœuvrent et ne voient pas les nageurs.';
function bathLayer(L) {
  if (!lemanVec || !lemanVec.feats) return null;
  const list = bathPoints(lemanVec.feats);
  if (!list.length) return null;
  const g = L.layerGroup();
  for (const x of list) L.circle(x.ll, { radius: 100, color: '#0050d0', weight: 2, dashArray: '4 4', fillColor: '#3a8dff', fillOpacity: 0.15 })
    .bindPopup(`<div class="zone-pop"><b>🚫🏊 Baignade interdite · 100 m</b><br><small>${esc(x.name ? x.name + ' · ' : '')}${x.what} (position OpenStreetMap, indicative)</small><ul><li>${esc(BATH_RULE)}</li></ul></div>`, { maxWidth: 300 }).addTo(g);
  return g;
}

/* ---------- Isobathes (courbes de profondeur) ----------
   Genève : SITG « Courbes bathymétriques du lac » (LCE_COURBES_BATHYMETRIQUES, accès libre),
   équidistance 1 m, simplifiées à 3 m, livrées avec l'appli (data/isobathes-ge.json).
   Format : lines = [[profondeur, lat, lon, lat, lon, ...], ...]. Profondeur 0 = rive. */
// Courbes genevoises retirées à la demande de Corban (2026-10-31, v72) : les isobathes viennent du WMS vaudois.
const ISOBATH_FILES = [];
let isobathData = null;
async function isobathLoad() {
  if (isobathData) return isobathData;
  const all = [];
  for (const f of ISOBATH_FILES) {
    try {
      const j = await (await fetch(f.url)).json();
      for (const l of j.lines) {
        const pts = []; let s = 90, n = -90, w = 180, e = -180;
        for (let i = 1; i < l.length; i += 2) { pts.push([l[i], l[i + 1]]); s = Math.min(s, l[i]); n = Math.max(n, l[i]); w = Math.min(w, l[i + 1]); e = Math.max(e, l[i + 1]); }
        all.push({ d: l[0], pts, bb: [s, w, n, e] });
      }
    } catch (err) { console.warn('isobathes', f.url, err); }
  }
  const asc = await bathyAscGet();
  if (asc && asc.lines) for (const l of asc.lines) {
    const pts = []; let s = 90, n = -90, w = 180, e = -180;
    for (let i = 1; i < l.length; i += 2) { pts.push([l[i], l[i + 1]]); s = Math.min(s, l[i]); n = Math.max(n, l[i]); w = Math.min(w, l[i + 1]); e = Math.max(e, l[i + 1]); }
    all.push({ d: l[0], pts, bb: [s, w, n, e], b3d: true });
  }
  isobathData = all;
  return all;
}
/* ---------- Courbes de faible profondeur calculées sur l'appareil (swissBATHY3D) ----------
   Corban, 2026-10-31 : le fichier swissBATHY3D du Léman (ESRI ASCII, grille 2 m, LV95) est trop gros pour
   être envoyé. L'appli le lit en flux, sur la tablette, et en tire les courbes de 1 à 5 m (grille prise
   tous les 4 m), surtout utiles côté France où il n'y a pas d'autres courbes. Résultat gardé dans
   IndexedDB ('ldb-docs', clé bathy-asc), partageable en JSON pour l'autre appareil. */
const ASC_LEVELS = [1, 2, 3, 4, 5];
const LAKE_LEVEL = 372.0; // niveau moyen du Léman (m) : profondeur = niveau − altitude du fond
function lv95ToWgs(E, N) {
  const y = (E - 2600000) / 1e6, x = (N - 1200000) / 1e6;
  const lon = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const lat = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return [lat * 100 / 36, lon * 100 / 36];
}
function dpSimplifyXY(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]], t2 = tol * tol;
  while (st.length) {
    const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-12;
    let m = 0, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i]; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)); const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > m) { m = d; mi = i; }
    }
    if (m > t2) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// Lit un fichier .asc en flux et renvoie les lignes [profondeur, lat, lon, …].
// Zip : lecture du répertoire central (zip64 compris), puis décompression en flux de chaque .asc.
async function zipAscEntries(file) {
  const u8 = async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer());
  const tailLen = Math.min(file.size, 70000), tail = await u8(file.size - tailLen, file.size), tv = new DataView(tail.buffer);
  let eo = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('Zip illisible');
  let n = tv.getUint16(eo + 10, true), cdSize = tv.getUint32(eo + 12, true), cdOff = tv.getUint32(eo + 16, true);
  if (cdOff === 0xffffffff || n === 0xffff) { // zip64
    const lo = eo - 20;
    if (lo >= 0 && tv.getUint32(lo, true) === 0x07064b50) {
      const r64 = Number(tv.getBigUint64(lo + 8, true)), z = await u8(r64, r64 + 56), zv = new DataView(z.buffer);
      n = Number(zv.getBigUint64(32, true)); cdSize = Number(zv.getBigUint64(40, true)); cdOff = Number(zv.getBigUint64(48, true));
    }
  }
  const cd = await u8(cdOff, cdOff + cdSize), v = new DataView(cd.buffer), out = [];
  for (let p = 0, k = 0; k < n && p + 46 <= cd.length; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true); let csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
    let off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(cd.subarray(p + 46, p + 46 + nl));
    for (let x = p + 46 + nl; x < p + 46 + nl + xl;) { // champ zip64
      const id = v.getUint16(x, true), sz = v.getUint16(x + 2, true);
      if (id === 1) { let q = x + 4; if (usize === 0xffffffff) { usize = Number(v.getBigUint64(q, true)); q += 8; } if (csize === 0xffffffff) { csize = Number(v.getBigUint64(q, true)); q += 8; } if (off === 0xffffffff) off = Number(v.getBigUint64(q, true)); }
      x += 4 + sz;
    }
    p += 46 + nl + xl + cl;
    if (!/\.(asc|txt)$/i.test(name) || /(^|\/)\._/.test(name)) continue;
    out.push({ name: name.split('/').pop(), method, csize, usize, off });
  }
  for (const e of out) {
    const h = await u8(e.off, e.off + 30), hv = new DataView(h.buffer);
    e.start = e.off + 30 + hv.getUint16(26, true) + hv.getUint16(28, true);
    e.stream = () => {
      const raw = file.slice(e.start, e.start + e.csize).stream();
      if (e.method === 0) return raw;
      if (e.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('Décompression impossible sur cet appareil : décompressez le zip dans Fichiers');
      return raw.pipeThrough(new DecompressionStream('deflate-raw'));
    };
    e.size = e.usize || e.csize * 5;
  }
  return out;
}
async function ascContours(file, onProg, step = 2) {
  const reader = file.stream().getReader(), dec = new TextDecoder();
  const hdr = {}; let hdrDone = false, text = '', read = 0;
  let ncols = 0, nrows = 0, xll = 0, yll = 0, cs = 2, nodata = -9999, W = 0;
  let mode = null; // 'alt' (altitude), 'neg' (profondeur négative), 'pos'
  let cur = null, prev = null, col = 0, row = 0, keptRow = -1;
  // num : nombre en cours de lecture (lecture caractère par caractère, plus rapide qu'un split)
  let num = 0, neg = false, frac = 0, inNum = false, dot = false, exp = false;
  const lines = [], ends = ASC_LEVELS.map(() => new Map());
  const addSeg = (li, k1, p1, k2, p2) => {
    const m = ends[li]; let A = m.get(k1), B = m.get(k2);
    if (!A && !B) { const l = { d: ASC_LEVELS[li], pts: [p1, p2], h: k1, t: k2 }; m.set(k1, l); m.set(k2, l); lines.push(l); return; }
    if (A && B) {
      m.delete(k1); m.delete(k2);
      if (A === B) { A.pts.push(A.pts[0]); A.h = A.t = -1; return; }
      if (A.h === k1) { A.pts.reverse(); [A.h, A.t] = [A.t, A.h]; }
      if (B.t === k2) { B.pts.reverse(); [B.h, B.t] = [B.t, B.h]; }
      for (const p of B.pts) A.pts.push(p);
      A.t = B.t; m.set(A.t, A); B.dead = true; return;
    }
    let L = A || B, kin = A ? k1 : k2, kout = A ? k2 : k1, pout = A ? p2 : p1;
    m.delete(kin);
    if (L.h === kin) { L.pts.reverse(); [L.h, L.t] = [L.t, L.h]; }
    L.pts.push(pout); L.t = kout; m.set(kout, L);
  };
  // Marching squares entre deux rangées gardées (prev au nord, cur au sud), ligne r (en rangées gardées).
  const march = (r) => {
    for (let j = 0; j < W - 1; j++) {
      const a = prev[j], b = prev[j + 1], c = cur[j + 1], d = cur[j];
      if (a !== a || b !== b || c !== c || d !== d) continue; // NaN = pas de donnée : on ne devine pas
      for (let li = 0; li < ASC_LEVELS.length; li++) {
        const L = ASC_LEVELS[li];
        const idx = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        // arêtes : 0 haut (a-b), 1 droite (b-c), 2 bas (d-c), 3 gauche (a-d) ; clés uniques par arête
        const key = (e) => (e === 0 ? ((r - 1) * W + j) * 2 : e === 2 ? (r * W + j) * 2 : e === 3 ? ((r - 1) * W + j) * 2 + 1 : ((r - 1) * W + j + 1) * 2 + 1);
        const pt = (e) => {
          if (e === 0) return [j + (L - a) / (b - a), r - 1];
          if (e === 2) return [j + (L - d) / (c - d), r];
          if (e === 3) return [j, r - 1 + (L - a) / (d - a)];
          return [j + 1, r - 1 + (L - b) / (c - b)];
        };
        const seg = (e1, e2) => addSeg(li, key(e1), pt(e1), key(e2), pt(e2));
        switch (idx) {
          case 1: case 14: seg(3, 2); break;
          case 2: case 13: seg(2, 1); break;
          case 3: case 12: seg(3, 1); break;
          case 4: case 11: seg(0, 1); break;
          case 6: case 9: seg(0, 2); break;
          case 7: case 8: seg(3, 0); break;
          case 5: seg(3, 0); seg(2, 1); break;
          case 10: seg(0, 1); seg(3, 2); break;
        }
      }
    }
  };
  const pushVal = (v) => {
    if (row % step === 0 && col % step === 0) {
      let dpt = NaN;
      if (v !== nodata && v > -9000) {
        if (!mode) mode = v > 100 ? 'alt' : v < 0 ? 'neg' : 'pos';
        dpt = mode === 'alt' ? LAKE_LEVEL - v : mode === 'neg' ? -v : v;
      }
      cur[col / step] = dpt;
    }
    if (++col === ncols) {
      if (row % step === 0) { keptRow++; if (prev) march(keptRow); const t = prev || new Float32Array(W); prev = cur; cur = t; }
      col = 0; row++;
    }
  };
  const flush = () => {
    if (!inNum) return;
    let v = num; if (dot) v = num / frac; if (neg) v = -v;
    pushVal(v); num = 0; neg = false; frac = 0; inNum = false; dot = false; exp = false;
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    read += value.length;
    let s = dec.decode(value, { stream: true });
    if (!hdrDone) {
      text += s;
      const re = /^\s*([a-z_]+)\s+(\S+)[ \t]*\r?\n/i; let m;
      while ((m = re.exec(text))) { hdr[m[1].toLowerCase()] = Number(m[2]); text = text.slice(m[0].length); }
      if (!/^\s*[a-z]/i.test(text) && hdr.ncols && hdr.nrows) {
        hdrDone = true; ncols = hdr.ncols; nrows = hdr.nrows; cs = hdr.cellsize;
        xll = hdr.xllcorner != null ? hdr.xllcorner : hdr.xllcenter - cs / 2; yll = hdr.yllcorner != null ? hdr.yllcorner : hdr.yllcenter - cs / 2;
        if (hdr.nodata_value != null) nodata = hdr.nodata_value;
        W = Math.ceil(ncols / step); cur = new Float32Array(W);
        s = text; text = '';
      } else { if (text.length > 4096) throw new Error('En-tête ESRI ASCII introuvable'); continue; }
    }
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 48 && c <= 57) { if (exp) continue; inNum = true; num = num * 10 + (c - 48); if (dot) frac *= 10; }
      else if (c === 46) { dot = true; frac = 1; inNum = true; }
      else if (c === 45) { if (!exp) neg = true; }
      else if (c === 101 || c === 69) exp = true; // notation 1e-3 rare : arrondie
      else flush();
    }
    if (onProg) onProg(read / file.size, row, nrows);
  }
  flush();
  // Grille → LV95 → WGS84, simplification à 3 m, sans les petits bouts de bruit (< 40 m).
  const out = [], unit = cs * step;
  for (const l of lines) {
    if (l.dead || l.pts.length < 4) continue;
    const m = l.pts.map(([gx, gy]) => [xll + (gx * step + 0.5) * cs, yll + (nrows - (gy * step + 0.5)) * cs]);
    let len = 0; for (let i = 1; i < m.length; i++) len += Math.hypot(m[i][0] - m[i - 1][0], m[i][1] - m[i - 1][1]);
    if (len < 40) continue;
    const simp = dpSimplifyXY(m, Math.max(3, unit * 0.75));
    const rec = [l.d];
    for (const [E, N] of simp) { const [la, lo] = lv95ToWgs(E, N); rec.push(Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5); }
    out.push(rec);
  }
  return out;
}
async function bathyAscSave(rec) {
  const st = await docStore('readwrite');
  await new Promise((res, rej) => { const r = st.put(rec, 'bathy-asc'); r.onsuccess = res; r.onerror = () => rej(r.error); });
  store.set('ldb.bathyAscAt', { at: rec.at, n: rec.lines.length, files: rec.files });
  isobathData = null;
}
async function bathyAscGet() {
  try { const st = await docStore('readonly'); return await new Promise((res) => { const r = st.get('bathy-asc'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch { return null; }
}
function bathyAscNote() {
  const d = store.get('ldb.bathyAscAt', null);
  return d ? `calculées le ${fmtShortDate(new Date(d.at))} (${d.n} courbes de 1 à 5 m)` : 'zip swissBATHY3D ESRI ASCII tel quel (ou .asc), ou fichier de courbes (.json) d’un autre appareil';
}
async function bathyAscImport(files, sub) {
  const say = (t) => { if (sub && sub.isConnected) sub.textContent = t; };
  try {
    let lines = [], names = [];
    for (const f of files) {
      names.push(f.name);
      if (/\.json$/i.test(f.name)) {
        const j = JSON.parse(await f.text());
        if (j.kind !== 'bathy-asc' || !Array.isArray(j.lines)) throw new Error('Ce fichier JSON ne contient pas de courbes');
        lines = lines.concat(j.lines); continue;
      }
      let srcs = [f];
      if (/\.zip$/i.test(f.name) || f.type === 'application/zip') {
        srcs = await zipAscEntries(f);
        if (!srcs.length) throw new Error('Pas de fichier .asc dans ce zip (prendre le format ESRI ASCII)');
      }
      for (const src of srcs) {
        const t0 = Date.now();
        const got = await ascContours(src, (p, r, n) => say(`${src.name} : ${Math.min(99, Math.round(p * 100))} % (rangée ${r} / ${n})…`));
        console.log('asc', src.name, got.length, 'courbes en', Date.now() - t0, 'ms');
        lines = lines.concat(got);
      }
    }
    if (!lines.length) throw new Error('Aucune courbe de 1 à 5 m trouvée');
    await bathyAscSave({ at: new Date().toISOString(), files: names, lines });
    say(bathyAscNote());
    toast(`${lines.length} courbes de faible profondeur gardées sur l’appareil`);
    return true;
  } catch (e) {
    say('échec : ' + (e.message || e));
    toast('Lecture impossible : ' + (e.message || e));
    return false;
  }
}
async function bathyAscShare() {
  const rec = await bathyAscGet();
  if (!rec) return toast('Pas encore de courbes calculées');
  await deliver(JSON.stringify({ kind: 'bathy-asc', at: rec.at, src: 'swissBATHY3D (swisstopo), courbes 1 à 5 m calculées dans NavIn', files: rec.files, lines: rec.lines }), 'courbes-leman-1-5m.json', 'application/json');
}
let IsobathCls = null;
function newIsobathLayer(lines) {
  if (!IsobathCls) IsobathCls = window.L.Layer.extend({
    initialize(lines) { this._lines = lines; },
    onAdd(map) {
      this._map = map;
      this._c = window.L.DomUtil.create('canvas', 'leaflet-zoom-hide isobaths');
      this._c.style.pointerEvents = 'none';
      map.getPanes().overlayPane.appendChild(this._c);
      map.on('moveend zoomend resize viewreset', this._draw, this);
      map.on('click', this._click, this);
      this._draw();
    },
    onRemove(map) {
      window.L.DomUtil.remove(this._c);
      map.off('moveend zoomend resize viewreset', this._draw, this);
      map.off('click', this._click, this);
    },
    _step(z) { return z >= 15 ? 1 : z >= 13 ? 5 : 10; },
    _draw() {
      const map = this._map, c = this._c, size = map.getSize(), dpr = window.devicePixelRatio || 1;
      window.L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
      c.width = size.x * dpr; c.height = size.y * dpr; c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
      const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
      const b = map.getBounds().pad(0.1), z = map.getZoom(), step = this._step(z);
      const S = b.getSouth(), N = b.getNorth(), W = b.getWest(), E = b.getEast();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const labels = [];
      for (const l of this._lines) {
        if (l.d === 0 || l.d % step) continue;
        if (l.bb[2] < S || l.bb[0] > N || l.bb[3] < W || l.bb[1] > E) continue;
        const major = l.d % 10 === 0, mid = l.d % 5 === 0;
        ctx.strokeStyle = l.d <= 3 ? 'rgba(200, 60, 0, 0.85)' : major ? 'rgba(0, 60, 140, 0.8)' : mid ? 'rgba(0, 90, 170, 0.6)' : 'rgba(0, 110, 190, 0.35)';
        ctx.lineWidth = l.d <= 3 ? 1.4 : major ? 1.4 : mid ? 1 : 0.7;
        ctx.beginPath();
        l.pts.forEach(([la, lo], i) => { const p = map.latLngToContainerPoint([la, lo]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
        ctx.stroke();
        if ((mid || l.d <= 3 || z >= 16) && l.pts.length > 3) {
          const p = map.latLngToContainerPoint(l.pts[Math.floor(l.pts.length / 2)]);
          if (p.x > 0 && p.y > 0 && p.x < size.x && p.y < size.y) labels.push([p, l.d]);
        }
      }
      ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const placed = [];
      for (const [p, d] of labels) {
        if (placed.some((q) => Math.abs(q.x - p.x) < 40 && Math.abs(q.y - p.y) < 16)) continue;
        placed.push(p);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(d + ' m', p.x, p.y);
        ctx.fillStyle = d <= 3 ? '#b03000' : '#003c8c'; ctx.fillText(d + ' m', p.x, p.y);
      }
    },
    // Toucher l'eau : profondeur estimée d'après les deux courbes les plus proches.
    _click(e) {
      if (this._map.getZoom() < 13) return;
      const { lat, lng } = e.latlng, ky = 111320, kx = 111320 * Math.cos(rad(lat));
      const near = [];
      for (const l of this._lines) {
        if (lat < l.bb[0] - 0.01 || lat > l.bb[2] + 0.01 || lng < l.bb[1] - 0.015 || lng > l.bb[3] + 0.015) continue;
        let m = Infinity;
        for (let i = 1; i < l.pts.length; i++) {
          const ax = (l.pts[i - 1][1] - lng) * kx, ay = (l.pts[i - 1][0] - lat) * ky, bx = (l.pts[i][1] - lng) * kx, by = (l.pts[i][0] - lat) * ky;
          const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / ((dx * dx + dy * dy) || 1e-9)));
          m = Math.min(m, Math.hypot(ax + t * dx, ay + t * dy));
        }
        near.push([m, l.d]);
      }
      if (!near.length) return;
      near.sort((a, b) => a[0] - b[0]);
      if (near[0][0] > 400) return;
      const a = near[0], b = near.find((x) => x[1] !== a[1]);
      let txt;
      if (b && b[0] < 400) {
        const est = (a[1] * b[0] + b[1] * a[0]) / (a[0] + b[0]);
        txt = `≈ ${est.toFixed(1)} m (entre les courbes ${Math.min(a[1], b[1])} m et ${Math.max(a[1], b[1])} m)`;
      } else txt = `≈ ${a[1]} m (courbe à ${Math.round(a[0])} m)`;
      // Ne pas cacher la popup des zones des rives : ajoutée en bas si elle est déjà ouverte.
      setTimeout(() => {
        const pop = this._map._popup;
        const line = `<div class="zone-pop isob-pop"><b>Profondeur ${esc(txt)}</b><br><small>Courbes swissBATHY3D calculées sur l’appareil, indicatif, niveau moyen du lac (372 m)</small></div>`;
        if (pop && this._map.hasLayer(pop) && pop.getLatLng().equals(e.latlng)) pop.setContent(pop.getContent() + line);
        else window.L.popup({ maxWidth: 300 }).setLatLng(e.latlng).setContent(line).openOn(this._map);
      }, 0);
    },
  });
  return new IsobathCls(lines);
}

/* ---------- Isobathes vaudoises (WMS du canton de Vaud, transmis par Corban) ----------
   Images (pas du vectoriel) : il faut du réseau, puis les images vues restent dans le cache des tuiles.
   Le nom de la couche est trouvé dans le GetCapabilities (mots bathy / isobathe / profondeur) et gardé. */
const VD_WMS = 'https://www.ogc.vd.ch/public/services/OGC/wmsVD/Mapserver/WMSServer';
const VD_BOUNDS = [[46.18, 6.10], [46.56, 6.95]];
async function vdIsobathLayers() {
  const known = store.get('ldb.vdIsobath', null);
  if (known && known.layers && known.layers.length && Date.now() - known.at < 30 * 864e5) return known.layers;
  try {
    const xml = await (await fetch(VD_WMS + '?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0')).text();
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const out = [];
    for (const l of doc.getElementsByTagName('Layer')) {
      const name = [...l.children].find((c) => c.localName === 'Name');
      const title = [...l.children].find((c) => c.localName === 'Title');
      const txt = ((name && name.textContent) || '') + ' ' + ((title && title.textContent) || '');
      if (name && /bathy|isobath|profondeur/i.test(txt)) out.push({ name: name.textContent.trim(), title: (title && title.textContent.trim()) || name.textContent.trim() });
    }
    if (out.length) store.set('ldb.vdIsobath', { at: Date.now(), layers: out });
    return out.length ? out : (known && known.layers) || [];
  } catch (err) {
    console.warn('WMS Vaud', err);
    return (known && known.layers) || [];
  }
}
async function addVdIsobath(map, ctrl) {
  const layers = await vdIsobathLayers();
  if (!layers.length || !map._container || !map._container.isConnected) return;
  const L = window.L;
  const wms = L.tileLayer.wms(VD_WMS, { layers: layers.map((l) => l.name).join(','), format: 'image/png', transparent: true, version: '1.3.0', bounds: VD_BOUNDS, maxZoom: 19, opacity: 0.85, attribution: '© État de Vaud' });
  ctrl.addOverlay(wms, 'Isobathes (canton de Vaud)');
  wms.addTo(map);
}

// Relief du fond du lac (swissBATHY3D, ombrage swisstopo) en option.
const BATHY_TILES = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissbathy3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png';

// Ajoute les calques vectoriels à une carte Leaflet et à son sélecteur de calques.
async function addLemanVector(map, ctrl, seamarkRaster) {
  const L = window.L;
  const bathy = L.tileLayer(BATHY_TILES, { maxZoom: 19, maxNativeZoom: 18, crossOrigin: true, bounds: SWISS_BOUNDS, opacity: 0.6, attribution: '© swisstopo swissBATHY3D' });
  ctrl.addOverlay(bathy, 'Relief du fond (swissBATHY3D)');
  await lemanVecLoad();
  if (!map._container || !map._container.isConnected) return;
  const iso = await isobathLoad();
  if (iso.length && map._container && map._container.isConnected) {
    const il = newIsobathLayer(iso);
    ctrl.addOverlay(il, 'Courbes 1 à 5 m (swissBATHY3D)');
    il.addTo(map);
  }
  addVdIsobath(map, ctrl);
  const g = lemanVecLayer(L);
  if (lemanVec && lemanVec.shore && lemanVec.shore.length) {
    const bands = newShoreBands(lemanVec.shore);
    ctrl.addOverlay(bands, 'Zones 150 m et 300 m des rives');
    bands.addTo(map);
  }
  const bath = bathLayer(L);
  if (bath) { ctrl.addOverlay(bath, 'Baignade interdite (100 m des ports et débarcadères)'); bath.addTo(map); }
  if (!g) return;
  ctrl.addOverlay(g, 'Balises et ports (vectoriel, hors ligne)');
  g.addTo(map);
  // Le vectoriel remplace les tuiles OpenSeaMap, qui restent disponibles dans le sélecteur.
  if (seamarkRaster && map.hasLayer(seamarkRaster)) map.removeLayer(seamarkRaster);
}

/* ---------- Zones riveraines de 150 m et 300 m (Corban, 2026-10-31) ----------
   Le contour du lac (OpenStreetMap) sert de rive : la bande de 300 m est en orange, celle de 150 m en rouge.
   Toucher la carte dans une bande ouvre la règle. Contour indicatif : la règle compte aussi depuis les roselières
   et les constructions dans l'eau. */
const LEMAN_SHORE_QUERY = `[out:json][timeout:120];
rel["natural"="water"]["name"~"L[ée]man|Lake Geneva|Genfersee"](${LEMAN_BBOX.s},${LEMAN_BBOX.w},${LEMAN_BBOX.n},${LEMAN_BBOX.e});
out geom;`;
// Simplification Douglas-Peucker (environ 4 m), pour garder un contour léger.
function dpSimplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && md > tol * tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// Recolle les morceaux de rive (chemins OSM) en anneaux fermés : rive du lac et îles.
function shoreRings(json) {
  const segs = [];
  for (const el of json.elements || []) for (const m of el.members || []) if (m.geometry && m.geometry.length > 1) segs.push(m.geometry.map((p) => [p.lat, p.lon]));
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let grown = true;
    while (!same(ring[0], ring[ring.length - 1]) && grown) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i], end = ring[ring.length - 1];
        if (same(sg[0], end)) ring = ring.concat(sg.slice(1));
        else if (same(sg[sg.length - 1], end)) ring = ring.concat(sg.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1); grown = true; break;
      }
    }
    if (ring.length > 3) rings.push(dpSimplify(ring, 0.00004).map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5]));
  }
  return rings;
}
// Dans le lac ? (pair-impair : les îles sont des trous)
function inShore(rings, lat, lon) {
  let inside = false;
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [yi, xi] = r[i], [yj, xj] = r[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Distance à la rive la plus proche, en mètres.
function shoreDist(rings, lat, lon) {
  const ky = 111320, kx = 111320 * Math.cos(rad(lat));
  let best = Infinity;
  for (const r of rings) for (let i = 1; i < r.length; i++) {
    const ax = (r[i - 1][1] - lon) * kx, ay = (r[i - 1][0] - lat) * ky, bx = (r[i][1] - lon) * kx, by = (r[i][0] - lat) * ky;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    let t = L2 ? -(ax * dx + ay * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const ex = ax + t * dx, ey = ay + t * dy, d = ex * ex + ey * ey;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const ZONE_RULES = {
  150: { title: 'Zone riveraine intérieure · moins de 150 m', rules: [
    'On y passe seulement pour accoster, partir ou stationner, par le chemin le plus court, perpendiculairement à la rive (ONI art. 53, RNL).',
    'Au moteur : 10 km/h au maximum.',
    'Interdit d’entrer dans les roseaux, joncs et nénuphars : garder en général 25 m (ONI art. 53).',
    'Bouées jaunes : zones interdites à la navigation (baignade, réserves).'] },
  300: { title: 'Zone riveraine extérieure · 150 à 300 m', rules: [
    'Au moteur : 10 km/h au maximum à moins de 300 m de la rive (ONI art. 53, RNL).',
    'La zone se mesure depuis la rive, les roselières ou les constructions dans l’eau.',
    'Au-delà de 300 m, gilets et équipement de sécurité exigés à bord.'] },
};
function zonePopupHtml(d) {
  const z = ZONE_RULES[d < 150 ? 150 : 300];
  return `<div class="zone-pop"><b>${esc(z.title)}</b><br><small>≈ ${Math.round(d)} m de la rive (contour indicatif)</small><ul>${z.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
}
// Leaflet est chargé à la demande : la classe du calque est créée au premier usage.
let ShoreBandsCls = null;
function newShoreBands(rings) {
  if (!ShoreBandsCls) ShoreBandsCls = window.L.Layer.extend({
  initialize(rings) { this._rings = rings; },
  onAdd(map) {
    this._map = map;
    this._c = window.L.DomUtil.create('canvas', 'leaflet-zoom-hide shore-bands');
    this._c.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(this._c);
    map.on('moveend zoomend resize viewreset', this._draw, this);
    map.on('click', this._click, this);
    this._draw();
  },
  onRemove(map) {
    window.L.DomUtil.remove(this._c);
    map.off('moveend zoomend resize viewreset', this._draw, this);
    map.off('click', this._click, this);
  },
  _draw() {
    const map = this._map, c = this._c, size = map.getSize(), dpr = window.devicePixelRatio || 1;
    window.L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
    c.width = size.x * dpr; c.height = size.y * dpr; c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const path = new Path2D();
    for (const r of this._rings) {
      r.forEach(([la, lo], i) => { const p = map.latLngToContainerPoint([la, lo]); if (i) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y); });
      path.closePath();
    }
    const mpp = 40075016.686 * Math.cos(rad(map.getCenter().lat)) / (256 * 2 ** map.getZoom());
    ctx.save();
    ctx.clip(path, 'evenodd');
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 150, 0, 0.30)'; ctx.lineWidth = 600 / mpp; ctx.stroke(path);
    ctx.strokeStyle = 'rgba(220, 0, 0, 0.30)'; ctx.lineWidth = 300 / mpp; ctx.stroke(path);
    ctx.restore();
  },
  _click(e) {
    const { lat, lng } = e.latlng;
    if (!inShore(this._rings, lat, lng)) return;
    const d = shoreDist(this._rings, lat, lng);
    if (d >= 300) return;
    window.L.popup({ maxWidth: 300 }).setLatLng(e.latlng).setContent(zonePopupHtml(d)).openOn(this._map);
  },
  });
  return new ShoreBandsCls(rings);
}

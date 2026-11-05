/* =====================================================================
   APPUI LONG SUR LA CARTE, GO TO ET RÉPERTOIRE DES MARQUES (Corban, 2026-10-31)
   Un appui long d'un doigt sur n'importe quelle carte ouvre un menu : position,
   profondeur (courbes sur l'appareil), vent (prévision à ce point, avec réseau),
   distance et cap vrai depuis ma position, « Go to » et « Enregistrer une marque ».
   Les marques (M001, M002…) ont date, heure et position, et vivent dans
   « Mes marques » ; elles voyagent dans la sauvegarde et la synchronisation.
   ===================================================================== */
let marks = store.arr('ldb.marks');
let gotoT = store.get('ldb.goto', null); // { lat, lon, name }
let myPos = null; // dernière position connue { lat, lon, sog, cog, t }
const saveMarks = () => { store.set('ldb.marks', marks); store.set('ldb.marks.at', new Date().toISOString()); };
const markName = (n) => 'M' + String(n).padStart(3, '0');
function mergeMarks(list) {
  if (!Array.isArray(list)) return;
  for (const m of list) if (!marks.some((x) => x.id === m.id)) marks.push(m);
  marks.sort((a, b) => a.n - b.n);
  store.set('ldb.markSeq', Math.max(store.get('ldb.markSeq', 0), ...marks.map((m) => m.n || 0)));
  saveMarks();
}
// v436 (Corban) : 11 marques d'exemple (7 sur le Léman, 4 en Méditerranée près de Toulon), ajoutées une fois ; supprimables.
if (!store.get('ldb.exMarks', false)) {
  const EX = [
    ['Bouée devant Morges', 46.5, 6.5, 'Lac'], ['Large de Saint-Sulpice', 46.5, 6.56, 'Lac'], ['Milieu du Grand-Lac', 46.45, 6.55, 'Lac'],
    ['Large de Rolle', 46.445, 6.34, 'Lac'], ['Large d’Ouchy', 46.495, 6.63, 'Lac'], ['Large d’Évian', 46.42, 6.59, 'Lac'], ['Large de Nyon', 46.37, 6.26, 'Lac'],
    ['Sud de Porquerolles', 42.98, 6.2, 'Mer'], ['Rade de Toulon', 43.085, 5.94, 'Mer'], ['Large de Cassis', 43.19, 5.53, 'Mer'], ['Large du cap Sicié', 43.03, 5.85, 'Mer'],
  ];
  let seq = store.get('ldb.markSeq', 0); const now = new Date().toISOString();
  EX.forEach(([nm, lat, lon, z], i) => { const id = 'exm' + (i + 1); if (marks.some((m) => m.id === id)) return; seq += 1; marks.push({ id, n: seq, name: markName(seq), at: now, lat, lon, depth: '', note: nm }); });
  store.set('ldb.markSeq', seq); saveMarks(); store.set('ldb.exMarks', true);
}
function addMark(lat, lon, depth) {
  const n = store.get('ldb.markSeq', 0) + 1;
  store.set('ldb.markSeq', n);
  const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, name: markName(n), at: new Date().toISOString(), lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, depth: depth || '', note: '' };
  marks.push(m); saveMarks(); marksRedraw();
  return m;
}

/* ---------- Ma position (suivie tant qu'un Go to est actif ou qu'un menu en a besoin) ---------- */
let posWatch = null;
function wantPos(on) {
  if (on && posWatch == null && navigator.geolocation) posWatch = navigator.geolocation.watchPosition((p) => {
    myPos = { lat: p.coords.latitude, lon: p.coords.longitude, sog: p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 1.943844 : null, cog: p.coords.heading, t: Date.now() };
    gotoUpdate();
  }, () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  if (!on && posWatch != null) { navigator.geolocation.clearWatch(posWatch); posWatch = null; }
}
const herePos = () => (myPos && Date.now() - myPos.t < 120000 ? myPos : typeof lastFix !== 'undefined' && lastFix ? lastFix : myPos);

/* ---------- Profondeur au point (courbes swissBATHY3D calculées sur l'appareil) ---------- */
function depthAt(lat, lng) {
  const lines = typeof isobathData !== 'undefined' && isobathData ? isobathData : [];
  if (!lines.length) return '';
  const ky = 111320, kx = 111320 * Math.cos(rad(lat)), near = [];
  for (const l of lines) {
    if (lat < l.bb[0] - 0.01 || lat > l.bb[2] + 0.01 || lng < l.bb[1] - 0.015 || lng > l.bb[3] + 0.015) continue;
    let m = Infinity;
    for (let i = 1; i < l.pts.length; i++) {
      const ax = (l.pts[i - 1][1] - lng) * kx, ay = (l.pts[i - 1][0] - lat) * ky, bx = (l.pts[i][1] - lng) * kx, by = (l.pts[i][0] - lat) * ky;
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / ((dx * dx + dy * dy) || 1e-9)));
      m = Math.min(m, Math.hypot(ax + t * dx, ay + t * dy));
    }
    near.push([m, l.d]);
  }
  if (!near.length) return '';
  near.sort((a, b) => a[0] - b[0]);
  if (near[0][0] > 400) return '';
  const a = near[0], b = near.find((x) => x[1] !== a[1]);
  if (b && b[0] < 400) return `≈ ${fr((a[1] * b[0] + b[1] * a[0]) / (a[0] + b[0]))} m`;
  return `≈ ${a[1]} m (courbe à ${Math.round(a[0])} m)`;
}

/* ---------- Menu de l'appui long ---------- */
const brg3 = (x) => String(Math.round(x) % 360).padStart(3, '0') + '°';
function relTxt(p) {
  const me = herePos();
  if (!me) return 'Ma position : en attente du GPS…';
  const d = distNM(me, p), b = bearing(me, p);
  const eta = me.sog > 0.5 ? ` · ${fmtDur((d / me.sog) * 3600000)} à ${fr(me.sog)} nd` : '';
  return `<b>${d < 0.1 ? Math.round(d * 1852) + ' m' : fr(d) + ' NM'}</b> · cap à suivre <b>${brg3(b)}</b> (vrai)${eta}`;
}
function lpMenu(map, ll) {
  const L = window.L, p = { lat: ll.lat, lon: ll.lng };
  const depth = depthAt(ll.lat, ll.lng);
  wantPos(true);
  if (!herePos() && navigator.geolocation) navigator.geolocation.getCurrentPosition((g) => { myPos = { lat: g.coords.latitude, lon: g.coords.longitude, t: Date.now() }; const r = document.getElementById('lpRel'); if (r) r.innerHTML = relTxt(p); }, () => {}, { maximumAge: 60000, timeout: 15000 });
  const html = `<div class="lp-menu">
    <div class="lp-pos">📍 <b>${esc(fmtPos(p))}</b></div>
    <div>🌊 Profondeur : ${depth ? `<b>${esc(depth)}</b>` : '<span class="muted">pas de courbe ici</span>'}</div>
    <div>💨 Vent : <span id="lpWind">${navigator.onLine ? 'recherche…' : 'hors réseau'}</span></div>
    <div>🧭 Depuis ma position : <span id="lpRel">${relTxt(p)}</span></div>
    <div class="lp-btns"><button class="btn primary" data-lp="goto">🎯 Go to</button><button class="btn" data-lp="mark">📌 Enregistrer une marque</button></div>
  </div>`;
  const pop = L.popup({ maxWidth: 320, closeOnClick: false, autoPan: true, className: 'lp-pop' }).setLatLng(ll).setContent(html).openOn(map);
  const el = pop.getElement();
  if (el) el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lp]');
    if (!b) return;
    buzz();
    if (b.dataset.lp === 'goto') { setGoto({ lat: p.lat, lon: p.lon, name: fmtPos(p) }); map.closePopup(pop); }
    if (b.dataset.lp === 'mark') { const m = addMark(p.lat, p.lon, depth); toast(`Marque ${m.name} enregistrée`); map.closePopup(pop); }
  });
  if (navigator.onLine && typeof wxNext === 'function') wxNext(p.lat, p.lon, 1).then((w) => {
    const s = document.getElementById('lpWind');
    if (!s) return;
    const r = w && w.rows && w.rows[0];
    s.innerHTML = r && r.tws != null ? `<b>${Math.round(r.tws)} nd</b> du ${brg3(r.twd)}${r.gust != null ? `, rafales ${Math.round(r.gust)} nd` : ''} <small>(${esc(w.src || 'prévision')})</small>` : 'indisponible';
  }).catch(() => { const s = document.getElementById('lpWind'); if (s) s.textContent = 'indisponible'; });
}

/* ---------- Go to ---------- */
function setGoto(t) {
  gotoT = t; store.set('ldb.goto', t);
  wantPos(!!t);
  gotoUpdate(); marksRedraw();
  if (t) toast(`Go to ${t.name}`);
}
function gotoUpdate() {
  let bar = document.getElementById('gotoBar');
  if (!gotoT) { if (bar) bar.remove(); document.body.classList.remove('has-goto'); return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'gotoBar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => { if (e.target.closest('#gotoStop')) { buzz(); setGoto(null); toast('Go to arrêté'); } });
  }
  document.body.classList.add('has-goto');
  const me = herePos();
  let info = 'en attente du GPS…';
  if (me) {
    const d = distNM(me, gotoT), b = bearing(me, gotoT);
    const off = me.cog != null && !Number.isNaN(me.cog) && me.sog > 0.5 ? ((b - me.cog + 540) % 360) - 180 : null;
    const vmg = off != null ? me.sog * Math.cos(rad(off)) : null;
    info = `<b>${d < 0.1 ? Math.round(d * 1852) + ' m' : fr(d) + ' NM'}</b> · <b>${brg3(b)}</b>${off != null ? ` · ${Math.abs(off) < 5 ? 'droit devant' : `${off > 0 ? 'à droite' : 'à gauche'} ${Math.abs(Math.round(off))}°`}` : ''}${vmg > 0.3 ? ` · ${fmtDur((d / vmg) * 3600000)}` : ''}`;
    if (d * 1852 < (settings.gotoArrive || 30) && !gotoT.arrived) { gotoT.arrived = true; toast(`Arrivé à ${gotoT.name}`); if (typeof playAlarm === 'function') try { playAlarm(1); } catch {} }
  }
  bar.innerHTML = `<span>🎯 ${esc(gotoT.name)} : ${info}</span><button class="btn" id="gotoStop">■</button>`;
  for (const m of goMaps()) drawGotoLine(m);
}

/* ---------- Dessin sur les cartes ---------- */
const lpMaps = new Set();
const goMaps = () => [...lpMaps].filter((m) => m._container && m._container.isConnected);
function drawGotoLine(map) {
  const L = window.L;
  if (map._gotoLine) { map._gotoLine.remove(); map._gotoLine = null; }
  if (!gotoT) return;
  const me = herePos();
  const pts = me ? [[me.lat, me.lon], [gotoT.lat, gotoT.lon]] : [[gotoT.lat, gotoT.lon]];
  map._gotoLine = L.layerGroup([
    ...(me ? [L.polyline(pts, { color: '#ff00aa', weight: 3, dashArray: '8 6' })] : []),
    L.circleMarker([gotoT.lat, gotoT.lon], { radius: 9, color: '#ff00aa', weight: 3, fillOpacity: 0.2 }),
  ]).addTo(map);
}
function drawMarks(map) {
  const L = window.L;
  if (map._marks) map._marks.remove();
  map._marks = L.layerGroup(marks.map((m) => L.marker([m.lat, m.lon], { icon: L.divIcon({ className: 'mark-ic', html: `<span>◆</span><b>${esc(m.name)}</b>`, iconSize: [60, 22], iconAnchor: [8, 11] }) })
    .bindPopup(() => `<div class="lp-menu"><b>📌 ${esc(m.name)}</b>${m.note ? ` · ${esc(m.note)}` : ''}<br><small>${esc(fmtShortDate(new Date(m.at)))} ${esc(fmtUtc(new Date(m.at)))}</small><div>📍 ${esc(fmtPos(m))}</div>${m.depth ? `<div>🌊 ${esc(m.depth)}</div>` : ''}<div>🧭 ${relTxt(m)}</div><div class="lp-btns"><button class="btn primary" onclick="setGoto({lat:${m.lat},lon:${m.lon},name:'${m.name}'})">🎯 Go to</button><button class="btn" onclick="go('marks')">📒 Mes marques</button></div></div>`))).addTo(map);
}
function marksRedraw() { for (const m of goMaps()) { drawMarks(m); drawGotoLine(m); } }
let marksFly = null;
function lpAttach(map) {
  if (map._lpDone) return; map._lpDone = true;
  lpMaps.add(map);
  map.on('unload', () => lpMaps.delete(map));
  const c = map.getContainer();
  let t = null, start = null, pointers = 0;
  const cancel = () => { clearTimeout(t); t = null; };
  c.addEventListener('pointerdown', (e) => {
    pointers++;
    if (pointers > 1 || (e.target.closest && e.target.closest('.leaflet-control, .leaflet-popup'))) return cancel();
    start = { x: e.clientX, y: e.clientY };
    cancel();
    t = setTimeout(() => { t = null; buzz(); const r = c.getBoundingClientRect(); lpMenu(map, map.containerPointToLatLng([start.x - r.left, start.y - r.top])); }, 650);
  });
  c.addEventListener('pointermove', (e) => { if (t && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) c.addEventListener(ev, () => { pointers = Math.max(0, pointers - 1); cancel(); });
  map.on('contextmenu', (e) => { if (e.originalEvent && e.originalEvent.pointerType === 'touch') return; lpMenu(map, e.latlng); });
  map.on('movestart zoomstart', cancel);
  map.whenReady(() => {
    // Dessin juste après le premier affichage (pendant « load », Leaflet n'a pas encore ses limites).
    setTimeout(() => { if (!map._container || !map._container.isConnected) return; try { drawMarks(map); drawGotoLine(map); } catch (err) { console.warn('marques', err); } }, 0);
    if (marksFly) { const f = marksFly; marksFly = null; setTimeout(() => { map.setView(f, 15); if (typeof trk !== 'undefined' && trk) trk.follow = false; }, 300); }
  });
}
// Leaflet est chargé à la demande : on accroche l'appui long à chaque carte créée.
const loadLeafletBase = loadLeaflet;
loadLeaflet = function () {
  return loadLeafletBase().then((r) => {
    if (window.L && !window.L._lpHook) { window.L._lpHook = true; window.L.Map.addInitHook(function () { lpAttach(this); if (typeof ctlAutoAttach === 'function') ctlAutoAttach(this); }); }
    return r;
  });
};
if (gotoT) setTimeout(() => { wantPos(true); gotoUpdate(); }, 500);

/* ---------- Répertoire des marques ---------- */
function marksGpx() {
  const w = marks.map((m) => `<wpt lat="${m.lat}" lon="${m.lon}"><time>${m.at}</time><name>${esc(m.name)}</name>${m.note ? `<desc>${esc(m.note)}</desc>` : ''}</wpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">\n${w}\n</gpx>`;
}
VIEWS.marks = function renderMarks() {
  const main = $('#view');
  const list = [...marks].sort((a, b) => b.n - a.n);
  main.innerHTML = `
    <button class="btn" data-go="${cruise ? 'more' : 'tracker'}">◀ ${cruise ? 'Plus' : 'Traceur'}</button>
    <h1>Mes marques</h1>
    <p class="help">Appui long d’un doigt sur la carte (traceur ou carte du journal) › « Enregistrer une marque ». Numérotées dans l’ordre, avec date, heure et position.</p>
    ${gotoT ? `<div class="row"><button class="btn danger" data-mk="stopgo">■ Arrêter le Go to (${esc(gotoT.name)})</button></div>` : ''}
    <div id="mkList">${list.length ? list.map((m) => `<section class="field mark-item" data-id="${m.id}">
      <h2>📌 ${esc(m.name)}${m.note ? ` · ${esc(m.note)}` : ''}</h2>
      <p class="help">${esc(fmtShortDate(new Date(m.at)))} · ${tzHtml(new Date(m.at))} · ${esc(fmtPos(m))}${m.depth ? ` · 🌊 ${esc(m.depth)}` : ''}<br>🧭 ${relTxt(m)}</p>
      <div class="row c4"><button class="btn primary" data-mk="goto">🎯 Go to</button><button class="btn" data-mk="show">🗺 Voir</button><button class="btn" data-mk="note">✏️ Nom</button><button class="btn danger" data-mk="del">🗑</button></div>
    </section>`).join('') : '<p class="help">Aucune marque pour l’instant.</p>'}</div>
    ${list.length ? '<div class="row c2"><button class="btn" data-mk="gpx">📤 Exporter en GPX</button><button class="btn" data-mk="txt">📋 Partager la liste</button></div>' : ''}`;
  main.onclick = (e) => {
    const g = e.target.closest('[data-go]'); if (g) { buzz(); return go(g.dataset.go); }
    const b = e.target.closest('[data-mk]'); if (!b) return;
    buzz();
    const sec = b.closest('[data-id]'), m = sec && marks.find((x) => x.id === sec.dataset.id);
    const a = b.dataset.mk;
    if (a === 'stopgo') { setGoto(null); return VIEWS.marks(); }
    if (a === 'gpx') return deliver(marksGpx(), 'navin-marques.gpx', 'application/gpx+xml');
    if (a === 'txt') return deliver(list.map((x) => `${x.name}${x.note ? ' (' + x.note + ')' : ''} · ${fmtShortDate(new Date(x.at))} ${fmtUtc(new Date(x.at))} · ${fmtPos(x)}${x.depth ? ' · ' + x.depth : ''}`).join('\n'), 'navin-marques.txt', 'text/plain');
    if (!m) return;
    if (a === 'goto') { setGoto({ lat: m.lat, lon: m.lon, name: m.name + (m.note ? ' · ' + m.note : '') }); return VIEWS.marks(); }
    if (a === 'show') { marksFly = [m.lat, m.lon]; return go('tracker'); }
    if (a === 'note') { const v = prompt(`Nom ou note pour ${m.name}`, m.note || ''); if (v != null) { m.note = v.trim(); saveMarks(); VIEWS.marks(); } }
    if (a === 'del') armed(b, 'Encore', () => { marks = marks.filter((x) => x.id !== m.id); saveMarks(); VIEWS.marks(); });
  };
};

'use strict';

/* =====================================================================
   v409 (Corban) : instruments du bateau (NMEA).
   - Connexion en direct par Wi-Fi à un serveur Signal K (WebSocket). Une appli web ne peut pas ouvrir les flux
     bruts TCP / UDP des passerelles NMEA : il faut un relais WebSocket (Signal K le fait). Les phrases NMEA 0183
     reçues en texte par WebSocket sont aussi comprises.
   - Une fois connecté : position, vitesse et cap du bateau remplacent le GPS du téléphone (carte, journal
     automatique), et le vent réel des instruments est ajouté aux points du journal automatique.
   - Import d'un fichier NMEA 0183 enregistré à bord (.nmea, .log, .txt) : même traitement qu'une trace GPX.
   ===================================================================== */

const nmea = { ws: null, on: false, status: 'off', err: '', live: {}, at: {}, retry: null, n: 0 };
window.nmeaLive = nmea;
const NM_FRESH = 15000;
const nmFresh = (k) => nmea.at[k] && Date.now() - nmea.at[k] < NM_FRESH;
const nmDeg = (r) => (r == null ? null : ((r * 180 / Math.PI) % 360 + 360) % 360);
const nmKn = (ms) => (ms == null ? null : ms * 1.943844);

// Vent réel à partir du vent apparent et de la vitesse du bateau (angle signé, + tribord).
function nmTrueWind(aws, awa, bs, hdg) {
  if (aws == null || awa == null) return null;
  const a = awa * Math.PI / 180, b = bs || 0;
  const x = aws * Math.cos(a) - b, y = aws * Math.sin(a);
  const tws = Math.hypot(x, y), twa = Math.atan2(y, x) * 180 / Math.PI;
  return { tws, twa, twd: hdg == null ? null : ((hdg + twa) % 360 + 360) % 360 };
}

function nmSet(k, v) { if (v == null || Number.isNaN(v)) return; nmea.live[k] = v; nmea.at[k] = Date.now(); }

// Recalcule le vent réel quand il manque, puis transmet la position à l'appli.
function nmAfter(posChanged) {
  const L = nmea.live;
  if (!nmFresh('tws') && nmFresh('aws') && nmFresh('awa')) {
    const hdg = nmFresh('hdg') ? L.hdg : nmFresh('cog') ? L.cog : null;
    const bs = nmFresh('stw') ? L.stw : nmFresh('sog') ? L.sog : 0;
    const t = nmTrueWind(L.aws, L.awa, bs, hdg);
    if (t) { L.twsCalc = t.tws; L.twdCalc = t.twd; nmea.at.twsCalc = Date.now(); }
  }
  if (posChanged && nmFresh('lat')) {
    const p = { timestamp: Date.now(), nmea: true, coords: { latitude: L.lat, longitude: L.lon, accuracy: 5,
      speed: nmFresh('sog') ? L.sog / 1.943844 : null, heading: nmFresh('cog') ? L.cog : null } };
    try { if (typeof onFix === 'function') onFix(p); } catch (e) {}
    try { if (typeof trkFix === 'function') trkFix({ lat: L.lat, lon: L.lon, acc: 5, sog: nmFresh('sog') ? L.sog : null, cog: nmFresh('cog') ? L.cog : null }); } catch (e) {}
  }
  nmDraw();
}
// Vent réel à jour pour le journal automatique (lu par onFix).
window.nmeaWind = function nmeaWind() {
  const L = nmea.live;
  if (nmFresh('tws') && nmFresh('twd')) return { tws: L.tws, twd: L.twd };
  if (nmFresh('twsCalc') && L.twdCalc != null) return { tws: L.twsCalc, twd: L.twdCalc };
  return null;
};
window.nmeaPosFresh = () => nmea.on && nmFresh('lat');

/* ---------- NMEA 0183 ---------- */
function nmCoord(v, h) {
  if (!v) return null;
  const d = v.indexOf('.') - 2; if (d < 1) return null;
  const x = Number(v.slice(0, d)) + Number(v.slice(d)) / 60;
  return h === 'S' || h === 'W' ? -x : x;
}
const nmNum = (v) => (v === '' || v == null ? null : Number(v));
// Une phrase : renvoie les valeurs comprises ({ lat, lon, sog… } et t si heure + date connues).
function nmParse0183(line, ctx) {
  line = String(line).trim();
  const st = line.search(/[$!]/); if (st < 0) return null;
  line = line.slice(st);
  const star = line.indexOf('*');
  if (star > 0) {
    const cs = line.slice(star + 1, star + 3);
    let x = 0; for (let i = 1; i < star; i++) x ^= line.charCodeAt(i);
    if (/^[0-9A-F]{2}$/i.test(cs) && parseInt(cs, 16) !== x) return null;
    line = line.slice(0, star);
  }
  const f = line.split(','), type = f[0].slice(-3), o = {};
  const time = (hms) => { if (!hms || hms.length < 6) return; o.hms = hms; };
  switch (type) {
    case 'RMC':
      time(f[1]);
      if (f[2] !== 'A') break;
      o.lat = nmCoord(f[3], f[4]); o.lon = nmCoord(f[5], f[6]); o.sog = nmNum(f[7]); o.cog = nmNum(f[8]);
      if (f[9] && f[9].length === 6) o.dmy = f[9];
      o.fix = true; break;
    case 'GGA':
      time(f[1]);
      if (f[6] === '0') break;
      o.lat = nmCoord(f[2], f[3]); o.lon = nmCoord(f[4], f[5]); o.fix = true; break;
    case 'GLL':
      if (f[6] && f[6] !== 'A') break;
      o.lat = nmCoord(f[1], f[2]); o.lon = nmCoord(f[3], f[4]); time(f[5]); o.fix = true; break;
    case 'VTG': o.cog = nmNum(f[1]); o.sog = nmNum(f[5]); break;
    case 'HDT': o.hdg = nmNum(f[1]); break;
    case 'HDG': case 'HDM': { const h = nmNum(f[1]); if (h != null) { const v = type === 'HDG' && f[4] ? nmNum(f[4]) * (f[5] === 'W' ? -1 : 1) : 0; o.hdg = ((h + v) % 360 + 360) % 360; } break; }
    case 'VHW': o.stw = nmNum(f[5]); if (f[1]) o.hdg = nmNum(f[1]); break;
    case 'MWV': {
      if (f[5] && f[5] !== 'A') break;
      let ang = nmNum(f[1]), sp = nmNum(f[3]); if (ang == null || sp == null) break;
      sp = f[4] === 'M' ? sp * 1.943844 : f[4] === 'K' ? sp / 1.852 : sp;
      const sgn = ang > 180 ? ang - 360 : ang;
      if (f[2] === 'R') { o.aws = sp; o.awa = sgn; } else { o.tws = sp; o.twa = sgn; }
      break;
    }
    case 'MWD': { const d = nmNum(f[1]); const s = nmNum(f[5]); if (d != null) o.twd = d; if (s != null) o.tws = s; break; }
    case 'DPT': { const d = nmNum(f[1]); if (d != null) o.depth = d + (nmNum(f[2]) > 0 ? nmNum(f[2]) : 0); break; }
    case 'DBT': { const d = nmNum(f[3]); if (d != null) o.depth = d; break; }
    case 'DBS': { const d = nmNum(f[3]); if (d != null) o.depth = d; break; }
    case 'MTW': o.wtemp = nmNum(f[1]); break;
    default: return null;
  }
  return o;
}
function nmApply0183(o) {
  if (!o) return;
  let pos = false;
  for (const k of ['sog', 'cog', 'hdg', 'stw', 'aws', 'awa', 'tws', 'twd', 'depth', 'wtemp']) if (o[k] != null) nmSet(k, o[k]);
  if (o.twa != null) { nmSet('twa', o.twa); const h = nmFresh('hdg') ? nmea.live.hdg : nmFresh('cog') ? nmea.live.cog : null; if (h != null && o.twd == null) nmSet('twd', ((h + o.twa) % 360 + 360) % 360); }
  if (o.lat != null && o.lon != null) { nmSet('lat', o.lat); nmSet('lon', o.lon); pos = true; }
  nmAfter(pos);
}

/* ---------- Signal K ---------- */
const SK_MAP = {
  'navigation.speedOverGround': ['sog', nmKn], 'navigation.courseOverGroundTrue': ['cog', nmDeg],
  'navigation.headingTrue': ['hdg', nmDeg], 'navigation.speedThroughWater': ['stw', nmKn],
  'environment.wind.speedApparent': ['aws', nmKn], 'environment.wind.angleApparent': ['awa', (r) => r * 180 / Math.PI],
  'environment.wind.speedTrue': ['tws', nmKn], 'environment.wind.directionTrue': ['twd', nmDeg],
  'environment.wind.angleTrueWater': ['twa', (r) => r * 180 / Math.PI],
  'environment.depth.belowTransducer': ['depth', (m) => m], 'environment.depth.belowSurface': ['depth', (m) => m],
  'environment.water.temperature': ['wtemp', (k) => k - 273.15],
};
function nmApplySK(msg) {
  if (!msg || !Array.isArray(msg.updates)) { if (msg && msg.name && msg.version) nmea.server = `${msg.name} ${msg.version}`; return; }
  let pos = false;
  for (const u of msg.updates) for (const v of u.values || []) {
    if (v.path === 'navigation.position' && v.value) { nmSet('lat', v.value.latitude); nmSet('lon', v.value.longitude); pos = true; continue; }
    if (v.path === 'navigation.headingMagnetic' && !nmFresh('hdg')) { nmSet('hdg', nmDeg(v.value)); continue; }
    const m = SK_MAP[v.path]; if (m && typeof v.value === 'number') nmSet(m[0], m[1](v.value));
  }
  if (nmFresh('twa') && !nmFresh('twd')) { const h = nmFresh('hdg') ? nmea.live.hdg : nmFresh('cog') ? nmea.live.cog : null; if (h != null) nmSet('twd', ((h + nmea.live.twa) % 360 + 360) % 360); }
  nmAfter(pos);
}

/* ---------- Connexion ---------- */
function nmConnect() {
  nmDisconnect(true);
  const url = (settings.nmeaUrl || '').trim();
  if (!url) { nmea.status = 'err'; nmea.err = 'Indiquez d’abord l’adresse du serveur.'; return nmDraw(); }
  nmea.on = true; nmea.status = 'wait'; nmea.err = ''; nmDraw();
  let ws;
  try { ws = new WebSocket(url); }
  catch (e) {
    nmea.status = 'err';
    nmea.err = location.protocol === 'https:' && /^ws:/i.test(url) ? 'Le navigateur bloque une adresse ws:// depuis une appli sécurisée (https). Utilisez wss:// (voir étape 5).' : 'Adresse refusée par le navigateur : vérifiez-la.';
    nmea.on = false; return nmDraw();
  }
  nmea.ws = ws;
  ws.onopen = () => { nmea.status = 'ok'; nmea.err = ''; nmea.n = 0; nmDraw(); toast('📡 Instruments connectés'); };
  ws.onmessage = (ev) => {
    nmea.n++;
    const t = typeof ev.data === 'string' ? ev.data : '';
    if (!t) return;
    if (t[0] === '{') { try { nmApplySK(JSON.parse(t)); } catch (e) {} return; }
    for (const l of t.split(/\r?\n/)) nmApply0183(nmParse0183(l));
  };
  ws.onerror = () => { nmea.err = location.protocol === 'https:' && /^ws:/i.test(url) ? 'Connexion bloquée : depuis une appli en https, il faut souvent wss:// (voir étape 5).' : 'Connexion impossible : téléphone sur le Wi-Fi du bateau ? adresse et port justes ?'; };
  ws.onclose = () => {
    if (nmea.ws !== ws) return;
    nmea.ws = null;
    if (nmea.status === 'ok') nmea.err = 'Connexion perdue, nouvel essai…';
    nmea.status = nmea.on ? 'wait' : 'off';
    nmDraw();
    if (nmea.on) { clearTimeout(nmea.retry); nmea.retry = setTimeout(() => { if (nmea.on) nmConnect(); }, 8000); }
  };
}
function nmDisconnect(keepOn) {
  clearTimeout(nmea.retry);
  if (!keepOn) { nmea.on = false; nmea.status = 'off'; nmea.err = ''; }
  const ws = nmea.ws; nmea.ws = null;
  if (ws) try { ws.close(); } catch (e) {}
  nmDraw();
}

/* ---------- Fiche ---------- */
function nmCells() {
  const L = nmea.live, v = (k, s) => (nmFresh(k) ? s : '–');
  const w = window.nmeaWind();
  return [
    ['Position', nmFresh('lat') ? fmtPos({ lat: L.lat, lon: L.lon }) : '–'],
    ['Vitesse fond', v('sog', `${fr(L.sog)} nd`)], ['Cap fond', v('cog', `${pad(Math.round(L.cog) % 360, 3)}°`)],
    ['Vitesse surface', v('stw', `${fr(L.stw)} nd`)], ['Cap compas', v('hdg', `${pad(Math.round(L.hdg) % 360, 3)}°`)],
    ['Vent apparent', nmFresh('aws') ? `${fr(L.aws)} nd · ${Math.round(Math.abs(L.awa || 0))}° ${(L.awa || 0) < 0 ? 'bâbord' : 'tribord'}` : '–'],
    ['Vent réel', w ? `${fr(w.tws)} nd · du ${pad(Math.round(w.twd) % 360, 3)}°` : '–'],
    ['Profondeur', v('depth', `${fr(L.depth)} m`)], ['Eau', v('wtemp', `${fr(L.wtemp)} °C`)],
  ];
}
function nmDraw() {
  const st = document.getElementById('nmStatus');
  if (st) {
    const lab = { off: '⚪ Non connecté', wait: '🟠 Connexion en cours…', ok: '🟢 Connecté', err: '🔴 Erreur' }[nmea.status] || '';
    st.innerHTML = `<b>${esc(lab)}</b>${nmea.status === 'ok' ? `<small>${nmea.n} messages${nmea.server ? ' · ' + esc(nmea.server) : ''}</small>` : ''}${nmea.err ? `<small class="nm-err">${esc(nmea.err)}</small>` : ''}`;
    const b = document.getElementById('nmGo'); if (b) b.textContent = nmea.on ? '⏹ Déconnecter' : '📡 Se connecter';
  }
  const g = document.getElementById('nmLive');
  if (g) g.innerHTML = nmCells().map(([k, x]) => `<div><small>${esc(k)}</small><b>${esc(x)}</b></div>`).join('');
}
const NM_STEPS = [
  ['Le matériel à bord', 'Il faut une passerelle NMEA Wi-Fi (boîtier relié aux instruments, ou traceur avec Wi-Fi) et un serveur Signal K. Certaines passerelles l’intègrent ; sinon un petit ordinateur Raspberry Pi avec OpenPlotter (gratuit) le fait.'],
  ['Pourquoi Signal K', 'Une appli web ne peut pas lire les flux NMEA bruts (TCP ou UDP, port 10110 ou 2000 par exemple). Signal K reçoit ces flux et les republie dans une forme que NavIn sait lire (WebSocket).'],
  ['Se mettre sur le Wi-Fi du bateau', 'Réglages du téléphone › Wi-Fi : choisissez le réseau du bateau (nom et mot de passe sur le boîtier ou dans son manuel). Ce réseau n’a souvent pas internet : c’est normal, les cartes hors ligne restent disponibles.'],
  ['L’adresse du serveur', 'Elle est affichée par le serveur Signal K (par exemple 192.168.1.10 ou 10.10.10.1). Adresse à saisir ci-dessus : ws://ADRESSE:3000/signalk/v1/stream?subscribe=all'],
  ['Connexion sécurisée (souvent obligatoire)', 'NavIn étant une appli sécurisée (https), Safari et Chrome bloquent souvent ws://. Dans Signal K, activez SSL (port 3443) ; ouvrez une fois https://ADRESSE:3443 dans le navigateur et acceptez le certificat ; puis saisissez wss://ADRESSE:3443/signalk/v1/stream?subscribe=all'],
  ['Ce que NavIn reçoit', 'Position, vitesse et cap du bateau remplacent le GPS du téléphone (carte et journal automatique). Le vent réel des instruments est ajouté aux entrées automatiques. Profondeur, vitesse surface et température de l’eau sont affichées ici.'],
  ['Sans connexion directe', 'Enregistrez le flux NMEA dans un fichier (traceur, OpenCPN, enregistreur Signal K) puis importez-le ci-dessous en fin de navigation, comme une trace GPX.'],
];
VIEWS.nmea = function renderNmea() {
  const main = $('#view');
  main.innerHTML = `
    <h1>📡 Instruments du bateau</h1>
    <section class="field nm-box">
      <div class="nm-status" id="nmStatus"></div>
      <label class="cf"><span>Adresse du serveur Signal K</span>
        <input class="text" id="nmUrl" type="url" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="wss://192.168.1.10:3443/signalk/v1/stream?subscribe=all" value="${esc(settings.nmeaUrl || '')}"></label>
      <div class="row"><button type="button" class="btn big primary" id="nmGo">📡 Se connecter</button></div>
      <div class="nm-live" id="nmLive"></div>
    </section>
    <h2 class="sub-h">Mode d’emploi</h2>
    <ol class="nm-steps">${NM_STEPS.map(([h, t]) => `<li><b>${esc(h)}</b><p class="nm-txt">${esc(t)}</p></li>`).join('')}</ol>
    <h2 class="sub-h">Importer un fichier NMEA</h2>
    <p class="help">Fichier NMEA 0183 enregistré à bord (.nmea, .log, .txt). NavIn crée les entrées comme pour une trace GPX : départ, arrivée, changements de cap, vent réel des instruments.</p>
    <div class="row"><button type="button" class="btn big" id="nmFileBtn">📂 Importer un fichier NMEA<small>${cruise ? 'dans la navigation en cours' : 'ouvrez d’abord une navigation'}</small></button></div>
    <input type="file" id="nmFile" accept=".nmea,.log,.txt,.n0183,text/plain" hidden>`;
  const u = $('#nmUrl');
  u.oninput = () => { settings.nmeaUrl = u.value.trim(); saveSettings(); };
  $('#nmGo').onclick = () => { buzz(); if (nmea.on) nmDisconnect(); else nmConnect(); };
  $('#nmFileBtn').onclick = () => $('#nmFile').click();
  $('#nmFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) nmImportFile(f); };
  nmDraw();
  clearInterval(nmea.tick); nmea.tick = setInterval(() => { if (!document.getElementById('nmLive')) return clearInterval(nmea.tick); nmDraw(); }, 2000);
};

/* ---------- Import d'un fichier ---------- */
function nmParseFile(text) {
  const pts = []; let dmy = null, cur = {}, lastHms = null;
  const T = (hms) => {
    if (!dmy || !hms) return NaN;
    return Date.UTC(2000 + Number(dmy.slice(4, 6)), Number(dmy.slice(2, 4)) - 1, Number(dmy.slice(0, 2)), Number(hms.slice(0, 2)), Number(hms.slice(2, 4)), Number(hms.slice(4)));
  };
  let pending = [];
  for (const line of text.split(/\r?\n/)) {
    const o = nmParse0183(line); if (!o) continue;
    if (o.dmy) { dmy = o.dmy; if (pending.length) { pending.forEach((p) => { p.t = T(p.hms); delete p.hms; }); pts.push(...pending.filter((p) => !Number.isNaN(p.t))); pending = []; } }
    for (const k of ['sog', 'cog', 'hdg', 'stw', 'aws', 'awa', 'tws', 'twd', 'twa']) if (o[k] != null) cur[k] = o[k];
    if (o.fix && o.lat != null && o.lon != null && o.hms && o.hms !== lastHms) {
      lastHms = o.hms;
      let twd = cur.twd, tws = cur.tws;
      const hdg = cur.hdg != null ? cur.hdg : cur.cog;
      if (twd == null && cur.twa != null && hdg != null) twd = ((hdg + cur.twa) % 360 + 360) % 360;
      if ((twd == null || tws == null) && cur.aws != null && cur.awa != null) { const t = nmTrueWind(cur.aws, cur.awa, cur.stw != null ? cur.stw : cur.sog, hdg); if (t) { if (tws == null) tws = t.tws; if (twd == null) twd = t.twd; } }
      const p = { hms: o.hms, lat: o.lat, lon: o.lon, sog: o.sog != null ? Math.round(o.sog * 10) / 10 : cur.sog != null ? Math.round(cur.sog * 10) / 10 : null, cog: (o.cog != null ? o.cog : cur.cog) != null ? Math.round(o.cog != null ? o.cog : cur.cog) % 360 : null, twd: twd != null ? Math.round(twd) % 360 : null, tws: tws != null ? Math.round(tws * 10) / 10 : null };
      if (dmy) { p.t = T(p.hms); delete p.hms; if (!Number.isNaN(p.t)) pts.push(p); } else pending.push(p);
    }
  }
  // Passage de minuit : l'heure recule sans nouvelle date, on ajoute un jour.
  for (let i = 1; i < pts.length; i++) if (pts[i].t < pts[i - 1].t - 3600000) pts[i].t += 86400000;
  return { pts, name: '' };
}
async function nmImportFile(file) {
  if (!cruise) return toast('Ouvrez d’abord une navigation');
  let parsed;
  try { parsed = nmParseFile(await file.text()); } catch (e) { return toast('Fichier NMEA illisible'); }
  if (parsed.pts.length < 2) return toast('Aucune position datée (phrases RMC) dans ce fichier');
  parsed.name = file.name;
  importGpxFile(file, parsed);
}

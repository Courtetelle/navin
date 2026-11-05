'use strict';

/* =====================================================================
   Journal semi-automatique : suivi GPS, import de traces GPX,
   météo du modèle Open-Meteo (gratuit, sans clé, si réseau).
   ===================================================================== */

/* ---------- Géométrie ---------- */
const R_NM = 3440.065;
const rad = (x) => (x * Math.PI) / 180;
function distNM(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearing(a, b) {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/* ---------- Détection des points clés d'une trace ----------
   Même logique pour le suivi en direct et pour l'import GPX :
   départ, changement de cap durable (virement / empannage si le vent est connu),
   changement d'allure, une entrée par intervalle, arrivée. */
function newDetector(opts) {
  return { turn: opts.turn, every: opts.every, splitGap: opts.splitGap || 0, buf: [], ref: null, refSide: 0, pendSince: null,
    refAllure: null, allurePend: null, allureSince: null, lastEntryT: null, dist: 0, lastPt: null, lastCog: null, lastSog: null, lastTwd: null, lastTws: null };
}
// Vent moyen sur la fenêtre (moyenne circulaire pour la direction).
function windOf(buf) {
  let x = 0, y = 0, sp = 0, k = 0;
  for (const p of buf) {
    if (p.twd == null || p.tws == null) continue;
    x += Math.cos(rad(p.twd)); y += Math.sin(rad(p.twd)); sp += p.tws; k++;
  }
  if (!k) return null;
  return { twd: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360) % 360, tws: Math.round((sp / k) * 10) / 10 };
}
const twaSigned = (twd, cog) => ((twd - cog + 540) % 360) - 180;
function detectorPush(s, p) {
  const ev = [];
  const mk = (kind, pt, cog, sog) => ({ kind, t: pt.t, lat: pt.lat, lon: pt.lon, cog: cog ?? s.lastCog, sog: sog ?? s.lastSog, dist: s.dist, twd: s.lastTwd, tws: s.lastTws });
  if (p.twd != null && p.tws != null) { s.lastTwd = Math.round(p.twd) % 360; s.lastTws = Math.round(p.tws * 10) / 10; }
  if (!s.lastPt) {
    s.lastPt = p; s.buf = [p]; s.lastEntryT = p.t;
    ev.push(mk('Départ', p, p.cog, p.sog));
    return ev;
  }
  const dt = p.t - s.lastPt.t;
  // Longue interruption dans une trace importée : arrivée puis nouveau départ.
  if (s.splitGap && dt > s.splitGap) {
    ev.push(mk('Arrivée', s.lastPt, null, 0));
    Object.assign(s, { buf: [p], ref: null, refSide: 0, pendSince: null, refAllure: null, allurePend: null, lastPt: p, lastEntryT: p.t, lastSog: null, lastCog: null });
    ev.push(mk('Départ', p, p.cog, p.sog));
    return ev;
  }
  const d = distNM(s.lastPt, p);
  if (d < 0.003 && dt < 60000) return ev; // moins de 5 m : on ignore
  if (dt > 0 && d / (dt / 3600000) < 40) s.dist += d; // saut GPS aberrant : non compté
  s.lastPt = p;
  s.buf.push(p);
  while (s.buf.length > 2 && p.t - s.buf[1].t >= 90000) s.buf.shift();
  const q = s.buf[0];
  if (p.t - q.t >= 90000) {
    const dw = distNM(q, p);
    const w = windOf(s.buf);
    if (w) { s.lastTwd = w.twd; s.lastTws = w.tws; }
    if (dw >= 0.04) {
      const b = bearing(q, p);
      s.lastCog = Math.round(b) % 360;
      s.lastSog = Math.round((dw / ((p.t - q.t) / 3600000)) * 10) / 10;
      const twa = w ? twaSigned(w.twd, b) : null;
      const side = twa == null ? 0 : Math.sign(twa);
      const allure = twa != null && s.lastSog > 1.5 ? allureFromTwa(Math.abs(twa)) : null;
      if (s.ref == null) { s.ref = b; s.refSide = side; s.refAllure = allure; }
      else if (angDiff(b, s.ref) > s.turn) {
        if (s.pendSince == null) s.pendSince = p.t;
        else if (p.t - s.pendSince >= 120000) {
          // Le vent change de bord : virement (vent devant) ou empannage (vent arrière).
          const kind = side && s.refSide && side !== s.refSide ? (Math.abs(twa) < 100 ? 'Virement' : 'Empannage') : 'Changement de cap';
          ev.push(mk(kind, p));
          s.ref = b; s.refSide = side; s.refAllure = allure; s.pendSince = null; s.allurePend = null; s.lastEntryT = p.t;
        }
      } else {
        s.pendSince = null;
        // Changement d'allure tenu 3 minutes (vent qui tourne ou cap ajusté peu à peu).
        if (allure && s.refAllure && allure !== s.refAllure) {
          if (s.allurePend !== allure) { s.allurePend = allure; s.allureSince = p.t; }
          else if (p.t - s.allureSince >= 180000 && p.t - s.lastEntryT >= 600000) {
            ev.push(mk('Changement d’allure', p));
            s.refAllure = allure; s.ref = b; s.refSide = side; s.allurePend = null; s.lastEntryT = p.t;
          }
        } else { s.allurePend = null; if (allure && !s.refAllure) s.refAllure = allure; }
      }
    } else if (dw < 0.01) s.lastSog = 0;
  }
  if (p.t - s.lastEntryT >= s.every * 60000) { ev.push(mk(null, p)); s.lastEntryT = p.t; }
  return ev;
}

/* ---------- Choix des entrées à garder ----------
   Le détecteur propose beaucoup de candidats (manœuvres + un point toutes les 10 min).
   On n'en garde qu'un petit nombre, réparti sur la navigation : environ une par heure,
   proportionnellement moins quand la navigation est longue. */
const TICK_MIN = 10;
function entryBudget(hours) {
  // Sur le lac : 2 entrées par heure pour une sortie courte, 1 par heure dès 3 heures.
  if (isLake()) return Math.max(0, Math.min(12, hours < 3 ? Math.round(hours * 2) : Math.round(hours)));
  const h = hours * (settings.autoPerHour || 1);
  return Math.max(0, Math.min(12, h <= 4 ? Math.floor(h) : 4 + Math.floor((h - 4) / 2)));
}
function selectLeg(dep, mids, arr) {
  const dur = arr.t - dep.t;
  const b = entryBudget(dur / 3600000);
  const out = [];
  if (b > 0) {
    const slot = dur / (b + 1);
    for (let k = 1; k <= b; k++) {
      const target = dep.t + k * slot;
      const inWin = mids.filter((m) => Math.abs(m.t - target) <= slot / 2 && !out.includes(m));
      // Une manœuvre (virement, changement de cap…) est préférée à un simple point.
      const man = inWin.filter((m) => m.kind);
      const pool = man.length ? man : inWin;
      if (!pool.length) continue;
      pool.sort((a, z) => Math.abs(a.t - target) - Math.abs(z.t - target));
      out.push(pool[0]);
    }
  }
  arr.note = `Navigation ${fmtDur(dur)} · ${fr(arr.dist - dep.dist)} NM`;
  return [dep, ...out.sort((a, z) => a.t - z.t), arr];
}
function legsFromEvents(evs) {
  const legs = [];
  let cur = null;
  for (const ev of evs) {
    if (ev.kind === 'Départ') cur = { dep: ev, mids: [] };
    else if (ev.kind === 'Arrivée' && cur) { legs.push({ ...cur, arr: ev }); cur = null; }
    else if (cur) cur.mids.push(ev);
  }
  return legs;
}

/* ---------- Trace enregistrée (compacte) ---------- */
const trackKey = () => 'ldb.track.' + cruise.id;
const loadTrack = () => (cruise ? store.get(trackKey(), []) : []); // [[t, lat, lon], …]
const saveTrack = (t) => store.set(trackKey(), t);
function trackToGpx(track, name) {
  const pts = track.map(([t, lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"><time>${new Date(t).toISOString()}</time></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${esc(name || cruise.info.name || 'NavIn')}</name><trkseg>
${pts}
</trkseg></trk></gpx>`;
}

/* ---------- Météo : mesures MeteoSwiss, modèle MeteoSwiss, sinon modèle européen ----------
   Chaque valeur garde sa source (v.wxSrc), affichée dans le journal et la fiche. */
const wxCache = new Map();
const inSwissModel = (lat, lon) => lat > 45.6 && lat < 48 && lon > 5.8 && lon < 10.7;
const WX_SRC = {
  ch1: 'Prévision MeteoSwiss ICON-CH1 (via Open-Meteo)',
  ch2: 'Prévision MeteoSwiss ICON-CH2 (via Open-Meteo)',
  eu: 'Prévision modèle européen (Open-Meteo)',
};
async function wxDay(lat, lon, day) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${day}`;
  if (wxCache.has(key)) return wxCache.get(key);
  const ageDays = (Date.now() - new Date(day + 'T00:00:00Z').getTime()) / 86400000;
  const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${day}&end_date=${day}&timezone=GMT`;
  const vars = 'hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,temperature_2m,precipitation,cape&wind_speed_unit=kn';
  const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const filled = (j) => j && j.hourly && (j.hourly.wind_speed_10m || []).some((x) => x != null);
  let a = null, src = 'eu';
  // Sur le lac et en Suisse : le modèle de MeteoSwiss d'abord (CH1 ~1 km, puis CH2 ~2 km).
  if (ageDays < 30 && ageDays > -5 && inSwissModel(lat, lon)) {
    for (const m of ['ch1', 'ch2']) {
      try { const j = await get(`https://api.open-meteo.com/v1/forecast?${q}&${vars}&models=meteoswiss_icon_${m}`); if (filled(j)) { a = j; src = m; break; } } catch { /* modèle suivant */ }
    }
  }
  if (!a) a = await get(`${ageDays > 80 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast'}?${q}&${vars}`);
  const m = isLake() ? null : await fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height,wave_direction`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const res = { a: a.hourly, m: m && m.hourly, src: WX_SRC[src] };
  wxCache.set(key, res);
  return res;
}

/* Mesures des stations MeteoSwiss (données ouvertes SwissMetNet, toutes les 10 min, heure UTC). */
const SMN_BASE = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/';
// Stations du bord du Léman (liste complétée par celle de MeteoSwiss quand il y a du réseau).
const SMN_LAKE = [['CGI', 'Nyon / Changins', 46.401053, 6.227722, 458], ['GVE', 'Genève / Cointrin', 46.247519, 6.127742, 411], ['BOU', 'Bouveret', 46.393447, 6.857006, 374]];
async function smnStations() {
  const kept = store.get('ldb.smn.stations2', null);
  if (kept && Date.now() - kept.at < 30 * 86400000) return kept.list;
  try {
    const txt = new TextDecoder('windows-1252').decode(await (await fetch(SMN_BASE + 'ogd-smn_meta_stations.csv')).arrayBuffer());
    const rows = txt.trim().split(/\r?\n/).map((l) => l.split(';'));
    const h = rows.shift();
    const c = (n) => h.indexOf(n);
    const list = rows.map((r) => [r[c('station_abbr')], r[c('station_name')], Number(r[c('station_coordinates_wgs84_lat')]), Number(r[c('station_coordinates_wgs84_lon')]), Number(r[c('station_height_masl')]) || 0]).filter((x) => x[0] && Number.isFinite(x[2]));
    if (list.length) { store.set('ldb.smn.stations2', { at: Date.now(), list }); return list; }
  } catch { /* liste intégrée */ }
  return kept ? kept.list : SMN_LAKE;
}
const smnCache = new Map();
async function smnNow(abbr) {
  const hit = smnCache.get(abbr);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.rows;
  const a = abbr.toLowerCase();
  const txt = new TextDecoder('windows-1252').decode(await (await fetch(`${SMN_BASE}${a}/ogd-smn_${a}_t_now.csv`)).arrayBuffer());
  const lines = txt.trim().split(/\r?\n/).map((l) => l.split(';'));
  const h = lines.shift();
  const rows = lines.map((r) => {
    const o = {};
    h.forEach((k, i) => { o[k] = r[i] === '' || r[i] == null ? null : r[i]; });
    const [d, mo, y, hh, mi] = (o.reference_timestamp || '').split(/[. :]/).map(Number);
    o.t = Date.UTC(y, mo - 1, d, hh, mi);
    return o;
  }).filter((o) => Number.isFinite(o.t));
  smnCache.set(abbr, { at: Date.now(), rows });
  return rows;
}
// Station la plus proche (25 km au plus) et sa mesure la plus proche de l'heure demandée (30 min au plus).
async function smnMeasure(lat, lon, date) {
  const st = (await smnStations()).map((x) => [x[0], x[1], distKm(lat, lon, x[2], x[3])]).filter((x) => x[2] < 25).sort((x, y) => x[2] - y[2]);
  for (const [abbr, name, km] of st.slice(0, 3)) {
    try {
      const rows = await smnNow(abbr);
      const t = date.getTime();
      const r = rows.filter((o) => o.fu3010z0 != null).sort((x, y) => Math.abs(x.t - t) - Math.abs(y.t - t))[0];
      if (!r || Math.abs(r.t - t) > 30 * 60000) continue;
      const kn = (v) => (v == null ? null : Number(v) / 1.852);
      return {
        tws: kn(r.fu3010z0), gust: kn(r.fu3010z1), twd: r.dkl010z0 == null ? null : Number(r.dkl010z0),
        baro: r.pp0qffs0 == null ? null : Number(r.pp0qffs0), air: r.tre200s0 == null ? null : Number(r.tre200s0),
        rain: r.rre150z0 == null ? null : Number(r.rre150z0), at: r.t, station: name, km,
        src: `Mesure MeteoSwiss, station ${name} (${Math.round(km)} km), ${fmtTime(new Date(r.t))}`,
      };
    } catch { /* station suivante */ }
  }
  return null;
}
// Prévision des prochaines heures à la position (MeteoSwiss d'abord, sinon modèle européen).
async function wxNext(lat, lon, hours) {
  const q = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&forecast_hours=${hours}&timezone=GMT&wind_speed_unit=kn&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,cape`;
  const tries = inSwissModel(lat, lon) ? [['ch1', '&models=meteoswiss_icon_ch1'], ['ch2', '&models=meteoswiss_icon_ch2'], ['eu', '']] : [['eu', '']];
  for (const [k, m] of tries) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}${m}`);
      if (!r.ok) continue;
      const h = (await r.json()).hourly;
      if (!h || !(h.wind_speed_10m || []).some((x) => x != null)) continue;
      return { src: WX_SRC[k], rows: h.time.map((t, i) => ({ t: Date.parse(t + 'Z'), tws: h.wind_speed_10m[i], twd: h.wind_direction_10m[i], gust: h.wind_gusts_10m[i], air: h.temperature_2m[i], rain: h.precipitation[i], cape: h.cape ? h.cape[i] : null })) };
    } catch { /* source suivante */ }
  }
  return null;
}
async function fetchWeather(lat, lon, date) {
  // Au lac : la mesure réelle de la station la plus proche si elle existe pour ce moment.
  if (isLake() && Date.now() - date.getTime() < 30 * 3600000) {
    const ms = await smnMeasure(lat, lon, date).catch(() => null);
    if (ms) return Object.assign(ms, { waveDir: null, waveH: null });
  }
  const day = date.toISOString().slice(0, 10);
  const { a, m, src } = await wxDay(lat, lon, day);
  const h = Math.min(23, Math.round(date.getUTCHours() + date.getUTCMinutes() / 60));
  const pick = (arr) => (arr && arr[h] != null ? arr[h] : null);
  return {
    twd: pick(a.wind_direction_10m), tws: pick(a.wind_speed_10m), gust: pick(a.wind_gusts_10m), baro: pick(a.pressure_msl), air: pick(a.temperature_2m),
    cape: pick(a.cape), waveDir: m ? pick(m.wave_direction) : null, waveH: m ? pick(m.wave_height) : null, src,
  };
}
function douglasFromHeight(hm) {
  const lim = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];
  let i = 0;
  while (i < lim.length && hm > lim[i]) i++;
  return String(Math.min(9, i));
}
function allureFromTwa(twa) {
  if (twa < 45) return 'Près serré';
  if (twa < 60) return 'Près';
  if (twa < 80) return 'Bon plein';
  if (twa < 105) return 'Travers';
  if (twa < 135) return 'Largue';
  if (twa < 165) return 'Grand largue';
  return 'Vent arrière';
}
// Ne remplace jamais une valeur saisie à la main.
function applyWeather(v, w) {
  if (isLake()) { delete w.waveDir; delete w.waveH; }
  if (w.twd != null && v.twd == null) v.twd = Math.round(w.twd) % 360;
  if (w.tws != null && v.tws == null) v.tws = Math.round(w.tws);
  if (w.baro != null && v.baro == null) v.baro = Math.round(w.baro);
  if (w.waveDir != null && v.vagues == null) v.vagues = Math.round(w.waveDir) % 360;
  if (w.waveH != null && v.mer == null) v.mer = douglasFromHeight(w.waveH);
  if (w.src && (w.twd != null || w.tws != null || w.baro != null)) v.wxSrc = w.src;
  if (v.allure == null && v.cog != null && v.twd != null && (v.sog == null || v.sog > 1)) v.allure = allureFromTwa(angDiff(v.twd, v.cog));
}
async function enrichEntry(e) {
  const p = e.v.pos;
  if (!p || p.text) return false;
  const w = await fetchWeather(p.lat, p.lon, new Date(e.t));
  applyWeather(e.v, w);
  e.wx = true;
  delete e.needWx;
  return true;
}
async function fillPendingWeather(btn) {
  const list = cruise.entries.filter((e) => e.needWx);
  if (!navigator.onLine) return toast('Pas de réseau pour le moment');
  btn.disabled = true;
  let ok = 0;
  for (const [i, e] of list.entries()) {
    btn.textContent = `⏳ Météo ${i + 1} / ${list.length}…`;
    try { if (await enrichEntry(e)) ok++; } catch {}
  }
  saveCruise();
  toast(`Météo ajoutée à ${ok} entrée${ok > 1 ? 's' : ''}`);
  VIEWS.log();
}

/* ---------- Entrées automatiques ---------- */
function lochBefore(t) {
  const prev = cruise.entries.filter((e) => e.t <= t && num(e.v.loch) != null);
  return prev.length ? num(prev[prev.length - 1].v.loch) : 0;
}
function autoEntryFrom(ev, lochBase) {
  const v = carriedValues(NAV_KEYS);
  v.pos = { lat: ev.lat, lon: ev.lon };
  if (ev.sog != null) v.sog = ev.sog;
  if (ev.cog != null) v.cog = ev.cog;
  v.loch = Math.round((lochBase + ev.dist) * 10) / 10;
  if (ev.kind) v.evt = [ev.kind];
  if (ev.kind === 'Arrivée') v.sog = 0;
  if (ev.note) v.note = ev.note;
  const e = { id: uid(), t: new Date(ev.t).toISOString(), v, auto: true, needWx: true };
  if (ev.twd != null && ev.tws != null) { v.twd = ev.twd; v.tws = Math.round(ev.tws); e.windSrc = 'trace'; }
  return e;
}
async function addAutoEntry(ev, lochBase) {
  const e = autoEntryFrom(ev, lochBase);
  addEntry(e);
  if (settings.autoWeather && navigator.onLine) {
    try { if (await enrichEntry(e)) saveCruise(); } catch {}
  }
  return e;
}

/* ---------- Suivi GPS en direct ---------- */
let tracking = false;
let watchId = null;
let lastFix = null;
let gpsDenied = false;
let trip = null; // { start, lochBase, det, dep, cands }
let trackBuf = null;
const tripKey = () => 'ldb.trip.' + cruise.id;
const saveTrip = () => store.set(tripKey(), trip);
const lastTripKey = () => 'ldb.lastTrip.' + cruise.id;
// Prolonger la trace précédente (Corban, 2026-10-31, v88) : on reprend le même trajet, le trou est relié en ligne droite.
function extendLastTrip() {
  const t = store.get(lastTripKey(), null);
  if (!t) return startTracking(false);
  trip = t; trip.cands = []; delete trip.end;
  store.del(lastTripKey());
  startTracking(true);
  addEntry({ id: uid(), t: new Date().toISOString(), auto: true, v: { note: 'Reprise de la trace précédente' } });
}

function startTracking(resume, auto) {
  if (!('geolocation' in navigator)) return toast('GPS non disponible sur cet appareil');
  if (!resume) {
    const from = loadTrack().length;
    if (from > 0) { const k = 'ldb.trkSegs.' + cruise.id; const sg = store.get(k, []); if (!sg.includes(from)) store.set(k, sg.concat(from)); }
    trip = { start: Date.now(), from, lochBase: lochBefore(new Date().toISOString()), det: newDetector({ turn: settings.autoTurn, every: TICK_MIN }), dep: null, cands: [] };
  } else {
    trip.det.turn = settings.autoTurn; trip.det.buf = []; trip.cands = trip.cands || [];
  }
  saveTrip();
  trackBuf = loadTrack();
  tracking = true;
  applyWake();
  startWatch();
  toast(auto ? '🛰 Enregistrement de la trace repris' : resume ? 'Suivi repris' : 'Suivi démarré : l’entrée de départ sera créée au premier point GPS');
  refreshAutoCard();
}

// Simulation pour l'aperçu sans GPS (Corban, 2026-11-01, v100) : un bateau fictif part de Morges vers le sud-ouest à 5 nd.
let simGps = false, simTimer = null;
function startSim() {
  clearInterval(simTimer);
  let k = 0, t = Date.now();
  const step = () => { k++; t += 10000; onFix({ timestamp: t, coords: { latitude: 46.505 - k * 0.00025, longitude: 6.497 - k * 0.0003, accuracy: 5, speed: 2.6, heading: 222 } }); };
  step(); simTimer = setInterval(step, 2000);
}
function startWatch() {
  if (simGps) return startSim();
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(onFix, (err) => {
    if (err.code === 1) {
      // GPS refusé : la trace ne peut pas s'enregistrer ; on le dit clairement et durablement (v98).
      gpsDenied = true; stopTracking(false);
      toast('📍 Localisation refusée : trace impossible');
      if (typeof drawTrkButtons === 'function') drawTrkButtons();
    }
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 60000 });
}
// Appli quittée par mégarde pendant l'enregistrement (Corban, 2026-10-31, v86) : une page web ne peut pas
// lire le GPS appli fermée ; au retour, l'enregistrement reprend tout seul et le trou est complété en ligne droite.
// Seul « Arrivée » (arrêt manuel) termine la trace.
function autoResumeTrip() {
  if (!cruise || tracking || !('geolocation' in navigator)) return;
  const t = store.get(tripKey(), null);
  if (!t) return;
  trip = t;
  startTracking(true, true);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (tracking && trackBuf) { saveTrack(trackBuf); saveTrip(); } return; }
  if (tracking) startWatch(); else autoResumeTrip();
});
window.addEventListener('pagehide', () => { if (tracking && trackBuf) { saveTrack(trackBuf); saveTrip(); } });
const GAP_MS = 3 * 60000;
function noteGap(last, pt) {
  const from = new Date(last[0]), to = new Date(pt.t);
  const nm = distNM({ lat: last[1], lon: last[2] }, pt);
  (trip.gaps = trip.gaps || []).push({ from: last[0], to: pt.t, nm: Math.round(nm * 100) / 100 });
  addEntry({ id: uid(), t: to.toISOString(), auto: true, v: { pos: { lat: pt.lat, lon: pt.lon }, note: `Trace interrompue de ${fmtTime(from)} à ${fmtTime(to)} (appli fermée ou en arrière-plan) : ${fr(nm)} NM complétés en ligne droite.` } });
  toast(`🛰 Trace complétée : ${fmtDur(pt.t - last[0])} sans GPS, ${fr(nm)} NM en ligne droite`);
}
function onFix(p) {
  gpsDenied = false;
  if (!tracking) return;
  // v409 : instruments du bateau connectés (nmea.js) : leur position prime sur le GPS du téléphone.
  if (!p.nmea && window.nmeaPosFresh && window.nmeaPosFresh()) return;
  const c = p.coords;
  if (c.accuracy > 60) return;
  const pt = { t: p.timestamp || Date.now(), lat: c.latitude, lon: c.longitude,
    sog: c.speed != null && !Number.isNaN(c.speed) ? Math.round(c.speed * 19.4384) / 10 : null,
    cog: c.heading != null && !Number.isNaN(c.heading) && c.speed > 0.5 ? Math.round(c.heading) % 360 : null };
  lastFix = { lat: pt.lat, lon: pt.lon, at: new Date(pt.t).toISOString() };
  { const w = window.nmeaWind && window.nmeaWind(); if (w) { pt.twd = Math.round(w.twd) % 360; pt.tws = Math.round(w.tws * 10) / 10; } }
  const last = trackBuf[trackBuf.length - 1];
  if (last && trip && trip.det.lastPt && pt.t - last[0] > GAP_MS) noteGap(last, pt);
  if (!last || pt.t - last[0] >= 10000) {
    trackBuf.push([pt.t, Math.round(pt.lat * 1e6) / 1e6, Math.round(pt.lon * 1e6) / 1e6]);
    if (trackBuf.length % 6 === 0) saveTrack(trackBuf);
  }
  const evs = detectorPush(trip.det, pt);
  for (const ev of evs) {
    // Seul le départ est noté tout de suite ; les autres points sont choisis à l'arrivée.
    if (ev.kind === 'Départ') { trip.dep = ev; addAutoEntry(ev, trip.lochBase); buzz(); toast('🛰 Départ enregistré'); }
    else trip.cands.push(ev);
  }
  if (evs.length || trackBuf.length % 6 === 0) saveTrip();
  refreshAutoCard();
}

async function stopTracking(withArrival) {
  clearInterval(simTimer); simTimer = null;
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  tracking = false;
  if (typeof windMuteEnd === 'function') windMuteEnd(); // v423 (Corban) : fin de la trace = alertes de vent de nouveau actives
  if (trackBuf) saveTrack(trackBuf);
  if (withArrival && trip && trip.det.lastPt && trip.dep) {
    const lp = trip.det.lastPt;
    const arr = { kind: 'Arrivée', t: Date.now(), lat: lp.lat, lon: lp.lon, cog: null, sog: 0, dist: trip.det.dist, twd: trip.det.lastTwd, tws: trip.det.lastTws };
    const leg = selectLeg(trip.dep, trip.cands || [], arr).slice(1);
    for (const ev of leg) await addAutoEntry(ev, trip.lochBase);
    toast(`Arrivée : ${arr.note}`);
  }
  if (withArrival && trip) { trip.end = Date.now(); store.set(lastTripKey(), trip); }
  if (withArrival) store.del(tripKey());
  trip = null;
  applyWake();
  refreshAutoCard();
}

function refreshAutoCard() {
  if (currentView === 'new' && $('#autoCard')) renderAutoCard();
  if (currentView === 'tracker' && typeof trackerTick === 'function') trackerTick();
}

function renderAutoCard() {
  const box = $('#autoCard');
  if (!box) return;
  if (!tracking) trip = store.get(tripKey(), null);
  if (tracking && trip) {
    const dur = Date.now() - trip.start;
    box.innerHTML = `<section class="field autocard on">
      <h2><span>🛰 Journal automatique en route</span></h2>
      <div class="auto-stats">
        <div><b>${fr(trip.det.dist)}</b><small>NM</small></div>
        <div><b>${trip.det.lastSog != null ? fr(trip.det.lastSog) : '–'}</b><small>nd</small></div>
        <div><b>${trip.det.lastCog != null ? pad(trip.det.lastCog, 3) + '°' : '–'}</b><small>route fond</small></div>
      </div>
      <p class="help">Départ ${fmtTime(new Date(trip.start))} · en route depuis ${fmtDur(dur)}. À l’arrivée, le livre gardera environ ${entryBudget(dur / 3600000)} entrée(s) intermédiaire(s), de préférence aux changements de cap. Laissez l’appli ouverte, l’écran reste allumé. Si l’appli est quittée, l’enregistrement reprend au retour et le trou est complété en ligne droite.</p>
      <div class="row c2"><button class="btn" id="autoNow">Point maintenant</button><button class="btn danger" id="autoStop">■ Arrivée</button></div>
    </section>`;
    $('#autoNow').onclick = () => {
      buzz();
      const lp = trip.det.lastPt;
      if (!lp) return toast('En attente du premier point GPS');
      addAutoEntry({ kind: null, t: Date.now(), lat: lp.lat, lon: lp.lon, cog: trip.det.lastCog, sog: trip.det.lastSog, dist: trip.det.dist }, trip.lochBase);
      toast('Point enregistré');
    };
    $('#autoStop').onclick = (e) => armed(e.currentTarget, 'Toucher encore : arrivée', () => { buzz(); stopTracking(true); });
  } else if (trip) {
    box.innerHTML = `<section class="field autocard">
      <h2><span>🛰 Suivi interrompu</span></h2>
      <p class="help">Le suivi parti à ${fmtTime(new Date(trip.start))} a été interrompu (appli fermée ou écran éteint).</p>
      <div class="row c2"><button class="btn primary" id="autoResume">▶ Reprendre</button><button class="btn" id="autoEnd">■ Arrivée</button></div>
    </section>`;
    $('#autoResume').onclick = () => { buzz(); startTracking(true); };
    $('#autoEnd').onclick = (e) => armed(e.currentTarget, 'Toucher encore : arrivée', () => { buzz(); stopTracking(true); });
  } else {
    box.innerHTML = `<div class="row" style="margin-bottom:16px"><button class="btn big auto-start" id="autoStart">🛰 Départ : journal automatique<small>${isLake() ? 'GPS du téléphone : heures, trace et milles notés seuls' : 'position, route, vitesse, loch et météo notés seuls'}</small></button></div>`;
    $('#autoStart').onclick = () => { buzz(); if (store.get(lastTripKey(), null)) { go('tracker'); return setTimeout(() => typeof trkChooseStart === 'function' && trkChooseStart(), 50); } startTracking(false); };
  }
  if (isLake()) {
    box.insertAdjacentHTML('beforeend', '<div class="row" style="margin-bottom:16px"><button class="btn big" id="goTracker">🧭 Traceur<small>carte, trace en direct, vitesse, cap, mes traces</small></button></div>');
    $('#goTracker').onclick = () => { buzz(); go('tracker'); };
  }
}

/* ---------- Import d'une trace GPX ---------- */
function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('xml');
  let nodes = [...doc.getElementsByTagName('trkpt')];
  if (!nodes.length) nodes = [...doc.getElementsByTagName('rtept')];
  const tag = (el, name) => { const x = [...el.getElementsByTagName('*')].find((c) => c.localName === name); return x ? x.textContent.trim() : null; };
  const pts = nodes.map((el) => {
    const t = tag(el, 'time');
    // NavimetriX : navx:sog (nœuds), navx:cog, navx:tws (nœuds), navx:twd. GPX standard : speed (m/s), course.
    const sogKn = num(tag(el, 'sog'));
    const speed = num(tag(el, 'speed'));
    const course = num(tag(el, 'cog')) ?? num(tag(el, 'course'));
    return { t: t ? Date.parse(t) : NaN, lat: Number(el.getAttribute('lat')), lon: Number(el.getAttribute('lon')),
      sog: sogKn != null ? Math.round(sogKn * 10) / 10 : speed != null ? Math.round(speed * 19.4384) / 10 : null,
      cog: course != null ? Math.round(course) % 360 : null, twd: num(tag(el, 'twd')), tws: num(tag(el, 'tws')) };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const name = (doc.getElementsByTagName('name')[0] || {}).textContent || '';
  return { pts, name };
}

async function importGpxFile(file, pre) {
  let parsed;
  try { parsed = pre || parseGpx(await file.text()); } catch { return toast('Fichier GPX illisible'); }
  const { pts } = parsed;
  if (pts.length < 2) return toast('Aucun point trouvé dans ce fichier');
  if (pts.some((p) => Number.isNaN(p.t))) return toast('Cette trace n’a pas d’heures : impossible de dater les entrées');
  pts.sort((a, b) => a.t - b.t);
  const det = newDetector({ turn: settings.autoTurn, every: TICK_MIN, splitGap: 45 * 60000 });
  const evs = [];
  for (const p of pts) evs.push(...detectorPush(det, p));
  const lp = det.lastPt;
  evs.push({ kind: 'Arrivée', t: lp.t, lat: lp.lat, lon: lp.lon, cog: null, sog: 0, dist: det.dist, twd: det.lastTwd, tws: det.lastTws });
  const legs = legsFromEvents(evs);
  const chosen = legs.flatMap((l) => selectLeg(l.dep, l.mids, l.arr));
  // Pas de doublon avec une entrée déjà présente à la même minute.
  const known = new Set(cruise.entries.map((e) => e.t.slice(0, 16)));
  const fresh = chosen.filter((ev) => !known.has(new Date(ev.t).toISOString().slice(0, 16)));
  const navMs = legs.reduce((sum, l) => sum + l.arr.t - l.dep.t, 0);
  const first = new Date(pts[0].t), last = new Date(lp.t);
  // Entrées notées pendant la navigation (boutons moteur, voile, saisies…) : position, vitesse, cap et vent repris de la trace.
  const nearPt = (t) => { let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t < t) lo = m; else hi = m; } const p = Math.abs(pts[lo].t - t) < Math.abs(pts[hi].t - t) ? pts[lo] : pts[hi]; return Math.abs(p.t - t) <= 3 * 60000 ? p : null; };
  const fills = cruise.entries.filter((e) => !e.auto).map((e) => {
    const p = nearPt(Date.parse(e.t));
    if (!p) return null;
    const add = {};
    if (!e.v.pos || e.v.pos.text) add.pos = { lat: p.lat, lon: p.lon };
    for (const k of ['sog', 'cog', 'twd', 'tws']) if (e.v[k] == null && p[k] != null) add[k] = k === 'tws' ? Math.round(p[k]) : k === 'twd' ? Math.round(p[k]) % 360 : p[k];
    return Object.keys(add).length ? [e, add] : null;
  }).filter(Boolean);
  const main = $('#view');
  main.innerHTML = `
    <h1>Importer la trace</h1>
    <section class="field">
      <h2>${esc(parsed.name || file.name)}</h2>
      <p class="help">${pts.length} points · du ${fmtShortDate(first)} ${fmtTime(first)} au ${fmtShortDate(last)} ${fmtTime(last)}</p>
      <div class="auto-stats"><div><b>${fr(det.dist)}</b><small>NM</small></div><div><b>${fmtDur(navMs)}</b><small>navigation</small></div><div><b>${fresh.length}</b><small>entrées</small></div></div>
      ${fills.length ? `<p class="help">${fills.length} entrée${fills.length > 1 ? 's' : ''} notée${fills.length > 1 ? 's' : ''} pendant la navigation ${fills.length > 1 ? 'seront complétées' : 'sera complétée'} avec la position, la vitesse, le cap et le vent de la trace.</p>` : ''}
      <ul class="preview">${fresh.map((ev) => `<li><b>${fmtTime(new Date(ev.t))}</b> ${esc(ev.kind || 'point de route')}</li>`).join('')}</ul>
      <p class="help">${legs.length > 1 ? `${legs.length} navigations séparées. ` : ''}Départ, arrivée et environ ${settings.autoPerHour === 2 ? 'deux entrées' : settings.autoPerHour === 0.5 ? 'une entrée toutes les deux heures' : 'une entrée par heure'} au plus, moins si la navigation est longue (modifiable dans Réglages).${settings.autoWeather ? ' La météo du modèle complète ce qui manque s’il y a du réseau.' : ''}</p>
      <div class="row c2"><button class="btn" id="gpxCancel">Annuler</button><button class="btn primary" id="gpxGo" ${fresh.length || fills.length ? '' : 'disabled'}>✔ ${fresh.length ? `Créer ${fresh.length} entrées` : 'Compléter les entrées'}</button></div>
      <div class="row"><button class="btn" id="gpxKeep">Garder la trace pour la carte</button></div>
    </section>`;
  let keep = true;
  $('#gpxKeep').classList.add('on');
  $('#gpxKeep').onclick = (e) => { buzz(); keep = !keep; e.currentTarget.classList.toggle('on', keep); };
  $('#gpxCancel').onclick = () => go('export');
  $('#gpxGo').onclick = async (e) => {
    buzz();
    const b = e.currentTarget;
    b.disabled = true;
    const lochBase = lochBefore(new Date(pts[0].t).toISOString());
    const created = fresh.map((ev) => autoEntryFrom(ev, lochBase));
    for (const en of created) cruise.entries.push(en);
    for (const [en, add] of fills) { Object.assign(en.v, add); if (add.tws != null) en.windSrc = 'trace'; }
    cruise.entries.sort((a, z) => a.t.localeCompare(z.t));
    saveCruise();
    if (keep) {
      const tr = loadTrack();
      // Un point toutes les 10 s suffit pour la carte et ménage la mémoire du téléphone.
      const thin = pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.floor(p.t / 10000) !== Math.floor(pts[i - 1].t / 10000));
      const seen = new Set(tr.map((x) => x[0]));
      saveTrack(tr.concat(thin.filter((p) => !seen.has(p.t)).map((p) => [p.t, Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6])).sort((a, z) => a[0] - z[0]));
    }
    if (settings.autoWeather && navigator.onLine) {
      let ok = 0;
      for (const [i, en] of created.entries()) {
        b.textContent = `⏳ Météo ${i + 1} / ${created.length}…`;
        try { if (await enrichEntry(en)) ok++; } catch {}
      }
      saveCruise();
    }
    toast(`${created.length} entrées créées`);
    go('log');
  };
  window.scrollTo(0, 0);
}

boot();

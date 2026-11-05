/* =====================================================================
   NAVIN : démarrage rapide, parcours PréP, accostage et amarrage (Corban, 2026-11-01, v95)
   - Appui long sur « NavIn » : la trace démarre tout de suite, on complète les infos plus tard.
   - PréP : type (lac/mer) › durée (jour/croisière) › bateau › équipage › check-in › Départ.
   - En route : toutes les fonctions de navigation sur la page NavIn, puis Accostage et Amarrage.
   - Amarrage : fin de la trace, puis le check-out.
   ===================================================================== */
let prep = null; // { step, type, duree, boatId, boatName, cruiseId }
const PREP_STEPS = ['Sortie', 'Durée', 'Bateau', 'Équipage', 'Check-in', 'Départ'];
const PREP_PURPOSES = [['Entraînement', '🎯', 'entre membres'], ['Location', '🔑', 'tarif calculé'], ['Invitation', '🤝', 'invités à bord']];
// Ordre d'usage (Corban, v122) : le dernier bateau (ou équipage) utilisé pour ce type de sortie en tête,
// puis les autres du plus récemment au moins récemment utilisé, puis ceux jamais utilisés.
let prepUse = store.get('ldb.prepUse', { boat: [], crew: [] });
function noteUse(kind, id, purpose) {
  (prepUse[kind] = prepUse[kind] || []).unshift({ id, p: purpose || 'mer', at: new Date().toISOString() });
  prepUse[kind] = prepUse[kind].slice(0, 300); store.set('ldb.prepUse', prepUse);
}
function byUse(list, kind, purpose, nameOf) {
  const log = prepUse[kind] || [], p = purpose || 'mer';
  const top = (log.find((u) => u.p === p && list.some((x) => x.id === u.id)) || {}).id;
  const last = (id) => (log.find((u) => u.id === id) || {}).at || '';
  return [...list].sort((a, z) => (a.id === top ? -1 : z.id === top ? 1 : 0) || last(z.id).localeCompare(last(a.id)) || nameOf(a).localeCompare(nameOf(z), 'fr'));
}
// Compositions d'équipage enregistrées comme des fiches (Corban, v122).
let crewSets = store.arr('ldb.crewSets', (x) => { if (!Array.isArray(x.crew)) x.crew = []; x.crew = x.crew.filter((c) => c && typeof c === 'object'); return x; });
// v223 (Corban) : date de création ou de dernière modification de chaque équipage (x.at, x.mod), repérée à l'enregistrement.
const crewSig = (x) => JSON.stringify([x.name || '', (x.crew || []).map((c) => [c.memberId, c.fonction || ''])]);
const saveCrewSets = () => {
  const now = new Date().toISOString();
  for (const x of crewSets) { const sg = crewSig(x); if (x._sig === undefined) { x.at = x.at || now; x._sig = sg; } else if (x._sig !== sg) { x.mod = now; x._sig = sg; } }
  store.set('ldb.crewSets', crewSets); store.set('ldb.crewSets.at', now);
};
// v227 (Corban) : équipage existant modifié (personnes ou rôles) : écraser en gardant son numéro, ou enregistrer un nouvel équipage.
const crewFull = (l) => JSON.stringify((l || []).map((c) => [c.memberId, c.fonction || '']).sort());
const crewSetDate = (x) => { const d = x.mod || x.at; if (!d) return ''; const t = new Date(d); return `${x.mod ? 'modifié' : 'créé'} le ${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}.${t.getFullYear()}`; };
// Chaque composition a un identifiant unique (EQ001…) ; sans nom choisi, elle porte cet identifiant (Corban, v123).
function crewSetIdent() { const n = store.get('ldb.crewSeq', 0) + 1; store.set('ldb.crewSeq', n); return 'EQ' + String(n).padStart(3, '0'); }
crewSets.forEach((x) => { if (!x.ident) x.ident = crewSetIdent(); if (x._sig === undefined) x._sig = crewSig(x); }); store.set('ldb.crewSets', crewSets); // équipages déjà là : pas de date inventée
// v432 (Corban) : 3 équipages d'exemple composés avec les fiches inventées (ex1…ex6). Ajoutés une fois, seulement si
// les fiches d'exemple existent encore ; supprimables comme les autres.
if (!store.get('ldb.exCrews', false)) {
  const EX_CREWS = [
    { id: 'exc1', name: 'Régate du jeudi', crew: [['ex2', 'Skipper'], ['ex1', 'Second'], ['ex5', 'Équipier']] },
    { id: 'exc2', name: 'Croisière en Méditerranée', crew: [['ex6', 'Skipper'], ['ex4', 'Second'], ['ex3', 'Équipier'], ['ex2', 'Équipier'], ['ex1', 'Équipier']] },
    { id: 'exc3', name: 'Sortie découverte', crew: [['ex4', 'Skipper'], ['ex3', 'Équipier']] },
  ];
  let n = 0;
  EX_CREWS.forEach((x) => { const crew = x.crew.filter(([id]) => members.some((m) => m.id === id)).map(([memberId, fonction]) => ({ memberId, fonction }));
    if (crew.length && !crewSets.some((c) => c.id === x.id)) { crewSets.push({ id: x.id, ident: crewSetIdent(), name: x.name, crew }); n++; } });
  if (n) saveCrewSets(); store.set('ldb.exCrews', true);
}
const crewSetPeople = (set) => set.crew.map((c) => { const m = members.find((x) => x.id === c.memberId); return m ? (m.prenom || memberName(m)) : '?'; }).join(', ');
const crewSetName = (set) => set.name || set.ident || crewSetPeople(set);
// v233 (Corban) : une personne inscrite dans un équipage (ou à bord de la navigation en cours) ne peut pas voir sa fiche supprimée.
const memberLocks = (id) => {
  const l = crewSets.filter((x) => (x.crew || []).some((c) => c.memberId === id)).map((x) => x.ident || x.name || 'équipage');
  if (cruise && (cruise.crew || []).some((c) => c.memberId === id)) l.push('navigation en cours');
  return l;
};
const memberLockMsg = (id) => { const l = memberLocks(id); return l.length ? `Fiche protégée : la personne fait partie de ${l.length > 1 ? 'ces équipages' : 'l’équipage'} ${l.join(', ')}. Retirez-la d’abord de ${l.length > 1 ? 'ces listes' : 'cette liste'}.` : ''; };
const crewKey = (l) => l.map((c) => c.memberId + ':' + (c.fonction || '')).sort().join('|');
function crewSetFromCruise() {
  const crew = (cruise && cruise.crew || []).filter((c) => c.memberId).map((c) => ({ memberId: c.memberId, fonction: c.fonction }));
  if (!crew.length) return null;
  const key = (l) => l.map((c) => c.memberId).sort().join('|');
  let set = crewSets.find((x) => crewKey(x.crew) === crewKey(crew));
  if (!set) { set = { id: uid(), ident: crewSetIdent(), crew }; crewSets.push(set); }
  saveCrewSets(); return set;
}
function applyCrewSet(set) {
  if (typeof prep !== 'undefined' && prep) delete prep.fresh; // v374
  cruise.crew = set.crew.map((c) => { const m = members.find((x) => x.id === c.memberId); return m ? crewFromMember(m, c.fonction) : null; }).filter(Boolean);
  saveCruise();
}

/* ---------- Démarrage rapide ---------- */
function quickNavMode(p) {
  const swiss = p ? inSwissArea(p) : true;
  return swiss ? 'lacj' : 'mer';
}
function lastLakeBoat() {
  const m = [...index].filter((x) => x.type === 'lac').sort((a, z) => z.created.localeCompare(a.created))[0];
  const c = m && store.get('ldb.cruise.' + m.id, null);
  return (c && boatById(c.boatId)) || boats[0] || null;
}
function newNavCruise(mode, boat, boatName, quick) {
  const lake = mode !== 'mer';
  const zone = lake ? 'L' : settings.lastZone || 'M';
  const name = autoOutingName(mode, lake ? (boat ? boat.info.boat : '') : boatName || '', '', zone);
  if (typeof tracking !== 'undefined' && tracking) stopTracking(false);
  let c;
  if (lake && boat) c = blankOuting(name, boat, mode === 'lacc' ? 'croisiere' : 'jour');
  else if (lake) { c = blankCruise(name, null); c.type = 'lac'; c.duree = mode === 'lacc' ? 'croisiere' : 'jour'; c.boatId = null; Object.assign(c.info, { contacts: LAKE_CONTACTS, du: dayKey(new Date()) }); }
  else { c = blankCruise(name, null); c.zone = zone; if (boatName) c.info.boat = boatName; }
  if (mode === 'lacj') c.purpose = newPurpose || 'Entraînement';
  if (quick) c.quick = true;
  cruise = c; draft = null; currentDay = null;
  saveCruise();
  return c;
}
// Départ immédiat (Corban, 2026-11-01, v97) :
// - sortie déjà ouverte aujourd'hui : on la reprend et on propose de prolonger la trace ou d'en tracer une nouvelle ;
// - première trace du jour : mêmes paramètres que la navigation la plus récente (croisière de plusieurs jours :
//   on continue la même ; sortie du jour : nouvelle sortie avec le même bateau, le même équipage et le même type).
function latestCruise() {
  const m = [...index].sort((a, z) => (z.updated || z.created).localeCompare(a.updated || a.created))[0];
  return m ? store.get('ldb.cruise.' + m.id, null) : null;
}
function quickStart() {
  buzz();
  if (typeof tracking !== 'undefined' && tracking) { toast('Trace déjà en cours'); return go('tracker'); }
  const today = dayKey(new Date());
  const usedToday = (c) => c && (dayKey(new Date(c.created)) === today || (c.entries || []).some((e) => dayKey(new Date(e.t)) === today));
  let msg;
  if (usedToday(cruise)) {
    go('tracker');
    if (store.get(lastTripKey(), null) && typeof trkChooseStart === 'function') { toast('Sortie du jour reprise : prolonger ou nouvelle trace ?'); return setTimeout(trkChooseStart, 60); }
    msg = '⏺ Trace démarrée';
  } else {
    const last = cruise || latestCruise();
    const lm = last ? modeOf(last) : null;
    if (last && (lm === 'mer' || lm === 'lacc')) {
      // Croisière de plusieurs jours : on continue la même, nouvelle trace du jour.
      if (!cruise || cruise.id !== last.id) openCruise(last.id);
      msg = `⏺ Trace du jour démarrée · ${cruise.info.name}`;
    } else if (last && lm === 'lacj') {
      const boat = boatById(last.boatId) || lastLakeBoat();
      const crew = structuredClone(last.crew || []);
      newPurpose = last.purpose || newPurpose;
      newNavCruise('lacj', boat, '', true);
      cruise.crew = crew; if (last.purpose) cruise.purpose = last.purpose;
      saveCruise();
      msg = '⏺ Trace démarrée · même bateau et même équipage que la dernière sortie';
    } else {
      const p = typeof herePos === 'function' ? herePos() : lastFix;
      newNavCruise(quickNavMode(p), quickNavMode(p) === 'mer' ? null : lastLakeBoat(), '', true);
      msg = '⏺ Trace démarrée · complétez bateau et équipage plus tard avec PréP';
    }
    go('tracker');
  }
  store.del(lastTripKey());
  startTracking(false);
  if (typeof drawTrkButtons === 'function') { drawTrkButtons(); updateTrkDash(); }
  if (typeof navPageRefresh === 'function') navPageRefresh();
  toast(msg);
}
// Fonctionnement unique des boutons du bandeau (Corban, 2026-11-01, v107) :
// - toucher court : ouvre la page du bouton si on est ailleurs, sinon fait défiler ses choix sur le bouton ;
// - sans action pendant 3 s, le bouton revient à son nom ;
// - appui long (650 ms) sur un choix : le bouton passe au vert et l'action est validée.
// NavIn affiché : appui long = démarrer la trace ; trace en cours = « FIN ? » rouge, puis toucher court = arrêt (v101).
(function bindTopMenus() {
  const isTrk = () => typeof tracking !== 'undefined' && tracking;
  const sea = () => !(typeof isLake === 'function' && isLake());
  const pointNow = () => trkPointNow(); // v298 : épingle sur la trace (map.js)
  const navPop = () => { if (currentView !== 'tracker') go('tracker'); setTimeout(openNavPop, 50); };
  // Chaque choix porte une aide affichée en bas d'écran (blanc sur noir) pour apprendre l'appli (Corban, v110).
  const two = (a, b, fit) => `<span class="tt2${fit ? ' tt2-fit' : ''}"><b>${a}</b><small>${b}</small></span>`;
  // Nom du bouton selon le contexte (Corban, v119) : « PréP / en cours » pendant la préparation,
  // « TRACK / en cours » pendant l'enregistrement, sinon « NavIn ».
  const inPrep = () => !!prep && (currentView === 'prep' || document.body.classList.contains('prep-on'));
  // v262 (Corban) : la VHF n'est active qu'en eaux maritimes ; en eaux intérieures le bouton devient un combiné de téléphone noir avec son cordon (secours par téléphone).
  // v267 (Corban) : boutons contextualisés par des pictogrammes sans cadre (bare) : drapeau à damier (PréP),
  // téléphone de bureau historique au combiné soulevé (eaux intérieures), START = rond vert ▶, STOP = panneau octogonal, NavIn = logo.
  const ico = (cls, vb, body) => `<svg class="tb-ico ${cls}" viewBox="${vb}" aria-hidden="true">${body}</svg>`;
  // v291 (Corban) : encore plus proche de la photo (coupelles en cloche vers le bas, épaule du socle, fourche épaisse) ; v282 : seul le combiné vibre de gauche à droite sur sa fourche, plus de traits de vibration ; v281 : W 48 dessiné plus fidèlement, tons de noir et brillances ; v280 (photo du W 48) : socle carré, col qui porte le cadran, fourche en U, grosses coupelles ; v279 : modèle W 48 (bakélite noire, combiné à coupelles rondes sur fourche, cadran à trous) ; v276 : téléphone rétro plus dessiné et arrondi (dégradé, cadran à trous, centre rouge) ; v269 : téléphone iconique qui sonne et vibre sur lui-même (traits de vibration + petite secousse).
  const PHONE_SVG = ico('tb-phone', '2 1 116 78', '<defs><linearGradient id="tpA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60656f"/><stop offset=".2" stop-color="#262a31"/><stop offset=".6" stop-color="#0c0d10"/><stop offset="1" stop-color="#000"/></linearGradient><linearGradient id="tpB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#202329"/><stop offset=".3" stop-color="#050607"/><stop offset=".7" stop-color="#0e1013"/><stop offset="1" stop-color="#30343c"/></linearGradient><linearGradient id="tpC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2e35"/><stop offset=".35" stop-color="#08090b"/><stop offset=".7" stop-color="#121418"/><stop offset="1" stop-color="#3a3e46"/></linearGradient><linearGradient id="tpS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f59"/><stop offset="1" stop-color="#0d0f12"/></linearGradient><radialGradient id="tpD" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#3a3f49"/><stop offset=".5" stop-color="#0c0d10"/><stop offset="1" stop-color="#000"/></radialGradient><radialGradient id="tpH" cx=".6" cy=".7" r=".8"><stop offset="0" stop-color="#2c3037"/><stop offset="1" stop-color="#000"/></radialGradient><radialGradient id="tpR" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#1c1f25"/></radialGradient></defs><g><path d="M30 66c-6 0-10 1-12 5" stroke="#0a0b0d" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M104 43c3 7 5 15 3 21-2 5-8 6-10 2s3-7 6-4c2 2 0 6-7 6" stroke="#0a0b0d" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M33 58h54c2.4 0 3.6 1.4 3.8 3.6l.9 12.6c.2 2.6-1.3 4-4 4H32.3c-2.7 0-4.2-1.4-4-4l.9-12.6c.2-2.2 1.4-3.6 3.8-3.6z" fill="url(#tpB)"/><path d="M35 51.5h50c3 0 4.6 1.6 5.6 4.4l.6 2.6H28.8l.6-2.6c1-2.8 2.6-4.4 5.6-4.4z" fill="url(#tpS)"/><path d="M31 56.6c1-2.6 2.4-3.6 4.6-3.6h48.8c2.2 0 3.6 1 4.6 3.6" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".4" stroke-width=".9"/><path d="M29.2 58.5h61.6" stroke="#000" stroke-width=".8"/><rect x="51" y="68" width="18" height="6.4" rx=".8" fill="#0b0c0e" stroke="#3a3f48" stroke-width=".6"/><rect x="52.4" y="69.3" width="15.2" height="3.8" fill="#eceae4"/><path d="M60 69.3v3.8" stroke="#8a8a8a" stroke-width=".35"/><path d="M47.5 27h25c1.8 0 3 1 3.4 2.8l2.4 11c1.6 6.4 5.4 9.6 10.7 10.7H31c5.3-1.1 9.1-4.3 10.7-10.7l2.4-11c.4-1.8 1.6-2.8 3.4-2.8z" fill="url(#tpC)"/><path d="M45.2 31.5l-2 9.6c-1.2 5-3.8 8-7.4 9.6" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".35" stroke-width="1.1"/><path d="M42.5 29.5V17.5c0-2.4 1.6-3.8 4-3.8h3.4c2.2 0 3.6 1.3 3.6 3.6V24c0 1.6 1 2.6 2.6 2.6h7.8c1.6 0 2.6-1 2.6-2.6v-6.7c0-2.3 1.4-3.6 3.6-3.6h3.4c2.4 0 4 1.4 4 3.8v12z" fill="url(#tpA)"/><path d="M45 18v10M75 18v10" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".3" stroke-width=".9"/><circle cx="60" cy="47" r="16.5" fill="url(#tpD)" stroke="#2a2e35" stroke-width=".6"/><path d="M47 40.4A15 15 0 0 1 63.5 32.5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.1"/><circle cx="65.80" cy="36.95" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="65.40" cy="37.45" r=".6" fill="#f2f2f2"/><circle cx="70.05" cy="41.20" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="69.65" cy="41.70" r=".6" fill="#f2f2f2"/><circle cx="71.60" cy="47.00" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="71.20" cy="47.50" r=".6" fill="#f2f2f2"/><circle cx="70.05" cy="52.80" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="69.65" cy="53.30" r=".6" fill="#f2f2f2"/><circle cx="65.80" cy="57.05" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="65.40" cy="57.55" r=".6" fill="#f2f2f2"/><circle cx="60.00" cy="58.60" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="59.60" cy="59.10" r=".6" fill="#f2f2f2"/><circle cx="54.20" cy="57.05" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="53.80" cy="57.55" r=".6" fill="#f2f2f2"/><circle cx="49.95" cy="52.80" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="49.55" cy="53.30" r=".6" fill="#f2f2f2"/><circle cx="48.40" cy="47.00" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="48.00" cy="47.50" r=".6" fill="#f2f2f2"/><circle cx="49.95" cy="41.20" r="2.85" fill="url(#tpH)" stroke="#3a3f48" stroke-width=".35"/><circle cx="49.55" cy="41.70" r=".6" fill="#f2f2f2"/><circle cx="60" cy="47" r="7.4" fill="#0b0c0e" stroke="#30343c" stroke-width=".5"/><circle cx="62.70" cy="42.32" r=".42" fill="#f2f2f2"/><circle cx="64.68" cy="44.30" r=".42" fill="#f2f2f2"/><circle cx="65.40" cy="47.00" r=".42" fill="#f2f2f2"/><circle cx="64.68" cy="49.70" r=".42" fill="#f2f2f2"/><circle cx="62.70" cy="51.68" r=".42" fill="#f2f2f2"/><circle cx="60.00" cy="52.40" r=".42" fill="#f2f2f2"/><circle cx="57.30" cy="51.68" r=".42" fill="#f2f2f2"/><circle cx="55.32" cy="49.70" r=".42" fill="#f2f2f2"/><circle cx="54.60" cy="47.00" r=".42" fill="#f2f2f2"/><circle cx="55.32" cy="44.30" r=".42" fill="#f2f2f2"/><circle cx="60" cy="47" r="2.6" fill="#1b1e23" stroke="#4a4f59" stroke-width=".4"/><path d="M70.5 53.5l5.4 3.4" stroke="#121418" stroke-width="3.2" stroke-linecap="round"/><path d="M71 53.2l4.8 3" stroke="#9aa0aa" stroke-width=".7" stroke-linecap="round"/></g><g class="tb-hs"><path d="M15.5 27C19 11.5 38 7 60 7s41 4.5 44.5 20" stroke="url(#tpA)" stroke-width="9.5" fill="none" stroke-linecap="round"/><path d="M22 19.5C30 12.5 44 10 60 10s30 2.5 38 9.5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".5" stroke-width="1.4"/><g transform=""><g transform="rotate(14 17 31)"><path d="M7.5 41C5 33 7 25 12.5 21.5c3.6-2.3 8.6-2.4 12.4 0 5 3.2 6.2 11.3 4.6 19.5z" fill="url(#tpA)"/><path d="M7.6 37.6c4.6 1.6 17.2 1.6 21.9 0" stroke="#000" stroke-width=".9" fill="none"/><ellipse cx="18.5" cy="41" rx="11" ry="3.6" fill="url(#tpR)"/><ellipse cx="18.5" cy="40.6" rx="11" ry="3.6" fill="none" stroke="#5a5f69" stroke-width=".5" stroke-opacity=".7"/><path d="M11 27c1.4-3 3.6-4.6 6.4-5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.3"/></g></g><g transform="translate(120 0) scale(-1 1)"><g transform="rotate(14 17 31)"><path d="M7.5 41C5 33 7 25 12.5 21.5c3.6-2.3 8.6-2.4 12.4 0 5 3.2 6.2 11.3 4.6 19.5z" fill="url(#tpA)"/><path d="M7.6 37.6c4.6 1.6 17.2 1.6 21.9 0" stroke="#000" stroke-width=".9" fill="none"/><ellipse cx="18.5" cy="41" rx="11" ry="3.6" fill="url(#tpR)"/><ellipse cx="18.5" cy="40.6" rx="11" ry="3.6" fill="none" stroke="#5a5f69" stroke-width=".5" stroke-opacity=".7"/><path d="M11 27c1.4-3 3.6-4.6 6.4-5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.3"/></g></g></g>');
  // v315 (Corban) : téléphone en bakélite blanche sur fond foncé (touche Téléphone).
  const PHONE_W_SVG = ico('tb-phone', '2 1 116 78', '<defs><linearGradient id="twA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fefcf6"/><stop offset=".2" stop-color="#e0dfd8"/><stop offset=".6" stop-color="#d2d1ca"/><stop offset="1" stop-color="#cccac4"/></linearGradient><linearGradient id="twB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dddcd5"/><stop offset=".3" stop-color="#cecdc6"/><stop offset=".7" stop-color="#d4d2cc"/><stop offset="1" stop-color="#e6e4de"/></linearGradient><linearGradient id="twC" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3e1db"/><stop offset=".35" stop-color="#d0cec8"/><stop offset=".7" stop-color="#d5d4cd"/><stop offset="1" stop-color="#eae9e3"/></linearGradient><linearGradient id="twS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f1eb"/><stop offset="1" stop-color="#d3d1cb"/></linearGradient><radialGradient id="twD" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#ebeae3"/><stop offset=".5" stop-color="#d2d1ca"/><stop offset="1" stop-color="#cccac4"/></radialGradient><radialGradient id="twH" cx=".6" cy=".7" r=".8"><stop offset="0" stop-color="#e3e2dc"/><stop offset="1" stop-color="#cccac4"/></radialGradient><radialGradient id="twR" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#cccac4"/><stop offset="1" stop-color="#dcdad4"/></radialGradient></defs><g><path d="M30 66c-6 0-10 1-12 5" stroke="#d1d0ca" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M104 43c3 7 5 15 3 21-2 5-8 6-10 2s3-7 6-4c2 2 0 6-7 6" stroke="#d1d0ca" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M33 58h54c2.4 0 3.6 1.4 3.8 3.6l.9 12.6c.2 2.6-1.3 4-4 4H32.3c-2.7 0-4.2-1.4-4-4l.9-12.6c.2-2.2 1.4-3.6 3.8-3.6z" fill="url(#twB)"/><path d="M35 51.5h50c3 0 4.6 1.6 5.6 4.4l.6 2.6H28.8l.6-2.6c1-2.8 2.6-4.4 5.6-4.4z" fill="url(#twS)"/><path d="M31 56.6c1-2.6 2.4-3.6 4.6-3.6h48.8c2.2 0 3.6 1 4.6 3.6" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".4" stroke-width=".9"/><path d="M29.2 58.5h61.6" stroke="#cccac4" stroke-width=".8"/><rect x="51" y="68" width="18" height="6.4" rx=".8" fill="#d1d0ca" stroke="#ebeae3" stroke-width=".6"/><rect x="52.4" y="69.3" width="15.2" height="3.8" fill="#f8f6f1"/><path d="M60 69.3v3.8" stroke="#6f6a62" stroke-width=".35"/><path d="M47.5 27h25c1.8 0 3 1 3.4 2.8l2.4 11c1.6 6.4 5.4 9.6 10.7 10.7H31c5.3-1.1 9.1-4.3 10.7-10.7l2.4-11c.4-1.8 1.6-2.8 3.4-2.8z" fill="url(#twC)"/><path d="M45.2 31.5l-2 9.6c-1.2 5-3.8 8-7.4 9.6" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".35" stroke-width="1.1"/><path d="M42.5 29.5V17.5c0-2.4 1.6-3.8 4-3.8h3.4c2.2 0 3.6 1.3 3.6 3.6V24c0 1.6 1 2.6 2.6 2.6h7.8c1.6 0 2.6-1 2.6-2.6v-6.7c0-2.3 1.4-3.6 3.6-3.6h3.4c2.4 0 4 1.4 4 3.8v12z" fill="url(#twA)"/><path d="M45 18v10M75 18v10" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".3" stroke-width=".9"/><circle cx="60" cy="47" r="16.5" fill="url(#twD)" stroke="#e3e1db" stroke-width=".6"/><path d="M47 40.4A15 15 0 0 1 63.5 32.5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.1"/><circle cx="65.80" cy="36.95" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="65.40" cy="37.45" r=".6" fill="#fcfcfc"/><circle cx="70.05" cy="41.20" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="69.65" cy="41.70" r=".6" fill="#fcfcfc"/><circle cx="71.60" cy="47.00" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="71.20" cy="47.50" r=".6" fill="#fcfcfc"/><circle cx="70.05" cy="52.80" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="69.65" cy="53.30" r=".6" fill="#fcfcfc"/><circle cx="65.80" cy="57.05" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="65.40" cy="57.55" r=".6" fill="#fcfcfc"/><circle cx="60.00" cy="58.60" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="59.60" cy="59.10" r=".6" fill="#fcfcfc"/><circle cx="54.20" cy="57.05" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="53.80" cy="57.55" r=".6" fill="#fcfcfc"/><circle cx="49.95" cy="52.80" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="49.55" cy="53.30" r=".6" fill="#fcfcfc"/><circle cx="48.40" cy="47.00" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="48.00" cy="47.50" r=".6" fill="#fcfcfc"/><circle cx="49.95" cy="41.20" r="2.85" fill="url(#twH)" stroke="#ebeae3" stroke-width=".35"/><circle cx="49.55" cy="41.70" r=".6" fill="#fcfcfc"/><circle cx="60" cy="47" r="7.4" fill="#d1d0ca" stroke="#e6e4de" stroke-width=".5"/><circle cx="62.70" cy="42.32" r=".42" fill="#fcfcfc"/><circle cx="64.68" cy="44.30" r=".42" fill="#fcfcfc"/><circle cx="65.40" cy="47.00" r=".42" fill="#fcfcfc"/><circle cx="64.68" cy="49.70" r=".42" fill="#fcfcfc"/><circle cx="62.70" cy="51.68" r=".42" fill="#fcfcfc"/><circle cx="60.00" cy="52.40" r=".42" fill="#fcfcfc"/><circle cx="57.30" cy="51.68" r=".42" fill="#fcfcfc"/><circle cx="55.32" cy="49.70" r=".42" fill="#fcfcfc"/><circle cx="54.60" cy="47.00" r=".42" fill="#fcfcfc"/><circle cx="55.32" cy="44.30" r=".42" fill="#fcfcfc"/><circle cx="60" cy="47" r="2.6" fill="#dbd9d3" stroke="#f3f1eb" stroke-width=".4"/><path d="M70.5 53.5l5.4 3.4" stroke="#d5d4cd" stroke-width="3.2" stroke-linecap="round"/><path d="M71 53.2l4.8 3" stroke="#6f6a62" stroke-width=".7" stroke-linecap="round"/></g><g class="tb-hs"><path d="M15.5 27C19 11.5 38 7 60 7s41 4.5 44.5 20" stroke="url(#twA)" stroke-width="9.5" fill="none" stroke-linecap="round"/><path d="M22 19.5C30 12.5 44 10 60 10s30 2.5 38 9.5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".5" stroke-width="1.4"/><g transform=""><g transform="rotate(14 17 31)"><path d="M7.5 41C5 33 7 25 12.5 21.5c3.6-2.3 8.6-2.4 12.4 0 5 3.2 6.2 11.3 4.6 19.5z" fill="url(#twA)"/><path d="M7.6 37.6c4.6 1.6 17.2 1.6 21.9 0" stroke="#cccac4" stroke-width=".9" fill="none"/><ellipse cx="18.5" cy="41" rx="11" ry="3.6" fill="url(#twR)"/><ellipse cx="18.5" cy="40.6" rx="11" ry="3.6" fill="none" stroke="#fbf9f3" stroke-width=".5" stroke-opacity=".7"/><path d="M11 27c1.4-3 3.6-4.6 6.4-5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.3"/></g></g><g transform="translate(120 0) scale(-1 1)"><g transform="rotate(14 17 31)"><path d="M7.5 41C5 33 7 25 12.5 21.5c3.6-2.3 8.6-2.4 12.4 0 5 3.2 6.2 11.3 4.6 19.5z" fill="url(#twA)"/><path d="M7.6 37.6c4.6 1.6 17.2 1.6 21.9 0" stroke="#cccac4" stroke-width=".9" fill="none"/><ellipse cx="18.5" cy="41" rx="11" ry="3.6" fill="url(#twR)"/><ellipse cx="18.5" cy="40.6" rx="11" ry="3.6" fill="none" stroke="#fbf9f3" stroke-width=".5" stroke-opacity=".7"/><path d="M11 27c1.4-3 3.6-4.6 6.4-5" fill="none" stroke="#fff" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.3"/></g></g></g>');
  const FLAG_SVG = ico('tb-flag', '-2 -1 52 42', '<defs><pattern id="tbck" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#111"/><rect x="4" y="4" width="4" height="4" fill="#111"/></pattern></defs><path d="M9 3v35" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z" fill="url(#tbck)" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><text x="29" y="37.6" text-anchor="middle" font-size="11" font-weight="900" fill="#111" font-family="Arial, Helvetica, sans-serif" textLength="26" lengthAdjust="spacingAndGlyphs">PréP</text>');
  // v283 (Corban) : pendant la préparation, le drapeau P1 flotte au vent (lettres PréP fixes en attendant son choix L1–L5).
  const FLAG_WAVE_SVG = ico('tb-flag tb-flag-wave', '-2 -1 52 42', '<defs><pattern id="tbck2" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#111"/><rect x="4" y="4" width="4" height="4" fill="#111"/></pattern></defs><path d="M9 3v35" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z" fill="url(#tbck2)" stroke="#111" stroke-width="1.6" stroke-linejoin="round"><animate attributeName="d" dur="1.4s" repeatCount="indefinite" values="M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z;M10 5c7 3 14-3 22 0s10 2 13 0v20c-3 2-6 1-13-1s-15 3-22 1z;M10 5c9-2 14 2 22-1s10 1 13 1v20c-3-1-5 1-12-1s-15 0-23 0z;M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z"/></path><text x="29" y="37.6" text-anchor="middle" font-size="11" font-weight="900" class="tb-blink" fill="#111" font-family="Arial, Helvetica, sans-serif" textLength="26" lengthAdjust="spacingAndGlyphs">PréP</text>');
  // v285 (Corban, L3 / L3b) : PréP en cours, page PréP ouverte = drapeau qui flotte + PréP qui clignote ; ailleurs = drapeau fixe + PréP qui clignote.
  const FLAG_PREP_SVG = ico('tb-flag', '-2 -1 52 42', '<defs><pattern id="tbck3" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#111"/><rect x="4" y="4" width="4" height="4" fill="#111"/></pattern></defs><path d="M9 3v35" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z" fill="url(#tbck3)" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><text x="29" y="37.6" text-anchor="middle" font-size="11" font-weight="900" class="tb-blink" fill="#111" font-family="Arial, Helvetica, sans-serif" textLength="26" lengthAdjust="spacingAndGlyphs">PréP</text>');
  // v269 (Corban) : le départ, comme un départ de course : fanion vert, étiquette START, la trace part en pointillés (pendant du signe FIN).
  const START_SVG = ico('tb-start', '0 0 48 40', '<path d="M14 25c6-1 8-10 15-10s10-7 16-10" stroke="#0b3d91" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><path d="M12 25V3" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M13 3l10 4.5L13 12z" fill="#12a150"/><circle cx="12" cy="25" r="3.2" fill="#12a150" stroke="#fff" stroke-width="1.2"/><rect x="1" y="27.5" width="34" height="12" rx="3" fill="#12a150"/><text x="18" y="37.3" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif" textLength="28" lengthAdjust="spacingAndGlyphs">START</text>');
  // v268 (Corban) : plutôt qu'un STOP, un signe de fin : la trace (pointillés) arrive à un fanion d'arrivée, avec « FIN ».
  const STOP_SVG = ico('tb-stop', '0 0 48 40', '<path d="M3 35c8 0 9-12 17-11s9-9 15-12" stroke="#0b3d91" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><path d="M36 25V3" stroke="#111" stroke-width="2.4" stroke-linecap="round"/><path d="M37 3l10 4.5L37 12z" fill="#d0021b"/><circle cx="36" cy="25" r="3.2" fill="#d0021b" stroke="#fff" stroke-width="1.2"/><rect x="20" y="27.5" width="27" height="12" rx="3" fill="#d0021b"/><text x="33.5" y="37.3" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="Arial, Helvetica, sans-serif" textLength="20" lengthAdjust="spacingAndGlyphs">FIN</text>');
  // v271 (Corban) : SOS écrit en grand, ajusté à toute la pastille, seules les trois lettres sont visibles (pas de cadre).
  const SOS_SVG = ico('tb-sos', '0 0 100 52', '<text x="50" y="47.5" text-anchor="middle" font-size="60" font-weight="900" fill="#d0021b" stroke="#fff" stroke-width="3" paint-order="stroke" stroke-linejoin="round" font-family="Arial Black, Arial, Helvetica, sans-serif" textLength="96" lengthAdjust="spacingAndGlyphs">SOS</text>');
  // v273 (Corban, choix 1) : data = livre de bord ouvert (lignes à gauche, ancre à droite), sans cadre.
  const DATA_SVG = ico('tb-data', '0 0 60 40', '<path d="M30 8c-6-4-16-5-25-3v29c9-2 19-1 25 3z" fill="#fff" stroke="#0b3d91" stroke-width="2.2" stroke-linejoin="round"/><path d="M30 8c6-4 16-5 25-3v29c-9-2-19-1-25 3z" fill="#fff" stroke="#0b3d91" stroke-width="2.2" stroke-linejoin="round"/><path d="M30 8v29" stroke="#0b3d91" stroke-width="2"/><g stroke="#8aa3c7" stroke-width="1.4"><path d="M9 12h16M9 17h16M9 22h16M9 27h12"/></g><g stroke="#0b3d91" stroke-width="1.8" fill="none" stroke-linecap="round"><circle cx="43" cy="13" r="2"/><path d="M43 15v12M38.5 19h9M37 23c1 4 4 5 6 5s5-1 6-5"/></g>');
  // v286 (Corban, planche S3 / M1 / F2) : trace en cours = pointillés qui défilent derrière un petit voilier ; Point = épingle de carte.
  const TRACK_SVG = ico('tb-track', '0 0 60 40', '<path class="tb-dash" d="M3 34c10 0 12-10 22-10s14-8 22-10" stroke="#0b3d91" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><g transform="translate(46 15) scale(1.6)"><g class="tb-boat"><path d="M0 0l7 0-1.5 2.5h-4z" fill="#0b3d91"/><path d="M3.6 -9v8.6h3.6z" fill="#f39c12"/><path d="M3 -9.5v9" stroke="#111" stroke-width=".8"/></g></g>');
  const PIN_SVG = ico('tb-pin', '0 0 48 40', '<path d="M24 3c-7 0-12 5-12 11.5C12 23 24 36 24 36s12-13 12-21.5C36 8 31 3 24 3z" fill="#d0021b"/><circle cx="24" cy="14.5" r="4.6" fill="#fff"/><ellipse cx="24" cy="37" rx="7" ry="1.6" fill="#000" opacity=".2"/>');
  // v287 (Corban, planche M3) : Amarrage = bitte d'amarrage avec son cordage.
  const MOOR_SVG = ico('tb-moor', '0 0 60 40', '<path d="M18 36h24" stroke="#5f6368" stroke-width="3" stroke-linecap="round"/><path d="M23 36V20h14v16" fill="#3a4458"/><rect x="19" y="14" width="22" height="7" rx="3.5" fill="#1d2433"/><path d="M4 26c6 0 10-4 16-6 5-1.5 10-1 14 1s6 6 2 7-10-2-14-3" stroke="#c8a165" stroke-width="3" fill="none" stroke-linecap="round"/>');
  // v290 (Corban) : après FINISH confirmé, quelques secondes : la trace bleue immobile avec un grand V vert par-dessus, sans pastille.
  const DONE_SVG = ico('tb-done', '0 0 60 40', '<path d="M3 34c10 0 12-10 22-10s14-8 22-10" stroke="#0b3d91" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="1 5"/><path class="tb-v" d="M17 19l9.5 10L46 6" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path class="tb-v" d="M17 19l9.5 10L46 6" stroke="#12a150" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
  let doneUntil = 0;
  const NAVIN_SVG = ico('tb-navin', '0 0 92 40', '<text x="1" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="47" lengthAdjust="spacingAndGlyphs">Nav</text><rect x="52" y="5" width="3.6" height="23" rx="1" fill="currentColor"/><path d="M57.5 7l12 20h-12z" fill="#f39c12"/><text x="71" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="19" lengthAdjust="spacingAndGlyphs">n</text><path d="M2 35q5.5-4 11 0t11 0 11 0 11 0 11 0 11 0 11 0 11 0" stroke="#f39c12" stroke-width="2.4" fill="none" stroke-linecap="round"/>');
  // v311 (Corban, choix LD et MA) : logo NavIn selon la zone, Léman bleu clair (eaux intérieures) ou grande vague (maritime).
  const NAVIN_LAC_SVG = ico('tb-navin', '0 0 92 40', '<path d="M71.8 9.3 75.3 11.2 76.7 13.3 75.0 15.4 71.4 15.6 58.1 13.3 42.8 14.8 41.6 16.8 40.0 17.6 37.6 19.1 36.4 19.5 34.6 21.3 33.2 21.5 31.6 19.1 26.9 18.9 22.4 25.8 18.2 34.1 14.3 38.0 14.6 36.9 15.3 35.5 16.4 30.7 17.7 27.2 28.7 10.2 29.9 9.0 31.3 8.3 36.5 7.7 37.8 6.9 42.4 3.1 43.7 2.6 50.4 2.1 52.1 2.5 65.0 7.0 71.8 9.3Z" fill="#8fd0ff" fill-opacity="1" stroke="#f39c12" stroke-width="1.4" stroke-linejoin="round"/><text x="1" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="47" lengthAdjust="spacingAndGlyphs">Nav</text><rect x="52" y="5" width="3.6" height="23" rx="1" fill="currentColor"/><path d="M57.5 7l12 20h-12z" fill="#f39c12"/><text x="71" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="19" lengthAdjust="spacingAndGlyphs">n</text>');
  const NAVIN_MER_SVG = ico('tb-navin', '0 0 92 40', '<path d="M0 40V27C2 13 13 3.5 25 4c7 .3 11.5 5 11 10.5-1.3-3.6-5-5.6-8.8-4.6-5 1.4-6.4 7.6-2.6 10.8 2.8 2.3 7 1.8 9.3-.8.3 6.6 6.5 10.6 15 10.6C63 30.5 76 27 92 29.5V40z" fill="#8fd0ff" opacity=".75"/><path d="M25 4c7 .3 11.5 5 11 10.5-1.3-3.6-5-5.6-8.8-4.6" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/><text x="1" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="47" lengthAdjust="spacingAndGlyphs">Nav</text><rect x="52" y="5" width="3.6" height="23" rx="1" fill="currentColor"/><path d="M57.5 7l12 20h-12z" fill="#f39c12"/><text x="71" y="28" font-size="27" font-weight="900" fill="currentColor" font-family="Arial, Helvetica, sans-serif" textLength="19" lengthAdjust="spacingAndGlyphs">n</text>');
  const inlandNow = () => (typeof navZone === 'function' ? navZone() === 'lac' : !sea());
  // v322 (Corban) : en mode nuit le téléphone passe en gris clair (bakélite blanche atténuée), sinon on ne le voit pas.
  const phoneHtml = (still) => [PHONE_SVG.replace('tb-phone', 'tb-phone ph-day'), PHONE_W_SVG.replace('tb-phone', 'tb-phone ph-night')].map((h) => (still ? h.replace('tb-phone', 'tb-phone tb-still') : h)).join('');
  const vhfItem = (hint, still) => (inlandNow() ? { label: 'Téléphone', html: phoneHtml(still), box: true, hint: 'Toucher encore : menu suivant · appui long : appeler les secours par téléphone (eaux intérieures)', act: () => go('vhf') } : { label: 'VHF', hint, act: () => go('vhf') });
  const baseNav = () => (typeof currentView !== 'undefined' && currentView === 'vhf') ? (inlandNow() ? { label: 'Téléphone', html: phoneHtml(true), box: true, vhfOn: true } : { label: 'VHF', vhfOn: true }) : prep ? (inPrep() ? { label: 'PréP en cours', html: FLAG_WAVE_SVG, bare: true } : { label: 'PréP en cours (autre page)', html: FLAG_PREP_SVG, bare: true }) : isTrk() ? { label: 'TRACK en cours', html: TRACK_SVG, bare: true } : { label: 'NavIn', html: inlandNow() ? NAVIN_LAC_SVG : NAVIN_MER_SVG };
  const MENUS = {
    tracker: () => [
      // NavIn lui-même n'engage rien : il sert à trouver le bon choix (Corban, v108).
      { ...baseNav(), base: true, hint: 'Touche « NavIn » plusieurs fois (appuis courts) · pour faire défiler ses menus', act: () => go('tracker') },
      // v293 (Corban) : pendant la trace, ordre Point, Téléphone (ou VHF), Amarrage, FIN ; Accostage retiré du menu.
      ...(isTrk() ? (() => { const FIN = { label: 'FIN', html: STOP_SVG, bare: true, stop: true, hint: 'Toucher encore : menu suivant · appui long : arrêter la trace (confirmation demandée)', act: () => armStop() }; return [
        // v297 (Corban) : FIN revient après chaque choix : Point, FIN, Téléphone, FIN, Amarrage, FIN.
        { label: 'Point', html: PIN_SVG, bare: true, hint: 'Toucher encore : menu suivant · appui long : enregistrer un point dans le journal', act: pointNow },
        FIN,
        vhfItem('Toucher encore : menu suivant · appui long : VHF (appels de routine en mer)', true),
        FIN,
        { label: 'Amarrage', html: MOOR_SVG, bare: true, hint: 'Toucher encore : menu suivant · appui long : fin de la trace, puis check-out', act: () => moorNow() },
        FIN,
        // v230 (Corban) : l'équipage réel ne s'ouvre plus depuis NavIn, seulement depuis data en navigation.
      ]; })() : [
        { label: 'PréP', html: FLAG_SVG, bare: true, hint: 'Toucher encore : menu suivant · appui long : préparer la sortie pas à pas', act: () => prepStart() },
        { label: 'START track', html: START_SVG, bare: true, hint: 'Toucher encore : menu suivant · appui long : démarrer la trace tout de suite', act: () => quickStart() },
        // VHF toujours au menu NavIn : la bonne section (intérieure lac / extérieure mer) s'ouvre selon l'endroit (Corban, v193).
        vhfItem('Toucher encore : menu suivant · appui long : VHF (appels de routine en mer)', true), // v295 (Corban) : écran de départ = NavIn, PréP, START, Tél (fixe)
      ]),
    ],
    // data : pas de menu déroulant pour l'instant, un toucher ouvre les rubriques (Corban, v132).
    more: () => [
      { label: 'data', base: true, act: () => go('more') },
    ],
    sos: () => [
      { label: 'SOS', html: SOS_SVG, bare: true, base: true, hint: 'Appui court : outils SOS de la zone · appui long : tous les outils, lac et mer', act: () => go('sos') },
      { label: 'MOB', hint: 'Toucher encore : menu suivant · appui long : homme à la mer', act: () => go('mob') },
      { label: 'Alphabet', hint: 'Toucher encore : menu suivant · appui long : alphabet phonétique', act: () => go('alpha') },
      ...((typeof navZone === 'function' ? navZone() === 'mer' : sea()) ? [{ label: 'VHF', hint: 'Toucher encore : menu suivant · appui long : appels VHF de routine', act: () => go('vhf') }] : []),
    ],
  };
  // Au démarrage, la première bulle explique les appuis courts (Corban, v112).
  // v351 (Corban) : sur la page de départ, une bulle présente un bouton et ses fonctions ; à chaque ouverture la suivante, une seule fois chacune.
  setTimeout(() => {
    if (typeof toast !== 'function' || (typeof tracking !== 'undefined' && tracking) || settings.noHelpI) return;
    const TIPS = [
      ['.top-tab[data-view="tracker"]', 'NavIn : touchez plusieurs fois pour faire défiler ses choix (PréP, START, Téléphone ou VHF) · appui long sur un choix : il se lance · appui long sur le logo : change la zone de navigation'],
      ['.top-tab.tab-data', 'data : toutes vos fiches · bateaux, coéquipiers·ères, équipages, check-lists, traces, cartes et documents'],
      ['.top-tab.tab-sos', 'SOS : un toucher ouvre les outils de secours de la zone · homme à la mer, alphabet, téléphone ou VHF'],
      ['#gearBtn', 'Curseurs : les réglages · appui long : mode nuit ou mode jour'],
      ['#clock', 'L’heure : en mer elle s’affiche en UTC · un toucher montre 5 secondes l’heure locale (Zone Time)'],
      ['#toast', 'Les bulles se déplacent au doigt · un toucher les ferme · les pastilles d’aide « i » se masquent dans les réglages (Zone et écran)'],
    ];
    let i = 0; try { i = Number(localStorage.getItem('ldb.tipIdx') || 0) || 0; } catch (e) {}
    if (i >= TIPS.length) return;
    try { localStorage.setItem('ldb.tipIdx', String(i + 1)); } catch (e) {}
    const [sel, msg] = TIPS[i];
    toast(msg);
    const el = document.querySelector(sel);
    if (el && sel !== '#toast') { el.classList.add('tip-focus'); setTimeout(() => el.classList.remove('tip-focus'), 6000); }
  }, 1500);
  // Chaque choix s'écrit à la taille de SOS ; on ne réduit que si le mot ne tient pas (Corban, v118).
  const fitLabel = (b) => { b.style.fontSize = ''; const t2 = b.querySelector('.tt2-fit'); if (t2) { const bg = t2.querySelector('b'), sm = t2.querySelector('small'); sm.style.fontSize = ''; const wb = bg.getBoundingClientRect().width, ws = sm.getBoundingClientRect().width; if (wb && ws) sm.style.fontSize = (parseFloat(getComputedStyle(sm).fontSize) * wb / ws * 0.97).toFixed(2) + 'px'; return; } if (b.querySelector('.tt2')) return; let fs = parseFloat(getComputedStyle(b).fontSize), n = 0; while (b.scrollWidth > b.clientWidth + 1 && fs > 12 && n++ < 12) { fs -= 1; b.style.fontSize = fs + 'px'; } };
  const setLabel = (b, it) => { if (it.html) b.innerHTML = it.html; else b.textContent = it.label; b.classList.toggle('vhf-on', !!it.vhfOn); b.classList.toggle('bare', !!it.bare); b.classList.toggle('ph-box', !!it.box); fitLabel(b); }; // v207 (Corban) : sur la page VHF, NavIn garde « VHF », fond jaune, pulsation lente
  const st = {}; // par bouton : { idx, timer }
  const keyOf = (b) => b && b.dataset.view;
  const tabBtn = (e) => e.target.closest && e.target.closest('.top-tab[data-view]');
  const onItsPage = (k) => { const a = document.querySelector(`.top-tab[data-view="${k}"]`); return a && a.classList.contains('active') && !(typeof currentView !== 'undefined' && currentView === 'settings'); }; // v441 (Corban) : depuis les réglages, NavIn ramène à la page principale
  function show(b, k, idx) {
    const items = MENUS[k](); idx = idx % items.length;
    st[k] = st[k] || {}; st[k].idx = idx;
    setLabel(b, items[idx]); b.classList.toggle('staged', idx > 0); b.classList.toggle('stage-stop', !!items[idx].stop);
    if (items[idx].hint) toast(items[idx].hint);
    clearTimeout(st[k].timer);
    if (idx > 0) st[k].timer = setTimeout(() => reset(k), 5000);
  }
  function reset(k) {
    const b = document.querySelector(`.top-tab[data-view="${k}"]`); if (!b) return;
    if (k === 'tracker' && stopArmed) return;
    if (st[k]) { st[k].idx = 0; clearTimeout(st[k].timer); }
    setLabel(b, MENUS[k]()[0]); b.dataset.base = MENUS[k]()[0].label; b.classList.remove('staged', 'lp-ok', 'stage-stop');
  }
  function refreshBase() {
    const b = document.querySelector('.top-tab[data-view="tracker"]'); if (!b) return;
    if (inPrep()) { $$('.top-tab').forEach((x) => x.classList.toggle('active', x === b)); }
    if (stopArmed || Date.now() < doneUntil || (st.tracker && st.tracker.idx > 0) || b.classList.contains('lp-ok')) return;
    const it = MENUS.tracker()[0]; const want = it.label;
    if (b.dataset.base !== want) { b.dataset.base = want; setLabel(b, it); }
  }
  window.navinBaseRefresh = refreshBase;
  setTimeout(() => { reset('sos'); reset('more'); }, 0); window.navinTopReset = () => { reset('tracker'); reset('sos'); }; // v271 : le logo SOS dès l'ouverture
  setInterval(refreshBase, 1000);
  let t = null, fired = false, pressed = null;
  document.addEventListener('pointerdown', (e) => {
    const b = tabBtn(e); if (!b || !MENUS[keyOf(b)]) return;
    fired = false; pressed = b; clearTimeout(t);
    t = setTimeout(() => {
      fired = true; const k = keyOf(b); const items = MENUS[k](); const it = items[(st[k] && st[k].idx) || 0] || items[0];
      // v303 (Corban) : plus d'appui long sur SOS (la zone de navigation choisit les outils lac ou mer).
      if (it.base && k === 'sos') { fired = false; return; } // un appui long sur SOS agit comme un toucher
      // v310 (Corban) : appui long sur le logo NavIn = bascule En eaux intérieures ⇄ Maritime (choix forcé, comme dans la roue).
      if (it.base && k === 'tracker' && it.label === 'NavIn' && typeof zoneSet === 'function') { buzz(); zoneSet(ZONE_CYC[(ZONE_CYC.indexOf(zoneSimGet()) + 1) % ZONE_CYC.length]); reset(k); return; } // v318 : En eaux intérieures → Maritime → Automatique par GPS, comme la roue
      if (it.base) return;
      buzz();
      if (it.base) return; // le nom du bouton n'engage rien (Corban, v111)
      if (st[k]) clearTimeout(st[k].timer);
      if (it.stop) return it.act();
      // v294 (Corban) : plus d'étape intermédiaire « ✓ choix » sur le bouton ; l'action part tout de suite.
      toast('✓ ' + it.label); reset(k); it.act();
    }, 650);
  }, { passive: true });
  const cancel = () => clearTimeout(t);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, cancel, { passive: true }));
  document.addEventListener('click', (e) => {
    const b = tabBtn(e); if (!b || !MENUS[keyOf(b)]) return;
    e.stopPropagation(); e.preventDefault();
    if (fired) { fired = false; return; }
    const k = keyOf(b);
    if (k === 'tracker' && stopArmed) return stopNow();
    buzz();
    // SOS n'est pas une touche tournante : un toucher ouvre la page SOS, bouton rouge écrit blanc (Corban, v178).
    if (k === 'sos') { Object.keys(MENUS).forEach((o) => reset(o)); if (typeof sosLogStart === 'function' && !(typeof sosSim !== 'undefined' && sosSim && !sosLogActive())) sosLogStart(typeof sosExOn === 'function' && sosExOn() ? '🧪 Exercice : touche SOS du haut' : 'Touche SOS'); go('sos'); /* v452 : pendant une simulation, la touche SOS ne lance pas de vraie procédure */ const h = MENUS.sos()[0].hint; if (h) toast(h); return; }
    // Ailleurs : le premier toucher ouvre la page du bouton.
    if (!onItsPage(k) && !((st[k] && st[k].idx) > 0)) { Object.keys(MENUS).forEach((o) => o !== k && reset(o)); go(k); const h = MENUS[k]()[0].hint; if (h) toast(h); return; }
    Object.keys(MENUS).forEach((o) => o !== k && reset(o));
    // Les touchers courts tournent entre les choix seulement ; le nom revient après 5 s sans action (Corban, v124).
    { const n = MENUS[k]().length, cur = (st[k] && st[k].idx) || 0; if (n < 2) return go(k); show(b, k, (cur % (n - 1)) + 1); }
  }, true);
  let stopArmed = false, armT = null;
  function disarm() { stopArmed = false; clearTimeout(armT); const b = document.querySelector('.top-tab[data-view="tracker"]'); if (b) b.classList.remove('stop-armed'); reset('tracker'); }
  function armStop() {
    const b = document.querySelector('.top-tab[data-view="tracker"]');
    reset('tracker'); buzz(); stopArmed = true;
    if (b) { b.classList.add('bare', 'stop-armed'); b.innerHTML = STOP_SVG.replace('class="tb-ico ', 'class="tb-ico tb-armed '); }
    toast('Toucher encore (ou Entrée) pour confirmer l’arrêt de la trace · sinon rien dans 5 s');
    clearTimeout(armT); armT = setTimeout(disarm, 5000);
  }
  async function stopNow() {
    disarm(); buzz();
    const tb = document.querySelector('.top-tab[data-view="tracker"]');
    if (tb) { doneUntil = Date.now() + 3000; tb.classList.add('bare'); tb.innerHTML = DONE_SVG; tb.dataset.base = ''; setTimeout(() => { doneUntil = 0; reset('tracker'); }, 3000); }
    if (isTrk()) await stopTracking(true);
    if (currentView !== 'tracker') go('tracker');
    if (typeof trkReset === 'function') trkReset();
    if (typeof drawTrkButtons === 'function') { drawTrkButtons(); updateTrkDash(); if (typeof drawTrkList === 'function') drawTrkList(); }
    toast('■ Trace arrêtée');
  }
  document.addEventListener('contextmenu', (e) => { if (tabBtn(e)) e.preventDefault(); });
  // Télécommande Bluetooth / clavier (Corban, 2026-11-01, v109) : écran mouillé, gants.
  // ← → : choix précédent / suivant du bouton ; ↑ ↓ (ou PgUp/PgDn) : bouton précédent / suivant ;
  // Entrée ou Espace (court ou long) : valider le choix affiché ; Échap : fermer.
  const ORDER = ['tracker', 'more', 'sos'];
  let kk = null, kT = null;
  const kBtn = (k) => document.querySelector(`.top-tab[data-view="${k}"]`);
  function kFocus(k, idx) {
    ORDER.forEach((o) => { const x = kBtn(o); if (x) x.classList.toggle('kbd-focus', o === k); if (o !== k) reset(o); });
    kk = k; const b = kBtn(k); if (!b) return;
    show(b, k, idx);
    clearTimeout(kT); kT = setTimeout(() => { ORDER.forEach((o) => { const x = kBtn(o); if (x) x.classList.remove('kbd-focus'); reset(o); }); kk = null; }, 5000);
  }
  function kValidate() {
    const k = kk || (ORDER.find((o) => { const x = kBtn(o); return x && x.classList.contains('active'); }) || 'tracker');
    const b = kBtn(k); const items = MENUS[k](); const it = items[(st[k] && st[k].idx) || 0] || items[0];
    if (k === 'tracker' && stopArmed) return stopNow();
    if (it.base) return;
    buzz(); clearTimeout(kT); if (st[k]) clearTimeout(st[k].timer);
    if (it.stop) { ORDER.forEach((o) => { const x = kBtn(o); if (x) x.classList.remove('kbd-focus'); }); kk = null; return it.act(); }
    toast('✓ ' + it.label); ORDER.forEach((o) => { const x = kBtn(o); if (x) x.classList.remove('kbd-focus'); }); reset(k); kk = null; it.act();
  }
  document.addEventListener('keydown', (e) => {
    const tg = e.target; if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    const cur = () => kk || (ORDER.find((o) => { const x = kBtn(o); return x && x.classList.contains('active'); }) || 'tracker');
    const idx = (k) => (st[k] && st[k].idx) || 0;
    const key = e.key;
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      e.preventDefault(); const k = cur(); const n = k === 'sos' ? 1 : MENUS[k]().length; buzz();
      if (n < 2) return kFocus(k, 0); const c = idx(k) || (key === 'ArrowRight' ? 0 : 1);
      return kFocus(k, key === 'ArrowRight' ? (c % (n - 1)) + 1 : ((c - 2 + (n - 1)) % (n - 1)) + 1);
    }
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'PageDown' || key === 'PageUp') {
      e.preventDefault(); const k = cur(); const d = key === 'ArrowDown' || key === 'PageDown' ? 1 : ORDER.length - 1; buzz();
      return kFocus(ORDER[(ORDER.indexOf(k) + d) % ORDER.length], 0);
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault(); if (e.repeat) return; return kValidate();
    }
    if (key === 'Escape') {
      if (typeof closeNavPop === 'function') closeNavPop();
      const ov = document.querySelector('.overlay .close, [data-close]'); if (ov) ov.click();
    }
  });
})();

/* ---------- PréP pas à pas ---------- */
function prepStart() {
  buzz();
  // Navigation lancée par un appui long : PréP la complète au lieu d'en créer une autre.
  const fill = cruise && cruise.quick;
  prep = { step: 0, reach: null, fill, type: fill ? (isLake() ? 'lac' : 'mer') : null, duree: fill ? (curMode() === 'lacc' ? 'croisiere' : 'jour') : null, boatId: fill ? cruise.boatId : null, boatName: fill ? cruise.info.boat || '' : '', purpose: fill ? cruise.purpose || null : null };
  // v300 (Corban) : plus de choix Lac / Mer dans PréP, la zone vient du bouton « Zone de navigation » (forcée ou GPS).
  if (!fill) { prep.type = (typeof navZone === 'function' ? navZone() : 'lac') === 'lac' ? 'lac' : 'mer'; if (prep.type === 'lac') prep.sub = 'purpose'; else prep.step = 1; }
  prep.reach = prep.step;
  go('prep');
}
/* v395 (Corban) : trois chemins indépendants en lac (Entraînement, Location, Invitation). Chacun garde son état
   (bateau, équipage, étape atteinte et sa propre navigation, donc son check-in) ; revenir sur un chemin le reprend tel quel.
   L'appui long sur la croix rouge n'efface que le chemin en cours (jamais les données : bateaux, fiches, navigations). */
const PREP_PATH_KEYS = ['purpose', 'duree', 'boatId', 'boatName', 'crewSet', 'step', 'reach', 'cruiseId', 'fresh', 'tarif'];
let prepPaths = store.get('ldb.prepPaths', {});
function prepPathSave() {
  if (!prep || prep.type !== 'lac' || !prep.purpose || prep.fill) return;
  const o = {}; for (const k of PREP_PATH_KEYS) if (prep[k] != null) o[k] = prep[k];
  o.t = new Date().toISOString(); prepPaths[prep.purpose] = o; store.set('ldb.prepPaths', prepPaths);
}
function prepPathDrop(purpose) { if (purpose && prepPaths[purpose]) { delete prepPaths[purpose]; store.set('ldb.prepPaths', prepPaths); } }
// Chemin gardé encore valable : sa navigation existe et n'a pas encore commencé (aucune entrée).
function prepPathGet(purpose) {
  const o = prepPaths[purpose]; if (!o) return null;
  if (o.cruiseId) { const c = store.get('ldb.cruise.' + o.cruiseId, null); if (!c || (c.entries || []).length) { prepPathDrop(purpose); return null; } }
  return o;
}
function prepPathSub(purpose) {
  const o = prepPathGet(purpose); if (!o) return '';
  const bt = o.boatId && typeof boats !== 'undefined' ? boats.find((b) => b.id === o.boatId) : null;
  const set = o.crewSet && crewSets.find((x) => x.id === o.crewSet);
  const bits = [bt ? bt.info.boat : o.boatName, set ? crewSetName(set) : ''].filter(Boolean);
  return bits.length ? 'en cours : ' + bits.join(' · ') : '';
}
window.prepPathSave = prepPathSave;
/* v395 (Corban) : en Location, après le bateau, une fiche « Tarif » : les tarifs du bateau (texte « Tarifs » de sa fiche),
   le tarif du moment proposé d'office (jour de semaine ou week-end, journée ou soir dès 17h), un toucher pour choisir.
   Le montant va dans la fiche du jour (« Montant location »), toujours modifiable. */
function prepTarifs(b) {
  return String((b && b.info && b.info.tarifs) || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.match(/(\d+(?:[.,]\d{1,2})?)(?!.*\d)/), parts = l.split(/\s*:\s*/);
    return { i, line: l, label: parts.length > 1 ? parts[0] : l, price: parts.length > 1 ? parts.slice(1).join(' : ') : '', chf: m ? String(Math.round(num(m[1]))) : '' };
  });
}
function prepTarifSuggest(b) {
  const want = typeof rentalPrice === 'function' ? rentalPrice(Date.now(), b && b.info && b.info.tarifs) : null;
  const d = new Date(), we = d.getDay() === 0 || d.getDay() === 6, soir = d.getHours() * 60 + d.getMinutes() >= 16 * 60 + 30;
  const t = prepTarifs(b).find((x) => { const isWe = /\bwe\b|week-?end|samedi|dimanche/i.test(x.line), isSoir = /soir|17\s*h/i.test(x.line); return isWe === we && isSoir === soir; }) || prepTarifs(b).find((x) => x.chf === want);
  return { t, why: `${['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()]}${soir ? ' soir' : ''}` };
}
function prepTarifApply(t) {
  prep.tarif = t ? t.label : 'Sans tarif';
  if (cruise) {
    cruise.tarif = t ? { label: t.label, chf: t.chf, line: t.line } : null; if (!t) delete cruise.tarif;
    if (t && t.chf && typeof dayData === 'function') { const d = dayData(dayKey(new Date())); d.typeSortie = 'Location'; d.montant = t.chf; }
    saveCruise();
  }
}
function prepMode() { return prep.type === 'mer' ? 'mer' : prep.duree === 'croisiere' ? 'lacc' : 'lacj'; }
function prepCreateOrFill() {
  const mode = prepMode();
  const boat = prep.boatId ? boatById(prep.boatId) : null;
  if (prep.fill && cruise && cruise.quick) {
    // On complète la navigation rapide : type, durée et bateau.
    if (mode === 'mer') { cruise.type = 'mer'; delete cruise.duree; delete cruise.boatId; if (prep.boatName) cruise.info.boat = prep.boatName; }
    else {
      cruise.type = 'lac'; cruise.duree = mode === 'lacc' ? 'croisiere' : 'jour';
      if (boat && cruise.boatId !== boat.id) { cruise.boatId = boat.id; Object.assign(cruise.info, structuredClone(boat.info), { name: cruise.info.name }); }
    }
    delete cruise.quick;
    saveCruise();
    toast('Navigation complétée');
  } else {
    newNavCruise(mode, boat, prep.boatName, false);
    toast(`${mode === 'lacj' ? 'Sortie' : 'Croisière'} « ${cruise.info.name} » ouverte`);
  }
  if (prep.type === 'lac' && prep.purpose && cruise) { cruise.purpose = prep.purpose; saveCruise(); }
  prep.cruiseId = cruise.id;
}
function prepGo(step, browse) {
  prep.step = Math.max(0, Math.min(PREP_STEPS.length - 1, step));
  setTimeout(prepPathSave, 0);
  // v341 (Corban) : « reach » = étape en cours de remplissage ; une navigation par les pastilles ne la fait pas avancer.
  if (!browse) prep.reach = Math.max(prep.reach == null ? 0 : prep.reach, prep.step);
  if (prep.step === 3 && prep.newCrew) return go('crew');
  if (prep.step !== 3) prep.newCrew = false;
  if (prep.step === 4 && cruise) return go('checklist', 'dep'); // v341 : sans bateau choisi, la pastille 4 montre seulement l'aide
  return go('prep');
}
// v329 (Corban) : les pastilles ne comptent que les étapes réellement parcourues (lac : pas de Durée ; mer : pas de Type), sans saut.
function prepPills(s) {
  const idx = PREP_STEPS.map((n, i) => i).filter((i) => (prep && prep.type === 'lac' ? i !== 1 : i !== 0));
  // v341 (Corban) : pastilles cliquables pour consulter ; remplie = « done », étape en cours = « on », page consultée = numéro en couleur (« view »).
  const r = prep && prep.reach != null ? Math.max(prep.reach, 0) : s;
  return idx.map((i, k) => `<span data-ps="${i}" role="button" class="${i === r ? 'on' : i < r ? 'done' : ''}${i === s && s !== r ? ' view' : ''}">${k + 1}</span>`).join('');
}
function prepJump(i) {
  if (!prep) return;
  buzz();
  prep.sub = i === 0 && prep.type === 'lac' ? 'purpose' : null; prep.crewDraft = null; prep.newCrew = false;
  prepGo(i, true);
}
window.prepJump = prepJump;
function prepBarHtml() {
  if (!prep) return '';
  const s = prep.step;
  return `<div class="prep-steps">${prepPills(s)}</div>
    <div class="prep-row"><button class="btn nav-dup" data-prep="back" hidden>◀</button><b>${PREP_STEPS[s]}</b>${s >= 3 && s < 5 ? '<button class="btn primary" data-prep="next">Suivant ▶</button>' : '<button class="btn" data-prep="quit">✕</button>'}</div>`;
}
function prepBarSync(view) {
  setTimeout(() => { if (window.navinBaseRefresh) navinBaseRefresh(); }, 0);
  let bar = document.getElementById('prepBar');
  const show = prep && ((view === 'crew' && prep.step === 3) || (view === 'checklist' && prep.step === 4));
  document.body.classList.toggle('prep-on', !!show);
  if (!show) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'prepBar'; bar.className = 'prep-bar';
    document.body.appendChild(bar);
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-prep]'); if (!b) return;
      buzz();
      if (b.dataset.prep === 'next') { if (prep.step === 3) { const set = crewSetFromCruise(); if (set) { noteUse('crew', set.id, prep.purpose); toast('Composition enregistrée : ' + crewSetName(set)); } prep.newCrew = false; } prepGo(prep.step + 1); }
      if (b.dataset.prep === 'back') { if (prep.step === 3) { prep.newCrew = false; return prepGo(3); } prepGo(prep.step - 1); }
      if (b.dataset.prep === 'quit') { prep = null; go('tracker'); }
    });
  }
  bar.innerHTML = prepBarHtml();
}
// v368 (Corban) : plus de pastilles 1 2 3 4 5 ni de petite ligne sous le titre : une ligne de titres d'étape, sous les boutons
// de navigation, toujours visible. Chaque titre devient le choix fait (Bateau → Savannah). Couleur : gris = rien fait,
// orange = commencé pas fini, vert = choix finalisé. Un toucher sur un titre ramène à son étape.
function prepTrail() { return ''; }
function prepLine() {
  if (!prep) return '';
  const lake = prep.type !== 'mer', cur = prep.step;
  const it = []; // [texte, étape, état]
  // v398 (Corban) : dès que deux ou trois chemins sont lancés, un petit bouton « 2x » / « 3x » tout à gauche ramène au choix
  // du chemin ; le chemin en cours reste orange tant qu'il n'est pas parti naviguer ou n'a pas été effacé.
  if (lake) { const n = PREP_PURPOSES.filter(([pp]) => pp === prep.purpose || prepPathGet(pp)).length; if (n >= 2) it.push([n + 'x', 'paths', 'multi']); }
  if (lake) it.push([prep.purpose || 'Sortie', 0, prep.purpose ? 'part' : '']); // v375 (Corban) : pas d'orange tant que rien n'est sélectionné
  else it.push([prep.duree ? (prep.duree === 'jour' ? 'Un jour' : 'Croisière') : 'Durée', 1, prep.duree ? 'ok' : '']);
  { const bt = prep.boatId && typeof boats !== 'undefined' ? boats.find((b) => b.id === prep.boatId) : null; const nm = bt ? bt.info.boat : prep.boatName; it.push([nm || 'Bateau', 2, nm ? 'ok' : '']); }
  // v401 (Corban) : en Location, « Tarif » dans la ligne des étapes, puis le montant choisi (CHF n).
  if (lake && prep.purpose === 'Location') it.push([(cruise && cruise.tarif && cruise.tarif.label === prep.tarif && cruise.tarif.chf ? 'CHF ' + cruise.tarif.chf : prep.tarif) || 'Tarif', '2t', prep.tarif ? 'ok' : (prep.reach || 0) >= 3 ? 'part' : '']); // v403 (Corban) : gris = pas encore vu, vert = choisi, orange = sauté
  { const set = prep.crewSet && crewSets.find((x) => x.id === prep.crewSet); const names = cruise && cruise.crew.length ? cruise.crew.map((c) => c.nom).filter(Boolean).join(', ') : '';
    const nm = set ? crewSetName(set) : (prep.fresh ? '' : names); const part = prep.crewDraft && prep.crewDraft.crew && prep.crewDraft.crew.length;
    it.push([nm || 'Équipage', 3, nm ? 'ok' : part ? 'part' : '']); }
  { let st = ''; if (cruise && !prep.fresh && typeof checkItems === 'function') { try { const all = checkItems('dep').length, left = checkLeft('dep').length; st = !all || !left ? (all ? 'ok' : '') : left < all ? 'part' : ''; } catch (e) {} } it.push(['Check-in', 4, st]); }
  it.push(['Départ', 5, '']);
  const curK = cur === 2 && prep.sub === 'tarif' ? '2t' : cur;
  return it.map(([t, st, c]) => `<span role="button" class="pl-it${c ? ' pl-' + c : ''}${st === curK ? ' pl-cur' : ''}" data-tj="${st}">${esc(t)}</span>`).join('');
}
window.prepLine = prepLine;
// v399 (Corban) : si les étapes ne tiennent pas en largeur, la ligne défile au doigt ; l'étape en cours est amenée au centre
// et un fondu indique de quel côté il en reste.
window.prepLineFit = function (pl) {
  pl.classList.remove('pl-over', 'pl-more-l', 'pl-more-r');
  const cut = [...pl.children].some((x) => x.scrollWidth > x.clientWidth + 1);
  if (!cut && pl.scrollWidth <= pl.clientWidth + 1) return;
  pl.classList.add('pl-over');
  const marks = () => { pl.classList.toggle('pl-more-l', pl.scrollLeft > 4); pl.classList.toggle('pl-more-r', pl.scrollLeft + pl.clientWidth < pl.scrollWidth - 4); };
  const cur = pl.querySelector('.pl-cur');
  if (cur) { const r = cur.getBoundingClientRect(), q = pl.getBoundingClientRect(); pl.scrollLeft = Math.max(0, pl.scrollLeft + r.left - q.left - (pl.clientWidth - r.width) / 2); }
  marks();
  if (!pl._plScroll) { pl._plScroll = true; pl.addEventListener('scroll', () => { if (pl.classList.contains('pl-over')) { pl.classList.toggle('pl-more-l', pl.scrollLeft > 4); pl.classList.toggle('pl-more-r', pl.scrollLeft + pl.clientWidth < pl.scrollWidth - 4); } }, { passive: true }); }
};
// v373 (Corban) : appui long sur la croix rouge de PréP = tout remettre à zéro (choix des étapes et points du check-in).
window.prepReset = function () {
  const pur = prep && prep.purpose;
  // v374 (Corban) : n'efface QUE les sélections de PréP (sortie, bateau, équipage choisis) ; bateaux, fiches, équipage à bord et check-in restent intacts.
  const ty = prep && prep.type; // v376 (Corban) : on garde lac ou mer, on revient directement aux trois choix de sortie
  if (prep && prep.purpose) prepPathDrop(prep.purpose); // v395 (Corban) : seul le chemin en cours est effacé
  prep = ty ? { step: 0, type: ty, sub: ty === 'lac' ? 'purpose' : null, fresh: true } : { step: 0, fresh: true }; if (ty === 'mer') prep.step = 1; buzz(); toast(pur ? `Chemin « ${pur} » effacé · les autres chemins, bateaux et fiches sont conservés` : 'Sélections de PréP effacées · bateaux et fiches conservés', true); go('prep');
};
// v368 (Corban) : ▶ de la barre du haut = étape suivante, même sans avoir rempli celle-ci.
window.prepBrowseNext = function () { if (!prep) return; let n = (prep.step || 0) + 1; if (prep.type !== 'mer' && n === 1) n = 2; if (n > 5) return; prepJump(n); };
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('#prepLine [data-tj], .prep-trail [data-tj]'); if (!t || !prep) return;
  e.preventDefault(); e.stopPropagation();
  if (t.dataset.tj === 't') { buzz(); prep.sub = null; return prepGo(0, true); }
  if (t.dataset.tj === 'paths') { buzz(); prep.crewDraft = null; prep.newCrew = false; prep.sub = 'purpose'; return prepGo(0, true); }
  if (t.dataset.tj === '2t') { buzz(); prep.crewDraft = null; prep.newCrew = false; prep.sub = prep.boatId ? 'tarif' : null; return prepGo(2, true); }
  prepJump(Number(t.dataset.tj));
}, true);
VIEWS.prep = function renderPrep() {
  if (!prep) prep = { step: 0 };
  const main = $('#view');
  const s = prep.step;
  const head = `<div class="prep-steps">${prepPills(s)}</div>
    <div class="prep-title"><h1>${s === 0 && prep.sub === 'purpose' ? 'Sortie de type' : s === 2 && prep.sub === 'tarif' ? 'Tarif' : s === 3 && prep.sub === 'crewEdit' ? 'Nouvel équipage' : PREP_STEPS[s]}</h1>${prepTrail(s)}</div>`; // v328 (Corban) : pastilles + titre seul (sans « PréP n/6 »), même mise en page partout ; Retour en haut à gauche, plus de ✕
  // v328 (Corban) : « ◀ Retour » toujours en haut à gauche (barre du haut, comme les pages data) ; celui de la page reste caché et sert de cible.
  const nav = (next) => `<div class="row prep-nav"><button class="btn big nav-dup" data-p="back">◀ Retour</button>${next ? `<button class="btn big primary" data-p="next">${next}</button>` : ''}</div>`;
  let body = '';
  if (s === 0) {
    // Premier niveau : uniquement Lac ou Mer ; un toucher passe à la suite (Corban, v121).
    // Lac : niveau suivant = type de sortie (Entraînement, Location, Invitation), un toucher passe à la durée.
    if (prep.sub === 'purpose') {
      body = `<div class="row prep-col">${PREP_PURPOSES.map(([p, ic, sub]) => { const cur = prepPathSub(p); return `<button class="btn big ${prep.purpose === p ? 'on' : ''}${cur ? ' prep-path-on' : ''}" data-pick="purpose" data-v="${p}">${ic} ${p}<small>${esc(cur || sub)}</small></button>`; }).join('')}</div>${nav('')}`;
    } else {
      body = `<div class="row c2"><button class="btn big ${prep.type === 'lac' ? 'on' : ''}" data-pick="type" data-v="lac">🏞 Lac</button><button class="btn big ${prep.type === 'mer' ? 'on' : ''}" data-pick="type" data-v="mer">⛵ Mer</button></div>${nav('')}`;
    }
  } else if (s === 1) {
    body = `<div class="row c2"><button class="btn big ${prep.duree === 'jour' ? 'on' : ''}" data-pick="duree" data-v="jour">☀️ Un jour<small>${prep.type === 'mer' ? 'sortie à la journée' : 'sortie du jour'}</small></button><button class="btn big ${prep.duree === 'croisiere' ? 'on' : ''}" data-pick="duree" data-v="croisiere">🌙 Croisière<small>plusieurs jours</small></button></div>${nav('')}`;
  } else if (s === 2 && prep.sub === 'tarif') {
    const bt = prep.boatId && boatById(prep.boatId), list = prepTarifs(bt), sg = prepTarifSuggest(bt);
    const cur = prep.tarif || (sg.t && sg.t.label);
    body = list.length
      ? `<p class="help">Proposé pour aujourd’hui (${esc(sg.why)}) : ${sg.t ? `<b>${esc(sg.t.label)}</b>` : 'aucun tarif ne correspond'}. Touchez le bon tarif.</p>
        <div class="row prep-col">${list.map((t) => `<button class="btn big ${cur === t.label ? 'on' : ''}" data-tarif="${t.i}">💶 ${esc(t.label)}<small>${esc(t.price || t.line)}${sg.t && sg.t.i === t.i ? ' · proposé' : ''}</small></button>`).join('')}</div>
        <div class="row"><button class="btn" data-tarif="none">Sans tarif (gratuit ou à régler autrement)</button></div>`
      : `<p class="help">Aucun tarif dans la fiche de ${esc((bt && bt.info.boat) || 'ce bateau')}. On peut les ajouter dans Mes bateaux, rubrique « Tarifs ».</p><div class="row"><button class="btn" data-p="boats">➕ Ajouter les tarifs du bateau</button></div>`;
    body += (bt && bt.info.reglement && /location/i.test(bt.info.reglement) ? `<p class="help prep-regl">${esc(bt.info.reglement.split('\n').filter((l) => /location|franchise/i.test(l)).join(' '))}</p>` : '') + nav('Suivant ▶');
  } else if (s === 2) {
    if (prep.type === 'lac') {
      const list = boatsByNav(prep.purpose); // ordre par navigation réelle (Corban, v147)
      body = list.length
        ? `<div class="row prep-col">${list.map((b, i) => `<button class="btn big ${prep.boatId === b.id ? 'on' : ''}" data-pick="boatId" data-v="${b.id}">🚤 ${esc(b.info.boat || 'Bateau')}<small>${esc(boatSub(b.info))}</small></button>`).join('')}</div>`
        : '<p class="help">Aucun bateau enregistré.</p>';
      body += `<div class="row"><button class="btn" data-p="boats">➕ Ajouter ou modifier un bateau</button></div>${nav('')}`;
    } else {
      body = `<label class="field"><h2>Nom du bateau</h2><input class="text" id="prepBoat" value="${esc(prep.boatName || '')}" placeholder="ex. Bronze Kiss" autocomplete="off"></label>${nav('Suivant ▶')}`;
    }
  } else if (s === 3 && prep.sub === 'crewEdit' && prep.crewDraft) {
    // Étape de contrôle : on peut modifier l'équipage et son nom ; les rôles appartiennent à la liste, pas aux fiches.
    const d = prep.crewDraft, base = crewSets.find((x) => x.id === d.baseId);
    const roles = prep.type === 'mer' ? SEA_ROLES : LAKE_ROLES;
    const changed = !base || crewFull(base.crew) !== crewFull(d.crew);
    const sorted = membersByNav();
    body = `<p class="help">${base && !changed ? `Composition ${esc(base.ident)}. ` : (base ? `Modifiée : à la fin, écraser ${esc(base.ident)} (même numéro) ou enregistrer un nouvel équipage. ` : '')}Touche les personnes à bord, puis choisis les rôles. L’équipage est gardé pour les prochaines fois.</p>
      <label class="field"><h2>Nom de l’équipage</h2><input class="text" id="crewSetName" value="${esc(d.name)}" placeholder="${esc(changed ? 'facultatif · sinon identifiant automatique (EQ…)' : (base ? base.ident : ''))}" autocomplete="off"></label>
      ${d.crew.map((c, i) => { const m = members.find((x) => x.id === c.memberId); return `<div class="crew-on"><div class="crew-on-name"><b>${i + 1}. ${esc(m ? memberName(m) : '?')}</b></div><div class="row c3">${roles.map(([f, l]) => `<button class="btn ${c.fonction === f ? 'on' : ''}" data-crole="${i}" data-f="${f}">${roleLabel(f, m && m.sexe)}</button>`).join('')}</div></div>`; }).join('')}
      <h2 class="sub-h">Personnes</h2><div class="row c2 crew-pick">${sorted.map((m) => { const on = d.crew.some((c) => c.memberId === m.id); return `<button class="btn big ${on ? 'on' : ''}" data-cm="${m.id}">${on ? '✔ ' : ''}${esc(memberName(m) || '…')}</button>`; }).join('')}</div>
      <div class="row"><button class="btn big" data-p="fiches">＋ Ajouter une personne</button></div>
      ${base && changed && d.crew.length ? `<div class="crew-choice"><p class="help"><b>Équipage ${esc(base.ident)} modifié.</b> Que faire ?</p><div class="row c2"><button class="btn big" data-p="crewOver">✎ Écraser ${esc(base.ident)}<small>garder ce numéro</small></button><button class="btn big no-navact" data-p="crewNew">＋ Nouvel équipage<small>nouveau numéro</small></button></div></div>${nav('')}` : nav(d.crew.length ? 'Valider ▶' : '')}`;
  } else if (s === 3) {
    const list = byUse(crewSets.filter((x) => x.crew.some((c) => members.some((m) => m.id === c.memberId))), 'crew', prep.purpose, crewSetName);
    body = list.length
      ? `<div class="row prep-col">${list.map((x, i) => `<button class="btn big" data-pick="crewSet" data-v="${x.id}">👥 ${esc(crewSetName(x))}<small>${i === 0 && (prepUse.crew || []).length ? 'dernière utilisée · ' : ''}${esc(crewSetPeople(x))}${crewSetDate(x) ? `<br>${esc(crewSetDate(x))}` : ''}</small></button>`).join('')}</div>`
      : '<p class="help">Aucune composition enregistrée. Crée la première : choisis les personnes à bord, elle sera gardée pour les prochaines fois.</p>';
    body += `<div class="row"><button class="btn big" data-p="newcrew">＋ Nouvelle composition</button></div>${nav('')}`;
  } else if ((s === 5 || s === 4) && !cruise) {
    body = `<p class="help">Choisis d’abord le bateau (pastille 2) : cette étape s’active ensuite.</p>${nav('')}`; // v341 : consultation par pastille sans données
  } else if (s === 5) {
    body = `<p class="help">${esc(MODES[curMode()].icon + ' ' + (cruise ? cruise.info.name : ''))}. Tout est prêt : la trace et le journal automatique démarrent au toucher.</p>
      <div class="row"><button class="btn big auto-start" data-p="depart">⏺ Départ<small>enregistrer la trace</small></button></div>${nav('')}`;
  }
  main.innerHTML = head + body;
  main.onclick = (e) => {
    const b = e.target.closest('[data-set],[data-p],[data-pick],[data-cm],[data-crole],[data-tarif]'); if (!b) return;
    buzz();
    if (b.dataset.tarif) { const t = b.dataset.tarif === 'none' ? null : prepTarifs(boatById(prep.boatId))[Number(b.dataset.tarif)]; prepTarifApply(t); toast(t ? `Tarif : ${t.label}${t.chf ? ' · CHF ' + t.chf : ''}` : 'Sans tarif'); prep.sub = null; return prepGo(3); }
    if (prep.crewDraft && $('#crewSetName')) prep.crewDraft.name = $('#crewSetName').value.trim();
    if (b.dataset.cm) {
      const d = prep.crewDraft, i = d.crew.findIndex((c) => c.memberId === b.dataset.cm);
      if (i >= 0) d.crew.splice(i, 1); else d.crew.push({ memberId: b.dataset.cm, fonction: d.crew.some((c) => c.fonction === 'Skipper') ? 'Équipier' : 'Skipper' });
      return VIEWS.prep();
    }
    if (b.dataset.crole) {
      const d = prep.crewDraft, f = b.dataset.f;
      if (f !== 'Équipier') d.crew.forEach((c) => { if (c.fonction === f) c.fonction = 'Équipier'; });
      d.crew[Number(b.dataset.crole)].fonction = f; return VIEWS.prep();
    }
    if (b.dataset.pick) {
      const k = b.dataset.pick, v = b.dataset.v; prep[k] = v;
      if (k === 'type') { if (v === 'mer') { prep.boatId = null; prep.purpose = null; prep.sub = null; return prepGo(1); } prep.sub = 'purpose'; return VIEWS.prep(); }
      if (k === 'purpose') {
        // v395 : chaque type de sortie a son propre chemin ; on reprend celui gardé, sinon on part de zéro.
        const o = prepPathGet(v), ty = prep.type;
        for (const kk of PREP_PATH_KEYS) delete prep[kk];
        prep.purpose = v; prep.type = ty; prep.sub = null; prep.crewDraft = null; prep.newCrew = false;
        if (o) {
          Object.assign(prep, o); delete prep.t;
          if (o.cruiseId && (!cruise || cruise.id !== o.cruiseId) && !(typeof tracking !== 'undefined' && tracking)) { openCruise(o.cruiseId); if (typeof navPageRefresh === 'function') navPageRefresh(); }
          return prepGo(Math.max(2, o.reach == null ? 2 : o.reach), true);
        }
        prep.duree = 'jour'; prep.fresh = true; prep.reach = 0;
        return prepGo(2);
      }
      if (k === 'boatId') { prepCreateOrFill(); noteUse('boat', v, prep.purpose); if (prep.purpose === 'Location' && prep.type === 'lac') { prep.tarif = null; prep.sub = 'tarif'; /* v405 (Corban) : le tarif du moment est seulement présélectionné sur la fiche Tarif ; la ligne reste grise tant qu'on ne l'a pas touché */ return prepGo(2); } return prepGo(3); }
      if (k === 'crewSet') { const set = crewSets.find((x) => x.id === v); if (!set) return; applyCrewSet(set); noteUse('crew', set.id, prep.purpose); prep.sub = null; prep.crewDraft = null; return prepGo(4); } // v334 (Corban) : plus de « Contrôle de l’équipage » en PréP, l’équipage choisi est pris tel quel (on le modifie pendant la trace)
      if (k === 'duree') return prepGo(2);
    }
    if (b.dataset.set) { prep[b.dataset.set] = b.dataset.v; if (b.dataset.set === 'type' && b.dataset.v === 'mer') prep.boatId = null; return VIEWS.prep(); }
    const p = b.dataset.p;
    if (p === 'boats') return go('boats');
    if (p === 'quit') { prep = null; return go('tracker'); }
    if (p === 'newcrew') { prep.crewDraft = { baseId: null, name: '', crew: [] }; prep.sub = 'crewEdit'; return VIEWS.prep(); }
    if (p === 'fiches') { if (prep.crewDraft) prep.crewDraft.name = ($('#crewSetName') || {}).value || prep.crewDraft.name; if (cruise) { applyCrewSet({ crew: prep.crewDraft ? prep.crewDraft.crew : [] }); } prep.newCrew = true; return go('crew'); }
    if (p === 'back') {
      if ((s === 0 && prep.sub === 'purpose' && !prep.fill) || (s === 1 && prep.type === 'mer' && !prep.fill)) { prep = null; return go('tracker'); }
      if (s === 0 && prep.sub === 'purpose') { prep.sub = null; return VIEWS.prep(); }
      if (s === 3 && prep.sub === 'crewEdit') { prep.sub = null; prep.crewDraft = null; return VIEWS.prep(); }
      if (s === 0) { prep = null; return go('tracker'); }
      if (s === 2 && prep.sub === 'tarif') { prep.sub = null; return prepGo(2, true); }
      if (s === 2 && prep.type === 'lac') { prep.sub = 'purpose'; return prepGo(0); }
      return prepGo(s === 5 ? 4 : s - 1);
    }
    if ((p === 'crewOver' || p === 'crewNew') && s === 3 && prep.sub === 'crewEdit') {
      const d = prep.crewDraft, base = crewSets.find((x) => x.id === d.baseId);
      let set;
      if (p === 'crewOver' && base) { set = base; base.crew = d.crew.map((c) => ({ ...c })); if (d.name) base.name = d.name; toast(`✓ ${base.ident} écrasé, même numéro`); }
      else { set = { id: uid(), ident: crewSetIdent(), crew: d.crew.map((c) => ({ ...c })) }; if (d.name && (!base || d.name !== base.name)) set.name = d.name; crewSets.push(set); toast('✓ Nouvel équipage ' + set.ident + (set.name ? ' · ' + set.name : '')); }
      saveCrewSets(); applyCrewSet(set); noteUse('crew', set.id, prep.purpose);
      prep.sub = null; prep.crewDraft = null; return prepGo(4);
    }
    if (p === 'next' && s === 3 && prep.sub === 'crewEdit') {
      const d = prep.crewDraft, base = crewSets.find((x) => x.id === d.baseId);
      let set;
      if (base && crewFull(base.crew) === crewFull(d.crew)) { set = base; if (d.name && d.name !== base.name) { base.name = d.name; } }
      else { set = { id: uid(), ident: crewSetIdent(), crew: d.crew.map((c) => ({ ...c })) }; if (d.name && (!base || d.name !== base.name)) set.name = d.name; crewSets.push(set); toast('Nouvel équipage ' + set.ident + (set.name ? ' · ' + set.name : '')); }
      saveCrewSets(); applyCrewSet(set); noteUse('crew', set.id, prep.purpose);
      prep.sub = null; prep.crewDraft = null; return prepGo(4);
    }
    if (p === 'next') {
      if (s === 2 && prep.sub === 'tarif') { prep.sub = null; return prepGo(3); } // v403 : passer sans choisir = étape sautée (orange)
      if (s === 2) { if (prep.type === 'mer') prep.boatName = ($('#prepBoat').value || '').trim(); prepCreateOrFill(); }
      return prepGo(s + 1);
    }
    if (p === 'depart') {
      if (prep && prep.purpose) prepPathDrop(prep.purpose); // v395 : le chemin est parti naviguer
      prep = null;
      store.del(lastTripKey());
      go('tracker');
      startTracking(false);
      if (typeof drawTrkButtons === 'function') { drawTrkButtons(); updateTrkDash(); }
      navPageRefresh();
    }
  };
};

/* ---------- Accostage ---------- */
const DOCK_STEPS = [
  'Pare-battages en place, à la bonne hauteur',
  'Amarres avant et arrière préparées, lovées, tournées au taquet',
  'Gaffe à portée de main',
  'Voiles affalées et rangées',
  'Moteur : marche avant et arrière essayées, vitesse réduite',
  'Équipiers briefés : qui débarque, qui tient quelle amarre',
  'Personne entre le bateau et le quai',
];
let dockDone = {};
VIEWS.dock = function renderDock() {
  const main = $('#view');
  const p = typeof herePos === 'function' ? herePos() : lastFix;
  const depth = p && typeof depthAt === 'function' ? depthAt(p.lat, p.lon) : '';
  const sea = cruise && !isLake();
  main.innerHTML = `<h1>⚓ Accostage</h1>
    <section class="field"><h2>Hauteur d’eau ici</h2><div class="value" style="font-size:34px">${depth ? esc(depth) : '–'}</div>
      <p class="help">${depth ? 'D’après les isobathes de la carte, à vérifier au sondeur.' : 'Pas de courbe de profondeur à proximité : fiez-vous au sondeur et à la carte.'}</p></section>
    <section class="field"><h2>À préparer</h2><div class="dock-list">${DOCK_STEPS.concat(sea ? ['VHF sur le canal du port, place demandée'] : []).map((t, i) => `<button class="btn dock-it ${dockDone[i] ? 'on' : ''}" data-i="${i}">${dockDone[i] ? '✔ ' : ''}${esc(t)}</button>`).join('')}</div></section>
    <div class="row c2"><button class="btn big" data-d="back">◀ NavIn</button><button class="btn big danger" data-d="moor">🔒 Amarrage<small>fin de la trace, check-out</small></button></div>`;
  main.onclick = (e) => {
    const b = e.target.closest('[data-i],[data-d]'); if (!b) return;
    buzz();
    if (b.dataset.i != null) { dockDone[b.dataset.i] = !dockDone[b.dataset.i]; return VIEWS.dock(); }
    if (b.dataset.d === 'back') return go('tracker');
    if (b.dataset.d === 'moor') armed(b, 'Toucher encore : amarré', moorNow);
  };
};
async function moorNow() {
  buzz();
  dockDone = {};
  if (typeof tracking !== 'undefined' && tracking) await stopTracking(true);
  if (typeof trkReset === 'function') trkReset();
  toast('🔒 Amarré : trace terminée');
  go('checklist', 'quit');
}

/* ---------- Page NavIn en route ---------- */
// En route, les fonctions de navigation sont sur la page même ; PréP n'apparaît qu'à l'arrêt.
function navPageRefresh() {
  const box = $('#navLive');
  if (!box) return;
  const on = typeof tracking !== 'undefined' && tracking && cruise;
  box.hidden = !on;
  const pb = $('#prepFab'); if (pb) pb.hidden = !!on;
  document.body.classList.toggle('has-prep-fab', !on && currentView === 'tracker');
  if (on) { box.innerHTML = `<div id="lakeBtns"></div>`; renderLakeButtons(); }
  else box.innerHTML = '';
  const tail = $('#navTail'); if (tail) tail.hidden = !on;
}

/* ---------- data › Équipages : les compositions de groupe (Corban, v139) ----------
   Les navigants sont les fiches des personnes ; un équipage est un groupe de navigants avec leurs rôles. */
let crewsEdit = null; // { id|null, name, crew:[{memberId, fonction}] }
VIEWS.crews = function renderCrews() {
  const main = $('#view');
  main.oninput = null;
  if (crewsEdit && crewsEdit.pendingNew) { const nw = members.filter((m) => !crewsEdit.pendingNew.has(m.id)); delete crewsEdit.pendingNew; nw.forEach((m) => { if (!crewsEdit.crew.some((c) => c.memberId === m.id)) crewsEdit.crew.push({ memberId: m.id, fonction: crewsEdit.crew.length ? 'Équipier' : 'Skipper' }); }); crewsEdit._addNew = nw.length; }
  if (crewsEdit) return renderCrewsEdit();
  const list = [...crewSets].sort((a, z) => crewSetName(a).localeCompare(crewSetName(z), 'fr'));
  // v360 (Corban) : la page Équipages ne montre que les équipages (consulter, ajouter) ; en navigation, l'équipage à bord est en tête ; plus de passage par les fiches des personnes.
  const aboard = cruise ? `<h2 class="sub-h">À bord maintenant</h2><div class="row"><button class="btn big" id="csAboard">⛵ Équipage à bord · ${cruise.crew.length} personne${cruise.crew.length > 1 ? 's' : ''}<small>${esc(cruise.crew.map((c) => c.nom).filter(Boolean).join(', ') || 'personne pour l’instant')}</small></button></div><h2 class="sub-h">Équipages enregistrés</h2>` : '';
  main.innerHTML = `<h1>Équipages</h1>${aboard}
    <div class="row prep-col">${list.map((x) => `<button class="btn big" data-cs="${x.id}">👥 ${esc(crewSetName(x))}<small>${esc([x.name ? x.ident : '', crewSetPeople(x)].filter(Boolean).join(' · ') || 'vide')}${crewSetDate(x) ? `<br>${esc(crewSetDate(x))}` : ''}</small></button>`).join('') || '<p class="help">Aucun équipage pour l’instant.</p>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn big primary" id="csNew">＋ Nouvel équipage</button></div>
`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'csNew') { crewsEdit = { id: null, name: '', crew: [] }; return renderCrewsEdit(); }
    if (b.id === 'csAboard') return go('crew');
    if (b.dataset.cs) { const s = crewSets.find((x) => x.id === b.dataset.cs); if (!s) return; crewsEdit = { id: s.id, name: s.name || '', crew: s.crew.map((c) => ({ ...c })), existing: true, mode: null }; return renderCrewsEdit(); }
  };
};
function renderCrewsEdit() {
  const main = $('#view');
  const d = crewsEdit, base = crewSets.find((x) => x.id === d.id);
  const sorted = membersByNav();
  main.innerHTML = `<button class="btn" id="ceBack">◀ Équipages</button>
    <h1>${base ? esc(crewSetName(base)) : 'Nouvel équipage'}</h1>
    ${d.existing && !d.mode && base && crewFull(base.crew) !== crewFull(d.crew) ? `<div class="crew-choice" id="ceChoice"><p class="help"><b>Équipage ${esc(base.ident)} modifié</b> (pas encore enregistré). Que faire ?</p><div class="row c2"><button class="btn big" id="ceOver">✎ Écraser ${esc(base.ident)}<small>garder ce numéro</small></button><button class="btn big no-navact" id="ceAsNew">＋ Nouvel équipage<small>nouveau numéro</small></button></div><div class="row"><button class="btn" id="ceUndo">↺ Annuler les modifications</button></div></div>` : ''}
    <section class="field"><h2>Nom de l’équipage</h2><input class="text" id="ceName" value="${esc(d.name)}" placeholder="${esc(base ? base.ident : 'facultatif · sinon identifiant automatique (EQ…)')}" autocomplete="off"></section>
    <section class="field crew-photo-sec"><h3>Photo de groupe</h3>
      ${base && base.photo ? `<figure class="crew-photo"><img data-cphoto="${base.photo}" alt="Photo de groupe"><figcaption id="ceCapShow"${base.photoCap ? '' : ' hidden'}>${esc(base.photoCap || '')}</figcaption></figure>
      <input class="text" id="ceCap" value="${esc(base.photoCap || '')}" placeholder="Légende (au centre, en bas de la photo)" autocomplete="off">
      <div class="row c2"><button class="btn" id="cePhoto">📷 Changer la photo</button><button class="btn danger" id="cePhotoDel">🗑 Retirer la photo</button></div>`
      : `<div class="row"><button class="btn big" id="cePhoto">📷 + photo<small>photo de groupe : photothèque, fichier ou appareil photo</small></button></div>`}
    </section>
    ${d.crew.map((c, i) => { const m = members.find((x) => x.id === c.memberId); return `<div class="crew-on"><div class="crew-on-name"><b>${i + 1}. ${esc(m ? memberName(m) : '?')}</b></div><div class="row c3">${LAKE_ROLES.map(([f]) => `<button class="btn ${c.fonction === f ? 'on' : ''}" data-cerole="${i}" data-f="${f}">${roleLabel(f, m && m.sexe)}</button>`).join('')}</div></div>`; }).join('')}
    <h2 class="sub-h">Les coéquipiers·ères</h2>
    <div class="row c2 crew-pick">${sorted.map((m) => { const on = d.crew.some((c) => c.memberId === m.id); return `<button class="btn big ${on ? 'on' : ''}" data-cem="${m.id}">${on ? '✔ ' : ''}${esc(memberName(m) || '…')}</button>`; }).join('') || '<p class="help">Aucune fiche : créez d’abord les navigants.</p>'}</div>
    <p class="help">Enregistrement automatique.</p>
    <div class="row c2" style="margin-top:12px"><button class="btn big" id="ceNewP">＋ Nouveau coéquipier.ère</button>${base ? '<button class="btn big danger" id="ceDel">🗑 Supprimer</button>' : ''}</div>`;
  // Enregistrement automatique (Corban, v170) : l'équipage est créé dès le premier navigant choisi.
  const saveNow = () => {
    if (!d.crew.length) return;
    // Équipage existant : rien n'est écrit tant que le choix « écraser » ou « nouvel équipage » n'est pas fait (v227).
    if (d.existing && !d.mode) { const b0 = crewSets.find((x) => x.id === d.id); if (b0 && crewFull(b0.crew) !== crewFull(d.crew)) return; if (b0) { const nm = (d.name || '').trim(); if (nm) b0.name = nm; else delete b0.name; saveCrewSets(); } return; }
    const name = (d.name || '').trim();
    let set = crewSets.find((x) => x.id === d.id);
    if (!set) { set = { id: uid(), ident: crewSetIdent(), crew: [] }; crewSets.push(set); d.id = set.id; }
    set.crew = d.crew.map((c) => ({ ...c })); if (name) set.name = name; else delete set.name;
    saveCrewSets();
  };
  if (d._addNew) { delete d._addNew; saveNow(); }
  // v224 (Corban) : photo de groupe de l'équipage, avec une légende posée au centre, en bas de la photo.
  $$('img[data-cphoto]', main).forEach((im) => getPhoto(im.dataset.cphoto).then((u) => { if (u) im.src = u; }));
  main.oninput = (e) => {
    if (e.target.id === 'ceName') { d.name = e.target.value; saveNow(); }
    if (e.target.id === 'ceCap') { const st = crewSets.find((x) => x.id === d.id); if (!st) return; const v = e.target.value.trim(); if (v) st.photoCap = v; else delete st.photoCap; const f = $('#ceCapShow'); if (f) { f.textContent = v; f.hidden = !v; } store.set('ldb.crewSets', crewSets); }
  };
  const pickCrewPhoto = () => {
    const st = crewSets.find((x) => x.id === d.id);
    if (!st) return toast('Choisissez d’abord les coéquipiers·ères de cet équipage');
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try { const id = uid(); await putPhoto(id, await shrinkPhoto(f)); if (st.photo) delPhoto(st.photo); st.photo = id; saveCrewSets(); toast('📷 Photo de groupe ajoutée · écrivez la légende'); renderCrewsEdit(); setTimeout(() => { const c = $('#ceCap'); if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 150); }
      catch { toast('Photo impossible à enregistrer'); }
    };
    inp.click();
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'ceOver') { d.mode = 'over'; saveNow(); toast(`✓ ${base.ident} écrasé, même numéro`); return renderCrewsEdit(); }
    if (b.id === 'ceAsNew') { const set = { id: uid(), ident: crewSetIdent(), crew: d.crew.map((c) => ({ ...c })) }; const nm = (d.name || '').trim(); if (nm && nm !== base.name) set.name = nm; crewSets.push(set); d.id = set.id; d.mode = 'new'; d.name = set.name || ''; saveCrewSets(); toast('✓ Nouvel équipage ' + set.ident); return renderCrewsEdit(); }
    if (b.id === 'ceUndo') { d.crew = base.crew.map((c) => ({ ...c })); toast('Modifications annulées'); return renderCrewsEdit(); }
    if (b.id === 'ceBack' && d.existing && !d.mode && base && crewFull(base.crew) !== crewFull(d.crew)) { toast('Choisissez : écraser, nouvel équipage ou annuler'); const c = $('#ceChoice'); if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('lab-flash'); } return; }
    if (b.id === 'ceBack') { if (d.crew.length) toast('Équipage enregistré'); else if (!base) toast('Équipage vide : pas gardé'); crewsEdit = null; return VIEWS.crews(); }
    // v360 (Corban) : « ＋ Nouveau coéquipier.ère » ouvre directement une fiche vide ; au retour, la personne créée est ajoutée à cet équipage.
    if (b.id === 'ceNewP') { const before = new Set(members.map((m) => m.id)); d.pendingNew = before; ficheFromData = true; crewFicheBack = 'crews'; crewFiche = 'new'; return renderFiche('new'); }
    if (b.id === 'cePhoto') return pickCrewPhoto();
    if (b.id === 'cePhotoDel') return holdDel(b, () => { const st = crewSets.find((x) => x.id === d.id); if (!st || !st.photo) return; delPhoto(st.photo); delete st.photo; delete st.photoCap; saveCrewSets(); toast('Photo retirée'); renderCrewsEdit(); });
    if (b.dataset.cem) {
      const i = d.crew.findIndex((c) => c.memberId === b.dataset.cem);
      if (i >= 0) d.crew.splice(i, 1); else d.crew.push({ memberId: b.dataset.cem, fonction: d.crew.length ? 'Équipier' : 'Skipper' });
      saveNow(); return renderCrewsEdit();
    }
    if (b.dataset.cerole) {
      const f = b.dataset.f;
      if (f !== 'Équipier') d.crew.forEach((c) => { if (c.fonction === f) c.fonction = 'Équipier'; });
      d.crew[Number(b.dataset.cerole)].fonction = f; saveNow(); return renderCrewsEdit();
    }
    if (b.id === 'ceDel') return holdDel(b, () => { crewSets = crewSets.filter((x) => x.id !== d.id); saveCrewSets(); toast('Équipage supprimé'); crewsEdit = null; VIEWS.crews(); });
  };
}
// data › Navigants : la liste des fiches des personnes.
let ficheFromData = false;
VIEWS.people = function renderPeople() { crewFiche = null; crewFicheBack = null; ficheFromData = true; return renderFicheList(); };

/* ---------- Log SOS automatique (Corban, v182) ----------
   Dès qu'on touche SOS, un log démarre et note chaque action (bouton touché, page ouverte) avec l'heure et la position.
   Les logs vont dans data › SOS. Les effacer demande un mot de passe, choisi au premier effacement.
   Le log se met en pause quand on quitte l'appli et repart à la réouverture, tant que la procédure
   n'est pas finie par le bouton « Fin de procédure SOS » (appui long puis confirmation, Corban v182). */
let sosLogs = store.get('ldb.sosLogs', []);
const saveSosLogs = () => store.set('ldb.sosLogs', sosLogs);
function sosLogActive() { return sosLogs.find((x) => !x.end) || null; }
document.addEventListener('visibilitychange', () => {
  if (!sosLogActive()) return;
  if (document.visibilityState === 'hidden') sosLogAdd('Application quittée : log en pause', 'pause');
  else { sosLogAdd('Application rouverte : log repris (procédure SOS pas terminée)', 'resume'); setTimeout(() => toast('🆘 Procédure SOS en cours · log repris'), 300); }
});
function sosLogsCount() { const n = sosLogs.length, a = sosLogActive(); return a ? '⏺ log SOS en cours' : `${n} log${n > 1 ? 's' : ''} SOS automatique${n > 1 ? 's' : ''}`; }
function sosLogPos() { const p = typeof lastKnownPos === 'function' ? lastKnownPos() : null; return p && p.lat != null && (!p.at || Date.now() - new Date(p.at).getTime() < 120000) ? { lat: p.lat, lon: p.lon } : null; }
function sosLogAdd(what, type) {
  let l = sosLogActive(); const t = new Date().toISOString();
  if (!l) {
    l = { id: uid(), start: t, zone: typeof navZone === 'function' ? navZone() : '', nav: cruise ? (cruise.info.name || '') : '', boat: cruise ? (cruise.info.boat || '') : '', events: [{ t, what: 'Début du log SOS', type: 'start' }] };
    sosLogs.push(l);
    setTimeout(() => toast(l.ex ? '🧪 Log d’exercice démarré · rien de réel ne part' : '🆘 Log SOS démarré · toutes les actions sont notées · data › SOS'), 400); // v452 : l'exercice ne s'annonce pas comme un vrai SOS
  }
  const ev = { t, what }; if (type) ev.type = type; const p = sosLogPos(); if (p) ev.pos = p;
  l.events.push(ev); l.last = t; saveSosLogs();
  return l;
}
function sosLogStart(what) {
  const l = sosLogAdd(what, 'sos');
  if (!l.pos0) { const p0 = lastKnownPos(); if (p0 && p0.lat != null) { l.pos0 = { lat: p0.lat, lon: p0.lon, at: p0.at || new Date().toISOString() }; saveSosLogs(); } } // v442 : position de repli si le GPS ne répond pas
  if (navigator.geolocation && !sosExOn()) navigator.geolocation.getCurrentPosition((g) => {
    const pos = { lat: g.coords.latitude, lon: g.coords.longitude };
    if (l.ex) return; // v447 : exercice, pas de vraie position dans le log
    sosPos = { ...pos, at: new Date().toISOString() };
    if (!l.end) { l.events.push({ t: sosPos.at, what: '📍 Position GPS', type: 'pos', pos }); l.last = sosPos.at; saveSosLogs(); }
  }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
}
function sosLogEnd() {
  const l = sosLogActive(); if (!l) return; const t = new Date().toISOString();
  l.events.push({ t, what: '⏹ Fin de procédure SOS', type: 'end', ...(sosLogPos() ? { pos: sosLogPos() } : {}) }); l.end = t; l.last = t; saveSosLogs();
  // Les logs homme à la mer ouverts se terminent avec la procédure.
  if (typeof mobLogs === 'function') { const ml = mobLogs(); let ch = false; for (const m of ml) if (!m.end) { m.events.push({ t, type: 'end', what: 'Fin de procédure SOS' }); m.end = t; ch = true; if (cruise) addEntry({ id: uid(), t, v: { evt: ['Homme à la mer'], note: `Fin de procédure SOS (${Math.round((new Date(t) - new Date(m.start)) / 60000)} min)` } }); } if (ch) saveMobLogs(ml); }
}
// Bouton « Fin de procédure SOS » : appui long, puis un toucher pour confirmer dans les 5 s.
const sosEndBtnHtml = () => (sosLogActive() ? '<button class="btn big danger sos-end" data-sosend="1">⏹ Fin de procédure SOS<small>appui long, puis confirmer</small></button>' : '');
(function bindSosEnd() {
  let t = null, armedB = null, armT = null;
  const disarm = () => { if (armedB) { armedB.classList.remove('sos-end-ask'); armedB.innerHTML = '⏹ Fin de procédure SOS<small>appui long, puis confirmer</small>'; } armedB = null; clearTimeout(armT); };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('[data-sosend]'); if (!b || b === armedB) return;
    clearTimeout(t);
    t = setTimeout(() => { buzz(); disarm(); armedB = b; b.classList.add('sos-end-ask'); b.innerHTML = 'Confirmer la fin de procédure SOS ?<small>toucher encore pour confirmer · sinon rien dans 5 s</small>'; b._lp = true; toast('Toucher encore pour confirmer la fin de procédure SOS · sinon rien dans 5 s'); armT = setTimeout(disarm, 5000); }, 650);
  }, true);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, () => clearTimeout(t), true));
  document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-sosend]')) e.preventDefault(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-sosend]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    if (b._lp) { b._lp = false; return; } // le relâchement de l'appui long n'est pas la confirmation
    if (b !== armedB) { buzz(); toast('Appui long sur « Fin de procédure SOS », puis confirmer'); b.classList.add('lock-ask'); setTimeout(() => b.classList.remove('lock-ask'), 1500); return; }
    if (typeof sosExOn === 'function' && sosExOn()) { buzz(); disarm(); return sosExEnd(); } // v452 : en exercice, la fin de procédure ramène aussi dans Réglages › Simulation SOS
    buzz(); disarm(); sosLogEnd(); toast('✓ Procédure SOS terminée · log gardé dans data › SOS');
    // Le bouton passe en vert « procédure terminée », puis s'efface au bout de quelques secondes (Corban, v183).
    delete b.dataset.sosend; b.classList.add('sos-end-done'); b.innerHTML = '✓ Procédure SOS terminée<small>log gardé dans data › SOS</small>';
    const v = currentView;
    setTimeout(() => { b.classList.add('sos-end-gone'); setTimeout(() => { b.remove(); if (currentView === v && VIEWS[v]) { const y = window.scrollY; VIEWS[v](); window.scrollTo(0, y); } }, 600); }, 3000);
  }, true);
})();
/* v442 (Corban) : sous le bandeau « Procédure SOS en cours », trois lignes :
   1) la position SOS figée au moment du toucher (premier relevé GPS du log), en chiffres et en mots
      (« entre Lausanne et Évian, à environ 3 km de Lausanne ») ;
   2) la position actuelle, relevée toutes les 30 s tant que la page SOS est ouverte ;
   3) le Go To de la position actuelle vers la position SOS (cap vrai et distance).
   Lieux connus : rives du Léman et côte de Provence (coordonnées publiques approchées). */
const SOS_PLACES = [
  ['Genève', 46.204, 6.152], ['Versoix', 46.283, 6.165], ['Coppet', 46.316, 6.191], ['Nyon', 46.383, 6.239], ['Rolle', 46.458, 6.337],
  ['Morges', 46.509, 6.498], ['Saint-Sulpice', 46.51, 6.56], ['Lausanne', 46.506, 6.627], ['Lutry', 46.503, 6.686], ['Cully', 46.488, 6.729],
  ['Vevey', 46.46, 6.843], ['Montreux', 46.433, 6.911], ['Villeneuve', 46.397, 6.927], ['Le Bouveret', 46.384, 6.857], ['Saint-Gingolph', 46.392, 6.804],
  ['Meillerie', 46.408, 6.723], ['Évian', 46.401, 6.59], ['Thonon', 46.371, 6.479], ['Yvoire', 46.37, 6.326], ['Hermance', 46.302, 6.242],
  ['Marseille', 43.296, 5.37], ['Cassis', 43.214, 5.538], ['La Ciotat', 43.174, 5.605], ['Bandol', 43.136, 5.753], ['Sanary', 43.119, 5.801],
  ['cap Sicié', 43.047, 5.858], ['Toulon', 43.12, 5.93], ['Hyères', 43.08, 6.16], ['Porquerolles', 43.0, 6.2], ['Port-Cros', 43.006, 6.39],
  ['Le Lavandou', 43.137, 6.369], ['Cavalaire', 43.172, 6.531], ['Saint-Tropez', 43.272, 6.64], ['Sainte-Maxime', 43.309, 6.636], ['Saint-Raphaël', 43.424, 6.768],
];
const SOS_DIRS = ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'];
const deN = (n) => { // v448 : « du Bouveret », « du cap Camarat », « d’Hermance », « de la rade »…
  if (/^Le /.test(n)) return 'du ' + n.slice(3); if (/^Les /.test(n)) return 'des ' + n.slice(4); if (/^La /.test(n)) return 'de la ' + n.slice(3);
  if (/^(cap|phare|port)\b/.test(n)) return 'du ' + n; if (/^(Hermance)/.test(n)) return 'd’' + n;
  return /^[AEIOUYÉÈÊÂÎaeiouyéèî]/.test(n) ? 'd’' + n : 'de ' + n; };
const kmTxt = (km) => (km < 1 ? 'moins de 1 km' : `environ ${String(km < 10 ? Math.round(km * 2) / 2 : Math.round(km)).replace('.', ',')} km`);
/* v448 (Corban) : carte virtuelle pour dire la position aux secours, zone par zone.
   Léman : 41 repères des deux rives + 18 lignes d'une rive à l'autre ; on dit la ligne la plus proche et la distance en km
   au repère le plus proche sur cette ligne (« Sur la ligne Ouchy – Évian, à 5 km d'Ouchy »).
   Mer, zone 1 (cap Sicié → après Saint-Tropez) : amers (caps, phares, îles, ports) ; on dit « à 2,1 milles dans le 165° du
   cap Camarat » (distance et direction depuis l'amer vers le bateau). Positions approchées, à affiner avec Corban. */
const LEMAN_MARKS = {
  'Genève (Jet d’eau)': [46.207, 6.156], 'Bellevue': [46.25, 6.15], 'Versoix': [46.283, 6.165], 'Coppet': [46.316, 6.191], 'Céligny': [46.35, 6.21],
  'Cologny': [46.215, 6.18], 'Collonge-Bellerive': [46.25, 6.2], 'Hermance': [46.302, 6.242], 'Chens-sur-Léman': [46.32, 6.27], 'Nernier': [46.36, 6.3],
  'Nyon': [46.383, 6.239], 'Prangins': [46.395, 6.25], 'Gland': [46.42, 6.27], 'Rolle': [46.458, 6.337], 'Saint-Prex': [46.48, 6.455],
  'Yvoire': [46.37, 6.326], 'Excenevex': [46.35, 6.355], 'Sciez': [46.34, 6.39], 'Anthy': [46.355, 6.43],
  'Morges': [46.509, 6.498], 'Saint-Sulpice': [46.51, 6.56], 'Vidy': [46.515, 6.595], 'Ouchy': [46.506, 6.627], 'Pully': [46.508, 6.66], 'Lutry': [46.503, 6.686],
  'Thonon (port de Rives)': [46.375, 6.48], 'Amphion': [46.4, 6.53], 'Évian': [46.401, 6.59], 'Lugrin': [46.405, 6.655],
  'Cully': [46.488, 6.729], 'Saint-Saphorin': [46.473, 6.795], 'Vevey': [46.46, 6.843], 'La Tour-de-Peilz': [46.452, 6.857], 'Clarens': [46.44, 6.89],
  'Montreux': [46.433, 6.911], 'Château de Chillon': [46.414, 6.927], 'Villeneuve': [46.397, 6.927],
  'Meillerie': [46.408, 6.723], 'Saint-Gingolph': [46.392, 6.804], 'Le Bouveret': [46.384, 6.857], 'embouchure du Rhône': [46.39, 6.89],
};
const LEMAN_LINES = [
  ['Bellevue', 'Collonge-Bellerive'], ['Versoix', 'Hermance'], ['Coppet', 'Chens-sur-Léman'], ['Céligny', 'Nernier'],
  ['Nyon', 'Yvoire'], ['Prangins', 'Excenevex'], ['Gland', 'Sciez'], ['Rolle', 'Anthy'], ['Saint-Prex', 'Thonon (port de Rives)'],
  ['Morges', 'Thonon (port de Rives)'], ['Saint-Sulpice', 'Amphion'], ['Ouchy', 'Évian'], ['Lutry', 'Lugrin'],
  ['Cully', 'Meillerie'], ['Saint-Saphorin', 'Saint-Gingolph'], ['Vevey', 'Le Bouveret'], ['Montreux', 'Le Bouveret'], ['Château de Chillon', 'embouchure du Rhône'],
];
const SEA_ZONE1_MARKS = {
  'cap Sicié': [43.047, 5.858], 'Le Brusc': [43.073, 5.802], 'île des Embiez': [43.078, 5.785], 'Saint-Mandrier': [43.08, 5.925], 'cap Cépet': [43.075, 5.945],
  'entrée de la rade de Toulon': [43.09, 5.93], 'cap Brun': [43.093, 5.968], 'Carqueiranne': [43.085, 6.073], 'presqu’île de Giens (pointe ouest)': [43.03, 6.085],
  'La Tour Fondue (Giens)': [43.028, 6.157], 'port d’Hyères': [43.08, 6.16], 'port de Porquerolles': [43.0, 6.203], 'phare de Porquerolles (cap d’Arme)': [42.985, 6.205],
  'port de Port-Cros': [43.01, 6.385], 'île du Levant (pointe est)': [43.04, 6.51], 'cap Bénat': [43.088, 6.365], 'Le Lavandou': [43.137, 6.369],
  'Cavalaire': [43.172, 6.531], 'cap Lardier': [43.164, 6.614], 'cap Taillat': [43.172, 6.64], 'cap Camarat (phare)': [43.2, 6.682], 'Pampelonne': [43.235, 6.665],
  'Saint-Tropez': [43.272, 6.637], 'Sainte-Maxime': [43.307, 6.636], 'Les Issambres': [43.34, 6.7], 'Saint-Aygulf': [43.39, 6.72],
};
const kmWord = (km) => String(km < 10 ? Math.round(km * 10) / 10 : Math.round(km)).replace('.', ',');
function lemanLineWords(p) {
  const kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57; // km par degré (plan local)
  let best = null;
  for (const [na, nb] of LEMAN_LINES) {
    const A = LEMAN_MARKS[na], B = LEMAN_MARKS[nb]; if (!A || !B) continue;
    const ax = A[1] * kx, ay = A[0] * ky, bx = B[1] * kx - ax, by = B[0] * ky - ay, px = p.lon * kx - ax, py = p.lat * ky - ay;
    const L2 = bx * bx + by * by; if (!L2) continue; const t = (px * bx + py * by) / L2; if (t < 0 || t > 1) continue;
    const d = Math.abs(px * by - py * bx) / Math.sqrt(L2); const len = Math.sqrt(L2);
    if (!best || d < best.d) best = { na, nb, t, d, len, side: (px - t * bx) > 0 ? 'est' : 'ouest' };
  }
  if (!best || best.d > 1.5) return '';
  const near = best.t <= 0.5 ? best.na : best.nb, dist = (best.t <= 0.5 ? best.t : 1 - best.t) * best.len;
  const side = best.d > 0.3 ? `, à ${best.d < 1 ? Math.round(best.d * 10) * 100 + ' m' : kmWord(best.d) + ' km'} à l’${best.side} de l’axe` : '';
  return `dans l’axe entre ${best.na} et ${best.nb}, à ${dist < 0.3 ? 'moins de 300 m' : kmWord(dist) + ' km'} ${deN(near)}${side}`;
}
function sosZoneWords(p) {
  if (!p || p.lat == null || typeof distNM !== 'function') return null;
  if (p.lat > 46.19 && p.lat < 46.56 && p.lon > 6.1 && p.lon < 6.96) { // Léman
    const fr = typeof inFrenchLeman === 'function' && inFrenchLeman(p) ? 'eaux françaises' : 'eaux suisses';
    const ln = lemanLineWords(p);
    if (ln) return `${ln[0].toUpperCase()}${ln.slice(1)} · ${fr}`;
    const near = Object.entries(LEMAN_MARKS).map(([n, [lat, lon]]) => ({ n, km: distNM(p, { lat, lon }) * 1.852, from: bearing({ lat, lon }, p) })).sort((x, y) => x.km - y.km)[0];
    return `À ${near.km < 0.3 ? 'moins de 300 m' : 'environ ' + kmWord(near.km) + ' km'} ${SOS_DIRS[Math.round(near.from / 45) % 8]} ${deN(near.n)} · ${fr}`;
  }
  const sea = Object.entries(SEA_ZONE1_MARKS).map(([n, [lat, lon]]) => ({ n, nm: distNM(p, { lat, lon }), from: bearing({ lat, lon }, p) })).sort((x, y) => x.nm - y.nm)[0];
  if (sea && sea.nm < 12) {
    if (sea.nm < 0.15) return `Tout près ${deN(sea.n)}`;
    return `À ${String(sea.nm < 10 ? sea.nm.toFixed(1) : Math.round(sea.nm)).replace('.0', '').replace('.', ',')} mille${sea.nm >= 1.95 ? 's' : ''} dans le ${String(Math.round(sea.from) % 360).padStart(3, '0')}° ${deN(sea.n)}`;
  }
  return null;
}
function sosPlaceWords(p) {
  { const z = sosZoneWords(p); if (z) return z; } // v448 : zones détaillées (Léman, mer zone 1), sinon l'ancien repérage
  if (!p || p.lat == null || typeof distNM !== 'function') return '';
  const all = SOS_PLACES.map(([n, lat, lon]) => { const q = { lat, lon }; return { n, km: distNM(p, q) * 1.852, brg: bearing(p, q), from: bearing(q, p) }; }).sort((x, y) => x.km - y.km);
  const A = all[0]; if (!A || A.km > 60) return '';
  const B = all.slice(1).find((x) => x.km < 30 && x.km < A.km * 6 && angDiff(x.brg, A.brg) > 110);
  if (B && A.km >= 0.5) return `entre ${A.n} et ${B.n}, à ${kmTxt(A.km)} ${deN(A.n)}`;
  return `à ${kmTxt(A.km)} ${SOS_DIRS[Math.round(A.from / 45) % 8]} ${deN(A.n)}`;
}
let sosSim = null; // v443 : simulation de position (voir sosPosTick)
function sosPosFrozen(l) { if (sosSim) return { lat: sosSim.lat, lon: sosSim.lon, at: new Date(sosSim.t0).toISOString() };
  const e = l && l.events.find((x) => x.type === 'pos' && x.pos); return e ? { ...e.pos, at: e.t } : (l && l.pos0) || null; }
let sosLive = null; // dernière position relevée par la page SOS (toutes les 30 s)
function sosPosLines() {
  const l = sosLogActive(); if (!l && !sosSim) return '';
  const f = sosPosFrozen(l), c = sosLive || (typeof lastKnownPos === 'function' ? lastKnownPos() : null);
  const pos = (p) => (p ? `<b>${esc(fmtPos(p)).split(/\s{2,}/).map((x) => `<span class="sp-c">${x}</span>`).join(' ')}</b>${sosPlaceWords(p) ? `<small>${esc(sosPlaceWords(p))}</small>` : ''}` : '<b>– –</b><small>GPS en attente</small>');
  let go = '<b>– –</b>';
  if (f && c && c.lat != null) {
    const nm = distNM(c, f), m = nm * 1852;
    go = m < 15 ? '<b>Vous êtes sur la position SOS</b>' : `<b>Cap ${String(Math.round(bearing(c, f))).padStart(3, '0')}° · ${String(nm < 10 ? nm.toFixed(2) : nm.toFixed(1)).replace('.', ',')} NM</b><small>${m < 1000 ? Math.round(m) + ' m' : String((m / 1000).toFixed(1)).replace('.', ',') + ' km'}</small>`;
  }
  return `<div class="sp-row"><span class="sp-k">🆘 Position GPS au déclenchement du bouton SOS${f && f.at ? ` · ${tzHtml(new Date(f.at), true)}` : ''}</span>${pos(f)}</div>
    <div class="sp-row"><span class="sp-k">📍 Position actuelle mise à jour toutes les 5 secondes${c && c.at ? ` · ${tzHtml(new Date(c.at), true)}` : ''}</span>${pos(c)}</div>
    <div class="sp-row"><span class="sp-k">➜ Go To vers la position SOS</span>${go}</div>
    ${sosSim && !sosExOn() ? '<div class="row"><button type="button" class="btn" data-sossim="stop">⏹ Arrêter la simulation</button></div>' : ''}`; // v446 (Corban) : les simulations se lancent depuis Réglages › 🧪 Tests
}
/* v447 (Corban) : « Simulation complète du bouton SOS » (Réglages › 🧪 Tests). Un exercice se déroule comme un vrai SOS :
   log, position SOS figée, position qui bouge (simulée), Go To, numéros selon la zone, homme à la mer, fin de procédure.
   Différences : le log est marqué « 🧪 Exercice », un bandeau orange reste visible partout, et AUCUN appel ni SMS ne part
   (le toucher est noté dans le log). L'exercice se termine par « ⏹ Terminer l'exercice » ou par la fin de procédure SOS. */
const sosExOn = () => { const l = typeof sosLogActive === 'function' ? sosLogActive() : null; return !!(l && l.ex); };
let sosExWas = false;
function sosExStart(k) {
  if (sosLogActive() && !sosExOn()) { toast('⚠ Une vraie procédure SOS est en cours : terminez-la avant un exercice'); return; }
  if (typeof window.sosSimStart === 'function') window.sosSimStart(k);
  sosLogStart('🧪 Exercice : touche SOS (' + ({ ch: 'large de Lausanne', fr: 'vers Meillerie, eaux françaises', mer: 'large de Toulon, en mer' }[k] || k) + ')');
  const l = sosLogActive(); if (l) { l.ex = true; saveSosLogs(); }
  sosExBack = typeof currentView !== 'undefined' && currentView === 'settings' ? { from: settingsFrom, all: settingsAll } : null; // v451 : d'où l'exercice a été lancé
  sosExWas = true; sosExRibbon(); go('sos');
  setTimeout(() => toast('🧪 Exercice SOS commencé · aucun appel réel ne part · ⏹ Terminer l’exercice dans le bandeau'), 900);
}
let sosExBack = null;
/* v451 (Corban) : « ⏹ Terminer l'exercice » ramène dans Réglages › 🆘 Simulation SOS (là où l'exercice a été lancé), plus sur la page SOS. */
function sosExEnd() {
  const back = sosExBack; sosExBack = null;
  if (sosExOn()) sosLogEnd(); sosExCleanup();
  if (back) { settingsFrom = back.from; settingsAll = back.all; go._gear = !!back.from; } else settingsAll = true;
  settingsOpen = 'simu'; go('settings');
  const d = document.querySelector('details.set-sec[data-sec="simu"]'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
  toast('✓ Exercice SOS terminé · log gardé dans data › Logs SOS (🧪 Exercice)');
}
function sosExCleanup() { sosExWas = false; sosSim = null; sosLive = null; const r = document.getElementById('exRibbon'); if (r) r.remove(); document.body.classList.remove('sos-ex'); }
function sosExRibbon() {
  if (!sosExOn() || document.getElementById('exRibbon')) return;
  const r = document.createElement('div'); r.id = 'exRibbon'; r.className = 'no-print';
  r.innerHTML = '<span>🧪 EXERCICE SOS · aucun appel réel</span><button type="button" class="btn" data-sosex="end">⏹ Terminer l’exercice</button>';
  document.body.appendChild(r); document.body.classList.add('sos-ex');
}
setInterval(() => { if (sosExOn()) sosExRibbon(); }, 1000);
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-sosex]'); if (b) { e.stopPropagation(); e.preventDefault(); if (typeof buzz === 'function') buzz(); return b.dataset.sosex === 'end' ? sosExEnd() : sosExStart(b.dataset.sosex); }
  if (!sosExOn()) return;
  const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const n = a.getAttribute('href').replace(/^(tel|sms):/, ''); sosLogAdd(`🧪 Exercice : appel au ${n} (non passé)`, 'note');
  toast(`🧪 Exercice : l’appel au ${n} n’est pas passé. En vrai, le téléphone appellerait ce numéro.`);
}, true);
{ const _openLink = openLink; openLink = function (url) { if (sosExOn() && /^(tel|sms):/.test(String(url))) { const n = String(url).replace(/^(tel|sms):/, ''); sosLogAdd(`🧪 Exercice : appel au ${n} (non passé)`, 'note'); toast(`🧪 Exercice : l’appel au ${n} n’est pas passé.`); return; } return _openLink(url); }; }
function sosPosBlock() { return sosLogActive() || sosSim ? `<section class="field sos-pos" id="sosPosBox">${sosPosLines()}</section>` : ''; }
(function sosPosTick() {
  const upd = () => { const bx = document.getElementById('sosPosBox'); if (bx) bx.innerHTML = sosPosLines(); };
  /* v443 (Corban) : « 🧪 Simuler une vraie position » (aperçu sans GPS) : la position SOS est posée au large de Lausanne (lac)
     ou de Toulon (mer), puis le bateau s'en éloigne à 3 nœuds cap 060, une nouvelle position toutes les 5 s.
     Rien n'est écrit dans le log : la simulation ne sert qu'à voir l'affichage. */
  const simStep = () => { if (!sosSim) return; const t = (Date.now() - sosSim.t0) / 3600000 * 3 + 0.15; const d = t / 60; sosLive = { lat: sosSim.lat + d * Math.cos(Math.PI / 3), lon: sosSim.lon + d * Math.sin(Math.PI / 3) / Math.cos(sosSim.lat * Math.PI / 180), at: new Date().toISOString() };
    const fr = typeof inFrenchLeman === 'function' && inFrenchLeman(sosLive); if (sosSim.fr !== undefined && fr !== sosSim.fr && currentView === 'sos' && VIEWS.sos) { sosSim.fr = fr; const y = window.scrollY; VIEWS.sos(); window.scrollTo(0, y); return; } sosSim.fr = fr; upd(); };
  window.sosSimStart = (k) => { const P0 = { ch: [46.47, 6.62], fr: [46.418, 6.72], mer: [43.06, 5.98] }[k] || [46.47, 6.62]; sosSim = { lat: P0[0], lon: P0[1], t0: Date.now() }; simStep(); }; // v447 : aussi pour l'exercice complet
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-sossim]'); if (!b) return; e.stopPropagation();
    const k = b.dataset.sossim;
    if (k === 'stop' || (sosSim && currentView === 'sos')) { sosSim = null; sosLive = null; } else { const P0 = { ch: [46.47, 6.62], fr: [46.418, 6.72], mer: [43.06, 5.98] }[k] || [46.47, 6.62]; sosSim = { lat: P0[0], lon: P0[1], t0: Date.now() }; simStep(); }
    if (typeof buzz === 'function') buzz();
    if (sosSim && currentView !== 'sos') { go('sos'); return; } // v446 : lancée depuis les Tests, ouvre la page SOS (sans procédure ni log)
    if (currentView === 'sos' && VIEWS.sos) { const y = window.scrollY; VIEWS.sos(); window.scrollTo(0, y); } else upd(); // v444 : la page se refait, les numéros suivent la position simulée
  }, true);
  const fix = () => {
    if (sosSim) return simStep();
    if (typeof currentView === 'undefined' || currentView !== 'sos' || !sosLogActive() || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((g) => { sosLive = { lat: g.coords.latitude, lon: g.coords.longitude, at: new Date().toISOString() }; upd(); }, () => upd(), { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 });
  };
  setInterval(() => (sosSim ? simStep() : fix()), 5000); setTimeout(fix, 1500); // v443 (Corban) : toutes les 5 s
  let was = null; setInterval(() => { const cv = typeof currentView !== 'undefined' ? currentView : null; if (cv === 'sos' && was !== 'sos') fix(); if (was === 'sos' && cv !== 'sos' && sosSim && !sosExOn()) { sosSim = null; sosLive = null; } if (sosExWas && !sosExOn()) sosExCleanup(); sosExWas = sosExOn(); was = cv; }, 1000); // v446 : la simulation s'arrête en quittant la page SOS
})();
function sosLogBanner() {
  const l = sosLogActive(); if (!l) return '';
  return `<button class="btn big sos-log-on" data-go="soslogs">${l.ex ? '🧪 Exercice · ' : ''}⏺ Procédure SOS en cours depuis ${tzHtml(l.start, true)}<small>${l.events.length} action${l.events.length > 1 ? 's' : ''} notée${l.events.length > 1 ? 's' : ''} · toucher pour voir le log</small></button>`;
}
// Chaque toucher pendant un log SOS est noté (sauf dans la page des logs elle-même).
document.addEventListener('click', (e) => {
  if (!sosLogActive() || currentView === 'soslogs') return;
  const el = e.target.closest && e.target.closest('button, a, [data-step], [role="button"], summary');
  if (!el || el.closest('.top-tab.tab-sos, [data-sosend]')) return;
  const txt = (el.dataset.label || el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (!txt) return;
  const page = (typeof VIEW_LABELS !== 'undefined' && VIEW_LABELS[currentView]) || currentView;
  const href = el.getAttribute && el.getAttribute('href');
  sosLogAdd(`${page} › ${txt}${href && /^tel:/.test(href) ? ' (' + href.slice(4) + ')' : ''}`);
}, true);
async function sosHash(s) {
  const txt = 'navin-sos:' + s;
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 5381; for (const c of txt) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return 'd' + h.toString(16); }
}
function sosLogText(l) {
  const lines = [`LOG SOS · ${fmtShortDate(new Date(l.start))}${l.boat ? ' · ' + l.boat : ''}${l.nav ? ' · ' + l.nav : ''}`];
  for (const e of l.events) { const d = new Date(e.t); lines.push(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${l.zone === 'lac' ? '' : ` · ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`}  ${e.what}${e.pos ? '  (' + fmtPos(e.pos) + ')' : ''}`); }
  if (l.end) lines.push(`Durée : ${Math.round((new Date(l.end) - new Date(l.start)) / 60000)} min`);
  return lines.join('\n');
}
let sosDelId = null;
const slHm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
VIEWS.soslogs = function renderSosLogs() {
  const main = $('#view');
  const act = sosLogActive();
  const hasPwd = !!store.get('ldb.sosPwd', '');
  const list = sosLogs.slice().reverse();
  const lg = (l, html) => { tzLocalOnly = l.zone === 'lac'; const h = html(); tzLocalOnly = false; return h; };
  const evHtml = (e) => `<li class="mob-ev ${e.type || ''}"><b>${tzHtml(e.t, true)}</b><span>${esc(e.what)}<small class="mob-ev-pos">${e.pos ? esc(fmtPos(e.pos)) + (sosPlaceWords(e.pos) ? ' · ' + esc(sosPlaceWords(e.pos)) : '') : ''}</small></span></li>`;
  main.innerHTML = `
    <button class="btn" data-go="more">◀ data</button>
    <h1>🆘 SOS · logs</h1>
    <p class="help">Dès qu’on touche SOS, un log démarre tout seul et note chaque action avec l’heure et la position. Si on quitte l’appli, il se met en pause et repart à la réouverture. Seule la « Fin de procédure SOS » (appui long, puis confirmer) l’arrête.</p>
    ${act ? `<div class="mob-live"><b>${act.ex ? '🧪 Exercice · ' : ''}⏺ Procédure SOS en cours depuis ${lg(act, () => tzHtml(act.start, true))} · ${act.events.length} actions</b>
      <ol class="mob-log">${lg(act, () => act.events.map(evHtml).join(''))}</ol>
      <div class="row ck-pub-row"><button class="btn big ck-pub" data-share="${act.id}">📤 Publier<small>image, PDF ou texte</small></button></div>${sosEndBtnHtml()}</div>` : ''}
    ${list.filter((l) => l.end).map((l) => `<details class="section"><summary>${l.ex ? '🧪 Exercice · ' : ''}${esc(fmtShortDate(new Date(l.start)))} · ${slHm(l.start)} → ${slHm(l.end)} · ${l.events.length} actions${l.boat ? ' · ' + esc(l.boat) : ''}</summary>
      <div style="padding:0 14px 12px"><ol class="mob-log">${lg(l, () => l.events.map(evHtml).join(''))}</ol>
      <div class="row c2"><button class="btn ck-pub" data-share="${l.id}">📤 Publier</button><button class="btn danger" data-del="${l.id}">🗑 Effacer</button></div>
      ${sosDelId === l.id ? `<div class="sl-pwd"><input class="text" type="password" id="slPwd" placeholder="${hasPwd ? 'Mot de passe' : 'Choisir un mot de passe'}" autocomplete="off">
        ${hasPwd ? '' : '<input class="text" type="password" id="slPwd2" placeholder="Répéter le mot de passe" autocomplete="off">'}
        <button class="btn big danger" data-delok="${l.id}">${hasPwd ? 'Effacer ce log' : 'Définir le mot de passe et effacer'}</button></div>` : ''}</div></details>`).join('') || (act ? '' : '<p class="help">Aucun log SOS pour l’instant.</p>')}
    <details class="section"><summary>🔑 Mot de passe d’effacement</summary><div style="padding:0 14px 12px">
      ${hasPwd ? `<p class="help">Un mot de passe est défini. Pour le changer, entrez l’ancien puis le nouveau.</p>
        <input class="text" type="password" id="slOld" placeholder="Ancien mot de passe" autocomplete="off">` : '<p class="help">Aucun mot de passe pour l’instant : il sera demandé au premier effacement, ou définissez-le ici.</p>'}
      <input class="text" type="password" id="slNew" placeholder="Nouveau mot de passe" autocomplete="off">
      <input class="text" type="password" id="slNew2" placeholder="Répéter le nouveau" autocomplete="off">
      <button class="btn big" id="slSet">${hasPwd ? 'Changer le mot de passe' : 'Définir le mot de passe'}</button>
      <p class="help">Le mot de passe protège contre un effacement par erreur sur ce téléphone. Il ne chiffre pas les logs.</p></div></details>`;
  const pwdOk = async (v) => (await sosHash(v)) === store.get('ldb.sosPwd', '');
  main.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.share) { if (window.lxOpen) return window.lxOpen('soslogs', b.dataset.share); const l = sosLogs.find((x) => x.id === b.dataset.share); if (l) deliver(sosLogText(l), `log-sos-${l.start.slice(0, 16).replace(/[:T]/g, '-')}.txt`, 'text/plain'); return; }
    if (b.dataset.del) { sosDelId = sosDelId === b.dataset.del ? null : b.dataset.del; VIEWS.soslogs(); const d = main.querySelector(`[data-del="${b.dataset.del}"]`); if (d) { d.closest('details').open = true; const i = $('#slPwd'); if (i) i.focus(); } return; }
    if (b.dataset.delok) {
      const v = ($('#slPwd') || {}).value || '';
      if (!v) { toast('Entrez le mot de passe'); return; }
      if (!store.get('ldb.sosPwd', '')) {
        if (v.length < 4) { toast('Au moins 4 caractères'); return; }
        if (v !== ($('#slPwd2') || {}).value) { toast('Les deux mots de passe sont différents'); return; }
        store.set('ldb.sosPwd', await sosHash(v));
      } else if (!(await pwdOk(v))) { toast('⚠ Mot de passe incorrect : rien n’est effacé'); return; }
      sosLogs = sosLogs.filter((x) => x.id !== b.dataset.delok); saveSosLogs(); sosDelId = null;
      toast('Log SOS effacé'); return VIEWS.soslogs();
    }
    if (b.id === 'slSet') {
      if (store.get('ldb.sosPwd', '') && !(await pwdOk($('#slOld').value))) { toast('⚠ Ancien mot de passe incorrect'); return; }
      const n = $('#slNew').value; if (n.length < 4) { toast('Au moins 4 caractères'); return; }
      if (n !== $('#slNew2').value) { toast('Les deux mots de passe sont différents'); return; }
      store.set('ldb.sosPwd', await sosHash(n)); toast('Mot de passe enregistré'); return VIEWS.soslogs();
    }
  };
};

/* ---------- Effacer par swipe, avec confirmation à chaque fois (Corban, v183) ----------
   Navigations, navigants, bateaux et traces : glisser la ligne vers la gauche fait apparaître
   « 🗑 Supprimer … ? » juste en dessous ; un toucher sur ce bouton confirme, « Annuler » ou 5 s sans rien referme. */
function deleteTrace(tid) {
  const [cid, k] = String(tid).split('#');
  if (typeof tracking !== 'undefined' && tracking && cruise && cruise.id === cid) { toast('⚠ Trace en cours : arrêtez-la d’abord'); return false; }
  const t = store.get('ldb.track.' + cid, []);
  const segs = [0, ...store.get('ldb.trkSegs.' + cid, []).filter((i) => i > 0 && i < t.length)].sort((a, b) => a - b);
  if (k != null && segs.length > 1) {
    const i = Number(k), a = segs[i], b = segs[i + 1] ?? t.length, len = b - a;
    const nt = t.slice(0, a).concat(t.slice(b));
    const ns = [...new Set(segs.filter((_, j) => j !== i).map((s) => (s > a ? s - len : s)))].filter((s) => s > 0 && s < nt.length);
    store.set('ldb.track.' + cid, nt); store.set('ldb.trkSegs.' + cid, ns);
    toast('Trace supprimée'); return true;
  }
  // Trace seule de sa navigation : si la navigation ne contient rien d'autre (que des points automatiques),
  // elle part avec, et son numéro unique se libère.
  const data = store.get('ldb.cruise.' + cid, null);
  const other = data ? (data.entries || []).filter((e) => !e.auto).length + (data.crew || []).length + (data.photos || []).length : 0;
  if (!other) { removeCruise(cid); toast('Trace supprimée, avec sa navigation vide'); }
  else { store.del('ldb.track.' + cid); store.del('ldb.trkSegs.' + cid); toast('Trace supprimée · la navigation et son journal restent'); }
  return true;
}
(function bindSwipeDelete() {
  const KINDS = [
    { sel: '#view article.entry[data-id]', when: () => currentView === 'cruises', id: (el) => el.dataset.id, name: (el) => (el.querySelector('.when span') || el).textContent.trim(), del: (id) => { removeCruise(id); }, after: () => VIEWS.cruises() },
    { sel: '#view button[data-fiche]', when: () => true, id: (el) => el.dataset.fiche, name: (el) => (el.firstChild && el.firstChild.textContent || '').trim(), block: (id) => memberLockMsg(id), del: (id) => { members = members.filter((x) => x.id !== id); saveMembers(); }, after: () => renderFicheList() },
    { sel: '#view details[data-b] > summary', when: () => currentView === 'boats', id: (el) => el.parentElement.dataset.b, name: (el) => (el.firstChild && el.firstChild.textContent || '').replace('🚤', '').trim(), del: (id) => { boats = boats.filter((x) => x.id !== id); saveBoats(); }, after: () => VIEWS.boats() },
    { sel: '.trk-item', when: () => true, id: (el) => { const b = el.querySelector('[data-show]'); return b && b.dataset.show; }, name: (el) => (el.querySelector('b') || el).textContent.trim(), del: (id) => deleteTrace(id), after: () => drawTrkList() },
  ];
  let st = null, swiped = false, openRow = null, openT = null;
  const kindOf = (t) => { for (const k of KINDS) { const el = t.closest && t.closest(k.sel); if (el && k.when()) return [k, el]; } return null; };
  const closeRow = () => { clearTimeout(openT); if (openRow) { openRow.remove(); openRow = null; } };
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('.sw-confirm')) return;
    const f = kindOf(e.target); if (!f) return;
    st = { k: f[0], el: f[1], x: e.clientX, y: e.clientY, dx: 0, on: false };
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.on) { if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { st = null; return; } if (dx < -12 && Math.abs(dx) > Math.abs(dy)) st.on = true; else return; }
    st.dx = Math.min(0, dx);
    st.el.classList.add('sw-moving'); st.el.style.transform = `translateX(${Math.max(st.dx, -140)}px)`;
  }, true);
  const end = () => {
    if (!st) return; const s = st; st = null;
    s.el.style.transform = ''; s.el.classList.remove('sw-moving');
    if (!s.on) return;
    swiped = true; setTimeout(() => { swiped = false; }, 400);
    if (s.dx > -70) return;
    const id = s.k.id(s.el); if (!id) return;
    if (s.k.block) { const m = s.k.block(id); if (m) { buzz(); toast(m); return; } }
    buzz(); closeRow();
    const row = document.createElement('div'); row.className = 'sw-confirm';
    row.innerHTML = `<button class="btn danger" data-swok="1"></button><button class="btn" data-swno="1">Annuler</button>`;
    const anchor = s.el.tagName === 'SUMMARY' ? s.el.parentElement : s.el;
    anchor.after(row); openRow = row; row._k = s.k; row._id = id;
    const k = s.k;
    holdDel(row.querySelector('[data-swok]'), () => { closeRow(); if (k.del(id) !== false) { if (k !== KINDS[3]) toast('Supprimé'); k.after(); } }, `🗑 Supprimer « ${esc(s.k.name(s.el)).slice(0, 60)} » ?`);
    toast('Appui long sur « Supprimer » pour confirmer · sinon rien dans 5 s');
    openT = setTimeout(closeRow, 5000);
  };
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', () => { if (st) { st.el.style.transform = ''; st.el.classList.remove('sw-moving'); st = null; } }, true);
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.sw-confirm');
    if (c) {
      e.stopPropagation(); e.preventDefault(); buzz();
      { const ok = e.target.closest('[data-swok]'); if (ok) { if (!ok._done) toast('Appui long pour confirmer la suppression'); } else closeRow(); }
      return;
    }
    if (swiped && kindOf(e.target)) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, true);
})();

/* v453 (Corban) : on voit toujours dans quel menu on est.
   · Réglages ouverts (ou simulation SOS lancée depuis les Réglages) : la roue a ses barres blanches sur une pastille grise.
   · Pendant une simulation SOS (exercice ou position simulée) : « SIMULATION » en noir, en travers du bouton SOS. */
(function topStateTick() {
  const tick = () => {
    const simu = (typeof sosSim !== 'undefined' && !!sosSim) || (typeof sosExOn === 'function' && sosExOn());
    const cv = typeof currentView !== 'undefined' ? currentView : '';
    document.body.classList.toggle('gear-on', cv === 'settings' || simu);
    document.body.classList.toggle('sos-simu', simu);
    const sb = document.querySelector('.top-tab.tab-sos');
    if (sb) { const tag = sb.querySelector('.sos-simu-tag'); if (simu && !tag) sb.insertAdjacentHTML('beforeend', '<span class="sos-simu-tag" aria-hidden="true">SIMULATION</span>'); else if (!simu && tag) tag.remove(); }
  };
  setInterval(tick, 300); document.addEventListener('click', () => setTimeout(tick, 30), true);
})();

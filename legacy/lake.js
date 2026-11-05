'use strict';

/* =====================================================================
   SORTIES LACUSTRES : base de bateaux, check-list, fiche du jour à envoyer
   ===================================================================== */
const LAKE_CONTACTS = [
  'Urgence (Europe) : 112',
  'Police, sauvetage sur le lac (Suisse) : 117',
  'Ambulance (Suisse) : 144',
  'Rega, sauvetage aérien : 1414',
  'Tox Info Suisse : 145',
].join('\n');
// Côté français du Léman : numéros français en premier (demande de Corban, 2026-10-31).
const LEMAN_FR_CONTACTS = [
  'Urgence (Europe) : 112',
  'Pompiers, secours sur le lac (France) : 18',
  'Gendarmerie, brigade nautique (France) : 17',
  'SAMU (France) : 15',
  'Urgence par SMS (France) : 114',
].join('\n');
// Frontière approximative au milieu du lac, d'Hermance à St-Gingolph (lon, lat).
const LEMAN_BORDER = [[6.240, 46.302], [6.300, 46.372], [6.420, 46.420], [6.600, 46.455], [6.720, 46.450], [6.806, 46.392]];
function inFrenchLeman(p) {
  if (!p || p.lat == null || p.lat < 46.2 || p.lat > 46.6) return false;
  const B = LEMAN_BORDER;
  if (p.lon < B[0][0] || p.lon > B[B.length - 1][0]) return false;
  for (let k = 1; k < B.length; k++) {
    const [x0, y0] = B[k - 1], [x1, y1] = B[k];
    if (p.lon <= x1) return p.lat < y0 + ((p.lon - x0) / (x1 - x0)) * (y1 - y0);
  }
  return false;
}
const SAVANNAH_CHECK = [
  'Couper la batterie du moteur',
  'Fermer tous les hublots',
  'Éteindre tous les appareils du panneau de commande au-dessus de la table à carte',
  'Laisser le frigo ouvert',
  'Couper le gaz à côté du four',
  'Couper le gaz sur la bonbonne du balcon arrière',
  ['Remplir la fiche du livre de bord et en envoyer une photo sur le groupe WhatsApp « Savannah entraînement ou location »', 'sheet'],
  'Prendre toutes vos affaires ;o)',
];
// Données de la carte grise (permis de navigation VD) et du certificat de construction Hanse.
// Pastille bateau : nom, puis dessous « Modèle (Année) » ; modèle et année sont des entrées distinctes (Corban, v126).
function boatYear(i) { const m = String((i && i.year) || '').match(/\b(19|20)\d{2}\b/); return m ? m[0] : String((i && i.year) || '').trim(); }
function boatSub(i) { if (!i) return ''; const y = boatYear(i); return [i.model || '', y ? `(${y})` : ''].filter(Boolean).join(' '); }
function splitModelYear(i) { if (!i || !i.model) return false; const m = String(i.model).match(/^(.*?)[,\s]+((?:19|20)\d{2})\s*$/); if (!m) return false; i.model = m[1].trim(); if (!i.year) i.year = m[2]; return true; }
const SAVANNAH_INFO = {
  // v421 (Corban) : fiche de base reprise de la fiche qu'il a remplie le 04.11.2026. Les champs calculés (longueur hors-tout,
  // longueur de coque, sonde min., hauteur de passage min.) ne sont PAS écrits ici : ils restent automatiques.
  boat: 'Savannah', waters: 'Eaux intérieures', model: 'Hanse 325', year: '2013', pas: 'Tribord',
  loaFt: '31,6', beam: '3,30', draft: '1,53', airDraft: '14,77',
  voilesAvant: 'Foc, Génois volant, Spinnaker', hullColor: 'Blanche',
  propType: 'Gasoil', fuelCap: '90', conso: '1,5', waterCap: '240',
  builder: 'HanseYachts AG, Greifswald (Allemagne)', architect: 'Judel/Vrolijk & Co', hin: 'DEH ANB 054 3F31 3', ceId: 'CE DE-HAN B 0543 F 313 · Hanse 325/0543',
  flag: 'Suisse', homePort: 'Morges, baie de l’Église', flagNo: 'Suisse', reg: 'VD 27 713 · matricule 991.169.260',
  category: 'A · 8 personnes au maximum', displ: '5 422', keelWeight: '1480', anchor: 'Delta', anchorKg: '10',
  rig: 'Voilier à moteur, coque fibre de verre', rigging: 'Sloop fractionné 9/10 avec barres de flèche poussantes', sails: '45',
  engine: 'Volvo Penta D1-20F (n° 5102368297W)', power: '13,3',
  base: 'Association « Le Savannah », port de Morges, baie de l’Église.\nAssurance RC : AXA. Dernière expertise : 20.10.2021 (VD).\nLe permis de navigation doit être à bord.',
  tarifs: [
    'Journée en semaine : CHF 120.–',
    'Soir dès 17h00 en semaine : CHF 60.–',
    'Journée le week-end : CHF 150.–',
    'Soir dès 17h00 le week-end : CHF 80.–',
  ].join('\n'),
  reglement: [
    'Franchise d’assurance : CHF 500.– par sinistre couvert.',
    '• Location : entièrement à la charge du membre locataire.',
    '• Entraînement collectif : partagée à parts égales entre les membres présents, sauf si un responsable unique a été désigné avant la sortie (à noter dans le livre de bord).',
    '• Incident non accidentel (panne interne, usure, phénomène naturel) : la part non remboursée par l’assurance est à la charge du propriétaire.',
    'À noter au livre de bord à chaque sortie : membres présents, nature de la sortie, responsable unique éventuel.',
    '(Annexe au règlement d’utilisation et de location, AG du 07.04.2025)',
  ].join('\n'),
};
// Suggestions de départ, à adapter dans « Modifier la liste ».
const DEP_CHECK = [
  'Consulter la météo et les feux d’avis de tempête',
  'Gilets de sauvetage pour tout l’équipage',
  'Sortir la bouée fer à cheval',
  'Vérifier le carburant',
];
const seedList = (arr, p) => arr.map((x, i) => (Array.isArray(x) ? { id: p + (i + 1), label: x[0], action: x[1] } : { id: p + (i + 1), label: x }));
// Lac en croisière (plusieurs jours) : listes complétées (suggestions, modifiables).
const DEP_CHECK_X = ['Fermer le frigo', 'Faire le plein d’eau douce', 'Vérifier la réserve de gaz', 'Ranger l’avitaillement', 'Literie et sacs de couchage à bord', 'Essayer les feux de navigation'];
const QUIT_CHECK_X = ['Vider et nettoyer le frigo', 'Vider les poubelles', 'Nettoyer cabines, carré et WC', 'Noter le niveau de diesel et d’eau'];
// Croisière en mer : prise et restitution du bateau de location (modèle repris à chaque nouvelle croisière).
const SEA_DEP = [
  'Papiers du bateau, contrat et caution', 'Inventaire du matériel avec le loueur', 'Photos des dégâts existants avec le loueur',
  'Gilets de sauvetage (un par personne) et harnais', 'Radeau de survie : date de révision', 'Fusées et feux de détresse : dates de validité',
  'Extincteurs et couverture anti-feu', 'Annexe, hors-bord, gonfleur et pagaies', 'Moteur : huile, eau de refroidissement, courroie, filtre',
  'Niveaux : gasoil, eau douce, gaz', 'Batteries et branchement de quai', 'Guindeau, ancre et longueur de chaîne',
  'Voiles, enrouleur et bosses de ris', 'VHF : essai radio, MMSI', 'Feux de navigation', 'Pompes de cale manuelle et électrique', 'WC et vannes de coque',
];
const SEA_QUIT = [
  'Plein de gasoil (selon le contrat)', 'Ranger et nettoyer cabines, carré et cuisine', 'Vider le frigo et les poubelles', 'Vider les eaux noires (si autorisé)',
  'Inventaire de restitution avec le loueur', 'Signaler les avaries et les pertes', 'Récupérer la caution', 'Prendre toutes vos affaires',
];
// Relevés de l'arrivée à bord, notés dans la fiche du jour.
const RELEVES_LABEL = 'Mettre le contact, puis relever : heures moteur, carburant, tension des 2 batteries, niveau d’eau';
// Points « relevé » séparés : chacun a sa valeur, notée dans la fiche du jour (key).
const relevesItems = (p) => [{ id: p + 'c', label: 'Mettre le contact' }].concat([
  ['moteurDebut', 'Allumer le moteur et relever les heures moteur', 'h'], ['carbPct', 'Checker le niveau de carburant', '%'], ['batt1', 'Tension de la batterie 1', 'V'],
  ['batt2', 'Tension de la batterie 2', 'V'], ['eauPct', 'Niveau d’eau potable', '%']].map(([key, label, unit]) => ({ id: p + key, label, unit, key })));
const RELEVES = [['moteurDebut', 'Heures moteur', 'h'], ['carbPct', 'Carburant', '%'], ['batt1', 'Batterie 1', 'V'], ['batt2', 'Batterie 2', 'V'], ['eauPct', 'Eau', '%']];
function relevesSummary(d) {
  const v = (k, u) => (d[k] != null && d[k] !== '' ? `${d[k]} ${u}` : null);
  const bat = [v('batt1', 'V'), v('batt2', 'V')].filter(Boolean).join(' / ');
  return [v('moteurDebut', 'h') && `moteur ${v('moteurDebut', 'h')}`, v('carbPct', '%') && `carburant ${v('carbPct', '%')}`,
    bat && `batteries ${bat}`, v('eauPct', '%') && `eau ${v('eauPct', '%')}`].filter(Boolean).join(' · ');
}
// Observations de la prise du bateau : par jour au lac (journée), pour toute la croisière sinon.
const constatKey = (l) => (l === 'dep' ? 'obsPrise' : 'obsFin');
const constatTitle = (l) => (l === 'dep' ? 'Constat à la prise du bateau' : curMode() === 'lacj' ? 'Constat de fin de journée' : curMode() === 'mer' ? 'Constat de fin de location' : 'Constat de fin de croisière');
const obsOwner = () => (curMode() === 'lacj' ? dayData(dayKey(new Date())) : cruise);

// Trois modes séparés : mer (location à la semaine), lac à la journée, lac en croisière.
const MODES = {
  mer: { icon: '⛵', name: 'Croisière en mer', sub: 'location à la semaine' },
  lacj: { icon: '🏞', name: 'Lac · journée', sub: 'sortie du jour' },
  lacc: { icon: '🌙', name: 'Lac · croisière', sub: 'plusieurs jours' },
};
const modeOf = (c) => (!c ? 'mer' : c.type === 'lac' ? (c.duree === 'croisiere' ? 'lacc' : 'lacj') : 'mer');
const curMode = () => modeOf(cruise);
const CK_DEFS = {
  mer: [['dep', 'checklistDep', 'Prise du bateau'], ['quit', 'checklist', 'Restitution']],
  lacj: [['dep', 'checklistDep', 'Arrivée à bord'], ['quit', 'checklist', 'Quitter le bateau']],
  lacc: [['dep', 'checklistDepX', 'Arrivée à bord'], ['quit', 'checklistX', 'Fin de croisière']],
};
// Listes nommées, rangées par catégories (demande de Corban, 2026-10-31) : les deux listes de base du mode
// (prise / fin) plus des listes libres (ex. Avitaillement), propres au bateau ou à la croisière en mer.
const CK_BUILTIN_CATS = {
  mer: { dep: ['Check-in', 'Croisière'], quit: ['Check-out', 'Croisière'] },
  lacj: { dep: ['Check-in', 'Léman'], quit: ['Check-out', 'Léman'] },
  lacc: { dep: ['Check-in', 'Croisière', 'Léman'], quit: ['Check-out', 'Croisière', 'Léman'] },
};
const CK_CATS_DEFAULT = ['Check-in', 'Check-out', 'Croisière', 'Léman', 'Mer', 'Avitaillement', 'Sécurité', 'Mouillage', 'Entretien'];
const isCkBuiltin = (l) => l === 'dep' || l === 'quit';
const ckOwnerFor = (m, owner) => owner || (cruise && m === curMode() ? checklistOwner() : null);
function ckDefs(m, owner) {
  m = m || curMode();
  const o = ckOwnerFor(m, owner);
  const meta = (o && o.ckMeta && o.ckMeta[m]) || {};
  return CK_DEFS[m].map(([l, p, n]) => [l, p, (meta[l] && meta[l].name) || n])
    .concat(((o && o.ckLists) || []).map((x) => [x.id, 'ckx_' + x.id, x.name]));
}
const ckProp = (l, m, owner) => { const d = ckDefs(m, owner).find((x) => x[0] === l); return d ? d[1] : 'ckx_' + l; };
const ckName = (l, m, owner) => { const d = ckDefs(m, owner).find((x) => x[0] === l); return d ? d[2] : ''; };
function ckCats(l, m, owner) {
  m = m || curMode();
  const o = ckOwnerFor(m, owner);
  if (isCkBuiltin(l)) { const meta = (o && o.ckMeta && o.ckMeta[m] && o.ckMeta[m][l]) || {}; return meta.cats || CK_BUILTIN_CATS[m][l]; }
  const x = ((o && o.ckLists) || []).find((y) => y.id === l);
  return (x && x.cats) || [];
}
// Bases de check-list : listes modèles gardées dans le téléphone, à reprendre pour n'importe quel bateau ou croisière.
let ckLib = store.get('ldb.ckLib', []);
const saveLib = () => { store.set('ldb.ckLib', ckLib); store.set('ldb.ckLib.at', new Date().toISOString()); };
function mergeCkLib(list) {
  for (const b of list || []) {
    if (!b || !b.id) continue;
    const i = ckLib.findIndex((x) => x.id === b.id);
    if (i < 0) ckLib.push(b); else if ((b.at || '') > (ckLib[i].at || '')) ckLib[i] = b;
  }
  saveLib();
}
// Briefing sécurité à faire avec l'équipage avant le départ (d'après le document de Corban, 2026-10-31).
const BRIEF_NAME = 'Briefing sécurité';
const BRIEF_CATS = ['Sécurité', 'Check-in'];
const BRIEF_ITEMS = [
  ['Toilettes : ne rien y jeter, ni papier ni objet (grand danger d’obstruction)', 'En arrivant à bord : distribuer ou montrer les sachets pour le papier.'],
  ['Gilets : dès que le bateau bouge, on les porte ; les mettre avant de partir', 'Distribuer les gilets, les ajuster sur chacun, demander qui nage bien.'],
  ['Harnais : bateau en mouvement et hors du cockpit (dans le cockpit aussi, à la demande du skipper)', 'Distribuer les harnais, faire le tour du bateau accroché à la ligne de vie.'],
  ['Chaussures fermées : risque de blessure pieds nus', 'Montrer les objets pointus : taquets, poulies, rails…'],
  ['Piano, winchs, poulies : garder les mains à distance', 'Montrer comment faire.'],
  ['Protéger le bateau : utiliser les pare-battages, ne pas pousser avec les mains ou les pieds', ''],
  ['Gaz : le sécuriser avant de partir', 'Montrer la bonbonne, la vanne extérieure et éventuellement intérieure.'],
  ['Four à gaz : système à bilame, vanne de gaz s’il y en a une', 'Faire allumer une plaque avec l’allume-gaz ou des allumettes.'],
  ['Feu à bord : cause la plus fréquente de naufrage', 'Montrer l’extincteur et la couverture anti-feu.'],
  ['Homme à la mer : procédure du skipper (quick stop, empannage, virement…), un équipier ne quitte pas la personne des yeux', 'Simuler la manœuvre avec un pare-battage à la première sortie.'],
  ['VHF et sécurité : qui parle et comment, canaux 16 et 72', 'Montrer la touche rouge DISTRESS et tout l’équipement de sécurité (fusées…).'],
  ['Pompe de cale : emplacement de la manivelle', 'Faire pomper les jeunes.'],
  ['Nœuds utiles : chaise, cabestan, taquet', 'Concours de nœuds, attacher les pare-battages.'],
].map(([label, note]) => (note ? { label, note } : { label }));
if (!ckLib.some((b) => b.seed === 'brief')) { ckLib.push({ id: 'base-brief', seed: 'brief', name: BRIEF_NAME, cats: BRIEF_CATS.slice(), items: structuredClone(BRIEF_ITEMS), at: '2026-10-31T00:00:00.000Z' }); store.set('ldb.ckLib', ckLib); }
// Ajouté une fois à chaque bateau et croisière ; ensuite libre d'être modifié ou supprimé.
function seedBrief(owner) {
  if (owner.briefSeeded) return false;
  owner.briefSeeded = true;
  if ((owner.ckLists || []).some((x) => x.name === BRIEF_NAME)) return true;
  const base = ckLib.find((b) => b.seed === 'brief') || { items: BRIEF_ITEMS };
  const id = uid();
  owner.ckLists = [{ id, name: BRIEF_NAME, cats: BRIEF_CATS.slice() }, ...(owner.ckLists || [])];
  owner['ckx_' + id] = base.items.map((x) => ({ id: uid(), ...x }));
  return true;
}
const allCkCats = (extra) => [...new Set([...CK_CATS_DEFAULT, ...ckLib.flatMap((b) => b.cats || []), ...(extra || [])])];
let seaTpl = store.get('ldb.tpl.mer', null);
if (!seaTpl) { seaTpl = { checklistDep: seedList(SEA_DEP, 'm'), checklist: seedList(SEA_QUIT, 'r') }; store.set('ldb.tpl.mer', seaTpl); }
// Points de la fiche « Prise en main du bateau et contrôles avant navigation » (version du 20.02.2025, fournie par
// Corban le 2026-10-31), ajoutés une fois au modèle de prise du bateau en mer et gardés comme base.
const PRISE_ITEMS = [
  ['Noter et si besoin photographier tous les dégâts, éraflures… à l’extérieur et à l’intérieur', 'À signaler au loueur avant de prendre la mer, idéalement sur la fiche d’inventaire signée au départ.'],
  ['Vérifier l’inventaire selon la fiche remise par le loueur', ''],
  ['Repérer les extincteurs et couvertures anti-feu, vérifier leur bon état', ''],
  ['État de l’accastillage, du gréement et des lignes de vie', ''],
  ['Matériel d’amarrage : quantité et qualité', ''],
  ['État des voiles, des drisses, des coulisseaux…', 'La grand-voile peut s’user sur les barres de flèche.'],
  ['Bon fonctionnement de l’enrouleur', ''],
  ['Barre à roue : jeu, nombre de tours de bâbord à tribord, blocage', ''],
  ['Propreté et absence d’eau dans les fonds', ''],
  ['Propreté sous le moteur', ''],
  ['Annexe et son moteur', ''],
  ['Tous les hublots ferment correctement et sont en bon état', ''],
  ['Chargeur de batteries, pompes à eau de cuisine, de cale, des douches…', ''],
  ['Localiser les vannes, y compris la commutation des réservoirs d’eau', ''],
  ['Les WC se vident correctement et ne sont pas bouchés', ''],
  ['Feux de navigation et de mouillage', ''],
  ['Indication du sondeur comparée à la profondeur réelle', ''],
  ['Niveau d’huile moteur et de liquide de refroidissement', ''],
  ['Niveau de carburant', ''],
  ['Documents du bateau : acte de francisation, assurance, attestation du radeau, cartes, bloc marine, modes d’emploi', ''],
  ['Livre de bord à bord', ''],
  ['Noter les heures moteur et le loch au départ dans le livre de bord', ''],
  ['Noter les caractéristiques du bateau : dimensions, tirant d’eau, MMSI…', 'Dans Plus › Bateau et croisière.'],
  ['À la première baignade, vérifier la partie immergée et signaler tout défaut', ''],
  ['Pendant la semaine, tenir la liste des réparations et de la vaisselle manquante', ''],
].map(([label, note]) => (note ? { label, note } : { label }));
// Points du modèle d'origine remplacés par leur version plus complète.
const PRISE_REPLACES = ['Photos des dégâts existants avec le loueur', 'Inventaire du matériel avec le loueur', 'Extincteurs et couverture anti-feu',
  'Annexe, hors-bord, gonfleur et pagaies', 'Feux de navigation'];
if (!seaTpl.prise2025) {
  const keep = (seaTpl.checklistDep || []).filter((x) => !PRISE_REPLACES.includes(x.label));
  const have = new Set(keep.map((x) => x.label));
  seaTpl.checklistDep = keep.concat(PRISE_ITEMS.filter((x) => !have.has(x.label)).map((x) => ({ id: uid(), ...x })));
  seaTpl.prise2025 = true;
  store.set('ldb.tpl.mer', seaTpl);
}
if (!ckLib.some((b) => b.seed === 'prise')) { ckLib.push({ id: 'base-prise', seed: 'prise', name: 'Prise en main du bateau', cats: ['Check-in', 'Croisière', 'Mer'], items: structuredClone(PRISE_ITEMS), at: '2026-10-31T00:00:00.000Z' }); store.set('ldb.ckLib', ckLib); }

// Rubriques « Bateau et croisière » qui appartiennent au bateau (reprises à chaque sortie).
const BOAT_SECTIONS_ALL = INFO_SECTIONS.filter((s) => !['Croisière', 'Météo'].includes(s.title)); // Météo retirée de la fiche bateau (Corban, v157)
// v217 (Corban) : « Loueur, base » et « Location et règlement » ne font plus partie de la fiche bateau (valeurs gardées).
const BOAT_SECTIONS = BOAT_SECTIONS_ALL.filter((s) => !['Loueur, base', 'Location et règlement du bateau', 'Radio et identification'].includes(s.title)); // v238 (Corban) : Radio et identification retirés de la fiche (données gardées)
const BOAT_KEYS = BOAT_SECTIONS_ALL.flatMap((s) => flatFields(s.fields).map((f) => f.key)).filter((k) => !['moteurInit', 'fuelInit'].includes(k)).concat(['gvDesc', 'voilesDesc', 'gvColor', 'voilesColor', 'vMoteur']); // v214 : descriptions des voiles
// Rubriques propres à chaque bateau : champs masqués (b.hidden) et rubriques ajoutées (b.custom, valeurs dans b.info['x_' + id]).
// v217 (Corban) : libellés ajoutés = une case de texte placée où l'on veut dans la fiche (c.after = clé de la case qui précède, ou '§Titre' = début de section).
const customField = (c) => ({ key: 'x_' + c.id, label: c.label, type: 'line', grow: true, wide: true });
function boatSections(b) {
  const out = BOAT_SECTIONS.map((sec) => Object.assign({}, sec, { fields: sec.fields.slice() }));
  const todo = (b.custom || []).slice();
  for (let pass = 0; pass < 4 && todo.length; pass++) {
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i], a = c.after || '';
      let done = false;
      if (a.startsWith('§')) { const sec = out.find((x) => x.title === a.slice(1)); if (sec) { sec.fields.unshift(customField(c)); done = true; } }
      else if (a) for (const sec of out) { const k = sec.fields.findIndex((f) => f.key === a); if (k >= 0) { sec.fields.splice(k + 1, 0, customField(c)); done = true; break; } }
      if (done) { todo.splice(i, 1); i--; }
    }
  }
  const fall = out.find((x) => x.title === 'Informations') || out[out.length - 1];
  for (const c of todo) fall.fields.push(customField(c));
  // v396 (Corban) : libellés standard renommés en mode ✎ (b.alias = { clé: libellé }).
  if (b.alias) for (const sec of out) sec.fields = sec.fields.map((f) => (b.alias[f.key] ? Object.assign({}, f, { label: b.alias[f.key] }) : f));
  return out.filter((sec) => sec.fields.length);
}
const boatKeys = (b) => BOAT_KEYS.concat((b.custom || []).map((c) => 'x_' + c.id));
// « Bateau et croisière » d'une sortie : la croisière, puis les rubriques du bateau choisi.
function infoSections() {
  const b = isLake() && boatById(cruise.boatId);
  return b ? activeSections([INFO_SECTIONS[0], ...boatSections(b)]) : activeSections(INFO_SECTIONS);
}

/* v154 : versions des données d'un bateau. Avant chaque série de modifications (et avant un retour en arrière),
   l'état précédent est gardé (12 au plus), pour pouvoir retrouver une saisie perdue. */
const boatInfoOf = (b, info) => { const o = {}; if (!info) return o; for (const k of boatKeys(b)) if (info[k] != null && info[k] !== '') o[k] = info[k]; for (const k in info) if (k.startsWith('pairSrc_')) o[k] = info[k]; return o; };
const infoDiffKeys = (a, z) => [...new Set([...Object.keys(a), ...Object.keys(z)])].filter((k) => JSON.stringify(a[k] == null ? null : a[k]) !== JSON.stringify(z[k] == null ? null : z[k]));
function boatSnap(b, info, from, at) {
  b.hist = b.hist || [];
  if (!Object.keys(info).length || b.hist.some((h) => !infoDiffKeys(h.info, info).length)) return false;
  b.hist.unshift({ at: at || new Date().toISOString(), from, info });
  b.hist.sort((x, z) => z.at.localeCompare(x.at)); b.hist = b.hist.slice(0, 12);
  return true;
}
let boatPrev = null;
const saveBoats = (keepStamp) => {
  if (boatPrev) for (const b of boats) {
    const p = boatPrev[b.id], cur = JSON.stringify(boatInfoOf(b, b.info));
    if (p && p !== cur) { const last = (b.hist || [])[0]; if (!last || last.from !== 'Avant modification' || Date.now() - Date.parse(last.at) > 20 * 60e3) boatSnap(b, JSON.parse(p), 'Avant modification'); }
  }
  boatPrev = Object.fromEntries(boats.map((b) => [b.id, JSON.stringify(boatInfoOf(b, b.info))]));
  if (keepStamp !== true) store.set('ldb.boats.at', new Date().toISOString()); return store.set('ldb.boats', boats);
};
// v430 (Corban) : 2ᵉ bateau d'exemple, en mer et à propulsion électrique (données de la fiche de Corban, 04.11.2026).
// Les champs calculés (longueur de coque, sonde min., hauteur de passage min.) restent automatiques.
const INSPIRATION_INFO = {
  boat: 'Inspiration', waters: 'Eaux maritimes', model: 'Dufour 530', year: '2024', pas: 'Tribord',
  loaFt: '53', loa: '16,35', beam: '4,99', draft: '1,95', airDraft: '22,9',
  voilesAvant: 'Génois', hullColor: 'Blanche', propType: 'Électrique', battKwh: '32', contacts: '',
};
let boats = store.get('ldb.boats', null);
// Robustesse : un bateau a toujours un id, une fiche info et une check-list (tableau).
if (boats != null) boats = store.arr('ldb.boats', (b) => { if (!b.info || typeof b.info !== 'object') b.info = {}; if (!b.id) b.id = 'b' + Math.random().toString(36).slice(2, 9); if (b.checklist != null && !Array.isArray(b.checklist)) b.checklist = []; return b; });
if (!boats) {
  boats = [{ id: 'savannah', info: { contacts: LAKE_CONTACTS }, checklist: seedList(SAVANNAH_CHECK, 'c') }];
}
// v424 (Corban) : la puissance est un nombre en kW ; « 13,3 kW » devient « 13,3 » (une fois, tous les bateaux).
// v428 (Corban) : poids de l'ancre dans sa propre case (kg) et surface de voilure en nombre (m²), une fois, tous les bateaux.
if (!store.get('ldb.anchorKg', false)) { boats.forEach((b) => { const i = b.info; if (!i) return; if (typeof i.anchor === 'string' && !i.anchorKg) { const m = i.anchor.match(/(\d+(?:[.,]\d+)?)\s*kg/i); if (m) { i.anchorKg = m[1].replace('.', ','); i.anchor = i.anchor.replace(m[0], '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s{2,}/g, ' '); } } if (typeof i.sails === 'string') { const m = i.sails.trim().match(/^([\d.,]+)\s*m(?:²|2)$/i); if (m) i.sails = m[1].replace('.', ','); } }); store.set('ldb.boats', boats); store.set('ldb.anchorKg', true); }
if (!store.get('ldb.powerKw', false)) { boats.forEach((b) => { if (b.info && typeof b.info.power === 'string') { const m = b.info.power.trim().match(/^([\d.,]+)\s*kw$/i); if (m) b.info.power = m[1].replace('.', ','); } }); store.set('ldb.boats', boats); store.set('ldb.powerKw', true); }
// v431 (Corban) : 3 bateaux fictifs de plus (noms et immatriculations inventés), dont un catamaran à deux moteurs.
const EXAMPLE_BOATS = [
  { id: 'exb1', info: { boat: 'Alizé', waters: 'Eaux maritimes', model: 'Lagoon 42', year: '2019', pas: 'Sans',
    loa: '12,80', beam: '7,70', draft: '1,25', airDraft: '20,5', voilesAvant: 'Génois, Code 0', hullColor: 'Blanche',
    propType: 'Gasoil', fuelCap: '300', fuelCap2: '300', conso: '2,5', conso2: '2,5', waterCap: '600',
    engine: '2 × Yanmar 4JH57 (un par coque), transmission saildrive', power: '42', homePort: 'Port fictif, Méditerranée', flag: 'Suisse',
    category: 'A · 12 personnes au maximum', displ: '12 500', anchor: 'Delta', anchorKg: '25', rig: 'Catamaran de croisière, coques fibre de verre',
    rigging: 'Sloop en tête de mât', sails: '91', contacts: '' } },
  { id: 'exb2', info: { boat: 'Bise Noire', waters: 'Eaux intérieures', model: 'Surprise', year: '1998', pas: 'Bâbord',
    loa: '7,65', beam: '2,50', draft: '1,45', airDraft: '10,9', voilesAvant: 'Foc, Spinnaker', hullColor: 'Bleu marine',
    propType: 'Gasoil', fuelCap: '12', conso: '0,8', waterCap: '20', engine: 'Hors-bord Yamaha 6 ch, puits arrière', power: '4,4',
    homePort: 'Port fictif, lac Léman', flag: 'Suisse', displ: '1 350', keelWeight: '500', anchor: 'Bruce', anchorKg: '6',
    rig: 'Voilier de régate-croisière, coque fibre de verre', rigging: 'Sloop fractionné', sails: '26', contacts: '' } },
  { id: 'exb3', info: { boat: 'Mistral', waters: 'Eaux maritimes', model: 'Bavaria C42', year: '2021', pas: 'Bâbord',
    loa: '12,35', beam: '4,29', draft: '2,10', airDraft: '19,6', voilesAvant: 'Génois, Gennaker', hullColor: 'Grise',
    propType: 'Gasoil', fuelCap: '210', conso: '3', waterCap: '360', engine: 'Volvo Penta D2-60, saildrive', power: '44',
    homePort: 'Port fictif, Atlantique', flag: 'Suisse', displ: '9 800', keelWeight: '2 800', anchor: 'Delta', anchorKg: '20',
    rig: 'Voilier de croisière, coque fibre de verre', rigging: 'Sloop en tête de mât', sails: '86', contacts: '' } },
];
if (!store.get('ldb.exBoats', false)) { EXAMPLE_BOATS.forEach((x) => { if (!boats.some((b) => b.id === x.id)) boats.push({ id: x.id, info: Object.assign({}, x.info), checklist: [], checklistDep: [], checklistX: [], checklistDepX: [] }); }); store.set('ldb.boats', boats); store.set('ldb.exBoats', true); }
// v430 : Inspiration ajouté une fois, sauf si un bateau de ce nom existe déjà (rien n'est écrasé).
if (!store.get('ldb.inspiration', false)) { if (!boats.some((b) => b.id === 'inspiration' || /^\s*inspiration\s*$/i.test((b.info && b.info.boat) || ''))) boats.push({ id: 'inspiration', info: Object.assign({}, INSPIRATION_INFO), checklist: [], checklistDep: [], checklistX: [], checklistDepX: [] }); store.set('ldb.boats', boats); store.set('ldb.inspiration', true); }
{ const sv = boats.find((b) => b.id === 'savannah'); if (sv && !sv.infoSeeded) { sv.info = Object.assign({}, SAVANNAH_INFO, sv.info); sv.infoSeeded = true; }
  if (sv && !sv.voilesUnseed) { if (sv.info.voilesAvant === 'Foc, Génois volant, Spi' && !(sv.info.voilesDesc || []).some(Boolean)) sv.info.voilesAvant = ''; sv.voilesUnseed = true; store.set('ldb.boats', boats); } // v236 : retire les voiles d'avant mises d'office
  if (sv && !sv.tarifsSeeded) { if (!sv.info.tarifs) sv.info.tarifs = SAVANNAH_INFO.tarifs; sv.tarifsSeeded = true; } }
// Une fois : « Modèle, année » séparé en deux entrées (v126), bateaux et navigations enregistrées.
if (!store.get('ldb.modelSplit', false)) {
  boats.forEach((b) => splitModelYear(b.info));
  try { for (const m of store.get('ldb.index', [])) { const c = store.get('ldb.cruise.' + m.id, null); if (c && splitModelYear(c.info)) store.set('ldb.cruise.' + m.id, c); } } catch (e) {}
  store.set('ldb.boats', boats); store.set('ldb.modelSplit', true);
}
// Une fois : « Pavillon, port d’attache » séparé en deux cases (Corban, v160).
function splitFlagPort(i) {
  if (!i || !i.flag || i.homePort) return false;
  const m = String(i.flag).match(/^(.*?)\s*(?:·|,|\/)\s*(.+)$/);
  if (!m) return false;
  i.flag = m[1].trim(); i.homePort = m[2].trim(); return true;
}
// Une fois : unité « kg » sortie de la valeur du déplacement lège, elle est dans l'intitulé (Corban, v168).
{ const kg = (i) => { if (!i || typeof i.displ !== 'string' || !/kg\s*$/i.test(i.displ)) return false; i.displ = i.displ.replace(/\s*kg\s*$/i, '').trim(); return true; };
  if (!store.get('ldb.displKg', false)) {
    boats.forEach((b) => kg(b.info));
    try { for (const m of store.get('ldb.index', [])) { const c = store.get('ldb.cruise.' + m.id, null); if (c && kg(c.info)) store.set('ldb.cruise.' + m.id, c); } } catch (e) {}
    store.set('ldb.boats', boats); store.set('ldb.displKg', true);
  } }
if (!store.get('ldb.flagSplit', false)) {
  boats.forEach((b) => splitFlagPort(b.info));
  try { for (const m of store.get('ldb.index', [])) { const c = store.get('ldb.cruise.' + m.id, null); if (c && splitFlagPort(c.info)) store.set('ldb.cruise.' + m.id, c); } } catch (e) {}
  store.set('ldb.boats', boats); store.set('ldb.flagSplit', true);
}
for (const b of boats) {
  if (!b.checklistDep) b.checklistDep = b.id === 'savannah' ? seedList(DEP_CHECK, 'd') : [];
  if (!b.checklistDepX) b.checklistDepX = b.id === 'savannah' ? seedList(DEP_CHECK.concat(DEP_CHECK_X), 'x') : [];
  // Relevés à l'arrivée (après avoir mis le contact) : un point de la check-list avec ses cases à remplir.
  if (b.id === 'savannah' && !b.relSeeded) {
    b.checklistDep = b.checklistDep.filter((x) => x.label !== 'Vérifier le carburant');
    const i = b.checklistDep.findIndex((x) => /batterie|fer à cheval/i.test(x.label));
    b.checklistDep.splice(i < 0 ? 0 : i + 1, 0, { id: 'rel1', label: RELEVES_LABEL, action: 'releves' });
    b.relSeeded = true;
  }
  // Un point par relevé (Corban : chaque valeur se saisit dans son point rouge, puis double appui).
  if (b.id === 'savannah' && !b.relSplit) {
    const i = b.checklistDep.findIndex((x) => x.action === 'releves');
    if (i >= 0) b.checklistDep.splice(i, 1, ...relevesItems('rel-'));
    b.relSplit = true;
  }
  // v377 (Corban) : « Ouvrir la batterie du moteur » retiré du check-in Savannah (une fois ; ne touche à rien d'autre).
  if (b.id === 'savannah' && !b.noBattOpen) {
    for (const p of ['checklistDep', 'checklistDepX']) if (b[p]) b[p] = b[p].filter((x) => x.label !== 'Ouvrir la batterie du moteur');
    b.noBattOpen = true; store.set('ldb.boats', boats);
  }
  // v382 (Corban) : liste de check-in Savannah validée (9 points) ; le point des heures moteur devient « Allumer le moteur et relever… ».
  if (b.id === 'savannah' && !b.motLabel) {
    for (const p of ['checklistDep', 'checklistDepX']) for (const x of b[p] || []) if (x.key === 'moteurDebut' && x.label === 'Relever les heures moteur') x.label = 'Allumer le moteur et relever les heures moteur';
    b.motLabel = true; store.set('ldb.boats', boats);
  }
  // v383 (Corban) : check-in Savannah validé en 8 points (frigo retiré du check-in, libellés des relevés raccourcis).
  if (b.id === 'savannah' && !b.ck383) {
    const REN = { carbPct: ['Relever le niveau de carburant', 'Checker le niveau de carburant'], batt1: ['Relever la tension de la batterie 1', 'Tension de la batterie 1'], batt2: ['Relever la tension de la batterie 2', 'Tension de la batterie 2'], eauPct: ['Relever le niveau d’eau', 'Niveau d’eau potable'] };
    if (b.checklistDep) b.checklistDep = b.checklistDep.filter((x) => x.label !== 'Fermer le frigo');
    for (const p of ['checklistDep', 'checklistDepX']) for (const x of b[p] || []) { const r = x.key && REN[x.key]; if (r && x.label === r[0]) x.label = r[1]; }
    b.ck383 = true; store.set('ldb.boats', boats);
  }
  if (!b.ckColon) { for (const p of ['checklistDep', 'checklistDepX', 'checklist', 'checklistX']) for (const x of b[p] || []) ckColon(x); b.ckColon = true; store.set('ldb.boats', boats); }
  // v385 (Corban) : check-in Savannah validé en 9 points, « Sortir la bouée fer à cheval » après les gilets.
  if (b.id === 'savannah' && !b.ck385) {
    const L = b.checklistDep || [];
    if (!L.some((x) => /fer à cheval/i.test(x.label))) { const g = L.findIndex((x) => /^Gilets/i.test(x.label)); L.splice(g < 0 ? 0 : g + 1, 0, { id: uid(), label: 'Sortir la bouée fer à cheval' }); }
    b.ck385 = true; store.set('ldb.boats', boats);
  }
  if (!b.checklistX) b.checklistX = b.id === 'savannah' ? seedList(SAVANNAH_CHECK.slice(0, -2).concat(QUIT_CHECK_X, SAVANNAH_CHECK.slice(-2)), 'y') : [];
}
// v154, une fois : les copies des données du bateau gardées dans chaque navigation deviennent des versions à retrouver.
if (!store.get('ldb.boatVers1', false)) {
  try {
    for (const m of store.get('ldb.index', [])) {
      const c = store.get('ldb.cruise.' + m.id, null); const b = c && c.boatId && boats.find((x) => x.id === c.boatId);
      if (!b) continue;
      const info = boatInfoOf(b, c.info);
      if (infoDiffKeys(info, boatInfoOf(b, b.info)).length) boatSnap(b, info, 'Copie gardée dans la navigation « ' + (c.info.name || m.name || 'sans nom') + ' »', c.saved || c.updated || m.created || new Date().toISOString());
    }
  } catch (e) {}
  store.set('ldb.boatVers1', true);
}
saveBoats(true);
const boatById = (id) => boats.find((b) => b.id === id);

// Sauvegarde restaurée : les bateaux inconnus sont ajoutés, ceux déjà présents ne sont pas touchés.
// Si la liste reçue est plus récente, ses bateaux remplacent ceux du même nom de code.
function mergeBoats(list, at) {
  const newer = (at || '') > store.get('ldb.boats.at', '');
  for (const b of list) {
    if (!b || !b.id) continue;
    const i = boats.findIndex((x) => x.id === b.id);
    if (i < 0) boats.push(b); else if (newer) boats[i] = b;
  }
  if (newer) store.set('ldb.boats.at', at);
  saveBoats(true);
}

function blankOuting(name, boat, duree) {
  // Le compteur moteur repart de la dernière sortie du même bateau.
  const prevMeta = [...index].filter((m) => m.type === 'lac').sort((a, z) => z.created.localeCompare(a.created))
    .find((m) => (store.get('ldb.cruise.' + m.id, {}) || {}).boatId === boat.id);
  const c = blankCruise(name, prevMeta ? store.get('ldb.cruise.' + prevMeta.id) : null);
  const today = dayKey(new Date());
  c.type = 'lac';
  c.duree = duree === 'croisiere' ? 'croisiere' : 'jour';
  c.boatId = boat.id;
  for (const k of boatKeys(boat)) delete c.info[k];
  Object.assign(c.info, { contacts: LAKE_CONTACTS }, structuredClone(boat.info), { name, du: today }, c.duree === 'jour' ? { au: today } : {});
  return c;
}
// Ce qui est corrigé dans « Bateau et croisière » d'une sortie est gardé pour le bateau.
// v154 : seule la case modifiée repart vers le bateau (avant, toute la copie de la navigation écrasait la fiche du bateau).
function syncBoatFromCruise(k) {
  const b = cruise && cruise.boatId && boatById(cruise.boatId);
  if (!b || !k || !boatKeys(b).includes(k)) return;
  if (cruise.info[k] != null && cruise.info[k] !== '') b.info[k] = cruise.info[k]; else delete b.info[k];
  for (const x in cruise.info) if (x.startsWith('pairSrc_')) b.info[x] = cruise.info[x];
  saveBoats();
}
// À l'ouverture de « Bateau et croisière » : la navigation reprend les données actuelles du bateau.
function pullBoatIntoCruise() {
  const b = cruise && cruise.boatId && boatById(cruise.boatId);
  if (!b || !infoDiffKeys(boatInfoOf(b, cruise.info), boatInfoOf(b, b.info)).length) return;
  for (const k of boatKeys(b)) if (b.info[k] != null) cruise.info[k] = b.info[k]; else delete cruise.info[k];
  for (const x in b.info) if (x.startsWith('pairSrc_')) cruise.info[x] = b.info[x];
  saveCruise();
}
// Versions précédentes : liste, différences avec la fiche actuelle, et « Remettre cette version ».
const boatVersBtn = (b) => (b.hist || []).length ? `<div class="row" style="padding:0 14px"><button class="btn no-navact btn-provisoire" data-vers="${b.id}" title="Bouton provisoire (mode dégradé), à retirer">↺ Versions précédentes des données (${b.hist.length})</button></div>` : '';
function renderBoatVersions(b, back) {
  const main = $('#view');
  const labels = Object.fromEntries(boatSections(b).flatMap((s) => s.fields).map((f) => [f.key, f.label]));
  const cur = boatInfoOf(b, b.info);
  const show = (v) => v == null || v === '' ? '—' : esc(typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 80);
  main.innerHTML = `
    <button class="btn" id="verBack">◀ Retour</button>
    <h1>↺ ${esc(b.info.boat || 'Bateau')} : versions</h1>
    ${(b.hist || []).map((h, i) => { const ks = infoDiffKeys(h.info, cur).filter((k) => !k.startsWith('pairSrc_'));
      return `<section class="field"><h2>${esc(fmtShortDate(new Date(h.at)))} ${pad(new Date(h.at).getHours())}:${pad(new Date(h.at).getMinutes())} · ${esc(h.from)}</h2>
        ${ks.length ? `<p class="help">${ks.length} différence${ks.length > 1 ? 's' : ''} avec la fiche actuelle (cette version → actuelle) :</p>
        <ul class="help">${ks.map((k) => `<li><b>${esc(labels[k] || k)}</b> : ${show(h.info[k])} → ${show(cur[k])}</li>`).join('')}</ul>` : '<p class="help">Identique à la fiche actuelle.</p>'}
        ${ks.length ? `<div class="row"><button class="btn primary no-navact" data-vput="${i}">Remettre cette version</button></div>` : ''}</section>`; }).join('') || '<p class="help">Aucune version gardée.</p>'}`;
  main.onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return; buzz();
    if (t.id === 'verBack') return back();
    if (t.dataset.vput != null) return armed(t, 'Toucher encore : remettre', () => {
      const h = b.hist[Number(t.dataset.vput)];
      boatSnap(b, boatInfoOf(b, b.info), 'Avant retour en arrière');
      for (const k of Object.keys(boatInfoOf(b, b.info))) delete b.info[k];
      Object.assign(b.info, structuredClone(h.info));
      saveBoats(); syncCruiseFromBoat(b); toast('Version remise'); back();
    });
  };
}
function syncCruiseFromBoat(b) {
  if (!cruise || cruise.boatId !== b.id) return;
  for (const k of boatKeys(b)) if (b.info[k] != null) cruise.info[k] = b.info[k]; else delete cruise.info[k];
  saveCruise();
}

/* ---------- Check-list ---------- */
// Listes du bateau de la sortie, sinon listes propres à la croisière.
function checklistOwner(boatId) {
  const b = boatById(boatId || (cruise && cruise.type === 'lac' && cruise.boatId));
  if (b) { if (seedBrief(b)) saveBoats(); for (const [, p] of CK_DEFS[curMode()]) b[p] = b[p] || []; for (const x of b.ckLists || []) b['ckx_' + x.id] = b['ckx_' + x.id] || []; return b; }
  // Croisière en mer : listes propres à la croisière, copiées du modèle à la première ouverture.
  for (const [, p] of CK_DEFS.mer) if (!cruise[p]) cruise[p] = structuredClone(seaTpl[p] || []);
  if (!cruise.ckLists && seaTpl.ckLists) {
    cruise.ckLists = structuredClone(seaTpl.ckLists); cruise.ckMeta = structuredClone(seaTpl.ckMeta || {});
    for (const x of cruise.ckLists) cruise['ckx_' + x.id] = structuredClone(seaTpl['ckx_' + x.id] || []);
    if (seaTpl.briefSeeded) cruise.briefSeeded = true;
  }
  if (seedBrief(cruise)) { syncSeaTpl(cruise, 'mer'); saveCruise(); }
  for (const x of cruise.ckLists || []) cruise['ckx_' + x.id] = cruise['ckx_' + x.id] || [];
  return cruise;
}
// Sans liste précisée : les deux listes de base seulement (le bandeau « Check-list » ne compte pas les listes libres).
const checkItems = (l) => (!cruise ? [] : l ? checklistOwner()[ckProp(l)] || [] : CK_DEFS[curMode()].flatMap(([, p]) => checklistOwner()[p] || []));
// Lac à la journée : coché pour le jour même. Mer et lac en croisière : coché pour toute la croisière.
const checkDone = () => new Set((curMode() === 'lacj' ? (cruise && cruise.days[dayKey(new Date())]) || {} : cruise || {}).checkDone || []);
const checkLeft = (l) => { const d = checkDone(); return checkItems(l).filter((x) => !d.has(x.id)); };
function setCheckDone(set) {
  const d = curMode() === 'lacj' ? dayData(dayKey(new Date())) : cruise;
  if (set.size) d.checkDone = [...set]; else delete d.checkDone;
  saveCruise();
}
// La liste à proposer : « Avant de larguer » tant qu'elle n'est pas finie.
const ckCurrent = () => (checkLeft('dep').length || !checkItems('quit').length ? 'dep' : 'quit');
function checklistSub() {
  if (!checkItems().length) return 'à préparer';
  const l = ckCurrent();
  const left = checkLeft(l).length;
  return left ? `${ckName(l)} : ${left} point${left > 1 ? 's' : ''}` : 'tout est fait';
}
function renderCheckBanner() {
  const box = $('#checkBanner');
  if (!box) return;
  if (!checkLeft().length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn big ck-banner">✅ Check-list<small>${esc(checklistSub())}</small></button></div>`;
  $('.ck-banner', box).onclick = () => { buzz(); go('checklist'); };
}

let ckPending = 0;
let ckList = null;
// Points de check-list (v379, Corban) : blanc (à faire) › appui simple : orange (pas fait, valeur ou photo) › appui long : vert (fait)
// › appui long sur un vert : retour au blanc (valeur gardée ; s’il y a une photo, on demande s’il faut la supprimer).
const CK_UNITS = ['', '%', 'L', 'kWh', 'V', 'h', 'bar', '°C', 'nb'];
const ckUnitLab = (u) => (u ? (u === 'nb' ? 'nombre sans unité' : u) : 'pas de valeur');
// v384 (Corban) : un point qui finit par « : » est un point à valeur (chiffre + unité fixe choisie en édition).
function ckColon(x) { if (/:\s*$/.test(x.label || '') && !x.unit) x.unit = 'nb'; }
const ckState = () => (curMode() === 'lacj' ? dayData(dayKey(new Date())) : cruise);
const ckOpen = () => new Set(ckState().ckOpen || []);
function setCkOpen(set) { const d = ckState(); if (set.size) d.ckOpen = [...set]; else delete d.ckOpen; }
const ckVal = (x) => (x.key ? dayData(dayKey(new Date()))[x.key] : (ckState().ckVals || {})[x.id]) || '';
function setCkVal(x, v) {
  if (x.key) { const d = dayData(dayKey(new Date())); if (v) d[x.key] = v; else delete d[x.key]; if (d._auto) delete d._auto[x.key]; return; }
  const d = ckState(); d.ckVals = d.ckVals || {};
  if (v) d.ckVals[x.id] = v; else delete d.ckVals[x.id];
}
const ckLabelVal = (x) => { const v = ckVal(x); return v ? `${x.label.replace(/\s*:\s*$/, '')} : ${v}${x.unit && x.unit !== 'nb' ? ' ' + x.unit : ''}` : x.label; };
const ckGreen = new Map(); // id → minuterie des 3 s
let ckHeld = 0, ckFired = false; // fin d'un appui long : on ignore seulement le « clic » de ce même appui
const ckFresh = new Set(); // points rouges qui restent à leur place un moment avant de descendre
// Redessine la liste plus tard, sans interrompre une saisie en cours.
function ckLater(fn, ms) {
  setTimeout(function again() {
    const a = document.activeElement;
    if (currentView === 'checklist' && a && a.closest && a.closest('#view') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return setTimeout(again, 1500);
    fn();
  }, ms);
}
const ckTaps = new Map(); // id → { t, timer } pour reconnaître le double appui
// v380 (Corban) : bouton ✎ à droite du titre : édition sur place de la liste (texte, ordre ▲▼, suppression par appui long, ajout).
let ckEditing = false;
let ckObsOpen = false; // v387 : bouton Observations ouvert
const ckShowPh = new Set(); // points verts dont on affiche les photos (appui court)
const ckEditRows = (items) => `<div class="ck-ed">${items.map((x, i) => `<div class="ck-ed-row">
      <div class="ck-ed-arr"><button type="button" class="btn" data-edup="${i}" ${i ? '' : 'disabled'} aria-label="Monter">▲</button><button type="button" class="btn" data-eddn="${i}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="Descendre">▼</button></div>
      <div class="ck-ed-mid"><textarea class="text" rows="2" data-edlab="${i}" aria-label="Point ${i + 1}">${esc(x.label)}</textarea>
        <label class="ck-ed-unit">Valeur <select data-edunit="${i}">${CK_UNITS.map((u) => `<option value="${u}" ${(x.unit || '') === u ? 'selected' : ''}>${esc(ckUnitLab(u))}</option>`).join('')}</select></label></div>
      <button type="button" class="btn danger ck-ed-del" data-eddel="${i}" aria-label="Supprimer">🗑</button></div>`).join('')}
    <div class="ck-ed-new"><textarea class="text" rows="2" id="ckEdNew" placeholder="Nouveau point, ex. Fermer la vanne des WC (finir par « : » pour saisir une valeur)"></textarea><button type="button" class="btn act-add" id="ckEdAdd">＋ Ajouter ce point</button></div>
    <button type="button" class="btn" id="ckEdCopy">📋 Copier la liste (pour me l’envoyer)</button></div>`;
VIEWS.checklist = function renderChecklist(arg) {
  if (arg && (arg.edit || arg.boatId)) return renderChecklistEdit(arg.boatId, arg.list || ckList || 'dep', arg.mode || curMode());
  if (typeof arg === 'string') ckList = arg;
  // v344 (Corban) : en PréP, le check-in est celui du bateau, unique et simplifié (pas de filtres, d'onglets ni de boutons de gestion).
  const pc = typeof prep !== 'undefined' && prep && prep.step === 4;
  if (pc) ckList = 'dep';
  const owner = checklistOwner();
  if (!ckList || !ckDefs().some((d) => d[0] === ckList)) ckList = ckCurrent();
  const items = owner[ckProp(ckList)] || (owner[ckProp(ckList)] = []);
  const builtin = isCkBuiltin(ckList);
  const ckEdSave = () => { if (owner !== cruise) return saveBoats(); syncSeaTpl(owner, curMode()); saveCruise(); };
  const cat = settings.ckCat || '';
  const lists = ckDefs().filter(([l]) => !cat || ckCats(l).includes(cat) || l === ckList);
  const catsUsed = [...new Set(ckDefs().flatMap(([l]) => ckCats(l)))];
  const done = checkDone();
  const open = ckOpen();
  // Les points verts restent visibles 3 s ; les rouges se regroupent en bas.
  const left = items.filter((x) => !done.has(x.id) || ckGreen.has(x.id));
  const stays = (x) => !open.has(x.id) || ckGreen.has(x.id) || ckFresh.has(x.id);
  // v369 (Corban) : chaque point reste à sa place, rouges ET verts ; plus de liste « Déjà fait » en bas ; compteur vert en bas à gauche.
  const order = items;
  void stays;
  const did = [];
  const nDone = items.filter((x) => done.has(x.id)).length;
  const pct = items.length ? Math.round((nDone / items.length) * 100) : 0;
  const today = dayData(dayKey(new Date()));
  const obs = obsOwner();
  const main = $('#view');
  const panel = (x) => `<div class="ck-panel">
      ${x.unit ? `<label class="rel"><span>Valeur</span><span class="rel-in"><input class="text" type="text" inputmode="decimal" data-val="${x.id}" value="${esc(ckVal(x))}"><em>${x.unit === 'nb' ? '' : esc(x.unit)}</em></span></label>` : ''}
      ${x.action === 'releves' ? `<div class="rel-grid">${RELEVES.map(([k, l, u]) => `<label class="rel"><span>${l}</span><span class="rel-in"><input class="text" type="text" inputmode="decimal" data-rel="${k}" value="${esc(today[k] || '')}"><em>${u}</em></span></label>`).join('')}</div>` : ''}
      ${photoStrip(photosFor(ckList).filter((p) => p.item === x.id), true)}
      <div class="row"><button class="btn" data-iphoto="${x.id}">📷 + photo<small>photothèque, fichier ou appareil photo</small></button></div>
      <p class="help">Appui long sur le point : vert (fait).</p>
    </div>`;
  main.innerHTML = `
    <h1>${items.length ? `<span class="ck-count${nDone === items.length ? ' all' : ''}">${nDone}/${items.length}</span>` : ''}${pc ? 'Check-in' : `Check-list${owner !== cruise ? ` · ${esc(owner.info.boat || '')}` : ''}`}<button type="button" class="btn ck-editbtn ${ckEditing ? 'on' : ''}" data-ckedit="1" aria-label="Modifier la liste">${ckEditing ? '✔' : '✎'}</button></h1>${pc && typeof prepTrail === 'function' ? prepTrail(4) : ''}
    ${pc ? '' : `${catsUsed.length > 1 ? `<div class="chips ck-cats"><button class="btn ${!cat ? 'on' : ''}" data-cat="">Toutes</button>${catsUsed.map((c) => `<button class="btn ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="row c2 ck-tabs">${lists.map(([l, , name]) => {
      const n = checkLeft(l).length, all = checkItems(l).length;
      return `<button class="btn ${l === ckList ? 'on' : ''}" data-list="${l}">${ckIcon(l)} ${esc(name)}<small>${!all ? 'vide' : n ? `${n} restant${n > 1 ? 's' : ''}` : '✔ fait'}</small></button>`;
    }).join('')}</div>
    <p class="help ck-catline">${ckCats(ckList).map((c) => `<span class="ck-tag">${esc(c)}</span>`).join(' ')}</p>`}
    
    ${items.length && left.length ? '<p class="help">Appui simple : <b class="ck-red-t">orange</b>, pas fait (valeur, photo). Appui long : <b class="ck-green-t">vert</b>, fait. Appui long sur un vert : remis à blanc.</p>' : ''}
    ${!items.length ? '<div class="empty-state">Pas encore de point dans cette liste.<br><br>Touchez « Modifier la liste ».</div>' : ''}
    ${ckEditing ? ckEditRows(items) : ''}
    <div class="ck-list" ${ckEditing ? 'hidden' : ''}>${order.map((x) => {
      const st = done.has(x.id) || ckGreen.has(x.id) ? 'done' : open.has(x.id) ? 'red' : '';
      const stay = done.has(x.id) && !ckGreen.has(x.id); // vert installé : appui long pour remettre à zéro
      return `<div class="ck-wrap ${st}" data-id="${x.id}">
        <button class="btn ck-item ${st}" ${stay ? `data-undo="${x.id}"` : `data-tap="${x.id}"`}><span class="box">${st === 'done' ? '✔' : st === 'red' ? '✕' : ''}</span><span>${esc(st ? ckLabelVal(x) : x.label)}${x.note ? `<small class="ck-note">${esc(x.note)}</small>` : ''}${(() => { const n = photosFor(ckList).filter((p) => p.item === x.id).length; return n ? `<small class="ck-phn">📷 ${n}</small>` : ''; })()}</span></button>
        ${x.action === 'sheet' ? '<button class="btn primary ck-side" data-sheet="1">📸 Ouvrir la fiche à envoyer</button>' : ''}
        ${st === 'red' ? panel(x) : ''}
        ${st === 'done' && ckShowPh.has(x.id) ? `<div class="ck-panel ck-ph-view">${photoStrip(photosFor(ckList).filter((p) => p.item === x.id), true)}<div class="row"><button class="btn" data-iphoto="${x.id}">📷 + photo<small>photothèque, fichier ou appareil photo</small></button></div></div>` : ''}
      </div>`;
    }).join('')}</div>
    ${items.length && !left.length && !builtin ? `<div class="ck-allok">✅ ${esc(ckName(ckList))} : tout est fait !</div>` : ''}
    ${items.length && !left.length && builtin ? `<div class="ck-allok">✅ ${esc(ckName(ckList))} : tout est fait !<small>${ckList === 'dep' ? 'Bonne navigation !' : 'Le bateau est prêt. Bonne journée !'}</small></div>
      ${ckList === 'dep' && !pc ? `<div class="row c2"><button class="btn big primary" data-auto="1">▶ Journal automatique</button><button class="btn big" data-list="quit">🔒 ${esc(ckName('quit'))}</button></div>`
        : isLake() && ckList !== 'dep' ? '<div class="row"><button class="btn big" data-sheet="1">📸 Fiche du jour</button></div>' : ''}` : ''}
    ${did.length ? `<details class="section"><summary>Déjà fait (${did.length}) : appui long pour remettre à zéro</summary>
      <div class="checks ck-did">${did.map((x) => `<button class="btn check on" data-undo="${x.id}"><span class="box">✔</span>${esc(ckLabelVal(x))}${x.action === 'releves' && relevesSummary(today) ? `<small>${esc(relevesSummary(today))}</small>` : ''}</button>`).join('')}</div></details>` : ''}
    ${builtin ? (() => {
      // v387 (Corban) : « Observations » = un bouton comme ceux du check-in, d'une couleur à lui, toujours en fin de liste,
      // dans son propre cadre ; il ouvre le commentaire et les photos.
      const txt = obs[constatKey(ckList)] || '', ph = photosFor(ckList, curMode() === 'lacj' ? dayKey(new Date()) : null).filter((p) => !p.item);
      return `<div class="ck-obs-box"><div class="ck-wrap">
        <button class="btn ck-item ck-obs-btn ${ckObsOpen ? 'open' : ''}" data-obs="1"><span class="box">📝</span><span>Observations${txt ? `<small class="ck-note">${esc(txt.length > 70 ? txt.slice(0, 70) + '…' : txt)}</small>` : ''}${ph.length ? `<small class="ck-phn">📷 ${ph.length}</small>` : ''}</span></button>
        ${ckObsOpen ? `<div class="ck-panel">
          <textarea class="text" id="constat" rows="4" placeholder="Écrire, ou toucher le micro du clavier pour dicter…">${esc(txt)}</textarea>
          ${photoStrip(ph, true)}
          <div class="row"><button class="btn" data-photo-add="1">📷 + photo<small>photothèque, fichier ou appareil photo</small></button></div></div>` : ''}
      </div></div>`;
    })() : ''}
    ${ckList === 'dep' ? `<div class="row ck-pub-row"><button class="btn big ck-pub" id="prepPub">📤 Publier<small>rapport PréP + check-in, image ou PDF</small></button></div>` : ''}
    ${pc ? '' : `<div class="row c2" style="margin-top:16px">
      <button class="btn" data-edit="1">✎ Modifier la liste</button>
      <button class="btn" data-reset="1" ${nDone || open.size ? '' : 'disabled'}>↺ Recommencer cette liste</button>
    </div>
    <div class="row c2"><button class="btn" data-newlist="1">＋ Nouvelle liste</button><button class="btn" data-bases="1">📚 Mes bases</button></div>`}`;
  if (ckList === 'dep') prepReportCache();
  fillPhotos(main);
  // v386 (Corban) : après une saisie dans un point orange, une bulle rappelle l'appui long pour valider.
  main.onchange = (e) => { const t = e.target; if ((t.dataset.val || t.dataset.rel) && t.value.trim() && t.closest('.ck-wrap.red')) toast('Appui long sur le point pour valider la valeur (vert)'); };
  main.oninput = (e) => {
    const t = e.target;
    if (t.dataset.edlab != null) { const v = t.value.trim(); if (v) { const x = items[Number(t.dataset.edlab)], had = !!x.unit; x.label = v; ckColon(x); ckEdSave(); if (!had && x.unit) { const sel = main.querySelector(`[data-edunit="${t.dataset.edlab}"]`); if (sel) sel.value = x.unit; } } return; }
    if (t.dataset.edunit != null) { const x = items[Number(t.dataset.edunit)]; if (t.value) x.unit = t.value; else delete x.unit; ckEdSave(); return; }
    if (t.id === 'constat' && builtin) { obs[constatKey(ckList)] = t.value; return saveCruise(); }
    if (t.dataset.val) { const x = items.find((i) => i.id === t.dataset.val); setCkVal(x, t.value.trim()); return saveCruise(); }
    if (!t.dataset.rel) return;
    const k = t.dataset.rel;
    today[k] = t.value.trim();
    if (today._auto) delete today._auto[k];
    saveCruise();
  };
  const toWhite = (id) => {
    const x = items.find((i) => i.id === id);
    const s = checkDone(); s.delete(id); setCheckDone(s);
    const o = ckOpen(); o.delete(id); setCkOpen(o);
    if (x) setCkVal(x, '');
    for (const p of photosFor(ckList).filter((p) => p.item === id)) removePhoto(p.id);
    saveCruise();
  };
  const toGreen = (id) => {
    ckFresh.delete(id);
    const s = checkDone(); s.add(id); setCheckDone(s);
    const o = ckOpen(); o.delete(id); setCkOpen(o); saveCruise();
    ckPending++;
    ckGreen.set(id, setTimeout(() => { ckGreen.delete(id); if (--ckPending === 0) ckLater(() => { if (currentView === 'checklist') VIEWS.checklist(); }, 0); }, 3000));
    VIEWS.checklist();
  };
  // v379 (Corban) : appui simple = orange (pas fait : valeur, photo) ; appui long = vert (fait).
  // Sur un point vert, appui long = retour au blanc ; s'il a une photo, on demande s'il faut la supprimer.
  const toWhiteKeep = (id) => {
    const s = checkDone(); s.delete(id); setCheckDone(s);
    const o = ckOpen(); o.delete(id); setCkOpen(o); saveCruise();
  };
  const toGreenNow = (id) => {
    ckFresh.delete(id);
    const s = checkDone(); s.add(id); setCheckDone(s);
    const o = ckOpen(); o.delete(id); setCkOpen(o); saveCruise();
  };
  const askPhoto = (id) => {
    const ph = photosFor(ckList).filter((p) => p.item === id);
    if (!ph.length) return;
    const ov = document.createElement('div'); ov.className = 'ck-ask';
    ov.innerHTML = `<div class="ck-ask-box"><p>Ce point a ${ph.length > 1 ? `${ph.length} photos` : 'une photo'}. ${ph.length > 1 ? 'Les supprimer' : 'La supprimer'} ?</p>
      <button class="btn big danger" data-ckdel="1">🗑 Supprimer ${ph.length > 1 ? 'les photos' : 'la photo'}</button>
      <button class="btn big" data-ckkeep="1">Garder ${ph.length > 1 ? 'les photos' : 'la photo'}</button></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) { if (e.target === ov) close(); return; }
      if (b.dataset.ckkeep) { buzz(); toast('Photo gardée'); return close(); }
      if (b.dataset.ckdel) holdDel(b, () => { for (const p of ph) removePhoto(p.id); close(); toast(ph.length > 1 ? 'Photos supprimées' : 'Photo supprimée'); if (currentView === 'checklist') VIEWS.checklist(); }, `🗑 Appui long pour supprimer`);
    };
  };
  let hold = null;
  const stopHold = () => { if (hold) { clearTimeout(hold.timer); hold.b.classList.remove('holding'); hold = null; } };
  main.onpointerdown = (e) => {
    const b = e.target.closest('.ck-item[data-undo], .ck-item[data-tap]');
    if (!b) return;
    b.classList.add('holding');
    hold = { b, timer: setTimeout(() => {
      hold = null; buzz(); ckFired = true;
      if (b.dataset.undo) { const id = b.dataset.undo; toWhiteKeep(id); toast('Point remis à faire'); VIEWS.checklist(); return askPhoto(id); }
      toGreenNow(b.dataset.tap); VIEWS.checklist();
    }, 600) };
  };
  main.onpointerup = main.onpointercancel = main.onpointerleave = () => { if (ckFired) { ckFired = false; ckHeld = Date.now(); } stopHold(); };
  main.oncontextmenu = (e) => { if (e.target.closest('.ck-item')) e.preventDefault(); };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ((b.dataset.undo || b.dataset.tap) && Date.now() - ckHeld < 350) return;
    // v381 (Corban) : appui court sur un point vert : montre (ou cache) ses photos, avec « Ajouter une photo ».
    if (b.dataset.undo && b.classList.contains('ck-item')) {
      buzz(); const id = b.dataset.undo;
      if (!photosFor(ckList).some((p) => p.item === id)) return toast('Point fait · pas de photo · appui long pour le remettre à faire');
      ckShowPh.has(id) ? ckShowPh.delete(id) : ckShowPh.add(id); return VIEWS.checklist();
    }
    if (b.dataset.tap) {
      const id = b.dataset.tap, o = ckOpen();
      buzz();
      if (o.has(id)) return toast('Appui long pour le passer en vert (fait)');
      o.add(id); setCkOpen(o); saveCruise();
      return VIEWS.checklist();
    }
    buzz();
    if (b.dataset.list) return VIEWS.checklist(b.dataset.list);
    if (b.dataset.cat != null) { settings.ckCat = b.dataset.cat; saveSettings(); const f = ckDefs().find(([l]) => !b.dataset.cat || ckCats(l).includes(b.dataset.cat)); return VIEWS.checklist(f ? f[0] : ckList); }
    if (b.dataset.newlist) return renderCkNew(null, curMode());
    if (b.dataset.bases) return go('ckbases');
    if (b.dataset.iphoto) return takePhoto(ckList, () => VIEWS.checklist(), b.dataset.iphoto);
    if (b.dataset.photoAdd) return takePhoto(ckList, () => VIEWS.checklist());
    if (b.dataset.pdel) return holdDel(b, () => { removePhoto(b.dataset.pdel); VIEWS.checklist(); }, '🗑');
    if (b.dataset.sheet) return go('sheet', dayKey(new Date()));
    if (b.dataset.auto) return go('new');
    if (b.dataset.edit) return VIEWS.checklist({ edit: true, list: ckList });
    if (b.dataset.ckedit) { ckEditing = !ckEditing; if (!ckEditing) toast('Liste enregistrée'); return VIEWS.checklist(); }
    if (b.dataset.edup || b.dataset.eddn) { const i = Number(b.dataset.edup || b.dataset.eddn), j = b.dataset.edup ? i - 1 : i + 1; [items[i], items[j]] = [items[j], items[i]]; ckEdSave(); return VIEWS.checklist(); }
    if (b.dataset.eddel) return holdDel(b, () => { items.splice(Number(b.dataset.eddel), 1); ckEdSave(); VIEWS.checklist(); }, '🗑');
    if (b.id === 'ckEdAdd') { const v = ($('#ckEdNew').value || '').trim(); if (!v) { toast('Écrivez le point à ajouter'); return $('#ckEdNew').focus(); } const nx = { id: uid(), label: v }; ckColon(nx); items.push(nx); ckEdSave(); toast(nx.unit ? 'Point à valeur ajouté : choisissez l’unité' : 'Point ajouté'); VIEWS.checklist(); const n = $('#ckEdNew'); if (n) n.scrollIntoView({ block: 'center' }); return; }
    if (b.id === 'ckEdCopy') { const txt = `Check-in ${owner !== cruise ? owner.info.boat || '' : ''} :\n` + items.map((x, i) => `${i + 1}. ${x.label}${x.unit ? ` [${x.unit === 'nb' ? 'nombre' : x.unit}]` : ''}`).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Liste copiée : collez-la dans le fil avec Claude'), () => { prompt('Copiez la liste :', txt); }); return; }
    if (b.dataset.obs) { ckObsOpen = !ckObsOpen; VIEWS.checklist(); if (ckObsOpen) { const t = $('#constat'); if (t) t.scrollIntoView({ block: 'center' }); } return; }
    if (b.id === 'prepPub') return prepPublishDialog(); // v388 (Corban) : mise en page, photos, image ou PDF
    if (b.dataset.undo) return toast('Appui long pour rouvrir ce point');
    if (b.dataset.reset) return armed(b, 'Toucher encore : recommencer', () => { items.forEach((x) => toWhite(x.id)); VIEWS.checklist(); });
  };
};

const ckIcon = (l) => (l === 'dep' ? '⛵' : l === 'quit' ? '🔒' : '📋');
// Sélecteur de catégories (plusieurs possibles).
const catPickerHtml = (sel) => `<div class="chips ck-catpick">${allCkCats(sel).map((c) => `<button class="btn ${sel.includes(c) ? 'on' : ''}" data-pcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="row c2"><input class="text" id="catNew" placeholder="Autre catégorie" autocomplete="off"><button class="btn" id="catAdd">＋ Catégorie</button></div>`;
function catPickerClick(b, sel) {
  if (b.dataset.pcat != null) { const c = b.dataset.pcat; const i = sel.indexOf(c); if (i < 0) sel.push(c); else sel.splice(i, 1); return true; }
  if (b.id === 'catAdd') { const v = ($('#catNew').value || '').trim(); if (!v) { toast('Écrivez la catégorie'); return false; } if (!sel.includes(v)) sel.push(v); return true; }
  return false;
}
// Éditeur de points commun aux listes et aux bases.
const itemsEditHtml = (items) => `<div class="ck-edit">${items.map((x, i) => `
      <div class="ck-row">
        <textarea class="text" rows="2" data-lab="${i}" aria-label="Point ${i + 1}">${esc(x.label)}</textarea>
        <textarea class="text ck-note-in" rows="1" data-note="${i}" placeholder="Action, précision (facultatif)">${esc(x.note || '')}</textarea>
        <label class="ck-unit">Valeur à saisir <select data-unit="${i}">${CK_UNITS.map((u) => `<option value="${u}" ${(x.unit || '') === u ? 'selected' : ''}>${u ? (u === 'nb' ? 'nombre' : u) : 'aucune'}</option>`).join('')}</select></label>
        <div class="ck-tools"><button class="btn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Monter">▲</button><button class="btn danger" data-del="${i}" aria-label="Supprimer">✕</button></div>
      </div>`).join('')}</div>`;
function itemsEditInput(t, items, save) {
  if (t.dataset.unit != null) { const x = items[Number(t.dataset.unit)]; if (t.value) x.unit = t.value; else delete x.unit; save(); return true; }
  if (t.dataset.note != null) { const x = items[Number(t.dataset.note)]; const v = t.value.trim(); if (v) x.note = v; else delete x.note; save(); return true; }
  if (t.dataset.lab == null) return false;
  const v = t.value.trim();
  if (v) { items[Number(t.dataset.lab)].label = v; save(); }
  return true;
}
function itemsEditClick(b, items, save, again) {
  if (b.id === 'ckAdd') {
    const v = $('#ckNew').value.trim();
    if (!v) { toast('Écrivez le point à ajouter'); $('#ckNew').focus(); return true; }
    items.push({ id: uid(), label: v }); save(); toast('Point ajouté'); again(); return true;
  }
  if (b.dataset.up) { const i = Number(b.dataset.up); [items[i - 1], items[i]] = [items[i], items[i - 1]]; save(); again(); return true; }
  if (b.dataset.del) { armed(b, 'Sûr ?', () => { items.splice(Number(b.dataset.del), 1); save(); again(); }); return true; }
  return false;
}
const toBaseItems = (items) => items.filter((x) => !x.key && x.action !== 'releves').map((x) => ({ label: x.label, ...(x.unit ? { unit: x.unit } : {}), ...(x.note ? { note: x.note } : {}) }));
const fromBaseItems = (items) => items.map((x) => ({ id: uid(), ...x }));
function syncSeaTpl(owner, mode) {
  if (owner !== cruise || mode !== 'mer') return;
  for (const [, p] of CK_DEFS.mer) seaTpl[p] = structuredClone(owner[p] || []);
  seaTpl.ckLists = structuredClone(owner.ckLists || []); seaTpl.ckMeta = structuredClone(owner.ckMeta || {}); seaTpl.briefSeeded = !!owner.briefSeeded;
  for (const k of Object.keys(seaTpl)) if (k.startsWith('ckx_')) delete seaTpl[k];
  for (const x of seaTpl.ckLists) seaTpl['ckx_' + x.id] = structuredClone(owner['ckx_' + x.id] || []);
  store.set('ldb.tpl.mer', seaTpl);
}

function renderChecklistEdit(boatId, list, mode) {
  const owner = boatId ? boatById(boatId) : checklistOwner();
  if (!ckDefs(mode, owner).some((d) => d[0] === list)) list = 'dep';
  const prop = ckProp(list, mode, owner);
  owner[prop] = owner[prop] || [];
  const items = owner[prop];
  const builtin = isCkBuiltin(list);
  // Mer : la liste modifiée devient aussi le modèle des prochaines croisières.
  const save = () => { if (owner !== cruise) return saveBoats(); syncSeaTpl(owner, mode); saveCruise(); };
  const again = () => renderChecklistEdit(boatId, list, mode);
  const cats = ckCats(list, mode, owner).slice();
  const setMeta = (name, cs) => {
    if (builtin) { owner.ckMeta = owner.ckMeta || {}; owner.ckMeta[mode] = owner.ckMeta[mode] || {}; owner.ckMeta[mode][list] = { name, cats: cs }; }
    else { const x = owner.ckLists.find((y) => y.id === list); x.name = name; x.cats = cs; }
    save();
  };
  const main = $('#view');
  main.innerHTML = `
    <h1>Modifier la check-list</h1>
    <p class="help" style="margin-top:-8px">${esc(MODES[mode].icon + ' ' + MODES[mode].name)}${owner !== cruise ? ` · ${esc(owner.info.boat || '')}` : ''}</p>
    <div class="row c2 ck-tabs">${ckDefs(mode, owner).map(([l, , name]) => `<button class="btn ${l === list ? 'on' : ''}" data-elist="${l}">${ckIcon(l)} ${esc(name)}</button>`).join('')}
      <button class="btn" data-newlist="1">＋ Nouvelle liste</button></div>
    <section class="field"><h2>Nom et catégories</h2>
      <input class="text" id="ckName" value="${esc(ckName(list, mode, owner))}" placeholder="Nom de la liste" autocomplete="off">
      ${catPickerHtml(cats)}
      <div class="row c2"><button class="btn" id="ckSaveBase">💾 Enregistrer comme base</button>${builtin ? '' : '<button class="btn danger" id="ckDelList">🗑 Supprimer la liste</button>'}</div>
    </section>
    <p class="help">${owner === cruise ? 'Listes de cette croisière ; elles servent aussi de modèle pour les prochaines croisières en mer.' : `Listes du bateau ${esc(owner.info.boat || '')} : elles serviront à chaque sortie.`} Enregistrement automatique.</p>
    ${itemsEditHtml(items)}
    <section class="field"><h2>Nouveau point · ${esc(ckName(list, mode, owner))}</h2>
      <textarea class="text" id="ckNew" rows="2" placeholder="ex. Fermer la vanne des WC"></textarea>
      <div class="row"><button class="btn big primary" id="ckAdd">＋ Ajouter ce point</button></div>
      ${list === 'dep' && !items.some((x) => x.action === 'releves' || x.key) ? '<div class="row"><button class="btn" id="ckRel">＋ Points « relevés » : heures moteur, carburant, batteries, eau</button></div>' : ''}
      ${ckLib.length ? `<div class="row"><button class="btn" id="ckFromBase">＋ Ajouter les points d’une base</button></div>` : ''}
    </section>
    <div class="row"><button class="btn big" id="ckBack">✔ Terminé</button></div>`;
  $('#ckName').onchange = (e) => { const v = e.target.value.trim(); if (v) { setMeta(v, cats); toast('Nom enregistré'); } };
  main.oninput = (e) => { itemsEditInput(e.target, items, save); };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (catPickerClick(b, cats)) { setMeta(ckName(list, mode, owner), cats); return again(); }
    if (b.dataset.elist) return renderChecklistEdit(boatId, b.dataset.elist, mode);
    if (b.dataset.newlist) return renderCkNew(boatId, mode);
    if (itemsEditClick(b, items, save, again)) return;
    if (b.id === 'ckRel') { items.unshift(...relevesItems(uid() + '-')); save(); toast('Points ajoutés en tête'); return again(); }
    if (b.id === 'ckSaveBase') {
      const name = ckName(list, mode, owner);
      const ex = ckLib.find((x) => x.name.toLowerCase() === name.toLowerCase());
      const rec = { id: ex ? ex.id : uid(), name, cats: cats.slice(), items: toBaseItems(items), at: new Date().toISOString() };
      if (ex) Object.assign(ex, rec); else ckLib.push(rec);
      saveLib(); return toast(ex ? `Base « ${name} » mise à jour` : `Base « ${name} » enregistrée`);
    }
    if (b.id === 'ckFromBase') return renderPickBase((base) => { items.push(...fromBaseItems(base.items)); save(); toast(`${base.items.length} points ajoutés`); again(); }, again);
    if (b.id === 'ckDelList') return holdDel(b, () => {
      owner.ckLists = owner.ckLists.filter((x) => x.id !== list); delete owner[prop]; save(); toast('Liste supprimée'); renderChecklistEdit(boatId, 'dep', mode);
    });
    if (b.id === 'ckBack') { main.oninput = null; return boatId ? go('boats', boatId) : VIEWS.checklist(list); }
  };
}
// Choisir une base (pour compléter une liste).
function renderPickBase(pick, back) {
  const main = $('#view');
  main.innerHTML = `<button class="btn" id="pbBack">◀ Retour</button><h1>Choisir une base</h1>
    <div class="checks">${ckLib.map((b) => `<button class="btn" data-pb="${b.id}">📚 ${esc(b.name)}<small>${b.items.length} points · ${esc((b.cats || []).join(', '))}</small></button>`).join('')}</div>`;
  main.oninput = null;
  main.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; buzz(); if (b.id === 'pbBack') return back(); const x = ckLib.find((y) => y.id === b.dataset.pb); if (x) pick(x); };
}
// Nouvelle liste : vide ou à partir d'une base.
function renderCkNew(boatId, mode) {
  const owner = boatId ? boatById(boatId) : checklistOwner();
  const cats = [];
  const main = $('#view');
  const back = () => (boatId ? renderChecklistEdit(boatId, 'dep', mode) : VIEWS.checklist());
  const create = (name, cs, items) => {
    const id = uid();
    owner.ckLists = owner.ckLists || [];
    owner.ckLists.push({ id, name, cats: cs });
    owner['ckx_' + id] = items;
    if (owner !== cruise) saveBoats(); else { syncSeaTpl(owner, mode); saveCruise(); }
    toast(`Liste « ${name} » créée`);
    return boatId ? renderChecklistEdit(boatId, id, mode) : (items.length ? VIEWS.checklist(id) : renderChecklistEdit(null, id, mode));
  };
  const draw = () => {
    const nm = $('#nlName') ? $('#nlName').value : '';
    main.innerHTML = `<button class="btn" id="nlBack">◀ Retour</button><h1>Nouvelle check-list</h1>
      ${ckLib.length ? `<section class="field"><h2>À partir d’une base</h2><div class="checks">${ckLib.map((b) => `<button class="btn" data-from="${b.id}">📚 ${esc(b.name)}<small>${b.items.length} points · ${esc((b.cats || []).join(', '))}</small></button>`).join('')}</div></section>` : ''}
      <section class="field"><h2>Liste vide</h2>
        <input class="text" id="nlName" value="${esc(nm)}" placeholder="Nom, ex. Avitaillement" autocomplete="off">
        ${catPickerHtml(cats)}
        <div class="row"><button class="btn big primary" id="nlCreate">＋ Créer la liste</button></div></section>`;
  };
  draw();
  main.oninput = null;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'nlBack') return back();
    if (catPickerClick(b, cats)) return draw();
    if (b.dataset.from) { const x = ckLib.find((y) => y.id === b.dataset.from); return create(x.name, (x.cats || []).slice(), fromBaseItems(x.items)); }
    if (b.id === 'nlCreate') { const v = $('#nlName').value.trim(); if (!v) { toast('Donnez un nom à la liste'); return $('#nlName').focus(); } return create(v, cats.slice(), []); }
  };
}
// Mes bases : modifier, compléter, effacer.
VIEWS.ckbases = function renderCkBases(openId) {
  if (openId) return renderBaseEdit(openId);
  const main = $('#view');
  const cats = [...new Set(ckLib.flatMap((b) => b.cats || []))];
  const cat = settings.ckBaseCat || '';
  const list = ckLib.filter((b) => !cat || (b.cats || []).includes(cat));
  // v344 (Corban) : le check-in de chaque bateau se retrouve ici ; on peut le modifier, le dupliquer ou ajouter une autre liste de check-in.
  const ckBoats = boats.map((bt) => { checklistOwner(bt.id); return { bt, lists: ckDefs('lacj', bt).filter(([l]) => ckCats(l, 'lacj', bt).includes('Check-in')) }; });
  const boatsHtml = ckBoats.length ? `<h2 class="sub-h">Check-in des bateaux</h2>${ckBoats.map(({ bt, lists }) => `<section class="ck-boat"><h3>🚤 ${esc(bt.info.boat || 'Bateau')}</h3>
      ${lists.map(([l, pp, nm]) => `<div class="ck-bl"><button class="btn ck-bl-open" data-bedit="${bt.id}" data-l="${l}">✅ ${esc(nm)}<small>${(bt[pp] || []).length} points · ${esc(ckCats(l, 'lacj', bt).join(', '))}</small></button><button class="btn ck-bl-dup" data-bdup="${bt.id}" data-l="${l}" aria-label="Dupliquer">⧉ Dupliquer</button></div>`).join('')}
      <button class="btn big primary ck-bl-add" data-bnew="${bt.id}">＋ Nouvelle liste de check-in</button></section>`).join('')}<h2 class="sub-h">Bases (modèles)</h2>` : '';
  main.innerHTML = `<h1>Check-lists</h1>${boatsHtml}
    <p class="help">Listes modèles gardées dans le téléphone. On les reprend pour créer ou compléter la check-list d’un bateau ou d’une croisière.</p>
    ${cats.length > 1 ? `<div class="chips ck-cats"><button class="btn ${!cat ? 'on' : ''}" data-bcat="">Toutes</button>${cats.map((c) => `<button class="btn ${c === cat ? 'on' : ''}" data-bcat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="checks">${list.map((b) => `<button class="btn" data-base="${b.id}">📚 ${esc(b.name)}<small>${b.items.length} points · ${esc((b.cats || []).join(', ') || 'sans catégorie')}</small></button>`).join('') || '<p class="help">Pas encore de base. Dans une check-list, touchez « Modifier la liste » puis « Enregistrer comme base », ou créez-en une ici.</p>'}</div>
    <div class="row c2" style="margin-top:12px"><button class="btn big primary" id="baseNew">＋ Nouvelle base</button>${cruise ? '<button class="btn big" data-go="checklist">✅ Check-lists</button>' : ''}</div>`;
  main.oninput = null;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.bedit) return renderChecklistEdit(b.dataset.bedit, b.dataset.l, 'lacj');
    if (b.dataset.bdup || b.dataset.bnew) {
      const bt = boatById(b.dataset.bdup || b.dataset.bnew); if (!bt) return;
      const src = b.dataset.bdup ? b.dataset.l : null;
      const id = uid(), name = src ? `${ckName(src, 'lacj', bt)} (copie)` : 'Nouveau check-in';
      const cats = src ? [...new Set(['Check-in', ...ckCats(src, 'lacj', bt)])] : ['Check-in'];
      bt.ckLists = bt.ckLists || []; bt.ckLists.push({ id, name, cats });
      bt['ckx_' + id] = src ? (bt[ckProp(src, 'lacj', bt)] || []).map((x) => ({ ...x, id: uid() })) : [];
      saveBoats(); toast(src ? `Liste « ${name} » créée` : 'Nouvelle liste de check-in créée');
      return renderChecklistEdit(bt.id, id, 'lacj');
    }
    if (b.dataset.bcat != null) { settings.ckBaseCat = b.dataset.bcat; saveSettings(); return VIEWS.ckbases(); }
    if (b.dataset.base) return renderBaseEdit(b.dataset.base);
    if (b.id === 'baseNew') { const x = { id: uid(), name: 'Nouvelle base', cats: [], items: [], at: new Date().toISOString() }; ckLib.push(x); saveLib(); return renderBaseEdit(x.id); }
  };
};
function renderBaseEdit(id) {
  const base = ckLib.find((x) => x.id === id);
  if (!base) return VIEWS.ckbases();
  base.cats = base.cats || [];
  const save = () => { base.at = new Date().toISOString(); saveLib(); };
  const again = () => renderBaseEdit(id);
  const main = $('#view');
  main.innerHTML = `<button class="btn" id="beBack">◀ Mes bases</button><h1>📚 ${esc(base.name)}</h1>
    <section class="field"><h2>Nom et catégories</h2>
      <input class="text" id="beName" value="${esc(base.name)}" autocomplete="off">
      ${catPickerHtml(base.cats)}</section>
    ${itemsEditHtml(base.items)}
    <section class="field"><h2>Nouveau point</h2>
      <textarea class="text" id="ckNew" rows="2" placeholder="ex. Eau : 2 L par personne et par jour"></textarea>
      <div class="row"><button class="btn big primary" id="ckAdd">＋ Ajouter ce point</button></div></section>
    <div class="row c2">${cruise ? '<button class="btn" id="beUse">✅ Ajouter aux check-lists de la sortie</button>' : ''}<button class="btn danger" id="beDel">🗑 Effacer cette base</button></div>`;
  $('#beName').onchange = (e) => { const v = e.target.value.trim(); if (v) { base.name = v; save(); toast('Nom enregistré'); } };
  main.oninput = (e) => { itemsEditInput(e.target, base.items, save); };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'beBack') return VIEWS.ckbases();
    if (catPickerClick(b, base.cats)) { save(); return again(); }
    if (itemsEditClick(b, base.items, save, again)) return;
    if (b.id === 'beDel') return armed(b, 'Toucher encore : effacer', () => { ckLib = ckLib.filter((x) => x.id !== id); saveLib(); toast('Base effacée'); VIEWS.ckbases(); });
    if (b.id === 'beUse') {
      const owner = checklistOwner();
      const lid = uid();
      owner.ckLists = owner.ckLists || [];
      owner.ckLists.push({ id: lid, name: base.name, cats: base.cats.slice() });
      owner['ckx_' + lid] = fromBaseItems(base.items);
      if (owner !== cruise) saveBoats(); else { syncSeaTpl(owner, curMode()); saveCruise(); }
      toast(`Liste « ${base.name} » ajoutée`);
      return go('checklist', lid);
    }
  };
}

/* ---------- Mes bateaux ---------- */
// v421 (Corban) : vignette rectangulaire du bateau (photo choisie avec « 🖼 Vignette »), recadrée au centre en 3:2.
async function boatThumb(b, w = 480, h = 320) {
  if (!b || !b.thumb) return null;
  const url = await getPhoto(b.thumb); if (!url) return null;
  const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; }); if (!im) return null;
  const iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(w / iw, h / ih), sw = w / k, sh = h / k;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.85);
}
VIEWS.boats = function renderBoats(openId) {
  if (openId && openId.fields) return renderBoatFields(openId.fields, () => VIEWS.boats(openId.fields));
  const main = $('#view');
  main.innerHTML = `
    <h1>Mes bateaux</h1>
    <p class="help">Les données d’un bateau sont reprises à chaque sortie lacustre. Enregistrement automatique. Glisser un bateau vers la gauche : le supprimer (avec confirmation).</p>
    <div id="boatList">${boatsByNav().map((b) => `
      <details class="section" data-b="${b.id}" ${b.id === openId ? 'open' : ''}>
        <summary>${b.thumb && (b.docs || []).some((d) => d.id === b.thumb) ? `<img class="b-thumb" data-photo="${b.thumb}" alt="">` : '🚤 '}<span class="b-nm">${esc(b.info.boat || 'Nouveau bateau')}</span> <small>${esc(boatSub(b.info))}</small><button type="button" class="btn ck-editbtn b-editbtn no-navact" data-fields="${b.id}" aria-label="Modifier les libellés">✎</button></summary>
        <p class="help" style="padding:12px 14px 0;margin:0">Informations du bateau : touchez une case pour saisir ou corriger (enregistrement automatique).</p>
        <div data-form="${b.id}"></div>
        <section class="boat-pics" data-bp="${b.id}"><h3 class="sub-h">📷 Photos et papiers officiels</h3>
          ${(b.docs || []).length ? `<div class="bp-list photo-strip">${b.docs.map((d) => `<figure class="bp-item">${d.pdf ? `<button type="button" class="bp-pdf" data-pdfopen="${d.id}">📄<small>Scan PDF · toucher pour ouvrir</small></button>` : `<img data-photo="${d.id}" data-cap="${esc(d.cap || docKindLabel(d.kind).replace(/^\S+ /, ''))}" alt="Photo">`}<input class="text bp-cap" data-dcap="${d.id}" value="${esc(d.cap || '')}" placeholder="Libellé">${d.pdf ? '' : `<button type="button" class="btn bp-thumb${b.thumb === d.id ? ' on' : ''}" data-bpthumb="${d.id}" data-bt="${b.id}">🖼 ${b.thumb === d.id ? 'Vignette ✔' : 'Vignette'}</button>`}<button class="btn danger bp-del" data-bpdel="${d.id}" aria-label="Supprimer la photo">🗑</button></figure>`).join('')}</div>` : ''}
          <div class="row"><button class="btn" data-bpadd="${b.id}">📷 + photo<small>photothèque, fichier, appareil photo ou PDF</small></button></div>
        </section>
        <div class="row ck-pub-row" style="padding:0 14px"><button class="btn big ck-pub" data-bpub="${b.id}">📤 Publier<small>cette fiche en image ou PDF, avec les photos</small></button></div>
        ${boatVersBtn(b)}
        <!-- Check-lists retirées de Mes bateaux (Corban, v162) -->
        <div class="row b-delrow" style="padding:0 14px 14px"><button class="btn danger" data-del="${b.id}">Supprimer ce bateau${boats.length > 1 ? ' : ' + esc(b.info.boat || 'sans nom') : ''}</button></div>
      </details>`).join('')}</div>
    <div class="row b-addrow"><button class="btn big primary" id="addBoat">＋ Ajouter un bateau</button></div>`; // v421 (Corban) : « Supprimer ce bateau » dans le cadre de la fiche, « ＋ Ajouter un bateau » dessous, à part // v259 (Corban) : « ＋ Ajouter un libellé » juste au-dessus
  // v258 (Corban) : « Supprimer ce bateau » tout en bas de la page (après l'impression), visible quand le bateau est ouvert.
  for (const b of boats) {
    // Numéros utiles retirés de Mes bateaux (Corban, v162).
    compactForm($(`[data-form="${b.id}"]`, main), boatSections(b).filter((sec) => sec.title !== 'Numéros utiles (page SOS)'), b.info, () => {
      saveBoats(); syncCruiseFromBoat(b);
      { const nm = $(`details[data-b="${b.id}"] > summary .b-nm`, main); if (nm) nm.textContent = b.info.boat || 'Nouveau bateau'; }
    });
  }
  $('#addBoat').onclick = () => { buzz(); const b = { id: uid(), info: { contacts: LAKE_CONTACTS }, checklist: [], checklistDep: [], checklistX: [], checklistDepX: [] }; boats.push(b); saveBoats(); VIEWS.boats(b.id);
    setTimeout(() => { const f = $(`[data-form="${b.id}"] [data-k="boat"]`); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } }, 100); };
  fillPhotos(main);
  $('#boatList').addEventListener('input', (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.dcap) return;
    const bt = boats.find((x) => (x.docs || []).some((d) => d.id === t.dataset.dcap)); if (!bt) return;
    const d = bt.docs.find((x) => x.id === t.dataset.dcap); const v = t.value.trim(); if (v) d.cap = v; else delete d.cap; saveBoats();
    const im = t.parentNode.querySelector('img'); if (im) im.dataset.cap = v || docKindLabel(d.kind).replace(/^\S+ /, '');
  });
  $('#boatList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ck],[data-del],[data-copy],[data-fields],[data-vers],[data-dosopen],[data-bpadd],[data-bpdel],[data-pdfopen],[data-bpub],[data-bpthumb]');
    if (!b) return;
    e.preventDefault(); buzz();
    if (b.dataset.vers) return renderBoatVersions(boatById(b.dataset.vers), () => VIEWS.boats(b.dataset.vers));
    if (b.dataset.fields) return renderBoatFields(b.dataset.fields, () => VIEWS.boats(b.dataset.fields));
    // v225 (Corban) : photos dans Mes bateaux (appareil ou galerie), libellé sous chaque photo, suppression par appui long.
    if (b.dataset.bpadd) { const bt = boatById(b.dataset.bpadd); bt.docs = bt.docs || []; return addBoatDoc(bt, 'autre', () => { VIEWS.boats(bt.id); setTimeout(() => { const l = $$(`[data-bp="${bt.id}"] .bp-cap`); const c = l[l.length - 1]; if (c) { c.scrollIntoView({ block: 'center' }); c.focus(); } }, 200); }); }
    if (b.dataset.pdfopen) return getPhoto(b.dataset.pdfopen).then((u) => { if (!u) return toast('Scan introuvable'); fetch(u).then((r) => r.blob()).then((bl) => openLink(URL.createObjectURL(bl))); });
    if (b.dataset.bpdel) { const bt = boats.find((x) => (x.docs || []).some((d) => d.id === b.dataset.bpdel)); if (!bt) return; return holdDel(b, () => { bt.docs = bt.docs.filter((d) => d.id !== b.dataset.bpdel); delPhoto(b.dataset.bpdel); saveBoats(); toast('Photo supprimée'); VIEWS.boats(bt.id); }); }
    if (b.dataset.bpthumb) { const bt = boatById(b.dataset.bt); if (!bt) return; bt.thumb = bt.thumb === b.dataset.bpthumb ? null : b.dataset.bpthumb; saveBoats(); toast(bt.thumb ? 'Vignette du bateau choisie' : 'Vignette retirée'); return VIEWS.boats(bt.id); } // v421 (Corban)
    if (b.dataset.bpub) { return window.lxOpen && window.lxOpen('boats', b.dataset.bpub); }
    if (b.dataset.dosopen) { dossierBoat = b.dataset.dosopen; return go('dossier', b.dataset.dosopen); } // v218 : documents repris de l'ancien Recueil
    if (b.dataset.copy) {
      const from = boatById(b.dataset.copy), to = boatById(b.dataset.to);
      return armed(b, 'Toucher encore : les points s’ajoutent aux listes', () => {
        for (const p of ['checklistDep', 'checklist', 'checklistDepX', 'checklistX']) to[p] = (to[p] || []).concat((from[p] || []).map((x) => Object.assign({}, x, { id: uid() })));
        saveBoats(); toast('Check-lists copiées'); VIEWS.boats(to.id);
      });
    }
    if (b.dataset.ck) return go('checklist', { boatId: b.dataset.ck, list: b.dataset.l, mode: b.dataset.mode });
    holdDel(b, () => { boats = boats.filter((x) => x.id !== b.dataset.del); saveBoats(); VIEWS.boats(); });
  });
};

/* ---------- Ordre des bateaux : navigation réelle la plus récente (Corban, v147) ----------
   Seules comptent les sorties où l'on a vraiment navigué (entrées du journal, trace, fiche du jour remplie) ;
   modifier la fiche d'un bateau ne le fait pas remonter. */
function boatNavInfo() {
  const out = {}; // boatId -> { at, p: { purpose: at } }
  const byName = new Map(boats.map((b) => [(b.info.boat || '').trim().toLowerCase(), b.id]));
  for (const m of index) {
    const c = store.get('ldb.cruise.' + m.id, null);
    if (!c) continue;
    const id = (c.boatId && boats.some((b) => b.id === c.boatId)) ? c.boatId : byName.get(((c.info && c.info.boat) || '').trim().toLowerCase());
    if (!id) continue;
    let at = '';
    for (const e of c.entries || []) if (e.t > at) at = e.t;
    const tr = store.get('ldb.track.' + m.id, []);
    try { if (tr.length) { const t = new Date(tr[tr.length - 1][0]).toISOString(); if (t > at) at = t; } } catch (e) {}
    for (const [k, d] of Object.entries(c.days || {})) if (d && Object.keys(d).some((x) => d[x] !== '' && d[x] != null && x !== 'typeSortie') && k + 'T23:59' > at) at = k + 'T23:59';
    if (!at) continue;
    const o = out[id] = out[id] || { at: '', p: {} };
    if (at > o.at) o.at = at;
    const pu = c.purpose || 'mer';
    if (at > (o.p[pu] || '')) o.p[pu] = at;
  }
  return out;
}
// purpose donné (PréP) : d'abord le dernier bateau navigué pour ce type de sortie, puis les autres du plus récent au plus ancien.
// Navigants classés par ceux qui naviguent le plus (navigations réelles : entrées, trace, fiche remplie),
// puis la plus récente, puis l'ordre alphabétique (Corban, v185).
function cruiseRealAt(m, c) {
  let at = '';
  for (const e of c.entries || []) if (e.t > at) at = e.t;
  const tr = store.get('ldb.track.' + m.id, []);
  try { if (tr.length) { const t = new Date(tr[tr.length - 1][0]).toISOString(); if (t > at) at = t; } } catch (e) {}
  for (const [k, d] of Object.entries(c.days || {})) if (d && Object.keys(d).some((x) => d[x] !== '' && d[x] != null && x !== 'typeSortie') && k + 'T23:59' > at) at = k + 'T23:59';
  return at;
}
function membersByNav() {
  const nav = {};
  for (const m of index) {
    const c = store.get('ldb.cruise.' + m.id, null);
    if (!c || !(c.crew || []).length) continue;
    const at = cruiseRealAt(m, c); if (!at) continue;
    for (const p of new Set((c.crew || []).map((x) => x.memberId).filter(Boolean))) { const o = nav[p] = nav[p] || { n: 0, at: '' }; o.n++; if (at > o.at) o.at = at; }
  }
  const g = (x) => nav[x.id] || { n: 0, at: '' };
  return [...members].sort((a, z) => g(z).n - g(a).n || g(z).at.localeCompare(g(a).at) || memberName(a).localeCompare(memberName(z), 'fr'));
}
function boatsByNav(purpose) {
  const nav = boatNavInfo();
  const top = purpose ? Object.entries(nav).filter(([, o]) => o.p[purpose]).sort((a, z) => z[1].p[purpose].localeCompare(a[1].p[purpose]))[0] : null;
  const topId = top && top[0];
  const at = (b) => (nav[b.id] || {}).at || '';
  return [...boats].sort((a, z) => (a.id === topId ? -1 : z.id === topId ? 1 : 0) || at(z).localeCompare(at(a)) || (a.info.boat || '').localeCompare(z.info.boat || '', 'fr'));
}

/* ---------- Fiche du jour lacustre : le livre de bord simplifié du Savannah ---------- */
const LEVELS = [['Plein'], ['3/4'], ['1/2'], ['1/4'], ['Réserve']];
const OUTING_TYPES = [['Location'], ['Dès 17h00'], ['Journée semaine'], ['Journée WE'], ['Entraînement'], ['Invitation'], ['Autre sortie']];
const LAKE_WX = ['fVentDir', 'fVentVit', 'fRafales', 'fVentTend', 'fFeux', 'fAir', 'fEau', 'fOrage'];
const LAKE_DAY_SECTIONS = [
  { title: '1 · Informations générales', fields: [
    { key: 'typeSortie', label: 'Type de sortie', type: 'choice', options: OUTING_TYPES },
    { key: 'skipper', label: 'Skipper', type: 'crewpick' },
    { key: 'coSkipper', label: 'Second', type: 'crewpick' },
    { key: 'equipage', label: 'Équipage', type: 'area', rows: 2 },
    { key: 'calcLake', type: 'calc', calc: (d) => calcLake(d) },
    n('nmJour', 'Nombre de milles parcourus', 'NM', { wide: true }),
    n('moteurDebut', 'Heures moteur : début', 'h'), n('moteurSoir', 'Heures moteur : fin', 'h'),
    n('carbPct', 'Carburant à l’arrivée', '%'), n('eauPct', 'Eau à l’arrivée', '%'),
    n('batt1', 'Batterie 1 à l’arrivée', 'V'), n('batt2', 'Batterie 2 à l’arrivée', 'V'),
    { key: 'diesel', label: 'Niveau du diesel', type: 'choice', options: LEVELS },
    { key: 'eauPotable', label: 'Niveau de l’eau potable', type: 'choice', options: LEVELS },
    { key: 'eauxNoires', label: 'Réservoir eaux noires', type: 'choice', options: [['OK'], ['À vidanger']] },
    { key: 'respUnique', label: 'Skipper seul responsable de la franchise (entraînement)', type: 'choice', options: [['Non, partagée'], ['Oui, le skipper']] },
    n('montant', 'Location : montant', 'CHF'),
    { key: 'lienDossier', label: 'Documents de la sortie : lien vers le dossier', type: 'line', wide: true, inputmode: 'url' },
  ] },
  { title: '2 · Observations, constatations, propositions d’améliorations', fields: [
    { key: 'observations', label: '', type: 'area', rows: 5 },
    { key: 'sigSkip', label: 'Signature du responsable', type: 'signature' },
  ] },
  { title: 'Météo (facultatif)', collapsed: true, fields: DAY_SECTIONS.flatMap((s) => s.fields).filter((f) => LAKE_WX.includes(f.key)) },
];

// Heures de départ et de retour : trace GPS du jour, sinon entrées Départ / Arrivée du journal.
function outingTimes(k) {
  const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
  const line = typeof mapData === 'function' ? mapData(k).line : [];
  const dep = ents.find((e) => (e.v.evt || []).includes('Départ'));
  const arr = [...ents].reverse().find((e) => (e.v.evt || []).includes('Arrivée'));
  const t0 = dep ? Date.parse(dep.t) : line.length ? line[0].t : ents.length ? Date.parse(ents[0].t) : null;
  let t1 = arr ? Date.parse(arr.t) : line.length > 1 ? line[line.length - 1].t : ents.length > 1 ? Date.parse(ents[ents.length - 1].t) : null;
  if (t1 != null && t0 != null && t1 <= t0) t1 = null;
  const nm = line.length > 1 ? mapData(k).nm : 0;
  return { t0, t1, nm, live: typeof tracking !== 'undefined' && !!tracking && k === dayKey(new Date()) };
}
function calcLake(d) {
  const k = currentDay || dayKey(new Date());
  const o = outingTimes(k);
  const nav = navDur(k) || (o.t0 && o.t1 ? fmtDur(o.t1 - o.t0) : '');
  if (!o.t0) return '<p class="help">Au départ, lancez le journal automatique (onglet Saisir) : heures, durée et milles se rempliront seuls avec le GPS.</p>';
  return `<table class="calc-t">
    <tr><td>Départ</td><td>${tzHtml(new Date(o.t0))}</td></tr>
    <tr><td>Retour</td><td>${o.t1 ? tzHtml(new Date(o.t1)) : o.live ? 'en cours…' : '–'}</td></tr>
    ${nav ? `<tr><th>Navigation</th><th>${esc(nav)}</th></tr>` : ''}
    ${o.nm > 0.05 ? `<tr><td>Trace GPS</td><td>${fr(o.nm)} NM</td></tr>` : ''}</table>`;
}
// Tarif de location d'après le jour et l'heure de départ, lu dans le texte « Tarifs » du bateau.
function rentalPrice(t, tarifs) {
  const d = new Date(t || Date.now());
  const we = d.getDay() === 0 || d.getDay() === 6;
  const soir = d.getHours() * 60 + d.getMinutes() >= 16 * 60 + 30;
  for (const line of String(tarifs || '').split('\n')) {
    const isWe = /\bwe\b|week-?end|samedi|dimanche/i.test(line), isSoir = /soir|17\s*h/i.test(line);
    const m = line.match(/(\d+(?:[.,]\d{1,2})?)(?!.*\d)/);
    if (m && isWe === we && isSoir === soir) return String(Math.round(num(m[1])));
  }
  return null;
}
function guessOutingType(t) {
  const d = new Date(t || Date.now());
  if (d.getDay() === 0 || d.getDay() === 6) return 'Journée WE';
  return d.getHours() * 60 + d.getMinutes() >= 16 * 60 + 30 ? 'Dès 17h00' : 'Journée semaine';
}
// Remplit ce qui peut l'être. Une valeur corrigée à la main n'est plus jamais remplacée.
function autoFillLakeDay(k) {
  const d = dayData(k);
  d._auto = d._auto || {};
  let changed = false;
  const auto = (key, val) => {
    if (val == null || val === '') return;
    if ((d[key] == null || d[key] === '' || d[key] === d._auto[key]) && d[key] !== val) { d[key] = val; changed = true; }
    if (d[key] === val) d._auto[key] = val;
  };
  const o = outingTimes(k);
  auto('typeSortie', cruise.purpose || guessOutingType(o.t0));
  const role = (r) => (cruise.crew.find((m) => m.fonction === r) || {}).nom;
  auto('skipper', role('Skipper'));
  auto('coSkipper', role('Second'));
  auto('equipage', crewNames().filter((x) => x !== d.skipper && x !== d.coSkipper).join(', '));
  if (o.nm > 0.05) auto('nmJour', fr(o.nm));
  if (d.typeSortie === 'Location') auto('montant', rentalPrice(o.t0, cruise.info.tarifs));
  const prev = Object.keys(cruise.days).filter((x) => x < k).sort().reverse().find((x) => num(cruise.days[x].moteurSoir) != null);
  auto('moteurDebut', prev ? cruise.days[prev].moteurSoir : cruise.info.moteurInit);
  if (changed) saveCruise();
  return d;
}

function sheetData(k) {
  const i = cruise.info;
  const d = isLake() ? autoFillLakeDay(k) : cruise.days[k] || {};
  const o = outingTimes(k);
  const nav = navDur(k) || (o.t0 && o.t1 ? fmtDur(o.t1 - o.t0) : '');
  const done = k === dayKey(new Date()) ? checkDone() : new Set(d.checkDone || []);
  const eng = d.moteurDebut || d.moteurSoir ? `début ${d.moteurDebut || '…'} · fin ${d.moteurSoir || '…'}` : '';
  const sec = (title, rows) => ({ title, rows: rows.filter(([, v]) => v != null && v !== '') });
  return {
    title: `NavIn · ${i.boat || i.name || ''}`,
    sections: [
      sec('1 · Informations générales', [
        ['Date', fmtDate(keyToDate(k))], ['Type de sortie', d.typeSortie], ['Skipper', d.skipper], ['Second', d.coSkipper], ['Équipage', d.equipage],
        ['Départ · retour', o.t0 ? `${fmtTime(new Date(o.t0))} → ${o.t1 ? fmtTime(new Date(o.t1)) : '…'} (${fmtUtc(new Date(o.t0))} → ${o.t1 ? fmtUtc(new Date(o.t1)) : '…'})${nav ? ` (${nav})` : ''}` : ''],
        ['Milles parcourus', d.nmJour ? `${d.nmJour} NM` : ''], ['Heures moteur', eng],
        ...(() => { const lt = lakeTimes(k); return [['Temps au moteur', lt.motor ? fmtDur(lt.motor) : ''], ['Temps à la voile', lt.sail ? fmtDur(lt.sail) : ''],
          ['dont voile + moteur', lt.mixed ? fmtDur(lt.mixed) : ''],
          ['Baignade', lt.baths.map(([a, b]) => `${a ? fmtTime(new Date(a)) : '…'}–${b ? fmtTime(new Date(b)) : 'en cours'}`).join(', ')]]; })(),
        ['Relevés à l’arrivée', relevesSummary(Object.assign({}, d, { moteurDebut: '' }))],
        ['Niveau du diesel', d.diesel], ['Eau potable', d.eauPotable], ['Eaux noires', d.eauxNoires],
        ['Eaux noires vidées', cruise.entries.filter((e) => dayKey(new Date(e.t)) === k && hasEvt(e, BLACK_EVT)).map((e) => fmtTime(new Date(e.t))).join(', ')],
        ['Météo', wxSummary(d.wxNow)], ['Feux de tempête', d.fFeux], ['Documents', d.lienDossier],
        ['Franchise CHF 500', d.typeSortie === 'Location' ? `à charge du locataire${d.skipper ? ` (${d.skipper})` : ''}`
          : /^Oui/.test(d.respUnique || '') ? `skipper seul responsable${d.skipper ? ` : ${d.skipper}` : ''}` : d.typeSortie ? 'partagée entre les membres présents' : ''],
        ['Montant location', d.typeSortie === 'Location' && d.montant ? `CHF ${d.montant}` : ''],
      ]),
      ...(d.typeSortie === 'Location' && i.tarifs ? [sec('Tarifs de location', i.tarifs.split('\n').filter(Boolean).map((l) => { const m = l.split(/\s*:\s*/); return m.length > 1 ? [m[0], m.slice(1).join(' : ')] : ['', l]; }))] : []),
    ],
    obs: (() => { const o = curMode() === 'lacj' ? d : cruise;
      return [o.obsPrise ? `${constatTitle('dep')} : ${o.obsPrise}` : '', d.observations || [d.dysfonct, d.aFaire, d.debrief].filter(Boolean).join('\n'),
        o.obsFin ? `${constatTitle('quit')} : ${o.obsFin}` : ''].filter(Boolean).join('\n\n'); })(),
    checks: ckDefs().map(([l, , name]) => ({ name: l === 'quit' && curMode() === 'lacj' ? 'Avant de quitter le bateau' : name, items: checkItems(l).map((x) => ({ label: k === dayKey(new Date()) ? ckLabelVal(x) : x.label, ok: done.has(x.id) })) })).filter((c) => c.items.length).reverse(),
    sig: d.sigSkip, sigName: d.skipper,
    missing: !d.moteurSoir || !d.diesel || !d.sigSkip,
  };
}
// Ce que l'on choisit de communiquer (mémorisé pour les fois suivantes).
const SHEET_PARTS = [['info', 'ℹ️ Informations'], ['trace', '🗺 Trace'], ['journal', '📍 Extrait du journal'], ['journalFull', '📜 Journal complet'], ['obs', '📝 Observations'], ['photos', '📷 Photos'], ['checks', '✅ Check-lists'], ['tarifs', '💶 Tarifs']];
const sheetParts = () => Object.assign({ info: true, trace: true, journal: true, journalFull: false, obs: true, photos: true, checks: true, tarifs: true }, settings.sheetParts);
function pickSheet(sd, k) {
  const p = sheetParts();
  return Object.assign({}, sd, {
    sections: sd.sections.filter((x) => (x.title === 'Tarifs de location' ? p.tarifs : p.info)),
    showObs: p.obs, sig: p.obs ? sd.sig : null, checks: p.checks ? sd.checks : [], extract: p.journalFull ? journalFull(k) : p.journal ? journalExtract(k) : [], extractTitle: p.journalFull ? 'Journal complet' : 'Extrait du journal',
    photos: p.photos ? (curMode() === 'lacj' ? photosFor(null, k) : photosFor('dep').concat(photosFor('nav', k), photosFor('quit'))) : [],
    traceK: p.trace && hasTrace(k) ? k : null,
  });
}
const navDur = (k) => { const n = navForDay(k); return n.ms ? fmtDur(n.ms) : ''; };
const hasTrace = (k) => typeof mapData === 'function' && mapData(k).line.length > 1;
function sheetHtml(sd) {
  return `<div class="sheet" id="sheet">
    <h2>${esc(sd.title)}</h2>
    ${sd.sections.map((s) => `<h3>${esc(s.title)}</h3><table>${s.rows.map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`).join('')}
    ${sd.traceK ? `<h3>Trace du jour</h3><div class="sheet-trace" data-trace="${sd.traceK}"><span>Carte en préparation…</span></div>` : ''}
    ${(sd.extract || []).length ? `<h3>${esc(sd.extractTitle || 'Extrait du journal')}</h3><table class="sheet-log">${sd.extract.map((x) => `<tr><th>${esc(x.time)}</th><td><b>${esc(x.what)}</b>${x.more ? `<br><small>${esc(x.more)}</small>` : ''}</td></tr>`).join('')}</table>` : ''}
    ${sd.showObs !== false ? `<h3>2 · Observations, constatations, propositions</h3><p>${esc(sd.obs || '–')}</p>` : ''}
    ${(sd.photos || []).length ? `<h3>Photos</h3>${Object.entries(PHOTO_CTX).map(([c, l]) => { const ps = sd.photos.filter((x) => x.ctx === c); return ps.length ? `<p class="sig-line">${l}</p>${photoStrip(ps, false)}` : ''; }).join('')}` : ''}
    ${sd.sig ? `<p class="sig-line">Signature${sd.sigName ? ` · ${esc(sd.sigName)}` : ''}</p><img src="${sd.sig}" alt="Signature">` : ''}
    ${sd.checks.map((c, j) => `<h3>${j ? '' : '3 · '}${esc(c.name)}</h3><ul class="sheet-checks">${c.items.map((x) => `<li class="${x.ok ? 'ok' : ''}">${x.ok ? '☑' : '☐'} ${esc(x.label)}</li>`).join('')}</ul>`).join('')}
  </div>`;
}

VIEWS.sheet = function renderSheet(k) {
  k = k || currentDay || dayKey(new Date());
  const sd = pickSheet(sheetData(k), k);
  const p = sheetParts();
  const tr = hasTrace(k);
  const fmt = settings.sheetFmt || 'img';
  const main = $('#view');
  main.innerHTML = `
    <p class="help" style="margin-top:0">Choisissez ce que vous voulez communiquer :</p>
    <div class="chips sheet-parts">${SHEET_PARTS.map(([id, label]) => `<button class="btn ${p[id] && (id !== 'trace' || tr) ? 'on' : ''}" data-part="${id}" ${id === 'trace' && !tr ? 'disabled' : ''}>${label}${id === 'trace' && !tr ? ' <small>pas de trace</small>' : ''}</button>`).join('')}</div>
    ${sheetHtml(sd)}
    ${sd.missing ? '<p class="help">À compléter dans la fiche : heures moteur de fin, niveau du diesel, signature…</p>' : ''}
    <div class="row"><button class="btn" data-dayform="1">✎ Compléter la fiche</button></div>
    <h3 class="sub-h">Format</h3>
    <div class="row c3">${[['img', '📸 Image'], ['pdf', '🖨 PDF'], ['both', '📸 + 🖨 Les deux']].map(([f, l]) => `<button class="btn ${fmt === f ? 'on' : ''}" data-fmt="${f}">${l}</button>`).join('')}</div>
    <div class="row"><button class="btn big primary" id="shareImg">${fmt === 'pdf' ? '🖨 Imprimer ou enregistrer en PDF' : fmt === 'both' ? '📤 Envoyer l’image, puis le PDF' : '📤 Envoyer l’image (WhatsApp…)'}</button></div>
    <p class="help">Image : elle s’ouvre dans le menu de partage, choisissez WhatsApp puis le groupe. PDF : dans la fenêtre d’impression, « Enregistrer en PDF » ou partager. Une simple capture d’écran de la fiche marche aussi.</p>`;
  main.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.part) {
      const id = b.dataset.part, nv = Object.assign(sheetParts(), { [id]: !p[id] });
      if (nv[id] && id === 'journal') nv.journalFull = false;
      if (nv[id] && id === 'journalFull') nv.journal = false;
      settings.sheetParts = nv; saveSettings(); return VIEWS.sheet(k);
    }
    if (b.dataset.fmt) { settings.sheetFmt = b.dataset.fmt; saveSettings(); return VIEWS.sheet(k); }
    if (b.dataset.dayform) return go('day', k);
    if (b.dataset.pdf) return printBook(['day:' + k]);
    if (b.id === 'shareImg') {
      if (fmt === 'pdf') return printBook(['day:' + k]);
      b.disabled = true;
      try {
        const blob = await sheetPng(sd);
        const safe = (cruise.info.boat || 'sortie').replace(/[^\w-]+/g, '-');
        await deliver(blob, `fiche-${safe}-${k}.png`, 'image/png');
      } catch { toast('Image impossible : faites une capture d’écran'); }
      b.disabled = false;
      if (fmt === 'both') printBook(['day:' + k]);
    }
  };
  fillTraces(main);
  fillPhotos(main);
};
// Remplace les emplacements « Trace du jour » par l'image de la carte.
function fillTraces(root) {
  for (const el of $$('[data-trace]', root)) traceImage(el.dataset.trace).then((url) => { el.innerHTML = url ? `<img src="${url}" alt="Trace du jour">` : '<span>Trace indisponible</span>'; });
}

const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
// Dessine la fiche en PNG, noir sur blanc, lisible sur un téléphone.
async function sheetPng(sd) {
  const W = 1080, P = 56, LW = 330;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const sig = sd.sig ? await loadImg(sd.sig) : null;
  const traceUrl = sd.traceK ? await traceImage(sd.traceK) : null;
  const trace = traceUrl ? await loadImg(traceUrl) : null;
  const pics = [];
  for (const ph of sd.photos || []) { const url = await getPhoto(ph.id); if (url) pics.push({ ph, img: await loadImg(url) }); }
  const font = (px, w) => `${w} ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const wrap = (text, px, w, maxW) => {
    ctx.font = font(px, w);
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const layout = (draw) => {
    const put = (lines, px, w, x, y, color) => {
      if (draw) { ctx.font = font(px, w); ctx.fillStyle = color; lines.forEach((l, j) => ctx.fillText(l, x, y + px + j * px * 1.3)); }
      return lines.length * px * 1.3;
    };
    let y = 0;
    const head = wrap(sd.title, 46, 800, W - 2 * P);
    const hh = head.length * 46 * 1.3 + 2 * 36;
    if (draw) { ctx.fillStyle = '#ffd400'; ctx.fillRect(0, 0, W, hh); }
    put(head, 46, 800, P, 36, '#000');
    y = hh + 24;
    const h3 = (t) => { y += 18; y += put(wrap(t, 32, 800, W - 2 * P), 32, 800, P, y, '#0a2a5c') + 10; };
    for (const sec of sd.sections) {
      h3(sec.title);
      for (const [l, v] of sec.rows) {
        const a = put(wrap(l, 30, 500, LW - 20), 30, 500, P, y + 3, '#333');
        const b = put(wrap(v, 34, 700, W - 2 * P - LW), 34, 700, P + LW, y, '#000');
        y += Math.max(a, b) + 14;
        if (draw) { ctx.fillStyle = '#ccc'; ctx.fillRect(P, y - 7, W - 2 * P, 2); }
      }
    }
    if (trace) {
      h3('Trace du jour');
      const h = trace.height * ((W - 2 * P) / trace.width);
      if (draw) { ctx.drawImage(trace, P, y, W - 2 * P, h); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(P, y, W - 2 * P, h); }
      y += h + 10;
    }
    if ((sd.extract || []).length) {
      h3(sd.extractTitle || 'Extrait du journal');
      for (const x of sd.extract) {
        put([x.time], 32, 800, P, y, '#000');
        const a = put(wrap(x.what, 32, 800, W - 2 * P - 130), 32, 800, P + 130, y, '#000');
        y += a;
        if (x.more) y += put(wrap(x.more, 26, 500, W - 2 * P - 130), 26, 500, P + 130, y, '#333');
        y += 10;
      }
    }
    if (sd.showObs !== false) {
      h3('2 · Observations, constatations, propositions');
      y += put(wrap(sd.obs || '–', 30, 600, W - 2 * P), 30, 600, P, y, '#000') + 8;
    }
    if (pics.length) {
      h3(sd.photosTitle || 'Photos');
      const cw = (W - 2 * P - 20) / 2;
      for (let j = 0; j < pics.length; j += 2) {
        const row = pics.slice(j, j + 2);
        const box = row.map(({ img }) => { let w = cw, h = img.height * (cw / img.width); if (h > cw) { w *= cw / h; h = cw; } return [w, h]; });
        row.forEach(({ ph, img }, q) => {
          const x = P + q * (cw + 20);
          if (draw) { ctx.drawImage(img, x, y, box[q][0], box[q][1]); capOver(ctx, x, y, box[q][0], box[q][1], ph.cap || `${(PHOTO_CTX[ph.ctx] || '').replace('📷 ', '')} · ${fmtTime(new Date(ph.t))}`, 24); }
        });
        y += Math.max(...box.map((x) => x[1])) + 18;
      }
    }
    if (sig) {
      y += 18;
      y += put([`Signature${sd.sigName ? ' · ' + sd.sigName : ''}`], 32, 800, P, y, '#0a2a5c') + 8;
      const h = Math.min(220, sig.height * ((W - 2 * P) / sig.width));
      const w = sig.width * (h / sig.height);
      if (draw) ctx.drawImage(sig, P, y, w, h);
      y += h;
    }
    sd.checks.forEach((c, j) => {
      h3((j || sd.noNum ? '' : '3 · ') + c.name);
      for (const x of c.items) y += put(wrap(`${x.ok ? '☑' : '☐'} ${x.label}`, 30, x.ok ? 600 : 800, W - 2 * P), 30, x.ok ? 600 : 800, P, y, x.ok ? '#006b2d' : '#b00000') + 4;
    });
    return Math.ceil(y + P);
  };
  cv.width = W;
  cv.height = layout(false);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, cv.height);
  layout(true);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}

/* ---------- Règles du Léman : aide-mémoire hors ligne ----------
   Sources : ONI (RS 747.201.1, état 18.02.2020), Règlement de la navigation sur le Léman (RNL),
   dossier de presse de la préfecture de Haute-Savoie, SISL, OFDF (douane). */
const LEMAN_RULES = [
  ['🪪 Avant de partir', [
    'Permis : obligatoire au-delà de 15 m² de voilure (catégorie D) ou de 6 kW de moteur (catégorie A). Savannah (45 m², 13,3 kW) : permis D pour naviguer à la voile, permis A pour naviguer au moteur (ONI art. 78-79).',
    'Documents à bord, à présenter sur demande : permis de navigation du bateau et permis de conduire (ONI art. 8). Côté français, avoir aussi le RNL et les règlements de police (papier ou smartphone).',
    'Au maximum 8 personnes sur le Savannah (permis de navigation). Enfants de moins de 12 ans : 3 enfants comptent pour 2 adultes (ONI art. 7).',
    'Un gilet de sauvetage par personne à bord, d’au moins 75 N avec col. Pour les enfants de moins de 12 ans, un gilet adapté avec col (ONI art. 134).',
    'Voilier de plus de 15 m² : en plus, une bouée à lancer d’au moins 75 N avec une drisse flottante d’au moins 10 m (ONI art. 134 al. 5).',
    'Équipement minimum : ancre avec corde ou chaîne, cordages, seau, gaffe, pavillon de détresse, klaxon ou corne, et une rame ou une pagaie si le bateau peut être mû ou gouverné ainsi (ONI annexe 15).',
    'Alcool : interdiction de conduire dès 0,5 ‰ dans le sang (0,25 mg/l dans l’air expiré). À partir de 0,8 ‰, l’ivresse est qualifiée. Les stupéfiants sont aussi interdits (ONI art. 40a).',
    'Le conducteur est responsable du respect des règles. Équipiers et passagers suivent ses ordres (ONI art. 3-4).',
  ]],
  ['🌬 Météo et feux d’avis de tempête', [
    'Avis de fort vent (prudence) : feu orange à environ 40 éclats/min. Rafales de 25 à 33 nœuds (46 à 61 km/h) attendues, sans heure précise. Rejoindre un abri (ONI art. 40).',
    'Avis de tempête : feu orange à environ 90 éclats/min. Rafales de plus de 33 nœuds (61 km/h). Retour au port urgent (ONI art. 40).',
    'Il y a 23 feux autour du lac, commandés par MétéoSuisse. Les vagues peuvent atteindre 1,70 m (SISL).',
    'Bise (nord-est) : vent de beau temps, froid et sec. Une fois établie, elle souffle en rafales sans interruption.',
    'Joran (nord-ouest, depuis le Jura) : imprévisible, avec de fortes rafales dès le début. Il est souvent annoncé par de gros cumulus noirs sur le Jura et une baisse rapide de la température.',
    'Vaudaire (sud-est, Haut-Lac) : soudaine et violente, souvent liée aux orages en été.',
    'Vent (sud-ouest à ouest) : il annonce les dépressions.',
    'Bornan (surtout entre Rolle et Lutry) et môlan (Petit-Lac) : rafales soudaines qui descendent des montagnes, surtout par forte chaleur.',
    'L’eau peut descendre à 6 °C : le froid rend toute chute à l’eau dangereuse.',
  ]],
  ['⚓ Priorités et règles de route', [
    'Tout bateau s’écarte, dans l’ordre : des bateaux prioritaires (ballon vert le jour, feu vert la nuit, par exemple la CGN), puis des bateaux à marchandises, puis des pêcheurs professionnels signalés, puis des voiliers. Les bateaux à moteur s’écartent aussi des bateaux à rames (ONI art. 44).',
    'Les bateaux en service régulier, comme la CGN, sont toujours prioritaires. Dégager leur route et ne pas gêner leurs manœuvres aux débarcadères (ONI art. 42a, 44, 52).',
    'Entre voiliers : celui qui reçoit le vent de bâbord s’écarte. Si les deux ont le vent du même bord, celui qui est au vent s’écarte (ONI art. 47).',
    'Au moteur, le Savannah est un bateau à moteur. Si les routes se croisent, celui qui voit l’autre sur tribord s’écarte. Face à face, chacun passe bâbord contre bâbord. Le bateau qui rattrape l’autre s’écarte (ONI art. 45-46).',
    'Distances : au moins 50 m des pêcheurs professionnels signalés et des convois remorqués, et 200 m si on passe derrière un pêcheur. Au moins 50 m d’un pavillon de plongée « A » blanc et bleu (ONI art. 48-49).',
    'Un bateau qui balance un pavillon ou un feu rouge est incapable de manœuvrer : il faut l’éviter (ONI art. 51).',
    'Au port, le bateau qui sort est prioritaire sur celui qui entre (ONI art. 52).',
  ]],
  ['🏖 Près des rives', [
    'La zone riveraine intérieure va jusqu’à 150 m de la rive. La zone extérieure va de 150 à 300 m, mesurés depuis la rive, les roselières ou les constructions dans l’eau.',
    'Au moteur : 10 km/h au maximum à moins de 300 m de la rive. Dans les 150 m, on passe seulement pour accoster, partir ou stationner, et par le chemin le plus court (ONI art. 53, RNL).',
    'Il est interdit d’entrer dans les roseaux, les joncs et les nénuphars. Garder en général 25 m de distance (ONI art. 53).',
    'Les bouées jaunes délimitent des zones interdites à la navigation (baignade, réserves).',
    'La baignade est interdite à moins de 100 m de l’entrée d’un port ou d’un débarcadère de la CGN (ONI art. 77).',
  ]],
  ['🌙 Mouillage et nuit', [
    'Mouiller ou s’amarrer sans gêner la navigation, jamais dans la végétation aquatique (25 m) ni près des filets de pêche signalés (ONI art. 59).',
    'Hors des places autorisées, on ne laisse pas un bateau plus de 24 h sans personne à bord (ONI art. 59).',
    'Côté français : pas de nuit au mouillage, pas d’ancrage sur les herbiers, et les bouées sont réservées à leurs titulaires (préfecture de Haute-Savoie).',
    'De nuit, un bateau au mouillage hors d’une place autorisée porte un feu blanc visible de tous les côtés (ONI art. 26).',
    'De nuit, à la voile seule : feux de côté et feu de poupe, ou feu tricolore en tête de mât. Au moteur : feux d’un bateau motorisé, c’est-à-dire feu de mât blanc, feux de côté et feu de poupe (ONI art. 24-25).',
  ]],
  ['📣 Signaux sonores et détresse', [
    '1 son bref : je viens sur tribord. 2 sons brefs : je viens sur bâbord. 3 sons brefs : je bats en arrière. 4 sons brefs : je suis incapable de manœuvrer (RNL).',
    'Une série de sons très brefs signale un danger imminent d’abordage (RNL).',
    'Détresse : agiter un pavillon rouge en cercle, tirer des fusées rouges, émettre des sons prolongés répétés ou SOS (· · · – – – · · ·) en lumineux, ou lever et baisser lentement les bras tendus (ONI art. 58).',
  ]],
  ['🚑 Accident', [
    'Porter secours aux personnes en danger si cela ne met pas son propre bateau en danger (ONI art. 12).',
    'S’il y a des blessés, des morts ou des disparus, avertir la police sans délai : 117 en Suisse, 112 partout. Pour une ambulance, 144. Pour l’hélicoptère, Rega 1414.',
    'En cas de dégâts matériels, prévenir le lésé dès que possible et rester disponible pour le constat (ONI art. 12).',
    'Savannah : noter l’incident dans la fiche du jour. Pour la franchise de CHF 500, voir Bateau et croisière › Règlement.',
  ]],
  ['🇫🇷 Côté France et douane', [
    'La frontière passe au milieu du lac. Tous les passagers doivent avoir des papiers d’identité valables, même sans escale (OFDF).',
    'Retour en Suisse : les achats sous la franchise de CHF 150, ou déclarés avec l’app QuickZoll, passent sans formalité. Sinon, il faut s’arrêter dans un débarcadère douanier : Lausanne-Ouchy, Genève ou Hermance (OFDF).',
    'Renseignements douane : +41 58 467 15 15.',
    'Moule quagga : nettoyer et rincer la coque et le matériel avant d’aller sur un autre lac.',
  ]],
  ['🤝 Location', [
    'Un bateau qui demande un permis ne se loue qu’à une personne qui présente ce permis (ONI art. 158).',
    'Le loueur signale les endroits dangereux, les particularités locales et les règles importantes (ONI art. 159).',
  ]],
];
VIEWS.rules = function renderRules() {
  $('#view').innerHTML = `
    <h1>Règles du Léman</h1>
    <p class="help">Aide-mémoire disponible sans réseau. Les textes officiels font foi : l’ONI, le Règlement de la navigation sur le Léman (nouvelle version en vigueur depuis 2019) et les règlements locaux.</p>
    ${LEMAN_RULES.map(([t, items], i) => `<details class="section rules" ${i === 0 ? 'open' : ''}><summary>${esc(t)}</summary>
      <ul>${items.map((x) => `<li>${esc(x).replace(/\((ONI[^)]*|RNL[^)]*|OFDF|SISL|préfecture[^)]*)\)/g, '<small>($1)</small>')}</li>`).join('')}</ul></details>`).join('')}
    <p class="help">Sources : Ordonnance sur la navigation intérieure (RS 747.201.1, état au 18.02.2020) ; Règlement de la navigation sur le Léman ; préfecture de Haute-Savoie, dossier de presse « Lac Léman » ; SISL, « Le Léman » ; OFDF, « Entrée en Suisse en bateau ».</p>`;
};

/* ---------- Documents obligatoires à bord (Léman, côté français) ----------
   Source : port de Sciez, « Documents obligatoires à bord ». Les PDF officiels s'ouvrent en ligne ;
   une fois enregistrés dans l'appli (bouton « Garder dans l'appli »), ils s'ouvrent sans réseau. */
const LEMAN_DOCS = [
  { id: 'permis', title: 'Permis bateau (côtier ou eaux intérieures)', note: 'Les deux sont valables sur tout le Léman, côté suisse compris. Une copie est tolérée par la brigade nautique d’Évian.', perso: true },
  { id: 'titre', title: 'Titre de navigation du bateau (carte grise)', note: 'Une copie est tolérée par la brigade nautique d’Évian.', perso: true },
  { id: 'rpp', title: 'Règlement particulier de police du Léman (RPP)', note: 'Exemplaire à jour, papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/28037/168112/file/RPPconsolide_VOK-2019-06-17-bd.pdf' },
  { id: 'rgp', title: 'Règlement général de police des eaux intérieures (RGP)', note: 'Valable sur tous les plans d’eau intérieurs de France. Papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/23843/145334/file/recueil_rgpmi__2019_09.pdf' },
  { id: 'accord', title: 'Accord franco-suisse du 7 décembre 1976 et règlement de la navigation sur le Léman', note: 'Papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/31420/186874/file/00-RNL-2019-compile-et-accord.pdf' },
];
let docDb = null;
const docNoFetch = new Set();
function docStore(mode) {
  if (!docDb) docDb = new Promise((res, rej) => {
    const r = indexedDB.open('ldb-docs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('d');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return docDb.then((db) => db.transaction('d', mode).objectStore('d'));
}
const putDoc = (id, rec) => docStore('readwrite').then((s) => idbReq(s.put(rec, id)));
const getDoc = (id) => docStore('readonly').then((s) => idbReq(s.get(id))).catch(() => null);
const delDoc = (id) => docStore('readwrite').then((s) => idbReq(s.delete(id))).catch(() => null);
function openDocBlob(rec) {
  const url = URL.createObjectURL(rec.blob);
  const w = window.open(url, '_blank');
  if (!w) location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

VIEWS.docs = function renderDocs() {
  const main = $('#view');
  main.innerHTML = `
    <button class="btn" data-go="more">◀ Plus</button>
    <h1>Documents obligatoires à bord</h1>
    <p class="help">Exigés à bord de tout bateau autorisé à s’éloigner à plus de 300 m de la rive. Au-delà de 3,7 km de la rive, il faut en plus une carte de navigation du Léman (papier, ou électronique sur un GPS par exemple).</p>
    <a class="btn big link-btn" href="${LEMAN_ARCGIS}" target="_blank" rel="noopener">🌐 Carte interactive du Léman (ArcGIS)<small>en ligne</small></a>
    <div id="docList">${LEMAN_DOCS.map((d) => `<section class="field doc" data-doc="${d.id}"><h2>${esc(d.title)}</h2><p class="help">${esc(d.note)}</p>
      <div class="doc-state" data-st="${d.id}">…</div>
      <div class="row c2">
        <button class="btn primary" data-open="${d.id}" hidden>📄 Ouvrir</button>
        ${d.url ? `<a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">🌐 Ouvrir en ligne</a>` : ''}
        <button class="btn" data-keep="${d.id}">${d.perso ? '📷 + photo' : '⬇ Garder dans l’appli'}</button>
        <button class="btn" data-del="${d.id}" hidden>🗑 Retirer</button>
      </div></section>`).join('')}</div>
    <input type="file" id="docFile" accept="application/pdf,image/*" hidden>
    <p class="help">Source : port de plaisance de Sciez, « Documents obligatoires à bord ». Les documents gardés dans l’appli restent sur ce téléphone seulement.</p>`;
  const refresh = async () => {
    for (const d of LEMAN_DOCS) {
      const rec = await getDoc(d.id);
      const st = $(`[data-st="${d.id}"]`);
      if (!st) return;
      st.innerHTML = rec ? `✅ Dans l’appli, disponible sans réseau <small>(${esc(rec.name || '')}, ${fmtShortDate(new Date(rec.at))})</small>` : d.url ? 'Pas encore dans l’appli : ouvrir en ligne, ou le garder pour l’avoir sans réseau.' : 'Ajoutez une photo ou un PDF de votre document.';
      $(`[data-open="${d.id}"]`).hidden = !rec;
      $(`[data-del="${d.id}"]`).hidden = !rec;
    }
  };
  refresh();
  let target = null;
  $('#docFile').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !target) return;
    await putDoc(target, { name: f.name, type: f.type, blob: f, at: new Date().toISOString() });
    toast('Document gardé dans l’appli'); refresh();
  };
  main.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.open) { const rec = await getDoc(b.dataset.open); if (rec) openDocBlob(rec); return; }
    if (b.dataset.del) return armed(b, 'Confirmer ?', async () => { await delDoc(b.dataset.del); refresh(); });
    if (b.dataset.keep) {
      const d = LEMAN_DOCS.find((x) => x.id === b.dataset.keep);
      target = d.id;
      // Photo, PDF déjà enregistré, ou site qui refuse le téléchargement direct : choisir le fichier (geste direct, exigé par iOS).
      if (!d.url || docNoFetch.has(d.id) || !navigator.onLine) return $('#docFile').click();
      b.disabled = true; b.textContent = 'Téléchargement…';
      try {
        const r = await fetch(d.url, { mode: 'cors' });
        if (!r.ok) throw new Error(r.status);
        const blob = await r.blob();
        await putDoc(d.id, { name: d.url.split('/').pop(), type: 'application/pdf', blob, at: new Date().toISOString() });
        toast('PDF gardé dans l’appli');
        b.textContent = '⬇ Garder dans l’appli';
      } catch {
        docNoFetch.add(d.id);
        b.textContent = '📂 Choisir le PDF enregistré';
        toast('Téléchargement direct refusé par le site : ouvrez-le en ligne, enregistrez-le dans Fichiers, puis « Choisir le PDF enregistré »');
      }
      b.disabled = false;
      return refresh();
    }
  };
};

/* ---------- Image de la trace : fond OpenStreetMap si le réseau le permet, sinon trace seule ---------- */
const TILE = 256;
const projX = (lon, z) => ((lon + 180) / 360) * TILE * 2 ** z;
const projY = (lat, z) => { const r = rad(lat); return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };
const loadTile = (src) => new Promise((res) => {
  const im = new Image();
  im.crossOrigin = 'anonymous';
  const t = setTimeout(() => res(null), 6000);
  im.onload = () => { clearTimeout(t); res(im); };
  im.onerror = () => { clearTimeout(t); res(null); };
  im.src = src;
});
const traceCache = {};
async function traceImage(k) {
  const { line, ents, nm } = mapData(k);
  if (line.length < 2) return null;
  const key = `${k}:${line.length}:${ents.length}`;
  if (traceCache[key]) return traceCache[key];
  const W = 1000, H = 700, PAD = 70;
  const lats = line.map((p) => p.lat), lons = line.map((p) => p.lon);
  const [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  let z = 17;
  while (z > 3 && (projX(lo1, z) - projX(lo0, z) > W - 2 * PAD || projY(la0, z) - projY(la1, z) > H - 2 * PAD)) z--;
  const ox = (projX(lo0, z) + projX(lo1, z)) / 2 - W / 2, oy = (projY(la0, z) + projY(la1, z)) / 2 - H / 2;
  const P = (lat, lon) => [projX(lon, z) - ox, projY(lat, z) - oy];
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#cfe3f3'; ctx.fillRect(0, 0, W, H);
  // Fond de carte : chaque tuile qui ne se charge pas (hors réseau) est simplement laissée vide.
  let tiles = 0;
  if (navigator.onLine) {
    const jobs = [];
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + W) / TILE); tx++) {
      for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + H) / TILE); ty++) {
        jobs.push(loadTile(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`).then((im) => { if (im) { ctx.drawImage(im, tx * TILE - ox, ty * TILE - oy); tiles++; } }));
      }
    }
    await Promise.all(jobs);
  }
  const path = (w, color) => {
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const seg of segments(line)) { ctx.beginPath(); seg.forEach(([la, lo], i) => { const [x, y] = P(la, lo); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
  };
  path(11, '#fff'); path(6, '#d00000');
  const dot = (lat, lon, r, fill) => { const [x, y] = P(lat, lon); ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.stroke(); };
  for (const e of ents) dot(e.v.pos.lat, e.v.pos.lon, 9, entryColor(e));
  dot(line[0].lat, line[0].lon, 14, '#00a040');
  dot(line[line.length - 1].lat, line[line.length - 1].lon, 14, '#d00000');
  // Légende et attribution
  const nav = navDur(k) || fmtDur(line[line.length - 1].t - line[0].t);
  const txt = `${fr(nm)} NM · ${nav}`;
  ctx.font = '800 34px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(16, 16, tw + 32, 56);
  ctx.fillStyle = '#000'; ctx.fillText(txt, 32, 57);
  ctx.font = '600 20px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const leg = '● départ   ● arrivée';
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(16, H - 50, ctx.measureText(leg).width + 28, 36);
  ctx.fillStyle = '#00a040'; ctx.fillText('●', 30, H - 25); ctx.fillStyle = '#000'; ctx.fillText(' départ', 46, H - 25);
  const ax = 46 + ctx.measureText(' départ   ').width;
  ctx.fillStyle = '#d00000'; ctx.fillText('●', ax, H - 25); ctx.fillStyle = '#000'; ctx.fillText(' arrivée', ax + 16, H - 25);
  if (tiles) { ctx.font = '500 16px Arial, sans-serif'; const a = '© OpenStreetMap'; const aw = ctx.measureText(a).width; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(W - aw - 18, H - 26, aw + 14, 22); ctx.fillStyle = '#333'; ctx.fillText(a, W - aw - 11, H - 10); }
  let url = null;
  try { url = cv.toDataURL('image/png'); } catch { return null; }
  traceCache[key] = url;
  return url;
}

/* ---------- Équipage simplifié : carnet de membres gardé sur le téléphone ---------- */
let members = store.arr('ldb.members', (m) => { if (!m.id) m.id = 'm' + Math.random().toString(36).slice(2, 9); return m; });
const saveMembers = (keepStamp) => { if (keepStamp !== true) store.set('ldb.members.at', new Date().toISOString()); return store.set('ldb.members', members); };
const memberName = (m) => [m.prenom, m.nom].filter(Boolean).join(' ');
// v431 (Corban) : 6 fiches coéquipier·ère d'exemple, ENTIÈREMENT INVENTÉES (aucune donnée réelle dans le code),
// construites comme de vraies fiches et volontairement variées (♂ ♀ ⚲, passeport ou carte, 1 à 3 proches,
// pièce valide, bientôt expirée ou expirée). Ajoutées une fois ; supprimables comme les autres.
const EXAMPLE_MEMBERS = [
  { id: 'ex1', prenom: 'Camille', nom: 'Rochat', sexe: 'Femme', naissance: '15.06.1985', lieu: 'Lausanne', lieuType: 'Lieu d’origine', nationalite: 'Suisse',
    tel: '+41 79 000 00 11', email: 'camille.rochat@example.org', pieceType: 'Carte d’identité', piece: 'X0000001', expiration: '31.12.2030',
    permis: 'C-00001-1', vhf: '000001', emisPar: 'Cruising Club Suisse (CCS)', adresse: 'Rue de l’Exemple 1, CH-1000 Lausanne', sante: 'Sensibilité au mal de mer',
    procheNom: 'Dominique Rochat', procheTel: '+41 79 000 00 12' },
  { id: 'ex2', prenom: 'Thomas', nom: 'Keller', sexe: 'Homme', naissance: '02.03.1968', lieu: 'Zurich', lieuType: 'Lieu de naissance', nationalite: 'Suisse',
    tel: '+41 79 000 00 21', email: 'thomas.keller@example.org', pieceType: 'Passeport', piece: 'X0000002', expiration: '10.01.2027',
    permis: 'D-00002-2', vhf: '000002', emisPar: 'Office de la navigation, canton de Zurich', adresse: 'Musterstrasse 2, CH-8000 Zurich', sante: 'Diabète de type 2, insuline dans le sac bleu',
    procheNom: 'Anna Keller', procheTel: '+41 79 000 00 22', proche2Nom: 'Lukas Keller', proche2Tel: '+41 79 000 00 23' },
  { id: 'ex3', prenom: 'Sophie', nom: 'Martin', sexe: 'Femme', naissance: '21.09.1979', lieu: 'Annecy', lieuType: 'Lieu de naissance', nationalite: 'Française',
    tel: '+33 6 00 00 00 31', email: 'sophie.martin@example.org', pieceType: 'Passeport', piece: 'X0000003', expiration: '01.03.2025',
    permis: 'F-00003', emisPar: 'Affaires maritimes (France)', adresse: '3 rue de l’Exemple, F-74000 Annecy', sante: 'Allergie aux piqûres de guêpe (stylo d’adrénaline dans sa trousse)',
    procheNom: 'Paul Martin', procheTel: '+33 6 00 00 00 32' },
  { id: 'ex4', prenom: 'Luca', nom: 'Bernasconi', sexe: 'Homme', naissance: '08.11.1992', lieu: 'Lugano', lieuType: 'Lieu d’origine', nationalite: 'Suisse',
    tel: '+41 79 000 00 41', email: 'luca.bernasconi@example.org', pieceType: 'Carte d’identité', piece: 'X0000004', expiration: '30.06.2029',
    permis: 'C-00004-4', vhf: '000004', emisPar: 'Sezione della circolazione, cantone Ticino', adresse: 'Via Esempio 4, CH-6900 Lugano', sante: 'Aucune',
    procheNom: 'Giulia Bernasconi', procheTel: '+41 79 000 00 42', proche2Nom: 'Marco Bernasconi', proche2Tel: '+41 79 000 00 43', proche3Nom: 'Chiara Bernasconi', proche3Tel: '+41 79 000 00 44' },
  { id: 'ex5', prenom: 'Noa', nom: 'Dubois', sexe: 'Non genré', naissance: '30.04.2001', lieu: 'Genève', lieuType: 'Lieu de naissance', nationalite: 'Suisse',
    tel: '+41 79 000 00 51', email: 'noa.dubois@example.org', pieceType: 'Carte d’identité', piece: 'X0000005', expiration: '15.08.2031',
    adresse: 'Chemin de l’Exemple 5, CH-1200 Genève', sante: 'Asthme léger, inhalateur sur soi',
    procheNom: 'Claire Dubois', procheTel: '+41 79 000 00 52' },
  { id: 'ex6', prenom: 'Elena', nom: 'García', sexe: 'Femme', naissance: '12.12.1958', lieu: 'Valencia', lieuType: 'Lieu de naissance', nationalite: 'Espagnole',
    tel: '+34 600 000 061', email: 'elena.garcia@example.org', pieceType: 'Passeport', piece: 'X0000006', expiration: '20.05.2028',
    permis: 'PER-00006', vhf: '000006', emisPar: 'Marina Mercante (Espagne)', adresse: 'Calle Ejemplo 6, E-46001 Valencia', sante: 'Ne sait pas nager : gilet en permanence',
    procheNom: 'Javier García', procheTel: '+34 600 000 062', proche2Nom: 'Lucía García', proche2Tel: '+34 600 000 063' },
];
if (!store.get('ldb.exMembers', false)) { let n = 0; EXAMPLE_MEMBERS.forEach((x) => { if (!members.some((m) => m.id === x.id)) { members.push(Object.assign({}, x)); n++; } }); if (n) saveMembers(true); store.set('ldb.exMembers', true); }
// Une fois : proches séparés en nom et téléphone (v174).
if (!store.get('ldb.procheSplit', false)) { setTimeout(() => { try { members.forEach((m) => normMemberPhones(m)); saveMembers(true); store.set('ldb.procheSplit', true); } catch (e) {} }, 0); }
function mergeMembers(list, at) {
  const newer = (at || '') > store.get('ldb.members.at', '');
  for (const m of list) {
    if (!m || !m.id) continue;
    const i = members.findIndex((x) => x.id === m.id);
    if (typeof normMemberPhones === 'function') normMemberPhones(m);
    if (i < 0) members.push(m); else if (newer) members[i] = m;
  }
  if (newer) store.set('ldb.members.at', at);
  saveMembers(true);
}
// Rôles enregistrés comme fonctions de l'équipage (libellés de la fiche du Savannah sur le lac).
const LAKE_ROLES = [['Skipper', 'Skipper'], ['Second', 'Second'], ['Équipier', 'Équipier']]; // Corban, 2026-10-31 : plus de « Responsable » ni « Co-skipper »
const SEA_ROLES = [['Skipper', 'Skipper'], ['Second', 'Second'], ['Équipier', 'Équipier']];
// Rôle accordé selon la fiche : Second → Seconde, Équipier → Équipière pour une femme (Corban, v127).
const roleLabel = (f, sx) => { const l = (LAKE_ROLES.find((r) => r[0] === f) || [f, f])[1] || ''; return sx === 'Femme' ? ({ Second: 'Seconde', 'Équipier': 'Équipière' }[l] || l) : l; };
// Fiche personne, selon le modèle de liste d'équipage : seul le prénom est obligatoire (Corban, v125).
const MEMBER_FIELDS = CREW_FIELDS.filter((f) => !['fonction', 'nom'].includes(f.key));
// v396 (Corban) : libellés des fiches coéquipier·ère modifiables en mode ✎ (communs à toutes les fiches) :
// settings.memberAlias = { clé: libellé } pour renommer, settings.memberCustom = [{ id, label }] pour ajouter.
const memberFieldsX = () => { const al = settings.memberAlias || {}; return MEMBER_FIELDS.map((f) => (al[f.key] ? Object.assign({}, f, { label: al[f.key] }) : f)).concat((settings.memberCustom || []).map(customField)); };
const memberKeysX = () => MEMBER_KEYS.concat((settings.memberCustom || []).map((c) => 'x_' + c.id));
const MEMBER_KEYS = MEMBER_FIELDS.map((f) => f.key).concat(['pieceType', 'lieuType']); // v251 : lieuType était perdu à l'enregistrement // type de pièce d'identité (v175)
// Téléphones des fiches toujours au format international (Corban, 2026-10-31).
// 00… devient +… ; un numéro national (0…) prend l'indicatif suisse +41 par défaut.
const PHONE_GROUPS = { '41': [2, 3, 2, 2], '33': [1, 2, 2, 2, 2], '39': [3, 3, 4], '49': [3, 4, 4], '43': [3, 3, 4], '44': [4, 3, 3], '32': [3, 2, 2, 2], '352': [3, 3, 3], '385': [2, 3, 4] };
function intlPhone(raw) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = '+' + d.slice(2);
  else if (d.startsWith('0')) d = '+41' + d.slice(1);
  else if (!d.startsWith('+')) d = (d.length >= 11 ? '+' : '+41') + d;
  d = '+' + d.slice(1).replace(/\+/g, '');
  const num = d.slice(1);
  const cc = ['352', '385'].find((c) => num.startsWith(c)) || ['41', '33', '39', '49', '43', '44', '32'].find((c) => num.startsWith(c));
  if (!cc) { const n = /^[17]/.test(num) ? 1 : 2; return `+${num.slice(0, n)} ${num.slice(n).replace(/(\d{3})(?=\d{3,})/g, '$1 ')}`; }
  let rest = num.slice(cc.length).replace(/^0/, '');
  const parts = [];
  for (const g of PHONE_GROUPS[cc]) { if (!rest) break; parts.push(rest.slice(0, g)); rest = rest.slice(g); }
  if (rest) parts.push(rest);
  return `+${cc} ${parts.join(' ')}`;
}
// Dans un texte (proche à contacter), on reformate seulement la partie numéro.
const intlPhoneIn = (txt) => String(txt || '').replace(/(\+|00)?\d[\d .\/-]{6,}\d/g, (m) => intlPhone(m));
const PROCHES = [['procheNom', 'procheTel'], ['proche2Nom', 'proche2Tel'], ['proche3Nom', 'proche3Tel']];
// Ancien texte « Prénom Nom +41… » séparé en nom et téléphone (Corban, v174).
function splitProche(m) {
  if (!m || !m.proche || m.procheNom || m.procheTel) return false;
  const t = String(m.proche), ph = t.match(PHONE_RE);
  if (ph) { m.procheTel = ph[0].trim(); const n = t.replace(ph[0], '').replace(/[\s,;:.\-]+$/, '').replace(/^[\s,;:.\-]+/, '').trim(); if (n) m.procheNom = n; } else m.procheNom = t.trim();
  return true;
}
function normMemberPhones(m) {
  if (m.tel) m.tel = intlPhone(m.tel);
  splitProche(m);
  for (const [, t] of PROCHES) if (m[t]) m[t] = intlPhone(m[t]);
  // Texte résumé gardé pour la liste d'équipage et les anciennes versions.
  const sum = PROCHES.map(([n, t]) => [m[n], m[t]].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
  if (sum) m.proche = sum; else delete m.proche;
  return m;
}
// Une fois : les fiches déjà enregistrées passent au format international.
if (!store.get('ldb.membersIntl', false)) { members.forEach(normMemberPhones); saveMembers(true); store.set('ldb.membersIntl', true); }
let crewFiche = null; // id de la fiche ouverte, 'new' pour une nouvelle

// Copie dans la sortie : l'historique ne change pas si la fiche change ensuite.
function crewFromMember(m, fonction) {
  const c = { memberId: m.id, nom: memberName(m), fonction };
  for (const k of MEMBER_KEYS) if (m[k]) c[k] = m[k];
  return c;
}
function syncCrewFromMember(m) {
  const c = cruise && cruise.crew.find((x) => x.memberId === m.id);
  if (!c) return;
  const f = c.fonction;
  for (const k of Object.keys(c)) delete c[k];
  Object.assign(c, crewFromMember(m, f));
  saveCruise();
}
// Anciennes listes saisies à la main : chaque personne devient une fiche réutilisable.
function crewToFiches() {
  let changed = false;
  for (const c of cruise.crew) {
    if (c.memberId || !(c.nom || '').trim()) continue;
    const parts = c.nom.trim().split(/\s+/);
    const prenom = parts.shift(), nom = parts.join(' ');
    let m = members.find((x) => memberName(x).toLowerCase() === c.nom.trim().toLowerCase());
    if (!m) {
      m = { id: uid(), prenom, nom };
      for (const k of MEMBER_KEYS) if (c[k]) m[k] = c[k];
      normMemberPhones(m);
      members.push(m);
    }
    c.memberId = m.id; changed = true;
  }
  if (changed) { saveMembers(); saveCruise(); }
}

function renderLakeCrew() { return renderCrewPick(); }
function renderCrewPick() {
  if (crewFiche) return renderFiche(crewFiche);
  if (!cruise) return renderFicheList();
  crewToFiches();
  const main = $('#view');
  const lake = isLake();
  const roles = lake ? LAKE_ROLES : SEA_ROLES;
  const onBoard = (id) => cruise.crew.find((c) => c.memberId === id);
  const sorted = membersByNav();
  const extra = cruise.crew.filter((c) => !c.memberId);
  const filled = (m) => MEMBER_KEYS.filter((k) => m[k]).length;
  main.innerHTML = `
    <h1>Équipage · ${cruise.crew.length} à bord</h1>
    <p class="help">Équipage réel, modifiable à tout moment (absence de dernière minute, départ en cours de route) : touchez un nom pour le mettre à bord de cette ${lake ? 'sortie' : 'navigation'} ou l’en retirer ; une fois parti, c’est noté au journal. Les fiches restent enregistrées pour les prochaines fois, uniquement sur ce téléphone.</p>
    ${cruise.crew.length ? `<h2 class="sub-h">À bord</h2>${cruise.crew.map((c, i) => `
      <div class="crew-on">
        <div class="crew-on-name"><b>${i + 1}. ${esc(c.nom || '…')}</b>${c.tel ? `<a class="btn crew-tel" href="tel:${esc(telOf(c.tel))}">📞 ${esc(c.tel)}</a>` : ''}</div>
        <div class="row c3">${roles.map(([f, l]) => `<button class="btn ${c.fonction === f ? 'on' : ''}" data-role="${i}" data-f="${f}">${roleLabel(f, c.sexe)}</button>`).join('')}</div>
        <div class="row c2 crew-on-act">${c.memberId ? `<button class="btn" data-fiche="${c.memberId}">✎ Fiche</button>` : '<span></span>'}<button class="btn" data-up="${i}" ${i === 0 ? 'disabled' : ''}>▲ Monter</button></div>
      </div>`).join('')}` : ''}
    <h2 class="sub-h">Mettre à bord ou retirer</h2>
    ${sorted.length ? `<div class="row c2 crew-pick">${sorted.map((m) => `<button class="btn big ${onBoard(m.id) ? 'on' : ''}" data-m="${m.id}">${onBoard(m.id) ? '✔ ' : ''}${esc(memberName(m) || '…')}<small>${esc(m.tel || '')}${filled(m) > 1 ? ` · ${filled(m)} infos` : ''}</small></button>`).join('')}</div>` : '<p class="help">Aucune fiche pour l’instant.</p>'}
    ${extra.length ? `<p class="help">Aussi à bord (sans fiche) : ${esc(extra.map((c) => c.nom).join(', '))}</p>` : ''}
    <div class="row" style="margin-top:12px"><button class="btn big primary" id="mNew">＋ Nouveau coéquipier.ère</button></div>
    ${cruise.crew.length ? `<div class="row ck-pub-row"><button class="btn big ck-pub" id="crewPub">📤 Publier<small>liste d’équipage, image ou PDF</small></button></div>` : ''}`;
  main.oninput = null;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'crewSets') return go('crews'); // v308 : groupes accessibles depuis l'équipage réel
    if (b.dataset.m) {
      const m = members.find((x) => x.id === b.dataset.m);
      const i = cruise.crew.findIndex((c) => c.memberId === m.id);
      if (i >= 0) cruise.crew.splice(i, 1);
      else cruise.crew.push(crewFromMember(m, cruise.crew.some((c) => c.fonction === 'Skipper') ? 'Équipier' : 'Skipper'));
      saveCruise();
      // v228 (Corban) : équipage réel modifiable à tout moment ; une fois parti, chaque arrivée ou départ est noté au journal avec l'heure et la position.
      if ((typeof tracking !== 'undefined' && tracking) || (cruise.entries || []).length) {
        const who = memberName(m) || 'Coéquipier.ère', note = i >= 0 ? `${who} quitte le bord` : `${who} rejoint le bord`;
        lakeFix((pos) => { const v = { evt: [i >= 0 ? 'Débarquement' : 'Embarquement'], note: `${note} · ${cruise.crew.length} à bord` }; if (pos) v.pos = pos; addEntry({ id: uid(), t: new Date().toISOString(), v }); });
        toast(`${note} · noté au journal`);
      }
      return renderCrewPick();
    }
    if (b.dataset.role) {
      const c = cruise.crew[Number(b.dataset.role)];
      // Un seul skipper et un seul second : l'ancien redevient équipier.
      if (b.dataset.f !== 'Équipier') cruise.crew.forEach((x) => { if (x.fonction === b.dataset.f) x.fonction = 'Équipier'; });
      c.fonction = b.dataset.f;
      saveCruise();
      return renderCrewPick();
    }
    if (b.dataset.up) { const i = Number(b.dataset.up); [cruise.crew[i - 1], cruise.crew[i]] = [cruise.crew[i], cruise.crew[i - 1]]; saveCruise(); return renderCrewPick(); }
    if (b.dataset.fiche) { crewFiche = b.dataset.fiche; return renderCrewPick(); }
    if (b.id === 'mNew') { crewFiche = 'new'; return renderCrewPick(); }
    if (b.id === 'mList') return renderFicheList();
    if (b.id === 'crewPub') return crewPubOpen();
    if (b.dataset.ccol || b.dataset.ccolall) {
      let sel = crewListCols().map(([k]) => k);
      if (b.dataset.ccolall === '1') sel = CREW_LIST_COLS.map(([k]) => k);
      else if (b.dataset.ccolall === '0') sel = ['fonction', 'nom', 'tel'];
      else sel = sel.includes(b.dataset.ccol) ? sel.filter((k) => k !== b.dataset.ccol) : [...sel, b.dataset.ccol];
      settings.crewCols = sel; saveSettings();
      renderCrewPick();
      const d = $('.crew-cols'); if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); }
      return;
    }
  };
}

/* ---------- v396 (Corban) : mode ✎ des libellés des fiches coéquipier·ère (comme les bateaux et les check-lists) ---------- */
function renderMemberLabels(back) {
  const main = $('#view');
  const cust = settings.memberCustom = settings.memberCustom || [];
  const al = settings.memberAlias || {};
  main.innerHTML = `<h1>Fiches coéquipier·ère<button type="button" class="btn ck-editbtn on no-navact" id="mlBack" aria-label="Terminer">✔</button></h1>
    <p class="help">Mode ✎ : les libellés valent pour toutes les fiches. Touchez un libellé pour le renommer (vide = libellé d’origine). Vos libellés : ▲ ▼ pour l’ordre, 🗑 appui long pour supprimer. Tout est enregistré tout seul.</p>
    <section class="field lab-order">
      ${MEMBER_FIELDS.map((f) => `<div class="lab-row lab-std"><input class="text" data-mlab="${f.key}" value="${esc(al[f.key] || f.label)}" placeholder="${esc(f.label)}" aria-label="Libellé"></div>`).join('')}
      ${cust.map((c, i) => `<div class="lab-row lab-own" id="mlab_${c.id}"><input class="text" data-mclab="${c.id}" value="${esc(c.label)}" aria-label="Libellé"><button class="btn" data-mmv="${c.id}" data-dir="-1" ${i ? '' : 'disabled'} aria-label="Monter">▲</button><button class="btn" data-mmv="${c.id}" data-dir="1" ${i < cust.length - 1 ? '' : 'disabled'} aria-label="Descendre">▼</button><button class="btn danger" data-mdel="${c.id}" aria-label="Supprimer">🗑</button></div>`).join('')}
    </section>
    <section class="field"><h3>Nouveau libellé</h3>
      <input class="text" id="mlNew" type="text" placeholder="ex. Taille de gilet, Club…">
      <div class="row"><button class="btn big primary no-navact act-add" id="mlAdd">＋ Ajouter ce libellé</button></div>
    </section>`;
  main.oninput = (e) => {
    const t = e.target;
    if (t.dataset.mlab != null) { const k = t.dataset.mlab, f = MEMBER_FIELDS.find((x) => x.key === k), v = t.value.trim(); const a = settings.memberAlias = settings.memberAlias || {}; if (v && f && v !== f.label) a[k] = v; else delete a[k]; saveSettings(); return; }
    if (t.dataset.mclab != null && t.value.trim()) { const c = cust.find((x) => x.id === t.dataset.mclab); if (c) { c.label = t.value.trim(); saveSettings(); } }
  };
  main.onclick = (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const again = (fid) => { const y = window.scrollY; saveSettings(); renderMemberLabels(back); window.scrollTo(0, y); if (fid) { const r = $('#mlab_' + fid); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('lab-flash'); } } };
    if (t.id === 'mlBack') { buzz(); main.oninput = null; return back(); }
    if (t.id === 'mlAdd') { buzz(); const v = $('#mlNew').value.trim(); if (!v) { toast('Écrivez le nouveau libellé'); $('#mlNew').focus(); return; } const c = { id: uid(), label: v }; cust.push(c); toast('Libellé ajouté à toutes les fiches'); return again(c.id); }
    if (t.dataset.mmv) { buzz(); const i = cust.findIndex((x) => x.id === t.dataset.mmv), j = i + Number(t.dataset.dir); if (i < 0 || j < 0 || j >= cust.length) return; [cust[i], cust[j]] = [cust[j], cust[i]]; return again(t.dataset.mmv); }
    if (t.dataset.mdel) return holdDel(t, () => { const k = cust.findIndex((x) => x.id === t.dataset.mdel); if (k >= 0) cust.splice(k, 1); again(); }); // les valeurs déjà saisies restent dans les fiches (rien n'est effacé)
  };
}

/* ---------- v394 (Corban) : vignette ronde du visage ----------
   m.face = { id: photo, x, y: centre du visage (0–1 de la largeur / hauteur), z: agrandissement }.
   Centrage automatique si le téléphone sait détecter les visages (FaceDetector), sinon haut de la photo ; cadrage à la main
   en touchant la vignette (glisser pour déplacer, curseur ou pincer pour agrandir). */
const FACE_DEF = { x: 0.5, y: 0.36, z: 1.7 };
async function faceAuto(url) {
  try {
    if (!url || !('FaceDetector' in window)) return Object.assign({}, FACE_DEF);
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const fs = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 }).detect(im);
    if (!fs.length) return Object.assign({}, FACE_DEF);
    const f = fs.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0].boundingBox;
    const w = im.naturalWidth, h = im.naturalHeight;
    return { x: (f.x + f.width / 2) / w, y: (f.y + f.height / 2) / h, z: Math.max(1, Math.min(6, Math.min(w, h) / (Math.max(f.width, f.height) * 2))) };
  } catch (e) { return Object.assign({}, FACE_DEF); }
}
const faceClamp = (f, w, h) => { const c = Math.min(w, h) / f.z; f.x = Math.max(c / 2 / w, Math.min(1 - c / 2 / w, f.x)); f.y = Math.max(c / 2 / h, Math.min(1 - c / 2 / h, f.y)); return f; };
async function memberAvatar(m, size = 320) {
  const ph = m.photos || []; if (!ph.length) return null;
  const f = Object.assign({}, FACE_DEF, m.face && ph.some((p) => p.id === m.face.id) ? m.face : { id: ph[0].id });
  const url = await getPhoto(f.id || ph[0].id); if (!url) return null;
  const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = url; }); if (!im) return null;
  const w = im.naturalWidth, h = im.naturalHeight; faceClamp(f, w, h); const c = Math.min(w, h) / f.z;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  cv.getContext('2d').drawImage(im, f.x * w - c / 2, f.y * h - c / 2, c, c, 0, 0, size, size);
  return cv.toDataURL('image/jpeg', 0.85);
}
function faceFrame(data, saved) {
  const ph = data.photos || []; if (!ph.length) return;
  if (!data.face || !ph.some((p) => p.id === data.face.id)) data.face = Object.assign({ id: ph[0].id }, FACE_DEF);
  let load = () => {};
  const ov = pubModal('', `<p class="help">Glisser la photo pour centrer le visage ; curseur (ou pincer) pour l’agrandir. Enregistré tout seul.</p>
    <div class="face-frame"><img alt=""></div>
    <input type="range" class="face-z" min="1" max="6" step="0.05" value="${data.face.z}" aria-label="Agrandir">
    ${ph.length > 1 ? `<p class="help lx-sec-h">Photo de la vignette</p><div class="face-picks">${ph.map((p) => `<button type="button" data-fpick="${p.id}" class="${p.id === data.face.id ? 'on' : ''}"><img data-photo="${p.id}" alt=""></button>`).join('')}</div>` : ''}`,
  (b, o) => { if (b.dataset.fpick) { data.face = Object.assign({ id: b.dataset.fpick }, FACE_DEF); $$('.face-picks button', o).forEach((x) => x.classList.toggle('on', x === b)); load(true); } }, '🙂 Vignette du visage');
  ov.querySelector('.ck-ask-box').classList.remove('pub-box');
  fillPhotos(ov);
  const fr = $('.face-frame', ov), img = $('img', fr), zr = $('.face-z', ov);
  let w = 1, h = 1;
  const show = () => { const S = fr.clientWidth, f = faceClamp(data.face, w, h), c = Math.min(w, h) / f.z, k = S / c; img.style.width = w + 'px'; img.style.height = h + 'px'; img.style.transform = `translate(${-(f.x * w - c / 2) * k}px, ${-(f.y * h - c / 2) * k}px) scale(${k})`; };
  const save = () => saved();
  load = async (auto) => {
    const url = await getPhoto(data.face.id); if (!url) return;
    img.onload = async () => { w = img.naturalWidth; h = img.naturalHeight; if (auto) { Object.assign(data.face, await faceAuto(url)); zr.value = data.face.z; save(); } show(); };
    img.src = url;
  };
  load(false);
  zr.oninput = () => { data.face.z = Number(zr.value); show(); };
  zr.onchange = save;
  const pts = new Map(); let pinch0 = null;
  fr.onpointerdown = (e) => { try { fr.setPointerCapture(e.pointerId); } catch (x) {} pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: data.face.z }; } };
  fr.onpointermove = (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2 && pinch0) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...pts.values()]; data.face.z = Math.max(1, Math.min(6, pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d)); zr.value = data.face.z; return show(); }
    const S = fr.clientWidth, c = Math.min(w, h) / data.face.z, k = S / c;
    data.face.x -= (e.clientX - p.x) / (k * w); data.face.y -= (e.clientY - p.y) / (k * h);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); show();
  };
  fr.onpointerup = fr.onpointercancel = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; save(); };
}

// v394 (Corban) : la liste d'équipage de la sortie se publie par le bouton « 📤 Publier » (image ou PDF, infos à inclure).
function crewPubHtml() {
  const on = crewListCols().map(([k]) => k);
  return `<div class="row c2"><button type="button" class="btn big" data-cp="img">📸 Image<small>écran, WhatsApp…</small></button><button type="button" class="btn big" data-cp="pdf">🖨 PDF<small>A4, imprimante</small></button></div>
    <p class="help lx-sec-h lx-opt-h">Réglages de l’envoi</p>
    <p class="help lx-sec-h">Infos à inclure (${on.length} / ${CREW_LIST_COLS.length})</p>
    <div class="checks">${masterCheck(on.length, CREW_LIST_COLS.length, 'data-ccolall')}${CREW_LIST_COLS.map(([k, l]) => `<button type="button" class="btn check ${on.includes(k) ? 'on' : ''}" data-ccol="${k}" ${k === 'nom' ? 'disabled' : ''}><span class="box">${on.includes(k) ? '✔' : ''}</span>${esc(l)}</button>`).join('')}</div>`;
}
function crewPubOpen() {
  const ov = pubModal('Liste d’équipage', `<div class="cp-in">${crewPubHtml()}</div>`, (b, o) => {
    if (b.dataset.cp === 'img') return shareCrewList(b);
    if (b.dataset.cp === 'pdf') { o.remove(); return printCrewList(); }
    if (b.dataset.ccol || b.dataset.ccolall) {
      let sel = crewListCols().map(([k]) => k);
      if (b.dataset.ccolall) sel = sel.length === CREW_LIST_COLS.length ? ['fonction', 'nom', 'tel'] : CREW_LIST_COLS.map(([k]) => k);
      else sel = sel.includes(b.dataset.ccol) ? sel.filter((k) => k !== b.dataset.ccol) : [...sel, b.dataset.ccol];
      settings.crewCols = sel; saveSettings();
      $('.cp-in', o).innerHTML = crewPubHtml();
    }
  });
  return ov;
}

function renderFicheList() {
  const main = $('#view');
  const sorted = membersByNav();
  const toData = !cruise || (typeof ficheFromData !== 'undefined' && ficheFromData);
  main.innerHTML = `<button class="btn" id="flBack">◀ ${toData ? 'data' : 'Équipage'}</button>
    <h1>Les coéquipiers·ères</h1>
    <p class="help">Touchez une fiche pour la compléter ou la modifier. Glisser une fiche vers la gauche : la supprimer (avec confirmation).</p>
    <div class="checks">${sorted.map((m) => `<button class="btn" data-fiche="${m.id}">${esc(memberName(m) || '…')}<small>${esc([m.tel, m.email].filter(Boolean).join(' · '))}</small></button>`).join('') || '<p class="help">Aucune fiche.</p>'}</div>
    <div class="row" style="margin-top:12px"><button class="btn big primary" id="mNew">＋ Nouvelle fiche</button></div>`;
  main.oninput = null;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'flBack') return toData ? go('more') : renderCrewPick();
    if (b.id === 'mNew') { crewFiche = 'new'; crewFicheBack = 'list'; return renderCrewPick(); }
    if (b.id === 'blSend') return blankSend();
    if (b.id === 'blPdf') return blankPdf();
    if (b.id === 'blRead') return blankImport($('#blIn').value);
    if (b.dataset.fiche) { crewFiche = b.dataset.fiche; crewFicheBack = 'list'; return renderCrewPick(); }
  };
}
let crewFicheBack = null;
/* ---------- v251 (Corban) : fiche vide à faire remplir par WhatsApp, puis à recharger dans l'appli ----------
   La fiche part en simple message texte (« Intitulé : » à compléter) : rien à installer pour la personne,
   ça marche sur tous les téléphones. Elle renvoie le message complété ; on le copie et on le colle ici.
   Si une fiche existe déjà (même nom, téléphone, courriel ou pièce d'identité), on arbitre case par case. */
// v309 (Corban) : texte d'envoi revu selon son modèle (consignes, H ou F, carte d'identité OU passeport).
const BLANK_FIELDS = [
  ['prenom', 'Prénom'], ['nom', 'Nom'], ['sexe', 'Homme ou femme (remplis H ou F)'], ['naissance', 'Date de naissance (JJ.MM.AAAA)'], ['lieu', 'Lieu de naissance ou d’origine'],
  ['nationalite', 'Nationalité'], ['tel', 'Téléphone (avec indicatif, ex. +41)'], ['email', 'Courriel'],
  ['pieceCI', 'Carte d’identité'], ['piecePP', 'Passeport'],
  ['piece', 'N° de la pièce d’identité'], ['expiration', 'Date d’expiration de la pièce (JJ.MM.AAAA)'], ['permis', 'Permis bateau n°'], ['emisPar', 'Permis établi par'],
  ['vhf', 'Licence VHF n°'], ['adresse', 'Adresse postale'], ['sante', 'Santé, allergies à connaître'],
  ['procheNom', 'Proche à contacter, prénom et nom'], ['procheTel', 'Téléphone du proche'],
];
// Anciens libellés encore lus (fiches envoyées avant la v309).
const BLANK_OLD = [['sexe', 'Homme ou femme'], ['pieceType', 'Pièce d’identité (passeport ou carte d’identité)'], ['proche2Nom', '2ᵉᵐᵉ proche, prénom et nom'], ['proche2Tel', 'Téléphone du 2ᵉᵐᵉ proche']];
const BLANK_HEAD = 'NavIn · Fiche coéquipier·ère';
// v327 (Corban) : la fiche vide part dans la langue affichée (FR / EN / IT / ES) ; tous les libellés restent reconnus au retour.
const BLANK_I18N = {
  en: { head: 'NavIn · Crew member sheet', l1: 'Please fill in after each « : » and send this message back to me as it is, without changing any of my text.', l2: 'Leave blank anything you cannot fill in (for example VHF licence no.).', choice: '(Fill in either your identity card or your passport here, not both)', or: 'Or', pdfH: 'Crew member sheet', pdfSub: 'NavIn · to fill in and send back', pdfPiece: 'Identity card or passport (circle)',
    lab: { prenom: 'First name', nom: 'Last name', sexe: 'Man or woman (write M or W)', naissance: 'Date of birth (DD.MM.YYYY)', lieu: 'Place of birth or origin', nationalite: 'Nationality', tel: 'Phone (with country code, e.g. +41)', email: 'Email', pieceCI: 'Identity card', piecePP: 'Passport', piece: 'Identity document no.', expiration: 'Document expiry date (DD.MM.YYYY)', permis: 'Boat licence no.', emisPar: 'Licence issued by', vhf: 'VHF licence no.', adresse: 'Postal address', sante: 'Health, allergies to know about', procheNom: 'Emergency contact, first and last name', procheTel: 'Emergency contact phone' } },
  it: { head: 'NavIn · Scheda membro dell’equipaggio', l1: 'Per favore compila dopo ogni « : » e rimandami questo messaggio così com’è, senza modificare il mio testo.', l2: 'Lascia vuoto ciò che non puoi compilare (per esempio Licenza VHF n.).', choice: '(Compila qui la carta d’identità oppure il passaporto, non entrambi)', or: 'Oppure', pdfH: 'Scheda membro dell’equipaggio', pdfSub: 'NavIn · da compilare e rimandare', pdfPiece: 'Carta d’identità o passaporto (cerchiare)',
    lab: { prenom: 'Nome', nom: 'Cognome', sexe: 'Uomo o donna (scrivi U o D)', naissance: 'Data di nascita (GG.MM.AAAA)', lieu: 'Luogo di nascita o di origine', nationalite: 'Nazionalità', tel: 'Telefono (con prefisso, es. +41)', email: 'E-mail', pieceCI: 'Carta d’identità', piecePP: 'Passaporto', piece: 'N. del documento d’identità', expiration: 'Data di scadenza del documento (GG.MM.AAAA)', permis: 'Patente nautica n.', emisPar: 'Patente rilasciata da', vhf: 'Licenza VHF n.', adresse: 'Indirizzo postale', sante: 'Salute, allergie da conoscere', procheNom: 'Persona da contattare, nome e cognome', procheTel: 'Telefono della persona da contattare' } },
  es: { head: 'NavIn · Ficha de tripulante', l1: 'Por favor, rellena después de cada « : » y devuélveme este mensaje tal cual, sin cambiar nada de mi texto.', l2: 'Deja vacío lo que no puedas rellenar (por ejemplo Licencia VHF n.º).', choice: '(Rellena aquí el documento de identidad o el pasaporte, no los dos)', or: 'O', pdfH: 'Ficha de tripulante', pdfSub: 'NavIn · para rellenar y devolver', pdfPiece: 'Documento de identidad o pasaporte (rodear)',
    lab: { prenom: 'Nombre', nom: 'Apellido', sexe: 'Hombre o mujer (escribe H o M)', naissance: 'Fecha de nacimiento (DD.MM.AAAA)', lieu: 'Lugar de nacimiento o de origen', nationalite: 'Nacionalidad', tel: 'Teléfono (con prefijo, p. ej. +41)', email: 'Correo electrónico', pieceCI: 'Documento de identidad', piecePP: 'Pasaporte', piece: 'N.º del documento de identidad', expiration: 'Fecha de caducidad del documento (DD.MM.AAAA)', permis: 'Titulación náutica n.º', emisPar: 'Titulación expedida por', vhf: 'Licencia VHF n.º', adresse: 'Dirección postal', sante: 'Salud, alergias a tener en cuenta', procheNom: 'Contacto de emergencia, nombre y apellido', procheTel: 'Teléfono del contacto de emergencia' } },
};
const blankLang = () => (typeof window.ficheLangNow === 'function' && BLANK_I18N[window.ficheLangNow()]) ? window.ficheLangNow() : 'fr';
const blankLab = (k, lg = blankLang()) => (lg !== 'fr' && BLANK_I18N[lg].lab[k]) || BLANK_FIELDS.find(([x]) => x === k)[1];
const blankLine = (k) => blankLab(k) + ' : ';
const blankText = () => {
  const lg = blankLang(), L = BLANK_I18N[lg];
  return [
    L ? L.head : BLANK_HEAD, '',
    L ? L.l1 : 'Merci de compléter après chaque « : » puis de me renvoyer ce message tel quel sans rien modifier de mon texte.',
    L ? L.l2 : 'Ne remplis rien si tu n’es pas en mesure de le faire (exemple pour Licence VHF n°).', '',
    ...['prenom', 'nom', 'sexe', 'naissance', 'lieu', 'nationalite', 'tel', 'email'].map(blankLine),
    L ? L.choice : '(Ici tu remplis à choix soit ta carte d’identité soit ton passeport, mais pas les deux)',
    blankLine('pieceCI'), L ? L.or : 'Ou', blankLine('piecePP'),
    ...['piece', 'expiration', 'permis', 'emisPar', 'vhf', 'adresse', 'sante', 'procheNom', 'procheTel'].map(blankLine), '',
  ].join('\n');
};
const normLab = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ᵉᵐ]/g, 'e').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Lit un ou plusieurs messages collés : chaque « NavIn · Fiche » commence une nouvelle fiche.
function parseBlank(txt) {
  const labs = BLANK_FIELDS.concat(BLANK_OLD, ...Object.values(BLANK_I18N).map((L) => Object.entries(L.lab))).map(([k, l]) => [k, normLab(l)]).sort((a, z) => z[1].length - a[1].length);
  const heads = [BLANK_HEAD, ...Object.values(BLANK_I18N).map((L) => L.head)].map((h) => normLab(h).slice(0, 18));
  const skips = ['ou', 'ne remplis rien', 'ici tu remplis', ...Object.values(BLANK_I18N).flatMap((L) => [L.or, L.l2, L.choice].map((x) => normLab(x).slice(0, 14)))];
  const thanks = ['merci de compl', ...Object.values(BLANK_I18N).map((L) => normLab(L.l1).slice(0, 14))];
  const out = []; let cur = null, last = null;
  for (const raw of String(txt).replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/^[\s*_~>-]+|[\s*_~]+$/g, '');
    if (heads.some((h) => normLab(line).startsWith(h))) { cur = {}; const hi = heads.findIndex((h) => normLab(line).startsWith(h)); if (hi > 0) cur._lg = Object.keys(BLANK_I18N)[hi - 1]; out.push(cur); last = null; continue; }
    const i = line.indexOf(':');
    const hit = i > 0 && labs.find(([, nl]) => normLab(line.slice(0, i)) === nl);
    if (hit) { if (!cur) { cur = {}; out.push(cur); } const v = line.slice(i + 1).trim(); last = hit[0]; if (v) cur[last] = v; continue; }
    { const nl = normLab(line); if (skips.some((x) => (x.length < 7 ? nl === x : nl.startsWith(x)))) { last = null; continue; } } // consignes du modèle (toutes langues)
    if (cur && last && line.trim() && !thanks.some((x) => normLab(line).startsWith(x))) cur[last] = (cur[last] ? cur[last] + '\n' : '') + line.trim(); // suite d'une adresse sur plusieurs lignes
  }
  return out.map((m) => {
    if (m.sexe) { const s = normLab(m.sexe), es = m._lg === 'es'; m.sexe = (es && /^m(ujer)?$/.test(s)) ? 'Femme' : /^(f|w|d|femme|female|woman|women|donna|mujer)/.test(s) ? 'Femme' : /^(h|homme|m|u|male|man|uomo|hombre)/.test(s) ? 'Homme' : undefined; if (!m.sexe) delete m.sexe; }
    delete m._lg;
    // v309 : « Carte d’identité : » ou « Passeport : » rempli (croix, oui ou le numéro) donne le type de pièce.
    for (const [k, t] of [['pieceCI', 'Carte d’identité'], ['piecePP', 'Passeport']]) {
      if (m[k]) { if (!m.pieceType) m.pieceType = t; if (!m.piece && /\d/.test(m[k]) && m[k].replace(/\W/g, '').length > 4) m.piece = m[k].trim(); }
      delete m[k];
    }
    if (m.pieceType) { const s = normLab(m.pieceType); m.pieceType = /carte|id|identit|documento/.test(s) ? 'Carte d’identité' : /pass/.test(s) ? 'Passeport' : undefined; if (!m.pieceType) delete m.pieceType; }
    return normMemberPhones(m);
  }).filter((m) => m.prenom || m.nom);
}
const memberClones = (m) => {
  const n = (s) => normLab(s || ''), dig = (s) => String(s || '').replace(/\D/g, '');
  return members.filter((x) => (n(x.prenom) && n(x.prenom) === n(m.prenom) && n(x.nom) === n(m.nom))
    || (dig(m.tel).length > 6 && dig(x.tel) === dig(m.tel)) || (m.email && n(x.email) === n(m.email)) || (m.piece && n(x.piece) === n(m.piece)));
};
function blankBox() {
  return `<details class="section blank-box no-print"><summary>📨 Fiche vide à faire remplir</summary><div class="lx-in">
    <p class="help">Envoyez une fiche vide par WhatsApp : la personne complète le message et vous le renvoie. Copiez sa réponse puis collez-la ci-dessous.</p>
    <div class="row c2"><button type="button" class="btn big" id="blSend">💬 Envoyer la fiche vide<small>WhatsApp, Messages…</small></button><button type="button" class="btn big" id="blPdf">📄 Fiche vide PDF<small>à imprimer</small></button></div>
    <h3 class="sub-h">📥 Fiche reçue</h3>
    <textarea class="text" id="blIn" rows="6" placeholder="Collez ici le message complété (une ou plusieurs fiches)"></textarea>
    <div class="row"><button type="button" class="btn big primary" id="blRead">📥 Charger la fiche reçue</button></div></div></details>`;
}
async function blankSend() {
  const t = blankText();
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(t); toast('Fiche vide copiée · collez-la dans WhatsApp'); } catch (e) { toast('Copie impossible sur cet appareil'); }
}
function blankPdf() {
  const holder = document.createElement('div'); holder.className = 'print-only book lx-print';
  const lg = blankLang(), L = BLANK_I18N[lg];
  holder.innerHTML = `<section class="pg"><h1>${esc(L ? L.pdfH : 'Fiche coéquipier·ère')}</h1><p class="lx-date">${esc(L ? L.pdfSub : 'NavIn · à compléter et à renvoyer')}</p>
    <table class="dos-tbl blank-tbl">${BLANK_FIELDS.map(([k]) => [k, k === 'pieceCI' ? (L ? L.pdfPiece : 'Carte d’identité ou passeport (entourer)') : blankLab(k, lg)]).filter(([k]) => k !== 'piecePP').map(([, l]) => `<tr><th>${esc(l)}</th><td></td></tr>`).join('')}</table></section>`;
  document.body.appendChild(holder);
  const style = document.createElement('style'); style.textContent = '@media print { main { display:none } @page { size: A4 portrait; margin: 10mm } .blank-tbl td { height: 11mm; width: 60% } }';
  document.head.appendChild(style);
  const oldTitle = document.title; document.title = 'navin-fiche-coequipier-vide';
  const cleanup = () => { holder.remove(); style.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 150);
}
// Fiches reçues traitées une à une : sans double → créée ; avec double → arbitrage.
let blankQueue = [];
function blankImport(txt) {
  const list = parseBlank(txt);
  if (!list.length) return toast('Aucune fiche reconnue · collez le message complet, avec les « Intitulé : valeur »');
  blankQueue = list; blankNext();
}
function blankCreate(m) {
  const rec = Object.assign({ id: uid() }, m); members.push(rec); saveMembers(); return rec;
}
function blankNext() {
  let made = 0;
  while (blankQueue.length) {
    const m = blankQueue[0], cl = memberClones(m);
    if (cl.length) return renderBlankArb(m, cl);
    blankQueue.shift(); blankCreate(m); made++;
  }
  if (made) toast(`${made} fiche${made > 1 ? 's' : ''} ajoutée${made > 1 ? 's' : ''}`);
  crewFiche = null; renderFicheList();
}
function renderBlankArb(m, clones) {
  const main = $('#view');
  let target = clones[0];
  const labOf = (k) => (k === 'pieceType' ? 'Type de pièce' : k === 'lieuType' ? 'Type de lieu' : ((CREW_FIELDS.find((f) => f.key === k) || {}).label || (BLANK_FIELDS.find(([x]) => x === k) || [, k])[1]));
  const pick = {};
  const draw = () => {
    const keys = ['prenom', 'nom', ...MEMBER_KEYS].filter((k, i, a) => a.indexOf(k) === i && m[k] != null && m[k] !== '');
    const diff = keys.filter((k) => String(target[k] || '') !== String(m[k]));
    diff.forEach((k) => { if (pick[k] == null) pick[k] = target[k] ? 'old' : 'new'; });
    main.innerHTML = `<h1>Fiche reçue : ${esc(memberName(m))}</h1>
      <p class="help">Une fiche semblable existe déjà. Pour chaque case différente, touchez la valeur à garder, puis « Fusionner ». Ou créez une fiche à part.</p>
      ${clones.length > 1 ? `<div class="checks">${clones.map((c) => `<button class="btn no-navact check ${c === target ? 'on' : ''}" data-tg="${c.id}"><span class="box">${c === target ? '✔' : ''}</span>${esc(memberName(c))}<small>${esc([c.tel, c.email].filter(Boolean).join(' · '))}</small></button>`).join('')}</div>` : ''}
      ${diff.length ? diff.map((k) => `<section class="field arb"><h3 class="sub-h">${esc(labOf(k))}</h3><div class="row c2">
        <button class="btn no-navact arb-v ${pick[k] === 'old' ? 'on' : ''}" data-arb="${k}" data-side="old">${esc(target[k] || '(vide)')}<small>fiche actuelle</small></button>
        <button class="btn no-navact arb-v ${pick[k] === 'new' ? 'on' : ''}" data-arb="${k}" data-side="new">${esc(m[k])}<small>fiche reçue</small></button></div></section>`).join('') : '<p class="help">Rien de nouveau : la fiche reçue est identique à la fiche actuelle.</p>'}
      <div class="row"><button class="btn big primary no-navact" id="arbMerge">✔ Fusionner dans « ${esc(memberName(target))} »</button></div>
      <div class="row c2"><button class="btn" id="arbNew">＋ Créer une fiche à part</button><button class="btn" id="arbSkip">Ignorer cette fiche</button></div>`;
  };
  draw();
  main.oninput = null;
  main.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return; buzz();
    if (b.dataset.tg) { target = members.find((x) => x.id === b.dataset.tg) || target; Object.keys(pick).forEach((k) => delete pick[k]); return draw(); }
    if (b.dataset.arb) { pick[b.dataset.arb] = b.dataset.side; return draw(); }
    if (b.id === 'arbMerge') {
      const i = members.findIndex((x) => x.id === target.id);
      if (i >= 0) { const rec = Object.assign({}, members[i]); for (const k in pick) if (pick[k] === 'new') rec[k] = m[k]; for (const k in m) if (rec[k] == null || rec[k] === '') rec[k] = m[k]; members[i] = normMemberPhones(rec); saveMembers(); if (cruise) syncCrewFromMember(rec); }
      toast(`Fiche « ${memberName(target)} » mise à jour`);
    } else if (b.id === 'arbNew') { blankCreate(m); toast('Fiche à part créée'); }
    else if (b.id !== 'arbSkip') return;
    blankQueue.shift(); blankNext();
  };
}


function renderFiche(id) {
  const main = $('#view');
  const isNew = id === 'new';
  const m = isNew ? {} : members.find((x) => x.id === id);
  const back = () => { crewFiche = null; if (crewFicheBack === 'crews') { crewFicheBack = null; return VIEWS.crews(); } const l = crewFicheBack === 'list' || !cruise; crewFicheBack = null; return l ? renderFicheList() : renderCrewPick(); };
  if (!m) return back();
  const data = Object.assign({}, m);
  let recId = isNew ? null : m.id; // fiche créée dès que le prénom est saisi (enregistrement automatique, Corban v170)
  const onB = !isNew && !!cruise && cruise.crew.some((c) => c.memberId === id);
  main.innerHTML = `<button class="btn" id="fBack">◀ Retour</button>
    <div class="f-head"><h1>${isNew ? 'Nouvelle fiche' : esc(memberName(m))}</h1><button type="button" class="f-av no-navact" id="fAv" aria-label="Cadrer le visage" hidden></button><button type="button" class="btn ck-editbtn no-navact" id="fEdit" aria-label="Modifier les libellés">✎</button></div>
    <section class="field"><div class="cgrid"><div class="cf wide cf-pair cf-frame" data-frame="ident">
      <div class="cf"><label for="fPrenom">Prénom <span class="req">*</span></label><input class="text" id="fPrenom" type="text" autocomplete="off" value="${esc(m.prenom || '')}"></div>
      <div class="cf f-sexe" id="fSexe"></div>
      <div class="cf wide f-nom"><label for="fNom">Nom</label><input class="text" id="fNom" type="text" autocomplete="off" value="${esc(m.nom || '')}"></div>
    </div></div></section>
    <details class="section" ${isNew ? '' : 'open'}><summary>Informations complémentaires</summary><div id="fForm"></div></details>
    <div class="f-photos"><p class="help lx-sec-h">Photos</p><div id="fPhList"></div><div class="row"><button class="btn big no-navact" id="fPhAdd">📷 + photo<small>photothèque, fichier ou appareil photo</small></button></div></div>
    ${isNew && cruise ? '<div class="row"><button class="btn big primary" id="fBoard">＋ Mettre à bord</button></div>' : ''}
    <div class="row ck-pub-row" id="fImgRow" ${recId ? '' : 'hidden'}><button class="btn big ck-pub no-navact" id="fImg">📤 Publier<small>la fiche en image ou PDF, pour un dernier contrôle par la personne</small></button></div>
    ${recId && memberLocks(recId).length ? `<p class="help fiche-lock">🔒 ${esc(memberLockMsg(recId))}</p>` : `<div class="row" id="fDelRow" ${recId ? '' : 'hidden'}><button class="btn danger" id="fDel">Supprimer la fiche</button></div>`}`;
  // Enregistrement automatique à chaque saisie, comme les autres fiches.
  const persist = () => {
    const prenom = $('#fPrenom').value.trim(), nom = $('#fNom').value.trim();
    if (!prenom) return null; // seul le prénom est obligatoire (Corban, v125)
    const rec = { id: recId || uid(), prenom, nom };
    for (const k of memberKeysX()) if (data[k]) rec[k] = data[k];
    if ((data.photos || []).length) rec.photos = data.photos; // v393 (Corban) : photos de la fiche
    if (data.face && (data.photos || []).some((p) => p.id === data.face.id)) rec.face = data.face; // v394 : cadrage du visage (vignette ronde)
    normMemberPhones(rec);
    const i = members.findIndex((x) => x.id === rec.id);
    if (i < 0) { members.push(rec); recId = rec.id; const r = $('#fDelRow'); if (r) r.hidden = false; const ir = $('#fImgRow'); if (ir) ir.hidden = false; } else members[i] = rec;
    saveMembers();
    if (cruise && !isNew) syncCrewFromMember(rec);
    const h = $('h1', main); if (h) { const hi = h.querySelector('.help-i'); h.textContent = memberName(rec); if (hi) h.appendChild(hi); }
    return rec;
  };
  // v241 (Corban) : prénom, nom et pastille coéquipier / coéquipière dans le même cadre, en haut.
  compactForm($('#fSexe'), [{ fields: memberFieldsX().filter((f) => f.key === 'sexe') }], data, () => persist(), true);
  compactForm($('#fForm'), [{ fields: memberFieldsX().filter((f) => f.key !== 'sexe') }], data, () => persist(), true);
  // 2e et 3e proche : cachés tant qu'ils sont vides, « ＋ Ajouter un proche » les fait apparaître (Corban, v174).
  { const cfOf = (k) => { const el = $(`#fForm [data-k="${k}"]`); return el && (el.closest('.cf-frame') || el.closest('.cf')); }; // v239 : le cadre commun du proche
    let shown = 1; PROCHES.forEach(([n, t], i) => { if (data[n] || data[t]) shown = Math.max(shown, i + 1); });
    const addRow = document.createElement('div'); addRow.className = 'cf wide';
    addRow.innerHTML = '<button type="button" class="btn primary no-navact" id="fAddProche">＋ Ajouter un proche</button>';
    const layout = () => {
      PROCHES.forEach(([n, t], i) => [n, t].forEach((k) => { const c = cfOf(k); if (c) c.style.display = i < shown ? '' : 'none'; }));
      const last = cfOf(PROCHES[shown - 1][1]); if (last) last.after(addRow);
      addRow.style.display = shown >= PROCHES.length ? 'none' : '';
    };
    layout();
    addRow.onclick = (e) => { e.preventDefault(); buzz(); shown = Math.min(PROCHES.length, shown + 1); layout(); const f = $(`#fForm [data-k="${PROCHES[shown - 1][0]}"]`); if (f) f.focus(); };
    // v231 (Corban) : un 2e ou 3e proche vidé (nom et téléphone) disparaît ; le suivant remonte à sa place.
    $('#fForm').addEventListener('focusout', () => setTimeout(() => {
      const a = document.activeElement, ak = a && a.dataset && a.dataset.k;
      if (ak && PROCHES.slice(1).some(([n, t]) => ak === n || ak === t)) return;
      const val = (k) => String(data[k] || '').trim();
      const kept = PROCHES.slice(1).map(([n, t]) => [val(n), val(t)]).filter(([x, y]) => x || y);
      const before = shown, prev = JSON.stringify(PROCHES.slice(1).map(([n, t]) => [val(n), val(t)]));
      PROCHES.slice(1).forEach(([n, t], i) => { const [x, y] = kept[i] || ['', '']; [[n, x], [t, y]].forEach(([k, v]) => { if (v) data[k] = v; else delete data[k]; const el = $(`#fForm [data-k="${k}"]`); if (el && el.value !== v) el.value = v; }); });
      shown = 1 + kept.length;
      if (shown < before || JSON.stringify(PROCHES.slice(1).map(([n, t]) => [val(n), val(t)])) !== prev) { layout(); persist(); }
    }, 0));
  }
  // À la sortie du champ, le numéro est remis au format international.
  $('#fForm').addEventListener('focusout', (e) => {
    const t = e.target, f = MEMBER_FIELDS.find((x) => x.key === t.dataset.k);
    if (!f || !f.phone || !t.value.trim()) return;
    t.value = f.phone === 'text' ? intlPhoneIn(t.value) : intlPhone(t.value);
    data[f.key] = t.value; persist();
  });
  main.oninput = (e) => { if (e.target.id === 'fPrenom' || e.target.id === 'fNom') persist(); };
  // v393 (Corban) : photos de la fiche (pièce d'identité, portrait…), comme dans les check-lists.
  const phList = () => {
    const el = $('#fPhList'); if (!el) return;
    const l = data.photos || [];
    el.innerHTML = l.length ? `<div class="photo-strip">${l.map((p) => `<figure class="photo"><img data-photo="${p.id}" alt="Photo"><figcaption>${esc(p.cap || fmtTime(new Date(p.t)))}</figcaption><button class="btn danger photo-del" data-mpdel="${p.id}" aria-label="Supprimer la photo">✕</button></figure>`).join('')}</div>` : '';
    fillPhotos(el);
    const av = $('#fAv');
    if (av) { av.hidden = !l.length; if (l.length) memberAvatar(Object.assign({}, data), 200).then((u) => { if (u) av.innerHTML = `<img src="${u}" alt="">`; }); }
  };
  phList();
  const phAdd = () => {
    if (!persist()) { toast('Saisissez d’abord le prénom'); $('#fPrenom').focus(); return; }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async () => {
      let n = 0;
      for (const f of [...inp.files]) {
        try { const pid = uid(); await putPhoto(pid, await shrinkPhoto(f)); (data.photos = data.photos || []).push({ id: pid, t: new Date().toISOString() }); n++; } catch { toast('Photo impossible à enregistrer'); }
      }
      if (!n) return;
      if (!data.face) { const fp = data.photos[0]; data.face = Object.assign({ id: fp.id }, await faceAuto(await getPhoto(fp.id))); }
      persist(); phList();
      toast(n > 1 ? `📷 ${n} photos ajoutées` : '📷 Photo ajoutée');
    };
    inp.click();
  };
  const leave = () => {
    const prenom = $('#fPrenom').value.trim();
    if (!prenom && (isNew ? Object.keys(data).length || $('#fNom').value.trim() : true)) toast(isNew ? 'Sans prénom, la fiche n’est pas gardée' : 'Le prénom ne peut pas être vide : l’ancien est gardé');
    else if (recId) { const rec = members.find((x) => x.id === recId); if (rec) toast(`Fiche de ${memberName(rec)} enregistrée`); }
    back();
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.mpdel) { buzz(); const pid = b.dataset.mpdel; return holdDel(b, () => { data.photos = (data.photos || []).filter((p) => p.id !== pid); if (!data.photos.length) delete data.photos; if (data.face && data.face.id === pid) { delete data.face; const r0 = members.find((x) => x.id === recId); if (r0) delete r0.face; } const r = members.find((x) => x.id === recId); if (r && !data.photos) delete r.photos; delPhoto(pid); persist(); phList(); toast('Photo supprimée'); }, '🗑'); }
    if (!b || !b.id) return;
    if (b.id === 'fBack') { buzz(); return leave(); }
    if (b.id === 'fPhAdd') { buzz(); return phAdd(); }
    if (b.id === 'fAv') { buzz(); return faceFrame(data, () => { persist(); phList(); }); }
    if (b.id === 'fEdit') { buzz(); persist(); const back0 = crewFicheBack; return renderMemberLabels(() => { crewFicheBack = back0; renderFiche(recId || 'new'); }); }
    if (b.id === 'fBoard') {
      buzz(); const rec = persist();
      if (!rec) { toast('Le prénom est obligatoire'); $('#fPrenom').focus(); return; }
      if (!cruise.crew.some((c) => c.memberId === rec.id)) cruise.crew.push(crewFromMember(rec, cruise.crew.some((c) => c.fonction === 'Skipper') ? 'Équipier' : 'Skipper'));
      saveCruise(); toast(`${memberName(rec)} enregistré et à bord`); return back();
    }
    if (b.id === 'fImg') { buzz(); persist(); return window.lxOpen && window.lxOpen('people', recId); }
    if (b.id === 'fDel') { const lm = memberLockMsg(recId); if (lm) { buzz(); return toast(lm); } buzz(); holdDel(b, () => { const gone = members.find((x) => x.id === recId); (gone && gone.photos || []).forEach((p) => delPhoto(p.id)); members = members.filter((x) => x.id !== recId); saveMembers(); toast('Fiche supprimée'); back(); }); }
  };
}

/* ---------- Rubriques d'un bateau ---------- */
let fieldsBack = null; // retour du bouton « Terminé » (fiche du recueil ou Mes bateaux)
function renderBoatFields(id, back) {
  const b = boatById(id);
  if (back) fieldsBack = back;
  b.custom = b.custom || [];
  b.hidden = []; // v217 : plus de rubriques masquées, la fiche montre tout
  // Liste à plat de la fiche : titres de section et libellés, dans l'ordre affiché.
  const flat = () => boatSections(b).flatMap((sec) => [{ sec: sec.title }, ...sec.fields.filter((f) => f.label).map((f) => ({ key: f.key, label: f.label, cid: f.key.startsWith('x_') ? f.key.slice(2) : null }))]);
  const reanchor = (L) => { L.forEach((e, i) => { if (!e.cid) return; const c = b.custom.find((x) => x.id === e.cid); const p = L[i - 1]; if (c && p) c.after = p.sec ? '§' + p.sec : p.key; }); };
  const main = $('#view');
  const L = flat();
  const std = (k) => { for (const sec of BOAT_SECTIONS) { const f = sec.fields.find((x) => x.key === k); if (f) return f.label; } return ''; };
  // v396 (Corban) : mode ✎ comme les check-lists : renommer, ▲ ▼ pour l'ordre, 🗑 appui long pour supprimer, ＋ en bas pour ajouter.
  main.innerHTML = `
    <h1>${esc(b.info.boat || 'Bateau')}<button type="button" class="btn ck-editbtn on" id="cBack" aria-label="Terminer">✔</button></h1>
    <p class="help">Mode ✎ : touchez un libellé pour le renommer (vide = libellé d’origine). Vos libellés : ▲ ▼ pour l’ordre, 🗑 appui long pour supprimer. Tout est enregistré tout seul.</p>
    <section class="field lab-order">
      ${L.map((e, i) => e.sec ? `<h3 class="sub-h">${esc(e.sec)}</h3>` : e.cid ? `<div class="lab-row lab-own" id="lab_${e.cid}"><input class="text" data-clab="${e.cid}" value="${esc(e.label)}" aria-label="Libellé">
        <button class="btn" data-cmv="${e.cid}" data-dir="-1" ${i <= 1 ? 'disabled' : ''} aria-label="Monter">▲</button><button class="btn" data-cmv="${e.cid}" data-dir="1" ${i >= L.length - 1 ? 'disabled' : ''} aria-label="Descendre">▼</button><button class="btn danger" data-cdel="${e.cid}" aria-label="Supprimer">🗑</button></div>`
        : `<div class="lab-row lab-std"><input class="text" data-slab="${e.key}" value="${esc(e.label)}" placeholder="${esc(std(e.key))}" aria-label="Libellé"></div>`).join('')}
    </section>
    <section class="field"><h3>Nouveau libellé</h3>
      <input class="text" id="cNew" type="text" placeholder="ex. Code du cadenas, Place au port…">
      <div class="row"><button class="btn big primary no-navact act-add" id="cAdd">＋ Ajouter ce libellé</button></div>
    </section>`;
  main.oninput = (e) => {
    const t = e.target;
    if (t.dataset.slab != null) { const k = t.dataset.slab, v = t.value.trim(); b.alias = b.alias || {}; if (v && v !== std(k)) b.alias[k] = v; else delete b.alias[k]; if (!Object.keys(b.alias).length) delete b.alias; saveBoats(); return; }
    if (t.dataset.clab == null || !t.value.trim()) return;
    const c = b.custom.find((x) => x.id === t.dataset.clab); if (c) { c.label = t.value.trim(); saveBoats(); }
  };
  main.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const again = (focusId) => { const y = window.scrollY; saveBoats(); syncCruiseFromBoat(b); renderBoatFields(id); window.scrollTo(0, y); if (focusId) { const r = $('#lab_' + focusId); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('lab-flash'); } } };
    if (t.id === 'cBack') { buzz(); main.oninput = null; const f = fieldsBack; fieldsBack = null; return f ? f() : VIEWS.boats(id); }
    if (t.id === 'cAdd') {
      buzz();
      const v = $('#cNew').value.trim();
      if (!v) { toast('Écrivez le nouveau libellé'); $('#cNew').focus(); return; }
      const L0 = flat(), ii = L0.map((x) => x.sec).lastIndexOf('Informations');
      let last = L0[L0.length - 1];
      if (ii >= 0) { let k = ii; while (k + 1 < L0.length && !L0[k + 1].sec) k++; last = L0[k]; }
      const c = { id: uid(), label: v, after: last.sec ? '§' + last.sec : last.key };
      b.custom.push(c);
      toast('Libellé ajouté : placez-le avec ▲ ▼');
      return again(c.id);
    }
    if (t.dataset.cmv) {
      buzz();
      const L0 = flat(), i = L0.findIndex((x) => x.cid === t.dataset.cmv), d = Number(t.dataset.dir), j = i + d;
      if (i < 0 || j < 1 || j >= L0.length) return;
      const [it] = L0.splice(i, 1); L0.splice(j, 0, it);
      reanchor(L0);
      return again(t.dataset.cmv);
    }
    if (t.dataset.cdel) return holdDel(t, () => { const k = b.custom.findIndex((x) => x.id === t.dataset.cdel); if (k < 0) return; const L0 = flat().filter((x) => x.cid !== t.dataset.cdel); reanchor(L0); const c = b.custom.splice(k, 1)[0]; delete b.info['x_' + c.id]; again(); });
  };
}

/* ---------- Cumul des milles et des heures sur le lac (toutes les sorties lacustres) ---------- */
// Une ligne par jour de sortie : milles de la fiche (sinon de la trace GPS) et durée de navigation.
function lakeDays() {
  const saved = cruise;
  const out = [];
  try {
    for (const m of index.filter((x) => x.type === 'lac')) {
      const c = store.get('ldb.cruise.' + m.id, null);
      if (!c) continue;
      cruise = c;
      for (const k of daysWithData()) {
        const o = outingTimes(k);
        const nm = num((c.days[k] || {}).nmJour) ?? (o.nm > 0.05 ? o.nm : 0);
        const ms = navForDay(k).ms || (o.t0 && o.t1 ? o.t1 - o.t0 : 0);
        if (nm || ms) out.push({ k, boatId: c.boatId, nm, ms });
      }
    }
  } finally { cruise = saved; }
  return out;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return [t.getUTCFullYear(), Math.ceil(((t - y0) / 86400000 + 1) / 7)];
}
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function periodOf(k, p) {
  const d = keyToDate(k);
  if (p === 'annee') return [String(d.getFullYear()), String(d.getFullYear())];
  if (p === 'mois') return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}`, `${MONTHS[d.getMonth()]} ${d.getFullYear()}`];
  const [y, w] = isoWeek(d);
  return [`${y}-${pad(w)}`, `Semaine ${w} · ${y}`];
}
const fmtHours = (ms) => fmtDur(ms);

VIEWS.stats = function renderStats() {
  const p = settings.statsPeriod || 'mois';
  const sel = new Set(settings.statsBoats || []); // vide = tous les bateaux
  const all = lakeDays();
  const ids = [...new Set(all.map((x) => x.boatId).concat(boats.map((b) => b.id)))];
  const name = (id) => (boatById(id) || { info: {} }).info.boat || 'Bateau supprimé';
  const rows = all.filter((x) => !sel.size || sel.has(x.boatId));
  const groups = new Map();
  for (const r of rows) {
    const [key, label] = periodOf(r.k, p);
    const g = groups.get(key) || { label, n: 0, nm: 0, ms: 0 };
    g.n++; g.nm += r.nm; g.ms += r.ms;
    groups.set(key, g);
  }
  const tot = rows.reduce((a, r) => ({ n: a.n + 1, nm: a.nm + r.nm, ms: a.ms + r.ms }), { n: 0, nm: 0, ms: 0 });
  const list = [...groups.entries()].sort((a, z) => z[0].localeCompare(a[0]));
  const max = Math.max(1, ...list.map(([, g]) => g.nm));
  const main = $('#view');
  main.innerHTML = `
    <h1>Cumul sur le lac</h1>
    <p class="help">Toutes les sorties lacustres de ce téléphone. Milles de la fiche du jour, sinon de la trace GPS. Heures de navigation entre départ et arrivée.</p>
    <h2 class="sub-h">Bateaux</h2>
    <div class="chips stats-boats"><button class="btn ${sel.size ? '' : 'on'}" data-sb="">Tous</button>${ids.map((id) => `<button class="btn ${sel.has(id) ? 'on' : ''}" data-sb="${id}">${esc(name(id))}</button>`).join('')}</div>
    <h2 class="sub-h">Période</h2>
    <div class="row c3">${[['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']].map(([v, l]) => `<button class="btn ${p === v ? 'on' : ''}" data-sp="${v}">${l}</button>`).join('')}</div>
    <div class="stats-total"><div><b>${fr(tot.nm)}</b><small>NM</small></div><div><b>${fmtHours(tot.ms)}</b><small>navigation</small></div><div><b>${tot.n}</b><small>sortie${tot.n > 1 ? 's' : ''}</small></div></div>
    ${list.length ? `<table class="stats-t"><tr><th>${p === 'annee' ? 'Année' : p === 'mois' ? 'Mois' : 'Semaine'}</th><th>Sorties</th><th>Milles</th><th>Heures</th></tr>
      ${list.map(([, g]) => `<tr><td>${esc(g.label)}<div class="bar" style="width:${Math.round((g.nm / max) * 100)}%"></div></td><td>${g.n}</td><td>${fr(g.nm)}</td><td>${fmtHours(g.ms)}</td></tr>`).join('')}</table>`
      : '<div class="empty-state">Pas encore de sortie avec des milles ou une durée pour ce choix.</div>'}`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.sp) settings.statsPeriod = b.dataset.sp;
    if (b.dataset.sb != null) {
      if (!b.dataset.sb) sel.clear(); else if (sel.has(b.dataset.sb)) sel.delete(b.dataset.sb); else sel.add(b.dataset.sb);
      settings.statsBoats = [...sel];
    }
    saveSettings();
    VIEWS.stats();
  };
};

/* ---------- Boutons « En navigation » : moteur, voile, voile + moteur, allure, voiles, baignade ---------- */
const LAKE_EVENTS = { bain: 'Départ baignade', bainFin: 'Retour baignade' };
// Moteur et voile : deux interrupteurs indépendants ; les deux ensemble = voile + moteur.
const PROP_EVT = { motOn: 'Début moteur', motOff: 'Fin moteur', sailOn: 'Début voile', sailOff: 'Fin voile' };
const NAV_ALLURES = ['Près', 'Travers', 'Largue', 'Grand largue', 'Vent arrière'];
const NAV_GV = ['Haute', '1 ris', '2 ris', 'Affalée'];
const NAV_AVANT = ['Génois', 'Génois partiel', 'Foc', 'Spi', 'Gennaker', 'Aucune'];
// Vidange des eaux noires : notée seulement sur appui volontaire, jamais automatiquement.
const BLACK_EVT = 'Eaux noires vidées';
const blackOwner = () => (isLake() && boatById(cruise.boatId)) || cruise;
const hasEvt = (e, label) => (e.v.evt || []).includes(label);
// Effet d'une entrée sur l'état moteur / voile (les libellés des versions précédentes sont compris aussi).
function applyProp(e, st) {
  const set = (m, s) => { if (m != null) st.m = m; if (s != null) st.s = s; return true; };
  if (hasEvt(e, 'Arrivée') || hasEvt(e, 'Fin voile et moteur')) return set(false, false);
  if (hasEvt(e, 'Passage au moteur')) return set(true, false);
  if (hasEvt(e, 'Passage à la voile')) return set(false, true);
  if (hasEvt(e, 'Voile et moteur')) return set(true, true);
  let ch = false;
  if (hasEvt(e, PROP_EVT.motOn)) ch = set(true, null);
  if (hasEvt(e, PROP_EVT.motOff)) ch = set(false, null);
  if (hasEvt(e, PROP_EVT.sailOn)) ch = set(null, true);
  if (hasEvt(e, PROP_EVT.sailOff)) ch = set(null, false);
  return ch;
}
// Moteur en marche : pas d'allure ; moteur seul : pas de voiles non plus.
const sailHidden = (k, st) => !!st && st.motor && (k === 'allure' || !st.sail);
function lakeState(k) {
  const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
  const st = { m: false, s: false, mT: null, sT: null };
  for (const e of ents) {
    const was = { m: st.m, s: st.s };
    if (!applyProp(e, st)) continue;
    if (st.m && !was.m) st.mT = e.t;
    if (st.s && !was.s) st.sT = e.t;
  }
  const lastOf = (test) => [...ents].reverse().find(test);
  const b = lastOf((e) => hasEvt(e, LAKE_EVENTS.bain) || hasEvt(e, LAKE_EVENTS.bainFin));
  const al = st.s && lastOf((e) => Date.parse(e.t) >= Date.parse(st.sT) && e.v.allure && e.v.allure !== 'Moteur');
  const gv = lastOf((e) => e.v.gv), av = lastOf((e) => e.v.avant);
  return {
    motor: st.m, motorT: st.m ? st.mT : null, sail: st.s, sailT: st.s ? st.sT : null,
    allure: al ? al.v.allure : null, gv: gv ? gv.v.gv : null, avant: av ? av.v.avant : null,
    bathing: !!b && hasEvt(b, LAKE_EVENTS.bain), bathT: b && b.t,
  };
}
function renderLakeButtons() {
  const box = $('#lakeBtns');
  if (!box) return;
  if (!cruise) { box.innerHTML = ''; return; }
  const st = lakeState(dayKey(new Date()));
  for (const k of SAIL_KEYS) { const f = $(`#fields .field[data-key="${k}"]`); if (f) f.hidden = sailHidden(k, st); }
  const since = (t) => (t ? ` depuis ${fmtUtc(new Date(t))}` : '');
  const bv = blackOwner().noirVid;
  const sailing = st.sail;
  const avants = (cruise.info.voilesAvant || ((isLake() && boatById(cruise.boatId)) || { info: {} }).info.voilesAvant || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const chips = (key, opts, cur, cols) => `<div class="row nav-chips c${cols}">${opts.map((o) => `<button class="btn ${o === cur ? 'on' : ''}" data-set="${key}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  const wxn = isLake() && dayData(dayKey(new Date())).wxNow;
  // Mise à jour discrète toutes les 30 min quand il y a du réseau.
  if (isLake() && (!wxn || Date.now() - wxn.at > 30 * 60000)) setTimeout(() => updateLakeWx(null, () => { renderLakeButtons(); }, true), 1500);
  const wxBox = isLake() ? `<section class="field lake-wx"><h2><span>🌤 Météo MeteoSwiss</span></h2>${wxNowHtml(dayData(dayKey(new Date())).wxNow)}
    <div class="row"><button class="btn" data-wx="1">↻ Mettre à jour (réseau)</button></div>${windAlertHtml()}</section>` : `<section class="field lake-wx"><h2><span>💨 Alertes de vent</span></h2>${windAlertHtml()}</section>`;
  box.innerHTML = wxBox + `<section class="field lake-btns"><h2><span>En navigation</span></h2>
    <div class="row c2 prop-row">
      <button class="btn big ${st.motor ? 'on' : ''}" data-prop="motor"><span class="mode-ic">⚙️</span>Moteur<small>${st.motor ? `en marche${since(st.motorT)} · toucher pour arrêter` : 'arrêté · toucher pour démarrer'}</small></button>
      <button class="btn big ${st.sail ? 'on' : ''}" data-prop="sail"><span class="mode-ic">⛵</span>Voile<small>${st.sail ? `sous voile${since(st.sailT)} · toucher pour affaler` : 'toucher pour hisser'}</small></button>
    </div>
    ${st.motor && st.sail ? '<p class="help prop-both">⛵⚙️ Voile + moteur</p>' : ''}
    ${sailing ? `${st.motor ? '' : `<h3 class="sub-h">Allure</h3>${chips('allure', NAV_ALLURES, st.allure, 3)}`}
      <h3 class="sub-h">Grand-voile</h3>${chips('gv', NAV_GV, st.gv, 4)}
      <h3 class="sub-h">Voile d’avant</h3>${chips('avant', avants.length ? avants.concat(['Aucune']) : NAV_AVANT, st.avant, avants.length === 3 ? 4 : 3)}` : ''}
    ${isLake() ? `<div class="row">${st.bathing
      ? `<button class="btn big bath-on" data-lev="bainFin">🏊 Retour de baignade<small>baignade${since(st.bathT)} · compter tout le monde</small></button>`
      : '<button class="btn big" data-lev="bain">🏊 Baignade<small>moteur coupé, échelle sortie</small></button>'}</div>` : ''}
    <div class="row c2"><button class="btn big" data-navphoto="1">📷 + photo<small>${photosFor('nav', dayKey(new Date())).length ? `${photosFor('nav', dayKey(new Date())).length} aujourd’hui` : 'en navigation'}</small></button>
    <button class="btn big" data-black="1">🚽 Eaux noires vidées<small>${bv ? `dernière : ${fmtShortDate(new Date(bv)).slice(0, 5)} à ${fmtTime(new Date(bv))}` : 'date et heure'}</small></button></div>
  </section>`;
  // Une entrée au journal, avec la position du moment et la vitesse du suivi GPS s'il tourne.
  const note = (v, msg, t) => {
    lakeFix((pos) => {
      if (pos) v.pos = pos;
      if (typeof trip !== 'undefined' && trip && tracking) {
        if (trip.det.lastSog != null) v.sog = trip.det.lastSog;
        if (trip.det.lastCog != null) v.cog = trip.det.lastCog;
      }
      addEntry({ id: uid(), t: t || new Date().toISOString(), v });
      toast(msg);
      renderLakeButtons();
    });
  };
  box.onclick = (e) => {
    const wa = e.target.closest('[data-walert]');
    if (wa) { buzz(); return windAlertClick(wa); }
    const wb = e.target.closest('[data-wx]');
    if (wb) { buzz(); return updateLakeWx(wb, renderLakeButtons); }
    if (e.target.closest('[data-navphoto]')) { buzz(); return takePhoto('nav', renderLakeButtons); }
    const bk = e.target.closest('[data-black]');
    if (bk) return armed(bk, 'Toucher encore : noter la vidange maintenant', () => {
      const t = new Date().toISOString();
      const o = blackOwner(); o.noirVid = t;
      if (o === cruise) saveCruise(); else saveBoats();
      if (isLake()) dayData(dayKey(new Date())).eauxNoires = 'OK';
      note({ evt: [BLACK_EVT] }, `🚽 Vidange des eaux noires notée à ${fmtTime2(new Date(t))}`, t);
    });
    const b = e.target.closest('[data-lev],[data-prop],[data-set]');
    if (!b || b.disabled) return;
    buzz();
    if (b.dataset.prop) {
      b.disabled = true;
      if (b.dataset.prop === 'motor') return note({ evt: [st.motor ? PROP_EVT.motOff : PROP_EVT.motOn] }, st.motor ? '⚙️ Moteur arrêté' : '⚙️ Moteur en marche');
      return note({ evt: [st.sail ? PROP_EVT.sailOff : PROP_EVT.sailOn] }, st.sail ? '⛵ Voiles affalées' : '⛵ Sous voile');
    }
    if (b.dataset.set) {
      const k = b.dataset.set, val = b.dataset.val;
      if (st[k] === val) return toast('Déjà noté');
      b.disabled = true;
      if (k === 'allure') return note({ evt: ['Changement d’allure'], allure: val }, `⛵ Allure : ${val}`);
      return note({ evt: ['Changement de voile'], gv: k === 'gv' ? val : st.gv || undefined, avant: k === 'avant' ? val : st.avant || undefined }, `⛵ ${k === 'gv' ? 'Grand-voile' : 'Voile d’avant'} : ${val}`);
    }
    const kind = b.dataset.lev;
    b.disabled = true;
    note({ evt: [LAKE_EVENTS[kind]] }, { bain: '🏊 Départ baignade noté', bainFin: '🏊 Retour de baignade noté' }[kind]);
  };
}
// Position du moment : celle du suivi GPS s'il tourne, sinon une mesure rapide. Sans GPS, l'heure suffit.
function lakeFix(done) {
  const lp = typeof trip !== 'undefined' && trip && tracking && trip.det.lastPt;
  if (lp && Date.now() - lp.t < 120000) return done({ lat: lp.lat, lon: lp.lon });
  if (!('geolocation' in navigator)) return done(null);
  navigator.geolocation.getCurrentPosition(
    (p) => done({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
    () => done(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
}
// Temps au moteur, à la voile, voile + moteur, et baignades de la journée, pour la fiche.
function lakeTimes(k) {
  const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
  const baths = [];
  if (!ents.length) return { motor: 0, sail: 0, mixed: 0, baths };
  const st = { m: false, s: false };
  let motor = 0, sail = 0, mixed = 0, last = null, bStart = null;
  const add = (t) => { if (last != null) { const d = t - last; if (st.m) motor += d; if (st.s) sail += d; if (st.m && st.s) mixed += d; } last = t; };
  const endT = () => { const a = [...ents].reverse().find((e) => hasEvt(e, 'Arrivée')); return a ? Date.parse(a.t) : k === dayKey(new Date()) ? Date.now() : Date.parse(ents[ents.length - 1].t); };
  for (const e of ents) {
    const t = Date.parse(e.t);
    add(t);
    applyProp(e, st);
    if (hasEvt(e, LAKE_EVENTS.bain)) bStart = t;
    if (hasEvt(e, LAKE_EVENTS.bainFin)) { baths.push([bStart, t]); bStart = null; }
  }
  if (st.m || st.s) add(Math.max(last, endT()));
  if (bStart != null) baths.push([bStart, null]);
  return { motor, sail, mixed, baths };
}

/* ---------- Extrait du journal : départ, arrivée et quelques entrées choisies ----------
   Sortie courte : 2 entrées par heure ; dès 3 heures de navigation : 1 par heure.
   Les saisies manuelles (moteur, voile, baignade, entrées tapées) passent avant les changements de cap automatiques. */
function journalExtract(k) {
  const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
  if (!ents.length) return [];
  const dep = ents.find((e) => hasEvt(e, 'Départ')) || ents[0];
  const arr = [...ents].reverse().find((e) => hasEvt(e, 'Arrivée')) || (ents.length > 1 ? ents[ents.length - 1] : null);
  const t0 = Date.parse(dep.t), t1 = arr ? Date.parse(arr.t) : t0;
  const h = (t1 - t0) / 3600000;
  const budget = h < 3 ? Math.round(h * 2) : Math.round(h);
  const cands = ents.filter((e) => e !== dep && e !== arr && Date.parse(e.t) > t0 && Date.parse(e.t) < t1);
  const score = (e) => (e.auto ? 1 : 2) + ((e.v.evt || []).length ? 0.5 : 0);
  const picked = [];
  if (budget > 0 && cands.length) {
    // Un créneau par entrée gardée ; dans chaque créneau, la plus importante, puis la plus proche du milieu.
    const step = (t1 - t0) / budget;
    for (let i = 0; i < budget; i++) {
      const a = t0 + i * step, b = a + step, mid = (a + b) / 2;
      const inSlot = cands.filter((e) => { const t = Date.parse(e.t); return t >= a && t < b && !picked.includes(e); });
      inSlot.sort((x, y) => score(y) - score(x) || Math.abs(Date.parse(x.t) - mid) - Math.abs(Date.parse(y.t) - mid));
      if (inSlot[0]) picked.push(inSlot[0]);
    }
  }
  const list = [dep, ...picked.sort((x, y) => x.t.localeCompare(y.t)), ...(arr && arr !== dep ? [arr] : [])];
  return list.map(extractRow);
}
function extractRow(e) {
  {
    const v = e.v;
    const what = (v.evt || []).join(', ') || (e.auto ? 'Point de route' : 'Entrée');
    const more = [
      v.cog != null ? `cap ${pad(v.cog, 3)}°` : '', v.sog != null ? `${fr(v.sog)} nd` : '',
      v.tws != null ? `vent ${windTxt(v.tws)}${v.twd != null ? ` du ${pad(v.twd, 3)}°` : ''}` : '', v.allure && v.allure !== 'Moteur' ? v.allure : '', v.gv || v.avant ? `GV ${v.gv || '…'} · ${v.avant || '…'}` : '',
      v.note || '',
    ].filter(Boolean).join(' · ');
    return { time: fmtTime(new Date(e.t)), what, more: [`${fmtUtc(new Date(e.t))}`, more].filter(Boolean).join(' · ') };
  }
}

/* ---------- Photos : prise du bateau, en navigation, fin de sortie ----------
   Réduites (1280 px, JPEG) et gardées dans le téléphone (IndexedDB). La liste est dans cruise.photos. */
const PHOTO_CTX = { dep: '📷 Prise du bateau', nav: '📷 En navigation', quit: '📷 Fin de sortie' };
let photoDb = null;
function photoStore(mode) {
  if (!photoDb) photoDb = new Promise((res, rej) => {
    const r = indexedDB.open('ldb-photos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('p');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return photoDb.then((db) => db.transaction('p', mode).objectStore('p'));
}
const idbReq = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const putPhoto = (id, url) => photoStore('readwrite').then((s) => idbReq(s.put(url, id)));
const getPhoto = (id) => photoStore('readonly').then((s) => idbReq(s.get(id))).catch(() => null);
const delPhoto = (id) => photoStore('readwrite').then((s) => idbReq(s.delete(id))).catch(() => null);
function shrinkPhoto(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      res(cv.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
// Ouvre l'appareil photo ou la photothèque, puis enregistre la ou les photos.
function takePhoto(ctx, done, item) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files];
    if (!files.length) return;
    const k = dayKey(new Date());
    const ids = [];
    for (const f of files) {
      try {
        const id = uid();
        await putPhoto(id, await shrinkPhoto(f));
        (cruise.photos = cruise.photos || []).push(Object.assign({ id, t: new Date().toISOString(), day: k, ctx }, item ? { item } : {}));
        ids.push(id);
      } catch { toast('Photo impossible à enregistrer'); }
    }
    const n = ids.length;
    if (!n) return;
    saveCruise();
    if (ctx === 'nav') lakeFix((pos) => { const v = { evt: ['Photo'], photos: ids }; if (pos) v.pos = pos; addEntry({ id: uid(), t: new Date().toISOString(), v }); });
    toast(n > 1 ? `📷 ${n} photos ajoutées` : '📷 Photo ajoutée');
    if (done) done();
  };
  inp.click();
}
// Photos d'un jour (et d'un moment) : pour lac à la journée, celles du jour ; sinon toute la croisière pour la prise et la fin.
const photosFor = (ctx, k) => (cruise.photos || []).filter((p) => (!ctx || p.ctx === ctx) && (!k || p.day === k));
function photoStrip(list, removable) {
  if (!list.length) return '';
  return `<div class="photo-strip">${list.map((p) => `<figure class="photo"><img data-photo="${p.id}" alt="Photo"><figcaption>${fmtTime(new Date(p.t))}</figcaption>${removable ? `<button class="btn danger photo-del" data-pdel="${p.id}" aria-label="Supprimer la photo">✕</button>` : ''}</figure>`).join('')}</div>`;
}
function fillPhotos(root) {
  for (const el of $$('img[data-photo]', root)) if (!el.src) getPhoto(el.dataset.photo).then((url) => { if (url) el.src = url; else el.closest('figure').remove(); });
}
function removePhoto(id) {
  cruise.photos = (cruise.photos || []).filter((p) => p.id !== id);
  saveCruise(); delPhoto(id);
}

/* ---------- Journal complet de la journée ----------
   Toutes les saisies manuelles et tous les événements ; les points automatiques (suivi GPS ou trace importée)
   sont gardés s'il y a un changement de cap d'au moins 20°, sinon au plus un par quart d'heure. */
function journalFull(k) {
  const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
  const out = [];
  let lastT = -Infinity, lastCog = null;
  ents.forEach((e, i) => {
    const t = Date.parse(e.t);
    const turn = e.v.cog != null && lastCog != null && Math.abs(((e.v.cog - lastCog + 540) % 360) - 180) >= 20;
    const keep = !e.auto || (e.v.evt || []).length || e.v.note || i === 0 || i === ents.length - 1 || turn || t - lastT >= 15 * 60000;
    if (!keep) return;
    out.push(e);
    lastT = t;
    if (e.v.cog != null) lastCog = e.v.cog;
  });
  return out.map(extractRow);
}

// Toucher une vignette ouvre la photo en plein écran, avec la précédente et la suivante de la même série.
function openPhoto(img) {
  const list = [...img.closest('.photo-strip').querySelectorAll('img[data-photo]')].filter((x) => x.src);
  let i = list.indexOf(img);
  const ov = document.createElement('div');
  ov.className = 'photo-view';
  const show = () => {
    const el = list[i], ph = ((cruise && cruise.photos) || []).find((p) => p.id === el.dataset.photo);
    ov.innerHTML = `<img src="${el.src}" alt="Photo">
      <p>${ph ? `${PHOTO_CTX[ph.ctx] || '📷'} · ${fmtShortDate(new Date(ph.t))} à ${fmtTime(new Date(ph.t))}` : esc(el.dataset.cap || '')}${list.length > 1 ? ` · ${i + 1} / ${list.length}` : ''}</p>
      <div class="row ${list.length > 1 ? 'c4' : 'c2'}">${list.length > 1 ? '<button class="btn big" data-pv="-1" aria-label="Précédente">◀</button>' : ''}<button class="btn big" data-pshare="1" aria-label="Partager">📤</button><button class="btn big primary" data-pclose="1">✕</button>${list.length > 1 ? '<button class="btn big" data-pv="1" aria-label="Suivante">▶</button>' : ''}</div>`;
  };
  show();
  ov.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.pclose) return ov.remove();
    if (b.dataset.pv) { i = (i + Number(b.dataset.pv) + list.length) % list.length; return show(); }
    if (b.dataset.pshare) { const blob = await (await fetch(list[i].src)).blob(); deliver(blob, `photo-${list[i].dataset.photo}.jpg`, 'image/jpeg'); }
  };
  document.body.appendChild(ov);
}
document.addEventListener('click', (e) => {
  const img = e.target.closest('.photo-strip img[data-photo]');
  if (img && img.src && !e.target.closest('.photo-view')) { buzz(); openPhoto(img); }
});

/* ---------- Nom automatique des sorties ----------
   [C si croisière][AA][n° de la sortie dans l'année][plan d'eau]_[bateau] [port de départ] [jour] [j/m]
   ex. 2607L_Savannah Morges JE 9/7 · 2609Ac_Inspiration St-Malo SA 11/7 */
const ZONES = [['M', 'Méditerranée'], ['A', 'Atlantique, Manche'], ['N', 'Mer du Nord'], ['B', 'Baltique'], ['X', 'Autre']];
// Ports connus, pour trouver le port de départ sans réseau (au plus 5 km au lac, 10 km en mer).
const PORTS = [
  ['Genève', 46.208, 6.153], ['Genève Port-Noir', 46.213, 6.170], ['Versoix', 46.283, 6.168], ['Coppet', 46.316, 6.193], ['Nyon', 46.383, 6.241],
  ['Rolle', 46.459, 6.338], ['Saint-Prex', 46.481, 6.457], ['Morges', 46.508, 6.498], ['Saint-Sulpice', 46.510, 6.556],
  ['Lausanne-Vidy', 46.516, 6.597], ['Lausanne-Ouchy', 46.505, 6.627], ['Pully', 46.507, 6.660], ['Lutry', 46.502, 6.685], ['Cully', 46.488, 6.730],
  ['Vevey', 46.461, 6.843], ['La Tour-de-Peilz', 46.455, 6.857], ['Montreux', 46.433, 6.909], ['Villeneuve', 46.396, 6.927], ['Le Bouveret', 46.387, 6.857],
  ['Saint-Gingolph', 46.393, 6.806], ['Évian', 46.401, 6.590], ['Thonon', 46.379, 6.483], ['Sciez', 46.343, 6.383], ['Yvoire', 46.371, 6.326],
  ['Nernier', 46.364, 6.301], ['Hermance', 46.302, 6.244], ['Anières', 46.277, 6.222], ['Corsier-Port', 46.263, 6.214], ['La Belotte', 46.231, 6.185],
  ['St-Malo', 48.646, -2.017], ['Dinard', 48.635, -2.050], ['Granville', 48.833, -1.600], ['Cherbourg', 49.645, -1.620], ['Le Havre', 49.485, 0.105],
  ['Brest', 48.380, -4.490], ['Camaret', 48.278, -4.595], ['Concarneau', 47.871, -3.917], ['Lorient', 47.735, -3.360], ['La Trinité-sur-Mer', 47.585, -3.025],
  ['Port-Crouesty', 47.543, -2.895], ['Pornic', 47.113, -2.103], ['Les Sables-d’Olonne', 46.497, -1.792], ['La Rochelle', 46.146, -1.168], ['Arcachon', 44.660, -1.165],
  ['Port-Vendres', 42.519, 3.110], ['Port-Camargue', 43.519, 4.130], ['Marseille', 43.293, 5.365], ['La Ciotat', 43.174, 5.607], ['Bandol', 43.135, 5.752],
  ['Toulon', 43.119, 5.931], ['Hyères', 43.080, 6.158], ['Porquerolles', 43.000, 6.203], ['Le Lavandou', 43.137, 6.370], ['Saint-Tropez', 43.272, 6.637],
  ['Cannes', 43.548, 7.017], ['Antibes', 43.585, 7.128], ['Nice', 43.696, 7.285], ['Ajaccio', 41.919, 8.740], ['Bonifacio', 41.388, 9.160], ['Calvi', 42.566, 8.758],
  ['Palma', 39.566, 2.634], ['Split', 43.503, 16.440], ['Trogir', 43.514, 16.250], ['Kaštela', 43.548, 16.380], ['Šibenik', 43.733, 15.892], ['Zadar', 44.118, 15.230],
  ['Pula', 44.871, 13.840], ['Dubrovnik', 42.668, 18.083], ['Lefkada', 38.833, 20.710], ['Athènes Alimos', 37.910, 23.705], ['Kos', 36.893, 27.290],
  ['Kiel', 54.323, 10.140], ['Rostock Warnemünde', 54.180, 12.085], ['Copenhague', 55.690, 12.600], ['Gdańsk', 54.352, 18.660], ['Visby', 57.640, 18.285],
  ['Stockholm', 59.325, 18.080], ['Mariehamn', 60.097, 19.935], ['Helsinki', 60.160, 24.950], ['Tallinn', 59.445, 24.765], ['Göteborg', 57.700, 11.950],
];
const distKm = (a, b, c, d) => { const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r; return Math.sqrt(x * x + y * y) * 6371; };
function nearestPort(lat, lon, maxKm) {
  let best = null, bd = maxKm;
  for (const [n, a, b] of PORTS) { const d = distKm(lat, lon, a, b); if (d < bd) { bd = d; best = n; } }
  return best;
}
// Plan d'eau probable d'après la position (à corriger au besoin).
function guessZone(lat, lon) {
  if (lat > 53.5 && lat < 66 && lon >= 9.5 && lon < 31) return 'B'; // Baltique, Kattegat compris
  if (lat > 51 && lat < 61 && lon > -2 && lon < 9) return 'N';
  if (lon < -1 || (lat > 43.3 && lat < 48.4 && lon < -1)) return 'A';
  if (lat > 30 && lat < 46 && lon > -5.5 && lon < 37) return 'M';
  return 'X';
}
let startFix = null;
// Port de départ : liste intégrée d'abord ; avec du réseau, le nom de la commune (OpenStreetMap) sinon.
function findStartPlace(mode, done) {
  if (!('geolocation' in navigator)) return done(null);
  navigator.geolocation.getCurrentPosition(async (p) => {
    const lat = p.coords.latitude, lon = p.coords.longitude;
    startFix = { lat, lon };
    let place = nearestPort(lat, lon, mode === 'mer' ? 10 : 5);
    if (!place && navigator.onLine) {
      try {
        const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=12&lat=${lat}&lon=${lon}&accept-language=fr`, { signal: ctl.signal });
        const j = await r.json();
        const a = j.address || {};
        place = a.town || a.city || a.village || a.municipality || null;
      } catch { /* sans réseau : pas de nom */ }
    }
    done(place, guessZone(lat, lon));
  }, () => done(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
}
const DOW = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'];
function autoOutingName(mode, boatName, place, zone, when) {
  const d = when || new Date();
  // Numéro unique : le plus grand numéro encore enregistré cette année + 1. Si on efface les dernières,
  // la numérotation repart depuis la dernière encore enregistrée (Corban, v183).
  const yy = String(d.getFullYear()).slice(2);
  const nums = index.filter((m) => new Date(m.created).getFullYear() === d.getFullYear()).map((m) => { const r = new RegExp('^' + yy + '(\\d{2,3})').exec(m.name || ''); return r ? Number(r[1]) : 0; });
  const n = Math.max(0, ...nums) + 1;
  // Corban (2026-10-31, v70) : le « c » de croisière en minuscule après la lettre de zone, ex. 2609Ac.
  const code = `${String(d.getFullYear()).slice(2)}${pad(n)}${mode === 'mer' ? zone || 'M' : 'L'}${mode === 'lacj' ? '' : 'c'}`;
  return `${code}_${[boatName, place].filter(Boolean).join(' ')} ${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`.replace('_ ', '_');
}

/* ---------- Météo du lac : mesure de la station MeteoSwiss la plus proche et prévision ---------- */
// Énergie convective (CAPE, J/kg) : indice simple du risque d'orage.
const capeRisk = (c) => (c == null ? '' : c >= 1500 ? '⚡⚡ orage fort' : c >= 800 ? '⚡ orage' : c >= 300 ? 'orage ?' : '');
const r0 = (x) => (x == null ? '…' : Math.round(x));
function wxNowHtml(w) {
  if (!w) return '<p class="help">Pas encore de météo aujourd’hui. Touchez « Mettre à jour » quand il y a du réseau.</p>';
  const m = w.meas, f = w.fc;
  return `${m ? `<div class="wx-now">${windHtml(m.tws)} du ${m.twd == null ? '…' : pad(Math.round(m.twd), 3) + '°'} · rafales ${windHtml(m.gust)}${m.air != null ? ` · ${fr(m.air)} °C` : ''}${m.baro != null ? ` · ${Math.round(m.baro)} hPa` : ''}</div>
      <p class="help wx-src">${esc(m.src)}</p>` : '<p class="help">Aucune station MeteoSwiss proche ne répond.</p>'}
    ${f ? `<table class="wx-fc">${f.rows.filter((x) => x.t > w.at - 1800000).slice(0, 8).map((x) => `<tr><th>${fmtTime(new Date(x.t))}</th><td>${windHtml(x.tws)}${knOk(x.gust) ? `<br><small class="kmh">raf. ${Math.round(x.gust)} nd · ${bft(x.gust)} Bf · ${kmh(x.gust)} km/h</small>` : ''}</td><td>${x.twd == null ? '' : pad(Math.round(x.twd), 3) + '°'}</td><td>${x.rain ? fr(x.rain) + ' mm' : ''}</td><td>${capeRisk(x.cape)}</td></tr>`).join('')}</table>
      <p class="help wx-src">${esc(f.src)}</p>` : ''}
    <p class="help">Mis à jour à ${tzHtml(new Date(w.at))}. Les feux d’avis de tempête restent à vérifier sur place.</p>`;
}
function wxSummary(w) {
  if (!w) return '';
  const m = w.meas;
  if (m) return `vent ${windTxt(m.tws)} du ${m.twd == null ? '…' : pad(Math.round(m.twd), 3) + '°'}, rafales ${windTxt(m.gust) || '…'}${m.air != null ? `, ${fr(m.air)} °C` : ''} (${m.src})`;
  const x = w.fc && w.fc.rows[0];
  return x ? `vent ${windTxt(x.tws)} du ${pad(Math.round(x.twd), 3)}°, rafales ${windTxt(x.gust) || '…'} (${w.fc.src})` : '';
}
let wxBusy = false;
function updateLakeWx(btn, done, quiet) {
  if (wxBusy) return;
  if (!navigator.onLine) return quiet || toast('Pas de réseau : la dernière météo reste affichée');
  wxBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Météo…'; }
  lakeFix(async (pos) => {
    if (!pos) { wxBusy = false; if (btn) btn.disabled = false; return quiet || toast('Position GPS indisponible'); }
    const [meas, fc] = await Promise.all([smnMeasure(pos.lat, pos.lon, new Date()).catch(() => null), wxNext(pos.lat, pos.lon, 9).catch(() => null)]);
    wxBusy = false;
    if (!meas && !fc) { if (btn) btn.disabled = false; if (!quiet) toast('Météo indisponible pour le moment'); return; }
    const d = dayData(dayKey(new Date()));
    d.wxNow = { at: Date.now(), meas, fc };
    // Reprend la mesure (ou la prévision) dans la fiche, sans remplacer ce qui a été saisi à la main.
    const src = meas || (fc && fc.rows[0]);
    const set = (k, v) => { if (v != null && (d[k] == null || d[k] === '')) d[k] = String(Math.round(v)); };
    if (src) { set('fVentDir', src.twd); set('fVentVit', src.tws); set('fRafales', src.gust); if (src.air != null && !d.fAir) d.fAir = fr(src.air); }
    d.wxSource = meas ? meas.src : fc.src;
    saveCruise();
    if (!quiet) toast('🌤 Météo mise à jour');
    if (done) done();
  });
}

/* ---------- Alertes de vent autour du lac (stations MeteoSwiss) ----------
   Deux signaux et deux clignotements par alerte (v84), tonalité plus aiguë et plus forte à chaque degré Beaufort dès 4 Bf (v389),
   l'écran clignote deux fois avec la valeur du vent (v83). Rappel toutes les 15 min tant que le vent reste dans la même tranche.
   Ne marche que l'appli ouverte et l'écran allumé (le téléphone met en pause les applis web en arrière-plan). */
// v423 (Corban) : alertes de vent OUI par défaut, sur les rafales, actives dès que l'appli est allumée (avec ou sans navigation ouverte,
// quel que soit l'écran). Mise à OUI une seule fois pour les réglages existants (drapeau windOn423).
if (!settings.windOn423) { settings.windAlert = Object.assign({}, settings.windAlert, { on: true, basis: 'gust' }); settings.windOn423 = true; saveSettings(); }
const windAlert = () => Object.assign({ on: true, basis: 'gust', radius: 30 }, settings.windAlert);
// v423 (Corban) : « pas d'alertes jusqu'à la fin de la trace en cours » ; levé tout seul à la fin de la trace.
const windMuted = () => !!settings.windMuteTrack;
function windMuteEnd() { if (settings.windMuteTrack) { settings.windMuteTrack = false; saveSettings(); toast('Alertes de vent de nouveau actives'); } }
let windWatchLast = null;
// v389 (Corban) : une alerte à chaque seuil de Beaufort, à partir de 4 Bf (11 nd) : niveau 0 = 4 Bf … niveau 8 = 12 Bf.
const windLevel = (kn) => (kn == null ? -1 : bft(kn) < 4 ? -1 : bft(kn) - 4);
// Couleurs du flash par tranche (Corban, 2026-10-31) : 10/15 bleu clair/foncé, 20/25 vert clair/foncé, 30/35 jaune clair/foncé, 40/45 rouge clair/foncé, 50/55 violet clair/foncé (55 et plus).
// 2026-11-04 (Corban) : code couleur progressif, de plus en plus dramatique : vert (4 Bf) → jaune → orange → rouge → bordeaux → violet noir (12 Bf).
const WIND_FLASH = [['#7ed957', 'vert'], ['#c8e64a', 'vert-jaune'], ['#ffe14d', 'jaune'], ['#ffb330', 'orange clair'], ['#ff7a1a', 'orange'], ['#f03c1e', 'rouge'], ['#c4001a', 'rouge foncé'], ['#8a0033', 'bordeaux'], ['#4b0055', 'violet sombre'], ['#22002b', 'violet noir']];
const flashColor = (level) => WIND_FLASH[Math.min(level, WIND_FLASH.length - 1)][0];
let audioCtx = null, keepAlive = null;
// Petit fichier WAV silencieux, joué en boucle : sur iPhone il garde la sortie audio ouverte
// (sinon le 2e signal peut rester muet, et le son est coupé par le bouton silencieux).
function silentWavUrl() {
  const n = 8000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
  } catch { audioCtx = null; }
  try {
    if (!keepAlive) { keepAlive = new Audio(silentWavUrl()); keepAlive.loop = true; keepAlive.setAttribute('playsinline', ''); }
    if (keepAlive.paused) keepAlive.play().catch(() => {});
  } catch {}
}
// Le son ne peut être débloqué que par un toucher : on le fait au premier toucher quand les alertes sont actives.
document.addEventListener('pointerdown', () => { if (windAlert().on) unlockAudio(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && windAlert().on && audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {}); });
// Joue le motif et fait clignoter l'écran en même temps.
// Son : motif par tranche (inchangé). Écran : deux clignotements seulement, avec la valeur du vent
// en nœuds et en Beaufort sur toute la largeur (Corban, 2026-10-31, v83).
/* 2026-11-04 (Corban) : bulle d'alerte de vent. D'abord les deux bips et les deux flashs de couleur avec les Beaufort,
   PUIS cette bulle, différente des autres : grande écriture, fond rouge vitré et transparent, liseré de la couleur du niveau,
   avec toutes les infos (Beaufort, vent, état de la mer, hauteur des vagues). Elle reste jusqu'à ce qu'on la touche. */
const WIND_POP_DELAY = 2900; // après les deux flashs (2 × 1,2 s + 0,4 s)
// v422 (Corban) : hauteur de vagues théorique de l'échelle de Beaufort (OMM, pleine mer, vent établi) à côté de la valeur du modèle.
const WAVE_OMM = { 1: 0.1, 2: 0.2, 3: 0.6, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5.5, 9: 7, 10: 9, 11: 11.5, 12: 14 };
const waveOmmTxt = (bf) => { const h = WAVE_OMM[Math.max(1, Math.min(12, bf))]; if (h == null) return ''; const d = douglasOfH(h); return `théorique OMM : mer ${d} ${DOUGLAS[d][1]}, vagues ≈ ${fr(h)} m${bf >= 12 ? ' et plus' : ''} (pleine mer, vent établi)`; };
let windTest = null;
function windTestBtns() { const T = (x) => (window.uiTr ? window.uiTr(x) : x); document.querySelectorAll('[data-walert="test"]').forEach((x) => { x.textContent = T(windTest ? '⏹ Arrêter le test' : '▶ Test des alertes de vent'); x.classList.toggle('danger', !!windTest); }); }
function windTestStop() {
  if (windTest) clearTimeout(windTest.timer);
  windTest = null;
  document.querySelectorAll('#windPop, .wind-flash').forEach((x) => x.remove());
  windTestBtns();
}
function windPopShow(o, onClose) {
  const old = document.getElementById('windPop'); if (old) old.remove();
  const T = (x) => (window.uiTr ? window.uiTr(x) : x);
  const row = BEAUFORT_TBL[Math.max(0, Math.min(12, o.bf))];
  const el = document.createElement('div');
  el.id = 'windPop'; el.className = 'wind-pop no-print'; el.setAttribute('role', 'alertdialog');
  el.style.setProperty('--lvl', flashColor(Math.max(0, o.bf - 4)));
  el.innerHTML = `<div class="wp-box">
    <div class="wp-big">💨 ${o.bf} Bf · ${esc(o.kn)}</div>
    <div class="wp-name">${esc(T(row[2]))}${o.where ? ` · ${esc(T(o.where))}` : ''}</div>
    ${o.sea ? `<div class="wp-sea">🌊 ${esc(T(o.sea))}</div>` : ''}
    ${o.omm ? `<div class="wp-omm">📘 ${esc(T(o.omm))}</div>` : ''}
    ${o.note ? `<div class="wp-note">${esc(T(o.note))}</div>` : ''}
    <div class="wp-desc">${esc(T(row[4]))}</div>
    <div class="wp-close">${esc(T(o.closeTxt || 'Toucher pour fermer'))}</div>
    ${o.onStop ? `<button class="btn danger wp-stop">${esc(T('⏹ Arrêter le test'))}</button>` : ''}</div>`;
  el.addEventListener('click', (e) => { e.stopPropagation(); el.remove(); if (e.target.closest('.wp-stop')) { if (o.onStop) o.onStop(); return; } if (onClose) onClose(); });
  document.body.appendChild(el);
}
function playAlarm(level, kn) {
  if (audioCtx && audioCtx.state !== 'running') { audioCtx.resume().then(() => playTones(level)).catch(() => {}); playFlash(level, false, false, kn); return; }
  playFlash(level, true, false, kn);
}
function playTones(level) { playFlash(level, true, true); }
const flashInk = (hex) => { const n = parseInt(hex.slice(1), 16); const y = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000; return y > 150 ? '#000' : '#fff'; };
function playFlash(level, withSound, soundOnly, kn) {
  const vol = Math.min(1, 0.35 + level * 0.15);
  const col = flashColor(level);
  const k = kn != null && !Number.isNaN(kn) ? Math.round(kn) : BFT_KN[Math.min(level + 3, 11)];
  const ov = document.createElement('div');
  ov.className = 'wind-flash';
  ov.style.setProperty('--flash', col);
  ov.style.setProperty('--ink', flashInk(col));
  ov.innerHTML = `<div class="wf-txt"><b>${k} nd</b><span>${bft(k)} Beaufort</span></div>`;
  if (!soundOnly) document.body.appendChild(ov);
  // Deux signaux sonores calés sur les deux clignotements (Corban, 2026-10-31, v84) ; tonalité et volume selon la tranche.
  const on = 1200, off = 400;
  const t0 = audioCtx ? audioCtx.currentTime + 0.05 : 0;
  if (audioCtx && withSound) {
    for (const t of [0, on + off]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'square'; o.frequency.value = 880 + level * 60;
      g.gain.setValueAtTime(0, t0 + t / 1000);
      g.gain.linearRampToValueAtTime(vol, t0 + t / 1000 + 0.01);
      g.gain.setValueAtTime(vol, t0 + (t + on) / 1000 - 0.01);
      g.gain.linearRampToValueAtTime(0, t0 + (t + on) / 1000);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + t / 1000); o.stop(t0 + (t + on) / 1000 + 0.02);
    }
  }
  const vib = [on, off, on];
  if (!soundOnly) {
    // Deux clignotements de 1,2 s, séparés de 0,4 s.
    [0, on + off].forEach((s0) => { setTimeout(() => ov.classList.add('on'), s0); setTimeout(() => ov.classList.remove('on'), s0 + on); });
    setTimeout(() => ov.remove(), 2 * on + off + 100);
    if (navigator.vibrate) navigator.vibrate(vib);
  }
}
let windTimer = null, windLast = null; // windLast : { level, at } du dernier signal
// Hors de Suisse (Corban, 2026-10-31, v85) : pas de stations accessibles, on prend le modèle de prévision
// le plus fin de la région, à la position du bateau, pour l'heure en cours (Open-Meteo).
// En Égée, deux modèles grossiers : on garde le plus fort et on abaisse les seuils de 5 nd (accélérations entre les îles).
const WIND_REGIONS = [
  { name: 'France', box: [41, 51.5, -6, 9.8], models: [['meteofrance_arome_france_hd', 'Météo-France AROME HD 1,5 km'], ['meteofrance_arome_france', 'Météo-France AROME 2,5 km']] },
  { name: 'Italie, Adriatique, Ionienne', box: [35.5, 47, 9.8, 22], models: [['italia_meteo_arpae_icon_2i', 'ItaliaMeteo ICON-2I 2,2 km']] },
  { name: 'Royaume-Uni, Irlande', box: [49.5, 61, -11, 2], models: [['ukmo_uk_deterministic_2km', 'UK Met Office 2 km']] },
  { name: 'Allemagne, Benelux, Alpes', box: [45.5, 53, 2, 15], models: [['icon_d2', 'DWD ICON-D2 2 km']] },
  { name: 'Baltique, mer du Nord', box: [53, 60, 3, 30], models: [['dmi_harmonie_arome_europe', 'DMI HARMONIE 2 km']] },
  { name: 'Scandinavie', box: [60, 72, 4, 32], models: [['metno_nordic', 'MET Norway Nordic 1 km']] },
  { name: 'Égée, Turquie', box: [34, 41.5, 22, 30], max: true, bias: 5, models: [['icon_eu', 'DWD ICON-EU 7 km'], ['ecmwf_ifs', 'ECMWF IFS 9 km'], ['ecmwf_ifs025', 'ECMWF IFS 25 km']] },
];
const WIND_FALLBACK = [['icon_eu', 'DWD ICON-EU 7 km'], ['', 'meilleur modèle Open-Meteo']];
const windRegion = (p) => WIND_REGIONS.find((r) => p.lat >= r.box[0] && p.lat < r.box[1] && p.lon >= r.box[2] && p.lon < r.box[3]) || null;
async function windModelNow(p) {
  const reg = windRegion(p);
  const q = `latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timezone=GMT`;
  const one = async ([m, label]) => {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}${m ? `&models=${m}` : ''}`);
    if (!r.ok) throw new Error(r.status);
    const c = (await r.json()).current || {};
    if (c.wind_speed_10m == null) throw new Error('vide');
    return { name: label, model: m, t: c.time ? Date.parse(c.time + 'Z') : Date.now(), avg: Number(c.wind_speed_10m), gust: c.wind_gusts_10m == null ? null : Number(c.wind_gusts_10m), dir: c.wind_direction_10m == null ? null : Number(c.wind_direction_10m) };
  };
  const vals = [];
  const chain = (reg ? reg.models : []).concat(WIND_FALLBACK);
  for (const m of chain) {
    try { vals.push(await one(m)); if (!reg || !reg.max || vals.length >= 2) break; } catch { /* modèle suivant */ }
  }
  return { vals, reg };
}
async function windCheck() {
  const cfg = windAlert();
  if (!cfg.on) return;
  if (!navigator.onLine) return;
  lakeFix(async (pos) => {
    if (!pos) return;
    const swiss = isLake() || inSwissArea(pos);
    if (!swiss) return windCheckModel(cfg, pos);
    const st = (await smnStations()).filter((x) => (x[4] || 0) < 800).map((x) => [...x, distKm(pos.lat, pos.lon, x[2], x[3])]).filter((x) => x[5] < cfg.radius);
    const vals = [];
    for (const [abbr, name, , , , km] of st) {
      try {
        const rows = await smnNow(abbr);
        const r = [...rows].reverse().find((o) => o.fu3010z0 != null);
        if (!r || Date.now() - r.t > 40 * 60000) continue;
        vals.push({ name, km, t: r.t, avg: Number(r.fu3010z0) / 1.852, gust: r.fu3010z1 == null ? null : Number(r.fu3010z1) / 1.852, dir: r.dkl010z0 == null ? null : Number(r.dkl010z0) });
      } catch { /* station suivante */ }
    }
    if (!vals.length) return;
    const key = (v) => (cfg.basis === 'gust' ? v.gust ?? v.avg : v.avg);
    vals.sort((a, b) => key(b) - key(a));
    const top = vals[0];
    windFire(cfg, top, windLevel(key(top)), { n: vals.length, src: 'smn' });
  });
}
// 2026-11-04 (Corban) : état de la mer et hauteur des vagues du modèle (Open-Meteo Marine, mer seulement : le modèle ne couvre pas les lacs).
const DOUGLAS_H = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];
const douglasOfH = (h) => { let i = 0; while (i < DOUGLAS_H.length && h > DOUGLAS_H[i]) i++; return Math.min(9, i); };
async function seaStateAt(pos) {
  try {
    const r = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${pos.lat.toFixed(3)}&longitude=${pos.lon.toFixed(3)}&hourly=wave_height&forecast_days=1&timezone=GMT`);
    if (!r.ok) return null;
    const j = await r.json(), t = (j.hourly && j.hourly.time) || [], h = (j.hourly && j.hourly.wave_height) || [];
    const now = Date.now(); let best = -1, dmin = Infinity;
    t.forEach((x, i) => { const d = Math.abs(Date.parse(x + 'Z') - now); if (h[i] != null && d < dmin) { dmin = d; best = i; } });
    if (best < 0) return null;
    const waveH = Math.round(h[best] * 10) / 10;
    return { waveH, douglas: douglasOfH(waveH) };
  } catch (e) { return null; }
}
const seaTxt = (m) => { if (!m || m.waveH == null) return ''; const d = m.douglas ?? douglasOfH(m.waveH); return `mer ${d} ${(DOUGLAS[d] || [])[1] || ''}, vagues ${fr(m.waveH)} m`; };
async function windCheckModel(cfg, pos) {
  const { vals, reg } = await windModelNow(pos);
  if (!vals.length) return;
  const key = (v) => (cfg.basis === 'gust' ? v.gust ?? v.avg : v.avg);
  vals.sort((a, b) => key(b) - key(a));
  const top = vals[0];
  const bias = (reg && reg.bias) || 0;
  const sea = isLake() ? null : await seaStateAt(pos);
  windFire(cfg, top, windLevel(key(top) + bias), Object.assign({ n: vals.length, src: 'model', region: reg ? reg.name : '', bias, names: vals.map((v) => v.name) }, sea || {}));
}
function windFire(cfg, top, level, meta) {
  const key = (v) => (cfg.basis === 'gust' ? v.gust ?? v.avg : v.avg);
  {
    const model = meta.src === 'model';
    windWatchLast = Object.assign({ at: Date.now(), top, basis: cfg.basis }, meta);
    if (cruise) { const d = dayData(dayKey(new Date())); d.windWatch = windWatchLast; saveCruise(); }
    const now = Date.now();
    if (level < 0) windLast = null;
    else if (!windLast || level > windLast.level || (level !== windLast.level && now - windLast.at > 60000) || now - windLast.at >= 15 * 60000) {
      windLast = { level, at: now };
      if (windMuted()) { if (cruise) addEntry({ id: uid(), t: new Date().toISOString(), v: { evt: ['Alerte vent'], note: `${windTxt(top.avg)}, rafales ${top.gust == null ? '…' : windTxt(top.gust)} (alerte non diffusée jusqu’à la fin de la trace)` } }); return; }
      playAlarm(level, key(top));
      { const kn = key(top); setTimeout(() => windPopShow({ bf: bft(Math.round(kn)), kn: `${Math.round(kn)} nd ${cfg.basis === 'gust' ? 'en rafales' : 'de vent moyen'}`, where: model ? `prévu ici (${top.name})` : `à ${top.name}`, sea: meta.waveH != null ? `modèle ici : ${seaTxt(meta)}` : '', omm: isLake() ? '' : waveOmmTxt(bft(Math.round(kn))) }), WIND_POP_DELAY); }
      if (cruise) addEntry({ id: uid(), t: new Date().toISOString(), v: { evt: ['Alerte vent'], note: `${windTxt(top.avg)}, rafales ${top.gust == null ? '…' : windTxt(top.gust)}${top.dir == null ? '' : ` du ${pad(Math.round(top.dir), 3)}°`} ${model ? `à la position du bateau (prévision ${top.name}${meta.bias ? `, seuils abaissés de ${meta.bias} nd` : ''})` : `à ${top.name} (mesure MeteoSwiss)`}${meta.waveH != null ? ` ; ${seaTxt(meta)}` : ''}`, ...(meta.waveH != null ? { mer: String(meta.douglas) } : {}) } });
    }
    if (cruise) try { renderLakeButtons(); } catch (e) {}
  }
}
function windWatchStart() {
  clearInterval(windTimer); windTimer = null;
  if (!windAlert().on) return;
  windCheck();
  windTimer = setInterval(windCheck, 5 * 60000);
}
// Rappel : un contrôle léger chaque minute pour tenir le rythme des 15 min même entre deux relevés.
setInterval(() => { if (windAlert().on && windLast && Date.now() - windLast.at >= 15 * 60000) windCheck(); }, 60000);
function windAlertHtml(noTest) {
  const cfg = windAlert();
  const w = (cruise ? dayData(dayKey(new Date())).windWatch : null) || windWatchLast; // v423 : surveillance aussi sans navigation ouverte
  const val = (v) => Math.round(cfg.basis === 'gust' ? v.gust ?? v.avg : v.avg);
  const trk = typeof tracking !== 'undefined' && tracking;
  return `<div class="wind-alert"><p class="keep-help nav-hint">Les alertes de vent surveillent le vent dès que l’appli est allumée, quel que soit l’écran.</p>
    <div class="row c2"><button class="btn ${cfg.on ? 'on' : ''}" data-walert="toggle">🔔 Alertes de vent : ${cfg.on ? 'OUI' : 'NON'}</button>
    <button class="btn" data-walert="basis">Seuils sur : ${cfg.basis === 'gust' ? 'rafales' : 'vent moyen'}</button></div>
    ${cfg.on ? `<div class="row"><button class="btn ${windMuted() ? 'on danger' : ''}" data-walert="mute">${windMuted() ? '🔕 Alertes coupées jusqu’à la fin de la trace · toucher pour les remettre' : '🔕 Pas d’alertes jusqu’à la fin de la trace en cours'}</button></div>` : ''}
    ${cfg.on && w && w.src === 'model' ? `<p class="help">Prévision à la position du bateau (${esc(w.names ? w.names.join(' et ') : w.top.name)}${w.n > 1 ? ', le plus fort retenu' : ''}) : <b>${windTxt(val(w.top))}</b>, ${fmtTime(new Date(w.top.t))}.${w.bias ? ` Seuils abaissés de ${w.bias} nd (${esc(w.region)}) : les modèles sous-estiment les accélérations entre les îles.` : ''}</p>` : ''}
    ${cfg.on && w && w.src !== 'model' ? `<p class="help">Le plus fort autour (${w.n} station${w.n > 1 ? 's' : ''} MeteoSwiss à moins de ${cfg.radius} km) : <b>${windTxt(val(w.top))}</b> à ${esc(w.top.name)}, ${fmtTime(new Date(w.top.t))}.</p>` : ''}
    ${w && w.waveH != null ? `<p class="keep-help">🌊 État de la mer prévu ici : <b>${esc(seaTxt(w))}</b> (modèle Open-Meteo Marine)</p>` : ''}
    <div class="wind-legend">${[4, 5, 6, 7, 8, 9, 10, 11, 12].map((b, i) => `<span><i style="background:${flashColor(i)}"></i>${b} Bf · ${BFT_KN[b - 1]}${b < 12 ? '–' + (BFT_KN[b] - 1) : '+'} nd</span>`).join('')}</div>
    <p class="help">En Suisse : stations MeteoSwiss. Ailleurs : modèle de prévision le plus fin de la région, à la position du bateau. Deux bips et deux flashs de couleur avec le vent exact (nœuds et Beaufort) à chaque nouveau degré Beaufort dès 4 Bf (11 nd), de plus en plus aigus et forts. Rappel toutes les 15 min. Appli ouverte et écran allumé seulement.</p>
    ${noTest ? '' : '<div class="row"><button class="btn" data-walert="test">▶ Test des alertes de vent</button></div>'}
  </div>`;
}
function windAlertClick(b) {
  const cfg = windAlert();
  unlockAudio();
  if (b.dataset.walert === 'toggle') {
    settings.windAlert = Object.assign(cfg, { on: !cfg.on }); saveSettings();
    if (settings.windAlert.on && !settings.wake) toast('Conseil : ⚙︎ › Garder l’écran allumé : OUI');
    windLast = null; windWatchStart();
  }
  if (b.dataset.walert === 'mute') {
    if (windMuted()) { settings.windMuteTrack = false; saveSettings(); toast('Alertes de vent de nouveau actives'); return; }
    if (!(typeof tracking !== 'undefined' && tracking)) { toast('Aucune trace en cours : les alertes restent actives'); return; }
    settings.windMuteTrack = true; saveSettings(); toast('Alertes de vent coupées jusqu’à la fin de la trace'); return;
  }
  if (b.dataset.walert === 'basis') { settings.windAlert = Object.assign(cfg, { basis: cfg.basis === 'gust' ? 'avg' : 'gust' }); saveSettings(); windLast = null; windCheck(); }
  if (b.dataset.walert === 'test') {
    // v420 (Corban) : « Test des alertes de vent », arrêtable à tout moment (bouton ou fenêtre).
    if (windTest) return windTestStop();
    let i = 0;
    windTest = { timer: 0 };
    windTestBtns();
    // 2026-11-04 (Corban) : chaque signal d'essai montre aussi l'état de la mer et la hauteur des vagues probables
    // (repères OMM de l'échelle de Beaufort, en haute mer ; les vraies valeurs viennent du modèle pendant la navigation).
    const WAVE_BFT = { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5.5, 9: 7, 10: 9, 11: 11.5, 12: 14 };
    // Chaque niveau : bips + flash, puis la bulle d'alerte ; un toucher sur la bulle passe au niveau suivant.
    const next = () => { if (!windTest) return; if (i > 8) return windTestStop(); const bf = i + 4, h = WAVE_BFT[bf], d = douglasOfH(h), row = BEAUFORT_TBL[bf], lv = i;
      playAlarm(lv); i++;
      windTest.timer = setTimeout(() => { if (windTest) windPopShow({ bf, kn: `${row[1]} nd`, where: 'essai', sea: (() => { const hm = Math.round(WAVE_OMM[bf] * 0.7 * 10) / 10, dm = douglasOfH(hm); return `modèle ici (exemple fictif) : mer ${dm} ${DOUGLAS[dm][1]}, vagues ${fr(hm)} m`; })(), omm: waveOmmTxt(bf), note: 'Essai : la valeur du modèle est inventée pour l’exemple. En navigation, elle vient du modèle de prévision à la position du bateau.', closeTxt: i > 8 ? 'Toucher pour fermer' : 'Toucher pour le niveau suivant', onStop: windTestStop }, next); }, WIND_POP_DELAY); };
    return next();
  }
  renderLakeButtons();
}
setTimeout(windWatchStart, 2000);

/* =====================================================================
   À BORD : tournus des tâches pour les croisières (mer et lac en croisière).
   Modèle de départ : plan des tâches journalières pour 8 équipiers fourni par Corban
   (2026-10-31) ; le modèle se modifie dans l'appli (ldb.taskTpl) et sert à toutes les croisières.
   Rotation : chaque jour, chacun avance d'une tâche (équipier n° (j - jour) modulo N).
   ===================================================================== */
const TASK_TPL_DEFAULT = {
  tasks: [
    { id: 'pdj', name: 'Petit déjeuner, vaisselle', n: 2 },
    { id: 'midi', name: 'Repas de midi, vaisselle', n: 2 },
    { id: 'soir', name: 'Repas du soir, vaisselle', n: 2 },
    { id: 'prop', name: 'Contrôle propreté', n: 1, desc: 'Rien d’inutile ne traîne dans le carré ni sur la table à carte. Cabines et WC tenus correctement ; faire les remarques nécessaires à l’équipage.' },
    { id: 'tech', name: 'Contrôle technique', n: 1, desc: 'Hublots, équipets, sécurité du gaz, ouverture et fermeture des vannes des WC.' },
  ],
  first: 'soir', last: 'pdj',
  end: 'Nettoyage du bateau : tout l’équipage',
  note: 'Pour les repas, les équipiers concernés (supervisés par le second ou le skipper) sont responsables du repas, de la vaisselle, de l’ordre et de la propreté de la cuisine et du carré. En fin de navigation, tout l’équipage participe au nettoyage du bateau.',
};
let taskTpl = store.get('ldb.taskTpl', null) || structuredClone(TASK_TPL_DEFAULT);
const saveTaskTpl = () => { taskTpl.at = new Date().toISOString(); store.set('ldb.taskTpl', taskTpl); };
const hasAboard = () => cruise && curMode() !== 'lacj';
const DOW_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
function aboardCrew() {
  const names = cruise.crew.map((m) => (m.nom || '').trim()).filter(Boolean);
  const n = names.length || cruise.taskN || 8;
  return Array.from({ length: n }, (_, i) => names[i] || `Équipier ${i + 1}`);
}
function aboardDays() {
  const i = cruise.info;
  let a = i.du ? keyToDate(i.du) : null, b = i.au ? keyToDate(i.au) : null;
  if (!a) a = keyToDate(dayKey(new Date(cruise.created || Date.now())));
  if (!b || b < a) b = new Date(a.getTime() + 7 * 86400000);
  const out = [];
  for (let d = new Date(a); d <= b && out.length < 60; d = new Date(d.getTime() + 86400000)) out.push(dayKey(d));
  return out;
}
// Les places de la journée : une par personne et par tâche, dans l'ordre du modèle.
const taskSlots = () => taskTpl.tasks.flatMap((t) => Array.from({ length: Math.max(1, Number(t.n) || 1) }, (_, k) => ({ task: t, k })));
function aboardPlan() {
  const crew = aboardCrew(), N = crew.length, days = aboardDays(), slots = taskSlots();
  const fi = Math.max(0, taskTpl.tasks.findIndex((t) => t.id === taskTpl.first));
  const li = taskTpl.tasks.findIndex((t) => t.id === taskTpl.last);
  const ov = cruise.taskOv || {};
  return days.map((k, d) => {
    const first = d === 0, last = d === days.length - 1 && days.length > 1;
    const rows = taskTpl.tasks.map((t, ti) => {
      const off = (first && ti < fi) || (last && (li < 0 || ti > li));
      const people = slots.map((s, j) => ({ s, j })).filter((x) => x.s.task === t).map(({ j }) => {
        const o = ov[k] && ov[k][j];
        return o != null && o < N ? o : (((j - d) % N) + N) % N;
      });
      return { t, off, people };
    });
    return { k, d, first, last, rows };
  });
}

VIEWS.aboard = function renderAboard(arg) {
  if (arg === 'edit') return renderTaskTplEdit();
  const main = $('#view');
  const crew = aboardCrew();
  const plan = aboardPlan();
  const today = dayKey(new Date());
  const doneAll = cruise.taskDone || {};
  const named = cruise.crew.filter((m) => (m.nom || '').trim()).length;
  const dayCard = (p, big) => {
    const date = keyToDate(p.k);
    const done = new Set(doneAll[p.k] || []);
    return `<section class="field aboard-day ${p.k === today ? 'today' : ''}" data-day="${p.k}">
      <h2>${DOW_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}${p.k === today ? ' · aujourd’hui' : ''}${p.first ? ' · arrivée' : p.last ? ' · départ' : ''}</h2>
      ${p.rows.filter((r) => !r.off).map((r) => `<div class="aboard-row ${done.has(r.t.id) ? 'ok' : ''}">
        <button class="btn aboard-done" data-done="${p.k}|${r.t.id}" aria-label="Fait">${done.has(r.t.id) ? '✔' : ''}</button>
        <div class="aboard-task"><b>${esc(r.t.name)}</b><span>${r.people.map((c, i) => `<button class="aboard-who" data-who="${p.k}|${r.t.id}|${i}">${c + 1}. ${esc(crew[c])}</button>`).join(' ')}</span></div></div>`).join('')}
      ${p.last && taskTpl.end ? `<p class="aboard-end">🧽 ${esc(taskTpl.end)}</p>` : ''}
    </section>`;
  };
  const cur = plan.find((p) => p.k === today);
  main.innerHTML = `
    <h1>À bord</h1>
    <section class="field"><h2>Personnes à bord</h2>
      ${named ? `<div class="value" style="font-size:40px">${crew.length}</div><p class="help">D’après la liste d’équipage (${named} nom${named > 1 ? 's' : ''}).</p>`
        : `<div class="row c3"><button class="btn step" data-n="-1">−1</button><div class="value" style="font-size:40px">${crew.length}</div><button class="btn step" data-n="1">+1</button></div><p class="help">Ajoutez l’équipage pour voir les prénoms.</p>`}
      <div class="row"><button class="btn" data-go="crew">👥 Équipage</button></div></section>
    ${cur ? dayCard(cur, true) : '<p class="help">La croisière n’a pas commencé ou est terminée : voir le plan complet ci-dessous.</p>'}
    <details class="section" ${cur ? '' : 'open'}><summary>Plan complet (${plan.length} jours)</summary><div class="aboard-all">${plan.filter((p) => p !== cur).map((p) => dayCard(p)).join('')}</div></details>
    <details class="section"><summary>Équipiers</summary><ol class="aboard-crew">${crew.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></details>
    ${taskTpl.tasks.some((t) => t.desc) || taskTpl.note ? `<details class="section"><summary>Rôles</summary><div class="aboard-roles">${taskTpl.tasks.filter((t) => t.desc).map((t) => `<p><b>${esc(t.name)}</b> : ${esc(t.desc)}</p>`).join('')}${taskTpl.note ? `<p>${esc(taskTpl.note)}</p>` : ''}</div></details>` : ''}
    <p class="help">Chaque jour, chacun avance d’une tâche. Touchez un nom pour le remplacer ce jour-là, la case à gauche quand la tâche est faite.</p>
    <div class="row c2"><button class="btn" data-edit="1">✎ Modifier le modèle</button><button class="btn" data-reset="1" ${Object.keys(cruise.taskOv || {}).length ? '' : 'disabled'}>↺ Effacer les échanges</button></div>`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.edit) return renderTaskTplEdit();
    if (b.dataset.n) { cruise.taskN = Math.max(1, Math.min(20, crew.length + Number(b.dataset.n))); saveCruise(); return VIEWS.aboard(); }
    if (b.dataset.reset) return armed(b, 'Sûr ?', () => { delete cruise.taskOv; saveCruise(); VIEWS.aboard(); });
    if (b.dataset.done) {
      const [k, id] = b.dataset.done.split('|');
      cruise.taskDone = cruise.taskDone || {};
      const s = new Set(cruise.taskDone[k] || []);
      if (s.has(id)) s.delete(id); else s.add(id);
      cruise.taskDone[k] = [...s]; saveCruise(); return VIEWS.aboard();
    }
    if (b.dataset.who) {
      const [k, id, i] = b.dataset.who.split('|');
      const slots = taskSlots();
      const j = slots.map((s, jj) => ({ s, jj })).filter((x) => x.s.task.id === id)[Number(i)].jj;
      return pickCrew(crew, (c) => { cruise.taskOv = cruise.taskOv || {}; cruise.taskOv[k] = cruise.taskOv[k] || {}; cruise.taskOv[k][j] = c; saveCruise(); VIEWS.aboard(); }, () => VIEWS.aboard());
    }
  };
};
function pickCrew(crew, pick, back) {
  const main = $('#view');
  main.innerHTML = `<button class="btn" id="pcBack">◀ Retour</button><h1>Qui fait cette tâche ?</h1>
    <div class="checks">${crew.map((c, i) => `<button class="btn" data-c="${i}">${i + 1}. ${esc(c)}</button>`).join('')}</div>`;
  main.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; buzz(); if (b.id === 'pcBack') return back(); pick(Number(b.dataset.c)); };
}
function renderTaskTplEdit() {
  const main = $('#view');
  const T = taskTpl.tasks;
  const again = () => renderTaskTplEdit();
  const opts = (sel) => T.map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  main.innerHTML = `
    <button class="btn" id="ttBack">◀ À bord</button>
    <h1>Modèle du tournus</h1>
    <p class="help">Sert à toutes les croisières. Enregistrement automatique.</p>
    <div class="ck-edit">${T.map((t, i) => `<div class="ck-row tt-row">
      <input class="text" data-tname="${i}" value="${esc(t.name)}" aria-label="Tâche ${i + 1}">
      <label class="ck-unit">Personnes <select data-tn="${i}">${[1, 2, 3, 4].map((n) => `<option ${Number(t.n) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <textarea class="text" rows="2" data-tdesc="${i}" placeholder="Rôle, consignes (facultatif)">${esc(t.desc || '')}</textarea>
      <div class="ck-tools"><button class="btn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Monter">▲</button><button class="btn danger" data-del="${i}" aria-label="Supprimer">✕</button></div>
    </div>`).join('')}</div>
    <section class="field"><h2>Nouvelle tâche</h2>
      <input class="text" id="ttNew" placeholder="ex. Quart de nuit, Avitaillement" autocomplete="off">
      <div class="row"><button class="btn big primary" id="ttAdd">＋ Ajouter cette tâche</button></div></section>
    <section class="field"><h2>Premier et dernier jour</h2>
      <label class="cf wide"><span>Le jour de l’arrivée, on commence par</span><select class="text" id="ttFirst">${opts(taskTpl.first)}</select></label>
      <label class="cf wide"><span>Le jour du départ, on finit par</span><select class="text" id="ttLast">${opts(taskTpl.last)}</select></label>
      <label class="cf wide"><span>Dernier jour, pour tout l’équipage</span><input class="text" id="ttEnd" value="${esc(taskTpl.end || '')}"></label></section>
    <section class="field"><h2>Consignes générales</h2><textarea class="text" id="ttNote" rows="4">${esc(taskTpl.note || '')}</textarea></section>
    <div class="row c2"><button class="btn big" id="ttDone">✔ Terminé</button><button class="btn" id="ttDefault">↺ Revenir au modèle d’origine</button></div>`;
  main.oninput = (e) => {
    const t = e.target, d = t.dataset;
    if (d.tname != null) { const v = t.value.trim(); if (v) { T[Number(d.tname)].name = v; saveTaskTpl(); } }
    else if (d.tdesc != null) { T[Number(d.tdesc)].desc = t.value.trim(); saveTaskTpl(); }
    else if (d.tn != null) { T[Number(d.tn)].n = Number(t.value); saveTaskTpl(); }
    else if (t.id === 'ttFirst') { taskTpl.first = t.value; saveTaskTpl(); }
    else if (t.id === 'ttLast') { taskTpl.last = t.value; saveTaskTpl(); }
    else if (t.id === 'ttEnd') { taskTpl.end = t.value.trim(); saveTaskTpl(); }
    else if (t.id === 'ttNote') { taskTpl.note = t.value.trim(); saveTaskTpl(); }
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'ttBack' || b.id === 'ttDone') { main.oninput = null; return cruise ? VIEWS.aboard() : go('more'); }
    if (b.id === 'ttAdd') { const v = $('#ttNew').value.trim(); if (!v) { toast('Écrivez la tâche'); return $('#ttNew').focus(); } T.push({ id: uid(), name: v, n: 1 }); saveTaskTpl(); toast('Tâche ajoutée'); return again(); }
    if (b.dataset.up) { const i = Number(b.dataset.up); [T[i - 1], T[i]] = [T[i], T[i - 1]]; saveTaskTpl(); return again(); }
    if (b.dataset.del) return armed(b, 'Sûr ?', () => { T.splice(Number(b.dataset.del), 1); saveTaskTpl(); again(); });
    if (b.id === 'ttDefault') return armed(b, 'Toucher encore : modèle d’origine', () => { taskTpl = structuredClone(TASK_TPL_DEFAULT); saveTaskTpl(); again(); });
  };
}

// Modèle des tâches à bord, modifiable même sans navigation ouverte.
VIEWS.tasktpl = function renderTaskTplView() { return renderTaskTplEdit(); };

/* ---------- Liste d'équipage à envoyer : image (WhatsApp) ou PDF A4, toujours sur le modèle de Corban ---------- */
// Colonnes dans l'ordre de son modèle Word de liste d'équipage.
const CREW_LIST_COLS = [['fonction', 'Fonction à bord'], ['nom', 'Prénom nom'], ['piece', 'Passeport / carte ID'], ['permis', 'Permis n°'], ['tel', 'Téléphone'],
  ['naissance', 'Date de naissance'], ['expiration', 'Date d’expiration'], ['emisPar', 'Établi par'], ['email', 'Courriel'], ['lieu', 'Lieu de naissance / d’origine'],
  ['adresse', 'Adresse postale'], ['nationalite', 'Nationalité'], ['vhf', 'Licence VHF n°'], ['proche', 'Proche à contacter'], ['sante', 'Santé, allergies']];
function crewListHead() {
  const i = cruise.info || {};
  const boat = isLake() && typeof boatById === 'function' && boatById(cruise.boatId) ? (boatById(cruise.boatId).info || {}).boat || i.boat || '' : (i.boat || '');
  const dates = isLake() ? fmtShortDate(new Date(cruise.created)) : [i.du, i.au].filter(Boolean).map((d) => fmtShortDate(keyToDate(d))).join(' → ');
  return { title: `Liste d’équipage · ${i.name || ''}`.trim(), boat, dates, n: cruise.crew.length };
}
// Infos choisies pour la liste (Corban, 2026-10-31) : réglage gardé sur le téléphone, le nom est toujours inclus.
const crewListCols = () => { const sel = settings.crewCols; return CREW_LIST_COLS.filter(([k]) => k === 'nom' || !Array.isArray(sel) || sel.includes(k)); };
const crewRole = (c) => roleLabel(c.fonction, c.sexe) || '';
async function crewListPng() {
  const h = crewListHead();
  const sd = {
    title: h.title, showObs: false, checks: [],
    sections: [
      { title: 'Navigation', rows: [['Bateau', h.boat || '–'], ['Dates', h.dates || '–'], ['Personnes à bord', String(h.n)]] },
      ...cruise.crew.map((c, x) => ({
        title: `${x + 1}. ${c.nom || '…'}${crewRole(c) && crewListCols().some(([k]) => k === 'fonction') ? ` · ${crewRole(c)}` : ''}`,
        rows: crewListCols().filter(([k]) => k !== 'fonction' && k !== 'nom' && c[k]).map(([k, l]) => [l, c[k]]),
      })),
    ],
  };
  return sheetPng(sd);
}
function printCrewList() {
  const h = crewListHead();
  const holder = document.createElement('div');
  holder.className = 'print-only book crew-print';
  holder.innerHTML = `<section class="pg">
    <h1>${esc(h.title)}</h1>
    <p><b>Bateau :</b> ${esc(h.boat || '–')} · <b>Dates :</b> ${esc(h.dates || '–')} · <b>Personnes à bord :</b> ${h.n}</p>
    <table class="crew-tbl"><thead><tr><th>n°</th>${crewListCols().map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${cruise.crew.map((c, x) => `<tr><td>${x + 1}</td>${crewListCols().map(([k]) => `<td>${esc(k === 'fonction' ? crewRole(c) : c[k] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="crew-foot">Établie le ${esc(fmtShortDate(new Date()))}${cruise.crew.find((c) => c.fonction === 'Skipper') ? ` · Skipper : ${esc(cruise.crew.find((c) => c.fonction === 'Skipper').nom || '')}` : ''} · Signature : ____________________</p>
  </section>`;
  document.body.appendChild(holder);
  const style = document.createElement('style');
  style.textContent = '@media print { main { display:none } @page { size: A4 landscape; margin: 8mm } }';
  document.head.appendChild(style);
  const oldTitle = document.title;
  document.title = fileName('-equipage', 'pdf').replace(/\.pdf$/, '');
  const cleanup = () => { holder.remove(); style.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 50);
}
async function shareCrewList(btn) {
  if (!cruise.crew.length) return toast('Personne à bord pour l’instant');
  btn.disabled = true;
  try { const blob = await crewListPng(); await deliver(blob, fileName('-equipage', 'png'), 'image/png'); } catch { toast('Image impossible : faites une capture d’écran'); }
  btn.disabled = false;
}

/* =====================================================================
   RECUEIL DES BATEAUX (Corban, 2026-10-31)
   Une fiche par bateau : toutes les informations utiles et les photos des documents
   (permis de navigation, carte grise, assurance, fiche bateau…). Photos dans le téléphone (IndexedDB),
   liste dans b.docs ; incluses dans la sauvegarde complète.
   ===================================================================== */
const BOAT_DOC_KINDS = [['permis', '🪪 Permis de navigation'], ['titre', '📄 Carte grise / titre de navigation'], ['assurance', '🛡 Assurance'], ['fiche', '⛵ Fiche bateau / certificat'], ['autre', '📎 Autre document']];
const docKindLabel = (k) => (BOAT_DOC_KINDS.find((x) => x[0] === k) || ['', '📎 Document'])[1];
let dossierBoat = null;
// Bateaux des croisières en mer pas encore dans le recueil (repris de « Bateau et croisière »).
function seaBoatsNotKept() {
  const seen = new Set(boats.map((b) => (b.info.boat || '').trim().toLowerCase()));
  const out = [];
  for (const m of index) {
    if (m.type === 'lac') continue;
    const c = store.get('ldb.cruise.' + m.id, null);
    const name = c && c.info && (c.info.boat || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, cruiseId: m.id, cruiseName: c.info.name || '' });
  }
  return out;
}
function boatInfoRows(b) {
  const out = [];
  for (const sec of boatSections(b)) {
    if (sec.title === 'Numéros utiles (page SOS)') continue; // v245 (Corban) : pas dans Mes bateaux, donc ni à l'impression ni à l'envoi
    const val = (f) => (b.info[f.key] != null && b.info[f.key] !== '' ? b.info[f.key] : autoVal(f, b.info));
    const grpLab = {}; sec.fields.filter((g) => g.type === 'group').forEach((g) => g.fields.forEach((sf) => { if (!sf.label) grpLab[sf.key] = g.label; })); // v255 (Corban) : « Énergie de propulsion » devant Gasoil / Électrique
    const rows = flatFields(sec.fields).filter((f) => f.type !== 'group' && (!f.when || f.when === (b.info.propType || 'Gasoil'))).filter((f) => val(f) != null && val(f) !== '' && !['signature', 'check', 'tides', 'calc'].includes(f.type))
      .map((f) => [f.key === 'contacts' ? 'Numéros' : (f.label || grpLab[f.key] || f.key), Array.isArray(val(f)) ? val(f).join(', ') : (f.prefix ? f.prefix + ' ' : '') + String(f.show && f.show[val(f)] && !/[<>]/.test(f.show[val(f)]) ? f.show[val(f)] : val(f)) + (f.unit && f.type === 'num' && /^[\d.,\s-]+$/.test(String(val(f))) ? ' ' + f.unit : '')]);
    if (rows.length) out.push({ title: sec.title, rows });
  }
  return out;
}
VIEWS.dossier = function renderDossier(id) {
  if (id !== undefined) dossierBoat = id;
  if (dossierBoat && boatById(dossierBoat)) return renderBoatDossier(boatById(dossierBoat));
  dossierBoat = null;
  const main = $('#view');
  const sea = seaBoatsNotKept();
  main.innerHTML = `
    <h1>Recueil des bateaux</h1>
    <p class="help">Une fiche par bateau avec toutes ses informations et les photos de ses documents. Gardé sur ce téléphone et dans la sauvegarde.</p>
    <div class="checks">${boatsByNav().map((b) => `<button class="btn big" data-dos="${b.id}">🚤 ${esc(b.info.boat || 'Bateau sans nom')}<small>${esc([boatSub(b.info), b.info.reg].filter(Boolean).join(' · '))}${(b.docs || []).length ? ` · ${(b.docs || []).length} document${(b.docs || []).length > 1 ? 's' : ''}` : ''}</small></button>`).join('')}</div>
    ${sea.length ? `<h2 class="sub-h">Bateaux de mes croisières en mer</h2>${sea.map((x) => `<div class="row"><button class="btn" data-keep="${x.cruiseId}">＋ Ajouter ${esc(x.name)} au recueil<small>${esc(x.cruiseName)}</small></button></div>`).join('')}` : ''}
    <div class="row" style="margin-top:12px"><button class="btn big primary" id="dosAdd">＋ Nouveau bateau</button></div>`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.dos) return VIEWS.dossier(b.dataset.dos);
    if (b.dataset.keep) {
      const c = store.get('ldb.cruise.' + b.dataset.keep, null);
      const info = { contacts: (c.info && c.info.contacts) || '' };
      for (const k of BOAT_KEYS) if (c.info[k] != null && c.info[k] !== '') info[k] = structuredClone(c.info[k]);
      const nb = { id: uid(), sea: true, info, checklist: [], checklistDep: [], checklistX: [], checklistDepX: [] };
      boats.push(nb); saveBoats(); toast(`${info.boat} ajouté au recueil`);
      return VIEWS.dossier(nb.id);
    }
    if (b.id === 'dosAdd') {
      const nb = { id: uid(), info: { contacts: LAKE_CONTACTS }, checklist: [], checklistDep: [], checklistX: [], checklistDepX: [] };
      boats.push(nb); saveBoats();
      return go('boats', nb.id);
    }
  };
};
function renderBoatDossier(b) {
  const main = $('#view');
  b.docs = b.docs || [];
  main.innerHTML = `
    <button class="btn" id="dosBack">◀ Mes bateaux</button>
    <h1>🚤 ${esc(b.info.boat || 'Bateau sans nom')}<button type="button" class="btn ck-editbtn no-navact" id="dosFields" aria-label="Modifier les libellés">✎</button></h1>
    <p class="help">Touchez une case pour saisir ou corriger : enregistrement automatique. « ＋ Ajouter un libellé », en bas, ajoute une case où vous voulez dans la fiche.</p>
    <div id="dosForm"></div>

    ${boatVersBtn(b)}
    <section class="field"><h2>Documents (photos)</h2>
      ${BOAT_DOC_KINDS.map(([k, l]) => { const list = b.docs.filter((d) => d.kind === k && !d.pdf); return `<h3 class="sub-h">${l}</h3>
        ${list.length ? `<div class="photo-strip">${list.map((d) => `<figure class="photo"><img data-photo="${d.id}" data-cap="${esc(b.info.boat || '')} · ${esc(docKindLabel(k).replace(/^\S+ /, ''))}" alt="${esc(l)}"><figcaption>${esc(fmtShortDate(new Date(d.t)))}</figcaption><button class="btn danger photo-del" data-ddel="${d.id}" aria-label="Supprimer">✕</button></figure>`).join('')}</div>` : ''}
        <div class="row"><button class="btn" data-dadd="${k}">📷 + photo<small>photothèque, fichier, appareil photo ou PDF</small></button></div>`; }).join('')}
    </section>
    <h2 class="sub-h">Envoyer la fiche</h2>
    <div class="row ck-pub-row"><button class="btn big ck-pub" id="dosPub">📤 Publier<small>fiche et documents, image ou PDF</small></button></div>`;
  fillPhotos(main);
  // Fiche modifiable sur place (Corban, v128) : mêmes cases que « Mes bateaux », seulement les rubriques affichées.
  compactForm($('#dosForm', main), boatSections(b), b.info, () => {
    saveBoats(); syncCruiseFromBoat(b);
    const h = $('h1', main); if (h && h.firstChild) h.firstChild.textContent = `🚤 ${b.info.boat || 'Bateau sans nom'}`;
  });
  main.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t || t.closest('#dosForm')) return;
    if (t.closest('.photo-strip') && !t.dataset.ddel) return;
    buzz();
    if (t.id === 'dosBack') { dossierBoat = null; return go('boats', b.id); }
    if (t.id === 'dosFields') return renderBoatFields(b.id, () => renderBoatDossier(b));
    if (t.dataset.vers) return renderBoatVersions(b, () => renderBoatDossier(b));
    if (t.dataset.dadd) return addBoatDoc(b, t.dataset.dadd);
    if (t.dataset.ddel) return armed(t, '✕ ?', () => { b.docs = b.docs.filter((d) => d.id !== t.dataset.ddel); saveBoats(); delPhoto(t.dataset.ddel); renderBoatDossier(b); });
    if (t.id === 'dosPub') return pubModal(b.info.boat || 'Bateau', `<div class="row c2"><button type="button" class="btn big" data-dp="img">📸 Image<small>écran, WhatsApp…</small></button><button type="button" class="btn big" data-dp="pdf">🖨 PDF<small>A4, avec les documents</small></button></div>`, (x, o) => { if (x.dataset.dp === 'img') return shareBoatDossier(b, x); if (x.dataset.dp === 'pdf') { o.remove(); return printBoatDossier(b); } });
    if (t.id === 'dosImg') return shareBoatDossier(b, t);
    if (t.id === 'dosPdf') return printBoatDossier(b);
  };
}
function addBoatDoc(b, kind, done) {
  const inp = document.createElement('input');
  // v226 (Corban) : photos ET scans de documents (PDF du scanner du téléphone), gardés dans l'appli (base interne de l'appareil) et dans la sauvegarde complète.
  inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = true;
  inp.onchange = async () => {
    let n = 0;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    for (const f of inp.files) {
      try {
        const id = uid(), pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
        const data = pdf ? await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(f); }) : await shrinkPhoto(f);
        await putPhoto(id, data);
        if (!(await getPhoto(id))) throw new Error('not saved');
        b.docs.push(Object.assign({ id, kind, t: new Date().toISOString() }, pdf ? { pdf: true, cap: (f.name || '').replace(/\.pdf$/i, '') || undefined } : {})); n++;
      } catch { toast('Fichier impossible à enregistrer'); }
    }
    if (!n) return;
    saveBoats(); toast(n > 1 ? `✓ ${n} documents enregistrés dans l’appli` : '✓ Enregistré dans l’appli · écrivez son libellé');
    if (done) done(); else renderBoatDossier(b);
  };
  inp.click();
}
async function shareBoatDossier(b, btn) {
  btn.disabled = true;
  try {
    // v260 : même mise en page que « Imprimer ou envoyer » (choix 1, 2 ou 3 du modèle de Mes bateaux).
    const photos = []; for (const d of (b.docs || []).filter((x) => !x.pdf)) { const url = await getPhoto(d.id); if (url) photos.push({ url, cap: d.cap || docKindLabel(d.kind).replace(/^\S+ /, '') }); }
    const blob = await cardsPng({ title: b.info.boat || 'Bateau', kicker: 'Fiche bateau', sub: `Fiche bateau · ${fmtShortDate(new Date())}`, theme: window.lxTheme ? window.lxTheme('boats') : 'cards',
      sections: boatInfoRows(b).map((sc) => ({ title: sc.title, rows: sc.rows.filter(([l]) => l !== 'Nom du bateau') })), photosTitle: 'Documents', photos });
    await deliver(blob, `fiche-bateau-${(b.info.boat || 'bateau').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, 'image/png');
  } catch { toast('Image impossible : faites une capture d’écran'); }
  btn.disabled = false;
}
async function printBoatDossier(b) {
  const imgs = [];
  for (const d of (b.docs || []).filter((x) => !x.pdf)) { const url = await getPhoto(d.id); if (url) imgs.push({ d, url }); }
  const holder = document.createElement('div');
  holder.className = 'print-only book dos-print';
  holder.innerHTML = `<section class="pg">
    <h1>Fiche bateau · ${esc(b.info.boat || '')}</h1>
    ${boatInfoRows(b).map((sec) => `<h2>${esc(sec.title)}</h2><table class="dos-tbl">${sec.rows.map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}</table>`).join('')}
    <p class="crew-foot">Établie le ${esc(fmtShortDate(new Date()))}</p>
  </section>
  ${imgs.length ? `<section class="pg"><h1>Documents · ${esc(b.info.boat || '')}</h1><div class="dos-docs">${imgs.map(({ d, url }) => `<figure><img src="${url}" alt=""><figcaption>${esc(d.cap || docKindLabel(d.kind).replace(/^\S+ /, ''))}</figcaption></figure>`).join('')}</div></section>` : ''}`;
  document.body.appendChild(holder);
  const style = document.createElement('style');
  style.textContent = '@media print { main { display:none } @page { size: A4 portrait; margin: 10mm } }';
  document.head.appendChild(style);
  const oldTitle = document.title;
  document.title = `fiche-bateau-${(b.info.boat || 'bateau').replace(/\s+/g, '-')}`;
  const cleanup = () => { holder.remove(); style.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 150);
}
// Sauvegarde complète : les photos des documents voyagent avec les bateaux.
async function boatDocPhotos() {
  const out = [];
  for (const b of boats) for (const d of b.docs || []) { const url = await getPhoto(d.id); if (url) out.push({ id: d.id, url }); }
  // v393 : photos des fiches coéquipiers·ères
  if (typeof members !== 'undefined') for (const m of members) for (const p of m.photos || []) { const url = await getPhoto(p.id); if (url) out.push({ id: p.id, url }); }
  // v224 : photos de groupe des équipages
  if (typeof crewSets !== 'undefined') for (const x of crewSets) if (x.photo) { const url = await getPhoto(x.photo); if (url) out.push({ id: x.photo, url }); }
  return out;
}

/* ---------- Rapport PréP + check-in (v377, v388 Corban) ----------
   Bouton « Publier » en fin de check-in, et page « PréP et check-in » dans data › PDF / impression.
   Trois mises en page (les mêmes que les listes : Cartes NavIn, Carnet marin, Minimaliste), en image (écran, WhatsApp)
   ou en PDF A4, avec ou sans les photos. Choix gardés dans settings.repTheme / settings.repPh. */
const repTheme = () => (settings.repTheme && ['cards', 'carnet', 'mini'].includes(settings.repTheme) ? settings.repTheme : 'cards');
const repPh = () => settings.repPh !== false;
async function prepReportDoc(withPh) {
  if (!cruise) return null;
  const h = crewListHead(), lake = isLake();
  const kDay = curMode() === 'lacj' ? dayKey(new Date()) : null;
  const sortie = (typeof prep !== 'undefined' && prep && prep.purpose) || cruise.purpose || (kDay && (cruise.days[kDay] || {}).typeSortie) || '';
  const items = checkItems('dep'), done = checkDone(), open = ckOpen();
  const obsTxt = (obsOwner() || {})[constatKey('dep')] || '';
  const nDone = items.filter((x) => done.has(x.id)).length;
  // v390 (Corban) : chaque photo va juste sous son point (toutes les photos du point), celles des observations sous les observations.
  const phOf = {};
  if (withPh) {
    const list = photosFor('dep', kDay);
    const urls = await Promise.all(list.map((p) => Promise.resolve().then(() => getPhoto(p.id)).catch(() => null)));
    list.forEach((p, i) => { if (urls[i]) (phOf[p.item || '§obs'] = phOf[p.item || '§obs'] || []).push({ url: urls[i], cap: '' }); });
  }
  const sections = [
    { title: 'Sortie', rows: [['Sortie', [lake ? 'Lac' : 'Mer', sortie].filter(Boolean).join(' · ') || '–'], ['Bateau', h.boat || '–'], ['Date', h.dates || fmtShortDate(new Date())]] },
    { title: `Équipage · ${cruise.crew.length}`, rows: cruise.crew.length ? cruise.crew.map((c) => [crewRole(c) || 'Équipier', c.nom || '…']) : [['', '–']] },
    { title: `Check-in · ${nDone}/${items.length}`, rows: items.map((x) => [done.has(x.id) ? '✔ fait' : open.has(x.id) ? '✕ pas fait' : '☐ à faire', ckLabelVal(x) + (x.note ? `\n${x.note}` : ''), phOf[x.id] || []]) },
  ];
  if (obsTxt || phOf['§obs']) sections.push({ title: 'Observations', rows: [['', obsTxt || '–', phOf['§obs'] || []]] });
  const photos = [];
  return { title: `PréP · ${cruise.info.name || ''}`.trim(), kicker: 'PréP + check-in', sub: `${h.boat || ''} · ${fmtShortDate(new Date())}`, sections, photos };
}
// HTML A4 (même gabarit que l'impression des listes : .lx-doc + .lx-th-<thème>).
function prepDocHtml(D, th) {
  return `<section class="pg lx-doc prep-print lx-th-${th}"><header class="lx-hd"><div class="lx-k">⛵ NAVIN · ${esc(D.kicker)}</div><h1>${esc(D.title)}</h1><p>${esc(D.sub)}</p></header>
    ${D.sections.map((sc) => `<section class="lx-card"><h2>${esc(sc.title)}</h2><div class="lx-rows">${sc.rows.map(([l, v, ps]) => `<div class="lx-r"><b>${esc(l)}</b><span>${esc(v).replace(/\n/g, '<br>')}${ps && ps.length ? `<span class="prep-rph">${ps.map((p) => `<img src="${p.url}" alt="">`).join('')}</span>` : ''}</span></div>`).join('')}</div></section>`).join('')}
    ${D.photos.length ? `<section class="lx-card lx-phs"><h2>Photos</h2>${D.photos.map((p) => `<figure class="lx-ph"><img src="${p.url}" alt=""><figcaption>${esc(p.cap)}</figcaption></figure>`).join('')}</section>` : ''}
    <footer class="lx-ft">NavIn · ${esc(fmtShortDate(new Date()))}</footer></section>`;
}
async function prepReportHtml(th, withPh) {
  th = th || repTheme(); withPh = withPh == null ? repPh() : withPh;
  const D = await prepReportDoc(withPh); if (!D) return '';
  return `<div class="lx-th-${th}">${prepDocHtml(D, th)}</div>`;
}
// Préparé à l'avance (photos lues en arrière-plan) pour que l'impression parte directement du toucher (iPhone).
function prepReportCache() { const k = repTheme() + (repPh() ? '+' : '-'); prepReportHtml().then((h) => { window._prepHtml = h; window._prepHtmlKey = k; }).catch(() => {}); }
async function prepReportPng(th, withPh) {
  const D = await prepReportDoc(withPh == null ? repPh() : withPh); if (!D) throw new Error('no cruise');
  return cardsPng(Object.assign(D, { theme: th || repTheme() }));
}
async function prepReportShare(btn) {
  if (!cruise) return toast('Choisissez d’abord le bateau');
  if (btn) btn.disabled = true;
  toast('Préparation de l’image…');
  try { await deliver(await prepReportPng(), fileName('-prep', 'png'), 'image/png'); } catch { toast('Image impossible : faites une capture d’écran'); }
  if (btn) btn.disabled = false;
}
async function prepReportPrint() {
  if (!cruise) return toast('Choisissez d’abord le bateau');
  document.querySelectorAll('.lx-print').forEach((x) => x.remove());
  const holder = document.createElement('div');
  holder.className = 'print-only book lx-print';
  const key = repTheme() + (repPh() ? '+' : '-');
  holder.innerHTML = (window._prepHtmlKey === key && window._prepHtml) || await prepReportHtml();
  document.body.appendChild(holder);
  const style = document.createElement('style');
  style.textContent = '@media print { main { display:none } @page { size: A4 portrait; margin: 10mm } }';
  document.head.appendChild(style);
  const oldTitle = document.title;
  document.title = fileName('-prep', 'pdf').replace(/\.pdf$/, '');
  const cleanup = () => { holder.remove(); style.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 80);
}
// Fenêtre « Publier » : mise en page (3), photos oui/non, puis Image ou PDF.
function prepPublishDialog() {
  if (!cruise) return toast('Choisissez d’abord le bateau');
  const ov = document.createElement('div'); ov.className = 'ck-ask';
  const draw = () => {
    const th = repTheme(), ph = repPh();
    ov.innerHTML = `<div class="ck-ask-box pub-box"><p>Publier le rapport PréP + check-in</p>
      <p class="help pub-h">Mise en page</p>
      <div class="pub-themes">${LX_THEMES.map(([id, l]) => `<button type="button" class="btn ${th === id ? 'on' : ''}" data-pubth="${id}">${esc(l)}</button>`).join('')}</div>
      <button type="button" class="btn check ${ph ? 'on' : ''}" data-pubph="1"><span class="box">${ph ? '✔' : ''}</span>Inclure les photos</button>
      <div class="row c2"><button type="button" class="btn big" data-pubimg="1">📸 Image<small>écran, WhatsApp…</small></button><button type="button" class="btn big" data-pubpdf="1">🖨 PDF<small>A4, imprimante</small></button></div>
      <button type="button" class="btn" data-pubno="1">Annuler</button></div>`;
  };
  draw(); document.body.appendChild(ov);
  ov.onclick = (ev) => {
    const c = ev.target.closest('button'); if (!c) { if (ev.target === ov) ov.remove(); return; }
    buzz();
    if (c.dataset.pubth) { settings.repTheme = c.dataset.pubth; saveSettings(); prepReportCache(); return draw(); }
    if (c.dataset.pubph) { settings.repPh = !repPh(); saveSettings(); prepReportCache(); return draw(); }
    ov.remove();
    if (c.dataset.pubimg) prepReportShare(); else if (c.dataset.pubpdf) prepReportPrint();
  };
}
window.prepReportCache = prepReportCache; window.prepReportShare = prepReportShare; window.prepReportPrint = prepReportPrint; window.prepReportHtml = prepReportHtml; window.prepPublishDialog = prepPublishDialog;

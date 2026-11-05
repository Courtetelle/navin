'use strict';

/* =====================================================================
   Livre de bord — tout fonctionne dans le téléphone, sans serveur.
   Les rubriques sont décrites dans les listes ci-dessous : les modifier
   suffit pour changer les formulaires, le journal et les exports.
   Le suivi GPS automatique et l'import GPX sont dans auto.js.
   ===================================================================== */

/* ---------- Listes de choix ---------- */
const DIRS8 = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
const DOUGLAS = [
  ['0', 'calme', '0 m'], ['1', 'ridée', '0 à 0,1 m'], ['2', 'belle', '0,1 à 0,5 m'], ['3', 'peu agitée', '0,5 à 1,25 m'], ['4', 'agitée', '1,25 à 2,5 m'],
  ['5', 'forte', '2,5 à 4 m'], ['6', 'très forte', '4 à 6 m'], ['7', 'grosse', '6 à 9 m'], ['8', 'très grosse', '9 à 14 m'], ['9', 'énorme', 'plus de 14 m'],
]; // v235 (Corban) : échelle de Douglas (OMM), hauteur des vagues significatives en 3e colonne
// v235 (Corban) : data › Listes : échelles de Beaufort et de Douglas, en français ou en anglais.
const DOUGLAS_EN = ['Calm (glassy)', 'Calm (rippled)', 'Smooth (wavelets)', 'Slight', 'Moderate', 'Rough', 'Very rough', 'High', 'Very high', 'Phenomenal'];
const BEAUFORT_TBL = [
  // [force, nœuds, nom FR, nom EN, mer FR, mer EN]
  [0, '< 1', 'Calme', 'Calm', 'Mer comme un miroir', 'Sea like a mirror'],
  [1, '1 à 3', 'Très légère brise', 'Light air', 'Quelques rides, sans écume', 'Ripples without crests'],
  [2, '4 à 6', 'Légère brise', 'Light breeze', 'Vaguelettes qui ne déferlent pas', 'Small wavelets, crests do not break'],
  [3, '7 à 10', 'Petite brise', 'Gentle breeze', 'Très petites vagues, quelques moutons', 'Large wavelets, scattered white horses'],
  [4, '11 à 16', 'Jolie brise', 'Moderate breeze', 'Petites vagues, moutons nombreux', 'Small waves, frequent white horses'],
  [5, '17 à 21', 'Bonne brise', 'Fresh breeze', 'Vagues modérées et allongées, moutons partout', 'Moderate longer waves, many white horses'],
  [6, '22 à 27', 'Vent frais', 'Strong breeze', 'Lames, crêtes d’écume blanche étendues', 'Large waves, extensive white foam crests'],
  [7, '28 à 33', 'Grand frais', 'Near gale', 'La mer grossit, l’écume s’étire en traînées', 'Sea heaps up, foam blown in streaks'],
  [8, '34 à 40', 'Coup de vent', 'Gale', 'Lames assez hautes, crêtes en tourbillons d’embruns', 'Moderately high waves, crests break into spindrift'],
  [9, '41 à 47', 'Fort coup de vent', 'Strong gale', 'Grosses lames, épaisses traînées d’écume, embruns gênant la visibilité', 'High waves, dense foam streaks, spray affects visibility'],
  [10, '48 à 55', 'Tempête', 'Storm', 'Très grosses lames déferlantes, mer blanche', 'Very high waves with overhanging crests, sea looks white'],
  [11, '56 à 63', 'Violente tempête', 'Violent storm', 'Lames exceptionnellement hautes', 'Exceptionally high waves'],
  [12, '≥ 64', 'Ouragan', 'Hurricane force', 'Air plein d’écume et d’embruns, mer entièrement blanche', 'Air filled with foam and spray, sea completely white'],
];
const VISI = [['E', 'excellente'], ['TB', 'très bonne'], ['B', 'bonne'], ['M', 'moyenne'], ['F', 'faible'], ['TF', 'très faible']];
const TREND = [['↗', 'hausse'], ['→', 'stable'], ['↘', 'baisse']];
// Feux d'avis de tempête des lacs suisses.
const STORM_LIGHTS = [['Éteints'], ['Prudence', 'feu orange, 40 éclats / min'], ['Tempête', 'feu orange, 90 éclats / min']];
const ALLURES = ['Près serré', 'Près', 'Bon plein', 'Travers', 'Largue', 'Grand largue', 'Vent arrière'];

/* ---------- Saisie au fil de l'eau (tableau horaire du journal) ---------- */
const deg = (key, label) => ({ key, label, type: 'number', unit: '°', rose: true, steps: [-10, -1, 1, 10], min: 0, max: 359, wrap: true, decimals: 0, start: 0, pad: 3 });
const FIELDS = [
  { key: 't', label: 'Heure', type: 'datetime' },
  { key: 'quart', label: 'Chef de quart', type: 'crew' },
  { key: 'loch', label: 'Loch', type: 'number', unit: 'NM', steps: [-0.1, 0.1, 1, 10], min: 0, max: 999999, decimals: 1, start: 0 },
  { key: 'pos', label: 'Position', type: 'position' },
  { key: 'sog', label: 'Vitesse fond (SOG)', type: 'number', unit: 'nd', steps: [-1, -0.1, 0.1, 1], min: 0, max: 50, decimals: 1, start: 5 },
  deg('hdg', 'Cap (HDG)'),
  deg('cog', 'Route fond (COG)'),
  { key: 'allure', label: 'Allure', type: 'choice', cols: 2, options: ALLURES.map((a) => [a]) },
  { key: 'awa', label: 'Vent apparent (AWA)', type: 'number', unit: '°', steps: [-10, -5, 5, 10], min: 0, max: 180, decimals: 0, start: 45 },
  { key: 'rpm', label: 'Régime moteur', type: 'number', unit: 'tr/min', steps: [-500, -100, 100, 500], min: 0, max: 6000, decimals: 0, start: 1800 },
  { key: 'visi', label: 'Visibilité', type: 'choice', cols: 3, options: VISI, fmt: (v) => v },
  deg('twd', 'Direction du vent (TWD)'),
  { key: 'tws', label: 'Vitesse du vent (TWS)', type: 'number', unit: 'nd', wind: true, steps: [-5, -1, 1, 5], min: 0, max: 100, decimals: 0, start: 10 },
  { key: 'mer', label: 'État de la mer', lakeLabel: 'État du lac', type: 'choice', cols: 2, options: DOUGLAS, fmt: (v) => `${v} ${DOUGLAS[v][1]}` },
  Object.assign(deg('vagues', 'Direction des vagues'), { sea: true }),
  { key: 'feux', label: 'Feux d’avis de tempête', type: 'choice', cols: 1, options: STORM_LIGHTS, lake: true },
  { key: 'baro', label: 'Baromètre', type: 'number', unit: 'hPa', steps: [-5, -1, 1, 5], min: 900, max: 1080, decimals: 0, start: 1013 },
  { key: 'gv', label: 'Grand-voile', type: 'choice', cols: 3, options: [['Haute'], ['1 ris'], ['2 ris'], ['3 ris'], ['Affalée']] },
  { key: 'avant', label: "Voile d'avant", type: 'choice', cols: 2, options: [['Génois'], ['Génois partiel'], ['Foc'], ['Trinquette'], ['Gennaker'], ['Spi'], ['Aucune']] },
  { key: 'evt', label: 'Événements', type: 'multi', cols: 2, options: [
    ['Départ'], ['Arrivée'], ['Mouillage'], ['Amarrage'], ['Virement'], ['Empannage'], ['Changement de cap'], ['Changement d’allure'], ['Prise de ris'], ['Largage de ris'],
    ['Changement de voile'], ['Changement de quart'], ['Début moteur'], ['Fin moteur'], ['Début voile'], ['Fin voile'], ['Départ baignade'], ['Retour baignade'], ['Eaux noires vidées'], ['Photo'], ['Alerte vent'], ['Homme à la mer'], ['Bulletin météo'], ['Plein carburant'], ['Avarie'], ['Autre'],
  ] },
  { key: 'note', label: 'Observations (équipage, manœuvres, température…)', type: 'text' },
];
// Rubriques qui ne sont pas reprises de l'entrée précédente.
const NOT_CARRIED = ['t', 'pos', 'evt', 'note'];
// Rubriques de navigation : elles ne sont pas recopiées dans les entrées automatiques.
const SAIL_KEYS = ['allure', 'gv', 'avant'];
const NAV_KEYS = ['t', 'pos', 'sog', 'cog', 'hdg', 'loch', 'evt', 'note', 'twd', 'tws', 'vagues', 'mer', 'baro', 'awa', 'allure'];

/* ---------- Fiche de la journée ---------- */
// Arrondi au dixième supérieur (Corban, v133) : 2,33 → 2,4 m.
// Arrondi réglable dans la roue de data (v134) : 0 = valeur exacte, sinon au pas supérieur (0,1 / 0,5 / 1 m).
const autoAdd = (v, add, step) => {
  const x = num(v); if (x == null) return '';
  const y = Math.round((x + add) * 1000) / 1000;
  if (!step) return String(Math.round(y * 100) / 100).replace('.', ',');
  const r = Math.ceil(y / step - 1e-9) * step;
  return r.toFixed(step < 1 ? 1 : 0).replace('.', ',');
};
const MARGIN_DEF = { piedPilote: 0.6, margeHaut: 1.5, coquePct: 1 }; // 2026-11-04 (Corban) : nouvelles valeurs de base (avant 0,8 m, 1 m, 2 %)
const frN = (x) => String(x).replace('.', ',');
const stepTxt = (k) => { const st = roundStep(k); return st ? `, arrondi au ${frN(st)} m supérieur` : ''; };
const marginVal = (k) => { const x = typeof settings !== 'undefined' ? num(settings[k]) : null; return x == null ? MARGIN_DEF[k] : x; };
const roundStep = (k) => { const x = typeof settings !== 'undefined' ? settings[k] : undefined; return typeof x === 'number' ? x : 0.1; };
const pairConv = (v, k, dec) => { const x = num(v); return x == null ? '' : String(Math.round(x * k * 10 ** dec) / 10 ** dec).replace('.', ','); };
const has = (d, k) => d[k] != null && d[k] !== '';
// En rouge seulement la case saisie en second (la première remplie est la base : d.pairSrc_<clé>).
const pairManual = (d, k, o, def = 'loa') => has(d, k) && has(d, o) && (d['pairSrc_' + [k, o].sort().join('_')] || def) !== k;
const COLORS_EN = { blanc: 'white', blanche: 'white', blancs: 'white', blanches: 'white', bleu: 'blue', bleue: 'blue', bleus: 'blue', bleues: 'blue', marine: 'navy', rouge: 'red', rouges: 'red', gris: 'grey', grise: 'grey', grises: 'grey', noir: 'black', noire: 'black', noirs: 'black', noires: 'black', vert: 'green', verte: 'green', verts: 'green', vertes: 'green', jaune: 'yellow', jaunes: 'yellow', beige: 'beige', beiges: 'beige', crème: 'cream', creme: 'cream', orange: 'orange', argent: 'silver', argenté: 'silver', argentée: 'silver', brun: 'brown', brune: 'brown', marron: 'brown', rose: 'pink', roses: 'pink', foncé: 'dark', foncée: 'dark', clair: 'light', claire: 'light', et: 'and', ciel: 'sky', turquoise: 'turquoise', bordeaux: 'burgundy', or: 'gold', doré: 'gold', dorée: 'gold' };
const colorEn = (t) => String(t || '').trim().split(/(\s+|,)/).map((w) => COLORS_EN[w.toLowerCase()] || w).join('');
// v216 (Corban) : traduction automatique, sans réseau, des descriptions libres (coque, voiles) en anglais pour les textes radio et SOS.
// Petit dictionnaire de bord + règle « nom + couleur » → « couleur + nom » (bande bleue → blue stripe). Les mots inconnus (noms propres, numéros) restent tels quels.
const DESC_PH = [['numéros? de voile', 'sail number'], ['bleu marine', 'navy blue'], ['bleu ciel', 'sky blue'], ['bleu roi', 'royal blue'], ["vert d['’]eau", 'aqua'],
  ["à l['’]avant", 'at the bow'], ["à l['’]arrière", 'at the stern'], ['des deux côtés', 'on both sides'], ['de chaque côté', 'on each side'], ['sur le côté', 'on the side'],
  ['ligne de flottaison', 'waterline'], ['franc[- ]bord', 'topsides'], ['au milieu', 'in the middle'], ['en haut', 'at the top'], ['en bas', 'at the bottom'], ['peu visible', 'faint'], ['très visible', 'very visible']];
const DESC_PHRASES = DESC_PH.map(([f, en]) => [new RegExp(`(^|[^0-9A-Za-zÀ-ÿ])${f}(?![0-9A-Za-zÀ-ÿ])`, 'gi'), `$1${en}`]);
const DESC_NOUNS = { bande: 'stripe', bandes: 'stripes', rayure: 'stripe', rayures: 'stripes', liseré: 'pinstripe', liserés: 'pinstripes', filet: 'pinstripe', ligne: 'line', lignes: 'lines', lettre: 'letter', lettres: 'letters', écriture: 'lettering', inscription: 'lettering', inscriptions: 'lettering', nom: 'name', numéro: 'number', numéros: 'numbers', chiffres: 'digits', logo: 'logo', logos: 'logos', dessin: 'drawing', dessins: 'drawings', motif: 'pattern', motifs: 'patterns', étoile: 'star', étoiles: 'stars', drapeau: 'flag', drapeaux: 'flags', croix: 'cross', vague: 'wave', vagues: 'waves', flèche: 'arrow', flèches: 'arrows', cercle: 'circle', cercles: 'circles', rond: 'circle', ronds: 'circles', soleil: 'sun', lune: 'moon', dauphin: 'dolphin', dauphins: 'dolphins', poisson: 'fish', poissons: 'fish', oiseau: 'bird', oiseaux: 'birds', ancre: 'anchor', cœur: 'heart', coeur: 'heart', éclair: 'lightning bolt', damier: 'checkerboard', carré: 'square', carrés: 'squares', triangle: 'triangle', triangles: 'triangles', losange: 'diamond', losanges: 'diamonds', point: 'dot', points: 'dots', pois: 'dots', coque: 'hull', pont: 'deck', voile: 'sail', voiles: 'sails', safran: 'rudder', mât: 'mast', bôme: 'boom', capote: 'sprayhood', taud: 'cover', liston: 'rubbing strake', antifouling: 'antifouling', autocollant: 'sticker', autocollants: 'stickers', publicité: 'advertising', sponsor: 'sponsor', hublot: 'porthole', hublots: 'portholes', bordure: 'edge', bord: 'edge', haut: 'top', bas: 'bottom', fond: 'background', tête: 'head', chute: 'leech', marque: 'brand', pavillon: 'flag', cockpit: 'cockpit', côté: 'side', côtés: 'sides', proue: 'bow', poupe: 'stern', étrave: 'bow', tableau: 'transom', bâche: 'cover', bâches: 'covers', fleur: 'flower', fleurs: 'flowers', tigre: 'tiger', requin: 'shark', baleine: 'whale', tortue: 'turtle', montagne: 'mountain', montagnes: 'mountains', aigle: 'eagle', lion: 'lion' };
const DESC_WORDS = { avec: 'with', et: 'and', ou: 'or', sur: 'on', sous: 'under', en: 'in', dans: 'in', à: 'at', au: 'at the', aux: 'at the', de: 'of', du: 'of the', pour: 'for', sans: 'without', entre: 'between', grand: 'large', grande: 'large', grands: 'large', grandes: 'large', gros: 'big', grosse: 'big', petit: 'small', petite: 'small', petits: 'small', petites: 'small', large: 'wide', larges: 'wide', fin: 'thin', fine: 'thin', fins: 'thin', fines: 'thin', épais: 'thick', épaisse: 'thick', double: 'double', triple: 'triple', simple: 'single', mat: 'matt', mate: 'matt', brillant: 'glossy', brillante: 'glossy', métallisé: 'metallic', métallisée: 'metallic', rayé: 'striped', rayée: 'striped', rayées: 'striped', uni: 'plain', unie: 'plain', avant: 'bow', arrière: 'stern', bâbord: 'port side', tribord: 'starboard side', milieu: 'middle', neuf: 'new', neuve: 'new', vieux: 'old', vieille: 'old', usé: 'worn', usée: 'worn', usées: 'worn', délavé: 'faded', délavée: 'faded', délavées: 'faded', blanc: 'white', partout: 'all over', le: '', la: '', les: '', un: '', une: '', des: '', 'l': '', 'd': 'of', très: 'very', peu: 'little', plusieurs: 'several', deux: 'two', trois: 'three', quatre: 'four', cinq: 'five', dessus: 'top', dessous: 'underside', majuscules: 'capitals', minuscules: 'lowercase', italique: 'italic', foncé: 'dark', foncée: 'dark', foncés: 'dark', foncées: 'dark', clair: 'light', claire: 'light', clairs: 'light', claires: 'light', vif: 'bright', vive: 'bright', pâle: 'pale', pâles: 'pale', fluo: 'neon', transparent: 'clear', transparente: 'clear', transparentes: 'clear' };
const COLOR_EN_SET = new Set(['white', 'blue', 'navy', 'red', 'grey', 'black', 'green', 'yellow', 'orange', 'pink', 'purple', 'brown', 'beige', 'gold', 'silver', 'turquoise', 'navy blue', 'sky blue', 'royal blue', 'aqua', 'dark', 'light', 'bright', 'pale', 'neon', 'cream', 'violet', 'bordeaux', 'burgundy']);
function descEn(t) {
  let x = ' ' + String(t || '').trim() + ' ';
  if (!x.trim()) return '';
  for (const [re, en] of DESC_PHRASES) x = x.replace(re, en);
  x = x.replace(/\b([ld])['’]/gi, '$1 ');
  const toks = x.trim().split(/(\s+|,|;|\.|\(|\)|«|»|"|:)/).filter((w) => w !== '' && w !== undefined);
  const out = toks.map((w) => { const lw = w.toLowerCase(); if (/^\s+$|^[,;.()«»":]$/.test(w)) return { w, sep: true }; if (DESC_NOUNS[lw]) return { w: DESC_NOUNS[lw], noun: true };
    const c = COLORS_EN[lw]; if (c) return { w: c, color: true }; if (lw in DESC_WORDS) return { w: DESC_WORDS[lw], color: ['dark', 'light', 'bright', 'pale', 'neon', 'faded', 'worn', 'striped', 'plain', 'matt', 'glossy', 'metallic', 'clear'].includes(DESC_WORDS[lw]) };
    return { w, color: COLOR_EN_SET.has(lw) }; });
  // Nom suivi de couleurs (« bande bleue et blanche ») → couleurs devant (« blue and white stripe »).
  const words = out.filter((o) => !o.sep || o.w.trim()).filter((o) => o.w !== '');
  for (let i = 0; i < words.length; i++) {
    if (!words[i].noun) continue;
    let j = i + 1; const cols = [];
    while (j < words.length && (words[j].color || (words[j].w === 'and' && j + 1 < words.length && words[j + 1].color))) { cols.push(words[j]); j++; }
    if (cols.length) { words.splice(i, cols.length + 1, ...cols, words[i]); i += cols.length; }
  }
  // Nuance après la couleur (« vert foncé ») → devant (« dark green »).
  for (let i = 1; i < words.length; i++) if (['dark', 'light', 'bright', 'pale', 'neon'].includes(words[i].w) && words[i - 1].color && !['dark', 'light', 'bright', 'pale', 'neon'].includes(words[i - 1].w)) { const t2 = words[i]; words[i] = words[i - 1]; words[i - 1] = t2; }
  return words.map((o) => o.w).join(' ').replace(/\s+([,;.):»"])/g, '$1').replace(/([(«"])\s+/g, '$1').replace(/\s{2,}/g, ' ').replace(/\b(\w+) \1\b/g, '$1').trim();
}
// « bleu marine » → « navy blue » : en anglais l'adjectif de nuance passe devant.
const colorEnOrder = (t) => colorEn(t).replace(/\b(blue) (navy|dark|light|sky)\b/gi, '$2 $1').replace(/\b(\w+) (dark|light)\b/gi, '$2 $1');
// v214 (Corban) : voiles décrites une à une (grand-voile, puis voiles d'avant) pour les textes SOS.
const SAIL_EN = { 'grand-voile': 'mainsail', 'génois': 'genoa', 'génois volant': 'flying genoa', 'génois partiel': 'genoa', foc: 'jib', trinquette: 'staysail', spi: 'spinnaker', spinnaker: 'spinnaker', gennaker: 'gennaker', 'code 0': 'code zero' };
// v421 (Corban) : chaque voile a un bouton de couleur (toucher = couleur suivante) et un champ pour les inscriptions ou dessins.
const SAIL_COLORS = [['blanche', '#ffffff'], ['crème', '#f3e9cf'], ['grise', '#9aa0a6'], ['noire', '#1d1d1d'], ['rouge', '#d32020'], ['bleue', '#1f5fbf'], ['bleu marine', '#16264f'], ['verte', '#2e8b3e'], ['jaune', '#f2c818'], ['orange', '#f07818'], ['rose', '#ef7fb0'], ['multicolore', 'conic-gradient(#d32020,#f2c818,#2e8b3e,#1f5fbf,#d32020)']];
const sailColCss = (c) => { const x = SAIL_COLORS.find(([n]) => n === c); return x ? x[1] : 'transparent'; };
const sailColBtn = (c, gv) => `<button type="button" class="btn sail-col${c ? ' on' : ''}"${gv ? ' data-gvcol="1"' : ''} data-col="${esc(c || '')}"><i class="sail-sw" style="background:${sailColCss(c)}"></i>${esc(c ? c[0].toUpperCase() + c.slice(1) : '🎨 Couleur')}</button>`;
// v423 (Corban) : sous chaque voile, en petit, la description complète en français puis en anglais (textes radio et SOS).
const sailLineHtml = (nm, c, d) => { nm = String(nm || '').trim(); c = String(c || '').trim(); d = String(d || '').trim(); if (!nm || (!c && !d)) return '';
  const fr = `${nm} : ${[c, d].filter(Boolean).join(', ')}`, en = `${c ? colorEnOrder(c) + ' ' : ''}${SAIL_EN[nm.toLowerCase()] || nm}${d ? ', ' + descEn(d) : ''}`;
  return `${esc(fr)}<br>🇬🇧 ${esc(en.charAt(0).toUpperCase() + en.slice(1))}`; };
const sailJoin = (c, d) => [c, d].map((x) => String(x || '').trim()).filter(Boolean).join(', ');
function sailDescs(d) {
  const out = []; const g = sailJoin(d.gvColor, d.gvDesc); if (g) out.push(['Grand-voile', g]);
  const names = String(d.voilesAvant || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean), ds = Array.isArray(d.voilesDesc) ? d.voilesDesc : [], cs = Array.isArray(d.voilesColor) ? d.voilesColor : [];
  names.forEach((nm, i) => { const t = sailJoin(cs[i], ds[i]); if (t) out.push([nm, t]); });
  return out;
}
const sailsTxt = (d, lang) => sailDescs(d).map(([nm, x]) => lang === 'fr' ? `${nm.toLowerCase()} (${x.trim()})` : `${SAIL_EN[nm.toLowerCase()] || nm} (${descEn(x)})`).join(', ');
function radioDesc(d, lang, autoOnly) {
  if (!autoOnly && d.desc) return d.desc;
  const ft = num(d.loaFt) ?? (num(d.loa) != null ? Math.round(num(d.loa) / 0.3048) : null);
  const m = num(d.loa) ?? (num(d.loaFt) != null ? Math.round(num(d.loaFt) * 0.3048 * 10) / 10 : null);
  const model = (d.model || '').trim();
  // À la radio, seulement la marque et le numéro du modèle (« Hanse 325 quille courte » → « Hanse 325 »).
  const short = []; for (const w of model.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean)) { if (/^[A-Z0-9]/.test(w)) short.push(w); else break; }
  const modelEn = short.join(' ') || model;
  if (lang === 'fr') return [`Voilier${modelEn ? ' ' + modelEn : ''}`, ft != null ? `${Math.round(ft)} pieds${m != null ? ` (${frN(m)} m)` : ''}` : '', d.hullColor ? `coque ${d.hullColor.trim()}` : '', d.marking ? `sur la coque : ${d.marking.trim()}` : '', sailsTxt(d, 'fr') || (d.sailColor ? `voiles ${d.sailColor.trim()}` : '')].filter(Boolean).join(', ');
  return [`Sailing yacht${modelEn ? ' ' + modelEn : ''}`, ft != null ? `${Math.round(ft)} feet` : '', d.hullColor ? `${descEn(d.hullColor)} hull` : '', d.marking ? `on the hull: ${descEn(d.marking)}` : '', sailsTxt(d, 'en') || (d.sailColor ? `${colorEnOrder(d.sailColor)} sails` : '')].filter(Boolean).join(', ');
}
const autoVal = (f, data) => (f.auto ? f.auto(data || {}) : '');
const n = (key, label, unit, extra) => Object.assign({ key, label, type: 'num', unit }, extra);
const DAY_SECTIONS = [
  { title: 'Étape', fields: [{ key: 'de', label: 'De', type: 'line' }, { key: 'a', label: 'À', type: 'line' }] },
  { title: 'Prévisions météo', fields: [
    n('fVentDir', 'Vent : direction', '°'), n('fVentVit', 'Vent : vitesse', 'nd', { wind: true }), n('fRafales', 'Rafales', 'nd', { wind: true }),
    { key: 'fVentTend', label: 'Tendance du vent', type: 'choice', options: TREND },
    n('fMerDir', 'Mer : direction', '°', { sea: true }), n('fMerH', 'Mer : hauteur', 'm', { sea: true }), n('fMerP', 'Mer : période', 's', { sea: true }),
    { key: 'fMerTend', label: 'Tendance de la mer', type: 'choice', options: TREND, sea: true },
    { key: 'fFeux', label: 'Feux d’avis de tempête', type: 'choice', options: STORM_LIGHTS, lake: true },
    n('fPression', 'Pression', 'hPa'), { key: 'fPressTend', label: 'Tendance pression', type: 'choice', options: TREND },
    n('fAir', 'Air', '°C'), n('fRessentie', 'Ressentie', '°C'), n('fEau', 'Eau', '°C'), n('fNuages', 'Nuages', '%'),
    n('fPluie', 'Pluie', 'mm'), n('fRisquePluie', 'Risque de pluie', '%'), n('fOrage', 'Risque orageux', '%'), n('fVisi', 'Visibilité', 'km'),
    n('fHum', 'Humidité', '%'), n('fUV', 'Indice UV', ''),
    { key: 'fProtection', label: 'Protection port ou mouillage / alternative', type: 'area' },
  ] },
  { title: 'Route prévue', fields: [
    { key: 'dest', label: 'Destination', type: 'line', wide: true }, n('canal', 'Canal VHF', ''), n('duree', 'Durée', 'h'),
    { key: 'amarrage', label: 'Type d’amarrage, tenue du mouillage', type: 'line', wide: true }, n('prof', 'Profondeur', 'm'),
    { key: 'etd', label: 'Départ prévu (ETD)', type: 'clock' }, { key: 'eta', label: 'Arrivée prévue (ETA)', type: 'clock' },
    { key: 'lever', label: 'Lever du soleil', type: 'clock' }, { key: 'coucher', label: 'Coucher du soleil', type: 'clock' },
  ] },
  { title: 'Moteur et carburant', fields: [
    // v238 (Corban) : valeurs de départ de la croisière, saisies ici (gardées dans cruise.info, voir DAY_INFO_KEYS).
    n('moteurInit', 'Compteur moteur au départ de la croisière', 'h', { wide: true }), n('fuelInit', 'Carburant au départ de la croisière', 'l'), n('vMoteur', 'Vitesse au moteur', 'nd'),
    n('moteurSoir', 'Heures moteur relevées ce soir', 'h', { wide: true }), n('plein', 'Carburant ajouté ce jour', 'l', { wide: true }),
    { key: 'calcMoteur', type: 'calc', calc: calcEngine },
  ] },
  { title: 'Navigation du jour', fields: [
    { key: 'calcNav', type: 'calc', calc: calcNav },
    { key: 'dureeNav', label: 'Durée de navigation saisie à la main (remplace le calcul)', type: 'line', wide: true, placeholder: 'ex. 5 h 30' },
  ] },
  { title: 'Milles parcourus', fields: [
    n('nmJour', 'Milles effectués ce jour', 'NM', { wide: true }),
    { key: 'calcMilles', type: 'calc', calc: calcMiles },
  ] },
  { title: 'Contrôles', fields: [
    { key: 'ctrl', type: 'check', options: ['Eau douce relevée', 'Batteries, frigo off', 'VHF ON, squelch', 'Cabine rangée', 'Hublots fermés', 'Cales écopées',
      'Réserves de gaz', 'Annexe, pagaies, essence', 'Eau de refroidissement moteur', 'Vidange eaux noires', 'Moteur : propreté, filtre, huile, courroie'] },
    n('eauDouce', 'Eau douce restante', 'l', { wide: true }),
  ] },
  { title: 'Marées', sea: true, fields: [{ key: 'marPort', label: 'Port', type: 'line' }, n('marCoeff', 'Coefficient', ''), { key: 'marees', type: 'tides' }] },
  { title: 'Conditions spéciales, quarts', sea: true, fields: [n('hNuit', 'Heures de nuit', 'h'), n('h5bf', 'Heures > 5 Bf', 'h'), { key: 'quarts', label: 'Organisation des quarts', type: 'area' }] },
  { title: 'Escale et debriefing', fields: [
    { key: 'dysfonct', label: 'Dysfonctionnements constatés en route', type: 'area' },
    { key: 'aFaire', label: 'Problèmes à résoudre à l’escale, interventions', type: 'area' },
    { key: 'avitaillement', label: 'Avitaillement complémentaire', type: 'area' },
    { key: 'debrief', label: 'Debriefing de la journée', type: 'area' },
  ] },
  { title: 'Signatures', fields: [
    { key: 'navigateur', label: 'Navigateur', type: 'crewpick' }, { key: 'sigNav', label: 'Signature du navigateur', type: 'signature' },
    { key: 'skipper', label: 'Skipper', type: 'crewpick' }, { key: 'sigSkip', label: 'Signature du skipper', type: 'signature' },
  ] },
];

/* ---------- Bateau et croisière ---------- */
const DEFAULT_CONTACTS = [
  'Urgence (Europe) : 112',
  'Appel de sécurité : VHF 16, ASN canal 70',
  'CCMM consultation médicale : +33 5 34 39 33 33',
  'CCMM eaux internationales : +33 3 21 87 21 87',
].join('\n');
// Fiche technique, à la suite des données techniques (Corban, v158).
const TECH_FIELDS = [
    // v157 : textes libres sur toute la largeur (pas coupés), valeurs courtes par deux.
    { key: 'builder', label: 'Constructeur', type: 'line', grow: true, wide: true }, { key: 'architect', label: 'Architecte', type: 'line', grow: true, wide: true },
    { key: 'hin', label: 'CIN / HIN n°', type: 'line', grow: true, wide: true }, { key: 'ceId', label: 'Identification CE', type: 'line', grow: true, wide: true },
    // Pavillon et port d’attache : deux cases (Corban, v160).
    { key: 'flag', label: 'Pavillon', type: 'line', grow: true }, { key: 'homePort', label: 'Port d’attache', type: 'line', grow: true },
    { key: 'flagNo', label: 'Pavillon / francisation n°', type: 'line', grow: true, wide: true },
    { key: 'reg', label: 'Immatriculation', type: 'line', grow: true, wide: true }, { key: 'category', label: 'Catégorie de conception', type: 'line', grow: true, wide: true },
    // v243 (Corban) : longueur de coque passée dans Informations, dans le même cadre que la flottaison.
    n('lhull', 'Longueur de coque (LH)', 'm', { frame: 'lw', lock: true, rule: () => `calcul : longueur hors-tout − ${frN(marginVal('coquePct'))} %`, auto: (d) => { const l = num(d.loa) ?? num(pairConv(d.loaFt, 0.3048, 2)); return l == null ? '' : frN(Math.round(l * (1 - marginVal('coquePct') / 100) * 100) / 100); } }),
    n('lwl', 'Longueur flottaison (LWL)', 'm', { lock: true, frame: 'lw' }),
    n('displ', 'Déplacement lège', 'kg', { frame: 'displ' }), n('keelWeight', 'dont quille', 'kg', { frame: 'displ' }), // poids de la quille compris dans le total (Corban, v167)
    // v428 (Corban) : ancre en deux pastilles dans un même cadre, type (et chaîne) à gauche, poids en kg à droite.
    { key: 'anchor', label: 'Ancre (type, chaîne)', type: 'line', grow: true, frame: 'anc' }, n('anchorKg', 'Poids de l’ancre', 'kg', { frame: 'anc' }),
    // Type de bateau et gréement : deux cases (Corban, v165).
    { key: 'rig', label: 'Type de bateau', type: 'line', grow: true, wide: true, frame: 'rig' }, { key: 'rigging', label: 'Gréement', type: 'line', grow: true, wide: true, frame: 'rig', placeholder: 'ex. sloop en tête de mât, fractionné' },
    n('sails', 'Surface de voilure au près', 'm²', { wide: true, frame: 'rig' }), // v428 (Corban) : unité dans le titre. // v243 (Corban) : ex « Surfaces de voile (GV, génois, gennaker) »
];
const WATERS_SEA_ONLY = ['callsign', 'mmsi', 'vhfMarina', 'coastStation', 'desc'];
const INFO_SECTIONS = [
  { title: 'Croisière', fields: [
    { key: 'name', label: 'Nom de la croisière', type: 'line', wide: true, placeholder: 'ex. Croatie 2026' },
    { key: 'ports', label: 'Port de départ et d’arrivée', type: 'line', wide: true },
    { key: 'du', label: 'Du', type: 'date' }, { key: 'au', label: 'Au', type: 'date', minFrom: 'du' },
  ] },
  { title: 'Données techniques', fields: [ // titre « Bateau » renommé (Corban, v158)
    { key: 'boat', label: 'Nom du bateau', type: 'line', wide: true, frame: 'boatId' }, // v240 (Corban) : même cadre que « Plan d’eau »
    // Eaux intérieures ou maritimes : pastille tournante (Corban, v197), protégée comme le pas d'hélice (v198) :
    // une fois choisie, appui court = « Modifier pour … ? » en orange, appui long = confirmer.
    { key: 'waters', label: 'Navigue', type: 'choice', options: [['Eaux intérieures'], ['Eaux maritimes']], show: { 'Eaux intérieures': 'en eaux intérieures', 'Eaux maritimes': 'en eaux maritimes' }, cycle: true, wide: true, frame: 'boatId' }, { key: 'model', label: 'Modèle', type: 'line', grow: true, frame: 'my' }, { key: 'year', label: 'Année', type: 'line', inputmode: 'numeric', frame: 'my' }, // v243 (Corban) : cadres communs
    // v157 (Corban) : largeur au cas par cas, l'année et le pas d'hélice tiennent chacun dans une demi-case.
    // v200 (Corban) : libellé sans « tire à », pastille plus courte avec flèche « < Bâbord » / « Tribord > ».
    // v424 (Corban) : pas d'hélice « Sans » (blanc) affiché d'abord, revient par appui long.
    { key: 'pas', label: 'Pas d’hélice en marche arrière', type: 'choice', options: [['Bâbord'], ['Tribord'], ['Sans']], cycle: true, show: { '': 'Sans', 'Sans': 'Sans', 'Bâbord': '< Bâbord', 'Tribord': 'Tribord >' }, short: true, wide: true }, // v254 (Corban) : toute la largeur, jusque sous Année ; trois entrées distinctes (Corban, v126)
    // Longueur en mètres ou en pieds : la première remplie sert de base, l'autre se calcule (Corban, v135).
    n('loaFt', 'Longueur', 'pieds', { frame: 'len', lock: true, rule: () => 'calcul : longueur hors-tout ÷ 0,3048', auto: (d) => pairConv(d.loa, 1 / 0.3048, 1), pair: 'loa', manual: (d) => pairManual(d, 'loaFt', 'loa') }),
    n('loa', 'Longueur hors-tout (LOA)', 'm', { frame: 'len', lock: true, rule: () => 'calcul : longueur en pieds × 0,3048', auto: (d) => pairConv(d.loaFt, 0.3048, 2), pair: 'loaFt', manual: (d) => pairManual(d, 'loa', 'loaFt') }),
    n('beam', 'Largeur (bau)', 'm', { lock: true, frame: 'len' }),
    // Calculés automatiquement, modifiables à la main (alors en rouge) ; effacer remet le calcul (Corban, v131).
    // Valeurs du pied de pilote et de la marge : roue dentée de data (Corban, v133).
    n('draft', 'Tirant d’eau', 'm', { lock: true, frame: 'draft' }),
    n('draftPilot', 'Sondeₘᵢₙ selon traceur', 'm', { frame: 'draft', lock: true, prefix: '≥', rule: () => `calcul : tirant d’eau + ${frN(marginVal('piedPilote'))} m${stepTxt('arrProf')}`, auto: (d) => autoAdd(d.draft, marginVal('piedPilote'), roundStep('arrProf')) }),
    n('airDraft', 'Tirant d’air', 'm', { lock: true, frame: 'air' }),
    n('airMargin', 'Hauteur de passageₘᵢₙ', 'm', { frame: 'air', lock: true, prefix: '≥', rule: () => `calcul : tirant d’air + ${frN(marginVal('margeHaut'))} m${stepTxt('arrHaut')}`, auto: (d) => autoAdd(d.airDraft, marginVal('margeHaut'), roundStep('arrHaut')) }),
    // v206 (Corban) : voiles d'avant dans les données techniques.
    // v214 (Corban) : voiles = grand-voile d'abord, puis voiles d'avant ; pour chacune, couleur et inscription ou dessin (textes SOS).
    { key: 'voilesAvant', label: 'Voiles', type: 'sails', wide: true },
    // v215 (Corban) : coque juste après les voiles : couleur, puis inscription remarquable ou dessin (textes SOS).
    { key: 'hullColor', label: 'Couleur de la coque', type: 'line', grow: true, wide: true, en: true, frame: 'hull', placeholder: 'ex. blanche, bleu marine' },
    { key: 'marking', label: 'Inscription remarquable ou dessin sur la coque', type: 'line', grow: true, wide: true, en: true, frame: 'hull', placeholder: 'ex. nom en lettres rouges, bande bleue, logo' },
    // v212 (Corban) : carburant devient « Gasoil (l) » dans les données techniques ; ＋ pour un deuxième réservoir.
    // v238 (Corban) : un seul cadre « Énergie de propulsion », pastille tournante Gasoil (brun-jaune) / Électrique (vert).
    { key: 'energy', label: 'Énergie de propulsion', type: 'group', wide: true, sel: 'propType', fields: [
      { key: 'propType', label: '', type: 'choice', options: [['Gasoil'], ['Électrique']], cycle: true, wide: true }, // v242 (Corban) : protégée (appui long pour changer)
      n('fuelCap', 'Vₘₐₓ gasoil', 'l', { when: 'Gasoil', addMore: { key: 'fuelCap2', label: '2ᵉᵐᵉ réservoir' } }),
      n('fuelCap2', 'Vₘₐₓ gasoil 2ᵉᵐᵉ réservoir', 'l', { when: 'Gasoil', reveal: true }),
      n('conso', 'Consommation x̄ gasoil', 'l/h', { when: 'Gasoil', addMore: { key: 'conso2', label: '2ᵉᵐᵉ moteur' } }),
      n('conso2', 'Consommation x̄ gasoil 2ᵉᵐᵉ moteur', 'l/h', { when: 'Gasoil', reveal: true }),
      n('battKwh', 'Eₘₐₓ batteries', 'kWh', { when: 'Électrique', wide: true }),
      n('genFuelCap', 'Générateur gasoil : Vₘₐₓ réservoir', 'l', { when: 'Électrique' }),
      n('genConso', 'Générateur gasoil : consommation x̄', 'l/h', { when: 'Électrique' }),
    ] },
    // v212 (Corban) : eau potable, même principe, jusqu'à trois réservoirs.
    n('waterCap', 'Vₘₐₓ eau potable', 'l', { addMore: { key: 'waterCap2', label: '2ᵉᵐᵉ réservoir' } }),
    n('waterCap2', 'Vₘₐₓ eau potable 2ᵉᵐᵉ réservoir', 'l', { reveal: true, addMore: { key: 'waterCap3', label: '3ᵉᵐᵉ réservoir' } }),
    n('waterCap3', 'Vₘₐₓ eau potable 3ᵉᵐᵉ réservoir', 'l', { reveal: true }),
  ] },
  // Données moteur, sous les données techniques (Corban, v166).
  // Deuxième section de la fiche bateau : données générales et informatives (Corban, v197) ; Corban dira quelles données y vont.
  // v199 (Corban) : de « Constructeur » à « Puissance », tout passe sous Informations.
  { title: 'Informations', fields: [
    ...TECH_FIELDS,
    { key: 'engine', label: 'Moteur (marque, transmission)', type: 'line', grow: true, wide: true, gasOnly: true },
    // v424 (Corban) : unité kW. v426 (Corban) : kW et ch côte à côte, l'un calculé depuis l'autre (1 kW = 1,36 ch) ;
    // moteur et puissance thermiques masqués quand l'énergie est « Électrique » (les valeurs restent gardées).
    n('power', 'Puissance', 'kW', { frame: 'pw', gasOnly: true, rule: () => 'calcul : ch ÷ 1,36', auto: (d) => pairConv(d.powerCh, 1 / 1.35962, 1), pair: 'powerCh', manual: (d) => pairManual(d, 'power', 'powerCh', 'power') }),
    n('powerCh', '', 'ch', { unitOnly: true, frame: 'pw', gasOnly: true, rule: () => 'calcul : kW × 1,36', auto: (d) => pairConv(d.power, 1.35962, 1), pair: 'power', manual: (d) => pairManual(d, 'powerCh', 'power', 'power') }),
    // v425 (Corban) : propulsion électrique, sous Informations, visibles seulement si l'énergie est « Électrique ».
    { key: 'battType', label: 'Type de batteries', type: 'line', grow: true, wide: true, elecOnly: true, placeholder: 'ex. lithium' },
    // v427 (Corban) : pod et générateur aussi en kW + ch ; côté ch, seule l'unité est affichée.
    n('podKw', 'Puissance du pod électrique', 'kW', { frame: 'pod', elecOnly: true, rule: () => 'calcul : ch ÷ 1,36', auto: (d) => pairConv(d.podCh, 1 / 1.35962, 1), pair: 'podCh', manual: (d) => pairManual(d, 'podKw', 'podCh', 'podKw') }),
    n('podCh', '', 'ch', { unitOnly: true, frame: 'pod', elecOnly: true, rule: () => 'calcul : kW × 1,36', auto: (d) => pairConv(d.podKw, 1.35962, 1), pair: 'podKw', manual: (d) => pairManual(d, 'podCh', 'podKw', 'podKw') }),
    n('genKw', 'Puissance du générateur (back-up)', 'kW', { frame: 'gen', elecOnly: true, rule: () => 'calcul : ch ÷ 1,36', auto: (d) => pairConv(d.genCh, 1 / 1.35962, 1), pair: 'genCh', manual: (d) => pairManual(d, 'genKw', 'genCh', 'genKw') }),
    n('genCh', '', 'ch', { unitOnly: true, frame: 'gen', elecOnly: true, rule: () => 'calcul : kW × 1,36', auto: (d) => pairConv(d.genKw, 1.35962, 1), pair: 'genKw', manual: (d) => pairManual(d, 'genCh', 'genKw', 'genKw') }),
  ] },
  { title: 'Radio et identification', fields: [
    { key: 'callsign', label: 'Indicatif (call sign)', type: 'line', lock: true }, { key: 'mmsi', label: 'MMSI', type: 'line', lock: true, inputmode: 'numeric' },
    // Description radio générée depuis ces cases, en anglais ; un toucher bref montre le français 3 s (Corban, v146).
    { key: 'sailColor', label: 'Couleur des voiles', type: 'line', grow: true, placeholder: 'ex. blanches' },
    { key: 'desc', label: 'Description pour la radio', type: 'descgen', wide: true, auto: (d) => radioDesc(d, 'en', true), rule: () => 'calcul : modèle, longueur, couleurs et inscription · toucher : français 3 s' },
    { key: 'vhfMarina', label: 'Canal VHF de la marina', type: 'line', grow: true }, { key: 'coastStation', label: 'Station côtière radio', type: 'line', grow: true, placeholder: 'ex. Split Radio' },
  ] },
  // v238 (Corban) : « Calculs moteur et carburant » passés dans le livre de bord journalier (DAY_SECTIONS, valeurs gardées dans cruise.info).
  { title: 'Loueur, base', fields: [{ key: 'base', label: 'Chef de base, bureau, téléphones', type: 'area' }] },
  { title: 'Location et règlement du bateau', lake: true, fields: [
    { key: 'tarifs', label: 'Tarifs de location', type: 'area', rows: 4, placeholder: 'ex. Journée semaine : CHF …\nDès 17h00 : CHF …' },
    { key: 'reglement', label: 'Règlement, franchise d’assurance', type: 'area', rows: 6 },
  ] },
  { title: 'Numéros utiles (page SOS)', fields: [{ key: 'contacts', label: 'Un par ligne, sous la forme « Nom : numéro »', type: 'area', rows: 6 }] },
  { title: 'Météo', fields: [{ key: 'meteo', label: 'Bulletins VHF (canaux, horaires), sites web, heure légale', type: 'area', rows: 5 }] },
];
const CREW_FIELDS = [
  { key: 'fonction', label: 'Fonction à bord', type: 'choice', options: [['Skipper'], ['Second'], ['Équipier']], wide: true },
  { key: 'nom', label: 'Prénom nom', type: 'line', wide: true },
  { key: 'sexe', label: 'Coéquipier ou coéquipière', type: 'choice', options: [['Homme'], ['Femme'], ['Non genré']], cycle: true, free: true, wide: true, show: { '': '⚲', 'Homme': '♂', 'Femme': '♀', 'Non genré': '⚲' } }, // v324 (Corban) : symboles seuls, « ♂ / ♀ ? » tant que rien n'est choisi ; v222 : affiché Coéquipier / Coéquipière ; v173 : non protégée
  // v239 (Corban) : cadres communs (field.frame) : naissance + lieu + nationalité, téléphone + courriel, pièce + expiration, permis + établi par + licence VHF, chaque proche + son téléphone.
  { key: 'naissance', label: 'Date de naissance', type: 'line', frame: 'nais' },
  { key: 'lieu', label: 'Lieu de naissance / d’origine', type: 'line', grow: true, wide: true, frame: 'nais', labelCycle: { key: 'lieuType', options: ['Lieu de naissance', 'Lieu d’origine'] } }, // v220 : intitulé tournant protégé
  { key: 'nationalite', label: 'Nationalité', type: 'line', frame: 'nais' },
  { key: 'tel', label: 'Téléphone (avec indicatif, ex. +41)', type: 'line', inputmode: 'tel', placeholder: '+41 79 123 45 67', phone: true, wide: true, contact: 'tel', frame: 'contact' },
  { key: 'email', label: 'Courriel', type: 'line', inputmode: 'email', wide: true, contact: 'mail', frame: 'contact' },
  // Numéros protégés comme les données critiques : passeport / ID, permis, licence VHF (v181). v229 : expiration jaune < 3 mois, rouge expirée.
  { key: 'piece', label: 'Passeport / carte ID (n°)', type: 'line', labelCycle: { key: 'pieceType', options: ['Passeport', 'Carte d’identité'], suffix: ' n°' }, lock: true, frame: 'piece' },
  { key: 'expiration', label: 'Date d’expiration', type: 'line', expiry: true, placeholder: 'JJ.MM.AAAA', frame: 'piece' },
  // v429 (Corban) : licence VHF en haut à droite du cadre, « Permis établi par » dessous sur toute la largeur.
  { key: 'permis', label: 'Permis n°', type: 'line', lock: true, frame: 'permis' }, { key: 'vhf', label: 'Licence VHF n°', type: 'line', lock: true, frame: 'permis' },
  { key: 'emisPar', label: 'Permis établi par', type: 'line', wide: true, frame: 'permis' },
  { key: 'adresse', label: 'Adresse postale', type: 'line', wide: true },
  { key: 'sante', label: 'Santé, allergies à connaître', type: 'area' }, // v244 (Corban) : avant les proches
  // Proches à contacter : nom et téléphone séparés, jusqu'à trois (v174). « proche » reste le texte résumé (liste d'équipage).
  { key: 'procheNom', label: 'Proche à contacter : prénom et nom', type: 'line', grow: true, wide: true, frame: 'p1' },
  { key: 'procheTel', label: 'Téléphone du proche', type: 'line', inputmode: 'tel', placeholder: '+41 79 123 45 67', phone: true, wide: true, contact: 'tel', frame: 'p1' },
  { key: 'proche2Nom', label: '2ᵉᵐᵉ proche : prénom et nom', type: 'line', grow: true, wide: true, frame: 'p2' },
  { key: 'proche2Tel', label: 'Téléphone du 2ᵉᵐᵉ proche', type: 'line', inputmode: 'tel', placeholder: '+41 79 123 45 67', phone: true, wide: true, contact: 'tel', frame: 'p2' },
  { key: 'proche3Nom', label: '3ᵉᵐᵉ proche : prénom et nom', type: 'line', grow: true, wide: true, frame: 'p3' },
  { key: 'proche3Tel', label: 'Téléphone du 3ᵉᵐᵉ proche', type: 'line', inputmode: 'tel', placeholder: '+41 79 123 45 67', phone: true, wide: true, contact: 'tel', frame: 'p3' },
];

// Sortie lacustre : pas de marées ni de vagues, mais les feux d'avis de tempête.
// Simulation de zone (mode développeur, Corban v265-v266) : quand elle est active, tout suit (heure UTC d'abord en mer, rubriques, cartes, VHF, SOS).
let zoneSimV = ''; try { zoneSimV = localStorage.getItem('ldb.zoneSim') || ''; } catch (e) {}
const isLake = () => !!cruise && (zoneSimV === 'lac' || zoneSimV === 'mer' ? zoneSimV === 'lac' : cruise.type === 'lac');
const forType = (f) => (isLake() ? !f.sea : !f.lake);
const activeFields = () => FIELDS.filter(forType).map((f) => (isLake() && f.lakeLabel ? Object.assign({}, f, { label: f.lakeLabel }) : f));
const daySections = () => (isLake() ? LAKE_DAY_SECTIONS : activeSections(DAY_SECTIONS));
const activeSections = (sections) => sections.filter(forType).map((s) => Object.assign({}, s, { fields: s.fields.filter(forType) }));

/* ---------- Stockage local, une croisière = un dossier indépendant ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast('⚠ Mémoire pleine : exportez puis supprimez une ancienne croisière'); return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  // Nettoyage 2026-11-04 (Corban : code très robuste) : une liste stockée est toujours un tableau d'objets,
  // même si la mémoire contient autre chose (donnée abîmée, ancienne version) ; on ne plante jamais à la lecture.
  arr(k, fix) { const v = this.get(k, []); const a = Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)) : []; return fix ? a.map((x) => { try { return fix(x) || x; } catch (e) { return x; } }) : a; },
};
// Journal des erreurs (nettoyage 2026-11-04) : toute erreur non prévue est notée dans ldb.errLog (50 dernières),
// sans rien afficher ; il part avec la sauvegarde et aide à corriger.
(function errLog() {
  const note = (msg, src) => { try { const l = JSON.parse(localStorage.getItem('ldb.errLog') || '[]'); l.push({ t: new Date().toISOString(), v: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '', view: typeof currentView !== 'undefined' ? currentView : '', msg: String(msg).slice(0, 300), src: String(src || '').slice(0, 120) }); localStorage.setItem('ldb.errLog', JSON.stringify(l.slice(-50))); } catch (e) {} };
  window.addEventListener('error', (e) => note(e.message, `${(e.filename || '').split('/').pop()}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', (e) => note(e.reason && (e.reason.stack || e.reason.message) || e.reason, 'promise'));
})();
let settings = Object.assign({ icon: 'compas', theme: 'day', prefill: true, wake: true, autoPerHour: 1, autoTurn: 30, autoWeather: true, mapRadius: 50 }, store.get('ldb.settings', {}));
// v441 (Corban) : « Garder l’écran allumé » est OUI par défaut ; forcé une fois à OUI chez tout le monde (on peut toujours le remettre à NON).
if (!store.get('ldb.wakeDef', false)) { settings.wake = true; store.set('ldb.settings', settings); store.set('ldb.wakeDef', true); }
// 2026-11-04 : l'ancien réglage « Bulles d'aide (pop-up) » (v339, qui coupait toutes les bulles) devient « Bulles d'aide (i) ».
if (settings.noPopups != null) { if (settings.noHelpI == null) settings.noHelpI = !!settings.noPopups; delete settings.noPopups; store.set('ldb.settings', settings); }
function applyHelpI() { document.documentElement.classList.toggle('no-help-i', !!settings.noHelpI); }
applyHelpI();
let index = store.get('ldb.index', []); // [{ id, name, created }]
let cruise = null;
let draft = null;

function blankCruise(name, from) {
  const c = { id: uid(), created: new Date().toISOString(), info: { name, conso: 3, vMoteur: 5, contacts: DEFAULT_CONTACTS }, crew: [], entries: [], days: {} };
  if (from) {
    const keep = Object.assign({}, from.info);
    for (const k of ['name', 'ports', 'du', 'au']) delete keep[k];
    // Le compteur moteur repart de la dernière valeur relevée sur la croisière précédente.
    const lastDay = Object.keys(from.days).sort().reverse().find((d) => num(from.days[d].moteurSoir) != null);
    if (lastDay) keep.moteurInit = from.days[lastDay].moteurSoir;
    Object.assign(c.info, keep, { name });
  }
  return c;
}
// keepStamp : fusion d'une synchro, on garde la date de modification reçue.
function saveCruise(keepStamp) {
  if (keepStamp !== true) cruise.updated = new Date().toISOString();
  const i = index.findIndex((x) => x.id === cruise.id);
  const meta = { id: cruise.id, name: cruise.info.name || 'Sans nom', created: cruise.created, type: cruise.type || 'mer', duree: cruise.duree };
  if (i >= 0) index[i] = meta; else index.push(meta);
  store.set('ldb.index', index);
  store.set('ldb.current', cruise.id);
  return store.set('ldb.cruise.' + cruise.id, cruise);
}
function openCruise(id) {
  const c = store.get('ldb.cruise.' + id, null);
  if (!c) return false;
  cruise = c;
  draft = store.get('ldb.draft.' + id, null);
  store.set('ldb.current', id);
  return true;
}
// Supprime une navigation entière (bouton ou swipe, Corban v183).
function removeCruise(id) {
  if (cruise && cruise.id === id && typeof tracking !== 'undefined' && tracking) stopTracking(false);
  deleteCruiseData(id);
  index = index.filter((x) => x.id !== id); store.set('ldb.index', index);
  if (cruise && cruise.id === id) {
    cruise = null; draft = null; store.del('ldb.current');
    const next = [...index].sort((a, z) => z.created.localeCompare(a.created))[0];
    if (next) openCruise(next.id);
  }
}
function deleteCruiseData(id) {
  const c = store.get('ldb.cruise.' + id, null);
  if (c && c.photos && typeof delPhoto === 'function') c.photos.forEach((p) => delPhoto(p.id));
  for (const k of ['ldb.cruise.', 'ldb.draft.', 'ldb.track.', 'ldb.trkSegs.', 'ldb.lastTrip.', 'ldb.trip.']) store.del(k + id);
}
const saveSettings = () => store.set('ldb.settings', settings);
const saveDraft = () => (draft ? store.set('ldb.draft.' + cruise.id, draft) : store.del('ldb.draft.' + cruise.id));

/* ---------- Utilitaires ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch {} };
const pad = (x, l = 2) => String(x).padStart(l, '0');
// v391 (Corban) : la légende d'une photo s'écrit DANS la photo (en bas), en couleur contrastée avec la photo :
// on mesure la clarté du bas de l'image ; claire → texte noir sur voile blanc, sombre → texte blanc sur voile noir.
function capOver(g, x, y, w, h, text, px) {
  text = String(text || '').trim(); if (!text || w < 40 || h < 40) return;
  px = Math.max(12, Math.round(px || w / 26));
  let L = 0.3;
  try { const sh = Math.max(4, Math.round(h * 0.22)), d = g.getImageData(Math.round(x), Math.round(y + h - sh), Math.max(1, Math.round(w)), sh).data; let s = 0, n = 0; for (let i = 0; i < d.length; i += 16) { s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; } L = n ? s / n / 255 : 0.3; } catch (e) { /* image protégée : texte blanc */ }
  const light = L > 0.58, pad = Math.round(px * 0.55);
  g.save(); g.font = `700 ${px}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const maxW = w - 2 * pad, words = text.split(/\s+/), lines = []; let line = '';
  for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line);
  if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/.{0,2}$/, '…'); }
  const bh = lines.length * px * 1.25 + 2 * pad;
  g.fillStyle = light ? 'rgba(255,255,255,.62)' : 'rgba(0,0,0,.5)'; g.fillRect(x, y + h - bh, w, bh);
  g.fillStyle = light ? '#0b1220' : '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, x + w / 2, y + h - bh + pad + i * px * 1.25, maxW));
  g.restore();
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const num = (v) => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
const fr = (x, d = 1) => (x == null ? '–' : x.toFixed(d).replace('.', ','));
// Vent : toujours en nœuds et en Beaufort, et en petit en km/h (demande de Corban, 2026-10-31).
const BFT_KN = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
const bft = (kn) => { const k = Math.round(Number(kn)); let b = 0; while (b < 12 && k >= BFT_KN[b]) b++; return b; };
const kmh = (kn) => Math.round(Number(kn) * 1.852);
const knOk = (kn) => kn != null && kn !== '' && Number.isFinite(Number(String(kn).replace(',', '.')));
const knNum = (kn) => Number(String(kn).replace(',', '.'));
const windTxt = (kn) => (knOk(kn) ? `${Math.round(knNum(kn))} nd · ${bft(knNum(kn))} Bf (${kmh(knNum(kn))} km/h)` : '');
const windHtml = (kn, strong = true) => (knOk(kn) ? `${strong ? '<b>' : ''}${Math.round(knNum(kn))} nd · ${bft(knNum(kn))} Bf${strong ? '</b>' : ''} <small class="kmh">${kmh(knNum(kn))} km/h</small>` : '…');
const windConv = (kn) => (knOk(kn) ? `${bft(knNum(kn))} Bf · ${kmh(knNum(kn))} km/h` : '');
const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// Heures toujours affichées à double : heure locale et heure UTC (Corban, 2026-10-31).
const fmtUtc = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
const fmtTime2 = (d) => `${fmtTime(d)} (${fmtUtc(d)})`;
// À l'écran : l'heure UTC seule, et un effleurement affiche l'heure locale pendant 3 s (Corban, 2026-10-31).
// Sur papier, dans les fichiers et les messages, les deux heures restent écrites.
// Procédures du lac : heure locale seulement, aucune heure UTC (Corban, v183).
let tzLocalOnly = false;
const tzHtml = (d, sec) => { d = d instanceof Date ? d : new Date(d); if (tzLocalOnly) return `<time class="tz-loc">${pad(d.getHours())}:${pad(d.getMinutes())}${sec ? ':' + pad(d.getSeconds()) : ''}</time>`; const u = sec ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; return `<time class="tz" data-t="${d.toISOString()}"${sec ? ' data-s="1"' : ''}>${u}<small>UTC</small></time>`; };
function tzShowLocal(el) {
  const d = new Date(el.dataset.t), sec = el.dataset.s;
  if (!el.dataset.utc) el.dataset.utc = el.innerHTML;
  el.innerHTML = `${pad(d.getHours())}:${pad(d.getMinutes())}${sec ? ':' + pad(d.getSeconds()) : ''}<small>locale</small>`;
  el.classList.add('tz-local');
  clearTimeout(el._tzT);
  el._tzT = setTimeout(() => { el.innerHTML = el.dataset.utc; delete el.dataset.utc; el.classList.remove('tz-local'); }, 3000);
}
document.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest('time.tz'); if (el) tzShowLocal(el); }, { passive: true });
// Toucher l'heure ne déclenche pas le bouton ou la ligne qui la contient.
document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('time.tz')) { e.stopPropagation(); e.preventDefault(); } }, true);
let clockLocalUntil = 0;
const fmtDate = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDur = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const fmtShortDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const toLocalInput = (d) => `${dayKey(d)}T${fmtTime(d)}`;
const crewNames = () => cruise.crew.map((m) => m.nom).filter(Boolean);
const fieldByKey = (k) => activeFields().find((f) => f.key === k);

function fmtNum(f, v) {
  if (v == null || v === '') return '';
  const s = Number(v).toFixed(f.decimals).replace('.', ',');
  return f.pad ? s.padStart(f.pad, '0') : s;
}
function fmtCoord(val, isLat) {
  const h = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  const a = Math.abs(val);
  const d = Math.floor(a);
  const m = ((a - d) * 60).toFixed(3).replace('.', ',');
  return `${pad(d, isLat ? 2 : 3)}°${m.padStart(6, '0')}' ${h}`;
}
const fmtPos = (p) => (!p ? '' : p.text ? p.text : `${fmtCoord(p.lat, true)}  ${fmtCoord(p.lon, false)}`);
function fmtValue(f, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  switch (f.type) {
    case 'number': return f.wind ? windTxt(v) : `${fmtNum(f, v)} ${f.unit}`;
    case 'position': return fmtPos(v);
    case 'multi': return v.join(', ');
    case 'choice': return f.fmt ? f.fmt(v) : v;
    default: return String(v);
  }
}

// v172 : ouvrir un lien tel: / mailto: par un vrai lien touché (dans l'aperçu, la page est dans un cadre : on passe par un nouvel onglet que le téléphone confie à l'appli Téléphone ou Mail).
function openLink(url) {
  const a = document.createElement('a');
  a.href = url; a.rel = 'noopener';
  if (document.documentElement.classList.contains('in-frame')) a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}
let toastTimer;
// La bulle ne doit jamais cacher la touche qu'on vient de toucher ou qu'on va toucher (Corban, v186) :
// si elle la recouvre (touche en bas d'écran), elle passe en haut, sous le bandeau.
let toastTouch = null;
document.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest('button, a, [role="button"], input, summary, .btn, [data-step]'); toastTouch = { el, y: e.clientY, at: Date.now() }; }, true);
function toastPlace(t) {
  t.classList.remove('toast-top');
  const tt = toastTouch; if (!tt || Date.now() - tt.at > 8000) return;
  const r = t.getBoundingClientRect();
  const er = tt.el && tt.el.isConnected ? tt.el.getBoundingClientRect() : { top: tt.y - 30, bottom: tt.y + 30 };
  if (er.bottom > r.top - 12 && er.top < r.bottom + 12) t.classList.add('toast-top');
}
function toast(msg, force) {
  // 2026-11-04 (Corban) : les bulles qui confirment une action, les alarmes et les erreurs s'affichent toujours ;
  // seules les explications passent par les pastilles « i », que le réglage « Bulles d'aide (i) » masque (remplace v339).
  if (window.uiTr) msg = window.uiTr(msg); // v245 : popups dans la langue choisie sur la fiche
  const t = $('#toast');
  t.textContent = String(msg).replace(/ · /g, '\n'); // une idée par ligne (Corban, v113)
  toastPlace(t);
  t.classList.add('show');
  clearTimeout(toastTimer);
  // v392 (Corban) : chaque bulle reste le temps d'une lecture normale : environ 200 mots par minute (0,3 s par mot) + 1,5 s pour la repérer,
  // au moins 2,5 s, au plus 25 s ; un toucher sur l'écran la ferme toujours avant.
  const words = String(msg).trim().split(/\s+/).filter(Boolean).length;
  const dur = Math.max(2500, Math.min(25000, 1500 + words * 300));
  toastTimer = setTimeout(() => t.classList.remove('show'), dur);
  t._dur = dur;
}
// Double appui pour les actions dangereuses : évite les fausses manœuvres avec un écran mouillé.
function armed(btn, label, action) {
  if (btn.dataset.armed) { action(); return; }
  const orig = btn.innerHTML;
  btn.dataset.armed = '1';
  btn.innerHTML = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = orig; } }, 3000);
}

// Suppressions : confirmation par appui long, pas par toucher court (Corban, v184).
// 1er toucher : le bouton passe en orange « Appui long pour supprimer » ; appui long (650 ms) : supprimé ; 5 s sans rien : il revient.
function holdDel(btn, action, label) {
  if (btn._done) return;
  if (btn.dataset.hold) { buzz(); toast('Appui long pour confirmer la suppression'); return; }
  const orig = btn.innerHTML;
  btn.dataset.hold = '1'; btn.classList.add('hold-ask');
  btn.innerHTML = `${label || '🗑 Appui long pour supprimer'}<small>appui long pour confirmer · sinon rien dans 5 s</small>`;
  let t = null;
  const down = () => { clearTimeout(t); t = setTimeout(() => { buzz(); off(); btn.classList.remove('hold-ask'); btn.classList.add('lp-ok'); btn.innerHTML = '✓ Supprimé'; btn._done = true; setTimeout(action, 300); }, 650); };
  const up = () => clearTimeout(t);
  const off = () => { btn.removeEventListener('pointerdown', down); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.removeEventListener(ev, up)); };
  btn.addEventListener('pointerdown', down); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, up));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  setTimeout(() => { if (btn.isConnected && !btn._done) { off(); delete btn.dataset.hold; btn.classList.remove('hold-ask'); btn.innerHTML = orig; } }, 5000);
}

/* ---------- Thème, horloge, écran allumé ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  $('#themeBtn').textContent = settings.theme === 'night' ? '☾' : '☀︎';
  $('meta[name="theme-color"]').content = settings.theme === 'night' ? '#000000' : '#f3f5f8';
}
function tickClock() {
  // v208 (Corban) : en eaux intérieures, Zone Time affichée et toucher = UTC ; en eaux maritimes, l'inverse (selon l'endroit, comme les cartes).
  let inl = false; try { inl = typeof navZone === 'function' && navZone() === 'lac'; } catch (e) { inl = false; }
  const d = new Date(), loc = inl !== (Date.now() < clockLocalUntil);
  // « Zone Time » au lieu de « heure locale », jamais plus large que l'heure au-dessus (Corban, v115).
  $('#clock').innerHTML = loc ? `<span class="clock-t">${fmtTime(d)}</span><small class="clock-utc">Zone Time</small>` : `<span class="clock-t">${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}</span><small class="clock-utc">UTC</small>`;
  $('#clock').classList.toggle('tz-local', loc);
  $('#clock').classList.toggle('tz-utc', !loc);
  document.body.classList.toggle('zone-lac', inl);
  document.body.classList.toggle('zone-auto', !(typeof zoneSimV !== 'undefined' && zoneSimV)); // v317 : petit satellite sur NavIn en mode automatique par GPS // v312 : fond C1 du bouton NavIn actif en eaux intérieures // v307 : UTC en rouge, Zone Time en noir (Corban)
  const ct = $('#clock .clock-t'), cu = $('#clock .clock-utc');
  if (loc && ct && cu) { cu.style.fontSize = ''; cu.style.whiteSpace = 'nowrap'; const w = ct.getBoundingClientRect().width, u = cu.getBoundingClientRect().width; if (u > w && u > 0) cu.style.fontSize = (parseFloat(getComputedStyle(cu).fontSize) * w / u * 0.98).toFixed(2) + 'px'; }
}
// v372 (Corban) : un toucher bascule l'heure (UTC / Zone Time) pendant 5 s ; un 2e toucher pendant ces 5 s revient tout de suite.
document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('#clock')) { if (Date.now() < clockLocalUntil) clockLocalUntil = 0; else { clockLocalUntil = Date.now() + 5000; setTimeout(tickClock, 5050); } tickClock(); } }, { passive: true });
let wakeLock = null;
// Écran allumé : toujours pendant l'enregistrement d'une trace (Corban, 2026-10-31, v87), sinon selon le réglage.
// Sans Wake Lock (anciens iPhone), une petite vidéo muette en boucle joue le même rôle.
let wakeVideo = null;
function wakeVideoOn(on) {
  try {
    if (on) {
      if (!wakeVideo) {
        const c = document.createElement('canvas'); c.width = c.height = 2;
        const g = c.getContext('2d'); let k = 0;
        wakeVideo = document.createElement('video');
        wakeVideo.muted = true; wakeVideo.loop = true; wakeVideo.setAttribute('playsinline', ''); wakeVideo.setAttribute('muted', '');
        wakeVideo.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0';
        if (c.captureStream) { wakeVideo.srcObject = c.captureStream(1); wakeVideo._t = setInterval(() => { g.fillStyle = (k++ % 2) ? '#000' : '#010101'; g.fillRect(0, 0, 2, 2); }, 1000); }
        document.body.appendChild(wakeVideo);
      }
      if (wakeVideo.paused) wakeVideo.play().catch(() => {});
    } else if (wakeVideo) { clearInterval(wakeVideo._t); wakeVideo.pause(); wakeVideo.remove(); wakeVideo = null; }
  } catch {}
}
const wakeWanted = () => !!(settings.wake || (typeof tracking !== 'undefined' && tracking));
async function applyWake() {
  // Trace en cours : le bouton NavIn passe au vert et pulse lentement (Corban, 2026-11-01, v96).
  document.body.classList.toggle('is-tracking', typeof tracking !== 'undefined' && !!tracking);
  const want = wakeWanted() && document.visibilityState === 'visible';
  if (!('wakeLock' in navigator)) return wakeVideoOn(want);
  try {
    if (want) {
      if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; if (wakeWanted() && document.visibilityState === 'visible') setTimeout(applyWake, 500); }); }
    } else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeVideoOn(want); }
}
// Le Wake Lock peut exiger un toucher : on retente au premier toucher si l'écran doit rester allumé.
document.addEventListener('pointerdown', () => { if (wakeWanted() && !wakeLock) applyWake(); }, { passive: true });

/* ---------- Navigation ---------- */
let currentView = 'new';
let settingsFrom = null; // onglet d'où l'on a ouvert les réglages (roue dentée)
let settingsOpen = null; // v343 : rubrique de réglages ouverte en dernier (gardée au rafraîchissement)
let settingsAll = false; // appui long sur la roue : tous les réglages, par section (Corban, v176)
const VIEWS = {};
// Vues utilisables sans navigation ouverte : on prépare check-lists, fiches et procédures à l'avance.
const NO_CRUISE_VIEWS = ['tracker', 'nmea', 'traces', 'prep', 'dock', 'sos', 'nonav', 'cruises', 'settings', 'boats', 'stats', 'ckbases', 'more', 'crew', 'alpha', 'rules', 'docs', 'mob', 'tasktpl', 'dossier', 'zones', 'marks', 'people', 'crews', 'soslogs', 'vhf', 'cartes', 'lists', 'beaufort', 'douglas'];
function go(view, arg = null) {
  if (typeof closeNavPop === 'function') closeNavPop();
  // Sans navigation ouverte : l'onglet s'ouvre quand même et propose d'en démarrer une (v80).
  if (!cruise && !NO_CRUISE_VIEWS.includes(view) && !(view === 'checklist' && arg && arg.boatId)) { arg = view; view = 'nonav'; }
  if (view === 'settings' && !go._gear) settingsFrom = null; // ouvert depuis Plus : réglages généraux
  go._gear = false;
  if (view === 'alpha' && currentView !== 'alpha') alphaBack = ['sos', 'vhf', 'lists'].includes(currentView) ? currentView : 'more';
  // v193 (Corban) : la VHF a deux sections, intérieure (lac) et extérieure (mer, océan) ; plus de renvoi vers SOS.
  if (typeof exitMapFull === 'function' && document.body.classList.contains('map-full')) exitMapFull();
  if (view !== 'map' && view !== 'tracker' && typeof stopMapWatch === 'function') stopMapWatch();
  if (view !== 'tracker' && typeof trk !== 'undefined' && trk) { if (trk.map) trk.map.remove(); trk = null; }
  currentView = view;
  tzLocalOnly = false;
  // Bandeau unique (Corban, 2026-10-31, v91) : NavIn (navigation), DatA (données), SOS, roue dentée.
  const tab = { prep: 'tracker', dock: 'tracker', traces: 'more', new: 'tracker', day: 'more', log: 'more', info: 'more', checklist: 'tracker', crew: 'more', export: 'more', settings: 'more', cruises: 'more', print: 'more', boats: 'more', sheet: 'more', rules: 'more', docs: 'more', ckbases: 'more', aboard: 'more', stats: 'more', map: 'more', tracker: 'tracker', vhf: 'tracker', mob: cruise ? 'sos' : 'more', tasktpl: 'more', dossier: 'more', people: 'more', crews: 'more', soslogs: 'more', marks: 'more', zones: 'more', cartes: 'more', lists: 'more', beaufort: 'more', douglas: 'more', alpha: ['more', 'lists'].includes(alphaBack) ? 'more' : 'sos' }[view] || view;
  const tabOf = (v) => ({ prep: 'tracker', dock: 'tracker', traces: 'more', nmea: 'more', new: 'tracker', day: 'more', log: 'more', info: 'more', checklist: 'tracker', crew: 'more', export: 'more', cruises: 'more', print: 'more', boats: 'more', sheet: 'more', rules: 'more', docs: 'more', ckbases: 'more', aboard: 'more', stats: 'more', map: 'more', vhf: 'tracker', mob: cruise ? 'sos' : 'more', tasktpl: 'more', dossier: 'more', people: 'more', crews: 'more', soslogs: 'more', marks: 'more', zones: 'more', cartes: 'more', lists: 'more', beaufort: 'more', douglas: 'more', alpha: ['more', 'lists'].includes(alphaBack) ? 'more' : 'sos' }[v] || v);
  const activeTab = view === 'nonav' ? tabOf(arg) : view === 'settings' && settingsFrom && settingsFrom !== 'settings' ? tabOf(settingsFrom) : tab;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === activeTab));
  $('#voyageName').textContent = cruise ? `${MODES[curMode()].icon} ${cruise.info.name || ''}` : 'NavIn';
  $('#view').onclick = null;
  document.body.classList.remove('has-prep-fab', 'trk-mode');
  VIEWS[view](arg);
  if (typeof prepBarSync === 'function') prepBarSync(view);
  window.scrollTo(0, 0);
}

/* =====================================================================
   SAISIE HORAIRE (grandes cartes, quasi sans clavier)
   ===================================================================== */
function carriedValues(exclude) {
  const v = {};
  const last = cruise.entries[cruise.entries.length - 1];
  if (settings.prefill && last) {
    for (const f of activeFields()) if (!exclude.includes(f.key) && last.v[f.key] != null) v[f.key] = structuredClone(last.v[f.key]);
  }
  return v;
}
function newDraft() {
  const v = carriedValues(NOT_CARRIED);
  return { t: new Date().toISOString(), v, prefilled: Object.keys(v).length > 0 };
}

VIEWS.new = function renderForm() {
  if (!draft) draft = newDraft();
  const editing = !!draft.id;
  // L'heure suit l'horloge tant qu'elle n'a pas été réglée à la main.
  if (!editing && !draft.tManual) draft.t = new Date().toISOString();
  saveDraft();
  const main = $('#view');
  main.innerHTML = `
    ${editing ? '' : '<div id="checkBanner"></div><div id="autoCard"></div><div id="lakeBtns"></div>'}
    <h1>${editing ? 'Modifier l’entrée' : 'Nouvelle entrée'}</h1>
    ${draft.prefilled && !editing ? '<p class="help">Valeurs reprises de la dernière entrée : ne changez que ce qui a bougé.</p>' : ''}
    <div id="fields"></div>
    <div class="save-bar row ${editing ? 'c2' : ''}">
      ${editing ? '<button class="btn big" id="cancelBtn">Annuler</button>' : ''}
      <button class="btn big primary" id="saveBtn">✔ Enregistrer</button>
    </div>
    ${!editing ? '<div class="row" style="margin-top:16px"><button class="btn" id="resetBtn">Tout effacer et recommencer</button></div>' : ''}`;
  if (!editing) { renderAutoCard(); renderCheckBanner(); renderLakeButtons(); }
  const box = $('#fields');
  // Allure et voiles selon moteur / voile (voir sailHidden et renderLakeButtons).
  const ps = !editing && typeof lakeState === 'function' ? lakeState(dayKey(new Date())) : null;

  for (const f of activeFields()) {
    if (f.type === 'crew' && !crewNames().length) continue;
    const el = document.createElement('section');
    el.className = 'field';
    el.dataset.key = f.key;
    if (ps && SAIL_KEYS.includes(f.key) && sailHidden(f.key, ps)) el.hidden = true;
    box.appendChild(el);
    renderField(f, el);
  }
  $('#saveBtn').onclick = saveDraftAsEntry;
  if (editing) $('#cancelBtn').onclick = () => { draft = null; saveDraft(); go('log'); };
  else $('#resetBtn').onclick = (e) => armed(e.currentTarget, 'Toucher encore pour confirmer', () => {
    draft = { t: new Date().toISOString(), v: {} }; saveDraft(); VIEWS.new();
  });
};

function setVal(f, val) {
  if (val == null || val === '' || (Array.isArray(val) && !val.length)) delete draft.v[f.key];
  else draft.v[f.key] = val;
  saveDraft();
  const el = $(`.field[data-key="${f.key}"]`);
  if (el) renderField(f, el);
}

function renderField(f, el) {
  const v = f.key === 't' ? draft.t : draft.v[f.key];
  const has = f.key !== 't' && v != null && v !== '' && !(Array.isArray(v) && !v.length);
  let html = `<h2><span>${esc(f.label)}</span>${has ? '<button class="clear" data-act="clear">Effacer</button>' : ''}</h2>`;

  if (f.type === 'datetime') {
    const d = new Date(v);
    html += `<div class="value">${tzHtml(d)}<div style="font-size:18px">${esc(fmtDate(d))}</div></div>
      <div class="row c3">
        <button class="btn step" data-min="-5">−5<small>min</small></button>
        <button class="btn primary" data-act="now">Maintenant</button>
        <button class="btn step" data-min="5">+5<small>min</small></button>
      </div>
      <div class="row"><input class="text" type="datetime-local" value="${toLocalInput(d)}" aria-label="Choisir date et heure"></div>`;
  } else if (f.type === 'position') {
    html += `<div class="value ${has ? '' : 'empty'}" style="font-size:${has ? 30 : 40}px">${has ? esc(fmtPos(v)).replace('  ', '<br>') : '– –'}</div>
      ${has && v.acc ? `<p class="help" style="text-align:center">Précision ± ${Math.round(v.acc)} m</p>` : ''}
      <div class="row"><button class="btn big primary" data-act="gps">📍 Position GPS</button></div>
      <div class="row"><button class="btn" data-act="wx">🌬 Vent, mer et baro du modèle météo (réseau)</button></div>
      <div class="row"><input class="text" type="text" placeholder="ou saisir à la main" value="${has && v.text ? esc(v.text) : ''}" aria-label="Position manuelle"></div>`;
  } else if (f.type === 'number') {
    html += `<button class="value ${has ? '' : 'empty'}" data-act="type">${has ? `${fmtNum(f, v)} <span class="unit">${f.unit}</span>${f.wind ? `<span class="hint">${windConv(v)}</span>` : ''}` : '– –<span class="hint">toucher ici pour taper</span>'}</button>
      ${f.rose ? `<div class="row c4">${DIRS8.map(([d, a]) => `<button class="btn ${v === a ? 'on' : ''}" data-set="${a}">${d}</button>`).join('')}</div>` : ''}
      <div class="row c4">${f.steps.map((s) => `<button class="btn step" data-step="${s}">${s > 0 ? '+' : '−'}${String(Math.abs(s)).replace('.', ',')}</button>`).join('')}</div>`;
  } else if (f.type === 'choice' || f.type === 'crew') {
    const opts = f.type === 'crew' ? crewNames().map((x) => [x]) : f.options;
    const cols = f.type === 'crew' ? 2 : f.cols;
    html += `<div class="row c${cols}">${opts.map(([o, sub, h3]) =>
      `<button class="btn ${v === o ? 'on' : ''}" data-opt="${esc(o)}">${esc(o)}${sub ? `<small>${esc(sub)}</small>` : ''}${h3 ? `<small class="opt-h">${esc(h3)}</small>` : ''}</button>`).join('')}</div>`;
  } else if (f.type === 'multi') {
    const sel = v || [];
    html += `<div class="row c${f.cols}">${f.options.map(([o]) =>
      `<button class="btn ${sel.includes(o) ? 'on' : ''}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else if (f.type === 'text') {
    html += `<textarea class="text" placeholder="Le micro du clavier permet de dicter">${esc(v || '')}</textarea>`;
  }
  el.innerHTML = html;
  bindField(f, el);
}

function bindField(f, el) {
  el.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.act === 'clear') return setVal(f, null);
    if (f.type === 'datetime') {
      draft.tManual = b.dataset.act !== 'now';
      if (b.dataset.act === 'now') draft.t = new Date().toISOString();
      if (b.dataset.min) draft.t = new Date(new Date(draft.t).getTime() + Number(b.dataset.min) * 60000).toISOString();
      saveDraft(); renderField(f, el);
    } else if (f.type === 'position' && b.dataset.act === 'gps') {
      getGps(b, (p) => {
        setVal(f, { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy });
        // Le GPS du téléphone donne parfois aussi la vitesse et la route fond.
        if (p.coords.speed != null && !Number.isNaN(p.coords.speed)) setVal(fieldByKey('sog'), Math.round(p.coords.speed * 19.4384) / 10);
        if (p.coords.heading != null && !Number.isNaN(p.coords.heading) && p.coords.speed > 0.5) setVal(fieldByKey('cog'), Math.round(p.coords.heading) % 360);
        toast('Position enregistrée');
      });
    } else if (f.type === 'position' && b.dataset.act === 'wx') {
      const p = draft.v.pos;
      if (!p || p.text) return toast('Prenez d’abord la position GPS');
      b.disabled = true; b.textContent = '⏳ Météo…';
      fetchWeather(p.lat, p.lon, new Date(draft.t)).then((w) => {
        applyWeather(draft.v, w);
        saveDraft();
        for (const k of ['twd', 'tws', 'baro', 'vagues', 'mer', 'allure']) { const el2 = $(`.field[data-key="${k}"]`); if (el2) renderField(fieldByKey(k), el2); }
        toast(w.src ? `Météo ajoutée : ${w.src}` : 'Météo ajoutée');
      }).catch(() => toast('Pas de réseau : météo indisponible'))
        .finally(() => { b.disabled = false; b.textContent = '🌬 Vent, mer et baro du modèle météo (réseau)'; });
    } else if (f.type === 'number') {
      if (b.dataset.act === 'type') return typeNumber(f, el);
      if (b.dataset.set != null) return setVal(f, Number(b.dataset.set));
      const cur = draft.v[f.key] ?? f.start;
      let x = Math.round((Number(cur) + Number(b.dataset.step)) * 10 ** f.decimals) / 10 ** f.decimals;
      if (f.wrap) x = ((x % (f.max + 1)) + (f.max + 1)) % (f.max + 1);
      else x = Math.min(f.max, Math.max(f.min, x));
      setVal(f, x);
    } else if (f.type === 'choice' || f.type === 'crew') {
      const o = b.dataset.opt;
      setVal(f, draft.v[f.key] === o ? null : o);
    } else if (f.type === 'multi') {
      const o = b.dataset.opt;
      const sel = new Set(draft.v[f.key] || []);
      sel.has(o) ? sel.delete(o) : sel.add(o);
      setVal(f, [...sel]);
    }
  };
  if (f.type === 'datetime') {
    $('input', el).onchange = (e) => { if (e.target.value) { draft.t = new Date(e.target.value).toISOString(); draft.tManual = true; saveDraft(); renderField(f, el); } };
  }
  if (f.type === 'position') {
    $('input', el).onchange = (e) => { const t = e.target.value.trim(); setVal(f, t ? { text: t } : null); };
  }
  if (f.type === 'text') {
    $('textarea', el).oninput = (e) => { if (e.target.value) draft.v[f.key] = e.target.value; else delete draft.v[f.key]; saveDraft(); };
  }
}

function typeNumber(f, el) {
  const cur = draft.v[f.key];
  $('.value', el).outerHTML = `<div class="row" style="margin-bottom:12px;grid-template-columns:2fr 1fr">
    <input class="text" type="text" inputmode="decimal" style="font-size:34px;text-align:center" value="${cur != null ? fmtNum(f, cur) : ''}" aria-label="${esc(f.label)}">
    <button class="btn primary" data-act="ok">OK</button></div>`;
  const input = $('input', el);
  input.focus(); input.select();
  const commit = () => {
    const x = num(input.value);
    if (input.value.trim() === '') return setVal(f, null);
    if (x == null || x < f.min || x > f.max) { toast(`Valeur entre ${f.min} et ${f.max}`); return; }
    setVal(f, Math.round(x * 10 ** f.decimals) / 10 ** f.decimals);
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
  el.onclick = (e) => { if (e.target.closest('[data-act="ok"]')) commit(); };
}

function getGps(btn, ok) {
  if (!('geolocation' in navigator)) return toast('GPS non disponible sur cet appareil');
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '⏳ Recherche GPS…';
  navigator.geolocation.getCurrentPosition(
    (p) => { btn.disabled = false; btn.innerHTML = label; ok(p); },
    (err) => {
      btn.disabled = false; btn.innerHTML = label;
      toast(err.code === 1 ? 'Autorisez la localisation dans les réglages' : 'Pas de signal GPS, réessayez');
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
  );
}

function addEntry(entry) {
  const i = cruise.entries.findIndex((e) => e.id === entry.id);
  if (i >= 0) cruise.entries[i] = entry; else cruise.entries.push(entry);
  cruise.entries.sort((a, b) => a.t.localeCompare(b.t));
  return saveCruise();
}

function saveDraftAsEntry() {
  buzz();
  const old = draft.id ? cruise.entries.find((e) => e.id === draft.id) : null;
  const entry = { id: draft.id || uid(), t: draft.t, v: draft.v };
  if (old && old.auto) entry.auto = true;
  if (!addEntry(entry)) return;
  const wasEdit = !!draft.id;
  draft = null; saveDraft();
  toast(wasEdit ? '✔ Entrée modifiée' : `✔ Entrée de ${fmtTime2(new Date(entry.t))} enregistrée`);
  go(wasEdit ? 'log' : 'new');
}

/* =====================================================================
   FORMULAIRES COMPACTS (journée, bateau, équipage) — enregistrement auto
   ===================================================================== */
// v237 (Corban) : Vₘₐₓ (max en indice) et x̄ (moyenne) gardent leur forme dans les intitulés en majuscules.
const labHtml = (t) => esc(t).replace(/(\u2098\u2090\u2093|\u2098\u1d62\u2099)/g, (m) => `<sub class="lab-nc">${m === '\u2098\u2090\u2093' ? 'max' : 'min'}</sub>`).replace('x̄', '<span class="lab-nc">x̄</span>');
function compactField(f, v, data = {}) {
  const id = 'f_' + f.key + '_' + Math.random().toString(36).slice(2, 6);
  // v212 : case cachée tant qu'elle est vide (2e réservoir), révélée par le bouton ＋ de la case précédente.
  // v216 : traduction anglaise affichée sous la case (textes radio et SOS).
  if (f.en) return compactField(Object.assign({}, f, { en: null }), v, data).replace(/<\/div>$/, `<small class="en-tr">${v ? '🇬🇧 ' + esc(descEn(v)) : ''}</small></div>`);
  if (f.addMore || f.reveal) {
    let h = compactField(Object.assign({}, f, { addMore: null, reveal: null }), v, data);
    if (f.reveal && (v == null || v === '')) h = h.replace('<div class="cf', '<div class="cf rev-hide');
    if (f.addMore && (data[f.addMore.key] == null || data[f.addMore.key] === '')) h = h.replace(/<\/div>$/, `<button type="button" class="more-add no-navact" data-reveal="${f.addMore.key}">＋ ${esc(f.addMore.label)}</button></div>`);
    return h;
  }
  // Intitulé tournant (v175, Corban) : toucher l'intitulé change le type (ex. passeport ⇄ carte d'identité).
  if (f.labelCycle) { const lc = f.labelCycle, cur = (data && data[lc.key]) || lc.options[0];
    return compactField(Object.assign({}, f, { labelCycle: null, label: '\u0000' }), v, data).replace('\u0000', '').replace(/<label for="([^"]*)">/, `<label for="$1"><button type="button" class="lab-cyc" data-lcyc="${lc.key}" data-main="${f.key}" data-val="${esc(cur)}" data-opts="${esc(lc.options.join('|'))}" data-pre="${esc(lc.prefix || '')}" data-suf="${esc(lc.suffix || '')}">${esc((lc.prefix || '') + cur + (lc.suffix || ''))}</button>`); }
  const lab = f.label || f.unitOnly ? `<label for="${id}">${f.label ? labHtml(f.label) : ''}${f.unit ? ` <span class="u">(${esc(f.unit)})</span>` : ''}${f.rule ? `<small class="rule"${v != null && v !== '' ? ' hidden' : ''}>${esc(f.rule())}</small>` : ''}</label>` : '';
  const wide = f.wide || (['area', 'check', 'tides', 'calc', 'choice', 'crewpick'].includes(f.type) && !f.cycle) ? ' wide' : '';
  switch (f.type) {
    case 'group': {
      const cur = data[f.sel] || f.fields[0].options[0][0];
      return `<div class="cf wide cf-group" data-grp="${f.sel}">${lab}<div class="grp-in">${f.fields.map((sf) => compactField(sf, data[sf.key], data).replace('<div class="cf', `<div data-when="${esc(sf.when || '')}"${sf.when && sf.when !== cur ? ' hidden' : ''} class="cf`)).join('')}</div></div>`;
    }
    case 'sails': {
      const names = String(v || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean), descs = Array.isArray(data.voilesDesc) ? data.voilesDesc : [];
      if (!names.length) names.push('');
      const ph = 'inscription ou dessin', cols = Array.isArray(data.voilesColor) ? data.voilesColor : [];
      return `<div class="cf wide sails-box" data-sk="${f.key}">${lab}
        <div class="sail-row"><span class="sail-fixed">Grand-voile</span><div class="sail-cd">${sailColBtn(data.gvColor, true)}<input class="text sail-desc" data-gv="1" type="text" value="${esc(data.gvDesc || '')}" placeholder="${ph}"></div><small class="en-tr sail-line">${sailLineHtml('Grand-voile', data.gvColor, data.gvDesc)}</small></div>
        <div class="sail-sub">Voiles d’avant</div>
        <div class="sail-list">${names.map((x, i) => `<div class="sail-row"><input class="text sail-name" type="text" value="${esc(x)}" placeholder="${i ? 'voile d’avant suivante' : '1re voile d’avant (ex. génois)'}"><div class="sail-cd">${sailColBtn(cols[i])}<input class="text sail-desc" type="text" value="${esc(descs[i] || '')}" placeholder="${ph}"></div><small class="en-tr sail-line">${sailLineHtml(x, cols[i], descs[i])}</small></div>`).join('')}</div>
        <button type="button" class="more-add no-navact sail-add">＋ Ajouter une voile d’avant</button></div>`;
    }
    // v205 (Corban) : liste de pastilles (une par voile d'avant) + bouton ＋ pour en ajouter autant que nécessaire.
    case 'multi': {
      const items = String(v || '').split(/[,;\n]/).map((x) => x.trim()).filter(Boolean); if (!items.length) items.push('');
      return `<div class="cf wide multi-box" data-mk="${f.key}">${lab}<div class="multi-list">${items.map((x, i) => `<input class="text multi-it" ${i ? '' : `id="${id}"`} type="text" value="${esc(x)}" placeholder="${esc(f.placeholder || '')}">`).join('')}<button type="button" class="multi-add" aria-label="${esc(f.addLabel || 'Ajouter')}">＋</button></div></div>`;
    }
    case 'line': case 'date': case 'clock': case 'num': {
      const type = f.type === 'date' ? 'date' : f.type === 'clock' ? 'time' : 'text';
      const im = f.type === 'num' ? 'decimal' : f.inputmode || '';
      const min = f.minFrom && data[f.minFrom] ? `min="${esc(data[f.minFrom])}"` : '';
      const av = f.auto ? autoVal(f, data) : '';
      // v157 : texte libre qui va à la ligne au lieu d'être coupé (la case grandit avec le texte).
      if (f.grow && f.type === 'line') return `<div class="cf${wide}">${lab}<textarea class="text grow" id="${id}" data-k="${f.key}" rows="1" ${im ? `inputmode="${im}"` : ''} placeholder="${esc(f.placeholder || '')}">${esc(v ?? '')}</textarea></div>`;
      const pre = f.prefix ? `<div class="pfx-wrap"><span class="pfx" aria-hidden="true">${esc(f.prefix)}</span>` : '', post = f.prefix ? '</div>' : '';
      return `<div class="cf${wide}">${lab}${pre}<input class="text${f.auto ? ((f.manual ? f.manual(data) : v != null && v !== '') ? ' auto-man' : (v != null && v !== '' ? '' : ' auto-calc')) : ''}" id="${id}" data-k="${f.key}" type="${type}" ${min} ${im ? `inputmode="${im}"` : ''} placeholder="${esc(f.placeholder || '')}" value="${esc(v ?? av)}"${f.wind ? ' data-wind="1"' : ''}${f.lock ? ' data-lock="1"' : ''}${f.contact ? ` data-contact="${f.contact}"` : ''}${f.expiry ? ' data-exp="1"' : ''}>${post}${f.expiry ? '<small class="exp-note"></small>' : ''}${f.wind ? `<small class="conv">${windConv(v)}</small>` : ''}</div>`;
    }
    case 'descgen': {
      const man = v != null && v !== '';
      const en = man ? v : radioDesc(data, 'en', true);
      return `<div class="cf wide">${lab}<button type="button" class="desc-say${man ? ' auto-man' : ''}" data-desc="${f.key}">${esc(en || '…')}</button>
        <details class="desc-edit"><summary>✎ Forcer le texte (anglais)</summary><textarea class="text${man ? ' auto-man' : ' auto-calc'}" id="${id}" data-k="${f.key}" rows="3">${esc(en)}</textarea></details></div>`;
    }
    case 'area':
      return `<div class="cf${wide}">${lab}<textarea class="text fit" id="${id}" data-k="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v ?? '')}</textarea></div>`;
    case 'choice': case 'crewpick': {
      const opts = f.type === 'crewpick' ? crewNames().map((x) => [x]) : f.options;
      if (!opts.length) return `<div class="cf wide">${lab}<input class="text" id="${id}" data-k="${f.key}" type="text" value="${esc(v ?? '')}"></div>`;
      // Une seule pastille qui alterne entre les choix à chaque appui (Corban, v155 : pas d'hélice Bâbord / Tribord).
      if (f.cycle) return `<div class="cf${wide}">${lab}<div class="chips" data-k="${f.key}"><button class="btn cyc ${v ? 'on' : ''}${f.short ? ' cyc-short' : ''}"${f.free ? ' data-free="1"' : ''}${f.show ? ` data-show="${esc(JSON.stringify(f.show))}"` : ''} data-val="${esc(v || '')}" data-cyc="${esc(opts.map((o) => o[0]).join('|'))}">${esc(cycTxt(f.show, v, opts.map((o) => o[0])))}</button></div></div>`;
      return `<div class="cf${wide}">${lab}<div class="chips" data-k="${f.key}">${opts.map(([o, sub, h3]) =>
        `<button class="btn ${v === o ? 'on' : ''}" data-opt="${esc(o)}">${esc(o)}${sub ? ` <small>${esc(sub)}</small>` : ''}${h3 ? `<small class="opt-h">${esc(h3)}</small>` : ''}</button>`).join('')}</div></div>`;
    }
    case 'check': {
      const sel = v || [];
      return `<div class="cf wide"><div class="checks" data-k="${f.key}" data-multi="1">${f.options.map((o) =>
        `<button class="btn check ${sel.includes(o) ? 'on' : ''}" data-opt="${esc(o)}"><span class="box">${sel.includes(o) ? '✔' : ''}</span>${esc(o)}</button>`).join('')}</div></div>`;
    }
    case 'tides': {
      const rows = v || [{}, {}, {}, {}];
      return `<div class="cf wide"><div class="tides">${rows.map((r, i) => `
        <div class="tide" data-i="${i}">
          <div class="chips small">${['PM', 'BM'].map((t) => `<button class="btn ${r.type === t ? 'on' : ''}" data-tt="${t}">${t}</button>`).join('')}</div>
          <input class="text" type="time" data-tf="h" value="${esc(r.h || '')}" aria-label="Heure">
          <input class="text" type="text" inputmode="decimal" data-tf="m" placeholder="haut. m" value="${esc(r.m || '')}" aria-label="Hauteur">
        </div>`).join('')}</div></div>`;
    }
    case 'signature':
      return `<div class="cf wide">${lab}<button class="sig-preview" data-sigopen="${f.key}" data-label="${esc(f.label)}">${v ? `<img src="${v}" alt="Signature">` : '<span>✍ Toucher pour signer</span>'}</button>
        ${v ? `<div class="row c2"><button class="btn" data-sigopen="${f.key}" data-label="${esc(f.label)}">✍ Signer à nouveau</button><button class="btn" data-sigclear="${f.key}">Effacer</button></div>` : ''}</div>`;
    case 'calc':
      return `<div class="cf wide calc" data-calc="${f.key}"></div>`;
  }
  return '';
}

// Rend une liste de sections et branche l'enregistrement automatique sur l'objet `data`.
// Texte d'une pastille tournante : la valeur (ou son affichage propre, ex. « < Bâbord »), sinon les choix.
function cycTxt(show, v, opts) {
  if (show && !v && show['']) return show[''];
  if (show) return v ? (show[v] || v) : opts.map((o) => show[o] || o).join(Object.values(show).some((x) => /[<>]/.test(x)) ? '  ' : ' / ');
  return v ? v : opts.join(' / ');
}
// v229 (Corban) : un champ « pairNext » partage son cadre avec le champ suivant (n° de pièce + date d'expiration).
const flatFields = (fs) => fs.flatMap((f) => (f.type === 'group' ? [f, ...f.fields] : [f]));
function cfFields(fields, data) {
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.pairNext && fields[i + 1]) { out.push(`<div class="cf wide cf-pair">${compactField(f, data[f.key], data)}${compactField(fields[i + 1], data[fields[i + 1].key], data)}</div>`); i++; }
    else if (f.frame) { let j = i; const h = []; while (j < fields.length && fields[j].frame === f.frame) { h.push(compactField(fields[j], data[fields[j].key], data)); j++; } out.push(`<div class="cf wide cf-pair cf-frame" data-frame="${f.frame}">${h.join('')}</div>`); i = j - 1; }
    else out.push(compactField(f, data[f.key], data));
  }
  return out.join('');
}
// v229 (Corban) : date d'expiration. Rouge = plus valable, jaune = plus valable dans les 3 mois.
function expParse(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], m[2] - 1, +m[3]);
  if ((m = s.match(/(\d{1,2})\s*[.\/\- ]\s*(\d{1,2})\s*[.\/\- ]\s*(\d{2,4})/))) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, m[2] - 1, +m[1]); }
  if ((m = s.match(/^(\d{1,2})\s*[.\/\- ]\s*(\d{4})$/))) return new Date(+m[2], +m[1], 0);
  return null;
}
function expState(s) {
  const d = expParse(s); if (!d || isNaN(d)) return '';
  const t = new Date(); t.setHours(0, 0, 0, 0); const lim = new Date(t); lim.setMonth(lim.getMonth() + 3);
  return d < t ? 'bad' : d < lim ? 'warn' : 'ok';
}
function expPaint(el) {
  const st = expState(el.value); el.classList.toggle('exp-warn', st === 'warn'); el.classList.toggle('exp-bad', st === 'bad');
  const sm = el.parentNode.querySelector('.exp-note'); if (sm) sm.textContent = st === 'bad' ? 'Expirée' : st === 'warn' ? 'Expire dans moins de 3 mois' : '';
}
function compactForm(container, sections, data, onChange, flat) {
  container.innerHTML = flat
    ? `<div class="cgrid">${cfFields(sections[0].fields, data)}</div>`
    : sections.map((s, i) => `
    <details class="section" ${s.collapsed ? '' : 'open'} data-s="${i}">
      <summary>${esc(s.title)}</summary>
      <div class="cgrid">${cfFields(s.fields, data)}</div>
    </details>`).join('');
  const all = flatFields(sections.flatMap((s) => s.fields));
  // v238 : cadre groupé (énergie de propulsion) : seules les cases du choix en cours sont visibles.
  const applyGroups = () => $$('.cf-group[data-grp]', container).forEach((g) => { const f = all.find((x) => x.type === 'group' && x.sel === g.dataset.grp); const cur = data[g.dataset.grp] || (f ? f.fields[0].options[0][0] : ''); $$('[data-when]', g).forEach((c) => { c.hidden = !!c.dataset.when && c.dataset.when !== cur; }); });
  const ELEC_ONLY = all.filter((f) => f.elecOnly || f.gasOnly).map((f) => [f.key, !!f.elecOnly]);
  const applyElec = () => { ELEC_ONLY.forEach(([k, el1]) => $$(`[data-k="${k}"]`, container).forEach((el) => { const c = el.closest('.cf'); if (c) c.hidden = el1 ? data.propType !== 'Électrique' : data.propType === 'Électrique'; })); $$('.cf-frame', container).forEach((fr) => { const kids = [...fr.querySelectorAll('.cf')]; if (kids.length) fr.hidden = kids.every((x) => x.hidden); }); };
  requestAnimationFrame(applyElec);
  container.addEventListener('click', () => setTimeout(() => { applyGroups(); applyElec(); }, 0));
  requestAnimationFrame(() => $$('input[data-exp]', container).forEach(expPaint));
  container.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.exp) expPaint(e.target); });
  const fitGrow = (t) => { if (!t.scrollHeight) return; const v = t.value; if (!v && t.placeholder) t.value = t.placeholder; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; t.value = v; };
  const fitAll = () => $$('textarea.grow, textarea.fit', container).forEach(fitGrow);
  requestAnimationFrame(fitAll);
  container.addEventListener('toggle', fitAll, true);
  // Intitulé tournant protégé (passeport ⇄ carte d'identité, v177) : appui long pendant la demande = confirmer.
  const lcycRestore = (b) => { clearTimeout(b._t); delete b.dataset.step; b.classList.remove('cyc-ask'); const opts = b.dataset.opts.split('|'); const cur = data[b.dataset.lcyc] || opts[0]; b.dataset.val = cur; b.textContent = (b.dataset.pre || '') + cur + (b.dataset.suf || ''); };
  container.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('.lab-cyc'); if (!b || b.dataset.step !== '1') return;
    clearTimeout(b._lp_t);
    b._lp_t = setTimeout(() => {
      const opts = b.dataset.opts.split('|'), k = b.dataset.lcyc;
      const nv = opts[(Math.max(0, opts.indexOf(data[k] || opts[0])) + 1) % opts.length];
      b._lp = true; buzz(); set(k, nv); lcycRestore(b); toast(`✓ Modifié : ${(b.dataset.pre || '') + nv + (b.dataset.suf || '')}`);
    }, 650);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => container.addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest('.lab-cyc'); if (b) clearTimeout(b._lp_t); }));
  // Pastille alternée (pas d'hélice) : appui long = confirmer le changement proposé (Corban, v161).
  const cycDisp = (b, v) => ((b.dataset.show ? JSON.parse(b.dataset.show)[v] : '') || v || '').replace(/[<>]/g, '').trim();
  const cycRestore = (b, k) => { clearTimeout(b._t); delete b.dataset.step; b.dataset.val = data[k] || ''; b.classList.remove('cyc-ask', 'lp-ok'); const opts = b.dataset.cyc.split('|'); b.textContent = cycTxt(b.dataset.show ? JSON.parse(b.dataset.show) : null, data[k], opts); b.classList.toggle('on', !!data[k]); };
  container.addEventListener('pointerdown', (e) => {
    const b = e.target.closest && e.target.closest('.cyc'); if (!b || b.dataset.step !== '1') return;
    const k = b.closest('[data-k]').dataset.k; const opts = b.dataset.cyc.split('|');
    clearTimeout(b._lp_t);
    b._lp_t = setTimeout(() => {
      const nv = opts[(opts.indexOf(data[k]) + 1) % opts.length];
      b._lp = true; buzz(); set(k, nv); cycRestore(b, k);
      b.classList.add('lp-ok'); b.textContent = '✓ ' + cycDisp(b, nv); toast(`✓ Modifié : ${cycDisp(b, nv)}`);
      setTimeout(() => cycRestore(b, k), 1200);
    }, 650);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => container.addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest('.cyc'); if (b) clearTimeout(b._lp_t); }));
  container.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.cyc')) e.preventDefault(); });
  container.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList.contains('grow')) { e.preventDefault(); e.target.blur(); } });
  container.addEventListener('input', (e) => { if (e.target.classList.contains('grow') || e.target.classList.contains('fit')) fitGrow(e.target); });
  const refreshCalcs = () => all.filter((f) => f.type === 'calc').forEach((f) => {
    const el = $(`[data-calc="${f.key}"]`, container);
    if (el) el.innerHTML = f.calc(data);
  });
  // Cases calculées (pied de pilote, marge de hauteur) : suivent le calcul tant qu'on ne les a pas saisies.
  // v169 (Corban) : données de navigation critiques protégées. Une case remplie est verrouillée ;
  // un appui court explique, un appui long déverrouille, la case se reverrouille en la quittant.
  // v171 : téléphone et courriel remplis = liens (appui court : appeler / écrire ; appui long : modifier).
  const lockSync = (el) => { if (!(el.dataset.lock || el.dataset.contact) || el === document.activeElement || el.dataset.open) return; const has = el.value.trim() !== ''; el.readOnly = has; el.classList.toggle(el.dataset.contact ? 'contact-on' : 'locked', has); };
  const lockLabel = (el) => { const f = all.find((x) => x.key === el.dataset.k); return f ? f.label : 'Cette donnée'; };
  container.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('input.locked, input.contact-on'); if (!el) return;
    clearTimeout(el._lk);
    el._lk = setTimeout(() => {
      el.dataset.open = '1'; el.readOnly = false; el.classList.remove('locked', 'lock-ask', 'contact-on'); el.classList.add('unlocked'); el._lpDone = true; buzz();
      toast(`${lockLabel(el)} : modification autorisée · relâchez puis saisissez`);
    }, 650);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => container.addEventListener(ev, (e) => { const el = e.target.closest && e.target.closest('[data-lock],[data-contact]'); if (el) clearTimeout(el._lk); }));
  container.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-lock],[data-contact]'); if (!el) return;
    if (el.classList.contains('contact-on')) {
      e.preventDefault(); el.blur(); buzz();
      const v = el.value.trim();
      toast(el.dataset.contact === 'tel' ? `Appel : ${v} · appui long pour modifier` : `Courriel : ${v} · appui long pour modifier`);
      openLink(el.dataset.contact === 'tel' ? 'tel:' + v.replace(/[^\d+]/g, '') : 'mailto:' + v);
      return;
    }
    if (el.classList.contains('locked')) {
      e.preventDefault(); el.blur(); buzz(); el.classList.add('lock-ask'); clearTimeout(el._ask); el._ask = setTimeout(() => el.classList.remove('lock-ask'), 2500);
      toast(`${lockLabel(el)} : donnée de navigation protégée · appui long sur la case pour la modifier · sinon la valeur reste`);
    } else if (el._lpDone) { el._lpDone = false; el.focus(); }
  });
  container.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-lock],[data-contact]')) e.preventDefault(); });
  container.addEventListener('focusout', (e) => { const el = e.target; if (!el.dataset || !(el.dataset.lock || el.dataset.contact)) return; delete el.dataset.open; el.classList.remove('unlocked'); setTimeout(() => lockSync(el), 0); });
  requestAnimationFrame(() => $$('[data-lock],[data-contact]', container).forEach(lockSync));
  const refreshAutos = () => all.filter((f) => f.auto).forEach((f) => {
    const el = $(`[data-k="${f.key}"]`, container);
    if (!el) return;
    const stored = data[f.key] != null && data[f.key] !== '';
    const man = f.manual ? f.manual(data) : stored;
    el.classList.toggle('auto-man', man); el.classList.toggle('auto-calc', !stored);
    // Valeur saisie (pas calculée) : on cache la règle de calcul (Corban, v143).
    const rl = el.closest('.cf') && el.closest('.cf').querySelector('small.rule'); if (rl) rl.hidden = stored;
    if (!stored && el !== document.activeElement) el.value = autoVal(f, data);
    lockSync(el);
  });
  const set = (k, val) => {
    if (val == null || val === '' || (Array.isArray(val) && !val.length)) delete data[k]; else data[k] = val;
    const af = all.find((x) => x.key === k && x.auto);
    if (af && data[k] != null && String(data[k]) === autoVal(af, Object.assign({}, data, { [k]: undefined }))) delete data[k];
    if (af && af.pair) {
      const sk = 'pairSrc_' + [k, af.pair].sort().join('_');
      const hk = data[k] != null && data[k] !== '', ho = data[af.pair] != null && data[af.pair] !== '';
      if (hk && !ho) data[sk] = k; else if (!hk && ho) data[sk] = af.pair;
    }
    onChange(k);
    refreshCalcs();
    refreshAutos();
    if (k === 'waters') applyWaters();
  };
  // Bateau en eaux intérieures : MMSI, indicatif, VHF et description radio ne se remplissent pas (Corban, v197).
  const applyWaters = () => {
    if (!all.some((f) => f.key === 'waters')) return;
    const inl = data.waters === 'Eaux intérieures';
    WATERS_SEA_ONLY.forEach((k) => $$(`[data-k="${k}"], [data-desc="${k}"]`, container).forEach((el) => { const c = el.closest('.cf') || el; c.classList.toggle('waters-hide', inl); }));
    $$('details.section', container).forEach((d) => { const g = d.querySelector('.cgrid'); if (g) d.classList.toggle('waters-hide', inl && g.children.length > 0 && [...g.children].every((c) => c.classList.contains('waters-hide'))); });
  };
  requestAnimationFrame(applyWaters);
  container.addEventListener('focusout', () => setTimeout(refreshAutos, 0));
  container.addEventListener('input', (e) => {
    const el = e.target; if (!el.matches || !el.matches('input, textarea')) return;
    if (el.closest('.sails-box')) return; // v423 : lignes des voiles mises à jour par sailsSave
    const sm = el.classList.contains('sail-desc') ? el.closest('.sail-row').querySelector('small.en-tr') : (el.closest('.cf') && el.closest('.cf').querySelector(':scope > small.en-tr'));
    if (sm && sm.classList.contains('en-tr')) sm.textContent = el.value.trim() ? '🇬🇧 ' + descEn(el.value) : '';
  });
  // v214 : voiles (grand-voile + voiles d'avant) avec leur description ; « A, B, C » gardé pour les boutons de voiles.
  const sailsSave = (box) => {
    const gv = $('[data-gv]', box); set('gvDesc', gv.value.trim()); const gc = $('[data-gvcol]', box); set('gvColor', (gc && gc.dataset.col) || null);
    const rows = $$('.sail-list .sail-row', box).map((r) => { const c = $('.sail-col', r); return [$('.sail-name', r).value.trim(), $('.sail-desc', r).value.trim(), (c && c.dataset.col) || '']; }).filter(([nm]) => nm);
    set('voilesDesc', rows.some(([, d]) => d) ? rows.map(([, d]) => d) : null);
    set('voilesColor', rows.some(([, , c]) => c) ? rows.map(([, , c]) => c) : null);
    $$('.sail-row', box).forEach((r) => { const sm = $('small.sail-line', r); if (!sm) return; const nm = r.querySelector('.sail-fixed') ? 'Grand-voile' : ($('.sail-name', r) || {}).value, c = $('.sail-col', r); sm.innerHTML = sailLineHtml(nm, c && c.dataset.col, ($('.sail-desc', r) || {}).value); });
    set(box.dataset.sk, rows.map(([nm]) => nm).join(', '));
  };
  container.addEventListener('input', (e) => { const box = e.target.closest && e.target.closest('.sails-box'); if (box && e.target.matches('input')) sailsSave(box); });
  container.addEventListener('click', (e) => {
    const cb = e.target.closest && e.target.closest('.sail-col'); if (!cb) return;
    e.preventDefault(); buzz();
    const i = SAIL_COLORS.findIndex(([n]) => n === cb.dataset.col), nx = i + 1 < SAIL_COLORS.length ? SAIL_COLORS[i + 1][0] : '';
    const t = document.createElement('div'); t.innerHTML = sailColBtn(nx, !!cb.dataset.gvcol); const nb = t.firstChild; cb.replaceWith(nb);
    const box = nb.closest('.sails-box'); if (box) sailsSave(box);
  });
  container.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.sail-add'); if (!a) return;
    e.preventDefault(); buzz();
    const box = a.closest('.sails-box'), list = $('.sail-list', box), rows = $$('.sail-row', list), last = rows[rows.length - 1];
    if (last && !$('.sail-name', last).value.trim() && !$('.sail-desc', last).value.trim()) { $('.sail-name', last).focus(); return; }
    const r = document.createElement('div'); r.className = 'sail-row';
    r.innerHTML = `<input class="text sail-name" type="text" placeholder="voile d’avant suivante (ex. foc, spi)"><div class="sail-cd">${sailColBtn('')}<input class="text sail-desc" type="text" placeholder="inscription ou dessin"></div><small class="en-tr sail-line"></small>`;
    list.appendChild(r); $('.sail-name', r).focus();
  });
  container.addEventListener('focusout', (e) => {
    const r = e.target.closest && e.target.closest('.sail-list .sail-row'); if (!r) return;
    setTimeout(() => { if (r.contains(document.activeElement) || $('.sail-name', r).value.trim() || $('.sail-desc', r).value.trim()) return; const list = r.parentNode; if (list && list.children.length > 1) r.remove(); }, 200);
  });
  // v205 : listes de pastilles (voiles d'avant) enregistrées « A, B, C » pour rester compatibles avec les boutons de voiles.
  const multiSave = (box) => set(box.dataset.mk, $$('.multi-it', box).map((i) => i.value.trim()).filter(Boolean).join(', '));
  container.addEventListener('input', (e) => { const box = e.target.classList && e.target.classList.contains('multi-it') && e.target.closest('[data-mk]'); if (box) multiSave(box); });
  container.addEventListener('click', (e) => {
    const r = e.target.closest && e.target.closest('[data-reveal]'); if (!r) return;
    e.preventDefault(); buzz();
    const inp = $(`[data-k="${r.dataset.reveal}"]`, container), cell = inp && inp.closest('.cf');
    if (cell) { cell.classList.remove('rev-hide'); inp.focus(); }
    r.remove();
  });
  container.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.multi-add'); if (!a) return;
    e.preventDefault(); buzz();
    const box = a.closest('[data-mk]'), its = $$('.multi-it', box), last = its[its.length - 1];
    if (last && !last.value.trim()) { last.focus(); return; }
    const i = document.createElement('input'); i.className = 'text multi-it'; i.type = 'text'; i.placeholder = 'Voile';
    a.before(i); i.focus();
  });
  container.addEventListener('focusout', (e) => {
    const el = e.target; if (!el.classList || !el.classList.contains('multi-it') || el.value.trim()) return;
    setTimeout(() => { const box = el.closest('[data-mk]'); if (box && document.activeElement !== el && $$('.multi-it', box).length > 1) el.remove(); }, 200);
  });
  // Description radio : le bouton suit les données ; toucher = version française pendant 3 s (comme l'heure UTC / Zone Time).
  const descTxt = (k, lang) => (data[k] ? data[k] : radioDesc(data, lang, true)) || '…';
  const refreshDesc = () => $$('[data-desc]', container).forEach((b) => { if (!b.dataset.fr) b.textContent = descTxt(b.dataset.desc, 'en'); b.classList.toggle('auto-man', !!data[b.dataset.desc]); });
  container.addEventListener('input', () => setTimeout(refreshDesc, 0));
  container.addEventListener('click', (e) => {
    const b = e.target.closest('[data-desc]');
    if (!b) return;
    e.preventDefault(); buzz();
    clearTimeout(b._t);
    b.dataset.fr = '1'; b.textContent = data[b.dataset.desc] ? data[b.dataset.desc] : radioDesc(data, 'fr', true) || '…'; b.classList.add('desc-fr');
    b._t = setTimeout(() => { delete b.dataset.fr; b.classList.remove('desc-fr'); refreshDesc(); }, 3000);
  });
  container.oninput = (e) => {
    const t = e.target;
    if (t.dataset.k) set(t.dataset.k, t.value.trim() === '' ? null : t.value);
    // Date de fin : les jours avant la date de début sont grisés, et le calendrier s'ouvre au bon mois.
    if (t.dataset.k) for (const f of all.filter((x) => x.minFrom === t.dataset.k)) {
      const dep = $(`[data-k="${f.key}"]`, container);
      if (!dep) continue;
      dep.min = t.value || '';
      if (t.value && (!dep.value || dep.value < t.value)) { dep.value = t.value; set(f.key, t.value); }
    }
    if (t.dataset.tf) {
      const i = Number(t.closest('.tide').dataset.i);
      const rows = data.marees ? structuredClone(data.marees) : [{}, {}, {}, {}];
      rows[i][t.dataset.tf] = t.value;
      set('marees', rows);
    }
  };
  const refreshSig = (k) => {
    const f = all.find((x) => x.key === k);
    const holder = $(`[data-sigopen="${k}"]`, container).closest('.cf');
    holder.outerHTML = compactField(f, data[k], data);
  };
  container.onchange = (e) => {
    const t = e.target;
    const f = t.dataset.k && all.find((x) => x.minFrom === t.dataset.k);
    if (!f || !t.value) return;
    const dep = $(`[data-k="${f.key}"]`, container);
    setTimeout(() => { try { dep.focus(); dep.showPicker(); } catch { dep.focus(); } }, 300);
  };
  container.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sigopen) {
      e.preventDefault(); buzz();
      const k = b.dataset.sigopen;
      return openSignature(b.dataset.label, (img) => { set(k, img); refreshSig(k); toast('Signature enregistrée'); });
    }
    if (b.dataset.sigclear) { e.preventDefault(); buzz(); const k = b.dataset.sigclear; return armed(b, 'Confirmer ?', () => { set(k, null); refreshSig(k); }); }
    if (b.dataset.use) { e.preventDefault(); buzz(); const inp = $(`[data-k="${b.dataset.use}"]`, container); inp.value = b.dataset.val; set(b.dataset.use, b.dataset.val); return; }
    if (b.dataset.tt) {
      e.preventDefault(); buzz();
      const i = Number(b.closest('.tide').dataset.i);
      const rows = data.marees ? structuredClone(data.marees) : [{}, {}, {}, {}];
      rows[i].type = rows[i].type === b.dataset.tt ? '' : b.dataset.tt;
      set('marees', rows);
      $$('button', b.parentElement).forEach((x) => x.classList.toggle('on', x.dataset.tt === rows[i].type));
      return;
    }
    const box = b.closest('[data-k]');
    if (b.dataset.lcyc) {
      e.preventDefault();
      if (b._lp) { b._lp = false; return; }
      buzz();
      const opts = b.dataset.opts.split('|'), k = b.dataset.lcyc;
      const nv = opts[(Math.max(0, opts.indexOf(data[k] || opts[0])) + 1) % opts.length];
      // Choix bloqué dès qu'il est fait ou que le numéro est saisi : appui court = demande, appui long = confirmer (Corban, v177).
      if (data[k] || data[b.dataset.main]) {
        clearTimeout(b._t); b.dataset.step = '1'; b.classList.add('cyc-ask'); const lw = (v) => (b.dataset.pre || '') + v + (b.dataset.suf || '');
        b.textContent = `Modifier pour ${lw(nv)} ?`;
        toast(`Pour modifier pour « ${lw(nv)} » : appui long sur l’intitulé · sans appui long, « ${lw(data[k] || opts[0])} » reste`);
        b._t = setTimeout(() => lcycRestore(b), 4000);
        return;
      }
      set(k, nv); lcycRestore(b);
      return;
    }
    if (box && b.dataset.cyc) {
      e.preventDefault(); buzz();
      const opts = b.dataset.cyc.split('|'), k = box.dataset.k;
      const nv = opts[(opts.indexOf(data[k]) + 1) % opts.length];
      // Premier choix direct ; ensuite un appui court propose le changement, un appui long le confirme (Corban, v161).
      if (b._lp) { b._lp = false; return; }
      clearTimeout(b._t);
      if (data[k] && !b.dataset.free) {
        b.dataset.step = '1'; b.classList.add('cyc-ask');
        b.textContent = `Modifier pour ${cycDisp(b, nv)} ?`;
        toast(`Pour modifier pour « ${cycDisp(b, nv)} » : appui long sur la pastille · sans appui long, « ${cycDisp(b, data[k])} » reste`);
        b._t = setTimeout(() => cycRestore(b, k), 4000);
        return;
      }
      set(k, nv); cycRestore(b, k);
      return;
    }
    if (!box || !b.dataset.opt) return;
    e.preventDefault(); buzz();
    const k = box.dataset.k;
    const o = b.dataset.opt;
    if (box.dataset.multi) {
      const sel = new Set(data[k] || []);
      sel.has(o) ? sel.delete(o) : sel.add(o);
      set(k, [...sel]);
      $$('button', box).forEach((x) => { const on = sel.has(x.dataset.opt); x.classList.toggle('on', on); $('.box', x).textContent = on ? '✔' : ''; });
    } else {
      set(k, data[k] === o ? null : o);
      $$('button', box).forEach((x) => x.classList.toggle('on', x.dataset.opt === data[k]));
    }
  };
  refreshCalcs();
}

/* ---------- Signature au doigt, en plein écran ----------
   On peut lever le doigt entre les traits ; rien n'est enregistré avant « Valider ».
   Les traits sont gardés en coordonnées relatives pour survivre à une rotation de l'écran. */
function openSignature(title, onSave) {
  const ov = document.createElement('div');
  ov.className = 'sig-overlay';
  ov.innerHTML = `
    <div class="sig-top"><b>${esc(title)}</b><small>Signez n’importe où sur l’écran. Tournez le téléphone pour plus de place.</small></div>
    <div class="sig-area"><canvas></canvas><div class="sig-line"></div></div>
    <div class="sig-bar">
      <button class="btn" data-a="back">◀ Retour</button>
      <button class="btn" data-a="undo">↶ Trait</button>
      <button class="btn" data-a="clear">Effacer</button>
      <button class="btn primary" data-a="ok">✔ Valider</button>
    </div>`;
  document.body.appendChild(ov);
  document.body.classList.add('no-scroll');
  const cv = $('canvas', ov);
  const area = $('.sig-area', ov);
  const ctx = cv.getContext('2d');
  const strokes = [];
  let cur = null;
  let penSeen = false;
  const draw = (c, w, h, lw) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#000'; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const st of strokes) {
      c.beginPath();
      st.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
      if (st.length === 1) c.lineTo(st[0][0] * w + 0.1, st[0][1] * h);
      c.stroke();
    }
  };
  const fit = () => {
    const dpr = window.devicePixelRatio || 1;
    const r = area.getBoundingClientRect();
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, r.width, r.height, 4);
  };
  const rel = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [rel(e)]; strokes.push(cur); fit(); };
  // Stylet (Apple Pencil, S Pen) : pas de différence de traitement, mais le doigt posé à côté est ignoré.
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'pen') penSeen = true; else if (penSeen && e.pointerType === 'touch') { strokes.pop(); cur = null; fit(); } });
  cv.onpointermove = (e) => { if (!cur) return; e.preventDefault(); cur.push(rel(e)); fit(); };
  cv.onpointerup = cv.onpointercancel = () => { cur = null; };
  const close = () => { window.removeEventListener('resize', fit); ov.remove(); document.body.classList.remove('no-scroll'); };
  window.addEventListener('resize', fit);
  fit();
  ov.querySelector('.sig-bar').onclick = (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    buzz();
    const a = b.dataset.a;
    if (a === 'back') close();
    if (a === 'undo') { strokes.pop(); fit(); }
    if (a === 'clear') { strokes.length = 0; fit(); }
    if (a === 'ok') {
      if (!strokes.length) return toast('Signez sur l’écran avec le doigt');
      // Image recadrée sur la signature, 900 px de large au plus : nette à l'impression, légère en mémoire.
      const r = area.getBoundingClientRect();
      const full = document.createElement('canvas');
      full.width = Math.round(r.width * 2); full.height = Math.round(r.height * 2);
      draw(full.getContext('2d'), full.width, full.height, 8);
      const xs = strokes.flat().map((p) => p[0] * full.width), ys = strokes.flat().map((p) => p[1] * full.height);
      const m = 24;
      const x0 = Math.max(0, Math.min(...xs) - m), y0 = Math.max(0, Math.min(...ys) - m);
      const x1 = Math.min(full.width, Math.max(...xs) + m), y1 = Math.min(full.height, Math.max(...ys) + m);
      const k = Math.min(1, 900 / (x1 - x0));
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round((x1 - x0) * k)); out.height = Math.max(1, Math.round((y1 - y0) * k));
      const o = out.getContext('2d');
      o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(full, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
      close();
      onSave(out.toDataURL('image/png'));
    }
  };
}

/* =====================================================================
   FICHE DE LA JOURNÉE
   ===================================================================== */
const dayData = (k) => (cruise.days[k] = cruise.days[k] || {});
const daysWithData = () => [...new Set([...Object.keys(cruise.days).filter((k) => Object.keys(cruise.days[k]).length), ...cruise.entries.map((e) => dayKey(new Date(e.t)))])].sort();
let currentDay = null;

// Durée de navigation : de chaque « Départ » à l'« Arrivée » suivante, répartie sur les jours.
function navLegs() {
  const legs = [];
  let dep = null;
  for (const e of cruise.entries) {
    const ev = e.v.evt || [];
    if (ev.includes('Départ')) dep = e;
    else if (ev.includes('Arrivée') && dep) { legs.push({ dep, arr: e }); dep = null; }
  }
  return legs;
}
function navForDay(k) {
  const d0 = keyToDate(k); d0.setHours(0, 0, 0, 0);
  const a0 = d0.getTime(), a1 = a0 + 86400000;
  let ms = 0, nm = 0;
  const legs = [];
  for (const l of navLegs()) {
    const a = Date.parse(l.dep.t), b = Date.parse(l.arr.t);
    const ov = Math.min(b, a1) - Math.max(a, a0);
    if (ov <= 0) continue;
    ms += ov;
    const dist = (num(l.arr.v.loch) ?? 0) - (num(l.dep.v.loch) ?? 0);
    if (dist > 0 && b > a) nm += (dist * ov) / (b - a);
    legs.push({ ...l, ms: b - a, dist });
  }
  return { ms, nm, legs };
}
function navLabel(k) {
  const d = cruise.days[k] || {};
  const n = navForDay(k);
  if (d.dureeNav) return d.dureeNav;
  return n.ms ? `${fmtDur(n.ms)}${n.nm ? ` · ${fr(n.nm)} NM` : ''}` : '';
}
function calcNav(d) {
  const n = navForDay(currentDay);
  if (!n.legs.length) return '<p class="help">Aucune navigation « Départ → Arrivée » ce jour au journal.</p>';
  return `<table class="calc-t">${n.legs.map((l) => `<tr><td>${fmtTime(new Date(l.dep.t))} → ${fmtTime(new Date(l.arr.t))}</td><td>${fmtDur(l.ms)}${l.dist > 0 ? ` · ${fr(l.dist)} NM` : ''}</td></tr>`).join('')}
    <tr><th>Durée de navigation</th><th>${esc(d.dureeNav || fmtDur(n.ms))}</th></tr></table>`;
}

function calcEngine(d) {
  const i = cruise.info;
  const soir = num(d.moteurSoir), init = num(i.moteurInit), conso = num(i.conso) != null || num(i.conso2) != null ? (num(i.conso) || 0) + (num(i.conso2) || 0) : null, fuel = num(i.fuelInit);
  const heff = soir != null && init != null ? soir - init : null;
  const lcons = heff != null && conso != null ? heff * conso : null;
  const pleins = Object.keys(cruise.days).filter((k) => k <= currentDay).reduce((s, k) => s + (num(cruise.days[k].plein) || 0), 0);
  const dispo = fuel != null && lcons != null ? fuel + pleins - lcons : null;
  const miss = init == null || conso == null || fuel == null ? '<p class="help">Renseignez ci-dessus le compteur et le carburant au départ, et la consommation dans la fiche du bateau.</p>' : '';
  return `<table class="calc-t">
    <tr><td>Heures relevées ce soir</td><td>${fr(soir)} h</td></tr>
    <tr><td>− heures au départ</td><td>${fr(init)} h</td></tr>
    <tr><th>= heures effectuées</th><th>${fr(heff)} h</th></tr>
    <tr><td>Consommation (${fr(conso)} l/h)</td><td>${fr(lcons, 0)} l</td></tr>
    <tr><td>Carburant au départ${pleins ? ' + pleins' : ''}</td><td>${fr(fuel == null ? null : fuel + pleins, 0)} l</td></tr>
    <tr><th>Carburant disponible</th><th>${fr(dispo, 0)} l</th></tr></table>${miss}`;
}

function lochSuggestion(k) {
  const lochAt = (e) => num(e.v.loch);
  const today = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k && lochAt(e) != null);
  if (!today.length) return null;
  const before = cruise.entries.filter((e) => dayKey(new Date(e.t)) < k && lochAt(e) != null);
  const start = before.length ? lochAt(before[before.length - 1]) : lochAt(today[0]);
  const x = lochAt(today[today.length - 1]) - start;
  return x > 0 ? Math.round(x * 10) / 10 : null;
}

function calcMiles(d) {
  const prevKeys = Object.keys(cruise.days).filter((k) => k < currentDay);
  const prev = prevKeys.reduce((s, k) => s + (num(cruise.days[k].nmJour) || 0), 0);
  const jour = num(d.nmJour);
  const i = cruise.info;
  const hAt = (dd) => (num(dd.moteurSoir) != null && num(i.moteurInit) != null ? num(dd.moteurSoir) - num(i.moteurInit) : null);
  const v = num(i.vMoteur);
  const heff = hAt(d);
  const totM = heff != null && v != null ? heff * v : null;
  const lastPrev = prevKeys.sort().reverse().find((k) => hAt(cruise.days[k]) != null);
  const prevM = lastPrev && v != null ? hAt(cruise.days[lastPrev]) * v : 0;
  const sug = lochSuggestion(currentDay);
  return `${sug != null && sug !== jour ? `<button class="btn" data-use="nmJour" data-val="${String(sug).replace('.', ',')}">Utiliser le loch : ${fr(sug)} NM</button>` : ''}
    <table class="calc-t">
    <tr><td>Total des jours précédents</td><td>${fr(prev)} NM</td></tr>
    <tr><td>+ effectués ce jour</td><td>${fr(jour)} NM</td></tr>
    <tr><th>= total effectué</th><th>${fr(prev + (jour || 0))} NM</th></tr>
    <tr><td colspan="2" class="sub">dont au moteur (heures × ${fr(v)} nd)</td></tr>
    <tr><td>Total moteur</td><td>${fr(totM)} NM</td></tr>
    <tr><td>Moteur ce jour</td><td>${fr(totM == null ? null : totM - prevM)} NM</td></tr></table>`;
}

VIEWS.day = function renderDay(k) {
  currentDay = k || currentDay || dayKey(new Date());
  const d = dayData(currentDay);
  const nb = cruise.entries.filter((e) => dayKey(new Date(e.t)) === currentDay).length;
  const main = $('#view');
  main.innerHTML = `
    <div class="daynav">
      <button class="btn" data-d="-1" aria-label="Jour précédent">◀</button>
      <div><div class="dn-date">${esc(fmtDate(keyToDate(currentDay)))}</div><div class="dn-sub">${nb} entrée${nb > 1 ? 's' : ''} au journal</div></div>
      <button class="btn" data-d="1" aria-label="Jour suivant">▶</button>
    </div>
    <div class="row ${currentDay !== dayKey(new Date()) ? 'c2' : ''}" style="margin-bottom:12px">
      ${currentDay !== dayKey(new Date()) ? '<button class="btn" data-today="1">Aujourd’hui</button>' : ''}<button class="btn" data-mapday="1">🗺 Carte du jour</button></div>
    ${isLake() ? `<div class="row c2" style="margin-bottom:12px"><button class="btn" data-crew="1">👥 Équipage<small>${cruise.crew.length} à bord</small></button><button class="btn primary" data-sheet="1">📸 Fiche à envoyer</button></div>` : ''}
    <p class="help">Enregistrement automatique. Remplissez au calme, au port ou au mouillage.</p>
    <div id="dayForm"></div>`;
  main.onclick = (e) => {
    const b = e.target.closest('[data-d],[data-today],[data-mapday],[data-sheet],[data-crew]');
    if (!b) return;
    buzz();
    if (b.dataset.crew) return go('crew');
    if (b.dataset.sheet) return go('sheet', currentDay);
    if (b.dataset.mapday) return go('map', currentDay);
    if (b.dataset.today) return go('day', dayKey(new Date()));
    const dt = keyToDate(currentDay);
    dt.setDate(dt.getDate() + Number(b.dataset.d));
    go('day', dayKey(dt));
  };
  if (isLake()) autoFillLakeDay(currentDay);
  // v238 : compteur, carburant de départ et vitesse moteur s'affichent dans la journée mais restent des données de la croisière.
  const DAY_INFO_KEYS = ['moteurInit', 'fuelInit', 'vMoteur'];
  const dp = new Proxy(d, { get: (t, k) => (DAY_INFO_KEYS.includes(k) ? cruise.info[k] : t[k]), set: (t, k, v) => { if (DAY_INFO_KEYS.includes(k)) cruise.info[k] = v; else t[k] = v; return true; },
    deleteProperty: (t, k) => { if (DAY_INFO_KEYS.includes(k)) delete cruise.info[k]; else delete t[k]; return true; } });
  compactForm($('#dayForm'), daySections(), dp, () => {
    saveCruise();
    if (!isLake()) return;
    // Choisir « Location » remplit le montant d'après les tarifs du bateau.
    const before = d.montant;
    autoFillLakeDay(currentDay);
    const el = $('#dayForm [data-k="montant"]');
    if (el && d.montant !== before) el.value = d.montant || '';
  });
};

/* =====================================================================
   JOURNAL
   ===================================================================== */
VIEWS.log = function renderLog() {
  const main = $('#view');
  const entries = cruise.entries;
  if (!entries.length) {
    main.innerHTML = '<div class="empty-state">Aucune entrée pour l’instant.<br><br><button class="btn big primary" id="goNew">＋ Première entrée</button></div>';
    $('#goNew').onclick = () => go('new');
    return;
  }
  const pendingWx = entries.filter((e) => e.needWx).length;
  let html = `<h1>Journal · ${entries.length} entrée${entries.length > 1 ? 's' : ''}</h1>
    <div class="row" style="margin-bottom:12px"><button class="btn" data-map="all">🗺 Voir la croisière sur la carte</button></div>
    ${pendingWx ? `<div class="row" style="margin-bottom:12px"><button class="btn primary" id="wxAll">🌬 Ajouter la météo à ${pendingWx} entrée${pendingWx > 1 ? 's' : ''} automatique${pendingWx > 1 ? 's' : ''} (réseau)</button></div>` : ''}`;
  let day = '';
  for (const e of [...entries].reverse()) {
    const d = new Date(e.t);
    const dk = dayKey(d);
    if (dk !== day) {
      day = dk;
      const nav = navLabel(dk);
      if (day) html += '</div>';
      html += `<div class="day-head"><span>${esc(fmtDate(d))}${nav ? `<small class="nav-dur">⏱ navigation ${esc(nav)}</small>` : ''}</span><span class="dh-btns"><button class="btn small-btn" data-map="${dk}">🗺</button><button class="btn small-btn" data-day="${dk}">Fiche</button></span></div><div class="day-grid">`;
    }
    const rows = activeFields().filter((f) => !['t', 'evt'].includes(f.key)).map((f) => [f.label, fmtValue(f, e.v[f.key])]).filter(([, s]) => s);
    html += `<article class="entry ${e.auto ? 'auto' : ''}" data-id="${e.id}">
      <div class="when"><span>${tzHtml(d)}${e.auto ? ' <span class="tag">auto</span>' : ''}</span><span>${esc(e.v.evt ? e.v.evt.join(', ') : '')}</span></div>
      <dl>${rows.map(([l, s]) => `<dt>${esc(l)}</dt><dd>${esc(s.replace('  ', '\n'))}</dd>`).join('')}</dl>
      ${e.v.photos && typeof photoStrip === 'function' ? photoStrip((cruise.photos || []).filter((p) => e.v.photos.includes(p.id)), false) : ''}
      ${e.windSrc ? '<p class="help">Vent : enregistré dans la trace</p>' : ''}
      ${e.wx || e.v.wxSrc ? `<p class="help">${e.windSrc ? (isLake() ? 'Baro' : 'Mer et baro') : isLake() ? 'Vent et baro' : 'Vent, mer et baro'} : ${esc(e.v.wxSrc || 'modèle météo Open-Meteo')}</p>` : ''}
      <div class="actions"><button class="btn" data-act="edit">${e.auto ? 'Compléter' : 'Modifier'}</button><button class="btn danger" data-act="del">Supprimer</button></div>
    </article>`;
  }
  main.innerHTML = html + '</div>';
  if (typeof fillPhotos === 'function') fillPhotos(main);
  if (pendingWx) $('#wxAll').onclick = (ev) => fillPendingWeather(ev.currentTarget);
  main.onclick = (ev) => {
    const mapBtn = ev.target.closest('[data-map]');
    if (mapBtn) { buzz(); return go('map', mapBtn.dataset.map); }
    const dayBtn = ev.target.closest('[data-day]');
    if (dayBtn) { buzz(); return go('day', dayBtn.dataset.day); }
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    buzz();
    const id = b.closest('.entry').dataset.id;
    const e = cruise.entries.find((x) => x.id === id);
    if (b.dataset.act === 'edit') { draft = { id: e.id, t: e.t, v: structuredClone(e.v), tManual: true }; saveDraft(); go('new'); }
    if (b.dataset.act === 'del') armed(b, 'Confirmer ?', () => { cruise.entries = cruise.entries.filter((x) => x.id !== id); (cruise.deleted = cruise.deleted || []).push(id); saveCruise(); toast('Entrée supprimée'); VIEWS.log(); });
  };
};

/* =====================================================================
   SOS : messages radio pré-remplis, numéros utiles, alphabet
   ===================================================================== */
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Niner' };
const spell = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').split('').map((c) => NATO[c]).join(' ');
const spellDigits = (s) => String(s || '').replace(/\D/g, '').replace(/(\d{3})(?=\d)/g, '$1 ').split(' ').filter(Boolean).map((g) => g.split('').map((c) => NATO[c]).join(' ')).join(' · ');

const SOS = {
  mayday: { title: 'MAYDAY', sub: 'Détresse : danger grave et imminent', cls: 'red',
    asn: ['Allumer, volume, squelch', 'Ouvrir le capot rouge DISTRESS', 'Choisir la nature si possible', 'Appuyer 5 secondes sur DISTRESS', 'Attendre l’accusé de réception, puis parler sur le canal 16 (PTT)'],
    natures: [
      ['Incendie', 'We are on fire.', 'Nous sommes en feu.'], ['Voie d’eau', 'We are flooding.', 'Nous avons une voie d’eau.'],
      ['Collision', 'We had a collision.', 'Nous avons eu une collision.'], ['Échouement', 'We are aground.', 'Nous sommes échoués.'],
      ['Chavirement', 'Danger of capsizing.', 'Risque de chavirement.'], ['Naufrage', 'We are sinking.', 'Nous coulons.'],
      ['Dérive', 'We are adrift, not under command.', 'Nous dérivons, bateau non manœuvrant.'], ['Homme à la mer', 'Man overboard.', 'Un homme à la mer.'],
      ['Abandon', 'We are abandoning ship.', 'Nous abandonnons le navire.'], ['Piraterie', 'We are under piracy attack.', 'Nous subissons une attaque de pirates.'],
    ],
    script: (c) => [
      ['MAYDAY MAYDAY MAYDAY'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`MAYDAY ${c.boat} ${c.idShort}`],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      [`${c.pob} people on board.`, `${c.pob} personnes à bord.`],
      c.desc ? [c.desc, c.descFr] : null,
      ['Immediate assistance required.', 'Assistance immédiate requise.'],
      ['OVER'],
    ] },
  pan: { title: 'PAN PAN', sub: 'Urgence : besoin d’aide, pas de danger immédiat', cls: 'orange',
    asn: ['Allumer, volume, squelch', 'MENU › DSC › Position input › EXIT', 'OTHER DSC › All ships › Urgency › CALL', 'Parler sur le canal 16. Si un trafic de détresse est en cours, attendre la fin'],
    natures: [
      ['Panne moteur', 'Engine failure. We are drifting. We require towing assistance.', 'Panne moteur. Nous dérivons. Nous demandons un remorquage.'],
      ['Gouvernail', 'Steering failure, not under command. We require towing assistance.', 'Gouvernail en panne, non manœuvrant. Nous demandons un remorquage.'],
      ['Bout dans l’hélice', 'Line in the propeller. We require diving assistance.', 'Un bout dans l’hélice. Nous avons besoin d’un plongeur.'],
      ['Blessé', 'One person injured. We require medical assistance.', 'Une personne blessée. Nous demandons une assistance médicale.'],
    ],
    script: (c) => [
      ['PAN PAN  PAN PAN  PAN PAN'], ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      [`${c.pob} people on board.`, `${c.pob} personnes à bord.`],
      ['OVER'],
    ] },
  securite: { title: 'SÉCURITÉ', sub: 'Avertir les autres d’un danger', cls: 'yellow',
    asn: ['Allumer, volume, squelch', 'MENU › DSC › Position input › EXIT', 'OTHER DSC › All ships › Safety › CALL', 'Parler sur le canal 16 puis indiquer le canal de travail'],
    natures: [
      ['Obstacle flottant', 'Half-submerged obstacle observed. Please navigate carefully.', 'Obstacle à moitié immergé observé. Naviguez avec prudence.'],
      ['Veille renforcée', 'Ships in vicinity are requested to keep a sharp lookout.', 'Les navires à proximité sont priés de rester vigilants.'],
    ],
    script: (c) => [
      ['SECURITE  SECURITE  SECURITE'], ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      ['OVER'],
    ] },
  cancel: { title: 'ANNULER', sub: 'Annuler une fausse alerte de détresse', cls: 'grey',
    asn: ['Sur la VHF : CANCEL puis CONTINUE (ou éteindre l’appareil)', 'Puis annoncer sur le canal 16', 'Après : FINISH › STBY › OK'],
    script: (c) => [
      ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Please cancel my distress alert of ${c.utc} UTC.`, `Veuillez annuler mon alerte de détresse de ${c.utc} UTC.`],
      ['OVER'],
    ] },
  medical: { title: 'MÉDICAL', sub: 'Consultation médicale par radio', cls: 'blue',
    asn: ['Allumer, volume, squelch', 'MENU › DSC › Position input › EXIT', 'OTHER DSC › Address : MMSI de la station côtière › CALL', 'Ou téléphone : CCMM (voir numéros utiles)'],
    script: (c) => [
      [`${c.station} RADIO`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      ['I need telemedical advice.', 'J’ai besoin d’une consultation médicale.'],
      ['OVER'],
    ] },
};
let sosPos = null;
// v176 (Corban) : SOS contextuel. Sur un lac loin des côtes : outils du lac ; près ou sur la mer : outils de la mer.
// Zones des lacs intérieurs (approximatives) ; ailleurs on considère la mer.
const INLAND = [[45.75, 47.9, 5.85, 10.6], [45.4, 46.05, 5.6, 6.5], [45.4, 46.25, 8.4, 9.4], [45.5, 45.95, 10.45, 10.95], [47.4, 47.9, 8.9, 9.85]];
const inInland = (p) => !!p && INLAND.some(([a, b, c, d]) => p.lat > a && p.lat < b && p.lon > c && p.lon < d);
function navZone() {
  if (zoneSimV === 'lac' || zoneSimV === 'mer') return zoneSimV; // simulation du mode développeur (Corban, v265)
  const p = lastKnownPos();
  const fresh = p && (!p.at || Date.now() - Date.parse(p.at) < 12 * 3600e3);
  if (fresh) return inInland(p) ? 'lac' : 'mer';
  if (cruise) return isLake() ? 'lac' : 'mer';
  if (p) return inInland(p) ? 'lac' : 'mer';
  return index.some((x) => x.type !== 'lac') ? 'mer' : 'lac';
}

function lastKnownPos() {
  if (typeof sosSim !== 'undefined' && sosSim && typeof sosLive !== 'undefined' && sosLive) return sosLive; // v444 : simulation de la page SOS
  if (sosPos) return sosPos;
  if (typeof lastFix !== 'undefined' && lastFix) return lastFix;
  for (let i = (cruise ? cruise.entries.length : 0) - 1; i >= 0; i--) {
    const p = cruise.entries[i].v.pos;
    if (p) return { ...p, at: cruise.entries[i].t };
  }
  return null;
}

function sosContext(nature) {
  const i = cruise.info;
  const boat = (i.boat || '[nom du bateau]').toUpperCase();
  const p = lastKnownPos();
  const now = new Date();
  return {
    boat, boat3: `${boat} ${boat} ${boat}`,
    idShort: [i.callsign, i.mmsi].filter(Boolean).join('  '),
    idLine: [i.callsign ? `Call sign ${i.callsign} (${spell(i.callsign)})` : '', i.mmsi ? `MMSI ${spellDigits(i.mmsi)}` : ''].filter(Boolean).join(' · '),
    pos: p ? fmtPos(p) : '[position]',
    utc: `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`,
    pob: cruise.crew.filter((m) => m.nom).length || '[nombre]',
    desc: radioDesc(i, 'en'), descFr: radioDesc(i, 'fr'),
    station: i.coastStation || '[station côtière]',
    nature: nature ? nature[1] : '[nature de la détresse]', natureFr: nature ? nature[2] : '',
  };
}

// Chaque numéro devient un gros bouton d'appel (lien tel:). Une ligne peut contenir plusieurs numéros.
const PHONE_RE = /\+?\d(?:[ .\-\/]?\d){2,}/g;
const telOf = (raw) => raw.replace(/[^\d+]/g, '');
function callBtn(label, number, sub) {
  return `<a class="btn contact call" href="tel:${esc(telOf(number))}"><span class="ph">📞</span><span><b>${esc(label || number)}</b><span>${esc(number)}${sub ? ` · ${esc(sub)}` : ''}</span></span></a>`;
}
function contactsHtml(text) {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.split(/\s*:\s*/);
    const label = m.length > 1 ? m[0] : '';
    const val = m.length > 1 ? m.slice(1).join(' : ') : m[0];
    const nums = /vhf|canal/i.test(val) ? [] : /^\d{2}$/.test(val.trim()) ? [val.trim()] : (val.match(PHONE_RE) || []).map((x) => x.trim()).filter((x) => telOf(x).replace('+', '').length >= 3 && !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(x));
    if (!nums.length) return `<div class="btn contact static"><b>${esc(label)}</b><span>${esc(val)}</span></div>`;
    const rest = val.replace(PHONE_RE, '').replace(/\b(t[ée]l\.?|ou|or|et)(?=\s|$)/gi, ' ').replace(/[\s,;–]+/g, ' ').replace(/\(\s*\)/g, '').trim();
    return nums.map((x) => callBtn(label || rest, x, label && rest && rest.length < 40 ? rest : '')).join('');
  }).join('');
}
function crewCallsHtml() {
  return (cruise ? cruise.crew : []).flatMap((m) => {
    const out = [];
    for (const x of (m.tel || '').match(PHONE_RE) || []) out.push(callBtn(m.nom || 'Équipier', x, m.fonction));
    if (m.procheTel || m.proche2Tel || m.proche3Tel) {
      for (const [n, t] of [['procheNom', 'procheTel'], ['proche2Nom', 'proche2Tel'], ['proche3Nom', 'proche3Tel']]) if (m[t]) out.push(callBtn(`Proche de ${m.nom || '…'}`, m[t], m[n] || ''));
    } else {
      const pr = m.proche || '';
      for (const x of pr.match(PHONE_RE) || []) out.push(callBtn(`Proche de ${m.nom || '…'}`, x, pr.replace(PHONE_RE, '').replace(/[\s.]+$/, '').trim()));
    }
    return out;
  }).join('');
}

const VOCAB = [
  ['Over', 'à vous'], ['Say again', 'répétez'], ['Read back', 'collationnez'], ['Correction', 'je corrige'], ['Go ahead', 'continuez'],
  ['How do you read?', 'comment me recevez-vous ?'], ['Loud and clear', 'fort et clair'], ['Stand by', 'attendez'],
  ['Switch to channel 08', 'passez sur le canal 08'], ['Roger, going up', 'compris, je commute'], ['Negative / Correct', 'non / exact'],
  ['Decimal', 'virgule'], ['Station calling?', 'qui m’appelle ?'], ['Seelonce Mayday', 'silence imposé (détresse en cours)'], ['Seelonce finee', 'fin du silence'],
];

VIEWS.sos = function renderSos(arg) {
  const main = $('#view');
  if (arg === 'all') return renderSosAll();
  // Toujours accessible, même sans navigation ouverte (v80) : numéros du lac en Suisse, sinon numéros généraux.
  const i = cruise ? cruise.info : { contacts: navZone() === 'lac' ? LAKE_CONTACTS : DEFAULT_CONTACTS };
  const p = lastKnownPos();
  const lake = navZone() === 'lac'; tzLocalOnly = lake; // v176 : selon l'endroit (lac loin des côtes ou mer) ; sur le lac : ni messages radio, ni identité radio, ni canaux (demande de Corban, 2026-10-31)
  main.innerHTML = `
    <h1>Sécurité et secours</h1>
    ${typeof sosLogBanner === 'function' ? sosLogBanner() : ''}
    ${typeof sosPosBlock === 'function' ? sosPosBlock() : ''}
    ${lake ? '' : `<div class="sos-grid">${Object.entries(SOS).map(([k, s]) => `<button class="btn sos ${s.cls}" data-sos="${k}">${s.title}<small>${s.sub}</small></button>`).join('')}</div>`}
    <button class="btn big mob-open" data-go="mob" data-arg="${lake ? 'lac' : 'mer'}">🛟 Homme à la mer</button>
    ${(typeof sosLogActive === 'function' && sosLogActive()) || (typeof sosSim !== 'undefined' && sosSim) ? '' : `<section class="field"><h2>Position actuelle</h2>
      <div class="value" style="font-size:28px">${p ? esc(fmtPos(p)).replace('  ', '<br>') : '– –'}</div>
      ${p && p.at ? `<p class="help" style="text-align:center">relevée à ${tzHtml(new Date(p.at))}</p>` : ''}
      <button class="btn big primary" id="sosGps">📍 Actualiser la position GPS</button></section>`} <!-- v443 (Corban) : inutile quand le cadre de position SOS est affiché -->
    ${lake ? '' : `<section class="field"><h2>Identité radio</h2>
      <div class="ident"><div><b>${esc(i.boat || '–')}</b></div>
      <div>Indicatif : <b>${esc(i.callsign || '–')}</b><br><small>${esc(spell(i.callsign))}</small></div>
      <div>MMSI : <b>${esc(i.mmsi || '–')}</b><br><small>${esc(spellDigits(i.mmsi))}</small></div>
      <div>${esc(radioDesc(i, 'en'))}</div></div>
      ${!i.boat || !i.mmsi ? '<button class="btn" data-go="info">Compléter dans Bateau et croisière</button>' : ''}</section>`}
    ${lake && inFrenchLeman(p) ? `<section class="field"><h2>Urgences France (vous êtes côté français)</h2><div class="contacts">${contactsHtml(LEMAN_FR_CONTACTS)}</div>
      <p class="help">Le 112 marche sur tous les réseaux. Les numéros courts suisses ne passent que si le téléphone est sur un réseau suisse.</p></section>` : ''}
    <section class="field"><h2>${lake && inFrenchLeman(p) ? 'Numéros utiles Suisse' : 'Numéros utiles'}</h2><div class="contacts">${contactsHtml(lake && inFrenchLeman(p) ? (i.contacts || '').split('\n').filter((l) => !/^\s*urgence \(europe\)/i.test(l)).join('\n') : i.contacts) || '<p class="help">Ajoutez-les dans Bateau et croisière.</p>'}</div></section>
    ${i.base ? `<section class="field"><h2>Loueur, base</h2><div class="contacts">${contactsHtml(i.base)}</div></section>` : ''}
    ${crewCallsHtml() ? `<section class="field"><h2>Équipage et proches</h2><div class="contacts">${crewCallsHtml()}</div></section>` : ''}
    ${i.meteo ? `<section class="field"><h2>Météo</h2><p class="pre">${esc(i.meteo)}</p></section>` : ''}
    ${lake ? '' : '<section class="field"><h2>Canaux bateau à bateau</h2><div class="value" style="font-size:34px">6 · 8 · 72 · 77</div></section>'}
    <button class="btn big" data-go="alpha">🔤 Alphabet phonétique<small>Alfa, Bravo, Charlie… et épeler un mot</small></button>
    ${lake ? '' : `<details class="section"><summary>Vocabulaire radio</summary><dl class="vocab">${VOCAB.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></details>`}
    <p class="help">${lake ? '🏞 Outils du lac' : '🌊 Outils de la mer'} (selon votre position). Appui long sur « SOS » : tous les outils, lac et mer.</p>
    ${typeof sosEndBtnHtml === 'function' ? sosEndBtnHtml() : ''}`;
  main.onclick = (e) => {
    const b = e.target.closest('[data-sos],[data-go]');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go, b.dataset.arg || null);
    renderSosScript(b.dataset.sos, null);
  };
  if ($('#sosGps')) $('#sosGps').onclick = (e) => { e.stopPropagation(); buzz(); getGps(e.currentTarget, (pp) => { sosPos = { lat: pp.coords.latitude, lon: pp.coords.longitude, at: new Date().toISOString() }; VIEWS.sos(); }); };
};

// Appui long sur SOS : tous les outils, en deux sections Lac et Mer (Corban, v176).
function renderSosAll() {
  const main = $('#view');
  const i = cruise ? cruise.info : { contacts: navZone() === 'lac' ? LAKE_CONTACTS : DEFAULT_CONTACTS };
  const p = lastKnownPos();
  main.innerHTML = `
    <h1>SOS · tous les outils</h1>
    ${typeof sosLogBanner === 'function' ? sosLogBanner() : ''}
    <section class="field"><h2>Position actuelle</h2>
      <div class="value" style="font-size:28px">${p ? esc(fmtPos(p)).replace('  ', '<br>') : '– –'}</div>
      ${p && p.at ? `<p class="help" style="text-align:center">relevée à ${tzHtml(new Date(p.at))}</p>` : ''}
      <button class="btn big primary" id="sosGps">📍 Actualiser la position GPS</button></section>
    <section class="field"><h2>Numéros utiles</h2><div class="contacts">${contactsHtml(i.contacts || '')}</div></section>
    ${crewCallsHtml() ? `<section class="field"><h2>Équipage et proches</h2><div class="contacts">${crewCallsHtml()}</div></section>` : ''}
    <button class="btn big" data-go="alpha">🔤 Alphabet phonétique<small>Alfa, Bravo, Charlie… et épeler un mot</small></button>
    <h2 class="set-group">🏞 Lac</h2>
    <button class="btn big mob-open" data-go="mob" data-arg="lac">🛟 Homme à la mer</button>
    <section class="field"><h2>Lac : numéros en Suisse</h2><div class="contacts">${contactsHtml(LAKE_CONTACTS)}</div></section>
    <section class="field"><h2>Léman côté français</h2><div class="contacts">${contactsHtml(LEMAN_FR_CONTACTS)}</div>
      <p class="help">Le 112 marche sur tous les réseaux. Les numéros courts suisses ne passent que si le téléphone est sur un réseau suisse.</p></section>
    <h2 class="set-group">🌊 Mer</h2>
    <button class="btn big mob-open" data-go="mob" data-arg="mer">🛟 Homme à la mer</button>
    <div class="sos-grid">${Object.entries(SOS).map(([k, s]) => `<button class="btn sos ${s.cls}" data-sos="${k}">${s.title}<small>${s.sub}</small></button>`).join('')}</div>
    <button class="btn big" data-go="vhf">📻 Appels VHF de routine</button>
    <section class="field"><h2>Identité radio</h2>
      <div class="ident"><div><b>${esc(i.boat || '–')}</b></div>
      <div>Indicatif : <b>${esc(i.callsign || '–')}</b><br><small>${esc(spell(i.callsign))}</small></div>
      <div>MMSI : <b>${esc(i.mmsi || '–')}</b><br><small>${esc(spellDigits(i.mmsi))}</small></div>
      <div>${esc(radioDesc(i, 'en'))}</div></div></section>
    <section class="field"><h2>Canaux bateau à bateau</h2><div class="value" style="font-size:34px">6 · 8 · 72 · 77</div></section>
    <details class="section"><summary>Vocabulaire radio</summary><dl class="vocab">${VOCAB.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></details>
    ${typeof sosEndBtnHtml === 'function' ? sosEndBtnHtml() : ''}`;
  main.onclick = (e) => {
    const b = e.target.closest('[data-sos],[data-go]');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go, b.dataset.arg || null);
    renderSosScript(b.dataset.sos, null);
  };
  $('#sosGps').onclick = (e) => { e.stopPropagation(); buzz(); getGps(e.currentTarget, (pp) => { sosPos = { lat: pp.coords.latitude, lon: pp.coords.longitude, at: new Date().toISOString() }; renderSosAll(); }); };
}

// Homme à la mer : procédure cas réel et procédure d'entraînement, rédigées par Corban (2026-10-31).
// Chaque procédure a des sections ; les sections « allure » sont les options du barreur (une seule affichée à la fois).
// Tout se modifie dans l'appli (ldb.mob2) et fait partie de la sauvegarde.
const MOB_COMMON = [
  ['Crier « Homme à la mer ! »', ''],
  ['Un, si possible deux équipiers pointent la personne', 'Ils ne la quittent jamais des yeux et ne font que ça.'],
  ['Lancer la bouée', 'Ou des objets flottants, tels que les coussins.'],
  ['Le barreur appuie immédiatement sur MOB', 'Bouton MOB du GPS ou du traceur, pour enregistrer la position exacte.'],
];
const MOB_ALERT = [['Si on la perd de vue, on alerte', 'MAYDAY en mer ; 117 / 112 / 18 sur le Léman.']];
// Récupération et hypothermie (texte de Corban, 2026-10-31).
const MOB_RECUP = [
  { id: 'recup3', title: 'Méthode d’urgence absolue : victime inconsciente ou épuisée', intro: 'Le plan incliné ou la voile. Hisser une masse inerte de 80 kg mouillée par-dessus un franc-bord élevé est impossible à la seule force des bras. La technique du filet (ou de la voile d’avant) :', steps: [
    ['Affalez le génois ou utilisez une bâche ou un filet solide', ''],
    ['Fixez un côté au bastingage et jetez le reste à l’eau', 'Pour former une poche sous-marine.'],
    ['Glissez la victime dans cette poche', ''],
    ['Frappez l’autre extrémité de la voile sur une drisse et hissez au winch', 'La voile s’enroule et fait remonter la victime le long de la coque comme dans un hamac, sans effort horizontal.'],
  ] },
  { id: 'hypo', title: '⚠️ Règle d’or médicale : l’hypothermie', steps: [
    ['Allongez immédiatement la victime à l’horizontale', 'Une fois la victime remontée, ne la forcez pas à se tenir debout. Le retour brutal du sang froid des extrémités vers le cœur (syndrome de l’hydrocution ou « afterdrop ») peut provoquer un arrêt cardiaque.'],
  ] },
];
const MOB_DEFAULT = {
  real: [
    { title: 'Tout de suite', steps: MOB_COMMON },
    { title: 'Au près', allure: true, steps: [
      ['Virez de bord immédiatement sans toucher aux écoutes', 'Tournez la barre pour faire passer le nez du bateau dans le lit du vent. Ne touchez ni à l’écoute de génois, ni à celle de la grand-voile.'],
      ['Démarrez le moteur', 'Lancez le moteur (au point mort) dès que le bateau traverse l’axe du vent.'],
      ['Contrez à la barre', 'Une fois le nez du bateau passé de l’autre côté du vent, poussez la barre à fond du côté où se trouve la grand-voile (barre sous le vent).'],
      ['Le bateau est à la cape (arrêté)', 'Le génois resté sur l’ancien bord se retrouve à contre. Le voilier se stabilise instantanément à l’arrêt, face ou trois-quarts au vent, et se met en dérive de sécurité très lente (1 nœud).'],
      ['Affalage ou enroulage express', 'Les voiles n’étant plus sous tension, vous pouvez enrouler le génois et affaler la grand-voile en toute sécurité, directement face au vent.'],
      ['Route au moteur', 'Vérifiez qu’aucun bout ne traîne à l’eau, remettez la barre au centre et embrayez la marche avant pour manœuvrer vers votre objectif.'],
      ['Le brise-lame', 'Présentez le côté du bateau (le franc-bord) à la victime. Le voilier fait écran contre les vagues et le vent, créant une zone d’eau calme pour faciliter la récupération.'],
    ] },
    { title: 'Au portant (génois)', allure: true, steps: [
      ['Lofez immédiatement', 'Tournez fermement la barre pour faire remonter le nez du bateau face au vent.'],
      ['Ne touchez pas au génois', 'Laissez la voile d’avant bordée. Elle va passer à contre dès que le bateau aura traversé l’axe du vent.'],
      ['Mettez le moteur en route', 'Profitez du moment où le bateau vire de bord pour démarrer le moteur (au point mort). Le moteur est prêt à être utilisé sans attendre.'],
      ['Poussez et bloquez la barre', 'Une fois le virement effectué, tournez la barre à fond du côté opposé (sous le vent).\n• Vent faible à modéré : barre à fond sous le vent (du même côté que la voile d’avant à contre), bloquée avec un bout ou le bloqueur de barre. Le bateau oscille gentiment et reste stable.\n• Vent fort, brise : le vent dans la grand-voile pousse fortement le bateau à lofer. Barre à fond, il risque de revirer dans l’autre sens (sur-capage) : ne braquez qu’à moitié ou aux deux tiers.\n• Grand-voile : choquez-la aux deux tiers. Elle ne doit pas trop propulser le bateau, seulement l’aider à garder son angle (environ 50° du vent).'],
      ['Le bateau est stabilisé (à la cape)', 'Le génois à contre et la barre se contrarient. Le voilier s’arrête instantanément et dérive très lentement.'],
      ['Affalez les voiles si nécessaire', 'Le bateau étant immobile et sécurisé, enroulez le génois et affalez la grand-voile sereinement.'],
      ['Engagez la marche avant au moteur', 'Assurez-vous qu’aucun cordage ne traîne dans l’eau, puis faites route au moteur vers votre objectif.'],
    ] },
    { title: 'Au portant sous spi asymétrique', allure: true, intro: 'Le but est de tuer la puissance de la voile instantanément sans que rien ne tombe à l’eau.', steps: [
      ['Le barreur abat en grand (plein vent arrière)', 'Le bateau se met « plein cul ». La grand-voile, perpendiculaire au bateau, masque totalement le spi, qui se dégonfle d’un coup (déventé).'],
      ['Larguez totalement et d’un coup la bosse d’amure (le point avant)', 'Le spi ne tient plus que par son écoute et sa drisse. Il flotte comme un drapeau derrière la grand-voile, sans aucune force.'],
      ['L’affalage express', 'Un équipier, à la descente ou dans le cockpit, attrape l’écoute de spi et tire la voile à l’abri derrière la grand-voile pour la faire descendre directement dans le bateau. Le pianiste file la drisse à la demande, en veillant à ce que la voile ne touche pas l’eau.'],
      ['Sécurisation des cordages', 'Impératif absolu : ramassez toutes les écoutes et drisses qui traînent. Rien ne doit pendre à l’arrière ou sur les côtés, sous peine d’enrouler l’hélice.'],
      ['Mise en route', 'Démarrez le moteur (au point mort).'],
      ['Enroulage du génois (si envoyé)', 'Si vous aviez un génois en plus du spi, enroulez-le immédiatement.'],
      ['Le demi-tour (manœuvre du bouton de chemise)', 'Choquez la grand-voile en grand et affalez si possible.'],
    ] },
    ...MOB_RECUP,
    { title: 'Si on la perd de vue', steps: MOB_ALERT },
  ],
  train: [
    { title: 'Tout de suite', steps: MOB_COMMON },
    { title: 'Manœuvre sous voile', steps: [
      ['Virer de bord ou empanner', ''],
      ['Lofer, virer foc à contre et continuer à abattre', ''],
      ['Passer sous le vent de la personne', ''],
      ['Empanner et remonter au près', ''],
      ['Attention à l’hélice', 'Vérifier qu’aucun bout ne traîne dans l’eau avant d’embrayer.'],
      ['Établir le contact', ''],
      ['Récupérer la personne', ''],
    ] },
    { title: 'Si on la perd de vue', steps: MOB_ALERT },
  ],
};
const MOB_KINDS = { real: '🚨 Cas réel', train: '🎓 Entraînement' };
let mobProc = store.get('ldb.mob2', null) || structuredClone(MOB_DEFAULT);
// Ajout des sections récupération / hypothermie dans une procédure déjà enregistrée (une seule fois).
if (!mobProc.recupAdded) {
  const r = mobProc.real = mobProc.real || [];
  const add = MOB_RECUP.filter((x) => !r.some((y) => y.id === x.id)).map((x) => structuredClone(x));
  const at = r.findIndex((y) => /perd de vue/i.test(y.title));
  r.splice(at < 0 ? r.length : at, 0, ...add);
  mobProc.recupAdded = true;
  store.set('ldb.mob2', mobProc);
}
// Une section homme à la mer pour le lac et une pour la mer (Corban, v178).
// La version mer part d'une copie de la procédure de Corban ; chacune se modifie à part (ldb.mob2 = lac, ldb.mob2mer = mer).
let mobProcMer = store.get('ldb.mob2mer', null);
if (!mobProcMer) { mobProcMer = structuredClone(mobProc); store.set('ldb.mob2mer', mobProcMer); }
const MOB_ZONES = { lac: '🏞 Lac', mer: '🌊 Mer' };
let mobZone = 'lac';
const curMob = () => (mobZone === 'mer' ? mobProcMer : mobProc);
let mobKind = 'real';
let mobAllure = 0;
const saveMob = () => { store.set('ldb.mob2', mobProc); store.set('ldb.mob2mer', mobProcMer); store.set('ldb.mob.at', new Date().toISOString()); };
const mobSecs = () => { const m = curMob(); return (m[mobKind] = m[mobKind] || []); };
/* ---------- Log de l'incident homme à la mer (Corban, 2026-10-31) ----------
   Chaque action touchée est notée avec l'heure et la position, comme une check-list : 1 toucher = fait (vert),
   un nouveau toucher annule (noté aussi). Rien n'est effacé : le log trace tout.
   Rangé dans la navigation ouverte (cruise.mobLogs), sinon sur le téléphone (ldb.mobLogs). */
const mobLogs = () => (cruise ? (cruise.mobLogs = cruise.mobLogs || []) : store.get('ldb.mobLogs', []));
function saveMobLogs(list) { if (cruise) { cruise.mobLogs = list; saveCruise(); } else store.set('ldb.mobLogs', list); }
const mobActive = () => mobLogs().find((l) => !l.end && l.kind === mobKind) || null;
const mobPosNow = () => (typeof sosPos !== 'undefined' && sosPos && Date.now() - new Date(sosPos.at).getTime() < 60000 ? { lat: sosPos.lat, lon: sosPos.lon } : null);
function mobLog(what, extra) {
  const list = mobLogs();
  let log = list.find((l) => !l.end && l.kind === mobKind);
  const t = new Date().toISOString();
  if (!log) {
    log = { id: uid(), kind: mobKind, zone: mobZone, start: t, events: [{ t, type: 'start', what: mobKind === 'train' ? 'Début de l’entraînement homme à la mer' : 'Début de l’incident homme à la mer' }] };
    list.push(log);
    if (cruise) { log.entryId = uid(); addEntry({ id: log.entryId, t, v: { evt: ['Homme à la mer'], note: mobKind === 'train' ? 'Entraînement : début du log' : 'Début du log de l’incident' } }); }
  }
  const ev = Object.assign({ t, what }, extra);
  const p = mobPosNow(); if (p && !ev.pos) ev.pos = p;
  log.events.push(ev);
  if (ev.pos) mobSetPos(log, ev.pos, ev.t);
  saveMobLogs(list);
  // Position GPS demandée à chaque action, ajoutée dès qu'elle arrive, sans faire attendre.
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition((g) => {
    const pos = { lat: g.coords.latitude, lon: g.coords.longitude };
    if (!ev.pos) ev.pos = pos;
    sosPos = { ...pos, at: new Date().toISOString() };
    mobSetPos(log, pos, new Date().toISOString());
    saveMobLogs(list);
    const li = document.querySelector(`[data-ev="${ev.t}"] .mob-ev-pos`); if (li) li.textContent = fmtPos(ev.pos);
    const box = document.getElementById('mobPosBox'); if (box) box.innerHTML = mobPosBoxHtml(log);
  }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: log.mobPos ? 5000 : 0 });
  return log;
}
// Position MOB : la première position du log (le plus près possible de la chute), notée aussitôt dans le journal.
function mobSetPos(log, pos, t) {
  if (!log.mobPos) {
    log.mobPos = { ...pos, t };
    log.events.splice(1, 0, { t, type: 'mobpos', what: '📍 Position MOB enregistrée', pos });
    if (cruise && log.entryId) { const en = cruise.entries.find((x) => x.id === log.entryId); if (en) { en.v.pos = { ...pos }; saveCruise(); } }
  }
  log.lastPos = { ...pos, t };
}
// Lac (Corban, v180) : appels des secours suisses ou français au choix, 112 en troisième choix ;
// position MOB et position actuelle toujours à l'écran.
const MOB_CALLS = { ch: ['🇨🇭 Secours suisses', '117', 'police, sauvetage sur le lac'], fr: ['🇫🇷 Secours français', '18', 'pompiers, secours sur le lac'], eu: ['🆘 Urgence européenne', '112', 'passe sur tous les réseaux'] };
let mobLive = null, mobWatch = null;
function mobLakeHtml(log) {
  const cur = mobLive || lastKnownPos();
  const order = cur && inFrenchLeman(cur) ? ['fr', 'ch', 'eu'] : ['ch', 'fr', 'eu'];
  return `<div class="mob-pos mob-pos-lake" id="mobPosBox">${mobPosBoxHtml(log)}</div>
    <div class="mob-calls">${order.map((k) => { const [l, n, s] = MOB_CALLS[k]; return `<button class="btn big ${k === 'eu' ? '' : 'danger'}" data-mcall="${k}">📞 ${l} · ${n}<small>${s}</small></button>`; }).join('')}</div>
    <p class="help">Si le premier appel n’aboutit pas, essayez le suivant. Les numéros courts suisses ne passent que sur un réseau suisse ; le 112 passe partout.</p>`;
}
function mobLakeWatch() {
  if (mobWatch != null || !navigator.geolocation) return;
  mobWatch = navigator.geolocation.watchPosition((g) => {
    if (!document.getElementById('mobPosBox')) { navigator.geolocation.clearWatch(mobWatch); mobWatch = null; return; }
    mobLive = { lat: g.coords.latitude, lon: g.coords.longitude, at: new Date().toISOString() };
    sosPos = { ...mobLive };
    const log = mobActive(); if (log) { mobSetPos(log, { lat: mobLive.lat, lon: mobLive.lon }, mobLive.at); saveMobLogs(mobLogs()); }
    const box = document.getElementById('mobPosBox'); if (box) box.innerHTML = mobPosBoxHtml(log);
  }, () => {}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
}
function mobPosBoxHtml(log) {
  if (!log && mobZone === 'lac') {
    const c = mobLive || lastKnownPos();
    return `<div class="mob-pos-main">📍 MOB : <b>pas encore enregistrée</b><br><small>« Démarrer le log » l’enregistre tout de suite</small></div>
      <div class="mob-pos-cur">Nous : ${c ? `<b>${esc(fmtPos(c))}</b>${c.at ? ' ' + tzHtml(c.at, true) : ''}` : 'recherche GPS…'}</div>`;
  }
  if (!log.mobPos) return '<b>📍 Position MOB : recherche GPS…</b>';
  const m = log.mobPos, c = log.lastPos;
  const d = c && typeof distNM === 'function' ? distNM(c, m) : null;
  const rel = c && d != null && d * 1852 >= 5 ? ` · MOB à <b>${Math.round(d * 1852)} m</b> au <b>${pad(Math.round(bearing(c, m)) % 360, 3)}°</b>` : '';
  return `<div class="mob-pos-main">📍 MOB : <b>${esc(fmtPos(m))}</b> ${tzHtml(m.t, true)}</div>
    ${c ? `<div class="mob-pos-cur">Nous : ${esc(fmtPos(c))} ${tzHtml(c.t, true)}${rel}</div>` : ''}`;
}
const mobStepDone = (log, key) => { if (!log) return null; let last = null; for (const e of log.events) if (e.key === key) last = e.type === 'step' ? e : null; return last; };
function mobLogText(log) {
  const lines = [`${log.kind === 'train' ? 'ENTRAÎNEMENT' : 'INCIDENT'} HOMME À LA MER · ${fmtShortDate(new Date(log.start))}${cruise && cruise.info.name ? ' · ' + cruise.info.name : ''}`];
  for (const e of log.events) lines.push(`${log.zone === 'lac' ? hms(new Date(e.t)) : bothTimes(e.t)}  ${e.what}${e.pos ? '  (' + fmtPos(e.pos) + ')' : ''}`);
  if (log.end) lines.push(`Durée : ${Math.round((new Date(log.end) - new Date(log.start)) / 60000)} min`);
  return lines.join('\n');
}
const mobEvHtml = (e) => `<li data-ev="${e.t}" class="mob-ev ${e.type || ''}"><b>${tzHtml(e.t, true)}</b><span>${esc(e.what)}<small class="mob-ev-pos">${e.pos ? esc(fmtPos(e.pos)) : ''}</small></span></li>`;
let mobTick = null;
// Heure locale et heure UTC (Corban : les deux, partout dans le log).
const hms = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hmsUtc = (d) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
const bothTimes = (iso) => { const d = new Date(iso); return `${hms(d)} · ${hmsUtc(d)}`; };

VIEWS.mob = function renderMob(arg) {
  if (arg === 'real' || arg === 'train') { mobKind = arg; mobAllure = 0; }
  // Plus de bouton « Démarrer le log » (Corban, v182) : ouvrir l'homme à la mer démarre la procédure SOS et le log MOB.
  // Seulement en arrivant sur la page (pas aux simples rafraîchissements, ni juste après la fin de procédure).
  const noStart = VIEWS.mob.noStart; VIEWS.mob.noStart = false;
  // v300 (Corban) : plus d'onglets Lac / Mer, la zone suit le bouton « Zone de navigation » ; un log en cours garde la sienne.
  { const a0 = mobActive(); if (arg === 'lac' || arg === 'mer') { mobZone = arg; mobAllure = 0; } else if (a0 && a0.zone) mobZone = a0.zone; else mobZone = typeof navZone === 'function' ? navZone() : 'lac'; }
  if (arg !== undefined && !noStart) {
    if (typeof sosLogActive === 'function' && !sosLogActive()) sosLogStart('Homme à la mer ouvert');
    if (!mobActive()) mobLog('Log démarré', { type: 'note' });
  }
  VIEWS.mob.seen = true;
  tzLocalOnly = mobZone === 'lac';
  const secs = mobSecs();
  const allures = secs.filter((x) => x.allure);
  if (mobAllure >= allures.length) mobAllure = 0;
  const log = mobActive();
  let n = 0;
  const stepsHtml = (sec, si) => `${sec.intro ? `<p class="mob-intro">${esc(sec.intro)}</p>` : ''}<ol class="mob-steps" start="${n + 1}" style="counter-reset: mob ${n}">${sec.steps.map(([t, d], j) => {
    n++;
    const key = `${sec.id || sec.title}#${j}`;
    const done = mobStepDone(log, key);
    return `<li class="mob-step ${done ? 'done' : ''}" data-step="${esc(key)}" data-label="${esc(`${n}. ${t}`)}" role="button" tabindex="0"><b>${esc(t)}</b>${d ? `<span>${esc(d).replace(/\n/g, '<br>')}</span>` : ''}${done ? `<em class="mob-done">✓ fait à ${tzHtml(done.t, true)}</em>` : ''}</li>`;
  }).join('')}</ol>`;
  let shownAllure = false;
  const body = secs.map((sec, si) => {
    if (!sec.allure) return `<h2 class="sub-h">${esc(sec.title)}</h2>${stepsHtml(sec, si)}`;
    if (shownAllure) return '';
    shownAllure = true;
    const cur = allures[mobAllure];
    return `<h2 class="sub-h">Le barreur, selon l’allure</h2>
      <div class="row c3 mob-allures">${allures.map((a, i) => `<button class="btn ${i === mobAllure ? 'on' : ''}" data-allure="${i}">${esc(a.title)}</button>`).join('')}</div>
      ${stepsHtml(cur, secs.indexOf(cur))}`;
  }).join('');
  const past = mobLogs().filter((l) => l.kind === mobKind && l.end).slice().reverse();
  const main = $('#view');
  main.innerHTML = `
    <button class="btn" data-go="${cruise ? 'sos' : 'more'}">◀ ${cruise ? 'Sécurité' : 'Plus'}</button>
    <h1 class="sos-title red">🛟 Homme à la mer</h1>
    <div class="row c2 ck-tabs">${Object.entries(MOB_KINDS).map(([k, l]) => `<button class="btn ${k === mobKind ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}</div>
    ${log ? `<div class="mob-live"><b>⏱ ${mobKind === 'train' ? 'Entraînement' : 'Incident'} en cours depuis ${tzHtml(log.start, true)} · <span id="mobClock"></span></b>
        ${mobZone === 'lac' ? '' : `<div class="mob-pos" id="mobPosBox">${mobPosBoxHtml(log)}</div>`}
        <div class="row"><button class="btn big primary" id="mobSaved">✔ Personne récupérée</button></div></div>`
      : ''}
    ${mobZone === 'lac' ? mobLakeHtml(log) : ''}
    <p class="help">Touchez chaque action quand elle est faite : elle passe en vert avec l’heure et la position. Un nouveau toucher l’annule (c’est noté aussi).</p>
    ${body}
    ${cruise ? `<div class="row c2"><button class="btn big primary" id="mobPos">📍 Noter la position MOB</button>${mobZone === 'lac' ? '<button class="btn big" data-go="sos">📞 Numéros d’urgence</button>' : '<button class="btn big danger" id="mobMayday">MAYDAY homme à la mer</button>'}</div>` : '<p class="help">Position MOB dans le journal et MAYDAY : disponibles une fois une navigation ouverte.</p>'}
    <p class="help" id="mobNote"></p>
    ${log ? `<h2 class="sub-h">Log de l’incident</h2><ol class="mob-log">${log.events.map(mobEvHtml).join('')}</ol>
      <div class="row ck-pub-row"><button class="btn big ck-pub" data-mshare="${log.id}">📤 Publier<small>texte du log</small></button></div>` : ''}
    ${past.length ? `<details class="section"><summary>Logs précédents (${past.length})</summary>${past.map((l) => `<div style="padding:0 14px 12px"><h3 class="sub-h">${esc(fmtShortDate(new Date(l.start)))} · ${tzHtml(l.start)} → ${tzHtml(l.end)}</h3><ol class="mob-log">${l.events.map(mobEvHtml).join('')}</ol><div class="row"><button class="btn ck-pub" data-mshare="${l.id}">📤 Publier ce log</button></div></div>`).join('')}</details>` : ''}
    <div class="row"><button class="btn" id="mobEdit">✎ Modifier la procédure ${mobKind === 'real' ? 'cas réel' : 'd’entraînement'}</button></div>
    ${typeof sosEndBtnHtml === 'function' ? sosEndBtnHtml() : ''}`;
  clearInterval(mobTick);
  if (mobZone === 'lac') mobLakeWatch();
  if (log) {
    const clk = () => { const el = $('#mobClock'); if (!el) return clearInterval(mobTick); const s2 = Math.floor((Date.now() - new Date(log.start)) / 1000); el.textContent = `${Math.floor(s2 / 60)} min ${pad(s2 % 60)} s`; };
    clk(); mobTick = setInterval(clk, 1000);
  }
  const keepScroll = (fn) => { const y = window.scrollY; fn(); window.scrollTo(0, y); };
  main.onclick = (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      buzz();
      const key = step.dataset.step, label = step.dataset.label;
      const cur = mobStepDone(mobActive(), key);
      if (cur) mobLog(`Annulé : ${label}`, { type: 'undo', key }); else mobLog(label, { type: 'step', key });
      return keepScroll(() => VIEWS.mob());
    }
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.kind) { VIEWS.mob.noStart = true; return VIEWS.mob(b.dataset.kind); }
    if (b.dataset.mzone) { VIEWS.mob.noStart = true; return VIEWS.mob(b.dataset.mzone); }
    if (b.dataset.mcall) { const [l, n] = MOB_CALLS[b.dataset.mcall]; if (mobActive()) mobLog(`📞 Appel ${l.replace(/^\S+\s/, '')} (${n})`, { type: 'note' }); openLink('tel:' + n); return; }
    if (b.dataset.allure) {
      mobAllure = Number(b.dataset.allure);
      if (mobActive()) mobLog(`Allure choisie : ${allures[mobAllure].title}`, { type: 'allure' });
      return keepScroll(() => VIEWS.mob());
    }
    if (b.id === 'mobStart') { mobLog('Log démarré', { type: 'note' }); return keepScroll(() => VIEWS.mob()); }
    if (b.id === 'mobSaved') return armed(b, 'Toucher encore : récupérée', () => { mobLog('✔ Personne récupérée', { type: 'saved' }); keepScroll(() => VIEWS.mob()); });
    if (b.id === 'mobEnd') return armed(b, 'Toucher encore : terminer', () => {
      const list = mobLogs(), l = list.find((x) => !x.end && x.kind === mobKind);
      if (l) { l.events.push({ t: new Date().toISOString(), type: 'end', what: 'Fin du log' }); l.end = new Date().toISOString(); saveMobLogs(list); }
      if (cruise && l) addEntry({ id: uid(), t: l.end, v: { evt: ['Homme à la mer'], note: `Fin du log (${Math.round((new Date(l.end) - new Date(l.start)) / 60000)} min)` } });
      toast('Log terminé et gardé'); VIEWS.mob();
    });
    if (b.dataset.mshare) { const l = mobLogs().find((x) => x.id === b.dataset.mshare); if (l) deliver(mobLogText(l), `log-homme-a-la-mer-${l.start.slice(0, 16).replace(/[:T]/g, '-')}.txt`, 'text/plain'); return; }
    if (b.id === 'mobEdit') return renderMobEdit(null);
    if (b.id === 'mobMayday') { mobLog('MAYDAY lancé', { type: 'mayday' }); go('sos'); return renderSosScript('mayday', SOS.mayday.natures.findIndex((x) => x[0] === 'Homme à la mer')); }
    if (b.id === 'mobPos') getGps(b, (p) => {
      const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
      sosPos = { ...pos, at: new Date().toISOString() };
      addEntry({ id: uid(), t: new Date().toISOString(), v: { evt: ['Homme à la mer'], pos, ...(mobKind === 'train' ? { note: 'Entraînement' } : {}) } });
      mobLog('📍 Position MOB notée', { type: 'pos', pos });
      keepScroll(() => VIEWS.mob());
      const nn = $('#mobNote'); if (nn) nn.innerHTML = `<b>Position MOB ${esc(fmtPos(pos))} à ${tzHtml(new Date(), true)}</b>, notée dans le journal et le log${mobKind === 'train' ? ' (entraînement)' : ''}.`;
    });
  };
};
// Édition : liste des sections, puis les étapes d'une section.
function renderMobEdit(si) {
  const main = $('#view');
  const secs = mobSecs();
  main.oninput = null;
  if (si == null) {
    main.innerHTML = `<button class="btn" id="meBack">◀ Homme à la mer</button>
      <h1>Modifier : ${MOB_KINDS[mobKind]}</h1>
      <p class="help">Touchez une section pour modifier ses étapes. Les sections « allure » sont les options du barreur.</p>
      <div class="checks">${secs.map((x, i) => `<div class="mob-sec-row"><button class="btn" data-sec="${i}">${x.allure ? '⛵ ' : ''}${esc(x.title)}<small>${x.steps.length} étape${x.steps.length > 1 ? 's' : ''}${x.allure ? ' · option du barreur' : ''}</small></button>
        <button class="btn" data-sup="${i}" ${i ? '' : 'disabled'} aria-label="Monter">▲</button></div>`).join('')}</div>
      <section class="field"><h2>Nouvelle section</h2>
        <input class="text" id="msNew" placeholder="ex. Au largue, Récupération, Premiers secours" autocomplete="off">
        <label class="cf wide"><span><input type="checkbox" id="msAllure"> Option du barreur selon l’allure</span></label>
        <div class="row"><button class="btn big primary" id="msAdd">＋ Ajouter la section</button></div></section>
      <div class="row c2"><button class="btn big" id="meDone">✔ Terminé</button><button class="btn" id="meReset">↺ Version d’origine</button></div>`;
    main.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      buzz();
      if (b.id === 'meBack' || b.id === 'meDone') return VIEWS.mob();
      if (b.dataset.sec) return renderMobEdit(Number(b.dataset.sec));
      if (b.dataset.sup) { const i = Number(b.dataset.sup); [secs[i - 1], secs[i]] = [secs[i], secs[i - 1]]; saveMob(); return renderMobEdit(null); }
      if (b.id === 'msAdd') { const v = $('#msNew').value.trim(); if (!v) { toast('Écrivez le titre de la section'); return $('#msNew').focus(); } secs.push({ title: v, steps: [], ...($('#msAllure').checked ? { allure: true } : {}) }); saveMob(); return renderMobEdit(secs.length - 1); }
      if (b.id === 'meReset') return armed(b, 'Toucher encore : version d’origine', () => { curMob()[mobKind] = structuredClone(MOB_DEFAULT[mobKind]); saveMob(); renderMobEdit(null); });
    };
    return;
  }
  const sec = secs[si];
  const steps = sec.steps;
  const again = () => renderMobEdit(si);
  main.innerHTML = `<button class="btn" id="meBack">◀ Sections</button>
    <h1>${esc(sec.title)}</h1>
    <section class="field"><h2>Section</h2>
      <input class="text" id="msTitle" value="${esc(sec.title)}" autocomplete="off">
      <textarea class="text" id="msIntro" rows="2" placeholder="Phrase d’introduction (facultatif)">${esc(sec.intro || '')}</textarea>
      <label class="cf wide"><span><input type="checkbox" id="msAl" ${sec.allure ? 'checked' : ''}> Option du barreur selon l’allure</span></label></section>
    <div class="ck-edit">${steps.map(([t, d], i) => `<div class="ck-row tt-row">
      <input class="text" data-mt="${i}" value="${esc(t)}" aria-label="Étape ${i + 1}">
      <textarea class="text" rows="3" data-md="${i}" placeholder="Détail (facultatif)">${esc(d)}</textarea>
      <div class="ck-tools"><button class="btn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Monter">▲</button><button class="btn danger" data-del="${i}" aria-label="Supprimer">✕</button></div>
    </div>`).join('')}</div>
    <section class="field"><h2>Nouvelle étape</h2>
      <input class="text" id="meNew" placeholder="Titre de l’étape" autocomplete="off">
      <textarea class="text" id="meNewD" rows="2" placeholder="Détail (facultatif)"></textarea>
      <label class="cf wide"><span>Placer après l’étape</span><select class="text" id="meAt">${steps.map((_, i) => `<option value="${i + 1}" ${i === steps.length - 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}<option value="0">au début</option></select></label>
      <div class="row"><button class="btn big primary" id="meAdd">＋ Ajouter l’étape</button></div></section>
    <div class="row c2"><button class="btn big" id="meDone">✔ Terminé</button><button class="btn danger" id="msDel">🗑 Supprimer la section</button></div>`;
  main.oninput = (e) => {
    const t = e.target;
    if (t.id === 'msTitle') { const v = t.value.trim(); if (v) { sec.title = v; saveMob(); } }
    else if (t.id === 'msIntro') { const v = t.value.trim(); if (v) sec.intro = v; else delete sec.intro; saveMob(); }
    else if (t.id === 'msAl') { if (t.checked) sec.allure = true; else delete sec.allure; saveMob(); }
    else if (t.dataset.mt != null) { const v = t.value.trim(); if (v) { steps[Number(t.dataset.mt)][0] = v; saveMob(); } }
    else if (t.dataset.md != null) { steps[Number(t.dataset.md)][1] = t.value.trim(); saveMob(); }
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'meBack' || b.id === 'meDone') return renderMobEdit(null);
    if (b.id === 'meAdd') { const v = $('#meNew').value.trim(); if (!v) { toast('Écrivez le titre de l’étape'); return $('#meNew').focus(); } steps.splice(Number($('#meAt').value), 0, [v, $('#meNewD').value.trim()]); saveMob(); toast('Étape ajoutée'); return again(); }
    if (b.dataset.up) { const i = Number(b.dataset.up); [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; saveMob(); return again(); }
    if (b.dataset.del) return armed(b, 'Sûr ?', () => { steps.splice(Number(b.dataset.del), 1); saveMob(); again(); });
    if (b.id === 'msDel') return holdDel(b, () => { secs.splice(si, 1); saveMob(); renderMobEdit(null); });
  };
}

function renderSosScript(kind, natureIdx) {
  const s = SOS[kind];
  const nature = s.natures && natureIdx != null ? s.natures[natureIdx] : null;
  const lines = s.script(sosContext(nature)).filter(Boolean);
  const main = $('#view');
  main.innerHTML = `
    <button class="btn" id="back">◀ Retour</button>
    <h1 class="sos-title ${s.cls}">${s.title}</h1>
    <details class="section" open><summary>Procédure ASN (bouton DSC de la VHF)</summary><ol class="asn">${s.asn.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
    ${s.natures ? `<h2 class="sub-h">Nature</h2><div class="row c2">${s.natures.map((x, i) => `<button class="btn ${i === natureIdx ? 'on' : ''}" data-n="${i}">${esc(x[0])}</button>`).join('')}</div>` : ''}
    <div class="script">${lines.map(([en, frTxt]) => `<p>${esc(en)}${frTxt ? `<small>${esc(frTxt)}</small>` : ''}</p>`).join('')}</div>
    <p class="help">Heure UTC calculée par le téléphone. Position : dernière position GPS connue (actualisable sur la page SOS).</p>`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'back') return VIEWS.sos();
    if (b.dataset.n != null) renderSosScript(kind, Number(b.dataset.n));
  };
  window.scrollTo(0, 0);
}

/* =====================================================================
   VHF : catalogue d'appels de routine, pré-remplis avec les infos du bord
   ===================================================================== */
const VHF_ASK = {
  station: { label: 'Station appelée', ph: 'ex. Port de Bandol, Cross Med' },
  other: { label: 'Navire appelé (nom ou description)', ph: 'ex. cargo rouge à tribord' },
  chan: { label: 'Canal de travail', ph: 'ex. 9', num: true },
  nights: { label: 'Nuits', ph: '1', num: true },
  eta: { label: 'Arrivée prévue (ETA)', ph: 'ex. 17:30' },
  dest: { label: 'Destination', ph: 'ex. Porquerolles' },
  from: { label: 'Port de départ', ph: 'ex. Toulon' },
};
const vv = (x, d) => (x != null && String(x).trim() !== '' ? String(x).trim() : `[${d}]`);
const VHF_CALLS = {
  check: { title: 'Essai radio', sub: 'Radio check', ask: ['station', 'chan'],
    tip: 'Sur un canal de travail ou de port, jamais d’essai long sur le 16.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Radio check on channel ${c.chan}. How do you read me?`, `Essai radio sur le canal ${c.chan}. Comment me recevez-vous ?`],
      ['OVER'],
    ] },
  berth: { title: 'Place au port', sub: 'Demande de place', ask: ['station', 'chan', 'nights', 'eta'],
    tip: 'Appeler la capitainerie sur son canal (souvent 9) 30 à 60 min avant l’arrivée.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`I would like a berth for ${c.nights} night${c.nights === '1' ? '' : 's'}.`, `Je souhaite une place pour ${c.nights} nuit${c.nights === '1' ? '' : 's'}.`],
      [`Length ${c.loaEn} metres, beam ${c.beamEn} metres, draft ${c.draftEn} metres.`, `Longueur ${c.loa} m, largeur ${c.beam} m, tirant d’eau ${c.draft} m.`],
      [`Our ETA is ${c.eta}. ${c.pob} people on board.`, `Arrivée prévue à ${c.eta}. ${c.pob} personnes à bord.`],
      ['OVER'],
    ] },
  arrive: { title: 'Entrée de port', sub: 'Arrivée, aide à l’amarrage', ask: ['station', 'chan'],
    tip: 'À l’entrée du port, pare-battages et amarres prêts.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      ['We are at the harbour entrance.', 'Nous sommes à l’entrée du port.'],
      ['Please give us a berth number and send a marinero to help us moor.', 'Merci de nous indiquer un numéro de place et de nous envoyer un marinero pour l’amarrage.'],
      [`Length ${c.loaEn} metres. Fenders and lines ready on both sides.`, `Longueur ${c.loa} m. Pare-battages et amarres prêts des deux bords.`],
      ['OVER'],
    ] },
  buoy: { title: 'Bouée, mouillage', sub: 'Demande de bouée', ask: ['station', 'chan', 'nights'],
    tip: 'Zones de mouillage organisé, parcs marins (Port-Cros, Calanques…).',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`I would like a mooring buoy for ${c.nights} night${c.nights === '1' ? '' : 's'}.`, `Je souhaite une bouée pour ${c.nights} nuit${c.nights === '1' ? '' : 's'}.`],
      [`Length ${c.loaEn} metres. Position ${c.pos}.`, `Longueur ${c.loa} m. Position ${c.pos}.`],
      ['OVER'],
    ] },
  fuel: { title: 'Carburant', sub: 'Station d’avitaillement', ask: ['station', 'chan', 'eta'],
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Is the fuel station open? We would like diesel, arriving at ${c.eta}.`, `La station carburant est-elle ouverte ? Nous souhaitons du gazole, arrivée à ${c.eta}.`],
      ['OVER'],
    ] },
  ship: { title: 'Navire à navire', sub: 'Appeler un bateau, passer sur un canal', ask: ['other', 'chan'],
    tip: 'Appel sur le 16, puis dégager vers 6, 8, 72 ou 77.',
    script: (c) => [
      [`${c.other} ${c.other}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Please switch to channel ${c.chan}.`, `Passez sur le canal ${c.chan}.`],
      ['OVER'],
      ['— puis sur le canal de travail —'],
      [`${c.other}, this is ${c.boat}, on channel ${c.chan}.`, `${c.other}, ici ${c.boat}, sur le canal ${c.chan}.`],
    ] },
  intent: { title: 'Intentions d’un navire', sub: 'Risque de collision, croisement', ask: ['other'],
    tip: 'Sur le 16 (ou le 13 pour la passerelle). Décrire sa position par rapport au navire.',
    script: (c) => [
      [`Vessel ${c.other}, vessel ${c.other}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`My position ${c.pos}.`, `Ma position ${c.pos}.`],
      ['Please advise your intentions. Do you see me?', 'Quelles sont vos intentions ? Me voyez-vous ?'],
      ['OVER'],
    ] },
  meteo: { title: 'Météo', sub: 'Demander le bulletin', ask: ['station', 'chan'],
    tip: 'En France, le CROSS diffuse les bulletins aux heures annoncées sur le 16 : écouter d’abord.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Position ${c.pos}.`, `Position ${c.pos}.`],
      ['Request the latest weather forecast for this area.', 'Je demande le dernier bulletin météo pour cette zone.'],
      ['OVER'],
    ] },
  route: { title: 'Avis de départ', sub: 'Route, ETA, personnes à bord', ask: ['station', 'from', 'dest', 'eta'],
    tip: 'Utile pour une traversée : la station sait qui vous êtes et où vous allez.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Departed from ${c.from}, bound for ${c.dest}. ETA ${c.eta}.`, `Parti de ${c.from}, à destination de ${c.dest}. Arrivée prévue ${c.eta}.`],
      [`${c.pob} people on board. ${c.desc}`, `${c.pob} personnes à bord. ${c.descFr}`],
      ['OVER'],
    ] },
  bridge: { title: 'Pont, écluse', sub: 'Demande d’ouverture ou de passage', ask: ['station', 'chan', 'eta'],
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Request passage at ${c.eta}, inbound. Air draft ${c.airEn} metres.`, `Je demande le passage à ${c.eta}. Tirant d’air ${c.airDraft} m.`],
      ['OVER'],
    ] },
};
settings.vhf = settings.vhf || {};
const VHF_PER_CALL = ['station', 'chan'];

function vhfContext(k) {
  const base = sosContext(null);
  const i = cruise.info;
  const d = cruise.days[dayKey(new Date())] || {};
  const s = settings.vhf;
  const p = lastKnownPos();
  const here = p && p.lat != null && typeof nearestPort === 'function' ? nearestPort(p.lat, p.lon, 10) : '';
  const port = here ? `Port de ${here}` : '';
  const stDef = { check: i.coastStation, berth: port, arrive: port, buoy: '', fuel: port, meteo: i.coastStation, route: i.coastStation, bridge: '' }[k];
  const defs = { station: stDef, chan: k === 'ship' ? '72' : k === 'check' || k === 'meteo' || k === 'route' ? '' : d.canal || i.vhfMarina, nights: '1', eta: d.eta, dest: d.dest, from: here || '' };
  const sk = (key) => (VHF_PER_CALL.includes(key) ? `${key}_${k}` : key);
  const val = (key) => (s[sk(key)] != null && s[sk(key)] !== '' ? s[sk(key)] : defs[key]);
  return {
    ...base, raw: val,
    station: vv(val('station'), 'station').toUpperCase(), other: vv(val('other'), 'navire').toUpperCase(),
    chan: vv(val('chan'), 'canal'), nights: vv(val('nights'), 'nuits'), eta: vv(val('eta'), 'heure'),
    dest: vv(val('dest'), 'destination'), from: vv(val('from'), 'départ'),
    loaEn: vv(i.loa || pairConv(i.loaFt, 0.3048, 2), 'length').replace(',', '.'), beamEn: vv(i.beam, 'beam').replace(',', '.'), draftEn: vv(i.draft, 'draft').replace(',', '.'), airEn: vv(i.airDraft, 'air draft').replace(',', '.'),
    loa: vv(i.loa || pairConv(i.loaFt, 0.3048, 2), 'longueur'), beam: vv(i.beam, 'largeur'), draft: vv(i.draft, 'tirant d’eau'), airDraft: vv(i.airDraft, 'tirant d’air'),
  };
}

const VHF_CHANNELS = [
  ['16', 'Appel et détresse, veille permanente. Pas de conversation : on s’y appelle puis on dégage.'],
  ['72 · 77', 'Bateau à bateau entre plaisanciers : les plus utilisés en Europe.'],
  ['06 · 08', 'Bateau à bateau aussi (le 06 peut servir aux secours avec les aéronefs : le libérer à la demande).'],
  ['09', 'Ports de plaisance et capitaineries (souvent, en France notamment).'],
  ['12 · 14', 'Ports de commerce, services portuaires.'],
  ['13', 'Passerelle à passerelle entre navires de commerce (sécurité de la navigation).'],
  ['70', 'ASN (appel numérique) seulement, jamais en phonie.'],
];
// Exemple de dialogue : [qui, canal, anglais, français].
const VHF_DIALOG = (me, other) => [
  ['A', '16', `${other}, ${other}, ${other}, this is ${me}, ${me}, ${me}. Over.`, `${other} ×3, ici ${me} ×3. À vous.`],
  ['B', '16', `${me}, this is ${other}. Over.`, `${me}, ici ${other}. À vous.`],
  ['A', '16', `${other}, this is ${me}. Channel 72. Over.`, `${other}, ici ${me}. Canal 72. À vous.`],
  ['B', '16', `${me}, this is ${other}. Channel 72, going up.`, `${me}, ici ${other}. Canal 72, je commute.`],
  ['—', '', 'Les deux passent sur le 72.', ''],
  ['A', '72', `${other}, this is ${me}. Over.`, `${other}, ici ${me}. À vous.`],
  ['B', '72', `${me}, this is ${other}. Go ahead.`, `${me}, ici ${other}. Je vous écoute.`],
  ['A', '72', 'We plan to anchor in the bay tonight. Is there enough room near you? Over.', 'Nous voulons mouiller dans la baie ce soir. Y a-t-il de la place près de vous ? À vous.'],
  ['B', '72', 'Yes, plenty of room, five metres of water, good holding. Over.', 'Oui, beaucoup de place, 5 m d’eau, bonne tenue. À vous.'],
  ['A', '72', `Thank you. ${me} back to channel 16. Out.`, `Merci. ${me} retourne sur le 16. Terminé.`],
];
// VHF en deux sections (Corban, v193) : navigation intérieure (lacs) et extérieure (mer, océan).
// En arrivant, l'appli choisit la section selon l'endroit (navZone) ; les onglets permettent de changer.
let vhfZone = null;
const VHF_TABS = { int: ['🏞 Intérieure', 'lacs'], ext: ['🌊 Extérieure', 'mer, océan'] };
const vhfTabsHtml = (z) => ''; // v303 (Corban) : plus d'onglets Intérieure / Extérieure, la zone de navigation décide
const vhfTabsHtmlOld = (z) => `<div class="row c2 ck-tabs">${Object.entries(VHF_TABS).map(([k, [l, s]]) => `<button class="btn ${k === z ? 'on' : ''}" data-vzone="${k}">${l}<small>${s}</small></button>`).join('')}</div>`;
VIEWS.vhf = function renderVhf(arg) {
  if (arg === 'int' || arg === 'ext') vhfZone = arg;
  else vhfZone = (typeof navZone === 'function' ? navZone() : (isLake() ? 'lac' : 'mer')) === 'lac' ? 'int' : 'ext';
  if (vhfZone === 'int') return renderVhfLake();
  if (!cruise) { const main = $('#view'); main.innerHTML = `<h1>VHF</h1>${vhfTabsHtml('ext')}<p class="help">Les appels de routine en mer reprennent le bateau, l’indicatif et le MMSI de la navigation : ouvrez ou créez d’abord une navigation en mer.</p><div class="row"><button class="btn big primary" data-go="cruises">⛵ Mes navigations</button></div>`; main.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; buzz(); if (b.dataset.vzone) return VIEWS.vhf(b.dataset.vzone); if (b.dataset.go) go(b.dataset.go); }; return; }
  const main = $('#view');
  const me = (cruise.info.boat || 'Inspiration').toUpperCase();
  const other = 'ALBATROS';
  main.innerHTML = `
    <button class="btn" data-go="sos">◀ Sécurité</button>
    <h1>VHF : appels de routine</h1>
    ${vhfTabsHtml('ext')}
    <p class="help">Messages pré-remplis avec le bateau, l’indicatif, le MMSI, les dimensions, la position et l’équipage. Choisissez un appel.</p>
    <div class="vhf-grid">${Object.entries(VHF_CALLS).map(([k, c]) => `<button class="btn vhf-call" data-vhf="${k}"><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></button>`).join('')}</div>
    <button class="btn big" data-go="alpha">🔤 Alphabet phonétique<small>Alfa, Bravo, Charlie… et épeler un mot</small></button>
    <section class="field"><h2>Procédure</h2><ol class="asn">
      <li>Écouter avant de parler : le canal doit être libre.</li>
      <li>Appel : nom de la station 2 ou 3 fois, puis « This is » et votre nom 3 fois.</li>
      <li>Sur le 16, appeler seulement puis dégager vers un canal de travail.</li>
      <li>Phrases courtes, finir chaque tour par OVER et la fin par OUT.</li></ol></section>
    <section class="field"><h2>Exemple : du canal 16 vers un canal de travail</h2>
      <p class="help">${esc(me)} appelle le voilier ${esc(other)} ancré non loin. Le 16 sert seulement à se trouver : on dégage tout de suite.</p>
      <div class="vhf-dlg">${VHF_DIALOG(me, other).map(([who, ch, en, frTxt]) => who === '—' ? `<p class="vhf-sw">${esc(en)}</p>` : `<div class="vhf-say ${who === 'A' ? 'a' : 'b'}"><span class="vhf-who">${esc(who === 'A' ? me : other)} · canal ${ch}</span><b>${esc(en)}</b><small>${esc(frTxt)}</small></div>`).join('')}</div>
      <p class="help">Si le canal proposé est occupé, l’autre répond « Channel 72 busy, propose 77 » (72 occupé, je propose 77). Si personne ne répond après 3 appels, attendre 2 minutes avant de rappeler. Après la conversation, revenir en veille sur le 16.</p></section>
    <section class="field"><h2>Canaux entre bateaux proches</h2>
      <div class="value" style="font-size:34px">72 · 77 · 06 · 08</div>
      <table class="vhf-ch">${VHF_CHANNELS.map(([c, t]) => `<tr><th>${esc(c)}</th><td>${esc(t)}</td></tr>`).join('')}</table>
      <p class="help">Pour un bateau proche, passer en petite puissance (bouton 1 W / LO). Règles et canaux peuvent varier selon le pays : suivre les indications locales.</p></section>`;
  main.onclick = (e) => {
    const b = e.target.closest('[data-vhf],[data-go],[data-vzone]');
    if (!b) return;
    buzz();
    if (b.dataset.vzone) return VIEWS.vhf(b.dataset.vzone);
    if (b.dataset.go) return go(b.dataset.go);
    renderVhfScript(b.dataset.vhf);
  };
};
// Section intérieure (lac) : préparée avec ce que l'appli sait déjà. Sur le lac, les secours se joignent
// par téléphone (choix de Corban, 2026-10-31 : pas de messages radio ni de canaux sur le lac) ;
// les règles VHF propres aux lacs suisses seront ajoutées quand Corban les donnera.
function renderVhfLake() {
  tzLocalOnly = true;
  const main = $('#view');
  const i = (cruise && cruise.info) || {};
  const p = lastKnownPos();
  const fr = p && typeof inFrenchLeman === 'function' && inFrenchLeman(p);
  const order = fr ? ['fr', 'ch', 'eu'] : ['ch', 'fr', 'eu'];
  const n = cruise && cruise.crew ? cruise.crew.length : 0;
  const boat = i.boat || '(nom du bateau)';
  const msg = [
    `Ici le voilier ${boat}${i.reg ? ', immatriculé ' + i.reg : ''}.`,
    `Position : ${p ? fmtPos(p) : '(position GPS)'}${fr ? ', côté français du Léman' : ''}.`,
    'Nature du problème : (homme à la mer, voie d’eau, avarie, malaise…).',
    `Nous sommes ${n || '(nombre)'} personne${n === 1 ? '' : 's'} à bord.`,
    'Aide demandée : (remorquage, secours, médecin…).',
    `Description : ${radioDesc(i, 'fr') || '(coque, voiles)'}.`,
  ];
  main.innerHTML = `
    <button class="btn" data-go="sos">◀ Sécurité</button>
    <h1>VHF · navigation intérieure</h1>
    ${vhfTabsHtml('int')}
    <section class="field"><h2>Appeler les secours</h2>
      <div class="mob-calls">${order.map((k) => { const [l, nn, s] = MOB_CALLS[k]; return `<button class="btn big ${k === 'eu' ? '' : 'danger'}" data-vcall="${k}">📞 ${l} · ${nn}<small>${s}</small></button>`; }).join('')}</div>
      <p class="help">Sur le lac, les secours se joignent par téléphone. Si le premier appel n’aboutit pas, essayer le suivant. Les numéros courts suisses ne passent que sur un réseau suisse ; le 112 passe partout.</p></section>
    <section class="field"><h2>Position à donner</h2>
      <div class="value" style="font-size:26px">${p ? esc(fmtPos(p)).replace('  ', '<br>') : '– –'}</div>
      ${p && p.at ? `<p class="help" style="text-align:center">relevée à ${tzHtml(new Date(p.at))}</p>` : ''}
      <button class="btn big primary" id="vhfGps">📍 Actualiser la position GPS</button></section>
    <section class="field"><h2>Message à dicter</h2>
      <div class="script">${msg.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      <p class="help">Parler lentement, donner la position en premier si la liaison est mauvaise, épeler le nom du bateau avec l’alphabet.</p></section>
    <button class="btn big" data-go="alpha">🔤 Alphabet phonétique<small>Alfa, Bravo, Charlie… et épeler un mot</small></button>
    <section class="field"><h2>Règles VHF sur les lacs</h2>
      <p class="help">À compléter : les règles et canaux VHF propres aux lacs suisses seront ajoutés ici.</p></section>`;
  main.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    buzz();
    if (b.dataset.vzone) return VIEWS.vhf(b.dataset.vzone);
    if (b.dataset.vcall) { const [l, nn] = MOB_CALLS[b.dataset.vcall]; if (typeof sosLogActive === 'function' && sosLogActive()) sosLogAdd(`VHF lac › Appel ${l} (${nn})`); openLink('tel:' + nn); return; }
    if (b.dataset.go) return go(b.dataset.go);
  };
  $('#vhfGps').onclick = (e) => { e.stopPropagation(); buzz(); getGps(e.currentTarget, (pp) => { sosPos = { lat: pp.coords.latitude, lon: pp.coords.longitude, at: new Date().toISOString() }; renderVhfLake(); }); };
}

function renderVhfScript(k) {
  const call = VHF_CALLS[k];
  const main = $('#view');
  const c0 = vhfContext(k);
  const draw = () => {
    const c = vhfContext(k);
    $('#vhfScript').innerHTML = call.script(c).filter(Boolean).map(([en, frTxt]) => `<p>${esc(en)}${frTxt ? `<small>${esc(frTxt)}</small>` : ''}</p>`).join('');
  };
  main.innerHTML = `
    <button class="btn" id="back">◀ Appels VHF</button>
    <h1 class="sos-title vhf">${esc(call.title)}</h1>
    ${call.tip ? `<p class="help">${esc(call.tip)}</p>` : ''}
    <div class="vhf-ask">${call.ask.map((a) => `<label class="field${VHF_ASK[a].num || a === 'eta' ? '' : ' wide'}"><span>${esc(VHF_ASK[a].label)}</span>
      <input data-ask="${a}" value="${esc(c0.raw(a) || '')}" placeholder="${esc(VHF_ASK[a].ph)}" ${VHF_ASK[a].num ? 'inputmode="numeric"' : ''} autocomplete="off"></label>`).join('')}</div>
    <div class="script" id="vhfScript"></div>
    <p class="help">Bateau, indicatif, MMSI et dimensions viennent de Bateau et croisière. Position : dernière position GPS connue.</p>
    ${!cruise.info.boat || !cruise.info.loa ? '<button class="btn" data-go="info">Compléter dans Bateau et croisière</button>' : ''}`;
  draw();
  main.oninput = (e) => {
    const a = e.target.dataset.ask;
    if (!a) return;
    settings.vhf[VHF_PER_CALL.includes(a) ? `${a}_${k}` : a] = e.target.value; saveSettings(); draw();
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.id === 'back') return VIEWS.vhf();
    if (b.dataset.go) go(b.dataset.go);
  };
  window.scrollTo(0, 0);
}

/* Alphabet phonétique : page dédiée, grands caractères, épeler un mot */
const NATO_FR = { A: 'AL-fa', B: 'BRA-vo', C: 'TCHAR-li', D: 'DEL-ta', E: 'EK-o', F: 'FOX-trott', G: 'GOLF', H: 'o-TÈL', I: 'IN-di-a', J: 'DJOU-li-ett',
  K: 'KI-lo', L: 'LI-ma', M: 'MAÏK', N: 'no-VEMM-beur', O: 'OS-kar', P: 'pa-PA', Q: 'ké-BÈK', R: 'RO-mi-o', S: 'si-ÈR-ra', T: 'TANG-go',
  U: 'YOU-ni-form', V: 'VIK-teur', W: 'OUIS-ki', X: 'EKS-ré', Y: 'YANG-ki', Z: 'ZOU-lou',
  0: 'ZI-ro', 1: 'OUANN', 2: 'TOU', 3: 'TRI', 4: 'FO-eur', 5: 'FA-ïf', 6: 'SIKS', 7: 'SÈ-veunn', 8: 'EÏT', 9: 'NAÏ-neur' };
let alphaBack = 'more';
VIEWS.lists = function renderLists() {
  const main = $('#view');
  main.innerHTML = `<button class="btn" data-go="more">◀ data</button><h1>📋 Listes</h1>
    <div class="row prep-col">
      <button class="btn big" data-go="beaufort">🌬 Échelle de Beaufort<small>force du vent en nœuds, aspect de la mer</small></button>
      <button class="btn big" data-go="douglas">🌊 Échelle de Douglas<small>état de la mer, hauteur des vagues</small></button>
      <button class="btn big" data-go="alpha">🔤 Alphabet phonétique<small>Alfa, Bravo, Charlie…</small></button>
    </div>`;
  main.onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) { buzz(); go(b.dataset.go); } };
};
function scaleLangBar() {
  const en = settings.scaleLang === 'en';
  return `<div class="chips scale-lang"><button class="btn ${en ? '' : 'on'}" data-slang="fr">🇫🇷 Français</button><button class="btn ${en ? 'on' : ''}" data-slang="en">🇬🇧 English</button></div>`;
}
function scaleView(render) {
  const main = $('#view');
  render(main, settings.scaleLang === 'en');
  main.onclick = (e) => {
    const l = e.target.closest('[data-slang]'); if (l) { buzz(); settings.scaleLang = l.dataset.slang; saveSettings(); return scaleView(render); }
    const b = e.target.closest('[data-go]'); if (b) { buzz(); go(b.dataset.go); }
  };
}
VIEWS.beaufort = function renderBeaufort() {
  scaleView((main, en) => {
    main.innerHTML = `<button class="btn" data-go="lists">◀ Listes</button><h1>🌬 ${en ? 'Beaufort scale' : 'Échelle de Beaufort'}</h1>${scaleLangBar()}
      <table class="scale-tbl"><thead><tr><th>${en ? 'Force' : 'Force'}</th><th>${en ? 'Knots' : 'Nœuds'}</th><th>${en ? 'Description' : 'Appellation'}</th></tr></thead><tbody>
      ${BEAUFORT_TBL.map(([f, kn, nf, ne, mf, me]) => `<tr class="bf-${f}"><td class="sc-n">${f}</td><td class="sc-kn">${kn}</td><td><b>${esc(en ? ne : nf)}</b><small>${esc(en ? me : mf)}</small></td></tr>`).join('')}
      </tbody></table>
      <p class="help">${en ? 'WMO scale. Wind rounded to the nearest knot. km/h = knots × 1.852.' : 'Échelle de l’OMM. Vent arrondi au nœud entier. km/h = nœuds × 1,852.'}</p>`;
  });
};
VIEWS.douglas = function renderDouglas() {
  scaleView((main, en) => {
    main.innerHTML = `<button class="btn" data-go="lists">◀ Listes</button><h1>🌊 ${en ? 'Douglas sea scale' : 'Échelle de Douglas'}</h1>${scaleLangBar()}
      <table class="scale-tbl"><thead><tr><th>${en ? 'Code' : 'Code'}</th><th>${en ? 'Wave height' : 'Hauteur'}</th><th>${en ? 'Sea state' : 'État de la mer'}</th></tr></thead><tbody>
      ${DOUGLAS.map(([c, nf, h], i) => `<tr><td class="sc-n">${c}</td><td class="sc-kn">${esc(en ? h.replace(/ à /g, ' to ').replace('plus de', 'over').replace(/,/g, '.') : h)}</td><td><b>${esc(en ? DOUGLAS_EN[i] : nf.charAt(0).toUpperCase() + nf.slice(1))}</b></td></tr>`).join('')}
      </tbody></table>
      <p class="help">${en ? 'WMO sea state code (table 3700). Significant wave height.' : 'Code de l’état de la mer de l’OMM (table 3700), termes des bulletins Météo-France. Hauteur des vagues significatives.'}</p>`;
  });
};
VIEWS.alpha = function renderAlpha() {
  const main = $('#view');
  const word = settings.alphaWord != null ? settings.alphaWord : ((cruise && cruise.info.boat) || '');
  main.innerHTML = `
    <button class="btn" data-go="${alphaBack}">◀ Retour</button>
    <h1>Alphabet phonétique</h1>
    <label class="field alpha-spell"><span>Épeler un mot</span>
      <input id="alphaIn" value="${esc(word)}" placeholder="ex. nom du bateau, indicatif" autocomplete="off" autocapitalize="characters"></label>
    <div class="alpha-out" id="alphaOut"></div>
    <div class="alpha-grid">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map((k) => [k, NATO[k]]).map(([k, v]) => `<div class="alpha-cell"><b>${k}</b><span>${v}</span><small>${NATO_FR[k]}</small></div>`).join('')}</div>
    <p class="help">Prononciation : la syllabe en majuscules est accentuée. Le 9 se dit « Niner » pour ne pas le confondre avec « nein ».</p>`;
  const draw = () => {
    const w = $('#alphaIn').value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    $('#alphaOut').innerHTML = w.trim() ? w.split('').map((c) => (c === ' ' ? '<i class="sp"></i>' : `<span>${NATO[c]}</span>`)).join('') : '';
  };
  draw();
  $('#alphaIn').oninput = (e) => { settings.alphaWord = e.target.value; saveSettings(); draw(); };
  main.onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) { buzz(); go(b.dataset.go); } };
};

/* =====================================================================
   PLUS : croisières, bateau, équipage, export, réglages
   ===================================================================== */
// data : les rubriques en pastilles, l'une sous l'autre, sans introduction (Corban, v132).
// Ordre par l'usage : chaque ouverture fait remonter la rubrique d'un cran ; les moins utilisées descendent peu à peu.
let dataOrder = store.get('ldb.dataOrder', []);
function dataBump(key) {
  const vis = $$('#view [data-tile]').map((x) => x.dataset.tile);
  const i = vis.indexOf(key);
  if (i <= 0) return;
  [vis[i - 1], vis[i]] = [vis[i], vis[i - 1]];
  dataOrder = vis.concat(dataOrder.filter((k) => !vis.includes(k)));
  store.set('ldb.dataOrder', dataOrder);
}
function dataTiles(list) {
  const pos = (k, i) => { const j = dataOrder.indexOf(k); return j < 0 ? 1000 + i : j; };
  return list.filter(Boolean).map((t, i) => ({ t, p: pos(t[0], i), i })).sort((x, y) => x.p - y.p || x.i - y.i).map((x) => x.t[1]).join('');
}
const tileBtn = (go, html, cls) => [go, `<button class="btn big${cls ? ' ' + cls : ''}" data-go="${go}" data-tile="${go}">${html}</button>`];
VIEWS.more = function renderMore() {
  const main = $('#view');
  const arcgis = ['arcgis', `<a class="btn big link-btn" data-tile="arcgis" href="${LEMAN_ARCGIS}" target="_blank" rel="noopener">🌐 Carte ArcGIS du Léman<small>carte en ligne, réseau nécessaire</small></a>`];
  const stats = index.some((x) => x.type === 'lac') ? tileBtn('stats', '📊 Cumul sur le lac<small>milles et heures par semaine, mois, année</small>') : null;
  const list = !cruise ? [
    // v221 (Corban) : « Mes navigations » retiré de data.
    tileBtn('traces', '🛰 Mes traces<small>traces enregistrées, carte, GPX</small>'),
    tileBtn('ckbases', `✅ Mes check-lists<small>check-in, bases modèles</small>`),
    // v218 (Corban) : « Recueil des bateaux » retiré de data, seul « Mes bateaux » reste.
    tileBtn('boats', `🚤 Mes bateaux<small>${boats.length} bateau${boats.length > 1 ? 'x' : ''}, données et check-lists du lac</small>`),
    tileBtn('people', `🧭 Les coéquipiers·ères<small>${members.length} fiche${members.length > 1 ? 's' : ''} : les personnes et leurs caractéristiques</small>`),
    tileBtn('crews', `👥 Équipages<small>${crewSets.length} groupe${crewSets.length > 1 ? 's' : ''} de navigants, avec les rôles</small>`),
    tileBtn('tasktpl', '🧑‍🤝‍🧑 Modèle des tâches à bord<small>repas, propreté, technique</small>'),
    tileBtn('mob', '🛟 Homme à la mer<small>procédures cas réel et entraînement</small>'),
    tileBtn('soslogs', `🆘 Logs SOS<small>${typeof sosLogsCount === 'function' ? sosLogsCount() : 'logs automatiques des actions SOS'}</small>`),
    tileBtn('rules', '📘 Règles du Léman<small>permis, priorités, rives, feux de tempête</small>'),
    tileBtn('docs', '📄 Documents obligatoires à bord<small>permis, titre de navigation, RPP, RGP</small>'),
    tileBtn('cartes', `🗺 Mes cartes<small>OpenStreetMap et OpenSeaMap chargées autour de moi (${settings.mapRadius || 50} km), sans réseau</small>`),
    tileBtn('nmea', '📡 Instruments du bateau<small>NMEA en Wi-Fi (Signal K), import de fichiers NMEA</small>'),
    tileBtn('marks', `📌 Mes marques<small>${typeof marks !== 'undefined' ? marks.length : 0} marque(s), Go to</small>`),
    tileBtn('lists', '📋 Listes<small>échelles de Beaufort et de Douglas, alphabet phonétique</small>'),
    stats,
    // v437 (Corban) : tuile Réglages retirée, redondante avec la roue dentée.
  ] : [
    tileBtn('day', `📅 Journée<small>${isLake() ? 'fiche de la sortie' : 'fiche du jour, météo, route prévue'}</small>`),
    tileBtn('log', '📜 Journal<small>toutes les entrées</small>'),
    tileBtn('soslogs', `🆘 Logs SOS<small>${typeof sosLogsCount === 'function' ? sosLogsCount() : 'logs automatiques des actions SOS'}</small>`),
    tileBtn('traces', '🛰 Mes traces<small>traces enregistrées, carte, GPX</small>'),
    // v221 (Corban) : « Mes navigations » retiré de data.
    hasAboard() ? tileBtn('aboard', '🧑‍🤝‍🧑 À bord<small>tournus des tâches : repas, propreté, technique</small>') : null,
    tileBtn('checklist', `✅ Check-lists<small>${esc(checklistSub())}</small>`),
    tileBtn('ckbases', `✅ Mes check-lists<small>check-in, bases modèles</small>`),
    isLake() ? tileBtn('sheet', '📸 Fiche du jour<small>à envoyer sur WhatsApp</small>') : null,
    isLake() ? tileBtn('rules', '📘 Règles du Léman<small>permis, priorités, rives, feux de tempête</small>') : null,
    isLake() ? tileBtn('docs', '📄 Documents obligatoires à bord<small>permis, titre de navigation, RPP, RGP, accord franco-suisse</small>') : null,
    stats,
    // v218 (Corban) : « Recueil des bateaux » retiré de data, seul « Mes bateaux » reste.
    tileBtn('boats', `🚤 Mes bateaux<small>${boats.length} bateau${boats.length > 1 ? 'x' : ''}, données et check-lists</small>`),
    tileBtn('info', '⚓ Bateau et croisière<small>identité radio, moteur, numéros utiles</small>'),
    tileBtn('people', `🧭 Les coéquipiers·ères<small>${members.length} fiche${members.length > 1 ? 's' : ''} : les personnes et leurs caractéristiques</small>`),
    // v308 (Corban) : « Équipage à bord » fusionné dans Équipages : en navigation la tuile ouvre l'équipage réel, les groupes sont en dessous.
    tileBtn('crews', `👥 Équipages<small>${cruise.crew.length} à bord · ${crewSets.length} groupe${crewSets.length > 1 ? 's' : ''} enregistré${crewSets.length > 1 ? 's' : ''}</small>`),
    tileBtn('lists', '📋 Listes<small>échelles de Beaufort et de Douglas, alphabet phonétique</small>'),
    tileBtn('marks', `📌 Mes marques<small>${marks.length} marque(s), Go to</small>`),
    tileBtn('cartes', `🗺 Mes cartes<small>OpenStreetMap et OpenSeaMap chargées autour de moi (${settings.mapRadius || 50} km), sans réseau</small>`),
    tileBtn('map', `🗺 ${isLake() ? 'Carte du Léman' : 'Carte'}<small>${isLake() ? 'carte nationale suisse, profondeurs, position GPS' : 'trace et entrées sur la carte'}</small>`),
    tileBtn('nmea', '📡 Instruments du bateau<small>NMEA en Wi-Fi (Signal K), import de fichiers NMEA</small>'),
    tileBtn('print', '📤 Publier le livre de bord<small>PDF A4, choisir les pages</small>'),
    tileBtn('export', `⇪ Échanges de fichiers<small>${isLake() ? 'tableur, sauvegarde' : 'tableur, sauvegarde, trace GPX'}</small>`),
  ];
  main.innerHTML = `<div class="row more-grid data-tiles">${dataTiles(list)}</div>`;
  main.onclick = (e) => {
    const a = e.target.closest('[data-tile]');
    if (a) dataBump(a.dataset.tile);
    const b = e.target.closest('[data-go]'); if (b) { buzz(); go(b.dataset.go); }
  };
};

let newType = null;
let newBoat = null;
let newPurpose = 'Entraînement';
let newPlace; // port de départ : undefined = pas encore cherché
let newZone = null;
let nameDirty = false;
let placeAt = 0, placeBusy = false;
// Accueil : trois modes séparés (mer, lac à la journée, lac en croisière), chacun avec ses sorties.
VIEWS.cruises = function renderCruises() {
  if (newType === 'lac') newType = 'lacj';
  if (!MODES[newType]) newType = cruise ? curMode() : 'mer';
  const all = [...index].sort((a, b) => b.created.localeCompare(a.created)).map((c) => {
    const data = store.get('ldb.cruise.' + c.id, { entries: [] });
    return { c, data, mode: modeOf({ type: c.type, duree: c.duree || data.duree }) };
  });
  const main = $('#view');
  const typed = $('#newName') ? $('#newName').value : '';
  if ($('#newPlace')) newPlace = $('#newPlace').value.trim();
  const m = newType;
  const lake = m === 'lacj' || m === 'lacc';
  if (lake && !boats.some((x) => x.id === newBoat)) newBoat = boats[0] ? boats[0].id : null;
  const list = all.filter((x) => x.mode === m);
  const count = (k) => all.filter((x) => x.mode === k).length;
  const zoneNow = () => newZone || settings.lastZone || 'M';
  const zone = zoneNow();
  const boatName = () => (lake ? (boats.find((x) => x.id === newBoat) || { info: {} }).info.boat : cruise && cruise.type !== 'lac' && $('#keepBoat') && $('#keepBoat').dataset.on ? cruise.info.boat : '') || '';
  const autoName = () => (m ? autoOutingName(m, boatName(), newPlace || '', zoneNow()) : '');
  const word = m === 'mer' ? 'croisière' : m === 'lacc' ? 'croisière sur le lac' : 'sortie';
  main.innerHTML = `
    <h1>Mes navigations</h1>
    ${cruise ? '' : '<p class="help">Bienvenue ! Choisissez le type de navigation, ou récupérez vos données d’un autre appareil.</p><div class="row" style="margin-bottom:16px"><button class="btn big" data-go-settings="1">⬆ Récupérer mes données</button></div>'}
    <div class="mode-tiles">${Object.entries(MODES).map(([k, v]) => `<button class="btn big mode-tile ${k === m ? 'on' : ''}" data-type="${k}"><span class="mode-ic">${v.icon}</span>${esc(v.name)}<small>${esc(v.sub)}${count(k) ? ` · ${count(k)}` : ''}</small></button>`).join('')}</div>
    ${!m ? '' : `
    <section class="field"><h2>${MODES[m].icon} Nouvelle ${word}</h2>
      ${lake ? `<h3 class="sub-h">Quel bateau ?</h3>
        <div class="row ${boats.length > 1 ? 'c2' : ''}">${boats.map((x) => `<button class="btn big ${x.id === newBoat ? 'on' : ''}" data-boat="${x.id}">🚤 ${esc(x.info.boat || 'Sans nom')}${boatSub(x.info) ? `<small>${esc(boatSub(x.info))}</small>` : ''}</button>`).join('')}</div>
        <div class="row"><button class="btn" data-go-boats="1">＋ Nouveau bateau / modifier mes bateaux</button></div>` : ''}
      ${m === 'lacj' ? `<h3 class="sub-h">Quel type de sortie ?</h3>
        <div class="row c3">${[['Entraînement', '🎯', 'entre membres'], ['Location', '🔑', 'tarif calculé'], ['Invitation', '🤝', 'invités à bord']].map(([p, ic, sub]) => `<button class="btn big ${p === newPurpose ? 'on' : ''}" data-purpose="${p}">${ic} ${p}<small>${sub}</small></button>`).join('')}</div>` : ''}
      ${m === 'mer' ? `<h3 class="sub-h">Plan d’eau</h3>
        <div class="row c2">${ZONES.map(([z, l]) => `<button class="btn ${z === zone ? 'on' : ''}" data-zone="${z}">${z} · ${esc(l)}</button>`).join('')}</div>` : ''}
      <h3 class="sub-h">Port de départ</h3>
      <input class="text" id="newPlace" type="text" value="${esc(newPlace || '')}" placeholder="${newPlace === null ? 'Recherche GPS…' : 'ex. Morges'}">
      <h3 class="sub-h">Nom</h3>
      <input class="text" id="newName" type="text" value="${esc(nameDirty ? typed : autoName())}" placeholder="Nom de la ${word}">
      <p class="help" style="margin-top:4px">Nom automatique : n° de la sortie dans l’année, plan d’eau, bateau, port et date. Vous pouvez le changer ici ou plus tard dans « Bateau et croisière ».</p>
      ${cruise && m === 'mer' ? `<div class="row"><button class="btn on" id="keepBoat" data-on="1">Reprendre le bateau, les numéros et réglages : OUI</button></div>` : ''}
      ${cruise ? `<div class="row"><button class="btn" id="keepCrew" data-on="">Reprendre l’équipage : NON</button></div>` : ''}
      <div class="row"><button class="btn big primary" id="createBtn">＋ Créer et ouvrir</button></div>
      <p class="help">${m === 'mer' ? 'Check-list de prise du bateau en début de location, puis de restitution. Chaque croisière a son journal, ses fiches du jour, son équipage et sa trace.' : m === 'lacj' ? 'Check-list d’arrivée à bord à chaque sortie. Les données du bateau sont reprises de « Mes bateaux ».' : 'Check-list d’arrivée à bord en début de croisière, et de fin de croisière. Une fiche par jour.'}</p>
    </section>
    ${list.length ? `<h2 class="sub-h">${MODES[m].icon} ${esc(MODES[m].name)} : mes ${m === 'lacj' ? 'sorties' : 'croisières'}</h2>` : ''}
    ${list.map(({ c, data }) => {
      const cur = cruise && cruise.id === c.id;
      return `<article class="entry ${cur ? 'current' : ''}" data-id="${c.id}">
        <div class="when"><span>${esc(c.name)}</span>${cur ? '<span>● en cours</span>' : ''}</div>
        <p class="help">${data.purpose ? `${data.purpose === 'Location' ? '🔑' : data.purpose === 'Invitation' ? '🤝' : '🎯'} ${esc(data.purpose)} · ` : ''}${data.entries.length} entrée${data.entries.length > 1 ? 's' : ''} · créée le ${fmtShortDate(new Date(c.created))}</p>
        <div class="actions">${cur ? '<button class="btn" data-act="info">Modifier</button>' : '<button class="btn primary" data-act="open">Ouvrir</button>'}
        <button class="btn danger" data-act="del">Supprimer</button></div></article>`;
    }).join('')}`}`;
  const toggle = (id, label) => {
    const b = $(id);
    if (!b) return;
    b.onclick = (e) => { e.stopPropagation(); buzz(); b.dataset.on = b.dataset.on ? '' : '1'; b.classList.toggle('on', !!b.dataset.on); b.textContent = `${label} : ${b.dataset.on ? 'OUI' : 'NON'}`; };
  };
  toggle('#keepBoat', 'Reprendre le bateau, les numéros et réglages');
  toggle('#keepCrew', 'Reprendre l’équipage');
  const refreshName = () => { if (!nameDirty && $('#newName')) $('#newName').value = autoName(); };
  if ($('#newName')) {
    $('#newName').oninput = () => { nameDirty = true; };
    $('#newPlace').oninput = () => { newPlace = $('#newPlace').value.trim(); refreshName(); };
    if ($('#keepBoat')) $('#keepBoat').addEventListener('click', () => setTimeout(refreshName));
  }
  if (m && !placeBusy && (newPlace === undefined || Date.now() - placeAt > 600000)) {
    placeBusy = true;
    if (!newPlace) newPlace = null;
    findStartPlace(m, (place, z) => {
      placeBusy = false; placeAt = Date.now();
      const typedPlace = $('#newPlace') && $('#newPlace').value.trim();
      newPlace = typedPlace || place || '';
      if (z && !newZone && m === 'mer' && z !== 'X') newZone = z;
      if (currentView !== 'cruises' || !$('#newPlace')) return;
      if (!$('#newPlace').value) $('#newPlace').value = newPlace;
      $('#newPlace').placeholder = 'ex. Morges';
      if (m === 'mer' && newZone) for (const zb of $$('[data-zone]')) zb.classList.toggle('on', zb.dataset.zone === newZone);
      refreshName();
    });
  }
  if ($('#createBtn')) $('#createBtn').onclick = (e) => {
    e.stopPropagation(); buzz();
    let name = $('#newName').value.trim();
    const boat = lake && boats.find((x) => x.id === newBoat);
    if (lake && !boat) { toast('Choisissez ou ajoutez un bateau'); return; }
    if (!name) name = autoName();
    if (!name) { toast('Donnez un nom à la croisière'); $('#newName').focus(); return; }
    if (typeof tracking !== 'undefined' && tracking) stopTracking(false);
    const keepBoat = $('#keepBoat') && $('#keepBoat').dataset.on;
    const keepCrew = $('#keepCrew') && $('#keepCrew').dataset.on;
    const c = lake ? blankOuting(name, boat, m === 'lacc' ? 'croisiere' : 'jour') : blankCruise(name, keepBoat ? cruise : null);
    if (m === 'lacj') c.purpose = newPurpose;
    if (m === 'mer') { c.zone = zoneNow(); settings.lastZone = c.zone; saveSettings(); }
    const place = $('#newPlace').value.trim();
    if (place && !c.info.ports) c.info.ports = place;
    newPlace = undefined; nameDirty = false;
    if (keepCrew && cruise) c.crew = structuredClone(cruise.crew);
    cruise = c; draft = null; currentDay = null;
    saveCruise();
    toast(`${m === 'lacj' ? 'Sortie' : 'Croisière'} « ${name} » ouverte`);
    go(lake ? 'checklist' : 'info');
  };
  main.onclick = (e) => {
    if (e.target.closest('[data-go-settings]')) { buzz(); go('settings'); setTimeout(() => { const el = $('#backup'); if (el) el.scrollIntoView(); }, 50); return; }
    if (e.target.closest('[data-go-boats]')) { buzz(); return go('boats'); }
    const tb = e.target.closest('[data-type],[data-boat],[data-purpose],[data-zone]');
    if (tb) { buzz(); if (tb.dataset.zone) newZone = tb.dataset.zone; if (tb.dataset.purpose) newPurpose = tb.dataset.purpose; if (tb.dataset.type) newType = tb.dataset.type; if (tb.dataset.boat) newBoat = tb.dataset.boat; return VIEWS.cruises(); }
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    buzz();
    const id = b.closest('.entry').dataset.id;
    if (b.dataset.act === 'open') {
      if (typeof tracking !== 'undefined' && tracking) stopTracking(false);
      openCruise(id); currentDay = null; toast('Ouverte'); if (typeof autoResumeTrip === 'function') autoResumeTrip(); go('tracker');
    }
    if (b.dataset.act === 'info') go('info');
    if (b.dataset.act === 'del') holdDel(b, () => {
      removeCruise(id);
      toast('Supprimée');
      go('cruises');
    });
  };
};

VIEWS.info = function renderInfo() {
  $('#view').innerHTML = '<h1>Bateau et croisière</h1><p class="help">Enregistrement automatique. Ces données servent aux calculs et aux messages SOS.</p><div id="infoForm"></div>';
  pullBoatIntoCruise(); // v154 : la fiche du bateau fait foi
  compactForm($('#infoForm'), infoSections(), cruise.info, (k) => { saveCruise(); syncBoatFromCruise(k); $('#voyageName').textContent = `${MODES[curMode()].icon} ${cruise.info.name || ''}`; });
};

// Équipage : fiches personnes réutilisables (lake.js), sélectionnées pour chaque navigation.
VIEWS.crew = function renderCrew() { crewFiche = null; crewFicheBack = null; if (typeof ficheFromData !== 'undefined') ficheFromData = false; return cruise ? renderCrewPick() : renderFicheList(); };

/* =====================================================================
   PDF / IMPRESSION avec choix des pages
   ===================================================================== */
function printPages() {
  const pages = [
    { id: 'title', label: 'Page de titre : croisière et bateau' },
    { id: 'tech', label: 'Fiche technique du bateau' },
    { id: 'crew', label: 'Liste d’équipage', off: !cruise.crew.length },
    { id: 'safety', label: 'Sécurité, secours et météo' },
    { id: 'radio', label: 'Messages radio (MAYDAY, PAN PAN, SÉCURITÉ…)' },
  ];
  for (const k of daysWithData()) {
    const nb = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k).length;
    pages.push({ id: 'day:' + k, label: `Journée du ${fmtShortDate(keyToDate(k))}`, sub: `${nb} entrée${nb > 1 ? 's' : ''}`, day: true });
  }
  if (isLake() && typeof prepReportHtml === 'function') pages.push({ id: 'prep', label: 'PréP et check-in (avec photos)' });
  pages.push({ id: 'blank', label: 'Page vierge à remplir à la main (secours)' });
  return pages;
}

let printSel = null;
VIEWS.print = function renderPrint() {
  const pages = printPages();
  if (typeof prepReportCache === 'function' && isLake()) prepReportCache();
  if (!printSel) printSel = new Set(pages.filter((p) => !p.off && p.id !== 'blank' && p.id !== 'tech' && p.id !== 'prep').map((p) => p.id));
  const main = $('#view');
  main.innerHTML = `
    <h1>Publier le livre de bord</h1>
    <p class="help">Cochez les pages, puis « 📤 Publier ». Dans la fenêtre qui s’ouvre, choisissez « Enregistrer en PDF » (ou une imprimante).</p>
    <p class="help lx-sec-h">Réglages de l’envoi · pages</p>
    ${pages.some((p) => p.day) ? '<div class="row" style="margin-bottom:12px"><button class="btn" data-sel="days">Journées seulement</button></div>' : ''}
    <div class="checks">${masterCheck(pages.filter((p) => printSel.has(p.id)).length, pages.length, 'data-sel-all')}${pages.map((p) => `<button class="btn check ${printSel.has(p.id) ? 'on' : ''}" data-p="${p.id}"><span class="box">${printSel.has(p.id) ? '✔' : ''}</span>${esc(p.label)}${p.sub ? ` <small>${esc(p.sub)}</small>` : ''}</button>`).join('')}</div>
    <div class="save-bar row ck-pub-row"><button class="btn big ck-pub" id="doPrint">📤 Publier<small>PDF A4 · ${printSel.size} page${printSel.size > 1 ? 's' : ''}</small></button></div>`;
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.p) { printSel.has(b.dataset.p) ? printSel.delete(b.dataset.p) : printSel.add(b.dataset.p); return VIEWS.print(); }
    if (b.dataset.selAll) { printSel = printSel.size === pages.length ? new Set() : new Set(pages.map((p) => p.id)); return VIEWS.print(); }
    if (b.dataset.sel === 'days') printSel = new Set(pages.filter((p) => p.day).map((p) => p.id));
    if (b.dataset.sel) return VIEWS.print();
    if (b.id === 'doPrint') { if (!printSel.size) return toast('Choisissez au moins une page'); printBook(printPages().filter((p) => printSel.has(p.id)).map((p) => p.id)); }
  };
};

function printBook(ids) {
  const i = cruise.info;
  const kv = (fields, data) => flatFields(fields).filter((f) => f.type !== 'group').filter((f) => !['calc', 'tides', 'signature'].includes(f.type)).map((f) => [f.label || (f.unitOnly ? 'Puissance' : ''), f.wind && knOk(data[f.key]) ? windTxt(data[f.key]) : dayVal(f, data[f.key])])
    .filter(([, v]) => v !== '').map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`).join('');
  const cols = activeFields().filter((f) => f.key !== 't');
  const parts = [];
  for (const id of ids) {
    if (id === 'title') {
      parts.push(`<section class="pg"><h1>NavIn · Journal de bord / Log book</h1><h2>${esc(i.name || '')}</h2>
        <table>${INFO_SECTIONS.filter((s) => ['Croisière', 'Données techniques', 'Radio et identification', 'Loueur, base'].includes(s.title)).map((s) => kv(s.fields.filter((f) => !TECH_FIELDS.includes(f)), i)).join('')}</table>
        ${['dep', 'quit'].filter((l) => cruise[constatKey(l)]).map((l) => `<h3>${esc(constatTitle(l))}</h3><p class="pre">${esc(cruise[constatKey(l)])}</p>`).join('')}</section>`);
    } else if (id === 'tech') {
      parts.push(`<section class="pg"><h1>Données bateau / Yacht data</h1>
        <table>${INFO_SECTIONS.filter((s) => ['Données techniques', 'Informations', 'Données moteur', 'Calculs moteur et carburant'].includes(s.title)).map((s) => kv(s.fields, i)).join('')}</table></section>`);
    } else if (id === 'crew') {
      parts.push(`<section class="pg"><h1>Liste d’équipage / Crew list</h1><table class="small"><tr><th>n°</th>${CREW_FIELDS.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr>
        ${cruise.crew.map((m, x) => `<tr><td>${x + 1}</td>${CREW_FIELDS.map((f) => `<td>${esc(m[f.key] || '')}</td>`).join('')}</tr>`).join('')}</table></section>`);
    } else if (id === 'safety') {
      parts.push(`<section class="pg"><h1>Sécurité, secours et météo</h1>
        <h3>Numéros utiles</h3><p class="pre">${esc(i.contacts || '')}</p>
        <h3>Météo</h3><p class="pre">${esc(i.meteo || '')}</p>
        <h3>Identité radio</h3><p>${esc(i.boat || '')} · Indicatif ${esc(i.callsign || '')} (${esc(spell(i.callsign))}) · MMSI ${esc(i.mmsi || '')}</p><p>${esc(radioDesc(i, 'en'))}</p>
        <h3>Canaux bateau à bateau</h3><p>6 · 8 · 72 · 77</p></section>`);
    } else if (id === 'radio') {
      parts.push(`<section class="pg"><h1>Messages radio / Radio messages</h1><div class="cols">${Object.values(SOS).map((s) => {
        const lines = s.script(sosContext(null)).filter(Boolean);
        return `<div class="blk"><h3>${s.title} · ${esc(s.sub)}</h3><ol>${s.asn.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          ${lines.map(([en, frTxt]) => `<p><b>${esc(en)}</b>${frTxt ? ` <i>${esc(frTxt)}</i>` : ''}</p>`).join('')}
          ${s.natures ? `<p>Nature : ${s.natures.map((x) => `${esc(x[0])} = <i>${esc(x[1])}</i>`).join(' · ')}</p>` : ''}</div>`;
      }).join('')}</div>
      <h3>Alphabet</h3><p>${Object.entries(NATO).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
      <h3>Vocabulaire</h3><p>${VOCAB.map(([a, b]) => `${a} = ${b}`).join(' · ')}</p></section>`);
    } else if (id.startsWith('day:') && isLake()) {
      const live = currentView === 'sheet' && $('#sheet');
      parts.push(`<section class="pg">${live ? live.outerHTML : sheetHtml(pickSheet(sheetData(id.slice(4)), id.slice(4)))}</section>`);
    } else if (id.startsWith('day:')) {
      const k = id.slice(4);
      currentDay = k;
      const d = cruise.days[k] || {};
      const ents = cruise.entries.filter((e) => dayKey(new Date(e.t)) === k);
      const tides = (d.marees || []).filter((r) => r.type || r.h);
      const navTxt = navLabel(k);
      parts.push(`<section class="pg"><h1>${esc(fmtDate(keyToDate(k)))}${d.de || d.a ? ` · de ${esc(d.de || '…')} à ${esc(d.a || '…')}` : ''}${navTxt ? ` · navigation ${esc(navTxt)}` : ''}</h1>
        <div class="cols">${activeSections(DAY_SECTIONS).filter((s) => !['Étape', 'Signatures'].includes(s.title)).map((s) => {
          const rows = kv(s.fields, d);
          const calc = s.fields.filter((f) => f.type === 'calc').map((f) => f.calc(d).replace(/<button[^>]*>[\s\S]*?<\/button>/g, '').replace(/<p class="help">[\s\S]*?<\/p>/g, '')).join('');
          const tid = s.title === 'Marées' && tides.length ? `<tr><th>Marées</th><td>${tides.map((r) => esc(`${r.type || ''} ${r.h || ''} ${r.m ? r.m + ' m' : ''}`)).join(' · ')}</td></tr>` : '';
          return rows || tid || (calc && Object.keys(d).length) ? `<div class="blk"><h3>${esc(s.title)}</h3><table>${rows}${tid}</table>${calc}</div>` : '';
        }).join('')}</div>
        ${ents.length ? `<table class="hourly"><tr><th>Heure</th>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr>
          ${ents.map((e) => `<tr><td>${fmtTime(new Date(e.t))}${e.auto ? '*' : ''}<br><small>${fmtUtc(new Date(e.t))}</small></td>${cols.map((f) => `<td>${esc(fmtValue(f, e.v[f.key]))}</td>`).join('')}</tr>`).join('')}</table>
          ${ents.some((e) => e.auto) ? '<p class="note">* entrée créée automatiquement par le suivi GPS ; vent, mer et baro marqués comme modèle météo quand ils viennent d’Open-Meteo.</p>' : ''}` : ''}
        <table class="sign"><tr><th>Navigateur</th><td>${esc(d.navigateur || '')}</td><th>Signature</th><td>${d.sigNav ? `<img src="${d.sigNav}" alt="">` : ''}</td><th>Skipper</th><td>${esc(d.skipper || '')}</td><th>Signature</th><td>${d.sigSkip ? `<img src="${d.sigSkip}" alt="">` : ''}</td></tr></table>
      </section>`);
      currentDay = null;
    } else if (id === 'prep') {
      parts.push(window._prepHtml || '<section class="pg"><h1>PréP et check-in</h1><p>Photos en cours de lecture : réessayez dans un instant.</p></section>');
    } else if (id === 'blank') {
      parts.push(`<section class="pg"><h1>Date : ____________ · de ____________ à ____________</h1>
        <table class="hourly blank"><tr><th>Heure</th>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr>
        ${Array.from({ length: 16 }, () => `<tr><td></td>${cols.map(() => '<td></td>').join('')}</tr>`).join('')}</table>
        <table class="sign"><tr><th>Navigateur</th><td></td><th>Signature</th><td></td><th>Skipper</th><td></td><th>Signature</th><td></td></tr></table></section>`);
    }
  }
  const holder = document.createElement('div');
  holder.className = 'print-only book';
  holder.innerHTML = parts.join('');
  document.body.appendChild(holder);
  const style = document.createElement('style');
  style.textContent = `@media print { main { display:none } @page { size: A4 ${isLake() ? 'portrait' : 'landscape'}; margin: 8mm } }`;
  document.head.appendChild(style);
  const oldTitle = document.title;
  document.title = fileName('', 'pdf').replace(/\.pdf$/, '');
  const cleanup = () => { holder.remove(); style.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 50);
}

/* ---------- Fichiers : tableurs, sauvegarde, GPX ---------- */
const cell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
function csvEntries() {
  const cols = ['Date', 'Heure', 'Heure UTC', 'Auto', ...activeFields().filter((f) => f.key !== 't').map((f) => (f.unit ? `${f.label} (${f.unit})` : f.label))];
  const lines = [cols.map(cell).join(';')];
  for (const e of cruise.entries) {
    const d = new Date(e.t);
    lines.push([fmtShortDate(d), fmtTime(d), fmtUtc(d).replace(' UTC', ''), e.auto ? 'oui' : '', ...activeFields().filter((f) => f.key !== 't').map((f) => {
      const v = e.v[f.key];
      return f.type === 'number' ? (v == null ? '' : fmtNum(f, v)) : fmtValue(f, v);
    })].map(cell).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}
const dayFieldsFlat = () => daySections().flatMap((s) => s.fields).filter((f) => !['calc', 'tides', 'signature'].includes(f.type));
function dayVal(f, v) { const t = Array.isArray(v) ? v.join(', ') : v ?? ''; return f && f.prefix && t !== '' ? f.prefix + ' ' + t : t; } // signe « ≥ » devant la sonde min. partout (Corban, v163)
function csvDays() {
  const fs = dayFieldsFlat();
  const lines = [['Date', 'Navigation', ...fs.map((f) => (f.unit ? `${f.label || f.key} (${f.unit})` : f.label || 'Contrôles')), 'Marées'].map(cell).join(';')];
  for (const k of daysWithData()) {
    const d = cruise.days[k] || {};
    const tides = (d.marees || []).filter((r) => r.type || r.h).map((r) => `${r.type || ''} ${r.h || ''} ${r.m ? r.m + ' m' : ''}`.trim()).join(' / ');
    lines.push([fmtShortDate(keyToDate(k)), navLabel(k), ...fs.map((f) => dayVal(f, d[f.key])), tides].map(cell).join(';'));
  }
  return '﻿' + lines.join('\r\n');
}
function fileName(suffix, ext) {
  const base = (cruise.info.name || 'navin').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const d = new Date();
  return `${base}${suffix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.${ext}`;
}
// Dans l'aperçu claude.ai (page dans un cadre), le téléchargement passe par l'enregistrement de fichiers de Claude (v129).
let claudeDl = null;
async function claudeDownloads() {
  if (claudeDl !== null) return claudeDl;
  claudeDl = false;
  try { if (window.claude && window.claude.use && document.documentElement.classList.contains('in-frame')) claudeDl = (await window.claude.use('downloads')) || false; } catch (e) { claudeDl = false; }
  return claudeDl;
}
async function deliver(content, name, type) {
  const blob = new Blob([content], { type });
  const cdl = await claudeDownloads();
  if (cdl) { try { await cdl.save({ filename: name, data: blob }); toast('Fichier enregistré · gardez-le dans Fichiers'); return; } catch (e) { if (e && e.code === 'declined') return; } }
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

VIEWS.export = function renderExport() {
  const track = loadTrack();
  $('#view').innerHTML = `
    <h1>Échanges de fichiers</h1>
    <p class="help">Les données restent sur ce téléphone. Faites une sauvegarde régulièrement et avant de changer de téléphone.</p>
    ${isLake() ? '<p class="help">Sortie lacustre : la trace vient uniquement du GPS du téléphone (onglet Saisir › Départ).</p>' : `<h2 class="sub-h">Importer une trace (Navionics, Navimetrix…)</h2>
    <p class="help">Exportez la trace en GPX depuis votre appli de navigation, puis choisissez le fichier ici. Le livre crée les entrées de départ, d’arrivée, des changements de cap et une par heure, puis ajoute vent, mer et baro du modèle météo s’il y a du réseau.</p>
    <div class="row"><button class="btn big primary" id="gpxBtn">🛰 Importer une trace GPX</button></div>
    <input type="file" id="gpxFile" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden>`}
    <h2 class="sub-h">Exporter</h2>
    <div class="row">
      <button class="btn big" id="csvBtn">Tableur des entrées (CSV)</button>
      <button class="btn big" id="csvDayBtn">Tableur des journées (CSV)</button>
      <button class="btn big" id="gpxOut" ${track.length ? '' : 'disabled'}>Trace GPS enregistrée (GPX)<small>${track.length} points</small></button>
    </div>
    <h2 class="sub-h">Sauvegarde</h2>
    <div class="row">
      <button class="btn big" id="jsonBtn">Sauvegarder la croisière</button>
      <button class="btn big" id="importBtn">Restaurer une sauvegarde</button>
    </div>
    <input type="file" id="importFile" accept=".json,application/json" hidden>`;
  $('#csvBtn').onclick = () => { buzz(); if (!cruise.entries.length) return toast('Journal vide'); deliver(csvEntries(), fileName('-entrees', 'csv'), 'text/csv'); };
  $('#csvDayBtn').onclick = () => { buzz(); if (!daysWithData().length) return toast('Aucune journée'); deliver(csvDays(), fileName('-journees', 'csv'), 'text/csv'); };
  $('#gpxOut').onclick = () => { buzz(); deliver(trackToGpx(loadTrack()), fileName('-trace', 'gpx'), 'application/gpx+xml'); };
  if ($('#gpxBtn')) $('#gpxBtn').onclick = () => $('#gpxFile').click();
  if ($('#gpxFile')) $('#gpxFile').onchange = async (e) => { const f = e.target.files[0]; if (f) importGpxFile(f); e.target.value = ''; };
  $('#jsonBtn').onclick = () => { buzz(); deliver(JSON.stringify({ app: 'livre-de-bord', version: 2, cruise, track: loadTrack() }, null, 1), fileName('-sauvegarde', 'json'), 'application/json'); };
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreFile(f); };
};

/* ---------- Sauvegarde et restauration ----------
   Une croisière restaurée qui existe déjà ici est complétée, jamais écrasée. */
// Fusion d'une croisière reçue (sauvegarde ou autre appareil) : les entrées des deux côtés sont gardées,
// les suppressions suivent, et pour le reste c'est la version modifiée le plus récemment qui gagne.
function mergeCruise(c, track) {
  c.info = c.info || {}; c.crew = c.crew || []; c.days = c.days || {};
  let target;
  if (index.some((x) => x.id === c.id)) {
    const cur = store.get('ldb.cruise.' + c.id);
    const newer = (c.updated || '') > (cur.updated || '');
    const del = new Set([...(cur.deleted || []), ...(c.deleted || [])]);
    const byId = new Map(cur.entries.map((x) => [x.id, x]));
    for (const x of c.entries) if (!byId.has(x.id) || newer) byId.set(x.id, x);
    cur.entries = [...byId.values()].filter((x) => !del.has(x.id)).sort((x, y) => x.t.localeCompare(y.t));
    cur.deleted = [...del];
    for (const k of Object.keys(c.days)) cur.days[k] = newer ? Object.assign({}, cur.days[k], c.days[k]) : Object.assign({}, c.days[k], cur.days[k]);
    cur.info = newer ? Object.assign({}, cur.info, c.info) : Object.assign({}, c.info, cur.info);
    if (newer ? c.crew.length : !cur.crew.length) cur.crew = c.crew;
    const ph = new Map((cur.photos || []).map((x) => [x.id, x]));
    for (const x of c.photos || []) if (!ph.has(x.id)) ph.set(x.id, x);
    if (ph.size) cur.photos = [...ph.values()];
    for (const k of Object.keys(c)) if (!['entries', 'days', 'info', 'crew', 'deleted', 'photos', 'id', 'updated'].includes(k) && (newer || cur[k] == null)) cur[k] = c[k];
    if (newer) cur.updated = c.updated;
    target = cur;
  } else target = c;
  const prev = cruise;
  cruise = target;
  saveCruise(true);
  if (Array.isArray(track) && track.length) {
    const tr = loadTrack();
    const seen = new Set(tr.map((x) => x[0]));
    saveTrack(tr.concat(track.filter((x) => !seen.has(x[0]))).sort((x, y) => x[0] - y[0]));
  }
  cruise = prev;
  return target;
}
function backupAll() {
  const cruises = index.map((m) => ({ cruise: store.get('ldb.cruise.' + m.id), track: store.get('ldb.track.' + m.id, []) })).filter((x) => x.cruise);
  const d = new Date();
  return { name: `navin-tout-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`,
    data: { app: 'livre-de-bord', version: 4, all: true, saved: d.toISOString(), current: cruise && cruise.id, settings, boats, members, cruises, ckLib, taskTpl, uiEdits: typeof uiEdits === 'object' ? uiEdits : {}, marks: typeof marks !== 'undefined' ? marks : [], crewSets: typeof crewSets !== 'undefined' ? crewSets : [], mob: mobProc, mobMer: mobProcMer, sosLogs: typeof sosLogs !== 'undefined' ? sosLogs : [], sosPwd: store.get('ldb.sosPwd', ''), errLog: store.get('ldb.errLog', []), mobAt: store.get('ldb.mob.at', ''),
      boatsAt: store.get('ldb.boats.at', ''), membersAt: store.get('ldb.members.at', '') },
    get json() { return JSON.stringify(this.data); } };
}
// Fichier de synchro : tout, photos comprises si on le souhaite.
async function syncPack(withPhotos) {
  const b = backupAll();
  if (withPhotos && typeof getPhoto === 'function') {
    b.data.photos = [];
    for (const x of b.data.cruises) for (const p of x.cruise.photos || []) { const url = await getPhoto(p.id); if (url) b.data.photos.push({ id: p.id, url }); }
  }
  // Les photos des documents des bateaux (recueil) voyagent toujours.
  if (typeof boatDocPhotos === 'function') b.data.photos = (b.data.photos || []).concat(await boatDocPhotos());
  const d = new Date();
  b.name = `navin-synchro-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  return b;
}
async function restoreFile(file) {
  try {
    const data = JSON.parse(await file.text());
    const list = data.all ? data.cruises : [{ cruise: data.cruise, track: data.track }];
    const ok = (list || []).filter((x) => x && x.cruise && x.cruise.id && Array.isArray(x.cruise.entries));
    // Une sauvegarde complète sans navigation (fiches bateaux, équipage, check-lists seulement) est valable (v129).
    if (!ok.length && !(data.all && (Array.isArray(data.boats) || Array.isArray(data.members)))) throw new Error();
    if (typeof tracking !== 'undefined' && tracking) stopTracking(false);
    // Copie des fiches avant la fusion (nettoyage 2026-11-04) : rien n'est jamais remplacé sans trace.
    try { localStorage.setItem('ldb.preRestore', JSON.stringify({ t: new Date().toISOString(), boats: typeof boats !== 'undefined' ? boats : [], members: typeof members !== 'undefined' ? members : [], crewSets: typeof crewSets !== 'undefined' ? crewSets : [] })); } catch (e) {}
    const curId = cruise && cruise.id;
    let last = null;
    for (const x of ok) last = mergeCruise(x.cruise, x.track);
    if (Array.isArray(data.boats)) mergeBoats(data.boats, data.boatsAt);
    if (Array.isArray(data.members)) mergeMembers(data.members, data.membersAt);
    if (Array.isArray(data.ckLib) && typeof mergeCkLib === 'function') mergeCkLib(data.ckLib);
    if (data.uiEdits && typeof mergeUiEdits === 'function') mergeUiEdits(data.uiEdits);
    if (data.marks && typeof mergeMarks === 'function') mergeMarks(data.marks);
    if (Array.isArray(data.sosLogs) && typeof sosLogs !== 'undefined') { for (const x of data.sosLogs) if (x && x.id && !sosLogs.some((y) => y.id === x.id)) sosLogs.push(x); store.set('ldb.sosLogs', sosLogs); if (data.sosPwd && !store.get('ldb.sosPwd', '')) store.set('ldb.sosPwd', data.sosPwd); }
    if (Array.isArray(data.crewSets) && typeof crewSets !== 'undefined') { for (const x of data.crewSets) if (x && x.id && !crewSets.some((y) => y.id === x.id)) { if (x._sig === undefined && typeof crewSig === 'function') x._sig = crewSig(x); crewSets.push(x); } saveCrewSets(); }
    if (data.mob && Array.isArray(data.mob.real) && data.mob.real[0] && data.mob.real[0].steps && (data.mobAt || '') > store.get('ldb.mob.at', '')) { mobProc = data.mob; store.set('ldb.mob2', mobProc); if (data.mobMer && Array.isArray(data.mobMer.real)) { mobProcMer = data.mobMer; store.set('ldb.mob2mer', mobProcMer); } store.set('ldb.mob.at', data.mobAt); }
    if (data.taskTpl && data.taskTpl.tasks && (data.taskTpl.at || '') > (taskTpl.at || '')) { taskTpl = data.taskTpl; store.set('ldb.taskTpl', taskTpl); }
    if (Array.isArray(data.photos) && typeof putPhoto === 'function') for (const p of data.photos) if (p && p.id && p.url && !(await getPhoto(p.id))) await putPhoto(p.id, p.url);
    if (data.all && data.settings && !index.length) Object.assign(settings, data.settings);
    saveSettings();
    const pick = curId && index.some((m) => m.id === curId) ? curId : (data.current && index.some((m) => m.id === data.current) ? data.current : last && last.id);
    if (pick) { openCruise(pick); draft = store.get('ldb.draft.' + cruise.id, null); }
    applyTheme(); applyIcon();
    if (!ok.length) { toast('🔄 Fiches récupérées : bateaux, équipage, check-lists'); return go('more'); }
    toast(data.version >= 4 ? `🔄 Synchronisé : ${ok.length} navigation${ok.length > 1 ? 's' : ''}` : ok.length > 1 ? `${ok.length} croisières récupérées` : `Croisière « ${last.info.name || ''} » récupérée`);
    go('cruises');
  } catch { toast('Fichier de sauvegarde invalide'); }
}
// L'appli est-elle entièrement dans le téléphone ? (service worker actif et fichiers en cache)
async function offlineState() {
  try {
    const ready = 'serviceWorker' in navigator && navigator.serviceWorker.controller && (await caches.match('lake.js')) && (await caches.match('vendor/leaflet/leaflet.js'));
    const kept = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const tiles = (await caches.keys()).includes('livre-de-bord-tuiles') ? (await (await caches.open('livre-de-bord-tuiles')).keys()).length : 0;
    return ready
      ? `✅ <b>Prête hors ligne</b> : l’appli fonctionne sans Internet, en mode avion. Les données restent dans cet appareil${kept ? ' (stockage protégé)' : ''}.${tiles ? ` Carte : ${tiles} morceaux de carte déjà vus sont gardés.` : ''}<br>Internet ne sert qu’à la météo du modèle, aux fonds de carte pas encore vus et aux mises à jour de l’appli.`
      : '⚠️ Pas encore prête hors ligne : ouvrez l’appli une fois avec du réseau, depuis son icône sur l’écran d’accueil, puis rouvrez-la.';
  } catch { return '⚠️ Vérification impossible sur ce navigateur.'; }
}
function backupHtml() {
  return `<section class="field" id="sync"><h2>🔄 Synchroniser téléphone et tablette</h2>
    <p class="help">Sans Internet : les deux appareils échangent un fichier par <b>AirDrop</b> (Wi-Fi et Bluetooth, de proche en proche). Chaque côté garde toutes les entrées des deux, et pour le reste c’est la modification la plus récente qui gagne.</p>
    <ol class="help sync-steps"><li>Sur l’appareil A : <b>Envoyer</b>, puis AirDrop vers l’appareil B.</li><li>Sur B : touchez la notification AirDrop, puis « Enregistrer dans Fichiers ».</li><li>Sur B, dans l’appli : <b>Recevoir</b> et choisissez le fichier. B est à jour.</li><li>Pour que A soit aussi à jour : refaites la même chose de B vers A.</li></ol>
    <div class="row set-stack"><button class="btn big ${settings.syncPhotos !== false ? 'on' : ''}" id="syncPhotos"><span class="sp-t">📷 Avec les photos : ${settings.syncPhotos !== false ? 'OUI' : 'NON'}</span><small>toucher pour changer</small></button>
    <button class="btn big primary" id="syncOut">📤 Envoyer<small>vers l’autre appareil</small></button><button class="btn big" id="syncIn">📥 Recevoir<small>fichier de l’autre appareil</small></button></div>
  </section>
  <section class="field" id="backup"><h2>Toutes mes données</h2>
    <p class="help">Pour changer de téléphone ou garder une copie : « Exporter » crée un fichier avec toutes les croisières (journal, journées, équipage, signatures, traces) et les réglages. Envoyez-le vous par mail ou enregistrez-le dans Fichiers / Drive.</p>
    <div class="row"><button class="btn big primary" id="allOut">⬇ Exporter toutes les données</button></div>
    <p class="help">Sur le nouvel appareil, installez l’appli, ouvrez la roue dentée ⚙︎ et choisissez ce fichier. Les navigations déjà présentes sont fusionnées avec celles du fichier.</p>
    <div class="row"><button class="btn big" id="allIn">⬆ Récupérer des données</button></div>
    <input type="file" id="allFile" accept=".json,application/json" hidden>
  </section>`;
}
function bindBackup(root) {
  $('#allOut', root).onclick = async (e) => { e.stopPropagation(); buzz(); const b = await syncPack(false); b.name = b.name.replace('synchro', 'tout'); deliver(b.json, b.name, 'application/json'); };
  $('#syncOut', root).onclick = async (e) => { e.stopPropagation(); buzz(); const t = e.currentTarget; t.disabled = true; try { const b = await syncPack(settings.syncPhotos !== false); await deliver(b.json, b.name, 'application/json'); } finally { t.disabled = false; } };
  $('#syncIn', root).onclick = (e) => { e.stopPropagation(); $('#allFile', root).click(); };
  $('#syncPhotos', root).onclick = (e) => { e.stopPropagation(); buzz(); settings.syncPhotos = settings.syncPhotos === false; saveSettings(); const t = e.currentTarget; t.classList.toggle('on', settings.syncPhotos); $('.sp-t', t).textContent = `📷 Avec les photos : ${settings.syncPhotos ? 'OUI' : 'NON'}`; };
  $('#allIn', root).onclick = (e) => { e.stopPropagation(); $('#allFile', root).click(); };
  $('#allFile', root).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) restoreFile(f); };
}

/* ---------- Installation sur le téléphone ---------- */
// Adresse du site : celle où l'appli est servie (Infomaniak ou Netlify), v99.
const APP_URL = /^https?:$/.test(location.protocol) && !document.documentElement.classList.contains('in-frame') ? location.origin + location.pathname.replace(/[^/]*$/, '') : 'https://livredebord.netlify.app';
const APP_HOST = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
let installPrompt = null; // Android / Chrome : installation directe
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (currentView === 'settings') VIEWS.settings(); });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const platform = () => (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'other');
let guideTab = null;

// Icône de l'appli : choisie avant « Sur l'écran d'accueil » (iPhone) ou « Installer » (Android).
// v433 (Corban) : variantes NavIn à essayer ; une fois l'une choisie par défaut, cette rubrique disparaîtra.
const ICONS = [['navin5', 'NavIn lac et mer'], ['navin6', 'NavIn lac | mer'], ['navin1', 'NavIn marine'], ['navin2', 'NavIn clair'], ['navin3', 'NavIn Léman'], ['navin4', 'NavIn voile'], ['compas', 'Compas'], ['voilier', 'Voilier'], ['ancre', 'Ancre'], ['barre', 'Barre'], ['livre', 'Livre'], ['nuit', 'Nuit']];
function applyIcon() {
  const id = 'navin1'; // v435 (Corban) : icône « NavIn marine » par défaut pour tous ; le choix d'icône est retiré des réglages.
  // L'icône choisie est mise dans la page elle-même (data:), gardée pour les prochaines ouvertures.
  const kept = store.get('ldb.iconData', null);
  const setTouch = (url) => {
    const old = $('link[rel="apple-touch-icon"]');
    const ln = document.createElement('link');
    ln.rel = 'apple-touch-icon'; ln.href = url;
    old.replaceWith(ln);
  };
  if (kept && kept.id === id) setTouch(kept.url);
  else fetch(`icons/${id}-180.png`).then((r) => r.blob()).then((b) => new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(b); }))
    .then((url) => { store.set('ldb.iconData', { id, url }); setTouch(url); }).catch(() => setTouch(`icons/${id}-180.png`));
  $('link[rel="icon"]').href = `icons/${id}.svg`;
  $('link[rel="manifest"]').href = `icons/manifest-${id}.webmanifest`;
}
function iconPickerHtml() {
  return `<section class="field" id="iconPicker"><h2>Icône de l’appli</h2>
    <p class="help">Choisissez l’icône <b>avant</b> d’ajouter l’appli à l’écran d’accueil.</p>
    <div class="row c3">${ICONS.map(([k, l]) => `<button class="btn icon-choice ${settings.icon === k ? 'on' : ''}" data-icon="${k}"><img src="icons/${k}-180.png" alt=""><small>${l}</small></button>`).join('')}</div>
    ${isStandalone() ? '<p class="help">L’appli est déjà installée : pour changer son icône, faites d’abord une sauvegarde (Plus › Échanges de fichiers), supprimez l’icône de l’écran d’accueil, ajoutez l’appli à nouveau depuis le navigateur, puis restaurez la sauvegarde. Sur iPhone, supprimer l’icône efface les données de l’appli.</p>' : ''}
  </section>`;
}

function installGuideHtml() {
  const tab = guideTab || (platform() === 'android' ? 'android' : 'ios');
  const ios = [
    `Ouvrez <b>Safari</b> (l’installation se fait depuis Safari) et allez sur <b>${APP_HOST}</b>.`,
    'Touchez le bouton <b>Partager</b> <span class="kbd">⬆︎</span> (carré avec une flèche vers le haut), en bas de l’écran (en haut sur iPad).',
    'Faites défiler la liste vers le bas et touchez <b>« Sur l’écran d’accueil »</b>. Si vous ne la voyez pas, touchez « Plus » ou « Modifier les actions ». Ne touchez pas « Options » (Automatique, PDF, Archive web) : ces réglages servent à envoyer la page, pas à l’installer.',
    'Vérifiez que l’aperçu montre bien l’icône NavIn (fond bleu marine), laissez « Ouvrir comme app web » activé, puis touchez <b>« Ajouter »</b> en haut à droite.',
    `Si l’aperçu montre encore un simple « L » : l’iPhone garde en mémoire une ancienne icône ratée. Allez dans Réglages › Apps › Safari › Avancé › Données des sites web, cherchez le nom du site, supprimez ${APP_HOST}, puis rouvrez le site dans Safari et recommencez à l’étape 2. Vérifiez aussi que Safari n’est pas en navigation privée.`,
    'Ouvrez désormais l’appli par sa <b>nouvelle icône</b> sur l’écran d’accueil, et non par Safari : sur iPhone, les données de l’appli installée sont séparées de celles de Safari.',
    'Au premier point GPS, touchez <b>« Autoriser lorsque l’app est active »</b>.',
  ];
  const android = [
    `Ouvrez <b>Chrome</b> et allez sur <b>${APP_HOST}</b>.`,
    'Touchez le menu <span class="kbd">⋮</span> en haut à droite.',
    'Touchez <b>« Installer l’application »</b> (ou « Ajouter à l’écran d’accueil » puis « Installer »).',
    'Confirmez avec <b>« Installer »</b> : l’icône « NavIn » apparaît sur l’écran d’accueil et dans la liste des applis.',
    'Ouvrez l’appli par son icône.',
    'Au premier point GPS, touchez <b>« Lorsque vous utilisez l’application »</b> pour autoriser la localisation.',
  ];
  const steps = tab === 'ios' ? ios : android;
  return `<section class="field" id="installGuide"><h2>Installer l’appli sur un téléphone</h2>
    ${isStandalone() ? '<p class="ok-line">✔ L’appli est installée sur ce téléphone.</p>' : ''}
    ${installPrompt && !isStandalone() ? '<div class="row"><button class="btn big primary" id="installNow">⬇ Installer maintenant sur ce téléphone</button></div>' : ''}
    <div class="row c2"><button class="btn ${tab === 'ios' ? 'on' : ''}" data-guide="ios">iPhone / iPad</button><button class="btn ${tab === 'android' ? 'on' : ''}" data-guide="android">Android</button></div>
    <ol class="steps">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
    <p class="help"><b>Avant de partir :</b> ouvrez l’appli une fois avec du réseau. Elle fonctionne ensuite en mer sans connexion. Les mises à jour arrivent seules quand on l’ouvre avec du réseau, et les données saisies sont conservées.</p>
    <div class="row c2"><button class="btn" id="shareLink">Envoyer le lien</button><button class="btn" id="copyLink">Copier le lien</button></div>
    <p class="help" style="text-align:center">${APP_URL.replace('https://', '')}</p>
  </section>`;
}
function bindInstallGuide(root) {
  $$('[data-guide]', root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); buzz(); guideTab = b.dataset.guide; VIEWS.settings(); $('#installGuide').scrollIntoView(); }));
  const inst = $('#installNow', root);
  if (inst) inst.onclick = async (e) => { e.stopPropagation(); buzz(); installPrompt.prompt(); await installPrompt.userChoice.catch(() => {}); installPrompt = null; VIEWS.settings(); };
  $('#shareLink', root).onclick = async (e) => {
    e.stopPropagation(); buzz();
    const data = { title: 'NavIn', text: 'NavIn, le livre de bord du bateau, à installer sur ton téléphone :', url: APP_URL };
    if (navigator.share) { try { await navigator.share(data); } catch {} } else location.href = `mailto:?subject=NavIn&body=${encodeURIComponent(data.text + ' ' + APP_URL)}`;
  };
  $('#copyLink', root).onclick = async (e) => {
    e.stopPropagation(); buzz();
    try { await navigator.clipboard.writeText(APP_URL); toast('Lien copié'); } catch { toast(APP_URL); }
  };
}

/* ---------- Réglages selon l'onglet (Corban, 2026-10-31, v78) ---------- */
const VIEW_LABELS = { cartes: 'Mes cartes', prep: 'PréP', dock: 'Accostage', traces: 'Mes traces', tracker: 'NavIn', new: 'Saisir', day: 'Journée', log: 'Journal', map: 'Carte', sos: 'Sécurité', vhf: 'VHF', mob: 'Homme à la mer', soslogs: 'SOS · logs', more: 'data', zones: 'Zones hors ligne', marks: 'Mes marques', checklist: 'Check-lists', crew: 'Équipage', info: 'Bateau et croisière', sheet: 'Fiche du jour', cruises: 'Mes navigations', boats: 'Mes bateaux', people: 'Les coéquipiers·ères', crews: 'Équipages', alpha: 'Alphabet', rules: 'Règles du Léman', docs: 'Documents' };
function settingsContext(v, opt, fl = {}) {
  const yes = (on) => (on ? 'OUI' : 'NON');
  const wake = fl.noWake ? '' : `<div class="row"><button class="btn ${settings.wake ? 'on' : ''}" id="wakeBtn">${settings.wake ? 'Désactiver' : 'Activer'} l’écran allumé en continu${!settings.wake && typeof tracking !== 'undefined' && tracking ? ' (allumé tant que la trace s’enregistre)' : ''}</button></div>`;
  const night = !(fl.forceNight || nightOK()) ? '' : `<div class="row c2"><button class="btn ${settings.theme === 'day' ? 'on' : ''}" data-theme="day">☀︎ Jour</button><button class="btn ${settings.theme === 'night' ? 'on' : ''}" data-theme="night">☾ Nuit</button></div>`;
  const auto = `<p class="help">Journal automatique : entrées entre le départ et l’arrivée</p>
      <div class="row c3">${[[0.5, 'Peu', '≈ 1 / 2 h'], [1, 'Normal', '≈ 1 / h'], [2, 'Détaillé', '≈ 2 / h']].map(([x, l, sub]) => `<button class="btn ${settings.autoPerHour === x ? 'on' : ''}" data-s="autoPerHour" data-v="${x}">${l}<small>${sub}</small></button>`).join('')}</div>
      <p class="help">Changement de cap noté au-delà de…</p><div class="row c4">${opt('autoTurn', [20, 30, 45, 60], '°')}</div>`;
  const wx = `<div class="row"><button class="btn ${settings.autoWeather ? 'on' : ''}" id="wxBtn">Météo du modèle ajoutée avec du réseau : ${yes(settings.autoWeather)}</button></div>`;
  const prefill = `<div class="row"><button class="btn ${settings.prefill ? 'on' : ''}" id="prefillBtn">Reprendre la dernière entrée : ${yes(settings.prefill)}</button></div>`;
  // 2026-11-04 (Corban) : les alertes de vent restent toujours visibles dans ⚠️ Alertes (avant : seulement en sortie lacustre ouverte).
  const alerts = !fl.noAlerts && typeof windAlertHtml === 'function' ? `<h3>Alertes de vent</h3>${windAlertHtml(true)}` : '';
  const gotoArr = `<p class="help">Go to : signal d’arrivée à moins de…</p><div class="row c4">${opt('gotoArrive', [30, 50, 100, 200], ' m')}</div>`;
  const links = (l) => `<div class="row c2">${l.map(([g, t]) => `<button class="btn" data-go="${g}">${t}</button>`).join('')}</div>`;
  const sec = (title, html) => ({ title, html: `<section class="field ctx-set"><h2>${title}</h2>${html}</section>` });
  // v209 (Corban) : rayon de chargement des cartes autour de moi, 50 km par défaut.
  const mapRad = `<p class="help">Cartes : rayon chargé autour de moi</p><div class="row c4">${opt('mapRadius', [20, 50, 100, 150], ' km')}</div>`;
  if (v === 'cartes') return sec('Mes cartes', `${mapRad}${wake}`);
  if (['tracker', 'map', 'zones', 'marks'].includes(v)) return sec('Traceur et cartes', `${wake}${auto}${gotoArr}${alerts}${typeof depthSetHtml === 'function' ? depthSetHtml() : ''}${typeof lakesNote === 'function' ? `<p class="help">🗺 Cartes intégrées : ${esc(lakesNote())}</p>` : ''}${links([['zones', '🗺 Zones hors ligne'], ['marks', '📌 Mes marques']])}`);
  if (v === 'new') return sec('Saisie', `${prefill}${wx}${wake}`);
  if (v === 'day' || v === 'sheet') return sec('Journée', `${wx}${alerts}${wake}`);
  if (v === 'log') return sec('Journal', `${auto}${wx}`);
  if (['sos', 'vhf', 'mob', 'alpha'].includes(v)) return sec('Sécurité', `${alerts}${wake}${night}`);
  const fmtM = (k) => String(marginVal(k)).replace('.', ',');
  const margins = `<p class="help">Règles des calculs automatiques dans les données des bateaux (une valeur saisie à la main dans la fiche reste prioritaire, en rouge).</p>
      <div class="set-rows"><div class="cf"><label for="setPP">Pied de pilote <span class="u">(m)</span></label><input class="text" id="setPP" data-margin="piedPilote" type="text" inputmode="decimal" value="${fmtM('piedPilote')}"></div>
      <div class="cf"><label for="setMH">Marge de hauteur <span class="u">(m)</span></label><input class="text" id="setMH" data-margin="margeHaut" type="text" inputmode="decimal" value="${fmtM('margeHaut')}"></div>
      <div class="cf"><label for="setCP">Longueur de coque : réduction <span class="u">(%)</span></label><input class="text" id="setCP" data-margin="coquePct" type="text" inputmode="decimal" value="${fmtM('coquePct')}"></div></div>
      ${[['arrProf', 'Arrondi de la sonde min. selon traceur'], ['arrHaut', 'Arrondi de la hauteur de passage min.']].map(([k, l]) => `<p class="help">${l} : vers le haut, en mètres</p><div class="row c4">${[[0, 'exact'], [0.1, '0,1'], [0.5, '0,5'], [1, '1']].map(([x, t]) => `<button class="btn ${roundStep(k) === x ? 'on' : ''}" data-s="${k}" data-v="${x}">${t}</button>`).join('')}</div>`).join('')}`;
  // v343 : morceaux réutilisés par la page Réglages réorganisée
  if (fl.parts) return { wake, auto, wx, prefill, alerts, gotoArr, mapRad, margins, depth: typeof depthSetHtml === 'function' ? depthSetHtml() : '', lakes: typeof lakesNote === 'function' ? `<p class="help">🗺 Cartes intégrées : ${esc(lakesNote())}</p>` : '', links: links([['zones', '🗺 Zones hors ligne'], ['marks', '📌 Mes marques']]) };
  if (['more', 'boats', 'dossier', 'info'].includes(v)) return sec('Calculs automatiques des bateaux', `${margins}${wake}`);
  return sec('Affichage', `${night}${wake}`);
}
VIEWS.nonav = function renderNoNav(want) {
  const main = $('#view');
  const what = { new: 'La saisie d’une entrée', day: 'La fiche de la journée', log: 'Le journal' }[want] || 'Cette page';
  main.innerHTML = `
    <h1>${esc(VIEW_LABELS[want] || 'Navigation')}</h1>
    <p class="help">${what} appartient à une navigation. Aucune n’est ouverte pour l’instant : démarrez-en une ou rouvrez-en une.</p>
    ${navZone() === 'lac' ? `<div class="row c2">
      <button class="btn big" data-newnav="lacj">${MODES.lacj.icon} Journée de nav<small>lac</small></button>
      <button class="btn big" data-newnav="lacc">${MODES.lacc.icon} Croisière<small>lac, plusieurs jours</small></button>
    </div>` : `<div class="row">
      <button class="btn big" data-newnav="mer">${MODES.mer.icon} Croisière<small>mer</small></button>
    </div>`}
    <div class="row"><button class="btn" data-go="cruises">⛵ Mes navigations<small>${index.length} enregistrée${index.length > 1 ? 's' : ''}</small></button></div>`;
  main.onclick = (e) => {
    const n = e.target.closest('[data-newnav]');
    if (n) { buzz(); newType = n.dataset.newnav; nameDirty = false; return go('cruises'); }
    const g = e.target.closest('[data-go]'); if (g) { buzz(); go(g.dataset.go); }
  };
};
VIEWS.settings = function renderSettings() {
  const main = $('#view');
  const opt = (key, vals, unit) => vals.map((v) => `<button class="btn ${settings[key] === v ? 'on' : ''}" data-s="${key}" data-v="${v}">${v}${unit}</button>`).join('');
  const from = settingsFrom && settingsFrom !== 'settings' ? settingsFrom : null;
  // Appui court sur la roue : réglages de l'onglet ouvert seulement. Appui long : tous les réglages, par section (Corban, v176).
  // v343 (Corban) : réglages réorganisés dans un ordre logique, même présentation partout (bandeaux dépliables pleine largeur) ;
  // v419 : toutes les rubriques fermées à l'arrivée (Corban).
  const P = settingsContext('__parts', opt, { parts: true });
  const S = (k, t, inner) => inner.trim() ? `<details class="set-sec" data-sec="${k}"><summary>${t}</summary><div class="set-body">${inner}</div></details>` : '';
  const sections = [
    S('zone', '🧭 Zone et écran', `${typeof zoneSimHtml === 'function' ? zoneSimHtml() : ''}${P.wake}<div class="row"><button class="btn ${settings.noHelpI ? '' : 'on'}" id="popBtn">${settings.noHelpI ? 'Activer' : 'Désactiver'} l’affichage des bulles d’aide (i)<small>pastilles « i » qui expliquent chaque écran</small></button></div>`),
    S('trace', '🛰 Traceur et journal', `${P.auto}${P.gotoArr}${P.prefill}${P.wx}`),
    S('alert', '⚠️ Alertes', `${P.alerts}${P.depth}`),
    // 2026-11-04 (Corban) : une section rassemble tous les essais ; les réglages restent dans leur section.
    S('simu', '🆘 Simulation SOS', `<h3>🆘 Simulation complète du bouton SOS</h3><p class="keep-help nav-hint">Un exercice comme un vrai SOS pour se familiariser avec toutes ses fonctions : log, position figée, position qui bouge, Go To, numéros selon la zone, homme à la mer, fin de procédure. Aucun appel ni SMS ne part ; le log est marqué « 🧪 Exercice ».</p><div class="row set-stack"><button type="button" class="btn big" data-sosex="ch">🆘 Exercice : large de Lausanne<small>Léman, eaux suisses</small></button><button type="button" class="btn big" data-sosex="fr">🆘 Exercice : vers Meillerie<small>Léman, eaux françaises</small></button><button type="button" class="btn big" data-sosex="mer">🆘 Exercice : large de Toulon<small>en mer</small></button></div><h3>🆘 Simulation de la position SOS</h3><p class="keep-help nav-hint">Ouvre la page SOS avec une position simulée qui se déplace, sans procédure SOS ni log. Elle s'arrête en quittant la page.</p><div class="row set-stack"><button type="button" class="btn big" data-sossim="ch">🧪 Simuler : large de Lausanne<small>eaux suisses</small></button><button type="button" class="btn big" data-sossim="fr">🧪 Simuler : vers Meillerie<small>eaux françaises</small></button><button type="button" class="btn big" data-sossim="mer">🧪 Simuler : large de Toulon<small>en mer</small></button></div>`), // v450 (Corban) : répertoire à part, uniquement pour la simulation
    S('tests', '🧪 Tests', `<h3>💨 Test des alertes de vent</h3><p class="keep-help nav-hint">Deux bips et deux flashs de couleur, du plus faible au plus fort.</p><div class="row"><button class="btn" data-walert="test">▶ Test des alertes de vent</button></div>${typeof depthDevHtml === 'function' ? depthDevHtml(true) : ''}`),
    S('maps', '🗺 Cartes', `${P.mapRad}${P.lakes}${P.links}`),
    S('boats', '🚤 Calculs des bateaux', P.margins),
    S('data', '🔄 Sauvegarde et synchronisation', backupHtml()),
    S('install', '📲 Installation et hors ligne', `${installGuideHtml()}<section class="field"><h2>✈︎ Hors ligne</h2><p class="help" id="offState">Vérification…</p></section>`),
    S('dev', '🛠 Mode développeur', `${typeof uiEditHtml === 'function' ? uiEditHtml() : ''}`),
  ].join('');
  if (!main.querySelector('.set-secs')) settingsOpen = null; // v419 (Corban) : à l'arrivée sur Réglages, toutes les rubriques sont fermées ; un rafraîchissement garde celle qui est ouverte
  main.innerHTML = `<h1>Réglages</h1><div class="set-secs">${sections}</div>`;
  main.querySelectorAll('details.set-sec').forEach((d) => d.addEventListener('toggle', () => { if (d.open) settingsOpen = d.dataset.sec; else if (settingsOpen === d.dataset.sec) settingsOpen = null; }));
  if (settingsOpen) { const d = main.querySelector(`details.set-sec[data-sec="${settingsOpen}"]`); if (d) d.open = true; }
  { // v301 : la partie générale est aussi sous les réglages de l'onglet (plus d'appui long sur la roue)
    bindInstallGuide(main);
    bindBackup(main);
    if (typeof bindUiEdit === 'function') bindUiEdit(main);
    offlineState().then((t) => { const el = $('#offState'); if (el) el.innerHTML = t; });
  }
  main.oninput = (e) => {
    const k = e.target.dataset && e.target.dataset.margin;
    if (!k) return;
    const x = num(e.target.value);
    if (e.target.value.trim() === '') delete settings[k]; else if (x != null && x >= 0) settings[k] = x; else return;
    saveSettings();
  };
  main.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    buzz();
    if (b.dataset.back) return go(from || 'tracker');
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.walert && typeof windAlertClick === 'function') { const r = windAlertClick(b); if (b.dataset.walert !== 'test') VIEWS.settings(); return r; }
    if (b.dataset.theme) { settings.theme = b.dataset.theme; applyTheme(); }
    if (b.dataset.icon) { settings.icon = b.dataset.icon; applyIcon(); saveSettings(); toast('Icône choisie : ajoutez maintenant l’appli à l’écran d’accueil'); VIEWS.settings(); $('#installGuide').scrollIntoView(); return; }
    if (b.dataset.s) settings[b.dataset.s] = Number(b.dataset.v);
    if (b.id === 'wakeBtn') { settings.wake = !settings.wake; applyWake(); }
    if (b.id === 'popBtn') { settings.noHelpI = !settings.noHelpI; applyHelpI(); if (!settings.noHelpI) setTimeout(() => toast('Bulles d’aide réaffichées'), 50); }
    if (b.id === 'prefillBtn') settings.prefill = !settings.prefill;
    if (b.id === 'wxBtn') settings.autoWeather = !settings.autoWeather;
    saveSettings();
    VIEWS.settings();
  };
};

/* ---------- Démarrage ---------- */
function boot() {
  // Aperçu dans un cadre : les onglets passent en haut, juste sous la barre de l'horloge.
  if (document.documentElement.classList.contains('in-frame')) {
    const tb = document.querySelector('.tabbar'), top = document.querySelector('.topbar');
    if (tb && top) { top.after(tb); const fix = () => document.documentElement.style.setProperty('--topbar-h', top.offsetHeight + 'px'); fix(); window.addEventListener('resize', fix); }
  }
  { const top = document.querySelector('.topbar'); const fixH = () => { document.documentElement.style.setProperty('--topbar-h', top.offsetHeight + 'px'); const ck = document.querySelector('.clock'); if (ck) document.documentElement.style.setProperty('--clock-fs', getComputedStyle(ck).fontSize); }; fixH(); window.addEventListener('resize', fixH); setTimeout(fixH, 300); }
  $$('.tab').forEach((b) => (b.onclick = () => { buzz(); go(b.dataset.view); }));
  // Roue dentée : réglages de l'onglet ouvert ; un second toucher (ou « Retour ») ramène à l'onglet de départ.
  { const gb = $('#gearBtn'); let gearLP = false, gearT = null;
    // v301 (Corban) : plus d'appui long sur la roue ; la Zone de navigation en tête choisit les réglages lac ou mer.
    // v320 (Corban) : appui long sur la roue = mode nuit ; nouvel appui long = mode jour.
    gb.addEventListener('pointerdown', () => { gearLP = false; clearTimeout(gearT); gearT = setTimeout(() => { gearLP = true; buzz(); settings.theme = settings.theme === 'night' ? 'day' : 'night'; saveSettings(); applyTheme(); if (currentView === 'settings') VIEWS.settings(); toast(settings.theme === 'night' ? '☾ Mode nuit · appui long sur la roue pour revenir au jour' : '☀︎ Mode jour'); }, 650); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => gb.addEventListener(ev, () => clearTimeout(gearT)));
    gb.addEventListener('contextmenu', (e) => e.preventDefault());
    gb.onclick = () => { if (gearLP) { gearLP = false; return; } buzz(); if (currentView === 'settings') return go(settingsFrom || 'tracker'); settingsFrom = currentView; settingsAll = false; go._gear = true; go('settings'); }; }
  $('#themeBtn').onclick = () => { buzz(); settings.theme = settings.theme === 'night' ? 'day' : 'night'; saveSettings(); applyTheme(); if (currentView === 'settings') VIEWS.settings(); };
  document.addEventListener('visibilitychange', applyWake);
  applyTheme();
  applyIcon();
  tickClock();
  setInterval(tickClock, 10000);
  applyWake();
  const cur = store.get('ldb.current', null);
  if (!(cur && openCruise(cur)) && index.length) openCruise(index[index.length - 1].id);
  if (typeof autoResumeTrip === 'function') autoResumeTrip();
  go('tracker'); // premier écran : le traceur (Corban, 2026-10-31)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Demande au navigateur de ne pas effacer les données du journal.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Conversion du vent sous les cases de saisie (Beaufort, km/h).
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.wind && t.nextElementSibling && t.nextElementSibling.classList.contains('conv')) t.nextElementSibling.textContent = windConv(t.value);
});

// Mode jour / nuit : déplacé du bandeau vers la roue dentée (v91).
const NIGHT_VIEWS = ['tracker', 'prep', 'dock', 'new', 'vhf', 'checklist', 'sos', 'mob', 'alpha'];
function nightOK() { return !!settingsFrom && NIGHT_VIEWS.includes(settingsFrom); }
{
  const _settings = VIEWS.settings;
  VIEWS.settings = function (...a) {
    _settings.apply(this, a);
    if (!nightOK()) return; // mode nuit : seulement depuis NavIn et SOS, pas depuis data (Corban, v134)
    const main = $('#view');
    const night = settings.theme === 'night';
    const zs = main.querySelector('.zone-set');
    (zs || main).insertAdjacentHTML(zs ? 'beforebegin' : 'afterbegin', /* v442 (Corban) : au-dessus de la zone de navigation */ `<div class="row"><button class="btn big" id="themeToggle">${night ? '☀︎ Passer en mode jour' : '☾ Passer en mode nuit'}<small>${night ? 'mode nuit actif (rouge, pour garder la vision nocturne)' : 'mode jour actif'}</small></button></div>`);
    $('#themeToggle').addEventListener('click', (e) => { e.stopPropagation(); $('#themeBtn').click(); });
  };
}

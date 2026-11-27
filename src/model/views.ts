/** Screen titles by view name (legacy `VIEW_LABELS`). */
export const VIEW_LABELS: Readonly<Record<string, string>> = {
  cartes: 'Fonds de cartes',
  prep: 'PréP',
  dock: 'Accostage',
  traces: 'Traces',
  tracker: 'NavIn',
  new: 'Saisir',
  day: 'Journée',
  log: 'Journal',
  map: 'Carte',
  sos: 'Sécurité',
  vhf: 'VHF',
  mob: 'Homme à la mer',
  soslogs: 'SOS · logs',
  alerts: 'Journal des alertes',
  more: 'data',
  marks: 'Marques',
  routes: 'Routes',
  checklist: 'Check-lists',
  crew: 'Équipage',
  info: 'Bateau et croisière',
  sheet: 'Fiche du jour',
  cruises: 'Mes navigations',
  boats: 'Bateaux',
  people: 'Équipiers·ères',
  crews: 'Équipages',
  alpha: 'Alphabet',
  rules: 'Règles du Léman et documents obligatoires à bord',
  docs: 'Documents',
  voyages: 'Croisières maritimes',
  sorties: 'Sorties lacustres',
  vcrew: 'Équipage de la croisière',
  vcontracts: 'Contrats',
  vdocs: 'Documents de la croisière',
  voyage: 'Croisière',
  vrecords: 'Enregistrements de la croisière',
  vrecs: 'Enregistrements de la croisière : une sorte',
  vinfo: 'Croisière : ports, dates, VHF, météo',
  vboat: 'Croisière : bateau',
};

/** Views whose settings may switch the night mode (legacy `NIGHT_VIEWS`). */
export const NIGHT_VIEWS: readonly string[] = [
  'tracker',
  'prep',
  'dock',
  'new',
  'vhf',
  'checklist',
  'sos',
  'mob',
  'alpha',
];

/**
 * Day-sheet or cruise key of the boat takeover / end observations (legacy `constatKey`).
 * @param list - `'dep'` (takeover) or another list.
 * @returns `'obsPrise'` or `'obsFin'`.
 */
export function constatKey(list: string): string {
  return list === 'dep' ? 'obsPrise' : 'obsFin';
}

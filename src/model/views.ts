/** Screen titles by view name (legacy `VIEW_LABELS`). */
export const VIEW_LABELS: Readonly<Record<string, string>> = {
  cartes: 'Mes cartes',
  prep: 'PréP',
  dock: 'Accostage',
  traces: 'Mes traces',
  tracker: 'NavIn',
  new: 'Saisir',
  day: 'Journée',
  log: 'Journal',
  map: 'Carte',
  sos: 'Sécurité',
  vhf: 'VHF',
  mob: 'Homme à la mer',
  soslogs: 'SOS · logs',
  more: 'data',
  zones: 'Zones hors ligne',
  marks: 'Mes marques',
  checklist: 'Check-lists',
  crew: 'Équipage',
  info: 'Bateau et croisière',
  sheet: 'Fiche du jour',
  cruises: 'Mes navigations',
  boats: 'Mes bateaux',
  people: 'Les coéquipiers·ères',
  crews: 'Équipages',
  alpha: 'Alphabet',
  rules: 'Règles du Léman',
  docs: 'Documents',
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

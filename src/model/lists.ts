/** A choice option: `[value, sub-label?, third column?]`. */
export type ChoiceOption = readonly [string, string?, string?];

/** Eight compass directions with their bearing. */
export const DIRS8: ReadonlyArray<readonly [string, number]> = [
  ['N', 0],
  ['NE', 45],
  ['E', 90],
  ['SE', 135],
  ['S', 180],
  ['SO', 225],
  ['O', 270],
  ['NO', 315],
];

/** Douglas sea scale (WMO): `[degree, French name, significant wave height]`. */
export const DOUGLAS: ReadonlyArray<readonly [string, string, string]> = [
  ['0', 'calme', '0 m'],
  ['1', 'ridée', '0 à 0,1 m'],
  ['2', 'belle', '0,1 à 0,5 m'],
  ['3', 'peu agitée', '0,5 à 1,25 m'],
  ['4', 'agitée', '1,25 à 2,5 m'],
  ['5', 'forte', '2,5 à 4 m'],
  ['6', 'très forte', '4 à 6 m'],
  ['7', 'grosse', '6 à 9 m'],
  ['8', 'très grosse', '9 à 14 m'],
  ['9', 'énorme', 'plus de 14 m'],
];

/** English names of the Douglas degrees. */
export const DOUGLAS_EN: readonly string[] = [
  'Calm (glassy)',
  'Calm (rippled)',
  'Smooth (wavelets)',
  'Slight',
  'Moderate',
  'Rough',
  'Very rough',
  'High',
  'Very high',
  'Phenomenal',
];

/** One Beaufort row: force, knots, French name, English name, French sea, English sea. */
type BeaufortRow = readonly [number, string, string, string, string, string];

/** Beaufort scale. */
export const BEAUFORT_TBL: readonly BeaufortRow[] = [
  [0, '< 1', 'Calme', 'Calm', 'Mer comme un miroir', 'Sea like a mirror'],
  [
    1,
    '1 à 3',
    'Très légère brise',
    'Light air',
    'Quelques rides, sans écume',
    'Ripples without crests',
  ],
  [
    2,
    '4 à 6',
    'Légère brise',
    'Light breeze',
    'Vaguelettes qui ne déferlent pas',
    'Small wavelets, crests do not break',
  ],
  [
    3,
    '7 à 10',
    'Petite brise',
    'Gentle breeze',
    'Très petites vagues, quelques moutons',
    'Large wavelets, scattered white horses',
  ],
  [
    4,
    '11 à 16',
    'Jolie brise',
    'Moderate breeze',
    'Petites vagues, moutons nombreux',
    'Small waves, frequent white horses',
  ],
  [
    5,
    '17 à 21',
    'Bonne brise',
    'Fresh breeze',
    'Vagues modérées et allongées, moutons partout',
    'Moderate longer waves, many white horses',
  ],
  [
    6,
    '22 à 27',
    'Vent frais',
    'Strong breeze',
    'Lames, crêtes d’écume blanche étendues',
    'Large waves, extensive white foam crests',
  ],
  [
    7,
    '28 à 33',
    'Grand frais',
    'Near gale',
    'La mer grossit, l’écume s’étire en traînées',
    'Sea heaps up, foam blown in streaks',
  ],
  [
    8,
    '34 à 40',
    'Coup de vent',
    'Gale',
    'Lames assez hautes, crêtes en tourbillons d’embruns',
    'Moderately high waves, crests break into spindrift',
  ],
  [
    9,
    '41 à 47',
    'Fort coup de vent',
    'Strong gale',
    'Grosses lames, épaisses traînées d’écume, embruns gênant la visibilité',
    'High waves, dense foam streaks, spray affects visibility',
  ],
  [
    10,
    '48 à 55',
    'Tempête',
    'Storm',
    'Très grosses lames déferlantes, mer blanche',
    'Very high waves with overhanging crests, sea looks white',
  ],
  [
    11,
    '56 à 63',
    'Violente tempête',
    'Violent storm',
    'Lames exceptionnellement hautes',
    'Exceptionally high waves',
  ],
  [
    12,
    '≥ 64',
    'Ouragan',
    'Hurricane force',
    'Air plein d’écume et d’embruns, mer entièrement blanche',
    'Air filled with foam and spray, sea completely white',
  ],
];

/** Lower bound in knots of Beaufort forces 1 to 12. */
export const BFT_KN: readonly number[] = [
  1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64,
];

/** Visibility choices. */
export const VISI: readonly ChoiceOption[] = [
  ['E', 'excellente'],
  ['TB', 'très bonne'],
  ['B', 'bonne'],
  ['M', 'moyenne'],
  ['F', 'faible'],
  ['TF', 'très faible'],
];

/** Trend choices. */
export const TREND: readonly ChoiceOption[] = [
  ['↗', 'hausse'],
  ['→', 'stable'],
  ['↘', 'baisse'],
];

/** Storm warning lights of the Swiss lakes. */
export const STORM_LIGHTS: readonly ChoiceOption[] = [
  ['Éteints'],
  ['Prudence', 'feu orange, 40 éclats / min'],
  ['Tempête', 'feu orange, 90 éclats / min'],
];

/** Points of sail. */
export const ALLURES: readonly string[] = [
  'Près serré',
  'Près',
  'Bon plein',
  'Travers',
  'Largue',
  'Grand largue',
  'Vent arrière',
];

/** Tank level choices of the lake day sheet. */
export const LEVELS: readonly ChoiceOption[] = [
  ['Plein'],
  ['3/4'],
  ['1/2'],
  ['1/4'],
  ['Réserve'],
];

/** Outing types of the lake day sheet. */
export const OUTING_TYPES: readonly ChoiceOption[] = [
  ['Location'],
  ['Dès 17h00'],
  ['Journée semaine'],
  ['Journée WE'],
  ['Entraînement'],
  ['Invitation'],
  ['Autre sortie'],
];

/** Day-sheet weather keys kept on the lake day sheet. */
export const LAKE_WX: readonly string[] = [
  'fVentDir',
  'fVentVit',
  'fRafales',
  'fVentTend',
  'fFeux',
  'fAir',
  'fEau',
  'fOrage',
];

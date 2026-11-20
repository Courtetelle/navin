/**
 * The fixed alerts: places where a danger always comes back at the same spot
 * (a tidal race, a plateau of rocks, a narrow channel, a traffic lane, a
 * local wind), each with what happens there and how to behave. They are
 * read without network. The texts are drafts until checked against the
 * sailing directions (Instructions nautiques du SHOM, Admiralty Sailing
 * Directions, a nautical almanac): `checked` says which ones were.
 */

/** A sea of the fixed alerts, in the order of the list. */
export type FixedSea = 'manche' | 'atlantique' | 'mer-du-nord' | 'mediterranee';

/** The seas, with their titles. */
export const FIXED_SEAS: ReadonlyArray<readonly [FixedSea, string]> = [
  ['manche', 'Manche et îles Anglo-Normandes'],
  ['atlantique', 'Atlantique : Iroise, Gascogne, Galice'],
  ['mer-du-nord', 'Mer du Nord, Écosse et mer d’Irlande'],
  ['mediterranee', 'Méditerranée'],
];

/** One fixed alert. */
export interface FixedAlert {
  /** Stable id: the band of the list is `fixed:<id>`. */
  id: string;
  sea: FixedSea;
  /** Name of the place. */
  name: string;
  /** Where it is, by landmarks. */
  where: string;
  /** Middle of the zone and its radius on the map, km; none for a whole sea. */
  zone: { lat: number; lon: number; km: number } | null;
  /** What happens there. */
  what: string;
  /** When it becomes dangerous. */
  when: string;
  /** How to behave, in order. */
  conduct: string;
  /** The figure of the day to check before leaving, with where. */
  check?: string;
  /** Sources of the text. */
  sources?: ReadonlyArray<readonly [string, string]>;
  /** Checked against the sailing directions. */
  checked: boolean;
}

const TIDES_SHOM = 'marées et courants du jour (SHOM, almanach)';

/** The fixed alerts, sea by sea, from Saint-Quay-Portrieux outwards for the Channel. */
export const FIXED_ALERTS: readonly FixedAlert[] = [
  // Manche
  {
    id: 'st-brieuc',
    sea: 'manche',
    name: 'Baie de Saint-Brieuc et abords de Saint-Quay',
    where:
      'de Saint-Quay-Portrieux au cap Fréhel, plateaux du Rohein et du Grand Léjon au large',
    zone: { lat: 48.62, lon: -2.68, km: 16 },
    what: 'Très grand marnage : de vastes zones découvrent à marée basse ; roches et plateaux isolés au large.',
    when: 'Marée basse de vives-eaux, nuit ou brume, atterrissage hors du chenal balisé.',
    conduct:
      'Calculer la hauteur d’eau à l’heure d’arrivée, suivre le balisage, garder une marge sous la quille, prévoir l’heure de la porte du port.',
    check: `coefficient et heures de marée à Saint-Quay-Portrieux, ${TIDES_SHOM}`,
    checked: false,
  },
  {
    id: 'eolien-st-brieuc',
    sea: 'manche',
    name: 'Parc éolien en mer de la baie de Saint-Brieuc',
    where:
      'nord-est de la baie, au large d’Erquy et du cap Fréhel ; sous-station électrique 48°50,973’ N 002°31,972’ W',
    zone: { lat: 48.86, lon: -2.52, km: 8 },
    what: 'Zone réglementée de 62 éoliennes et une sous-station électrique, en exploitation : obstacles fixes, sillage et mer hachée entre les mâts, réception radar brouillée ; ce n’est pas un abri.',
    when: 'De nuit, par visibilité réduite, par vent établi de force 4 et plus, et à la rencontre des navires de maintenance.',
    conduct:
      'Navigation de plaisance autorisée (navires de 25 m au plus), à 12 nœuds au plus. Rester à plus de 50 m de chaque éolienne et à plus de 200 m de la sous-station, sauf urgence. Mouillage interdit (sauf urgence ou autorisation), plongée de loisir interdite, engins tractés ou aérotractés interdits, manifestations nautiques interdites. VHF ASN allumée et veille du canal 16 obligatoires ; AIS (classe A ou B) en émission obligatoire de nuit, par visibilité inférieure à 5 km ou par vent établi de force 4 et plus. Ne pas compter sur le parc pour s’abriter.',
    check:
      'L’arrêté en vigueur et les avis urgents aux navigateurs de la préfecture maritime de l’Atlantique, le bulletin côtier (force du vent), la visibilité et l’AIS du bord avant d’entrer.',
    sources: [
      [
        'Préfecture maritime de l’Atlantique, arrêté n° 2024/138 du 21 juin 2024',
        'https://www.premar-atlantique.gouv.fr/uploads/atlantique/arretes/8bf7e4ba11aa40f29652d2fd9bf8cd49.pdf',
      ],
      [
        'Communiqué de réouverture du parc',
        'https://www.premar-atlantique.gouv.fr/communiques-presse/reouverture-du-parc-eolien-en-mer-de-saint-brieuc-aux-activites-maritimes',
      ],
    ],
    checked: true,
  },
  {
    id: 'brehat',
    sea: 'manche',
    name: 'Bréhat, Trieux et chenaux de Kerpont et du Ferlas',
    where: 'autour de l’île de Bréhat, entrée du Trieux',
    zone: { lat: 48.85, lon: -3, km: 6 },
    what: 'Courants forts dans des chenaux étroits et rocheux.',
    when: 'Courant contraire, vent contre courant, visibilité réduite.',
    conduct:
      'Passer de jour, avec le courant portant, moteur prêt ; choisir le mouillage selon le marnage.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'barnouic-douvres',
    sea: 'manche',
    name: 'Plateau de Barnouic et Roches Douvres',
    where: 'au large, au nord-est de Bréhat, sur la route de Guernesey',
    zone: { lat: 49.06, lon: -2.86, km: 9 },
    what: 'Roches isolées loin de la côte ; le courant porte de travers sur la route.',
    when: 'Brume, nuit, dérive mal corrigée.',
    conduct:
      'Faire une route qui les laisse largement ; surveiller la route et la vitesse sur le fond.',
    checked: false,
  },
  {
    id: 'minquiers',
    sea: 'manche',
    name: 'Plateau des Minquiers',
    where: 'au sud de Jersey, entre Saint-Malo et Jersey',
    zone: { lat: 48.97, lon: -2.1, km: 9 },
    what: 'Immense plateau rocheux qui découvre à marée basse ; courants tournants.',
    when: 'Marée basse de vives-eaux, brume, approche sans carte à jour.',
    conduct:
      'Le contourner par ses bouées cardinales, ou n’y entrer qu’avec un plan de marée précis.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'chausey',
    sea: 'manche',
    name: 'Îles Chausey',
    where: 'au large de Granville',
    zone: { lat: 48.88, lon: -1.82, km: 6 },
    what: 'Archipel qui découvre très largement ; chenaux à courants forts.',
    when: 'Marée basse de vives-eaux, mouillage mal choisi.',
    conduct:
      'Entrer par le chenal balisé, à la bonne heure de marée ; vérifier la hauteur d’eau au mouillage à la basse mer.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'deroute',
    sea: 'manche',
    name: 'Passage de la Déroute et Écréhou',
    where: 'entre Jersey et la côte du Cotentin',
    zone: { lat: 49.27, lon: -1.9, km: 10 },
    what: 'Passage peu profond, courants forts, hauts-fonds et roches.',
    when: 'Courant contraire, basse mer, vent contre courant.',
    conduct: 'Passer avec le courant, de jour, sur la route balisée.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'raz-blanchard',
    sea: 'manche',
    name: 'Raz Blanchard',
    where:
      'entre le cap de la Hague et Aurigny, le plus fort vers la bouée La Foraine',
    zone: { lat: 49.7, lon: -2.05, km: 8 },
    what: 'Le courant le plus fort d’Europe : flot de 6 à près de 12 nœuds selon le coefficient, jusant de 4 à 9 nœuds. Flot au plus fort vers la pleine mer de Cherbourg, jusant vers la basse mer, renverses vers la mi-marée.',
    when: 'Vent contre courant (mer très creuse et déferlante dès un vent modéré), vent de plus de 25 nœuds, grand coefficient, nuit (casiers).',
    conduct:
      'Viser l’étale et un petit coefficient ; venant du sud vers le nord par vent de sud à sud-ouest, se présenter vers 3 h avant la pleine mer de Cherbourg ; sinon attendre à l’anse Saint-Martin ou à Goury.',
    check: 'heure de pleine mer à Cherbourg et coefficient',
    sources: [
      [
        'Figaro Nautisme',
        'https://figaronautisme.meteoconsult.fr/actus-nautisme-escales/2026-03-25/86881-raz-blanchard-tout-comprendre-pour-franchir-le-plus-puissant-courant-deurope',
      ],
      [
        'Bateaux.com',
        'https://www.bateaux.com/article/31517/le-passage-du-raz-blanchard',
      ],
    ],
    checked: false,
  },
  {
    id: 'swinge-casquets',
    sea: 'manche',
    name: 'The Swinge et rail des Casquets',
    where: 'entre Aurigny et Burhou ; le rail à l’ouest d’Aurigny',
    zone: { lat: 49.71, lon: -2.3, km: 10 },
    what: 'Courant très violent entre Aurigny et Burhou ; à l’ouest, rail de navigation très fréquenté, souvent dans la brume.',
    when: 'Hors de l’étale, vent contre courant, brume.',
    conduct:
      'Le Swinge à l’étale seulement ; couper le rail à angle droit (cap perpendiculaire, règle 10 du RIPAM), veille AIS et radar.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'little-russel',
    sea: 'manche',
    name: 'Little Russel',
    where: 'entre Guernesey et Herm, devant Saint-Pierre-Port',
    zone: { lat: 49.47, lon: -2.49, km: 5 },
    what: 'Courants forts entre les îles, nombreuses roches.',
    when: 'Courant contraire, vent contre courant, nuit.',
    conduct: 'Entrer à Saint-Pierre-Port avec le courant, de jour.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'portland',
    sea: 'manche',
    name: 'Portland Race',
    where: 'au sud de Portland Bill (côte anglaise)',
    zone: { lat: 50.49, lon: -2.45, km: 5 },
    what: 'Raz de courant au large de la pointe : mer très dure, déferlante.',
    when: 'Courant fort, vent contre courant, grand coefficient.',
    conduct:
      'Passer très près de la pointe à l’étale, ou très au large (plusieurs milles) ; jamais dans le raz par mauvais temps.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'manche-general',
    sea: 'manche',
    name: 'Toute la Manche',
    where: 'partout où le courant est fort',
    zone: null,
    what: 'Vent contre courant : la mer devient courte et cassante. Grandes marées : courants et hauteurs d’eau extrêmes. Brume fréquente au début de l’été. Rails de trafic des Casquets et d’Ouessant.',
    when: 'Grand coefficient, vent opposé au courant, visibilité réduite.',
    conduct:
      'Faire coïncider les passages difficiles avec le courant portant et un vent dans le même sens ; veille AIS et radar par brume.',
    check: TIDES_SHOM,
    checked: false,
  },
  // Atlantique
  {
    id: 'chenal-four',
    sea: 'atlantique',
    name: 'Chenal du Four',
    where: 'entre la côte du Léon et les îles de Molène, au nord de Brest',
    zone: { lat: 48.4, lon: -4.8, km: 8 },
    what: 'Chenal côtier à courants forts, bordé de roches.',
    when: 'Courant contraire, vent contre courant, brume.',
    conduct:
      'Passer avec le courant portant, en suivant les alignements ; attendre la renverse si le courant est contraire.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'fromveur',
    sea: 'atlantique',
    name: 'Passage du Fromveur et rail d’Ouessant',
    where: 'entre Ouessant et Molène ; le rail au large d’Ouessant',
    zone: { lat: 48.45, lon: -5.03, km: 6 },
    what: 'Courant parmi les plus forts de France ; au large, le rail de trafic d’Ouessant.',
    when: 'Vent contre courant, grand coefficient, brume.',
    conduct:
      'Passer à l’étale ou avec le courant et le vent dans le même sens ; couper le rail à angle droit.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'raz-sein',
    sea: 'atlantique',
    name: 'Raz de Sein',
    where: 'entre la pointe du Raz et l’île de Sein',
    zone: { lat: 48.04, lon: -4.76, km: 5 },
    what: 'Raz de courant réputé, mer très dure par vent contre courant.',
    when: 'Hors de l’étale, vent contre courant, houle d’ouest.',
    conduct: 'Passer à l’étale, de jour, par beau temps ; sinon attendre.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'gironde',
    sea: 'atlantique',
    name: 'Passes de la Gironde',
    where: 'entrée de l’estuaire, autour de Cordouan',
    zone: { lat: 45.62, lon: -1.2, km: 12 },
    what: 'Barre et bancs à l’entrée de l’estuaire ; la houle déferle sur les hauts-fonds.',
    when: 'Jusant, houle d’ouest, vent contre courant.',
    conduct:
      'Entrer avec le flot par la passe balisée ; ne jamais franchir les passes au jusant avec de la houle.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'arcachon',
    sea: 'atlantique',
    name: 'Passes du bassin d’Arcachon',
    where: 'entre le cap Ferret et le banc d’Arguin',
    zone: { lat: 44.58, lon: -1.25, km: 6 },
    what: 'Passes mobiles sur des bancs de sable, balisage déplacé selon les années ; barre qui déferle.',
    when: 'Jusant, houle, vent d’ouest.',
    conduct:
      'Ne passer qu’avec le flot, de jour, sur le balisage du jour (avis aux navigateurs) ; renoncer par houle forte.',
    check: 'avis aux navigateurs et balisage des passes',
    checked: false,
  },
  {
    id: 'finisterre',
    sea: 'atlantique',
    name: 'Cap Finisterre et Costa da Morte',
    where: 'côte nord-ouest de la Galice',
    zone: { lat: 42.9, lon: -9.3, km: 30 },
    what: 'Cap très exposé à la houle d’Atlantique, accélération du vent ; rail de trafic au large.',
    when: 'Houle d’ouest, vent fort de nord-est en été, brume.',
    conduct:
      'Passer au large du cap ; couper le rail à angle droit ; s’abriter dans les rías par mauvais temps.',
    checked: false,
  },
  // Mer du Nord, Écosse, mer d'Irlande
  {
    id: 'pentland',
    sea: 'mer-du-nord',
    name: 'Pentland Firth',
    where: 'entre l’Écosse et les Orcades',
    zone: { lat: 58.7, lon: -3.1, km: 12 },
    what: 'Courants parmi les plus forts des îles Britanniques, raz et tourbillons.',
    when: 'Hors de l’étale, vent contre courant, houle.',
    conduct: 'Passer à l’étale ou avec le courant, par vent faible.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'corryvreckan',
    sea: 'mer-du-nord',
    name: 'Golfe de Corryvreckan',
    where: 'entre Jura et Scarba (côte ouest de l’Écosse)',
    zone: { lat: 56.155, lon: -5.72, km: 3 },
    what: 'Tourbillon et raz de courant célèbres.',
    when: 'Courant de flot, vent contre courant, houle d’ouest.',
    conduct: 'L’éviter, ou ne passer qu’à l’étale par beau temps.',
    check: TIDES_SHOM,
    checked: false,
  },
  {
    id: 'elbe',
    sea: 'mer-du-nord',
    name: 'Estuaire de l’Elbe et baie Allemande',
    where: 'entrée de l’Elbe, devant Cuxhaven',
    zone: { lat: 53.9, lon: 8.6, km: 20 },
    what: 'Courants forts, trafic commercial dense, bancs de la mer des Wadden.',
    when: 'Vent d’ouest contre le jusant, brume.',
    conduct:
      'Naviguer avec le courant, hors du chenal des navires de commerce, veille AIS.',
    check: TIDES_SHOM,
    checked: false,
  },
  // Méditerranée
  {
    id: 'gibraltar',
    sea: 'mediterranee',
    name: 'Détroit de Gibraltar',
    where: 'entre l’Espagne et le Maroc',
    zone: { lat: 35.97, lon: -5.55, km: 25 },
    what: 'Courant entrant d’Atlantique en surface, renforcé ou contrarié par la marée ; vent canalisé (levante, poniente) ; rail de trafic très dense.',
    when: 'Levante fort contre le courant, brume, traversée du rail.',
    conduct:
      'Partir avec le vent et le courant favorables ; longer la côte espagnole ; couper le rail à angle droit.',
    checked: false,
  },
  {
    id: 'messine',
    sea: 'mediterranee',
    name: 'Détroit de Messine',
    where: 'entre la Sicile et la Calabre',
    zone: { lat: 38.22, lon: 15.63, km: 8 },
    what: 'Courants alternatifs et tourbillons, trafic de ferries ; passage réglementé.',
    when: 'Courant contraire, vent canalisé dans le détroit.',
    conduct:
      'Passer avec le courant, appeler la surveillance du trafic (VTS) comme demandé, veille des ferries.',
    checked: false,
  },
  {
    id: 'bonifacio',
    sea: 'mediterranee',
    name: 'Bouches de Bonifacio',
    where: 'entre la Corse et la Sardaigne',
    zone: { lat: 41.33, lon: 9.25, km: 10 },
    what: 'Accélération du vent d’ouest dans le détroit, courant de vent, mer croisée ; nombreuses roches.',
    when: 'Vent d’ouest fort (le vent y est plus fort qu’au large).',
    conduct:
      'Ajouter une marge au vent annoncé ; passer de jour ; s’abriter à Bonifacio ou dans La Maddalena.',
    checked: false,
  },
  {
    id: 'lion',
    sea: 'mediterranee',
    name: 'Golfe du Lion',
    where: 'de Port-Vendres aux Saintes-Maries-de-la-Mer',
    zone: { lat: 42.95, lon: 4, km: 70 },
    what: 'Tramontane et mistral : vent de terre fort sous un ciel clair, mer courte et creuse au large.',
    when: 'Mistral ou tramontane annoncé, surtout loin de la côte.',
    conduct:
      'Rester près de la côte au vent (mer plus plate) ; réduire tôt ; ne pas traverser le golfe par mistral.',
    checked: false,
  },
  {
    id: 'adriatique-nord',
    sea: 'mediterranee',
    name: 'Nord de l’Adriatique : acqua alta et bora',
    where: 'de Venise à Trieste et au golfe du Kvarner',
    zone: { lat: 45.3, lon: 13.2, km: 60 },
    what: 'Seul endroit de Méditerranée à vraie marée sensible ; le sirocco pousse l’eau vers Venise (acqua alta). Bora : vent de nord-est en rafales violentes, soudaines.',
    when: 'Sirocco durable (surcote), bora annoncée.',
    conduct:
      'Par bora, rester à l’abri de la côte croate au mouillage sûr ; par sirocco, prévoir des hauteurs d’eau plus fortes dans les lagunes.',
    checked: false,
  },
  {
    id: 'gabes',
    sea: 'mediterranee',
    name: 'Golfe de Gabès',
    where: 'côte sud-est de la Tunisie',
    zone: { lat: 34.2, lon: 10.5, km: 60 },
    what: 'Marée importante pour la Méditerranée et très petits fonds sur de grandes distances.',
    when: 'Basse mer, approche des côtes plates.',
    conduct:
      'Tenir compte de la marée comme sur l’Atlantique ; garder de l’eau sous la quille loin de la côte.',
    checked: false,
  },
  {
    id: 'egee',
    sea: 'mediterranee',
    name: 'Mer Égée : meltem',
    where: 'Cyclades et sud de la mer Égée',
    zone: { lat: 37.3, lon: 25, km: 120 },
    what: 'Vent de nord régulier et fort en été, accéléré entre les îles ; mer courte.',
    when: 'Juillet et août surtout, l’après-midi.',
    conduct:
      'Faire les étapes vers le nord le matin ; prévoir des abris ; réduire tôt entre les îles.',
    checked: false,
  },
  {
    id: 'med-general',
    sea: 'mediterranee',
    name: 'Toute la Méditerranée : surcote',
    where: 'côtes basses et ports',
    zone: null,
    what: 'Sans grande marée, le niveau monte quand la pression baisse et quand le vent pousse l’eau vers la côte (surcote).',
    when: 'Dépression creuse et vent du large durable.',
    conduct:
      'Prévoir plus d’eau au port mais une mer qui déferle sur les quais et les passes ; vérifier les amarres.',
    checked: false,
  },
];

/**
 * A fixed alert by its id.
 * @param id - Its id.
 * @returns The alert, or undefined.
 */
export function fixedAlertById(id: string): FixedAlert | undefined {
  return FIXED_ALERTS.find((alert) => alert.id === id);
}

/**
 * The band of an alert in its list.
 * @param id - Its id.
 * @returns `fixed:<id>`.
 */
export function fixedBand(id: string): string {
  return `fixed:${id}`;
}

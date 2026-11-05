import type { SeedItem } from './checklistSeeds.ts';
import { toSeedItems as toItems } from './checklistSeeds.ts';

/** Name of the safety briefing list. */
export const BRIEF_NAME = 'Briefing sécurité';

/** Categories of the safety briefing list. */
export const BRIEF_CATS: readonly string[] = ['Sécurité', 'Check-in'];

/** Items of the safety briefing, with what to show. */
export const BRIEF_ITEMS: readonly SeedItem[] = toItems([
  [
    'Toilettes : ne rien y jeter, ni papier ni objet (grand danger d’obstruction)',
    'En arrivant à bord : distribuer ou montrer les sachets pour le papier.',
  ],
  [
    'Gilets : dès que le bateau bouge, on les porte ; les mettre avant de partir',
    'Distribuer les gilets, les ajuster sur chacun, demander qui nage bien.',
  ],
  [
    'Harnais : bateau en mouvement et hors du cockpit (dans le cockpit aussi, à la demande du skipper)',
    'Distribuer les harnais, faire le tour du bateau accroché à la ligne de vie.',
  ],
  [
    'Chaussures fermées : risque de blessure pieds nus',
    'Montrer les objets pointus : taquets, poulies, rails…',
  ],
  [
    'Piano, winchs, poulies : garder les mains à distance',
    'Montrer comment faire.',
  ],
  [
    'Protéger le bateau : utiliser les pare-battages, ne pas pousser avec les mains ou les pieds',
    '',
  ],
  [
    'Gaz : le sécuriser avant de partir',
    'Montrer la bonbonne, la vanne extérieure et éventuellement intérieure.',
  ],
  [
    'Four à gaz : système à bilame, vanne de gaz s’il y en a une',
    'Faire allumer une plaque avec l’allume-gaz ou des allumettes.',
  ],
  [
    'Feu à bord : cause la plus fréquente de naufrage',
    'Montrer l’extincteur et la couverture anti-feu.',
  ],
  [
    'Homme à la mer : procédure du skipper (quick stop, empannage, virement…), un équipier ne quitte pas la personne des yeux',
    'Simuler la manœuvre avec un pare-battage à la première sortie.',
  ],
  [
    'VHF et sécurité : qui parle et comment, canaux 16 et 72',
    'Montrer la touche rouge DISTRESS et tout l’équipement de sécurité (fusées…).',
  ],
  ['Pompe de cale : emplacement de la manivelle', 'Faire pomper les jeunes.'],
  [
    'Nœuds utiles : chaise, cabestan, taquet',
    'Concours de nœuds, attacher les pare-battages.',
  ],
]);

/** Items of the "Prise en main du bateau" sheet (sea charter). */
export const PRISE_ITEMS: readonly SeedItem[] = toItems([
  [
    'Noter et si besoin photographier tous les dégâts, éraflures… à l’extérieur et à l’intérieur',
    'À signaler au loueur avant de prendre la mer, idéalement sur la fiche d’inventaire signée au départ.',
  ],
  ['Vérifier l’inventaire selon la fiche remise par le loueur', ''],
  [
    'Repérer les extincteurs et couvertures anti-feu, vérifier leur bon état',
    '',
  ],
  ['État de l’accastillage, du gréement et des lignes de vie', ''],
  ['Matériel d’amarrage : quantité et qualité', ''],
  [
    'État des voiles, des drisses, des coulisseaux…',
    'La grand-voile peut s’user sur les barres de flèche.',
  ],
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
  [
    'Documents du bateau : acte de francisation, assurance, attestation du radeau, cartes, bloc marine, modes d’emploi',
    '',
  ],
  ['Livre de bord à bord', ''],
  ['Noter les heures moteur et le loch au départ dans le livre de bord', ''],
  [
    'Noter les caractéristiques du bateau : dimensions, tirant d’eau, MMSI…',
    'Dans Plus › Bateau et croisière.',
  ],
  [
    'À la première baignade, vérifier la partie immergée et signaler tout défaut',
    '',
  ],
  [
    'Pendant la semaine, tenir la liste des réparations et de la vaisselle manquante',
    '',
  ],
]);

/** Former sea template items replaced by their fuller version. */
export const PRISE_REPLACES: readonly string[] = [
  'Photos des dégâts existants avec le loueur',
  'Inventaire du matériel avec le loueur',
  'Extincteurs et couverture anti-feu',
  'Annexe, hors-bord, gonfleur et pagaies',
  'Feux de navigation',
];

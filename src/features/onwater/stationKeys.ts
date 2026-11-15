import { aemetReadings, metOfficeReadings } from './euStations.ts';
import { frostReadings } from './northStations.ts';

/** The AEMET key: every station of Spain, the Balearics and the Canaries. */
export const AEMET_KEY = {
  setting: 'aemetKey',
  account: 'aemet',
  name: 'AEMET',
  // No account: only the address of the mail the key is sent to.
  mailOnly: true,
  label: '🇪🇸 Clé API AEMET (Espagne)',
  url: 'https://opendata.aemet.es/centrodedescargas/altaUsuario',
  help: 'Facultatif. Gratuite sur opendata.aemet.es : demander une clé avec votre adresse mail, elle arrive par mail ; la coller ici. Avec elle, les quelque 900 stations officielles de l’Espagne, des Baléares et des Canaries s’ajoutent à LiveMétéo et aux alertes.',
  read: (center: { lat: number; lon: number }, key: string) =>
    aemetReadings(center, 60, 3, key),
  sample: { lat: 39.55, lon: 2.64 },
} as const;

/** The Met Office key: the land stations of Britain. */
export const MET_OFFICE_KEY = {
  setting: 'metOfficeKey',
  account: 'metoffice',
  name: 'Met Office',
  mailOnly: false,
  label: '🇬🇧 Clé API Met Office (Grande-Bretagne)',
  url: 'https://datahub.metoffice.gov.uk',
  help: 'Facultatif. Gratuite sur datahub.metoffice.gov.uk : créer un compte, s’abonner à « Land Observations » (offre gratuite, 360 appels par jour), puis copier la clé ici. Chaque station est relue au plus une fois par heure.',
  read: (center: { lat: number; lon: number }, key: string) =>
    metOfficeReadings(center, 80, key),
  sample: { lat: 50.8, lon: -1.3 },
} as const;

/** The Frost client ID: the coast stations of Norway, through the relay. */
export const FROST_KEY = {
  setting: 'frostKey',
  account: 'frost',
  name: 'MET Norway (Frost)',
  // No password: an address of mail gives the client ID at once.
  mailOnly: true,
  label: '🇳🇴 Identifiant Frost (Norvège)',
  url: 'https://frost.met.no/auth/requestCredentials.html',
  help: 'Facultatif. Gratuit sur frost.met.no : écrire son adresse mail, le « client ID » s’affiche aussitôt (et arrive par mail) ; le coller ici. Il faut aussi le relais (plus bas), à jour. Avec lui, les stations côtières et les phares de Norvège s’ajoutent à LiveMétéo et aux alertes.',
  read: (center: { lat: number; lon: number }, key: string) =>
    frostReadings(center, 80, 3, key),
  sample: { lat: 59.9, lon: 10.7 },
} as const;

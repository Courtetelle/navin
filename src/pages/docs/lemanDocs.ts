/** A document required on board. */
export interface LemanDocument {
  id: string;
  title: string;
  note: string;
  /**
   * Personal document: added as a photo or a PDF.
   * @default false
   */
  perso?: boolean;
  /**
   * Official PDF.
   * @default undefined
   */
  url?: string;
}

/** Documents required on board on the French side (source: port of Sciez). */
export const LEMAN_DOCS: readonly LemanDocument[] = [
  {
    id: 'permis',
    title: 'Permis bateau (côtier ou eaux intérieures)',
    note: 'Les deux sont valables sur tout le Léman, côté suisse compris. Une copie est tolérée par la brigade nautique d’Évian.',
    perso: true,
  },
  {
    id: 'titre',
    title: 'Titre de navigation du bateau (carte grise)',
    note: 'Une copie est tolérée par la brigade nautique d’Évian.',
    perso: true,
  },
  {
    id: 'rpp',
    title: 'Règlement particulier de police du Léman (RPP)',
    note: 'Exemplaire à jour, papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/28037/168112/file/RPPconsolide_VOK-2019-06-17-bd.pdf',
  },
  {
    id: 'rgp',
    title: 'Règlement général de police des eaux intérieures (RGP)',
    note: 'Valable sur tous les plans d’eau intérieurs de France. Papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/23843/145334/file/recueil_rgpmi__2019_09.pdf',
  },
  {
    id: 'accord',
    title:
      'Accord franco-suisse du 7 décembre 1976 et règlement de la navigation sur le Léman',
    note: 'Papier ou PDF enregistré sur le téléphone.',
    url: 'https://www.haute-savoie.gouv.fr/contenu/telechargement/31420/186874/file/00-RNL-2019-compile-et-accord.pdf',
  },
];

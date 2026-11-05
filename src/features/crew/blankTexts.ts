/** Languages a blank sheet can be sent in besides French. */
export type BlankForeignLanguage = 'en' | 'it' | 'es';

/** Texts of a blank sheet in one foreign language. */
export interface BlankTexts {
  /** First line, recognised when the sheet comes back. */
  head: string;
  /** How to fill in the message. */
  fillIn: string;
  /** What to do with a field that cannot be filled in. */
  leaveBlank: string;
  /** The identity card or passport instruction. */
  choice: string;
  /** Word between identity card and passport. */
  or: string;
  /** Title of the printed sheet. */
  pdfTitle: string;
  /** Subtitle of the printed sheet. */
  pdfSubtitle: string;
  /** Line of the identity document on the printed sheet. */
  pdfDocument: string;
  /** Field labels, by key. */
  labels: Readonly<Record<string, string>>;
}

export const BLANK_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['prenom', 'Prénom'],
  ['nom', 'Nom'],
  ['sexe', 'Homme ou femme (remplis H ou F)'],
  ['naissance', 'Date de naissance (JJ.MM.AAAA)'],
  ['lieu', 'Lieu de naissance ou d’origine'],
  ['nationalite', 'Nationalité'],
  ['tel', 'Téléphone (avec indicatif, ex. +41)'],
  ['email', 'Courriel'],
  ['pieceCI', 'Carte d’identité'],
  ['piecePP', 'Passeport'],
  ['piece', 'N° de la pièce d’identité'],
  ['expiration', 'Date d’expiration de la pièce (JJ.MM.AAAA)'],
  ['permis', 'Permis bateau n°'],
  ['emisPar', 'Permis établi par'],
  ['vhf', 'Licence VHF n°'],
  ['adresse', 'Adresse postale'],
  ['sante', 'Santé, allergies à connaître'],
  ['procheNom', 'Proche à contacter, prénom et nom'],
  ['procheTel', 'Téléphone du proche'],
];
export const BLANK_OLD: ReadonlyArray<readonly [string, string]> = [
  ['sexe', 'Homme ou femme'],
  ['pieceType', 'Pièce d’identité (passeport ou carte d’identité)'],
  ['proche2Nom', '2ᵉᵐᵉ proche, prénom et nom'],
  ['proche2Tel', 'Téléphone du 2ᵉᵐᵉ proche'],
];
export const BLANK_HEAD = 'NavIn · Fiche coéquipier·ère';
export const BLANK_I18N: Readonly<Record<BlankForeignLanguage, BlankTexts>> = {
  en: {
    head: 'NavIn · Crew member sheet',
    fillIn:
      'Please fill in after each « : » and send this message back to me as it is, without changing any of my text.',
    leaveBlank:
      'Leave blank anything you cannot fill in (for example VHF licence no.).',
    choice:
      '(Fill in either your identity card or your passport here, not both)',
    or: 'Or',
    pdfTitle: 'Crew member sheet',
    pdfSubtitle: 'NavIn · to fill in and send back',
    pdfDocument: 'Identity card or passport (circle)',
    labels: {
      prenom: 'First name',
      nom: 'Last name',
      sexe: 'Man or woman (write M or W)',
      naissance: 'Date of birth (DD.MM.YYYY)',
      lieu: 'Place of birth or origin',
      nationalite: 'Nationality',
      tel: 'Phone (with country code, e.g. +41)',
      email: 'Email',
      pieceCI: 'Identity card',
      piecePP: 'Passport',
      piece: 'Identity document no.',
      expiration: 'Document expiry date (DD.MM.YYYY)',
      permis: 'Boat licence no.',
      emisPar: 'Licence issued by',
      vhf: 'VHF licence no.',
      adresse: 'Postal address',
      sante: 'Health, allergies to know about',
      procheNom: 'Emergency contact, first and last name',
      procheTel: 'Emergency contact phone',
    },
  },
  it: {
    head: 'NavIn · Scheda membro dell’equipaggio',
    fillIn:
      'Per favore compila dopo ogni « : » e rimandami questo messaggio così com’è, senza modificare il mio testo.',
    leaveBlank:
      'Lascia vuoto ciò che non puoi compilare (per esempio Licenza VHF n.).',
    choice:
      '(Compila qui la carta d’identità oppure il passaporto, non entrambi)',
    or: 'Oppure',
    pdfTitle: 'Scheda membro dell’equipaggio',
    pdfSubtitle: 'NavIn · da compilare e rimandare',
    pdfDocument: 'Carta d’identità o passaporto (cerchiare)',
    labels: {
      prenom: 'Nome',
      nom: 'Cognome',
      sexe: 'Uomo o donna (scrivi U o D)',
      naissance: 'Data di nascita (GG.MM.AAAA)',
      lieu: 'Luogo di nascita o di origine',
      nationalite: 'Nazionalità',
      tel: 'Telefono (con prefisso, es. +41)',
      email: 'E-mail',
      pieceCI: 'Carta d’identità',
      piecePP: 'Passaporto',
      piece: 'N. del documento d’identità',
      expiration: 'Data di scadenza del documento (GG.MM.AAAA)',
      permis: 'Patente nautica n.',
      emisPar: 'Patente rilasciata da',
      vhf: 'Licenza VHF n.',
      adresse: 'Indirizzo postale',
      sante: 'Salute, allergie da conoscere',
      procheNom: 'Persona da contattare, nome e cognome',
      procheTel: 'Telefono della persona da contattare',
    },
  },
  es: {
    head: 'NavIn · Ficha de tripulante',
    fillIn:
      'Por favor, rellena después de cada « : » y devuélveme este mensaje tal cual, sin cambiar nada de mi texto.',
    leaveBlank:
      'Deja vacío lo que no puedas rellenar (por ejemplo Licencia VHF n.º).',
    choice:
      '(Rellena aquí el documento de identidad o el pasaporte, no los dos)',
    or: 'O',
    pdfTitle: 'Ficha de tripulante',
    pdfSubtitle: 'NavIn · para rellenar y devolver',
    pdfDocument: 'Documento de identidad o pasaporte (rodear)',
    labels: {
      prenom: 'Nombre',
      nom: 'Apellido',
      sexe: 'Hombre o mujer (escribe H o M)',
      naissance: 'Fecha de nacimiento (DD.MM.AAAA)',
      lieu: 'Lugar de nacimiento o de origen',
      nationalite: 'Nacionalidad',
      tel: 'Teléfono (con prefijo, p. ej. +41)',
      email: 'Correo electrónico',
      pieceCI: 'Documento de identidad',
      piecePP: 'Pasaporte',
      piece: 'N.º del documento de identidad',
      expiration: 'Fecha de caducidad del documento (DD.MM.AAAA)',
      permis: 'Titulación náutica n.º',
      emisPar: 'Titulación expedida por',
      vhf: 'Licencia VHF n.º',
      adresse: 'Dirección postal',
      sante: 'Salud, alergias a tener en cuenta',
      procheNom: 'Contacto de emergencia, nombre y apellido',
      procheTel: 'Teléfono del contacto de emergencia',
    },
  },
};

/** Languages a blank sheet can be sent in besides French. */
export type BlankForeignLanguage = 'en' | 'it' | 'es';

/** The parts of a blank sheet, each under its title. */
export type BlankPart =
  'identity' | 'document' | 'sea' | 'lake' | 'vhf' | 'contact';

/** Texts of a blank sheet in one foreign language. */
interface BlankTexts {
  /** First line, recognised when the sheet comes back. */
  head: string;
  /** The rules read before filling in, numbered. */
  rules: readonly string[];
  /** The titles of the parts of the sheet. */
  parts: Readonly<Record<BlankPart, string>>;
  /** Last line: the sheet ends here. */
  end: string;
  /** Older sheets: how to fill in the message (still recognised). */
  fillIn: string;
  /** Older sheets: a field that cannot be filled in (still recognised). */
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
/** The rules of the French sheet, read before filling it in. */
export const BLANK_RULES: readonly string[] = [
  '📌 À LIRE AVANT DE REMPLIR',
  '1️⃣ Appuie longuement sur ce message, « Copier », colle-le dans ta réponse, puis complète-le.',
  '2️⃣ Écris chaque réponse juste APRÈS les deux-points « : », sur la même ligne.',
  '3️⃣ Ne change RIEN avant les « : » et n’efface AUCUNE ligne : ni le titre « NavIn · Fiche coéquipier·ère », ni les intitulés, ni les lignes « — … — ». C’est grâce à eux que NavIn reprend ta fiche telle quelle et l’enregistre.',
  '4️⃣ Ce que tu n’as pas (par exemple pas de licence VHF) : laisse vide après les « : », sans effacer la ligne.',
  '5️⃣ Les dates s’écrivent JJ.MM.AAAA, par exemple 14.11.1985.',
  '6️⃣ Renvoie-moi le message en entier, du titre jusqu’à « Fin de la fiche ».',
];
/** The titles of the parts of the French sheet. */
export const BLANK_PARTS: Readonly<Record<BlankPart, string>> = {
  identity: 'Identité',
  document: 'Pièce d’identité',
  licence: 'Permis bateau et licence VHF',
  contact: 'Adresse, santé, proche',
};
/** Last line of the French sheet. */
export const BLANK_END = 'Fin de la fiche, merci !';
export const BLANK_HEAD = 'NavIn · Fiche coéquipier·ère';
export const BLANK_I18N: Readonly<Record<BlankForeignLanguage, BlankTexts>> = {
  en: {
    head: 'NavIn · Crew member sheet',
    rules: [
      '📌 PLEASE READ BEFORE FILLING IN',
      '1️⃣ Press and hold this message, « Copy », paste it into your reply, then fill it in.',
      '2️⃣ Write each answer right AFTER the colon « : », on the same line.',
      '3️⃣ Change NOTHING before the « : » and delete NO line: not the title « NavIn · Crew member sheet », not the labels, not the « — … — » lines. They let NavIn take your sheet back as it is and save it.',
      '4️⃣ Anything you do not have (for example no VHF licence): leave it blank after the « : », without deleting the line.',
      '5️⃣ Dates are written DD.MM.YYYY, for example 14.11.1985.',
      '6️⃣ Send me back the whole message, from the title down to « End of the sheet ».',
    ],
    parts: {
      identity: 'Identity',
      document: 'Identity document',
      licence: 'Boat licence and VHF licence',
      contact: 'Address, health, emergency contact',
    },
    end: 'End of the sheet, thank you!',
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
    rules: [
      '📌 DA LEGGERE PRIMA DI COMPILARE',
      '1️⃣ Tieni premuto questo messaggio, « Copia », incollalo nella tua risposta, poi compilalo.',
      '2️⃣ Scrivi ogni risposta subito DOPO i due punti « : », sulla stessa riga.',
      '3️⃣ Non cambiare NIENTE prima dei « : » e non cancellare NESSUNA riga: né il titolo « NavIn · Scheda membro dell’equipaggio », né le voci, né le righe « — … — ». Grazie a loro NavIn riprende la tua scheda così com’è e la salva.',
      '4️⃣ Ciò che non hai (per esempio niente licenza VHF): lascia vuoto dopo i « : », senza cancellare la riga.',
      '5️⃣ Le date si scrivono GG.MM.AAAA, per esempio 14.11.1985.',
      '6️⃣ Rimandami il messaggio intero, dal titolo fino a « Fine della scheda ».',
    ],
    parts: {
      identity: 'Identità',
      document: 'Documento d’identità',
      licence: 'Patente nautica e licenza VHF',
      contact: 'Indirizzo, salute, persona da contattare',
    },
    end: 'Fine della scheda, grazie!',
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
    rules: [
      '📌 LEER ANTES DE RELLENAR',
      '1️⃣ Mantén pulsado este mensaje, « Copiar », pégalo en tu respuesta y luego rellénalo.',
      '2️⃣ Escribe cada respuesta justo DESPUÉS de los dos puntos « : », en la misma línea.',
      '3️⃣ No cambies NADA antes de los « : » y no borres NINGUNA línea: ni el título « NavIn · Ficha de tripulante », ni los encabezados, ni las líneas « — … — ». Gracias a ellos NavIn recupera tu ficha tal cual y la guarda.',
      '4️⃣ Lo que no tengas (por ejemplo, sin licencia VHF): déjalo vacío después de los « : », sin borrar la línea.',
      '5️⃣ Las fechas se escriben DD.MM.AAAA, por ejemplo 14.11.1985.',
      '6️⃣ Devuélveme el mensaje entero, desde el título hasta « Fin de la ficha ».',
    ],
    parts: {
      identity: 'Identidad',
      document: 'Documento de identidad',
      licence: 'Titulación náutica y licencia VHF',
      contact: 'Dirección, salud, contacto de emergencia',
    },
    end: 'Fin de la ficha, ¡gracias!',
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

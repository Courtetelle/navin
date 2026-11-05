import { expect, test } from 'vitest';

import { memberClones, normLabel, parseBlank } from '../blankParse.ts';

const FILLED_FRENCH = [
  'NavIn · Fiche coéquipier·ère',
  '',
  'Merci de compléter après chaque « : » puis de me renvoyer ce message tel quel sans rien modifier de mon texte.',
  'Ne remplis rien si tu n’es pas en mesure de le faire (exemple pour Licence VHF n°).',
  '',
  'Prénom : Zoé',
  'Nom : Vidal',
  'Homme ou femme (remplis H ou F) : f',
  'Date de naissance (JJ.MM.AAAA) : 01.02.1990',
  'Téléphone (avec indicatif, ex. +41) : 079 123 45 67',
  '(Ici tu remplis à choix soit ta carte d’identité soit ton passeport, mais pas les deux)',
  'Carte d’identité : ',
  'Ou',
  'Passeport : X1234567',
  'Adresse postale : Rue A 1',
  '1000 Lausanne',
  'Proche à contacter, prénom et nom : Marc',
  'Téléphone du proche : 0041791112233',
  '',
].join('\n');

test('normLabel removes accents, punctuation and superscripts', () => {
  expect(normLabel('2ᵉᵐᵉ proche, prénom et nom')).toBe(
    '2eee proche prenom et nom',
  );
  expect(normLabel('Date d’expiration (JJ.MM.AAAA)')).toBe(
    'date d expiration jj mm aaaa',
  );
});

test('a French sheet gives the same card as legacy, in the same key order', () => {
  const sheets = parseBlank(FILLED_FRENCH);

  expect(sheets).toStrictEqual([
    {
      prenom: 'Zoé',
      nom: 'Vidal',
      sexe: 'Femme',
      naissance: '01.02.1990',
      tel: '+41 79 123 45 67',
      adresse: 'Rue A 1\n1000 Lausanne',
      procheNom: 'Marc',
      procheTel: '+41 79 111 22 33',
      pieceType: 'Passeport',
      piece: 'X1234567',
      proche: 'Marc +41 79 111 22 33',
    },
  ]);
  expect(Object.keys(sheets[0] ?? {}).slice(-3)).toStrictEqual([
    'pieceType',
    'piece',
    'proche',
  ]);
});

test('in Spanish M means mujer, and a filled document only gives its type', () => {
  const text = [
    '*NavIn · Ficha de tripulante*',
    'Nombre : Ana',
    'Apellido : Gil',
    'Hombre o mujer (escribe H o M) : M',
    'Documento de identidad : sí',
    'O',
    'Pasaporte : ',
  ].join('\n');

  expect(parseBlank(text)).toStrictEqual([
    { prenom: 'Ana', nom: 'Gil', sexe: 'Femme', pieceType: 'Carte d’identité' },
  ]);
});

test('each head starts a new sheet, whatever its language', () => {
  const text = [
    'NavIn · Crew member sheet',
    'First name: Bob',
    'Man or woman (write M or W): M',
    'NavIn · Scheda membro dell’equipaggio',
    'Nome: Gia',
    'Cognome: Rossi',
    'Uomo o donna (scrivi U o D): D',
    'Passaporto: si',
  ].join('\n');

  expect(parseBlank(text)).toStrictEqual([
    { prenom: 'Bob', sexe: 'Homme' },
    { prenom: 'Gia', nom: 'Rossi', sexe: 'Femme', pieceType: 'Passeport' },
  ]);
});

test('a message without any label gives nothing', () => {
  expect(parseBlank("bonjour\nsans rien d'utile")).toStrictEqual([]);
});

test('labels of the sheets sent by old versions are still read', () => {
  const text = [
    'Prénom : Sans Tête',
    'Pièce d’identité (passeport ou carte d’identité) : passeport',
    '2ᵉᵐᵉ proche, prénom et nom : Léa',
    'Téléphone du 2ᵉᵐᵉ proche : 022 345 67 89',
  ].join('\n');

  expect(parseBlank(text)).toStrictEqual([
    {
      prenom: 'Sans Tête',
      pieceType: 'Passeport',
      proche2Nom: 'Léa',
      proche2Tel: '+41 22 345 67 89',
      proche: 'Léa +41 22 345 67 89',
    },
  ]);
});

test('similar cards share the name, the phone, the email or the document', () => {
  const members = [
    { id: 'a', prenom: 'Zoé', nom: 'VIDAL' },
    { id: 'b', prenom: 'Luc', tel: '+41 79 123 45 67' },
    { id: 'c', prenom: 'Eva', email: 'eva@example.org' },
    { id: 'd', prenom: 'Max', piece: 'X1' },
    { id: 'e', prenom: 'Noé', tel: '123' },
  ];
  const ids = (sheet: Parameters<typeof memberClones>[0]) =>
    memberClones(sheet, members).map((member) => member.id);

  expect(ids({ prenom: 'zoe', nom: 'Vidal' })).toStrictEqual(['a']);
  expect(ids({ tel: '0041 79 123 45 67'.slice(5) })).toStrictEqual([]);
  expect(ids({ tel: '+41 79 123 45 67' })).toStrictEqual(['b']);
  expect(ids({ email: 'EVA@example.org' })).toStrictEqual(['c']);
  expect(ids({ piece: 'x1' })).toStrictEqual(['d']);
  expect(ids({ tel: '123' })).toStrictEqual([]);
});

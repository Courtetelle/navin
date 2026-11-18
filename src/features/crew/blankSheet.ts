import { language } from '../../i18n/langState.ts';
import { uid } from '../../lib/format.ts';
import type { Member } from '../../model/types.ts';
import { state, toast, updateMembers } from '../../state/index.ts';

import type { ParsedSheet } from './blankParse.ts';
import { memberClones, parseBlank } from './blankParse.ts';
import type { BlankForeignLanguage, BlankPart } from './blankTexts.ts';
import {
  BLANK_END,
  BLANK_FIELDS,
  BLANK_HEAD,
  BLANK_I18N,
  BLANK_PARTS,
  BLANK_RULES,
} from './blankTexts.ts';
import { showArbitration, showFicheList } from './screen.ts';

/** Language of a blank sheet. */
type BlankLanguage = 'fr' | BlankForeignLanguage;

let queue: ParsedSheet[] = [];

/**
 * The blank sheet leaves in the language shown (legacy `blankLang`).
 * @returns The language.
 */
export function blankLanguage(): BlankLanguage {
  return language.value;
}

/**
 * Label of a field in a language (legacy `blankLab`).
 * @param key - Field key.
 * @param shown - Language.
 * @returns The label.
 */
export function blankLabel(key: string, shown: BlankLanguage): string {
  const foreign = shown === 'fr' ? undefined : BLANK_I18N[shown].labels[key];
  if (foreign) return foreign;
  return BLANK_FIELDS.find(([field]) => field === key)?.[1] ?? '';
}

/**
 * Text of the blank sheet: consignes then « Intitulé : » lines (legacy `blankText`).
 * @param shown - Language.
 * @returns The message.
 */
export function blankText(shown: BlankLanguage = blankLanguage()): string {
  const texts = shown === 'fr' ? null : BLANK_I18N[shown];
  const line = (key: string) => `${blankLabel(key, shown)} : `;
  const part = (name: BlankPart) =>
    `— ${(texts?.parts ?? BLANK_PARTS)[name]} —`;
  return [
    texts ? texts.head : BLANK_HEAD,
    '',
    ...(texts?.rules ?? BLANK_RULES),
    '',
    part('identity'),
    ...[
      'prenom',
      'nom',
      'sexe',
      'naissance',
      'lieu',
      'nationalite',
      'tel',
      'email',
    ].map(line),
    '',
    part('document'),
    texts
      ? texts.choice
      : '(Ici tu remplis à choix soit ta carte d’identité soit ton passeport, mais pas les deux)',
    line('pieceCI'),
    texts ? texts.or : 'Ou',
    line('piecePP'),
    ...['piece', 'expiration'].map(line),
    '',
    part('sea'),
    ...['permis', 'permisDate', 'emisPar'].map(line),
    '',
    part('lake'),
    ...['permisLac', 'permisLacDate', 'permisLacPar'].map(line),
    '',
    part('vhf'),
    ...['vhf', 'vhfDate'].map(line),
    '',
    part('contact'),
    ...['adresse', 'sante', 'procheNom', 'procheTel'].map(line),
    '',
    `— ${texts ? texts.end : BLANK_END} —`,
  ].join('\n');
}

/**
 * Send the blank sheet as a text message, by the share sheet of the phone or
 * else by the clipboard (legacy `blankSend`, lake.js:2110).
 */
export async function blankSend(): Promise<void> {
  const text = blankText();
  try {
    if ('share' in navigator) {
      await navigator.share({ text });
      return;
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Fiche vide copiée · collez-la dans WhatsApp');
  } catch {
    toast('Copie impossible sur cet appareil');
  }
}

/**
 * Load one or several sheets pasted from a message (legacy `blankImport`,
 * lake.js:2130): without a similar card it is created, otherwise the user arbitrates.
 * @param text - Pasted text.
 */
export function blankImport(text: string): void {
  const sheets = parseBlank(text);
  if (sheets.length === 0) {
    toast(
      'Aucune fiche reconnue · collez le message complet, avec les « Intitulé : valeur »',
    );
    return;
  }
  queue = sheets;
  nextSheet();
}

/**
 * Create a card from a received sheet (legacy `blankCreate`).
 * @param sheet - Received sheet.
 * @returns The card.
 */
export function createFromSheet(sheet: ParsedSheet): Member {
  const member: Member = { id: uid(), ...sheet };
  updateMembers((members) => {
    members.push(member);
  });
  return member;
}

/** The sheet shown in the arbitration is dealt with: go on with the next one. */
export function sheetDone(): void {
  queue.shift();
  nextSheet();
}

function nextSheet(): void {
  let made = 0;
  for (let sheet = queue[0]; sheet; sheet = queue[0]) {
    const clones = memberClones(sheet, state.data.members.value);
    if (clones.length > 0) {
      showArbitration(sheet, clones);
      return;
    }
    queue.shift();
    createFromSheet(sheet);
    made++;
  }
  if (made) {
    const plural = made > 1 ? 's' : '';
    toast(`${made} fiche${plural} ajoutée${plural}`);
  }
  state.view.crewFiche.value = null;
  showFicheList();
}

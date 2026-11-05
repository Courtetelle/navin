/** Values inserted in the radio messages (legacy `sosContext`). */
export interface ScriptContext {
  boat: string;
  boat3: string;
  idShort: string;
  idLine: string;
  pos: string;
  utc: string;
  pob: string | number;
  desc: string;
  descFr: string;
  station: string;
  nature: string;
  natureFr: string;
}

/** One message line: English, then the French in small; `null` is skipped. */
export type ScriptLine = readonly [string, string?] | null;

/** A distress nature: label, English sentence, French sentence. */
export type SosNature = readonly [string, string, string];

/** One procedure of the SOS page. */
export interface SosProcedure {
  title: string;
  sub: string;
  cls: string;
  /** Steps on the DSC radio. */
  asn: readonly string[];
  /** @default undefined */
  natures?: readonly SosNature[];
  script: (context: ScriptContext) => readonly ScriptLine[];
}

/** Names of the procedures, in the order of the buttons. */
export type SosKind = 'mayday' | 'pan' | 'securite' | 'cancel' | 'medical';

/** The radio procedures (legacy `SOS`), in the order of the buttons. */
export const SOS: Readonly<Record<SosKind, SosProcedure>> = {
  mayday: {
    title: 'MAYDAY',
    sub: 'Détresse : danger grave et imminent',
    cls: 'red',
    asn: [
      'Allumer, volume, squelch',
      'Ouvrir le capot rouge DISTRESS',
      'Choisir la nature si possible',
      'Appuyer 5 secondes sur DISTRESS',
      'Attendre l’accusé de réception, puis parler sur le canal 16 (PTT)',
    ],
    natures: [
      ['Incendie', 'We are on fire.', 'Nous sommes en feu.'],
      ['Voie d’eau', 'We are flooding.', 'Nous avons une voie d’eau.'],
      ['Collision', 'We had a collision.', 'Nous avons eu une collision.'],
      ['Échouement', 'We are aground.', 'Nous sommes échoués.'],
      ['Chavirement', 'Danger of capsizing.', 'Risque de chavirement.'],
      ['Naufrage', 'We are sinking.', 'Nous coulons.'],
      [
        'Dérive',
        'We are adrift, not under command.',
        'Nous dérivons, bateau non manœuvrant.',
      ],
      ['Homme à la mer', 'Man overboard.', 'Un homme à la mer.'],
      ['Abandon', 'We are abandoning ship.', 'Nous abandonnons le navire.'],
      [
        'Piraterie',
        'We are under piracy attack.',
        'Nous subissons une attaque de pirates.',
      ],
    ],
    script: (c) => [
      ['MAYDAY MAYDAY MAYDAY'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`MAYDAY ${c.boat} ${c.idShort}`],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      [`${c.pob} people on board.`, `${c.pob} personnes à bord.`],
      c.desc ? [c.desc, c.descFr] : null,
      ['Immediate assistance required.', 'Assistance immédiate requise.'],
      ['OVER'],
    ],
  },
  pan: {
    title: 'PAN PAN',
    sub: 'Urgence : besoin d’aide, pas de danger immédiat',
    cls: 'orange',
    asn: [
      'Allumer, volume, squelch',
      'MENU › DSC › Position input › EXIT',
      'OTHER DSC › All ships › Urgency › CALL',
      'Parler sur le canal 16. Si un trafic de détresse est en cours, attendre la fin',
    ],
    natures: [
      [
        'Panne moteur',
        'Engine failure. We are drifting. We require towing assistance.',
        'Panne moteur. Nous dérivons. Nous demandons un remorquage.',
      ],
      [
        'Gouvernail',
        'Steering failure, not under command. We require towing assistance.',
        'Gouvernail en panne, non manœuvrant. Nous demandons un remorquage.',
      ],
      [
        'Bout dans l’hélice',
        'Line in the propeller. We require diving assistance.',
        'Un bout dans l’hélice. Nous avons besoin d’un plongeur.',
      ],
      [
        'Blessé',
        'One person injured. We require medical assistance.',
        'Une personne blessée. Nous demandons une assistance médicale.',
      ],
    ],
    script: (c) => [
      ['PAN PAN  PAN PAN  PAN PAN'],
      ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      [`${c.pob} people on board.`, `${c.pob} personnes à bord.`],
      ['OVER'],
    ],
  },
  securite: {
    title: 'SÉCURITÉ',
    sub: 'Avertir les autres d’un danger',
    cls: 'yellow',
    asn: [
      'Allumer, volume, squelch',
      'MENU › DSC › Position input › EXIT',
      'OTHER DSC › All ships › Safety › CALL',
      'Parler sur le canal 16 puis indiquer le canal de travail',
    ],
    natures: [
      [
        'Obstacle flottant',
        'Half-submerged obstacle observed. Please navigate carefully.',
        'Obstacle à moitié immergé observé. Naviguez avec prudence.',
      ],
      [
        'Veille renforcée',
        'Ships in vicinity are requested to keep a sharp lookout.',
        'Les navires à proximité sont priés de rester vigilants.',
      ],
    ],
    script: (c) => [
      ['SECURITE  SECURITE  SECURITE'],
      ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [c.nature, c.natureFr],
      ['OVER'],
    ],
  },
  cancel: {
    title: 'ANNULER',
    sub: 'Annuler une fausse alerte de détresse',
    cls: 'grey',
    asn: [
      'Sur la VHF : CANCEL puis CONTINUE (ou éteindre l’appareil)',
      'Puis annoncer sur le canal 16',
      'Après : FINISH › STBY › OK',
    ],
    script: (c) => [
      ['ALL STATIONS  ALL STATIONS  ALL STATIONS'],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [
        `Please cancel my distress alert of ${c.utc} UTC.`,
        `Veuillez annuler mon alerte de détresse de ${c.utc} UTC.`,
      ],
      ['OVER'],
    ],
  },
  medical: {
    title: 'MÉDICAL',
    sub: 'Consultation médicale par radio',
    cls: 'blue',
    asn: [
      'Allumer, volume, squelch',
      'MENU › DSC › Position input › EXIT',
      'OTHER DSC › Address : MMSI de la station côtière › CALL',
      'Ou téléphone : CCMM (voir numéros utiles)',
    ],
    script: (c) => [
      [`${c.station} RADIO`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`Position ${c.pos}`, `at ${c.utc} UTC`],
      [
        'I need telemedical advice.',
        'J’ai besoin d’une consultation médicale.',
      ],
      ['OVER'],
    ],
  },
};

/** Names of the procedures, in the order of the buttons. */
export const SOS_KINDS: readonly SosKind[] = [
  'mayday',
  'pan',
  'securite',
  'cancel',
  'medical',
];

/** English and French radio words (legacy `VOCAB`). */
export const VOCAB: ReadonlyArray<readonly [string, string]> = [
  ['Over', 'à vous'],
  ['Say again', 'répétez'],
  ['Read back', 'collationnez'],
  ['Correction', 'je corrige'],
  ['Go ahead', 'continuez'],
  ['How do you read?', 'comment me recevez-vous ?'],
  ['Loud and clear', 'fort et clair'],
  ['Stand by', 'attendez'],
  ['Switch to channel 08', 'passez sur le canal 08'],
  ['Roger, going up', 'compris, je commute'],
  ['Negative / Correct', 'non / exact'],
  ['Decimal', 'virgule'],
  ['Station calling?', 'qui m’appelle ?'],
  ['Seelonce Mayday', 'silence imposé (détresse en cours)'],
  ['Seelonce finee', 'fin du silence'],
];

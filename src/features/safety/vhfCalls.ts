import type { VhfAsk, VhfAskKey, VhfCall, VhfCallKey } from './vhfTypes.ts';

/** Fields of the routine calls (legacy `VHF_ASK`). */
export const VHF_ASK: Readonly<Record<VhfAskKey, VhfAsk>> = {
  station: { label: 'Station appelée', ph: 'ex. Port de Bandol, Cross Med' },
  other: {
    label: 'Navire appelé (nom ou description)',
    ph: 'ex. cargo rouge à tribord',
  },
  chan: { label: 'Canal de travail', ph: 'ex. 9', num: true },
  nights: { label: 'Nuits', ph: '1', num: true },
  eta: { label: 'Arrivée prévue (ETA)', ph: 'ex. 17:30' },
  dest: { label: 'Destination', ph: 'ex. Porquerolles' },
  from: { label: 'Port de départ', ph: 'ex. Toulon' },
};

/** Catalogue of routine calls (legacy `VHF_CALLS`). */
export const VHF_CALLS: Readonly<Record<VhfCallKey, VhfCall>> = {
  check: {
    title: 'Essai radio',
    sub: 'Radio check',
    ask: ['station', 'chan'],
    tip: 'Sur un canal de travail ou de port, jamais d’essai long sur le 16.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [
        `Radio check on channel ${c.chan}. How do you read me?`,
        `Essai radio sur le canal ${c.chan}. Comment me recevez-vous ?`,
      ],
      ['OVER'],
    ],
  },
  berth: {
    title: 'Place au port',
    sub: 'Demande de place',
    ask: ['station', 'chan', 'nights', 'eta'],
    tip: 'Appeler la capitainerie sur son canal (souvent 9) 30 à 60 min avant l’arrivée.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [
        `I would like a berth for ${c.nights} night${c.nights === '1' ? '' : 's'}.`,
        `Je souhaite une place pour ${c.nights} nuit${c.nights === '1' ? '' : 's'}.`,
      ],
      [
        `Length ${c.loaEn} metres, beam ${c.beamEn} metres, draft ${c.draftEn} metres.`,
        `Longueur ${c.loa} m, largeur ${c.beam} m, tirant d’eau ${c.draft} m.`,
      ],
      [
        `Our ETA is ${c.eta}. ${c.pob} people on board.`,
        `Arrivée prévue à ${c.eta}. ${c.pob} personnes à bord.`,
      ],
      ['OVER'],
    ],
  },
  arrive: {
    title: 'Entrée de port',
    sub: 'Arrivée, aide à l’amarrage',
    ask: ['station', 'chan'],
    tip: 'À l’entrée du port, pare-battages et amarres prêts.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      ['We are at the harbour entrance.', 'Nous sommes à l’entrée du port.'],
      [
        'Please give us a berth number and send a marinero to help us moor.',
        'Merci de nous indiquer un numéro de place et de nous envoyer un marinero pour l’amarrage.',
      ],
      [
        `Length ${c.loaEn} metres. Fenders and lines ready on both sides.`,
        `Longueur ${c.loa} m. Pare-battages et amarres prêts des deux bords.`,
      ],
      ['OVER'],
    ],
  },
  buoy: {
    title: 'Bouée, mouillage',
    sub: 'Demande de bouée',
    ask: ['station', 'chan', 'nights'],
    tip: 'Zones de mouillage organisé, parcs marins (Port-Cros, Calanques…).',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [
        `I would like a mooring buoy for ${c.nights} night${c.nights === '1' ? '' : 's'}.`,
        `Je souhaite une bouée pour ${c.nights} nuit${c.nights === '1' ? '' : 's'}.`,
      ],
      [
        `Length ${c.loaEn} metres. Position ${c.pos}.`,
        `Longueur ${c.loa} m. Position ${c.pos}.`,
      ],
      ['OVER'],
    ],
  },
  fuel: {
    title: 'Carburant',
    sub: 'Station d’avitaillement',
    ask: ['station', 'chan', 'eta'],
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [
        `Is the fuel station open? We would like diesel, arriving at ${c.eta}.`,
        `La station carburant est-elle ouverte ? Nous souhaitons du gazole, arrivée à ${c.eta}.`,
      ],
      ['OVER'],
    ],
  },
  ship: {
    title: 'Navire à navire',
    sub: 'Appeler un bateau, passer sur un canal',
    ask: ['other', 'chan'],
    tip: 'Appel sur le 16, puis dégager vers 6, 8, 72 ou 77.',
    script: (c) => [
      [`${c.other} ${c.other}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Please switch to channel ${c.chan}.`, `Passez sur le canal ${c.chan}.`],
      ['OVER'],
      ['— puis sur le canal de travail —'],
      [
        `${c.other}, this is ${c.boat}, on channel ${c.chan}.`,
        `${c.other}, ici ${c.boat}, sur le canal ${c.chan}.`,
      ],
    ],
  },
  intent: {
    title: 'Intentions d’un navire',
    sub: 'Risque de collision, croisement',
    ask: ['other'],
    tip: 'Sur le 16 (ou le 13 pour la passerelle). Décrire sa position par rapport au navire.',
    script: (c) => [
      [`Vessel ${c.other}, vessel ${c.other}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [`My position ${c.pos}.`, `Ma position ${c.pos}.`],
      [
        'Please advise your intentions. Do you see me?',
        'Quelles sont vos intentions ? Me voyez-vous ?',
      ],
      ['OVER'],
    ],
  },
  meteo: {
    title: 'Météo',
    sub: 'Demander le bulletin',
    ask: ['station', 'chan'],
    tip: 'En France, le CROSS diffuse les bulletins aux heures annoncées sur le 16 : écouter d’abord.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [`Position ${c.pos}.`, `Position ${c.pos}.`],
      [
        'Request the latest weather forecast for this area.',
        'Je demande le dernier bulletin météo pour cette zone.',
      ],
      ['OVER'],
    ],
  },
  route: {
    title: 'Avis de départ',
    sub: 'Route, ETA, personnes à bord',
    ask: ['station', 'from', 'dest', 'eta'],
    tip: 'Utile pour une traversée : la station sait qui vous êtes et où vous allez.',
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`, c.idLine],
      [
        `Departed from ${c.from}, bound for ${c.dest}. ETA ${c.eta}.`,
        `Parti de ${c.from}, à destination de ${c.dest}. Arrivée prévue ${c.eta}.`,
      ],
      [
        `${c.pob} people on board. ${c.desc}`,
        `${c.pob} personnes à bord. ${c.descFr}`,
      ],
      ['OVER'],
    ],
  },
  bridge: {
    title: 'Pont, écluse',
    sub: 'Demande d’ouverture ou de passage',
    ask: ['station', 'chan', 'eta'],
    script: (c) => [
      [`${c.station} ${c.station}`],
      [`This is sailing yacht ${c.boat3}`],
      [
        `Request passage at ${c.eta}, inbound. Air draft ${c.airEn} metres.`,
        `Je demande le passage à ${c.eta}. Tirant d’air ${c.airDraft} m.`,
      ],
      ['OVER'],
    ],
  },
};

/** Names of the routine calls, in the order of the buttons. */
export const VHF_CALL_KEYS: readonly VhfCallKey[] = [
  'check',
  'berth',
  'arrive',
  'buoy',
  'fuel',
  'ship',
  'intent',
  'meteo',
  'route',
  'bridge',
];

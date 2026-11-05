/** Channels and their use (legacy `VHF_CHANNELS`). */
export const VHF_CHANNELS: ReadonlyArray<readonly [string, string]> = [
  [
    '16',
    'Appel et détresse, veille permanente. Pas de conversation : on s’y appelle puis on dégage.',
  ],
  [
    '72 · 77',
    'Bateau à bateau entre plaisanciers : les plus utilisés en Europe.',
  ],
  [
    '06 · 08',
    'Bateau à bateau aussi (le 06 peut servir aux secours avec les aéronefs : le libérer à la demande).',
  ],
  ['09', 'Ports de plaisance et capitaineries (souvent, en France notamment).'],
  ['12 · 14', 'Ports de commerce, services portuaires.'],
  [
    '13',
    'Passerelle à passerelle entre navires de commerce (sécurité de la navigation).',
  ],
  ['70', 'ASN (appel numérique) seulement, jamais en phonie.'],
];

/**
 * Example dialogue: speaker, channel, English, French (legacy `VHF_DIALOG`).
 * @param me - Boat calling.
 * @param other - Boat called.
 * @returns The turns; a `—` speaker marks a stage direction.
 */
export function vhfDialog(
  me: string,
  other: string,
): ReadonlyArray<readonly [string, string, string, string]> {
  return [
    [
      'A',
      '16',
      `${other}, ${other}, ${other}, this is ${me}, ${me}, ${me}. Over.`,
      `${other} ×3, ici ${me} ×3. À vous.`,
    ],
    [
      'B',
      '16',
      `${me}, this is ${other}. Over.`,
      `${me}, ici ${other}. À vous.`,
    ],
    [
      'A',
      '16',
      `${other}, this is ${me}. Channel 72. Over.`,
      `${other}, ici ${me}. Canal 72. À vous.`,
    ],
    [
      'B',
      '16',
      `${me}, this is ${other}. Channel 72, going up.`,
      `${me}, ici ${other}. Canal 72, je commute.`,
    ],
    ['—', '', 'Les deux passent sur le 72.', ''],
    [
      'A',
      '72',
      `${other}, this is ${me}. Over.`,
      `${other}, ici ${me}. À vous.`,
    ],
    [
      'B',
      '72',
      `${me}, this is ${other}. Go ahead.`,
      `${me}, ici ${other}. Je vous écoute.`,
    ],
    [
      'A',
      '72',
      'We plan to anchor in the bay tonight. Is there enough room near you? Over.',
      'Nous voulons mouiller dans la baie ce soir. Y a-t-il de la place près de vous ? À vous.',
    ],
    [
      'B',
      '72',
      'Yes, plenty of room, five metres of water, good holding. Over.',
      'Oui, beaucoup de place, 5 m d’eau, bonne tenue. À vous.',
    ],
    [
      'A',
      '72',
      `Thank you. ${me} back to channel 16. Out.`,
      `Merci. ${me} retourne sur le 16. Terminé.`,
    ],
  ];
}

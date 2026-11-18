import { expect, test } from 'vitest';

import {
  cvBlankText,
  cvFilledText,
  isCvBlank,
  mergeCv,
  parseCvBlank,
} from '../cvBlank.ts';

/**
 * Fill the CV sent: the answers after the labels, in order of the blocks.
 * @param answers - `[label start, answer]`, each used once.
 * @returns The mail.
 */
function filled(answers: Array<[string, string]>): string {
  const left = [...answers];
  return cvBlankText({ prenom: 'Léa', nom: 'Rochat' })
    .split('\n')
    .map((line) => {
      const index = left.findIndex(([start]) => line.startsWith(start));
      if (index === -1) return line;
      const [[, answer] = ['', '']] = left.splice(index, 1);
      return `${line}${answer}`;
    })
    .join('\n');
}

test('the CV sent starts with its rules and has the name written in', () => {
  const text = cvBlankText({ prenom: 'Léa', nom: 'Rochat' });
  expect(isCvBlank(text)).toBe(true);
  expect(text).toContain('Prénom : Léa');
  expect(
    text.split('\n').filter((line) => line === '— Navigation —'),
  ).toHaveLength(5);
  expect(text).toContain('Ne change RIEN avant les « : »');
});

test('a CV sent back is read: navigations and licences, the empty blocks left out', () => {
  const mail = filled([
    ['Jours de navigation par an', '20'],
    ['As-tu déjà loué', 'oui'],
    ['Mer ou lac', 'Mer'],
    ['Année ou période', '2024'],
    ['Bateau (modèle)', 'Dufour 390'],
    ['Rôle à bord', 'Skipper'],
    ['Itinéraire ou zone', 'Cyclades'],
    ['Milles parcourus', '170'],
    ['Mer ou lac', 'lac'],
    ['Année ou période', '2015 – aujourd’hui'],
    ['Brevet, certificat', 'Permis mer'],
    ['Année : ', '2020'],
  ]);
  // Answered by mail: every line quoted.
  const quoted = mail
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  const [cv] = parseCvBlank(`Voilà mon CV\n${quoted}`);
  expect(cv?.prenom).toBe('Léa');
  expect(cv?.cv.daysPerYear).toBe('20');
  expect(cv?.cv.charterSkipper).toBe('Oui');
  expect(
    cv?.cv.trips?.map(({ waters, when, boat, nm }) => ({
      waters,
      when,
      boat,
      nm,
    })),
  ).toStrictEqual([
    { waters: 'mer', when: '2024', boat: 'Dufour 390', nm: '170' },
    {
      waters: 'lac',
      when: '2015 – aujourd’hui',
      boat: undefined,
      nm: undefined,
    },
  ]);
  expect(cv?.cv.certs?.map((cert) => cert.label)).toStrictEqual(['Permis mer']);
});

test('a CV received adds to the card, its answers kept where the card had some', () => {
  const merged = mergeCv(
    { daysPerYear: '15', trips: [{ id: 'a', waters: 'mer' }] },
    {
      daysPerYear: '20',
      owner: 'Non',
      trips: [{ id: 'b', waters: 'lac' }],
    },
  );
  expect(merged.daysPerYear).toBe('15');
  expect(merged.owner).toBe('Non');
  expect(merged.trips?.map((trip) => trip.id)).toStrictEqual(['a', 'b']);
});

test('a CV written out is read back the same', () => {
  const cv = {
    charterSkipper: 'Oui',
    place: 'Lausanne',
    trips: [
      {
        id: 'a',
        waters: 'lac' as const,
        when: '2017 – aujourd’hui',
        boat: 'Hanse 325',
        role: 'Skipper et second',
        nm: '930',
      },
    ],
    certs: [{ id: 'c', label: 'Permis lac', when: '2015' }],
  };
  const [back] = parseCvBlank(
    cvFilledText({ prenom: 'Léa', nom: 'Rochat' }, cv),
  );
  expect(back?.cv.charterSkipper).toBe('Oui');
  expect(back?.cv.place).toBe('Lausanne');
  expect(back?.cv.trips?.map(({ id: _id, ...rest }) => rest)).toStrictEqual([
    {
      waters: 'lac',
      when: '2017 – aujourd’hui',
      boat: 'Hanse 325',
      role: 'Skipper et second',
      nm: '930',
    },
  ]);
  expect(back?.cv.certs?.map((cert) => cert.label)).toStrictEqual([
    'Permis lac',
  ]);
});

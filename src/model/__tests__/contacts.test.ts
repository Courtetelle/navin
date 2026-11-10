import { expect, test } from 'vitest';

import { seaRescueAt, seaRescueContacts } from '../contacts.ts';

test('each French coast has its rescue centre', () => {
  expect(seaRescueAt({ lat: 46.15, lon: -1.2 })?.name).toBe('CROSS Étel'); // La Rochelle
  expect(seaRescueAt({ lat: 48.65, lon: -2.03 })?.name).toBe('CROSS Corsen'); // Saint-Malo
  expect(seaRescueAt({ lat: 43.28, lon: 5.33 })?.name).toBe(
    'CROSS Méditerranée (La Garde)',
  ); // Marseille
  expect(seaRescueAt({ lat: 41.92, lon: 8.73 })?.name).toBe(
    'CROSS Corse (Aspretto)',
  ); // Ajaccio
  expect(seaRescueAt({ lat: 49.64, lon: -1.62 })?.name).toBe('CROSS Jobourg'); // Cherbourg
  expect(seaRescueAt({ lat: 48.72, lon: -3.98 })?.name).toBe('CROSS Corsen'); // Roscoff
  expect(seaRescueAt({ lat: 49.49, lon: 0.1 })?.name).toBe('CROSS Jobourg'); // Le Havre
  expect(seaRescueAt({ lat: 50.96, lon: 1.85 })?.name).toBe('CROSS Gris-Nez'); // Calais
  expect(seaRescueAt({ lat: 37.9, lon: 23.7 })).toBeNull(); // Athens
});

test('the numbers of a coast start with the 196', () => {
  const etel = seaRescueAt({ lat: 46.15, lon: -1.2 });
  expect(etel && seaRescueContacts(etel).split('\n')).toStrictEqual([
    'Secours en mer (France, téléphone) : 196',
    'CROSS Étel : +33 2 97 55 35 35',
    'Appel de détresse : VHF 16, ASN canal 70',
    'Urgence (Europe) : 112',
  ]);
});

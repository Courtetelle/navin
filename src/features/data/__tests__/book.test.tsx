import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { FieldDefinition } from '../../../model/field.ts';
import type { Cruise } from '../../../model/types.ts';
import { state } from '../../../state/index.ts';
import { BlankPage, CrewListPage, SafetyPage } from '../book/BookPages.tsx';
import { DayPage } from '../book/DayPage.tsx';
import { kvRows } from '../book/kvRows.tsx';

import { load, useHarnessClock } from './fixtures.ts';

function seaCruise(): Cruise {
  load('sample-sea');
  const cruise = state.data.cruise.value;
  if (!cruise) throw new Error('no cruise');
  return cruise;
}

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test('kvRows prints the fields that have a value', () => {
  const fields: FieldDefinition[] = [
    { key: 'de', label: 'De', type: 'line' },
    { key: 'a', label: 'À', type: 'line' },
    { key: 'zero', label: 'Zéro', type: 'num' },
    { key: 'calc', type: 'calc', calc: 'nav' },
  ];

  expect(
    renderToStaticMarkup(
      <table>
        <tbody>{kvRows(fields, { de: 'Split', zero: 0, calc: 'x' })}</tbody>
      </table>,
    ),
  ).toBe(
    '<table><tbody><tr><th>De</th><td>Split</td></tr><tr><th>Zéro</th><td>0</td></tr></tbody></table>',
  );
});

test('the crew list numbers its lines', () => {
  const html = renderToStaticMarkup(<CrewListPage cruise={seaCruise()} />);

  expect(html).toContain('<h1>Liste d’équipage / Crew list</h1>');
  expect(html).toMatch(/<td>4<\/td><td>[^<]*<\/td><td>Invité sans fiche<\/td>/);
});

test('the safety page spells the call sign', () => {
  const html = renderToStaticMarkup(<SafetyPage cruise={seaCruise()} />);

  expect(html).toContain(
    '· Indicatif HB1234 (Hotel Bravo One Two Three Four) · MMSI 269000000</p>',
  );
});

test('a blank page has 16 empty lines', () => {
  const columns: FieldDefinition[] = [{ key: 'x', label: 'X', type: 'line' }];
  const html = renderToStaticMarkup(<BlankPage columns={columns} />);

  expect(html.match(/<tr><td><\/td><td><\/td><\/tr>/g)).toHaveLength(16);
});

test('a day page shows its route, its navigation and its computed blocks', () => {
  const cruise = seaCruise();
  const html = renderToStaticMarkup(
    <DayPage cruise={cruise} dayId="2026-07-14" columns={[]} />,
  );

  expect(html).toContain(
    '· de Split à Hvar · navigation 6 h 30 · 24,3 NM</h1>',
  );
  expect(html).toContain('<td>Heures relevées ce soir</td><td>1520,5 h</td>');
  expect(html).toContain('<th>= total effectué</th><th>24,3 NM</th>');
  expect(html).not.toContain('<button');
});

test('a day without journey has no navigation block', () => {
  const cruise = seaCruise();
  const html = renderToStaticMarkup(
    <DayPage cruise={cruise} dayId="2026-07-20" columns={[]} />,
  );

  expect(html).not.toContain('Durée de navigation');
  expect(html).not.toContain('class="hourly"');
  expect(html).toContain('<table class="sign">');
});

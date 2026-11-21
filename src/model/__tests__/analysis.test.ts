import { describe, expect, it } from 'vitest';

import {
  dispatchAnalysis,
  dispatchInputs,
  formatPosition,
  isOld,
  parseIndex,
  zoneIds,
} from '../analysis.ts';

const version = (id: string, at: string) => ({
  id,
  label: id,
  at,
  path: `z/${id}/index.html`,
  auto: true,
});

describe('analysis versions', () => {
  it('reads the list of versions and drops what is not one', () => {
    const index = parseIndex({
      updated: '2026-11-21T18:00+01:00',
      zones: {
        rolle: {
          nom: 'Rolle',
          versions: [version('2', '2026-11-21T18:00+01:00')],
        },
        'saint-quay': {
          nom: 'Saint-Quay',
          versions: [
            version('1', '2026-11-21T17:00+01:00'),
            { id: 'x', path: 'https://evil/x', label: 'x', at: 'x' },
          ],
        },
        'gps-48p700_m2p750': {
          versions: [version('3', '2026-11-21T19:00+01:00')],
        },
        empty: { versions: [] },
      },
    });
    expect(index?.zones['saint-quay']?.versions).toHaveLength(1);
    expect(index?.zones.empty).toBeUndefined();
    expect(zoneIds(index ?? { zones: {} })).toStrictEqual([
      'saint-quay',
      'rolle',
      'gps-48p700_m2p750',
    ]);
    expect(parseIndex('nope')).toBeNull();
  });

  it('says old after a day', () => {
    const v = version('1', '2026-11-20T10:00+01:00');
    expect(isOld(v, Date.parse('2026-11-21T09:00+01:00'))).toBe(false);
    expect(isOld(v, Date.parse('2026-11-21T11:00+01:00'))).toBe(true);
  });

  it('asks the workflow for a zone or a GPS point', async () => {
    expect(dispatchInputs('rolle')).toStrictEqual({
      zone: 'rolle',
      lat: '',
      lon: '',
    });
    expect(dispatchInputs({ lat: 48.71667, lon: -2.75 })).toStrictEqual({
      zone: '',
      lat: '48.7167',
      lon: '-2.7500',
    });
    const calls: string[] = [];
    const ok = (async (url: string, init: RequestInit) => {
      calls.push(`${url} ${typeof init.body === 'string' ? init.body : ''}`);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    expect(await dispatchAnalysis('t', { zone: 'rolle' }, ok)).toBeNull();
    expect(calls[0]).toContain('/actions/workflows/analyse.yml/dispatches');
    expect(calls[0]).toContain('"ref":"main"');
    const refused = (async () =>
      new Response(null, { status: 403 })) as unknown as typeof fetch;
    expect(await dispatchAnalysis('t', {}, refused)).toContain('refusée');
  });

  it('writes a position the way charts do', () => {
    expect(formatPosition(48.6521, -2.83063)).toBe("48°39,1' N 002°49,8' W");
  });
});

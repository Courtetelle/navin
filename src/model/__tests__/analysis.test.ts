import { describe, expect, it } from 'vitest';

import {
  checkGithubKey,
  dispatchAnalysis,
  dispatchInputs,
  formatPosition,
  isOld,
  parseIndex,
  shouldAsk,
  zoneForPoint,
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
      nom: '',
    });
    expect(
      dispatchInputs({ lat: 48.71667, lon: -2.75, nom: 'Saint-Quay' }),
    ).toStrictEqual({
      zone: '',
      lat: '48.7167',
      lon: '-2.7500',
      nom: 'Saint-Quay',
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

describe('analysis of the place of the zone or of the GPS', () => {
  const index = {
    zones: {
      'saint-quay': {
        nom: 'Saint-Quay-Portrieux',
        court: 'Saint-Quay',
        lat: 48.6521,
        lon: -2.83063,
        versions: [version('1', '2026-11-21T17:00+01:00')],
      },
    },
  };
  it('serves a point only from an analysis made within 5 km', () => {
    expect(zoneForPoint(index, 48.66, -2.8)).toBe('saint-quay');
    // The zone moved to Saint-Malo: no analysis there yet.
    expect(zoneForPoint(index, 48.6493, -2.0257)).toBeNull();
  });
  it('asks by itself when there is none or it is older than 6 h, not twice in 3 h', () => {
    const now = Date.parse('2026-11-21T20:00+01:00');
    expect(shouldAsk(null, 0, now)).toBe(true);
    expect(shouldAsk('2026-11-21T17:00+01:00', 0, now)).toBe(false);
    expect(shouldAsk('2026-11-21T13:00+01:00', 0, now)).toBe(true);
    expect(shouldAsk(null, now - 3_600_000, now)).toBe(false);
  });
});

const answer = (status: number, headers: Record<string, string> = {}) =>
  (async () =>
    new Response(null, { status, headers })) as unknown as typeof fetch;

describe('checkGithubKey', () => {
  it('accepts a key GitHub reads with, and gives its end', async () => {
    const check = await checkGithubKey(
      'k',
      answer(200, {
        'github-authentication-token-expiration': '2027-11-30 00:00:00 UTC',
      }),
    );
    expect(check).toEqual({ ok: true, end: Date.UTC(2027, 10, 30) });
  });
  it('refuses on 401, 403 or 404', async () => {
    for (const status of [401, 403, 404]) {
      // eslint-disable-next-line no-await-in-loop -- three short answers
      const check = await checkGithubKey('k', answer(status));
      expect(check.ok).toBe(false);
    }
  });
  it('says nothing without network', async () => {
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await checkGithubKey('k', down)).toEqual({ ok: null, end: null });
  });
});

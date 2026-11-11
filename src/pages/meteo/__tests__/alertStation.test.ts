import { expect, test } from 'vitest';

import type { LiveStation } from '../../../features/onwater/index.ts';
import { alertStation } from '../useLiveMap.ts';

function station(id: string, lat: number, lon: number): LiveStation {
  return {
    id,
    lat,
    lon,
    net: 'MeteoSwiss',
    name: id,
    avg: 10,
    km: 1,
  } as LiveStation;
}

test('the station of an alert is the one at its place', () => {
  const list = [station('PUY', 46.512, 6.667), station('LSN', 46.53, 6.62)];
  expect(alertStation(list, 46.5121, 6.6671)?.id).toBe('PUY');
  expect(alertStation(list, 46.6, 6.9)).toBeUndefined();
});

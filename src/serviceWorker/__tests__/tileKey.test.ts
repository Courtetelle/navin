import { expect, test } from 'vitest';

import { tileKey } from '../tileKey.ts';

test('Vaud WMS tiles get a key independent of parameter order and decimals', () => {
  const first = new URL(
    'https://ogc.vd.ch/wms?SERVICE=WMS&REQUEST=GetMap&BBOX=2500000.4,1150000.6,2501000,1151000&WIDTH=256',
  );
  const second = new URL(
    'https://ogc.vd.ch/wms?width=256&bbox=2500000.2,1150001.1,2501000.3,1151000&request=GetMap&service=WMS',
  );
  expect(tileKey(first, 'r1')).toBe(
    'https://ogc.vd.ch/wms?bbox=2500000%2C1150001%2C2501000%2C1151000&request=GetMap&service=WMS&width=256',
  );
  expect(tileKey(second, 'r2')).toBe(tileKey(first, 'r1'));
});

test('other tiles keep their request as key', () => {
  const url = new URL('https://tiles.openseamap.org/seamark/10/530/362.png');
  expect(tileKey(url, 'request')).toBe('request');
});

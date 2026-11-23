import { describe, expect, it } from 'vitest';

import { shomStateOf } from '../shomSub.ts';

describe('shomStateOf', () => {
  it('runs up to its last day included, then Copernicus again', () => {
    const until = '2027-06-30';
    expect(shomStateOf('', until).kind).toBe('none');
    expect(shomStateOf('abc', '').kind).toBe('no-date');
    const lastEvening = new Date('2027-06-30T22:00:00').getTime();
    const nextMorning = new Date('2027-07-01T08:00:00').getTime();
    expect(shomStateOf('abc', until, lastEvening)).toStrictEqual({
      kind: 'active',
      key: 'abc',
      until,
    });
    expect(shomStateOf('abc', until, nextMorning).kind).toBe('ended');
  });
});

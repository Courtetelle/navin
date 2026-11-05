import { expect, test } from 'vitest';

import { foldKey } from '../folds.ts';
import { parseStyle, reactPropName } from '../markupToReact.ts';
import { masterState } from '../masterState.ts';
import { localText, utcText } from '../timeText.ts';
import { ease } from '../useMarquee.ts';

test('the master checkbox shows all, part or nothing', () => {
  expect(masterState(3, 3)).toBe('on');
  expect(masterState(1, 3)).toBe('part');
  expect(masterState(0, 3)).toBe('');
});

test('times are written in UTC or local time, with optional seconds', () => {
  const date = new Date(Date.UTC(2026, 6, 15, 8, 5, 9));
  expect(utcText(date, false)).toBe('08:05');
  expect(utcText(date, true)).toBe('08:05:09');
  expect(localText(date, false)).toBe(
    `${String(date.getHours()).padStart(2, '0')}:05`,
  );
});

test('a fold key is the view and the first 60 characters of the title', () => {
  expect(foldKey('boats', '  Moteur ')).toBe('boats|Moteur');
  expect(foldKey('info', 'x'.repeat(70))).toBe(`info|${'x'.repeat(60)}`);
});

test('markup attributes become React props', () => {
  expect(reactPropName('class')).toBe('className');
  expect(reactPropName('stroke-width')).toBe('strokeWidth');
  expect(reactPropName('textLength')).toBe('textLength');
  expect(reactPropName('aria-hidden')).toBe('aria-hidden');
  expect(reactPropName('xlink:href')).toBe('xlinkHref');
  expect(parseStyle('text-align:center; --ue-shift: -3px')).toStrictEqual({
    textAlign: 'center',
    '--ue-shift': '-3px',
  });
});

test('the long text scroll eases in and out', () => {
  expect(ease(0)).toBe(0);
  expect(ease(0.25)).toBe(0.125);
  expect(ease(0.5)).toBe(0.5);
  expect(ease(1)).toBe(1);
});

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { PIN_DRAWING, PIN_SVG, pinSvg } from '../tabIcons.ts';

const SRC = join(import.meta.dirname, '..', '..', '..');

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The body of the pin: one path that only its drawing has. */
const PIN_BODY = 'M13 3h14v3.5';

test('the drawing pin is drawn in one place only', () => {
  const drawn = sources(SRC).filter((path) =>
    readFileSync(path, 'utf8').includes(PIN_BODY),
  );
  expect(drawn.map((path) => path.slice(SRC.length + 1))).toStrictEqual([
    join('shell', 'topbar', 'tabIcons.ts'),
  ]);
});

test('every pin of the app uses that drawing', () => {
  expect(PIN_SVG).toContain(PIN_DRAWING);
  expect(pinSvg('x')).toContain(PIN_DRAWING);
  for (const file of [
    join('pages', 'tracker', 'railIcons.tsx'),
    join('features', 'map', 'tapCross.ts'),
    join('features', 'map', 'marksDraw.ts'),
  ]) {
    expect(readFileSync(join(SRC, file), 'utf8'), file).toContain('pinSvg(');
  }
});

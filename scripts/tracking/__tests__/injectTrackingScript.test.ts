import { expect, test } from 'vitest';

import { injectTrackingScript } from '../injectTrackingScript.ts';

const page = '<html><head><title>NavIn</title></head><body></body></html>';
const snippet =
  '<script defer src="https://datami.cheminfo.org/script.js" data-website-id="00000000-0000-0000-0000-000000000000"></script>';

test('places the snippet right before </head>', () => {
  expect(injectTrackingScript(page, snippet)).toBe(
    `<html><head><title>NavIn</title>${snippet}\n</head><body></body></html>`,
  );
});

test('leaves the page unchanged when the snippet is unset or blank', () => {
  expect(injectTrackingScript(page)).toBe(page);
  expect(injectTrackingScript(page, ' '.repeat(3))).toBe(page);
});

test('takes the snippet verbatim, trimmed of surrounding whitespace', () => {
  expect(injectTrackingScript(page, `  ${snippet}\n`)).toContain(
    `${snippet}\n</head>`,
  );
});

test('never adds the snippet twice', () => {
  const once = injectTrackingScript(page, snippet);
  expect(injectTrackingScript(once, snippet)).toBe(once);
});

test('appends the snippet to a page without a head', () => {
  expect(injectTrackingScript('<p>x</p>', snippet)).toBe(
    `<p>x</p>\n${snippet}\n`,
  );
});

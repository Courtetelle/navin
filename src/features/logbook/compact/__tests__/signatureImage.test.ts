import { expect, test } from 'vitest';

import { signatureCrop } from '../signatureImage.ts';

test('the crop keeps a 24 px margin around the strokes', () => {
  const crop = signatureCrop(
    [
      [
        [0.25, 0.25],
        [0.5, 0.5],
      ],
    ],
    400,
    200,
  );
  expect(crop).toStrictEqual({ x0: 76, y0: 26, x1: 224, y1: 124, scale: 1 });
});

test('the crop stays in the image and at most 900 px wide', () => {
  const crop = signatureCrop(
    [
      [
        [0, 0],
        [1, 1],
      ],
    ],
    1800,
    600,
  );
  expect(crop).toStrictEqual({ x0: 0, y0: 0, x1: 1800, y1: 600, scale: 0.5 });
});

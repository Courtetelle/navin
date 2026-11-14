import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { CardsPen } from '../cardsPen.ts';
import { layOutCard } from '../cardsPng.ts';
import type { LoadedPhoto, LoadedSection } from '../cardsTypes.ts';
import type { LxTheme } from '../types.ts';

interface Written {
  text: string;
  x: number;
  y: number;
  font: string;
}

/**
 * A 2D context that records the written texts; a letter is 10 px wide.
 * @returns The context and the texts.
 */
function fakeContext() {
  const written: Written[] = [];
  const context = {
    font: '',
    fillStyle: '',
    textAlign: 'left',
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText(text: string, x: number, y: number) {
      written.push({ text, x, y, font: context.font });
    },
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  };
  return { context: context as unknown as CanvasRenderingContext2D, written };
}

/**
 * Lay out a card, measuring then drawing.
 * @param theme - Layout.
 * @param sections - Sections.
 * @param photos - Full-width pictures.
 * @returns The height of both passes and the written texts.
 */
function draw(
  theme: LxTheme,
  sections: LoadedSection[],
  photos: LoadedPhoto[] = [],
) {
  const { context, written } = fakeContext();
  const pen = new CardsPen(context, theme, null);
  const sheet = { title: 'Mistral', sub: 'Fiche bateau', kicker: 'Fiche' };
  const measured = layOutCard(pen, sheet, sections, photos);
  pen.drawing = true;
  const drawn = layOutCard(pen, sheet, sections, photos);
  return { measured, drawn, written };
}

const ROWS: LoadedSection = {
  title: 'Moteur',
  rows: [
    { label: 'Puissance', value: '30 cv', photos: [] },
    { label: 'Type', value: 'Diesel', photos: [] },
    { label: 'Marque', value: 'Volvo', photos: [] },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 15, 10, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

test('the measuring pass writes nothing and gives the same height', () => {
  const { context, written } = fakeContext();
  const pen = new CardsPen(context, 'cards', null);
  const sheet = { title: 'Mistral' };
  const measured = layOutCard(pen, sheet, [ROWS], []);
  expect(written).toStrictEqual([]);
  pen.drawing = true;
  expect(layOutCard(pen, sheet, [ROWS], [])).toBe(measured);
});

test('cards layout: header, one card, footer', () => {
  const { drawn, written } = draw('cards', [ROWS]);
  expect(drawn).toBe(706);
  const whole = written.filter((item) => item.text.length > 1);
  expect(whole.map(({ text, x, y }) => [text, x, y])).toStrictEqual([
    ['⛵ NavIn', 40, 52],
    ['Mistral', 40, 116],
    ['Fiche bateau', 40, 163],
    ['PUISSANCE', 76, 376],
    ['30 cv', 416, 381],
    ['TYPE', 76, 443],
    ['Diesel', 416, 448],
    ['MARQUE', 76, 510],
    ['Volvo', 416, 515],
    ['NavIn · 15/07/2026', 540, 650],
  ]);
});

test('carnet layout keeps the case of the labels', () => {
  const { drawn, written } = draw('carnet', [ROWS]);
  expect(drawn).toBe(655);
  const texts = written.map((item) => item.text);
  expect(texts).toContain('Puissance');
  expect(texts).not.toContain('PUISSANCE');
});

test('mini layout sets the cells on two columns', () => {
  const { drawn, written } = draw('mini', [ROWS]);
  expect(drawn).toBe(647);
  const label = (text: string) => written.find((item) => item.text === text);
  expect(label('PUISSANCE')?.x).toBe(64);
  expect(label('TYPE')?.x).toBe(564);
  expect(label('MARQUE')?.x).toBe(64);
  expect(label('MARQUE')?.y).toBeGreaterThan(label('TYPE')?.y ?? 0);
});

test('a long value wraps and pushes the next line down', () => {
  const value = 'mot '.repeat(40).trim();
  const section: LoadedSection = {
    title: '',
    rows: [
      { label: 'Long', value, photos: [] },
      { label: 'Après', value: 'x', photos: [] },
    ],
  };
  const { written } = draw('cards', [section]);
  const wrapped = written.filter((item) => item.text.startsWith('mot'));
  expect(wrapped.map((item) => item.text.length)).toStrictEqual([55, 55, 47]);
  const after = written.find((item) => item.text === 'APRÈS');
  expect(after?.y).toBe(473);
});

test('a line break in a value starts a new line', () => {
  const section: LoadedSection = {
    title: 'Notes',
    rows: [{ label: 'Actions', value: 'un\ndeux', photos: [] }],
  };
  const { written } = draw('cards', [section]);
  const un = written.find((item) => item.text === 'un');
  const deux = written.find((item) => item.text === 'deux');
  expect((deux?.y ?? 0) - (un?.y ?? 0)).toBeCloseTo(40.96, 6);
});

test('full-width pictures add a block with its title', () => {
  const image = { naturalWidth: 1600, naturalHeight: 900 } as HTMLImageElement;
  const { drawn, written } = draw('cards', [], [{ image, caption: '' }]);
  expect(drawn).toBe(1067);
  expect(written.map((item) => item.text).join('')).toContain('PHOTOS');
});

import { describe, expect, it } from 'vitest';

import { ageText, compassPoint, mfTallyText, windColors } from '../liveText.ts';

describe('live weather texts', () => {
  it('names the compass point of a wind', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(225)).toBe('SO');
    expect(compassPoint(270)).toBe('O');
    expect(compassPoint(-90)).toBe('O');
  });

  it('says how old a measurement is', () => {
    expect(ageText(1000, 20_000)).toBe('à l’instant');
    expect(ageText(0, 7 * 60_000)).toBe('il y a 7 min');
  });

  it('colours a calm wind apart from the alerts', () => {
    expect(windColors(5).color).toBe('#9ec9e8');
    expect(windColors(12).color).toBe('#7ed957');
  });
});

describe('mfTallyText', () => {
  it('explains what Météo-France answered', () => {
    expect(
      mfTallyText(
        { near: 0, read: 0, wind: 0, noWind: 0, refused: {}, failed: 0 },
        30,
      ),
    ).toBe('Météo-France : aucune station à moins de 30 km');
    const text = mfTallyText(
      {
        near: 30,
        read: 25,
        wind: 4,
        noWind: 18,
        refused: { 429: 3 },
        failed: 0,
      },
      30,
    );
    expect(text).toContain('4 avec vent');
    expect(text).toContain('25 plus proches lues');
    expect(text).toContain('trop de demandes (429)');
  });
});

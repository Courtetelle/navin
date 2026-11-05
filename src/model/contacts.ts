/** Default useful numbers of a sea cruise (legacy `DEFAULT_CONTACTS`). */
export const DEFAULT_CONTACTS = [
  'Urgence (Europe) : 112',
  'Appel de sécurité : VHF 16, ASN canal 70',
  'CCMM consultation médicale : +33 5 34 39 33 33',
  'CCMM eaux internationales : +33 3 21 87 21 87',
].join('\n');

/** Default useful numbers of a Swiss lake outing (legacy `LAKE_CONTACTS`). */
export const LAKE_CONTACTS = [
  'Urgence (Europe) : 112',
  'Police, sauvetage sur le lac (Suisse) : 117',
  'Ambulance (Suisse) : 144',
  'Rega, sauvetage aérien : 1414',
  'Tox Info Suisse : 145',
].join('\n');

/** Useful numbers on the French side of Lake Geneva (legacy `LEMAN_FR_CONTACTS`). */
export const LEMAN_FR_CONTACTS = [
  'Urgence (Europe) : 112',
  'Pompiers, secours sur le lac (France) : 18',
  'Gendarmerie, brigade nautique (France) : 17',
  'SAMU (France) : 15',
  'Urgence par SMS (France) : 114',
].join('\n');

/** Approximate border in the middle of Lake Geneva, Hermance to St-Gingolph: `[lon, lat]`. */
export const LEMAN_BORDER: ReadonlyArray<readonly [number, number]> = [
  [6.24, 46.302],
  [6.3, 46.372],
  [6.42, 46.42],
  [6.6, 46.455],
  [6.72, 46.45],
  [6.806, 46.392],
];

/**
 * The position is on the French half of Lake Geneva (legacy `inFrenchLeman`).
 * @param position - Position `{ lat, lon }`.
 * @returns `true` south of the border line.
 */
export function inFrenchLeman(
  position: { lat?: number | null; lon?: number | null } | null | undefined,
): boolean {
  if (position?.lat == null || position.lon == null) return false;
  const { lat, lon } = position;
  if (lat < 46.2 || lat > 46.6) return false;
  const first = LEMAN_BORDER[0] as readonly [number, number];
  const last = LEMAN_BORDER.at(-1) as readonly [number, number];
  if (lon < first[0] || lon > last[0]) return false;
  for (let point = 1; point < LEMAN_BORDER.length; point++) {
    const [x0, y0] = LEMAN_BORDER[point - 1] as readonly [number, number];
    const [x1, y1] = LEMAN_BORDER[point] as readonly [number, number];
    if (lon <= x1) return lat < y0 + ((lon - x0) / (x1 - x0)) * (y1 - y0);
  }
  return false;
}

/** Inland lake boxes `[latMin, latMax, lonMin, lonMax]`; elsewhere is the sea. */
export const INLAND: ReadonlyArray<readonly [number, number, number, number]> =
  [
    [45.75, 47.9, 5.85, 10.6],
    [45.4, 46.05, 5.6, 6.5],
    [45.4, 46.25, 8.4, 9.4],
    [45.5, 45.95, 10.45, 10.95],
    [47.4, 47.9, 8.9, 9.85],
  ];

/**
 * The position is on an inland lake (legacy `inInland`).
 * @param position - Position.
 * @returns `true` inside one of the {@link INLAND} boxes.
 */
export function inInland(
  position: { lat: number; lon: number } | null | undefined,
): boolean {
  if (!position) return false;
  for (const [latMin, latMax, lonMin, lonMax] of INLAND) {
    if (
      position.lat > latMin &&
      position.lat < latMax &&
      position.lon > lonMin &&
      position.lon < lonMax
    ) {
      return true;
    }
  }
  return false;
}

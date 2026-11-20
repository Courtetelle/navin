/** The analysis from the hemisphere down to the bay, kept in NavIn for offline. */
export const ANALYSIS = {
  /** Where it is about. */
  place: 'Saint-Quay-Portrieux',
  /** When it was written, Paris time. */
  at: '2026-11-20T23:00',
  /** The model runs it reads. */
  runs: 'ECMWF IFS 20/11 06 UTC, DWD ICON-EU et EWAM 20/11 12 UTC, Copernicus IBI 20/11',
  /** The copy kept with NavIn. */
  offline: 'analyse/saint-quay/index.html',
  /** The version kept up to date, online. */
  online: 'https://claude.ai/artifact/396CrWuSXA8FaX36D2Y7LA',
} as const;

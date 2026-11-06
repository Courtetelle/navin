/** Identifies the published build; it changes at every publication. */
export const BUILD_ID: string =
  (import.meta.env.VITE_BUILD_ID as string | undefined) ?? 'dev';

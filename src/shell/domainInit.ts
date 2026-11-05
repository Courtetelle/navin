import { noteError } from '../storage/errLog.ts';

import { errorContext } from './errorContext.ts';

const inits = import.meta.glob('../features/*/init.ts');

/**
 * Load every `src/features/<domain>/init.ts` before the first screen: each
 * domain registers there its boot hooks, top menu actions and navigation
 * listeners (the legacy scripts all ran before `boot`). They load one by one
 * in isolation: a domain that fails is recorded in `ldb.errLog` and the app
 * starts without it.
 * @returns The domains that loaded.
 */
export async function loadDomains(): Promise<string[]> {
  const paths = Object.keys(inits);
  const results = await Promise.allSettled(
    Object.values(inits).map((load) => load()),
  );
  const loaded: string[] = [];
  for (const [index, result] of results.entries()) {
    const path = paths[index] ?? '';
    if (result.status === 'fulfilled') {
      loaded.push(path.split('/').at(-2) ?? path);
    } else {
      noteError(String(result.reason), path, errorContext);
    }
  }
  return loaded;
}

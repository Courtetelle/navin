/**
 * The cached app files that the current build no longer lists. Their names
 * carry a hash, so each deployment would otherwise leave its files on the phone.
 * @param cached - Requests held in the app cache.
 * @param files - Files of the current build, relative to `base`.
 * @param base - URL the file names are relative to.
 * @returns The requests to delete.
 */
export function staleFiles(
  cached: readonly Request[],
  files: readonly string[],
  base: string,
): Request[] {
  const current = new Set(files.map((file) => new URL(file, base).href));
  return cached.filter((request) => !current.has(request.url));
}

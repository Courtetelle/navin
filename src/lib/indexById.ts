/**
 * Index a list by id for lookups in a loop; like `find`, the first item wins
 * when an id is repeated.
 * @param items - The list.
 * @returns The items by id.
 */
export function indexById<T extends { id: string }>(
  items: readonly T[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return byId;
}

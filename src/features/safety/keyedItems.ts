/** A list item with a React key. */
export interface KeyedItem<T> {
  key: string;
  item: T;
  /** Position in the list. */
  index: number;
}

/**
 * Give the items of a list without ids a stable React key: their content and,
 * for repeated content, the occurrence.
 * @param items - The items.
 * @param nameOf - Content that names an item.
 * @returns The items with their keys, in order.
 */
export function keyedItems<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
): Array<KeyedItem<T>> {
  const seen = new Map<string, number>();
  const keyed: Array<KeyedItem<T>> = [];
  for (const [index, item] of items.entries()) {
    const name = nameOf(item);
    const occurrence = seen.get(name) ?? 0;
    seen.set(name, occurrence + 1);
    keyed.push({ key: `${name}#${occurrence}`, item, index });
  }
  return keyed;
}

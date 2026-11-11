/** A list item with its React key. */
interface Keyed<T> {
  key: string;
  item: T;
}

/**
 * Give list items a React key when their text may repeat: a repeated key gets
 * a suffix.
 * @param items - List.
 * @param keyOf - Key of an item.
 * @returns The items with unique keys.
 */
export function withKeys<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Array<Keyed<T>> {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: count ? `${base}#${count}` : base, item };
  });
}

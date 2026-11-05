import { keyedItems } from './keyedItems.ts';
import type { ScriptLine } from './sosScripts.ts';

/** Props of {@link ScriptLines}. */
export interface ScriptLinesProps {
  /** Lines of a message; `null` lines are skipped. */
  lines: readonly ScriptLine[];
}

/**
 * The lines of a radio message: English, then the French in small.
 * @param props - The lines.
 * @returns The paragraphs.
 */
export function ScriptLines({ lines }: ScriptLinesProps) {
  return keyedItems(lines, (line) => line?.[0] ?? '').map(({ key, item }) =>
    item ? (
      <p key={key}>
        {item[0]}
        {item[1] ? <small>{item[1]}</small> : null}
      </p>
    ) : null,
  );
}

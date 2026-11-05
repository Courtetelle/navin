import { AboardFlow } from '../../features/onwater/aboard/AboardFlow.tsx';
import type { PageProps } from '../../shell/pageTypes.ts';

/**
 * Screen `aboard`: the task rotation of a cruise (legacy `VIEWS.aboard`).
 * @param props - `arg === 'edit'` opens the template.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function AboardPage({ arg }: PageProps) {
  return <AboardFlow initial={arg === 'edit' ? 'edit' : 'plan'} />;
}

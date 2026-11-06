import { CrewScreenHost } from '../../features/crew/index.ts';

/**
 * Screen `crews` (legacy `VIEWS.crews`, prep.js:770): the crew compositions.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function CrewsPage() {
  return <CrewScreenHost />;
}

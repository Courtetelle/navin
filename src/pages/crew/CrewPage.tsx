import { CrewPick } from '../../features/crew/index.ts';

/**
 * Screen `crew` (legacy `VIEWS.crew`): the members chosen for the open
 * navigation, or the list of the cards without one. The crew domain resets its
 * sub-screen on every `go`.
 * @returns The screen.
 */
export function CrewPage() {
  return <CrewPick />;
}

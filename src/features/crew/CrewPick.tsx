import { CrewScreenHost } from './CrewScreenHost.tsx';

/**
 * Content of the `crew` screen (legacy `VIEWS.crew`, `renderCrewPick`): who is on
 * board, or the card list without a cruise, and the cards opened from there.
 * The entry itself is run by the `go` listener of `init.ts`.
 * @returns The screen.
 */
export function CrewPick() {
  return <CrewScreenHost />;
}

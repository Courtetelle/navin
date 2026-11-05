import { CrewScreenHost } from './CrewScreenHost.tsx';

/**
 * List of the member cards and the cards opened from it (legacy
 * `renderFicheList`). The entry itself is run by the `go` listener of `init.ts`.
 * @returns The screen.
 */
export function FicheList() {
  return <CrewScreenHost />;
}

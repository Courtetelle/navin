import { FicheList } from '../../features/crew/index.ts';

/**
 * Screen `people` (legacy `VIEWS.people`, prep.js:867): the member cards.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function PeoplePage() {
  return <FicheList />;
}

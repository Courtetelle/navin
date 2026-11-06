/**
 * Public API of the prep domain (legacy prep.js 1-766, 1195-1284).
 *
 * | legacy                  | export                                                     |
 * | ----------------------- | ---------------------------------------------------------- |
 * | `quickStart()`          | {@link quickStart}                                         |
 * | `prepStart()`           | {@link prepStart}                                          |
 * | `prepBarSync(view)`     | {@link prepBarSync} (runs on every `go`, see `init.ts`)    |
 * | `prepTrail()`           | {@link PrepTrail} (renders nothing, as legacy)             |
 * | `moorNow()`             | {@link moorNow}                                            |
 * | `navPageRefresh()`      | {@link navPageRefresh} (no-op: `#navLive` no longer exists)|
 * | `deleteTrace(id)`       | {@link deleteTrace}                                        |
 * | `bindSwipeDelete`       | {@link SwipeRow}: render prop, handlers on the sliding row |
 *
 * `prep`, `prepUse`, `prepPaths`, `noteUse`, `byUse`, `crewSets`, `crewSig`,
 * `saveCrewSets`, `crewSetDate`, `crewSetName`, `memberLocks`, `memberLockMsg`
 * come from `src/state/index.ts`.
 */
export { deleteTrace } from './deleteTrace.ts';
export { moorNow } from './moor.ts';
export { navPageRefresh } from './navPage.ts';
export { prepBarSync } from './prepBarSync.ts';
export { prepStart } from './prepFlow.ts';
export { PrepTrail } from './PrepTrail.tsx';
export { quickStart } from './quickStart.ts';
export type { SwipeHandlers, SwipeRowProps } from './swipe/SwipeRow.tsx';
export { SwipeRow } from './swipe/SwipeRow.tsx';

/**
 * Public API of the crew domain (legacy lake.js 1684-2305, prep.js 767-868).
 *
 * | legacy                      | export                                              |
 * | --------------------------- | --------------------------------------------------- |
 * | `VIEWS.crew`, `renderCrewPick()` | {@link CrewPick}: whole content of the `crew` screen |
 * | `renderFicheList()`         | {@link FicheList}: same, opening on the card list   |
 * | `renderFiche(id)`           | {@link Fiche}                                       |
 * | `memberAvatar(m, size)`     | {@link memberAvatar}                                |
 * | `blankSend()`               | {@link blankSend}                                   |
 * | `blankPdf()`                | {@link blankPdf}                                    |
 * | `blankImport(text)`         | {@link blankImport}                                 |
 * | `crewsEdit = {…}; go('crews')` (nav.js:1285) | {@link openCrewSet}                |
 *
 * `members`, `saveMembers`, `memberName`, `mergeMembers`, `crewFromMember`,
 * `memberFieldsX`, `crewFiche`, `crewFicheBack`, `crewsEdit`, `ficheFromData`
 * come from `src/state/index.ts`; `LAKE_ROLES`, `SEA_ROLES`, `roleLabel`,
 * `MEMBER_FIELDS` from `src/model/crewFields.ts`.
 *
 * Legacy swapped these sub-screens inside `#view` without `go`: `CrewPick`,
 * `FicheList` and `CrewScreenHost` are the same host of those sub-screens, so a
 * page renders only one of them; the entry of `people`, `crew` and `crews` is
 * run by the `go` listener of `init.ts`.
 */
export { memberAvatar } from './avatar.ts';
export { blankPdf } from './blankPdf.tsx';
export { blankImport, blankSend } from './blankSheet.ts';
export { CrewPick } from './CrewPick.tsx';
export { CrewScreenHost } from './CrewScreenHost.tsx';
export { openCrewSet } from './crewsEdit.ts';
export { Fiche } from './Fiche.tsx';
export type { FicheProps } from './Fiche.tsx';
export { FicheList } from './FicheList.tsx';

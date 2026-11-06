/**
 * Public API of the safety domain (SOS, man overboard, VHF, scales, alphabet).
 *
 * | Legacy name          | Export                                                     |
 * | -------------------- | ---------------------------------------------------------- |
 * | `sosPos`             | `state.view.sosPos` (src/state)                            |
 * | `navZone`            | `navZone` (src/state, re-exported)                         |
 * | `lastKnownPos`       | `lastKnownPos` (src/state, re-exported)                    |
 * | `PHONE_RE`, `telOf`  | `PHONE_RE`, `telOf` (src/lib/phone.ts, re-exported)        |
 * | `mobLogs`            | `mobLogs` (src/state, re-exported)                         |
 * | `saveMobLogs`        | `saveMobLogs` (src/state, re-exported)                     |
 * | `hms`                | `hms` (src/lib/format.ts, re-exported)                     |
 * | `sosLogs`            | `state.data.sosLogs` (src/state)                           |
 * | `sosLogActive`       | `sosLogActive` (src/state, re-exported)                    |
 * | `sosLogsCount`       | `sosLogsCount` (src/state, re-exported)                    |
 * | `sosLogAdd`          | `sosLogAdd` (src/state, re-exported)                       |
 * | `sosLogText`         | `sosLogText` (src/state, re-exported)                      |
 * | `sosLogStart`        | `sosLogStart(what)`                                        |
 * | `sosEndBtnHtml`      | `<SosEndButton />`                                         |
 * | `sosSim`             | `state.view.sosSim` (src/state)                            |
 * | `sosLive`            | `state.view.sosLive` (src/state)                           |
 * | `sosPosBlock`        | `<SosPosBlock />`                                          |
 * | `sosLogBanner`       | `<SosLogBanner />`                                         |
 * | `sosExStart`         | `sosExStart(kind)` (settings: `data-sosex` buttons)        |
 * | `sosExEnd`           | `sosExEnd()`                                               |
 * | `sosExOn`            | `sosExOn()`                                                |
 * | `window.sosSimStart` | `sosSimStart(kind)`                                        |
 * | `[data-sossim]`      | `sosSimToggle(kind)` (settings: `data-sossim` buttons)     |
 * | `NATO`, `spell`      | `NATO`, `spell(text)`, `spellDigits(text)`                 |
 * | `sosContext`         | `sosContext(source, nature)` (pure, `ScriptSource`)        |
 * | `SOS`, `VOCAB`       | `SOS`, `SOS_KINDS`, `VOCAB`, type `SosProcedure`           |
 *
 * The settings screen may simply render `data-sosex="ch|fr|mer"` and
 * `data-sossim="ch|fr|mer"` on its buttons: the document listeners of this
 * domain handle them, as legacy did.
 */
export { hms } from '../../lib/format.ts';
export { PHONE_RE, telOf } from '../../lib/phone.ts';
export {
  lastKnownPos,
  mobLogs,
  navZone,
  saveMobLogs,
  sosLogActive,
  sosLogAdd,
  sosLogText,
  sosLogsCount,
} from '../../state/index.ts';
export { SosEndButton } from './SosEndButton.tsx';
export { SosLogBanner } from './SosLogBanner.tsx';
export { SosPosBlock } from './SosPosBlock.tsx';
export { NATO, spell, spellDigits } from './nato.ts';
export type { ScriptSource } from './sosContext.ts';
export { sosContext } from './sosContext.ts';
export { sosLogStart } from './sosLogStart.ts';
export type {
  ScriptContext,
  ScriptLine,
  SosKind,
  SosNature,
  SosProcedure,
} from './sosScripts.ts';
export { SOS, SOS_KINDS, VOCAB } from './sosScripts.ts';
export {
  sosExEnd,
  sosExOn,
  sosExStart,
  sosSimStart,
  sosSimToggle,
} from './sosExercise.ts';

/**
 * Public API of the checklists domain (legacy lake.js 1-999).
 *
 * | Legacy                                   | Here                                                    |
 * | ---------------------------------------- | ------------------------------------------------------- |
 * | `checklistOwner(boatId)`                 | `checklistOwner(boatId?)`: reads, never seeds           |
 * | seeding part of `checklistOwner`         | `ensureChecklistOwner(boatId?)`: run by `init.ts`       |
 * | `ckDefs`, `ckProp`, `ckName`, `ckCats`   | same names                                              |
 * | `checkItems`, `checkLeft`, `checkDone`   | same names                                              |
 * | `ckCurrent`, `checklistSub`, `ckOpen`    | same names                                              |
 * | `ckVal`, `ckLabelVal`, `obsOwner`        | same names                                              |
 * | `relevesSummary`                         | same name                                               |
 * | `renderCheckBanner` + `#checkBanner`     | `<CheckBanner />`: renders the `#checkBanner` div       |
 *
 * The selectors read the state: inside a component they follow it when the
 * component called `useSignals()`.
 *
 * From the foundation, not from here: `LAKE_CONTACTS`, `LEMAN_FR_CONTACTS`,
 * `inFrenchLeman` (`model/contacts.ts`), `boatSub` (`model/boatSheet.ts`),
 * `constatKey` (`model/views.ts`), `MODES`, `modeOf` (`model/modes.ts`), and
 * `constatTitle`, `curMode`, `mergeCkLib`, `infoSections`, `saveBoats`,
 * `boatById`, `mergeBoats`, `blankOuting`, `syncBoatFromCruise`,
 * `pullBoatIntoCruise` (`state/index.ts`).
 */
export { CheckBanner } from './CheckBanner.tsx';
export type {
  ChecklistFields,
  ChecklistListMeta,
  ChecklistOwnerRecord,
} from './checklistOwner.ts';
export {
  checklistOwner,
  ckCats,
  ckDefs,
  ckName,
  ckProp,
  ownerBoatId,
} from './checklistOwner.ts';
export {
  checkDone,
  checkItems,
  checkLeft,
  checklistSub,
  ckCurrent,
  ckLabelVal,
  ckOpen,
  ckVal,
  obsOwner,
  relevesSummary,
} from './checklistProgress.ts';
export { ensureChecklistOwner } from './ownerUpdates.ts';

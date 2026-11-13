/**
 * Public API of the boats domain (legacy lake.js 1000-1434, 3376-3640).
 *
 * | legacy                         | export                                                         |
 * | ------------------------------ | -------------------------------------------------------------- |
 * | `boatThumb(b, w, h)`           | {@link boatThumb}                                              |
 * | `membersByNav()`               | {@link membersByNav}                                           |
 * | `boatsByNav(purpose)`          | {@link boatsByNav}                                             |
 * | `cruiseRealAt(m, c)`           | {@link cruiseRealAt}                                           |
 * | `outingTimes(k)`               | {@link outingTimes} (`key, cruise?`, for `lakeDays`)           |
 * | `navDur(k)`, `hasTrace(k)`     | {@link navDur} (`key, cruise?`), {@link hasTrace}              |
 * | `rentalPrice(t, tarifs)`       | {@link rentalPrice}                                            |
 * | `autoFillLakeDay(k)`           | {@link autoFillLakeDay}: writes, never call it during a render |
 * | `sheetData(k)`                 | {@link sheetData}: writes; {@link buildSheetData} does not     |
 * | `pickSheet(sd, k)`             | {@link pickSheet}                                              |
 * | `sheetHtml(sd)`                | `<LakeSheet sheet />`                                          |
 * | `sheetPng(sd)`                 | {@link sheetPng}                                               |
 * | `boatInfoRows(b)`              | {@link boatInfoRows}                                           |
 * | `printBoatDossier(b)`          | {@link printBoatDossier}                                       |
 * | `shareBoatDossier(b, btn)`     | {@link shareBoatDossier} (`boat`; the caller holds `disabled`) |
 * | `boatDocPhotos()`              | {@link boatDocPhotos}                                          |
 * | `prepReportHtml(th, withPh)`   | `<PrepReport document theme />`, built by {@link prepReportDocument} |
 * | `prepReportCache()`            | {@link prepReportCache}                                        |
 * | `window._prepHtml` (printBook) | `<CachedPrepReportPage />`: page `prep` of the log book        |
 * | `prepPublishDialog()`          | {@link prepPublishDialog}: opens the window on `<body>`        |
 * | `prepReportShare`, `prepReportPrint` | {@link prepReportShare}, {@link prepReportPrint}         |
 * | `boatVersBtn`, `renderBoatVersions` | `<BoatVersionsButton />`, `<BoatVersions />`              |
 * | `LAKE_DAY_SECTIONS`            | `src/model/lakeDaySections.ts`                                 |
 *
 * Printing a lake day from `printBook`: render `<LakeSheet sheet={pickSheet(sheetData(key), key)} />`
 * in the holder; legacy copied `#sheet` of the screen when it was shown, so that
 * the map and the photos already drawn were printed.
 */
export {
  boatDocs,
  boatThumbId,
  docKindLabel,
  docKindName,
} from './boatDocs.ts';
export type { BoatDocument } from './boatDocs.ts';
export { boatInfoRows } from './boatInfoRows.ts';
export type { BoatInfoRow, BoatInfoSection } from './boatInfoRows.ts';
export { boatThumb, loadImage } from './boatThumb.ts';
export { BoatVersions, BoatVersionsButton } from './BoatVersions.tsx';
export {
  boatDocPhotos,
  printBoatDossier,
  shareBoatDossier,
} from './dossierOutput.tsx';
export { LakeSheet } from './LakeSheet.tsx';
export type { LakeSheetProps } from './LakeSheet.tsx';
export { boatsByNav, cruiseRealAt, membersByNav } from './navOrder.ts';
export {
  autoFillLakeDay,
  hasTrace,
  navDur,
  outingTimes,
  rentalPrice,
} from './outing.ts';
export type { OutingTimes } from './outing.ts';
export { prepPublishDialog } from './prepPublishDialog.tsx';
export { CachedPrepReportPage, PrepReport } from './PrepReport.tsx';
export type { PrepReportProps } from './PrepReport.tsx';
export {
  cachedPrepReport,
  prepReportCache,
  prepReportDocument,
  prepReportPng,
  prepReportShare,
} from './prepReportData.ts';
export type { CachedPrepReport, PrepReportDocument } from './prepReportData.ts';
export { prepReportPrint } from './prepReportPrint.tsx';
export { buildSheetData, prepareSheet, sheetData } from './sheetData.ts';
export { SHEET_PARTS, pickSheet, sheetParts } from './sheetParts.ts';
export { sheetPng } from './sheetPng.ts';
export type {
  PickedSheet,
  SheetChecklist,
  SheetContent,
  SheetImageContent,
  SheetLogRow,
  SheetRow,
  SheetSection,
} from './sheetTypes.ts';

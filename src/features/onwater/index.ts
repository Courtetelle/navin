/**
 * Public API of the onwater domain (legacy lake.js 1435-1683, 2306-3375).
 *
 * | legacy                               | export                                                       |
 * | ------------------------------------ | ------------------------------------------------------------ |
 * | `docStore(mode)`                     | {@link docStore}                                             |
 * | `sailHidden(k, st)`                  | {@link sailHidden}                                           |
 * | `lakeState(k)`, `lakeTimes(k)`       | {@link lakeState}, {@link lakeTimes} (`key, cruise?`)        |
 * | `hasEvt(e, label)`, `BLACK_EVT`      | {@link hasEvt}, {@link BLACK_EVT}                            |
 * | `renderLakeButtons()`                | `<LakeButtons inPopup? />` renders `div#lakeBtns` with its content; {@link refreshLakeButtons} rebuilds it |
 * | `lakeFix(done)`                      | {@link lakeFix}                                              |
 * | `journalExtract(k)`, `journalFull(k)`| {@link journalExtract}, {@link journalFull}                  |
 * | `takePhoto(ctx, done, item)`         | {@link takePhoto}                                            |
 * | `photosFor(ctx, k)`                  | {@link photosFor}                                            |
 * | `removePhoto(id)`                    | {@link removePhoto}                                          |
 * | `photoStrip(list, removable)`        | `<PhotoStrip photos onRemove? />`                            |
 * | `fillPhotos(root)`                   | `<PhotoImg photoId … />`, {@link usePhotoUrl} (the strip fills itself; any `.photo-strip img[data-photo]` opens the viewer on touch) |
 * | `ZONES`, `nearestPort`, `guessZone`  | {@link ZONES}, {@link nearestPort}, {@link guessZone}        |
 * | `findStartPlace(mode, done)`         | {@link findStartPlace}                                       |
 * | `autoOutingName(mode, boat, place, zone, when)` | {@link autoOutingName}                            |
 * | `distKm(a, b, c, d)`                 | {@link distKm}                                               |
 * | `windMuteEnd()`                      | {@link windMuteEnd}                                          |
 * | `playAlarm(level, kn)`               | {@link playAlarm}                                            |
 * | `windAlertHtml(noTest)`              | `<WindAlert noTest? keep? />`, it handles its own clicks     |
 * | `windAlertClick(button)`             | {@link windAlertClick} (`action`: toggle, mute, basis, test) |
 * | `wxSummary(w)`                       | {@link wxSummary}                                            |
 * | `traceImage(k)`                      | {@link traceImage}                                           |
 * | `crewListCols()`, `CREW_LIST_COLS`   | {@link crewListCols}, {@link CREW_LIST_COLS}                 |
 * | `crewListHead()`, `crewRole(c)`      | {@link crewListHead}, {@link crewRole}                       |
 * | `printCrewList()`                    | {@link printCrewList}                                        |
 * | `shareCrewList(btn)`                 | {@link shareCrewList} (`setBusy`)                            |
 * | `renderBoatFields(id, back)`         | `<BoatFieldsEditor boatId onDone />`                         |
 * | `hasAboard()`, `taskTpl`             | `src/state/index.ts` (`hasAboard`, `state.data.taskTpl`)     |
 * | `putPhoto`, `getPhoto`, `delPhoto`, `shrinkPhoto`, `PHOTO_CTX` | `src/storage/photos.ts`            |
 */
export {
  HISTORY_MS,
  rememberReadings,
  stationHistory,
  windTrend,
} from './stationHistory.ts';
export type { WindPoint, WindTrend } from './stationHistory.ts';
export { newMfTally } from './coastStations.ts';
export { seaNow } from './seaNow.ts';
export type { SeaNow, WaveTrain } from './seaNow.ts';
export { douglasOfH as seaDegree } from './windLogic.ts';
export { seaTxt as seaSentence } from './windLogic.ts';
export type { MfTally } from './coastStations.ts';
export { distKm } from '../../lib/geo.ts';

export { BoatFieldsEditor } from './BoatFieldsEditor.tsx';
export type { BoatFieldsEditorProps } from './BoatFieldsEditor.tsx';
export {
  CREW_LIST_COLS,
  crewListCols,
  crewListHead,
  crewRole,
  printCrewList,
  shareCrewList,
} from './crewList.ts';
export type { CrewListHead } from './crewList.ts';
export { docStore } from './docStore.ts';
export { journalExtract, journalFull } from './journal.ts';
export type { JournalRow } from './journal.ts';
export { LakeButtons } from './LakeButtons.tsx';
export type { LakeButtonsProps } from './LakeButtons.tsx';
export { lakeFix } from './lakeFix.ts';
export { refreshLakeButtons } from './lakeRefresh.ts';
export {
  BLACK_EVT,
  hasEvt,
  lakeState,
  lakeTimes,
  sailHidden,
} from './lakeState.ts';
export type { LakeState, LakeTimes } from './lakeState.ts';
export { PhotoImg, PhotoStrip } from './PhotoStrip.tsx';
export type { PhotoImgProps, PhotoStripProps } from './PhotoStrip.tsx';
export { photosFor, removePhoto, takePhoto } from './photos.ts';
export type { CruisePhoto } from './photos.ts';
export {
  ZONES,
  autoOutingName,
  findStartPlace,
  guessZone,
  nearestPort,
} from './ports.ts';
export { traceImage } from './traceImage.ts';
export { usePhotoUrl } from './usePhotoUrl.ts';
export { wxSummary } from './weatherLogic.ts';
export type { WeatherNow } from './weatherLogic.ts';
export { WindAlert } from './WindAlert.tsx';
export type { WindAlertProps } from './WindAlert.tsx';
export { windAlertClick } from './windAlertClick.ts';
export type { WindAlertAction } from './windAlertClick.ts';
export { playAlarm } from './windAudio.ts';
export { windMuteEnd } from './windWatch.ts';
export { METEO_SWISS, liveStations, stationKey } from './liveStations.ts';
export type { LiveStation } from './liveStations.ts';
export { flashColor, flashInk, windLevel, windValue } from './windLogic.ts';
export { windConfig, windWatchPlace } from './windWatch.ts';
export { seaPlace } from './externals.ts';

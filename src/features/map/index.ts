/**
 * Public API of the map domain (legacy map.js, chart.js, marks.js).
 *
 * | legacy                            | export                                                     |
 * | --------------------------------- | ---------------------------------------------------------- |
 * | `SWISS_BOUNDS`, `LEMAN_ARCGIS`, `LEMAN_BBOX`, `inSwissArea` | same names                       |
 * | `stopMapWatch()`                  | {@link stopMapWatch} (runs on every `go`, see `init.ts`)   |
 * | `lakesNote()`                     | {@link lakesNote}                                          |
 * | `loadLeaflet()`                   | {@link loadLeaflet}: resolves to the Leaflet library       |
 * | `mapData(day)`                    | {@link mapData}: `{ line, ents, nm }`                      |
 * | `segments(line)`                  | {@link segments}                                           |
 * | `entryColor(entry)`               | {@link entryColor}                                         |
 * | `trk`                             | {@link tracker}: `tracker.current`, `null` when closed     |
 * | `trackStats(track)`               | {@link trackStats}                                         |
 * | `allLakeTracks()`                 | {@link allLakeTracks}                                      |
 * | `trkPointNow()`                   | {@link trkPointNow}                                        |
 * | `closeNavPop()`, `openNavPop()`   | {@link closeNavPop}, {@link openNavPop}                    |
 * | `trkFix(fix)`                     | {@link trkFix}                                             |
 * | `trackerTick()`                   | {@link trackerTick}                                        |
 * | `trkReset()`                      | {@link trkReset}                                           |
 * | `updateTrkDash()`                 | {@link updateTrkDash}                                      |
 * | `trkChooseStart()`                | {@link trkChooseStart}                                     |
 * | `drawTrkButtons()`                | {@link drawTrkButtons}                                     |
 * | `drawTrkList()`                   | {@link drawTrkList}                                        |
 * | `exitMapFull()`                   | {@link exitMapFull} (runs on every `go`, see `init.ts`)    |
 * | `ctlAutoAttach(map)`              | {@link ctlAutoAttach}                                      |
 * | `trkZoneRecenter(zone)`           | {@link trkZoneRecenter}                                    |
 * | `lemanVecNote()`                  | {@link lemanVecNote}                                       |
 * | `fetchLemanVec()`                 | {@link fetchLemanVec}                                      |
 * | `isobathData`                     | {@link isobathData}: a function                            |
 * | `isobathLoad()`                   | {@link isobathLoad}                                        |
 * | `bathyAscNote()`                  | {@link bathyAscNote}                                       |
 * | `bathyAscImport(files, sub)`      | {@link bathyAscImport}`(files, say)`                       |
 * | `bathyAscShare()`                 | {@link bathyAscShare}                                      |
 * | `vdIsobathLayers()`               | {@link vdIsobathLayers}                                    |
 * | `addLemanVector(map, ctrl, sea)`  | {@link addLemanVector}                                     |
 * | `depthAt(lat, lon)`               | {@link depthAt}                                            |
 * | `marks`, `mergeMarks`, `herePos`  | `src/state/index.ts`                                       |
 */
export { addLemanVector } from './addLemanVector.ts';
export { bathyAscImport, bathyAscShare } from './bathyImport.ts';
export { bathyAscNote } from './bathyStore.ts';
export type { GeoBox, LatLngPair } from './constants.ts';
export {
  LEMAN_ARCGIS,
  LEMAN_BBOX,
  LEMAN_CENTER,
  SWISS_BOUNDS,
  inSwissArea,
} from './constants.ts';
export { ctlAutoAttach } from './ctlAuto.ts';
export { depthAt, isobathData, isobathLoad } from './isobath.ts';
export type { IsobathLine } from './isobath.ts';
export { lakesNote } from './lakes.ts';
export { leaflet, loadLeaflet } from './leaflet.ts';
export type { LeafletLibrary } from './leaflet.ts';
export { fetchLemanVec, lemanVecNote } from './lemanVector.ts';
export { entryColor, mapData, segments } from './mapData.ts';
export type { MapDataResult, MapPoint, PositionedEntry } from './mapData.ts';
export { exitMapFull } from './mapFull.ts';
export { stopMapWatch } from './mapWatch.ts';
export { closeNavPop, openNavPop } from './navPop.ts';
export { drawTrkList } from './traceList.ts';
export { drawTrkButtons, trkChooseStart } from './trackerButtons.ts';
export { updateTrkDash } from './trackerDash.ts';
export { trkPointNow } from './trackerPoint.ts';
export { trkZoneRecenter } from './trackerRecenter.ts';
export { tracker, trackerTick, trkFix, trkReset } from './trackerState.ts';
export type { TrackerFix, TrackerHandle } from './trackerState.ts';
export { allLakeTracks, trackStats } from './trackStats.ts';
export type { LakeTrack, TrackStatsResult } from './trackStats.ts';
export { vdIsobathLayers } from './vdIsobath.ts';

/**
 * Public API of the tracking domain: live GPS tracking, automatic log entries,
 * weather, GPX and NMEA import, boat instruments, depth alarm, zone choice.
 *
 * Already provided by the core (not here): `rad`, `distNM`, `bearing`,
 * `angDiff` (`src/lib/geo.ts`); `loadTrack`, `saveTrack`, `trackToGpx`,
 * `tripKey`, `lastTripKey`, `zoneSimGet` (`src/state/index.ts`); the signals
 * `state.view.tracking`, `lastFix`, `gpsDenied`, `trip`, `trackBuf`, `simGps`.
 *
 * `state.view.trip` gets a new reference at every fix (read it like
 * `LiveTrip`), so a component or an effect reading it follows the recording.
 * `state.view.trackBuf` grows in place. The domain calls the map (`trackerTick`,
 * `trkFix`, `drawTrkButtons`…) and the wind alerts through `trackerLink.ts`,
 * which loads them late: `init.ts` must not depend on their code.
 *
 * | Legacy                      | Export                                                           |
 * | --------------------------- | ---------------------------------------------------------------- |
 * | `renderAutoCard()`          | `<AutoCard />`: renders `<div id="autoCard">` itself             |
 * | `startTracking(resume, auto)` | {@link startTracking}                                          |
 * | `stopTracking(withArrival)` | {@link stopTracking}                                             |
 * | `extendLastTrip()`          | {@link extendLastTrip}                                           |
 * | `autoResumeTrip()`          | {@link autoResumeTrip}                                           |
 * | `onFix(position)`           | {@link onFix}                                                    |
 * | `addAutoEntry(event, loch)` | {@link addAutoEntry}: read `.id`, the entry is frozen            |
 * | `fetchWeather(lat, lon, d)` | {@link fetchWeather}                                             |
 * | `applyWeather(values, w)`   | {@link applyWeather}: inside an immer recipe                     |
 * | `fillPendingWeather(btn)`   | {@link fillPendingWeather}`(onProgress)`: label of the button    |
 * | `smnStations()`             | {@link smnStations}                                              |
 * | `smnNow(abbreviation)`      | {@link smnNow}                                                   |
 * | `smnMeasure(lat, lon, d)`   | {@link smnMeasure}                                               |
 * | `wxNext(lat, lon, hours)`   | {@link wxNext}                                                   |
 * | `importGpxFile(file)`       | {@link importGpxFile}, with the page showing `<GpxImportScreen />` instead of its content while `gpxImportPlan.value` is set |
 * | `ZONE_CYC`                  | {@link ZONE_CYC}                                                 |
 * | `zoneSet(zone)`             | {@link zoneSet}                                                  |
 * | `zoneSimHtml()`             | `<ZoneSim />`                                                    |
 * | `depthDevHtml(inAlerts)`    | `<DepthDev inAlerts />`                                          |
 * | `depthSetHtml()`            | `<DepthSet />`                                                   |
 * | `window.nmeaPosFresh()`     | {@link nmeaPosFresh}                                             |
 * | `window.nmeaWind()`         | {@link nmeaWind}                                                 |
 */
export { addAutoEntry } from './autoEntries.ts';
export { AutoCard } from './AutoCard.tsx';
export type { Detector, TrackEvent, TrackSample } from './detector.ts';
export { DepthDev, DepthSet } from './DepthSettings.tsx';
export type { DepthDevProps } from './DepthSettings.tsx';
export { gpxImportPlan, importGpxFile } from './gpxImport.ts';
export { GpxImportScreen } from './GpxImportScreen.tsx';
export type { ImportPlan } from './gpxPlan.ts';
export type { ParsedTrack } from './gpxParse.ts';
export { onFix } from './fixHandler.ts';
export type { FixInput } from './fixHandler.ts';
export {
  autoResumeTrip,
  extendLastTrip,
  startTracking,
  stopTracking,
} from './liveTracking.ts';
export { liveTrip } from './tripState.ts';
export type { LiveTrip } from './tripState.ts';
export { nmeaConnect, nmeaDisconnect } from './nmeaConnection.ts';
export { nmeaImportFile } from './nmeaImport.ts';
export {
  nmeaFresh,
  nmeaLink,
  nmeaLinkView,
  nmeaPosFresh,
  nmeaRedraw,
  nmeaWind,
} from './nmeaLive.ts';
export { allureFromTwa, douglasFromHeight } from './seaState.ts';
export { smnMeasure, smnNow, smnStations } from './smn.ts';
export type { SmnMeasure, SmnRow, SmnStation } from './smn.ts';
export { applyWeather, fetchWeather, fillPendingWeather } from './weather.ts';
export type { Weather } from './weather.ts';
export { wxNext } from './weatherSources.ts';
export type { Forecast, ForecastRow } from './weatherSources.ts';
export { ZONE_CYC, cycleZone, nextZone, zoneSet } from './zone.ts';
export type { ZoneChoice } from './zone.ts';
export { LemanIcon, ZoneSim } from './ZoneSim.tsx';

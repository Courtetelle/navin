import {
  lastKnownPos,
  sosLogAdd,
  state,
  updateSosLogs,
} from '../../state/index.ts';

/**
 * Start or continue the SOS procedure: the action is noted, a fallback position
 * kept, and the GPS asked once outside an exercise (legacy `sosLogStart`).
 * @param what - What was touched.
 */
export function sosLogStart(what: string): void {
  const { id, pos0, ex } = sosLogAdd(what, 'sos');
  if (!pos0) {
    const position = lastKnownPos();
    if (position?.lat != null) {
      const { lat, lon } = position;
      const at = position.at || new Date().toISOString();
      updateSosLogs((logs) => {
        const log = logs.find((item) => item.id === id);
        if (log) log.pos0 = { lat, lon, at };
      });
    }
  }
  if (ex || !('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (fix) => {
      const log = state.data.sosLogs.value.find((item) => item.id === id);
      if (log?.ex) return;
      const pos = { lat: fix.coords.latitude, lon: fix.coords.longitude };
      const at = new Date().toISOString();
      state.view.sosPos.value = { ...pos, at };
      if (!log || log.end) return;
      updateSosLogs((logs) => {
        const current = logs.find((item) => item.id === id);
        if (!current) return;
        current.events.push({
          t: at,
          what: '📍 Position GPS',
          type: 'pos',
          pos,
        });
        current.last = at;
      });
    },
    () => undefined,
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
  );
}

import { useSignals } from '@preact/signals-react/runtime';

import { useLongPress } from '../../components/shared/useLongPress.ts';
import {
  daySort,
  leaveDaySort,
  resetRouting,
  routingChanges,
  shiftBusy,
  shiftPrefs,
  shiftRouting,
  sortDay,
  stepRank,
} from '../../features/map/routingShift.ts';
import { shownRouting } from '../../features/map/routingState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import { go } from '../../shell/router.ts';

function stepText(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} h`
    : `${minutes} min`;
}

function hoursText(minutes: number): string {
  const all = Math.abs(minutes);
  const hours = Math.floor(all / 60);
  const rest = all % 60;
  const by =
    hours > 0 ? `${hours} h ${String(rest).padStart(2, '0')}` : `${rest} min`;
  return `${minutes > 0 ? '+' : '−'}${by}`;
}

/** Long press on an arrow: Paramétrages › Routages (◀ comes back here). */
function openPrefs(): void {
  go('settings', 'routages');
}

/**
 * The routing shown on the map, three buttons at the right, the size of the
 * buttons at the left. ▲ and ▼ move its ETD or its ETA (the one picked by a
 * touch on its tag on the map, or as set in Paramétrages › Routages) by the
 * step set, routed again with the weather of the new hours; between them,
 * what changed against the first routing. A long press on the middle one
 * sorts the routings of the day from the most efficient (the three turn
 * green, ▲ ▼ go from one to the next, a long press again leaves the sort);
 * a touch goes back to the first routing of the sort. A long press on an
 * arrow opens its settings.
 * @returns The buttons, or nothing without a routing that can be moved.
 */
export function RoutingBar() {
  useSignals();
  const tr = useTr();
  const shown = shownRouting.value;
  const busy = shiftBusy.value;
  const prefs = shiftPrefs.value;
  const sort = daySort.value;
  const middle = useLongPress(() => {
    if (daySort.peek()) leaveDaySort();
    else void sortDay();
  });
  const up = useLongPress(openPrefs);
  const down = useLongPress(openPrefs);
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined) return null;
  const green = sort !== null && sort.plan === plan;
  const arrive = shown.arriveMs ?? shown.departMs;
  const { base } = plan;
  const changes = shown.stats
    ? routingChanges(
        shown.stats,
        base.stats,
        (arrive - shown.departMs) / 60_000,
        (base.arriveMs - base.departMs) / 60_000,
      )
    : [];
  const what = prefs.moves === 'eta' ? 'ETA' : 'ETD';
  const moved = Math.round(
    (prefs.moves === 'eta'
      ? arrive - base.arriveMs
      : shown.departMs - base.departMs) / 60_000,
  );
  let head = 'routage calculé';
  if (green) {
    head = `n° ${sort.rank + 1}/${sort.count} · ETD ${fmtTime(new Date(shown.departMs))}`;
  } else if (moved !== 0) {
    head = `${what} ${hoursText(moved)}`;
  }
  const told =
    changes.length > 0
      ? changes.join(' · ')
      : moved !== 0 || green
        ? 'mêmes durée, moteur et manœuvres'
        : '';
  const step = stepText(prefs.stepMin);
  const move = (sign: number) => {
    buzz();
    if (green) void stepRank(-sign);
    else void shiftRouting(sign * prefs.stepMin);
  };
  return (
    <div
      className={`rtg-rail${green ? ' rtg-green' : ''}`}
      id="rtgBar"
      role="group"
      aria-label={tr('Heure du routage')}
    >
      <button
        type="button"
        className={`rail-btn rtg-arrow${up.hit ? ' lp-hit' : ''}`}
        id="rtgLater"
        aria-label={tr(
          green
            ? 'Routage plus efficient · appui long : réglages'
            : `${what} ${step} plus tard · appui long : réglages`,
        )}
        disabled={busy}
        onClick={() => move(1)}
        {...up.handlers}
      >
        <span aria-hidden="true">▲</span>
        <small>{green ? tr('plus efficient') : `${what} +${step}`}</small>
      </button>
      <button
        type="button"
        className={`rail-btn rtg-info${middle.hit ? ' lp-hit' : ''}${busy ? ' busy' : ''}`}
        id="rtgInfo"
        aria-label={tr(
          green
            ? 'Toucher : routage le plus efficient du jour · appui long : retour au tri par heure'
            : 'Toucher : revenir au routage calculé · appui long : routages du jour, du plus efficient au moins efficient',
        )}
        disabled={busy}
        onClick={() => {
          buzz();
          void resetRouting();
        }}
        {...middle.handlers}
      >
        <b className="rtg-head" aria-live="polite">
          {busy ? tr('calcul…') : tr(head)}
        </b>
        {told ? (
          <span className="rtg-changes" id="rtgChanges">
            {tr(told)}
          </span>
        ) : (
          <span className="rtg-changes" id="rtgChanges" hidden />
        )}
      </button>
      <button
        type="button"
        className={`rail-btn rtg-arrow${down.hit ? ' lp-hit' : ''}`}
        id="rtgEarlier"
        aria-label={tr(
          green
            ? 'Routage moins efficient · appui long : réglages'
            : `${what} ${step} plus tôt · appui long : réglages`,
        )}
        disabled={busy}
        onClick={() => move(-1)}
        {...down.handlers}
      >
        <span aria-hidden="true">▼</span>
        <small>{green ? tr('moins efficient') : `${what} −${step}`}</small>
      </button>
    </div>
  );
}

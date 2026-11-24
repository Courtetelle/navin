import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import {
  bestOfDay,
  resetRouting,
  routingChanges,
  shiftBusy,
  shiftPrefs,
  shiftRouting,
} from '../../features/map/routingShift.ts';
import { shownRouting } from '../../features/map/routingState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime } from '../../lib/format.ts';

function shift(sign: number): void {
  buzz();
  void shiftRouting(sign * shiftPrefs.peek().stepMin);
}

function day(ms: number): string {
  const date = new Date(ms);
  return `${fmtShortDate(date)} ${fmtTime(date)}`;
}

function stepText(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} h`
    : `${minutes} min`;
}

/**
 * The routing shown on the map, three buttons at the right: ◀ and ▶ move
 * its ETD (or its ETA, as set in Paramétrages › Routages) by the step set,
 * routed again with the weather of the new hours; between them, the ETD,
 * the ETA and what changed against the first routing. A touch on it goes
 * back to the first routing, a long press finds the best of the day.
 * @returns The buttons, or nothing without a routing that can be moved.
 */
export function RoutingBar() {
  useSignals();
  const tr = useTr();
  const shown = shownRouting.value;
  const busy = shiftBusy.value;
  const prefs = shiftPrefs.value;
  const press = useLongPress(() => {
    void bestOfDay();
  });
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined) return null;
  const arrive = shown.arriveMs ?? shown.departMs;
  const { base } = plan;
  const moved = Math.round((shown.departMs - base.departMs) / 60_000);
  const changes = shown.stats
    ? routingChanges(
        shown.stats,
        base.stats,
        (arrive - shown.departMs) / 60_000,
        (base.arriveMs - base.departMs) / 60_000,
      )
    : [];
  let told = 'routage calculé';
  if (moved !== 0) {
    const hours = Math.floor(Math.abs(moved) / 60);
    const minutes = Math.abs(moved) % 60;
    const by =
      hours > 0
        ? `${hours} h ${String(minutes).padStart(2, '0')}`
        : `${minutes} min`;
    const what =
      changes.length > 0
        ? changes.join(' · ')
        : 'mêmes durée, moteur et manœuvres';
    told = `ETD ${moved > 0 ? '+' : '−'}${by} : ${what}`;
  }
  const what = prefs.moves === 'eta' ? 'ETA' : 'ETD';
  const step = stepText(prefs.stepMin);
  return (
    <div
      className="rtg-rail"
      id="rtgBar"
      role="group"
      aria-label={tr('Heure du routage')}
    >
      <Button
        className="rail-btn rtg-arrow"
        id="rtgEarlier"
        aria-label={tr(`${what} ${step} plus tôt`)}
        disabled={busy}
        onClick={() => shift(-1)}
      >
        <span aria-hidden="true">◀</span>
        <small>{`−${step}`}</small>
      </Button>
      <button
        type="button"
        className={`rail-btn rtg-info${press.hit ? ' lp-hit' : ''}${busy ? ' busy' : ''}`}
        id="rtgInfo"
        aria-label={tr(
          'Toucher : revenir au routage calculé · appui long : meilleur départ du jour',
        )}
        disabled={busy}
        onClick={() => {
          buzz();
          void resetRouting();
        }}
        {...press.handlers}
      >
        <span className="rtg-times" aria-live="polite">
          <span>
            <b>ETD</b> {day(shown.departMs)}
          </span>
          <span>
            <b>ETA</b> {busy ? tr('calcul…') : day(arrive)}
          </span>
        </span>
        <span className="rtg-changes" id="rtgChanges">
          {tr(told)}
        </span>
      </button>
      <Button
        className="rail-btn rtg-arrow"
        id="rtgLater"
        aria-label={tr(`${what} ${step} plus tard`)}
        disabled={busy}
        onClick={() => shift(1)}
      >
        <span aria-hidden="true">▶</span>
        <small>{`+${step}`}</small>
      </Button>
    </div>
  );
}

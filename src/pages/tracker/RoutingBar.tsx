import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import {
  routingChanges,
  shiftBusy,
  shiftRouting,
} from '../../features/map/routingShift.ts';
import { shownRouting } from '../../features/map/routingState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate, fmtTime } from '../../lib/format.ts';

function shift(hours: number): void {
  buzz();
  void shiftRouting(hours);
}

function day(ms: number): string {
  const date = new Date(ms);
  return `${fmtShortDate(date)} ${fmtTime(date)}`;
}

/**
 * The routing shown on the map: ◀ ▶ move its ETD an hour earlier or later,
 * routed again with the weather of the new hours; its ETA, and what changed
 * against the first routing.
 * @returns The bar, or nothing without a routing that can be moved.
 */
export function RoutingBar() {
  useSignals();
  const tr = useTr();
  const shown = shownRouting.value;
  const busy = shiftBusy.value;
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined) return null;
  const arrive = shown.arriveMs ?? shown.departMs;
  const { base } = plan;
  const moved = Math.round((shown.departMs - base.departMs) / 3_600_000);
  const changes = shown.stats
    ? routingChanges(
        shown.stats,
        base.stats,
        (arrive - shown.departMs) / 60_000,
        (base.arriveMs - base.departMs) / 60_000,
      )
    : [];
  let told = 'ETD du routage calculé';
  if (moved !== 0) {
    const what =
      changes.length > 0
        ? changes.join(' · ')
        : 'mêmes durée, moteur et manœuvres';
    told = `${moved > 0 ? '+' : '−'}${Math.abs(moved)} h sur l’ETD calculé : ${what}`;
  }
  return (
    <div
      className="wx-bar rtg-bar"
      id="rtgBar"
      role="group"
      aria-label={tr('Heure de départ du routage')}
    >
      <div className="rtg-shift">
        <Button
          className="btn"
          id="rtgEarlier"
          aria-label={tr('ETD une heure plus tôt')}
          disabled={busy}
          onClick={() => shift(-1)}
        >
          ◀
        </Button>
        <div className="rtg-times" aria-live="polite">
          <div>
            <b>ETD</b> {day(shown.departMs)}
          </div>
          <div>
            <b>ETA</b> {busy ? tr('calcul…') : day(arrive)}
          </div>
        </div>
        <Button
          className="btn"
          id="rtgLater"
          aria-label={tr('ETD une heure plus tard')}
          disabled={busy}
          onClick={() => shift(1)}
        >
          ▶
        </Button>
      </div>
      <div className="rtg-changes" id="rtgChanges">
        {tr(told)}
      </div>
    </div>
  );
}

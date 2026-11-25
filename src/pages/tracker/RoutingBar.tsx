import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { useLongPress } from '../../components/shared/useLongPress.ts';
import { hourText, labelLines } from '../../features/map/routingLabel.ts';
import {
  bestAhead,
  canGoEarlier,
  findBestAhead,
  leaveRankSort,
  rankSort,
  refreshLive,
  resetRouting,
  shiftBusy,
  shiftPrefs,
  shiftRouting,
  sortAhead,
  stepRank,
} from '../../features/map/routingShift.ts';
import {
  routingOverlay,
  shownRouting,
} from '../../features/map/routingState.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { store } from '../../storage/store.ts';

import { layLiveAround, liveOnMap } from './liveOnMap.ts';

function stepText(minutes: number): string {
  return minutes >= 60 && minutes % 60 === 0
    ? `${minutes / 60} h`
    : `${minutes} min`;
}

/** Long press on an arrow: Paramétrages › Routages (◀ comes back here). */
function openPrefs(): void {
  go('settings', 'routages');
}

/** « Départ imminent » looked at again this often. */
const LIVE_CHECK_MS = 60_000;
/** The best departure of the next hours looked for after this delay. */
const BEST_DELAY_MS = 3000;

/**
 * The wind measured and the storms detected over the routing leaving now:
 * the LiveMétéo stations of the zone are laid if they were not.
 */
function toggleOverlay(): void {
  buzz();
  const on = !routingOverlay.peek();
  routingOverlay.value = on;
  if (on && liveOnMap.peek() === 0) layLiveAround();
}

/**
 * The routing shown on the map, three buttons at the right, the size of the
 * buttons at the left. The middle one gives the routing « Départ
 * imminent », from now, routed again every 10 minutes (▼ greyed then); ▲
 * moves the ETD later by the step set (it reads « Départ à 21h30 », a touch
 * comes back to « Départ imminent »), ▼ earlier, never before now. A long
 * press on the middle one sorts the routings of the next hours set (6, 12
 * or 24) from the most efficient (the three turn green, ▲ ▼ go from one to
 * the next, a long press again leaves the sort). A long press on an arrow
 * opens its settings. Leaving now, a fourth button lays the wind measured
 * and the storms detected over the routing. Its figures stand on a label
 * the finger moves anywhere.
 * @returns The buttons, or nothing without a routing that can be moved.
 */
export function RoutingBar() {
  useSignals();
  const tr = useTr();
  const shown = shownRouting.value;
  const busy = shiftBusy.value;
  const prefs = shiftPrefs.value;
  const sort = rankSort.value;
  const overlay = routingOverlay.value;
  const middle = useLongPress(() => {
    if (rankSort.peek()) leaveRankSort();
    else void sortAhead();
  });
  const up = useLongPress(openPrefs);
  const down = useLongPress(openPrefs);
  const [now, setNow] = useState(Date.now);
  const live = shown?.live === true;
  // « Départ imminent »: routed again once 10 minutes old.
  useEffect(() => {
    if (!live) return undefined;
    void refreshLive();
    const timer = setInterval(() => {
      setNow(Date.now());
      void refreshLive();
    }, LIVE_CHECK_MS);
    return () => clearInterval(timer);
  }, [live]);
  // The most efficient departure of the next hours, for the label.
  const planShown = shown?.plan;
  useEffect(() => {
    if (!planShown) return undefined;
    const timer = setTimeout(() => void findBestAhead(), BEST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [planShown, prefs.rankHours]);
  const plan = shown?.plan;
  if (!shown || !plan || shown.departMs === undefined) return null;
  const green = sort !== null && sort.plan === plan;
  const departAt = `Départ à ${hourText(shown.departMs)}`;
  let head = live ? 'Départ imminent' : departAt;
  if (green) head = `n° ${sort.rank + 1}/${sort.count} · ${departAt}`;
  const step = stepText(prefs.stepMin);
  const earlier = green || canGoEarlier(shown.departMs, prefs.stepMin, now);
  const move = (sign: number) => {
    buzz();
    if (green) void stepRank(-sign);
    else void shiftRouting(sign * prefs.stepMin);
  };
  return (
    <>
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
              : `Départ ${step} plus tard · appui long : réglages`,
          )}
          disabled={busy}
          onClick={() => move(1)}
          {...up.handlers}
        >
          <span aria-hidden="true">▲</span>
          <small>{green ? tr('plus efficient') : `+${step}`}</small>
        </button>
        <button
          type="button"
          className={`rail-btn rtg-info${middle.hit ? ' lp-hit' : ''}${busy ? ' busy' : ''}${live ? ' rtg-live' : ''}`}
          id="rtgInfo"
          aria-label={tr(
            green
              ? 'Toucher : routage le plus efficient · appui long : retour au départ à l’heure'
              : `Toucher : Départ imminent · appui long : routages des ${prefs.rankHours} prochaines heures, du plus efficient au moins efficient`,
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
        </button>
        <button
          type="button"
          className={`rail-btn rtg-arrow${down.hit ? ' lp-hit' : ''}`}
          id="rtgEarlier"
          aria-label={tr(
            green
              ? 'Routage moins efficient · appui long : réglages'
              : `Départ ${step} plus tôt · appui long : réglages`,
          )}
          // Not before now: greyed, its long press still opens the settings.
          aria-disabled={!earlier}
          disabled={busy}
          onClick={() => {
            if (earlier) move(-1);
          }}
          {...down.handlers}
        >
          <span aria-hidden="true">▼</span>
          <small>{green ? tr('moins efficient') : `−${step}`}</small>
        </button>
        {live ? (
          <button
            type="button"
            className={`rail-btn rtg-overlay${overlay ? ' rail-on' : ''}`}
            id="rtgOverlay"
            aria-pressed={overlay}
            aria-label={tr(
              overlay
                ? 'Masquer le vent mesuré et les orages détectés'
                : 'Afficher le vent mesuré et les orages détectés',
            )}
            onClick={toggleOverlay}
          >
            <span aria-hidden="true">🌬⚡</span>
            <small>{tr('mesuré')}</small>
          </button>
        ) : null}
      </div>
      <RoutingLabel />
    </>
  );
}

interface LabelPlace {
  x?: number;
  y?: number;
}

const LABEL_KEY = 'ldb.routingLabel';
/** A finger moves the label once this far. */
const DRAG_PX = 8;

/**
 * The figures of the routing shown on a label the finger moves anywhere on
 * the screen (kept there): ETD and ETA, length (and against the best
 * departure of the next hours), manoeuvres, motor, strongest wind and
 * gusts, highest waves, storm risk.
 * @returns The label.
 */
function RoutingLabel() {
  useSignals();
  const tr = useTr();
  const shown = shownRouting.value;
  const best = bestAhead.value;
  const [place, setPlace] = useState<LabelPlace>(
    () => store.get<LabelPlace>(LABEL_KEY, {}) ?? {},
  );
  const drag = useRef<{
    dx: number;
    dy: number;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  if (!shown?.plan || shown.departMs === undefined) return null;
  const lines = labelLines(shown, best);
  const width = globalThis.innerWidth || 800;
  const height = globalThis.innerHeight || 600;
  const left =
    place.x === undefined
      ? undefined
      : Math.max(4, Math.min(width - 120, place.x));
  const top =
    place.y === undefined
      ? undefined
      : Math.max(4, Math.min(height - 60, place.y));
  return (
    <div
      className="rtg-label"
      id="rtgLabel"
      role="status"
      aria-label={tr('Routage, à déplacer du doigt')}
      style={
        left === undefined || top === undefined
          ? undefined
          : {
              left: `${left}px`,
              top: `${top}px`,
              right: 'auto',
              bottom: 'auto',
            }
      }
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture may be refused.
        }
        const box = event.currentTarget.getBoundingClientRect();
        drag.current = {
          dx: event.clientX - box.left,
          dy: event.clientY - box.top,
          x0: event.clientX,
          y0: event.clientY,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        if (
          Math.hypot(event.clientX - start.x0, event.clientY - start.y0) >
          DRAG_PX
        ) {
          start.moved = true;
        }
        if (!start.moved) return;
        setPlace({ x: event.clientX - start.dx, y: event.clientY - start.dy });
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        drag.current = null;
        if (!start?.moved) return;
        store.set(LABEL_KEY, {
          x: event.clientX - start.dx,
          y: event.clientY - start.dy,
        });
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <b className="rtg-label-name">{shown.name}</b>
      {lines.map((line) => (
        <span key={line}>{tr(line)}</span>
      ))}
    </div>
  );
}

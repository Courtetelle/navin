import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { editRoute } from '../../features/map/routeEditor.ts';
import {
  ROUTE_ICON,
  ROUTE_NEW_ICON,
  ROUTE_WX_ICON,
  routesPart,
} from '../../features/map/routeMode.ts';
import { clearRouting } from '../../features/map/routingShown.ts';
import { shownRouting } from '../../features/map/routingState.ts';
import { buzz } from '../../lib/dom.ts';
import { state, toast } from '../../state/index.ts';
import { inMenu, menuButtonPress } from '../menuOwner.ts';
import { closeMenus, menusOpen } from '../menusRoll.ts';
import { navBack } from '../navbar/navActions.ts';
import { navinRowChosen } from '../navinRow.ts';
import { go } from '../router.ts';
import { routesRowOpen } from '../routesRow.ts';

/** A routing on the map: Routes leaves it (back to the map, and the track). */
function leaveRouting(): void {
  clearRouting();
  if (state.view.currentView.peek() !== 'tracker') go('tracker');
  toast('Sortie du routage : retour à la carte');
}

/**
 * Routes: the routes drawn on the map (« Planification d’itinéraire »). At
 * the top (unrolled by the tab of the menus), or on the tablet sideways in
 * the column under START, where a touch also unrolls Nouvelle route and
 * Routage météo at its right. It blinks while its page shows; with a
 * routing on the map, a red cross blinks on it and a touch leaves the
 * routing.
 * @param props - Where it stands.
 * @param props.rail - In the column of the tablet.
 * @returns The button.
 */
export function RoutesButton({ rail = false }: { rail?: boolean }) {
  useSignals();
  const here = state.view.currentView.value === 'routes' || inMenu('routes');
  const routing = shownRouting.value !== null;
  return (
    <Button
      noUiEdit={rail}
      className={[
        rail ? 'rail-btn rail-routes' : 'theme-btn routes-top',
        here && !routing && 'menu-here',
        routing && 'routing-on',
        rail && routesRowOpen.value && 'rail-on',
      ]
        .filter(Boolean)
        .join(' ')}
      id="routesBtn"
      aria-label={routing ? 'Sortir du routage' : 'Routes'}
      aria-expanded={rail ? routesRowOpen.value : undefined}
      title={routing ? 'Sortir du routage' : 'Routes'}
      onClick={() => {
        buzz();
        if (shownRouting.peek()) {
          routesRowOpen.value = false;
          leaveRouting();
          return;
        }
        navinRowChosen();
        if (rail) routesRowOpen.value = !routesRowOpen.peek();
        menuButtonPress('routes', navBack);
      }}
    >
      {/* A routing on the map: the button of the routing, crossed. */}
      <span className="routes-ico">
        {markupToReact(routing ? ROUTE_WX_ICON : ROUTE_ICON)}
      </span>
      {routing ? (
        <svg
          className="routes-x"
          viewBox="0 0 40 40"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="live-radius-cross"
            d="M5 5l30 30m0-30-30 30"
            stroke="#e00016"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </Button>
  );
}

/**
 * « Nouvelle route », drawn at once on the map of NavIn, and « Routage
 * météo »: under Routes at the top (at its left upright), unrolled and
 * faded with it; at its right in the column of the tablet.
 * @param props - Where they stand.
 * @param props.rail - In the column of the tablet.
 * @returns The two buttons, or nothing while rolled.
 */
export function RoutesUnroll({ rail = false }: { rail?: boolean }) {
  useSignals();
  if (rail ? !routesRowOpen.value : !menusOpen.value) return null;
  const done = () => {
    if (rail) routesRowOpen.value = false;
    else closeMenus();
  };
  const sub = rail ? 'rail-btn routes-rail-sub' : 'rail-btn routes-sub';
  return (
    <>
      <Button
        type="button"
        noUiEdit
        className={`${sub} routes-sub-new`}
        id="routeNewBtn"
        aria-label="Nouvelle route"
        title="Nouvelle route"
        onClick={() => {
          buzz();
          done();
          editRoute(null);
        }}
      >
        <span className="rail-icon">{markupToReact(ROUTE_NEW_ICON)}</span>
      </Button>
      <Button
        type="button"
        noUiEdit
        className={`${sub} routes-sub-wx`}
        id="routeWxBtn"
        aria-label="Routage météo"
        title="Routage météo"
        onClick={() => {
          buzz();
          done();
          routesPart.value = 'routing';
          go('routes');
        }}
      >
        <span className="rail-icon">{markupToReact(ROUTE_WX_ICON)}</span>
      </Button>
    </>
  );
}

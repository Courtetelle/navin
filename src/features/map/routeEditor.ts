import type {
  Control,
  LatLng,
  Map as LeafletMap,
  Marker,
  Polyline,
} from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtTime, fr, toLocalInput } from '../../lib/format.ts';
import { distNM } from '../../lib/geo.ts';
import type { NavRoute, RoutePoint } from '../../model/routes.ts';
import {
  DEFAULT_ROUTE_SPEED,
  midpoint,
  pointName,
  routeDuration,
  routeLegs,
  routeNm,
  routeTimes,
} from '../../model/routes.ts';
import { setBodyClass } from '../../shell/bodyClass.ts';
import { go } from '../../shell/router.ts';
import {
  herePos,
  removeRoute,
  saveRoute,
  state,
  toast,
} from '../../state/index.ts';

import type { AutoAnswer } from './autoRoute.ts';
import { aroundLand, autoOptions, saveAutoOptions } from './autoRoute.ts';
import { escapeHtml } from './escapeHtml.ts';
import { setGoto } from './goto.ts';
import { leaflet } from './leaflet.ts';
import { ROUTE_ICON, routeEditing } from './routeMode.ts';
import { readNumber } from './rulerEditor.ts';
import { endsLongPress } from './tapCross.ts';
import { setFollow, tracker } from './trackerState.ts';

/** A finger held this long on a point, without moving, deletes it. */
const HOLD_MS = 700;
/** A finger moved this far (pixels) drags the point. */
const DRAG_PX = 8;
/** A leg this long on screen (pixels) shows its course and distance. */
const LABEL_PX = 110;
/** A leg this long on screen (pixels) shows its ＋ to bend it. */
const MID_PX = 56;
/** Changes that can be undone. */
const UNDO_STEPS = 50;

/** The route to open on the map once it is shown: an id, or a new one. */
let pending: string | 'new' | null = null;

/** The opener of the route editor of each map. */
const openers = new WeakMap<LeafletMap, (id: string | null) => void>();

/**
 * Open a route on the map of NavIn to see and change it, or start a new one.
 * @param id - The route, or `null` for a new route.
 */
export function editRoute(id: string | null): void {
  const map = tracker.current?.map;
  const opener = map ? openers.get(map) : undefined;
  if (opener && state.view.currentView.peek() === 'tracker') {
    opener(id);
    return;
  }
  pending = id ?? 'new';
  go('tracker');
}

/**
 * The text of a route at a glance.
 * @param route - Points and speed.
 * @returns For example « 4 points · 12,4 NM · 1 h 55 à 6,5 nd ».
 */
export function routeSummary(
  route: Pick<NavRoute, 'points' | 'speed'>,
): string {
  const count = route.points.length;
  const parts = [`${count} point${count > 1 ? 's' : ''}`];
  if (count > 1) {
    parts.push(
      `${fr(routeNm(route.points), 1)} NM`,
      `${fmtDur(routeDuration(route))} à ${fr(route.speed, 1)} nd`,
    );
  }
  return parts.join(' · ');
}

/**
 * The point to go to first: the one after the point nearest the boat, once
 * that one is reached (0,1 NM); the second point without a position.
 * @param points - The route.
 * @param here - The boat, if known.
 * @returns Its rank.
 */
export function nextPointIndex(
  points: readonly RoutePoint[],
  here: { lat: number; lon: number } | null,
): number {
  if (points.length < 2) return 0;
  if (!here) return 1;
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const [index, point] of points.entries()) {
    const nm = distNM(here, point);
    if (nm < best) {
      best = nm;
      nearest = index;
    }
  }
  const reached = best < 0.1;
  return Math.min(points.length - 1, reached ? nearest + 1 : nearest);
}

interface Drag {
  /** Told of each position of the finger. */
  move: (at: LatLng) => void;
  /** Told when the finger is lifted: whether it moved. */
  end: (moved: boolean) => void;
}

/**
 * The route editor on a map: a button opens it; a tap on the map adds a
 * point at the end, a finger moves a point, the ＋ in the middle of a leg
 * bends it with a new point, a long press on a point deletes it. Each
 * change is saved at once; the panel below gives the length, the time at
 * the speed planned, the departure, and Go to.
 * @param map - Leaflet map of NavIn.
 */
export function addRouteControl(map: LeafletMap): void {
  const L = leaflet();
  let route: NavRoute | null = null;
  let points: RoutePoint[] = [];
  let history: RoutePoint[][] = [];
  let speed = DEFAULT_ROUTE_SPEED;
  let depart: string | null = null;
  let how: NavRoute['how'] = 'manual';
  let busy = false;
  let selected: number | null = null;
  let line: Polyline | null = null;
  let dots: Marker[] = [];
  let extras: Marker[] = [];
  let panel: HTMLElement | null = null;
  let button: HTMLElement | null = null;

  const isOpen = () => line !== null;

  const save = () => {
    if (!route && points.length < 2) return;
    route = saveRoute({
      ...route,
      points,
      speed,
      depart,
      how,
    });
  };

  const change = (next: RoutePoint[]) => {
    history.push(points.map((point) => ({ ...point })));
    if (history.length > UNDO_STEPS) history = history.slice(-UNDO_STEPS);
    points = next;
    save();
  };

  const toScreen = (point: RoutePoint) =>
    map.latLngToContainerPoint([point.lat, point.lon]);

  /** A finger on an element: the point under it follows, the map stays. */
  const startDrag = (event: PointerEvent, drag: Drag) => {
    event.preventDefault();
    event.stopPropagation();
    map.dragging.disable();
    const box = map.getContainer().getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      if (
        !moved &&
        Math.hypot(next.clientX - startX, next.clientY - startY) < DRAG_PX
      ) {
        return;
      }
      moved = true;
      next.preventDefault();
      drag.move(
        map.containerPointToLatLng(
          L.point(next.clientX - box.left, next.clientY - box.top),
        ),
      );
    };
    const up = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return;
      globalThis.removeEventListener('pointermove', move);
      globalThis.removeEventListener('pointerup', up);
      globalThis.removeEventListener('pointercancel', up);
      map.dragging.enable();
      drag.end(moved);
    };
    globalThis.addEventListener('pointermove', move, { passive: false });
    globalThis.addEventListener('pointerup', up);
    globalThis.addEventListener('pointercancel', up);
  };

  const times = () => routeTimes({ points, speed, depart });

  const dotIcon = (index: number, at: number[] | null) => {
    const classes = ['route-pt'];
    if (index === 0) classes.push('route-first');
    if (index === points.length - 1 && index > 0) classes.push('route-last');
    if (index === selected) classes.push('route-sel');
    const time = at?.[index];
    const tag =
      time === undefined
        ? ''
        : `<span class="route-time">${fmtTime(new Date(time))}</span>`;
    return L.divIcon({
      className: classes.join(' '),
      html: `<span class="route-n">${index + 1}</span>${tag}`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  /** The line, the ＋ of each leg and the course and distance labels. */
  const drawLegs = () => {
    if (!line) return;
    line.setLatLngs(points.map((point) => [point.lat, point.lon]));
    for (const extra of extras) extra.remove();
    extras = [];
    for (const [index, leg] of routeLegs(points).entries()) {
      const pixels = toScreen(leg.from).distanceTo(toScreen(leg.to));
      const middle = midpoint(leg.from, leg.to);
      if (pixels >= LABEL_PX) {
        const text = `${String(leg.course).padStart(3, '0')}° · ${fr(leg.nm, leg.nm < 10 ? 2 : 1)} NM`;
        extras.push(
          L.marker([middle.lat, middle.lon], {
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: 'route-leg',
              html: `<span>${text}</span>`,
              iconSize: [0, 0],
            }),
          }).addTo(map),
        );
      }
      if (pixels >= MID_PX) extras.push(midHandle(index, middle));
    }
  };

  /** The ＋ of a leg: touched or pulled, it puts a new point there. */
  const midHandle = (index: number, middle: RoutePoint) => {
    const handle = L.marker([middle.lat, middle.lon], {
      keyboard: false,
      bubblingMouseEvents: false,
      zIndexOffset: 1900,
      icon: L.divIcon({
        className: 'route-mid',
        html: '<span>＋</span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
    }).addTo(map);
    const element = handle.getElement();
    if (element) {
      element.style.touchAction = 'none';
      element.addEventListener('pointerdown', (event) => {
        const next = points.map((point) => ({ ...point }));
        next.splice(index + 1, 0, { ...middle });
        change(next);
        selected = index + 1;
        buzz();
        drawAll();
        startDrag(event, dragPoint(index + 1));
      });
    }
    return handle;
  };

  /** Moving a point with a finger. */
  const dragPoint = (index: number): Drag => ({
    move: (at) => {
      const point = points[index];
      if (!point) return;
      points[index] = { ...point, lat: at.lat, lon: at.lng };
      dots[index]?.setLatLng(at);
      drawLegs();
      drawPanel();
    },
    end: (moved) => {
      if (moved) save();
      drawAll();
    },
  });

  const bindDot = (dot: Marker, index: number) => {
    const element = dot.getElement();
    if (!element) return;
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', (event) => {
      const before = points.map((point) => ({ ...point }));
      let held = false;
      const hold = setTimeout(() => {
        held = true;
        removePoint(index);
      }, HOLD_MS);
      const drag = dragPoint(index);
      startDrag(event, {
        move: (at) => {
          clearTimeout(hold);
          if (held) return;
          drag.move(at);
        },
        end: (moved) => {
          clearTimeout(hold);
          if (held) return;
          if (moved) {
            history.push(before);
            drag.end(true);
            return;
          }
          // A short touch chooses the point (to delete it from the panel).
          buzz();
          selected = selected === index ? null : index;
          drawAll();
        },
      });
    });
  };

  const removePoint = (index: number) => {
    buzz();
    const next = points.filter((_, rank) => rank !== index);
    change(next);
    selected = null;
    drawAll();
  };

  const drawDots = () => {
    for (const dot of dots) dot.remove();
    const at = times();
    dots = points.map((point, index) => {
      const dot = L.marker([point.lat, point.lon], {
        keyboard: false,
        bubblingMouseEvents: false,
        zIndexOffset: 2000,
        icon: dotIcon(index, at),
      }).addTo(map);
      bindDot(dot, index);
      return dot;
    });
  };

  const drawAll = () => {
    if (!isOpen()) return;
    if (selected !== null && selected >= points.length) selected = null;
    drawDots();
    drawLegs();
    drawPanel();
  };

  const drawPanel = () => {
    if (!panel) return;
    const name = route?.name ?? 'Nouvelle route';
    const summary = routeSummary({ points, speed });
    const at = times();
    const arrival =
      at && points.length > 1
        ? ` · arrivée ${fmtTime(new Date(at.at(-1) as number))}`
        : '';
    const sum = panel.querySelector('.rp-sum');
    if (sum) {
      sum.innerHTML = `<b>${escapeHtml(name)}</b> · ${escapeHtml(summary + arrival)}`;
    }
    const hint = panel.querySelector('.rp-hint');
    if (hint) {
      hint.textContent =
        points.length < 2
          ? 'Touchez la carte pour poser les points de la route, dans l’ordre.'
          : 'Toucher la carte : un point au bout · glisser un point : le déplacer · ＋ : plier · appui long : supprimer.';
    }
    const undo = panel.querySelector<HTMLButtonElement>('[data-rp="undo"]');
    if (undo) undo.disabled = history.length === 0;
    const drop = panel.querySelector<HTMLButtonElement>('[data-rp="drop"]');
    if (drop) {
      drop.hidden = selected === null;
      drop.textContent =
        selected === null ? '' : `🗑 ${pointName(points, selected)}`;
    }
    const goto = panel.querySelector<HTMLButtonElement>('[data-rp="goto"]');
    if (goto) goto.disabled = points.length < 2;
    const auto = panel.querySelector<HTMLButtonElement>('[data-rp="auto"]');
    if (auto) {
      auto.disabled = busy || points.length < 2;
      auto.textContent = busy ? '⏳ Calcul…' : '⛵ Contourner la terre';
    }
  };

  /** A line of the panel under the buttons: what the way round gave. */
  const say = (text: string, withCharts = false) => {
    const line = panel?.querySelector<HTMLElement>('.rp-msg');
    if (!line) return;
    line.hidden = text === '';
    line.innerHTML =
      escapeHtml(text) +
      (withCharts
        ? ' <button type="button" class="btn" data-rp="cartes">🗺 Fonds de cartes</button>'
        : '');
  };

  const sayAnswer = (answer: AutoAnswer, before: number, margin: number) => {
    if (answer.kind === 'no-map') {
      say(
        'Aucune carte hors ligne ne couvre toute la route : importez dans Fonds de cartes une carte (.pmtiles) de la zone, elle sert aussi sans réseau.',
        true,
      );
    } else if (answer.kind === 'no-water') {
      say('La carte hors ligne de la zone ne contient pas d’eau ici.', true);
    } else if (answer.kind === 'clear') {
      say(
        `Aucun segment ne coupe la terre ni la marge de ${margin} m. Roches et hauts-fonds ne sont pas vérifiés : regardez la carte marine.`,
      );
    } else if (answer.kind === 'done') {
      const after = routeNm(points);
      const parts = [
        `${answer.bent} segment${answer.bent > 1 ? 's' : ''} contourné${answer.bent > 1 ? 's' : ''} à ${margin} m de la côte au moins · ${fr(after, 1)} NM (+${fr(Math.max(0, after - before), 1)})`,
      ];
      for (const leg of answer.failed) {
        parts.push(
          `pas de passage trouvé entre ${pointName(points, leg)} et le point suivant`,
        );
      }
      parts.push(
        'Roches et hauts-fonds ne sont pas évités : vérifiez sur la carte marine.',
      );
      say(parts.join(' · '));
    }
  };

  const goAround = () => {
    if (busy || points.length < 2) return;
    busy = true;
    say('');
    drawPanel();
    const options = autoOptions();
    const before = routeNm(points);
    const shown = route?.id ?? null;
    const done = (answer: AutoAnswer | null) => {
      busy = false;
      // Closed, or another route opened, meanwhile: nothing to change.
      if (!isOpen() || (route?.id ?? null) !== shown) return;
      if (answer?.kind === 'done') {
        how = 'auto';
        change(answer.points);
      }
      drawAll();
      if (answer) {
        sayAnswer(answer, before, options.marginM);
      } else {
        say(
          'Le calcul n’a pas abouti : la carte hors ligne n’a pas pu être lue.',
        );
      }
      if (answer?.kind === 'done') fitRoute();
    };
    aroundLand(points, options).then(done, () => done(null));
  };

  const panelHtml = () => `
    <div class="rp-sum"></div>
    <div class="rp-hint"></div>
    <div class="rp-set">
      <label>Vitesse <input data-rp="speed" class="text" inputmode="decimal" enterkeyhint="done" value="${escapeHtml(fr(speed, 1))}" aria-label="Vitesse prévue, nœuds"> nd</label>
      <label>Départ <input data-rp="depart" class="text" type="datetime-local" value="${depart ? toLocalInput(new Date(depart)) : ''}" aria-label="Heure de départ prévue"></label>
    </div>
    <div class="rp-btns">
      <button type="button" class="btn" data-rp="undo">↶ Annuler</button>
      <button type="button" class="btn danger" data-rp="drop" hidden></button>
      <button type="button" class="btn" data-rp="goto">🎯 Go to</button>
      <button type="button" class="btn" data-rp="list">🧭 Routes</button>
      <button type="button" class="btn primary" data-rp="done">✓ Terminer</button>
    </div>
    <div class="rp-auto">
      <button type="button" class="btn" data-rp="auto">⛵ Contourner la terre</button>
      <label>Marge <input data-rp="margin" class="text" inputmode="numeric" enterkeyhint="done" value="${autoOptions().marginM}" aria-label="Distance à la côte, mètres"> m</label>
    </div>
    <div class="rp-msg" hidden></div>`;

  const onPanel = (action: string) => {
    buzz();
    if (action === 'undo') {
      const back = history.pop();
      if (!back) return;
      points = back;
      selected = null;
      save();
      drawAll();
    } else if (action === 'drop' && selected !== null) {
      removePoint(selected);
    } else if (action === 'goto' && points.length > 1) {
      const index = nextPointIndex(points, herePos());
      const point = points[index] as RoutePoint;
      close();
      setGoto({
        lat: point.lat,
        lon: point.lon,
        name: `${route?.name ?? 'Route'} · ${pointName(points, index)}`,
      });
    } else if (action === 'list') {
      close();
      go('routes');
    } else if (action === 'done') {
      close();
    } else if (action === 'auto') {
      goAround();
    } else if (action === 'cartes') {
      close();
      go('cartes');
    }
  };

  const makePanel = () => {
    const element = L.DomUtil.create('div', 'route-panel', map.getContainer());
    element.innerHTML = panelHtml();
    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);
    element.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-rp]',
      );
      const action = target?.dataset.rp;
      if (action && target instanceof HTMLButtonElement) onPanel(action);
    });
    element
      .querySelector<HTMLInputElement>('[data-rp="speed"]')
      ?.addEventListener('change', (event) => {
        const typed = readNumber((event.target as HTMLInputElement).value);
        if (typed === null || typed <= 0 || typed > 40) {
          toast('Vitesse entre 0,1 et 40 nœuds.');
          (event.target as HTMLInputElement).value = fr(speed, 1);
          return;
        }
        speed = typed;
        save();
        drawAll();
      });
    element
      .querySelector<HTMLInputElement>('[data-rp="margin"]')
      ?.addEventListener('change', (event) => {
        const input = event.target as HTMLInputElement;
        const typed = readNumber(input.value);
        if (typed === null || typed < 0 || typed > 5000) {
          toast('Marge entre 0 et 5000 m.');
          input.value = String(autoOptions().marginM);
          return;
        }
        saveAutoOptions({ ...autoOptions(), marginM: Math.round(typed) });
      });
    element
      .querySelector<HTMLInputElement>('[data-rp="depart"]')
      ?.addEventListener('change', (event) => {
        const typed = (event.target as HTMLInputElement).value;
        const date = typed ? new Date(typed) : null;
        depart =
          date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
        save();
        drawAll();
      });
    return element;
  };

  const onMapTap = (event: { latlng: LatLng }) => {
    if (!isOpen() || endsLongPress()) return;
    if (selected !== null) {
      // A tap beside lets the chosen point go.
      selected = null;
      drawAll();
      return;
    }
    buzz();
    change([...points, { lat: event.latlng.lat, lon: event.latlng.lng }]);
    drawAll();
  };

  const redrawLegs = () => drawLegs();

  /** The whole route on screen, above the panel and below the buttons. */
  const fitRoute = () => {
    if (points.length < 2) return;
    const covered = panel?.getBoundingClientRect().height ?? 0;
    map.fitBounds(
      L.latLngBounds(points.map((point) => [point.lat, point.lon])),
      {
        paddingTopLeft: [40, 110],
        paddingBottomRight: [40, covered + 30],
        animate: false,
      },
    );
  };

  const open = (id: string | null) => {
    close();
    route = id
      ? (state.data.routes.peek().find((item) => item.id === id) ?? null)
      : null;
    points = route ? route.points.map((point) => ({ ...point })) : [];
    speed = route?.speed ?? DEFAULT_ROUTE_SPEED;
    depart = route?.depart ?? null;
    how = route?.how ?? 'manual';
    busy = false;
    history = [];
    selected = null;
    routeEditing.value = true;
    setBodyClass('route-on', true);
    button?.classList.add('on');
    if (tracker.current?.map === map) setFollow(false);
    line = L.polyline([], {
      className: 'route-line',
      color: '#1452cc',
      weight: 4,
      opacity: 0.95,
      interactive: false,
    }).addTo(map);
    panel = makePanel();
    map.on('click', onMapTap);
    map.on('zoomend rotate', redrawLegs);
    if (points.length > 1) {
      fitRoute();
    } else if (points.length === 1) {
      const [only] = points as [RoutePoint];
      map.panTo([only.lat, only.lon]);
    }
    drawAll();
    if (!route) toast('Touchez la carte pour poser le premier point.');
  };

  function close() {
    if (!isOpen()) return;
    map.off('click', onMapTap);
    map.off('zoomend rotate', redrawLegs);
    for (const marker of [...dots, ...extras]) marker.remove();
    dots = [];
    extras = [];
    line?.remove();
    line = null;
    panel?.remove();
    panel = null;
    button?.classList.remove('on');
    routeEditing.value = false;
    setBodyClass('route-on', false);
    // A route left with fewer than two points is no route.
    if (route && points.length < 2) {
      removeRoute(route.id);
      toast(`${route.name} supprimée : moins de deux points.`);
    } else if (route) {
      toast(`${route.name} enregistrée · ${routeSummary({ points, speed })}`);
    }
    route = null;
  }

  const control = new L.Control({ position: 'topleft' }) as Control;
  control.onAdd = () => {
    const created = L.DomUtil.create('a', 'leaflet-bar map-full-btn route-btn');
    button = created;
    created.href = '#';
    created.setAttribute('role', 'button');
    created.title = 'Route : poser des points sur la carte';
    created.innerHTML = ROUTE_ICON;
    L.DomEvent.on(created, 'click', (event) => {
      L.DomEvent.stop(event);
      buzz();
      if (isOpen()) close();
      else open(null);
    });
    L.DomEvent.disableClickPropagation(created);
    return created;
  };
  map.addControl(control);
  openers.set(map, open);
  map.on('unload', close);
  if (pending) {
    const id = pending === 'new' ? null : pending;
    pending = null;
    // Once the map has its size and its place.
    setTimeout(() => {
      if (map.getContainer().isConnected) open(id);
    }, 250);
  }
}

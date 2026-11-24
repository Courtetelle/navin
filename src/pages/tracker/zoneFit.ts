import type { Map as LeafletMap } from 'leaflet';

import type { ZoneBox } from '../../features/zones/meteoZones.ts';

/** At most this share of the height is kept clear at the top or bottom. */
const MOST_SHARE = 0.45;
/** Margin around the zones, px. */
const MARGIN = 12;
/** Zoom in quarter steps on the zones, so that they fill the screen. */
const FIT_SNAP = 0.25;

/** Room kept clear on each side of the screen, px. */
export interface Edges {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A box on the screen, px from the top left corner. */
export interface ScreenBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The room the buttons take on each side of the screen. A button of the rails
 * (in columns down the sides, or a row along an edge) covers the edge it is
 * nearest to (the LiveMétéo column with them); the chooser of the zones
 * covers the top or the bottom. Before, the columns of the rails counted as top and bottom: with
 * a column from top to bottom, almost no height was left and the map zoomed
 * out on all Europe.
 * @param rails - Boxes of the rail buttons.
 * @param rows - Boxes of the chooser of the zones.
 * @param width - Width of the window, px.
 * @param height - Height of the window, px.
 * @returns Pixels to keep clear on each side.
 */
export function edgesOf(
  rails: readonly ScreenBox[],
  rows: readonly ScreenBox[],
  width: number,
  height: number,
): Edges {
  const edges: Edges = { top: 0, bottom: 0, left: 0, right: 0 };
  const seen = (box: ScreenBox) =>
    box.right > box.left &&
    box.bottom > box.top &&
    box.bottom >= 0 &&
    box.top <= height &&
    box.right >= 0 &&
    box.left <= width;
  const upDown = (box: ScreenBox) => {
    if ((box.top + box.bottom) / 2 < height / 2) {
      edges.top = Math.max(edges.top, box.bottom);
    } else {
      edges.bottom = Math.max(edges.bottom, height - box.top);
    }
  };
  for (const box of rails.filter(seen)) {
    // The side it costs least to keep clear, as a share of the screen: a
    // column along the right edge takes the right, a lone button in a top
    // corner takes a strip of the top rather than the whole left side.
    const left = box.right / width;
    const right = (width - box.left) / width;
    const top = box.bottom / height;
    const bottom = (height - box.top) / height;
    if (Math.min(left, right) <= Math.min(top, bottom)) {
      if (left <= right) edges.left = Math.max(edges.left, box.right);
      else edges.right = Math.max(edges.right, width - box.left);
    } else {
      upDown(box);
    }
  }
  for (const box of rows.filter(seen)) upDown(box);
  return {
    top: Math.min(edges.top, height * MOST_SHARE),
    bottom: Math.min(edges.bottom, height * MOST_SHARE),
    left: Math.min(edges.left, width * MOST_SHARE),
    right: Math.min(edges.right, width * MOST_SHARE),
  };
}

const boxesOf = (selector: string): ScreenBox[] =>
  [...document.querySelectorAll(selector)].map((element) =>
    element.getBoundingClientRect(),
  );

/**
 * The room the buttons and the chooser of the zones take on each side of
 * the screen, so that the zones are shown in the part left free.
 * @param width - Width of the window, px.
 * @param height - Height of the window, px.
 * @returns Pixels to keep clear on each side.
 */
export function coveredEdges(width: number, height: number): Edges {
  // The LiveMétéo buttons stand in a column at the right edge (since 23/11):
  // they count as rail buttons, on the side they are nearest to. Counted as
  // rows, the column took the top and the bottom and the zones were zoomed
  // out to a stamp in the middle of the screen (Corban, 24/11).
  return edgesOf(
    boxesOf('.rail-btn, .live-slot'),
    boxesOf('.zone-pick'),
    width,
    height,
  );
}

/**
 * Zoom the map on the zones chosen, in the part of the screen the buttons
 * and the chooser leave free.
 * @param map - The map of NavIn.
 * @param box - The box of the zones.
 */
export function fitZones(map: LeafletMap, box: ZoneBox): void {
  const { top, bottom, left, right } = coveredEdges(
    globalThis.innerWidth,
    globalThis.innerHeight,
  );
  // Whole steps of zoom left the zones a stamp, at worst half the room
  // (Corban, 24/11): the fit takes quarter steps.
  const snap = map.options.zoomSnap;
  map.options.zoomSnap = FIT_SNAP;
  try {
    map.fitBounds(
      [
        [box.south, box.west],
        [box.north, box.east],
      ],
      {
        paddingTopLeft: [left + MARGIN, top + MARGIN],
        paddingBottomRight: [right + MARGIN, bottom + MARGIN],
      },
    );
  } finally {
    map.options.zoomSnap = snap;
  }
}

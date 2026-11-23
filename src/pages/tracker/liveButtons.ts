/** Left untouched this long, the buttons start to fade… */
export const LIVE_SOLID_MS = 6000;
/** …and are gone after this long more. */
export const LIVE_FADE_MS = 3000;
/** Space between two buttons, as in the column, px. */
export const GAP = 10;
/** Space kept to the edges of the screen, px. */
const EDGE = 8;

/** Where the row stands and how large each button is. */
export interface Place {
  left: number;
  top: number;
  width: number;
  height: number;
  perRow: number;
  /** Rows go up from the first (no room at the right of Météo). */
  up: boolean;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The fixed buttons of the screen the row must not cover. */
function obstacles(): Box[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '.rail-btn, header.topbar .top-tab, #gearBtn, #clock',
    ),
  ]
    .filter((element) => !element.closest('.live-btns'))
    .map((element) => element.getBoundingClientRect())
    .filter((box) => box.width > 0 && box.height > 0);
}

function meets(first: Box, second: Box): boolean {
  return (
    first.left < second.right - 1 &&
    second.left < first.right - 1 &&
    first.top < second.bottom - 1 &&
    second.top < first.bottom - 1
  );
}

/**
 * The boxes of the buttons of a place.
 * @param place - The place.
 * @param count - How many buttons.
 * @returns Their boxes.
 */
export function placeBoxes(place: Place, count: number): Box[] {
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / place.perRow);
    const col = index % place.perRow;
    const left = place.left + col * (place.width + GAP);
    const top = place.top + (place.up ? -1 : 1) * row * (place.height + GAP);
    return {
      left,
      top,
      right: left + place.width,
      bottom: top + place.height,
    };
  });
}

/**
 * Where the buttons go, of the size of Météo: in a row at its right; else
 * at its left; else in rows above its row, from the left edge, then from
 * the right edge. The first place that covers no other button and stays on
 * the screen wins.
 * @param count - How many buttons.
 * @returns The place, or null without Météo.
 */
export function livePlace(count: number): Place | null {
  const weather = document.querySelector<HTMLElement>('.rail-weather');
  if (!weather) return null;
  const seen = weather.getBoundingClientRect();
  if (seen.width === 0) return null;
  // Its size without the squeeze of a press (Météo just long-pressed).
  const width = weather.offsetWidth;
  const height = weather.offsetHeight;
  const left = seen.left + seen.width / 2 - width / 2;
  const top = seen.top + seen.height / 2 - height / 2;
  const right = left + width;
  const bottom = top + height;
  const screenW = globalThis.innerWidth;
  const screenH = globalThis.innerHeight;
  const step = width + GAP;
  const perRow = Math.max(1, Math.floor((screenW - 2 * EDGE + GAP) / step));
  const rowWidth = Math.min(count, perRow) * step - GAP;
  const above = top - GAP - height;
  const tries: Place[] = [
    {
      left: right + GAP,
      top,
      width,
      height,
      perRow: count,
      up: false,
    },
    {
      left: left - count * step,
      top,
      width,
      height,
      perRow: count,
      up: false,
    },
    { left: EDGE, top: above, width, height, perRow, up: true },
    {
      left: screenW - EDGE - rowWidth,
      top: above,
      width,
      height,
      perRow,
      up: true,
    },
    { left: EDGE, top: bottom + GAP, width, height, perRow, up: false },
  ];
  const others = obstacles();
  const fits = (place: Place) =>
    placeBoxes(place, count).every(
      (one) =>
        one.left >= EDGE - 1 &&
        one.right <= screenW - EDGE + 1 &&
        one.top >= 0 &&
        one.bottom <= screenH &&
        !others.some((other) => meets(one, other)),
    );
  return tries.find(fits) ?? tries[2] ?? null;
}

/**
 * The other LiveMétéo buttons in a column down the right edge, centred in
 * the height; a second column to its left when one is not enough.
 * @param count - How many buttons.
 * @param width - Width of one, px.
 * @param height - Height of one, px.
 * @returns Their boxes, top to bottom.
 */
export function columnBoxes(
  count: number,
  width: number,
  height: number,
): Box[] {
  const screenW = globalThis.innerWidth;
  const screenH = globalThis.innerHeight;
  const step = height + GAP;
  const perColumn = Math.max(1, Math.floor((screenH - 2 * EDGE + GAP) / step));
  const columns = Math.ceil(count / perColumn);
  const rows = Math.ceil(count / columns);
  const top = Math.max(EDGE, (screenH - (rows * step - GAP)) / 2);
  return Array.from({ length: count }, (_, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    const left = screenW - EDGE - (column + 1) * width - column * GAP;
    const y = top + row * step;
    return { left, top: y, right: left + width, bottom: y + height };
  });
}

/** What the screen gap is measured from. */
export interface ScreenSizes {
  /** Opened from the home screen (no Safari bars). */
  standalone: boolean;
  /** `screen.width` and `screen.height` (an iPhone keeps them upright). */
  screenWidth: number;
  screenHeight: number;
  /** `innerWidth` and `innerHeight`. */
  width: number;
  height: number;
}

/**
 * How much of the screen the page is not told about: an iPhone opened from
 * the home screen, its status bar see-through, gives the page a height short
 * by that bar, and a grey band stays at the bottom.
 * @param sizes - The sizes read.
 * @returns The missing height in pixels, 0 elsewhere.
 */
export function screenGap(sizes: ScreenSizes): number {
  if (!sizes.standalone) return 0;
  const long = Math.max(sizes.screenWidth, sizes.screenHeight);
  const short = Math.min(sizes.screenWidth, sizes.screenHeight);
  const full = sizes.height >= sizes.width ? long : short;
  const gap = full - sizes.height;
  // Only the height of a status bar: never a keyboard or a split screen.
  return gap > 0 && gap <= 80 ? gap : 0;
}

function standalone(): boolean {
  const apple = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    apple === true ||
    (globalThis.matchMedia?.('(display-mode: standalone)').matches ?? false)
  );
}

/**
 * The side of the camera of a phone turned sideways.
 * @param angle - Turn of the screen: 90 counterclockwise, 270 clockwise.
 * @param landscape - The screen is wider than tall.
 * @returns `left`, `right`, `bottom` (upright, turned over), or `null`.
 */
export function cameraSide(
  angle: number,
  landscape: boolean,
): 'left' | 'right' | 'bottom' | null {
  const turn = ((angle % 360) + 360) % 360;
  if (!landscape) return turn === 180 ? 'bottom' : null;
  if (turn === 90) return 'left';
  if (turn === 270) return 'right';
  return null;
}

function screenAngle(): number {
  const legacy = (globalThis as { orientation?: unknown }).orientation;
  if (typeof legacy === 'number') return legacy;
  return globalThis.screen.orientation?.angle ?? 0;
}

/**
 * How far above the real bottom of the screen a button held at the bottom
 * stands: measured, as iOS does not always lay them as it tells.
 * @param gap - The missing height of the page.
 * @returns Pixels to move them down.
 */
function fixedGap(gap: number): number {
  if (gap <= 0 || !document.body) return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
  document.body.append(probe);
  const bottom = probe.getBoundingClientRect().bottom;
  probe.remove();
  const full = globalThis.innerHeight + gap;
  const missing = Math.round(full - bottom);
  return missing > 0 && missing <= gap ? missing : 0;
}

function apply(): void {
  const side = cameraSide(
    screenAngle(),
    globalThis.innerWidth > globalThis.innerHeight,
  );
  const root = document.documentElement.classList;
  root.toggle('cam-left', side === 'left');
  root.toggle('cam-right', side === 'right');
  root.toggle('cam-bottom', side === 'bottom');
  const gap = screenGap({
    standalone: standalone(),
    screenWidth: globalThis.screen.width,
    screenHeight: globalThis.screen.height,
    width: globalThis.innerWidth,
    height: globalThis.innerHeight,
  });
  const style = document.documentElement.style;
  style.setProperty('--screen-gap', `${gap}px`);
  // The buttons held at the bottom: only what their own bottom misses.
  style.setProperty('--fixed-gap', `${fixedGap(gap)}px`);
}

/** The page is measured again this long after opening (ms). */
const SETTLE_MS = [100, 400, 1000, 2500];

/** Keep `--screen-gap` right as the phone turns. */
export function followScreenGap(): void {
  apply();
  // At the opening iOS lays the page out in several steps: measured again
  // once it has settled, and whenever the app comes back to the screen.
  for (const delay of SETTLE_MS) setTimeout(apply, delay);
  globalThis.addEventListener('load', apply);
  globalThis.addEventListener('pageshow', apply);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      for (const delay of SETTLE_MS) setTimeout(apply, delay);
    }
  });
  globalThis.visualViewport?.addEventListener('resize', apply);
  globalThis.addEventListener('resize', apply);
  globalThis.addEventListener('orientationchange', () => {
    setTimeout(apply, 300);
  });
}

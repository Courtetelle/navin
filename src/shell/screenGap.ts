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
  document.documentElement.style.setProperty('--screen-gap', `${gap}px`);
}

/** Keep `--screen-gap` right as the phone turns. */
export function followScreenGap(): void {
  apply();
  globalThis.addEventListener('resize', apply);
  globalThis.addEventListener('orientationchange', () => {
    setTimeout(apply, 300);
  });
}

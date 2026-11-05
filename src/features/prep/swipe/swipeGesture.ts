/** Horizontal or vertical movement that decides what the finger is doing. */
const START_DISTANCE_PX = 12;
/** Movement to the left under which the row just springs back. */
const CONFIRM_DISTANCE_PX = 70;
/** The row follows the finger up to this distance. */
const MAX_SHIFT_PX = 140;
/** The click that ends a swipe is swallowed during this time. */
const SWALLOW_DELAY_MS = 400;

interface Gesture {
  element: HTMLElement;
  startX: number;
  startY: number;
  shift: number;
  moving: boolean;
  onSwiped: () => void;
}

let gesture: Gesture | null = null;
let swiped = false;

/**
 * Follow a finger from a pointer down on a row (prep.js:1228-1259). The row
 * slides left under the finger; `onSwiped` runs when it was released far
 * enough. A vertical movement gives the gesture back to the page scroll.
 * @param element - Element that slides.
 * @param event - The pointer down.
 * @param event.clientX - Horizontal position.
 * @param event.clientY - Vertical position.
 * @param onSwiped - Runs after a complete swipe.
 */
export function startSwipe(
  element: HTMLElement,
  event: { clientX: number; clientY: number },
  onSwiped: () => void,
): void {
  gesture = {
    element,
    startX: event.clientX,
    startY: event.clientY,
    shift: 0,
    moving: false,
    onSwiped,
  };
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('pointercancel', onCancel, true);
}

/**
 * Whether the click being handled ends a swipe; it must then be swallowed
 * (prep.js:1267). Reading it consumes the flag.
 * @returns `true` once after a swipe.
 */
export function consumeSwipedClick(): boolean {
  const consumed = swiped;
  swiped = false;
  return consumed;
}

/**
 * Whether a pointer movement started a horizontal swipe, ended the gesture, or
 * is still undecided.
 * @param deltaX - Movement to the right.
 * @param deltaY - Movement downwards.
 * @returns The decision.
 */
export function swipeDecision(
  deltaX: number,
  deltaY: number,
): 'swipe' | 'scroll' | 'wait' {
  const horizontal = Math.abs(deltaX);
  const vertical = Math.abs(deltaY);
  if (vertical > START_DISTANCE_PX && vertical > horizontal) return 'scroll';
  if (deltaX < -START_DISTANCE_PX && horizontal > vertical) return 'swipe';
  return 'wait';
}

/**
 * Whether a released swipe went far enough to ask for the deletion.
 * @param shift - Movement to the left, negative.
 * @returns `true` when the confirmation opens.
 */
export function swipeConfirms(shift: number): boolean {
  return shift <= -CONFIRM_DISTANCE_PX;
}

function onMove(event: PointerEvent): void {
  if (!gesture) return;
  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (!gesture.moving) {
    const decision = swipeDecision(deltaX, deltaY);
    if (decision === 'scroll') {
      release();
      return;
    }
    if (decision === 'wait') return;
    gesture.moving = true;
  }
  gesture.shift = Math.min(0, deltaX);
  gesture.element.classList.add('sw-moving');
  gesture.element.style.transform = `translateX(${Math.max(gesture.shift, -MAX_SHIFT_PX)}px)`;
}

function onUp(): void {
  const ended = gesture;
  release();
  if (!ended) return;
  spring(ended);
  if (!ended.moving) return;
  swiped = true;
  setTimeout(() => {
    swiped = false;
  }, SWALLOW_DELAY_MS);
  if (swipeConfirms(ended.shift)) ended.onSwiped();
}

function onCancel(): void {
  if (gesture) spring(gesture);
  release();
}

function spring(ended: Gesture): void {
  ended.element.style.transform = '';
  ended.element.classList.remove('sw-moving');
}

function release(): void {
  gesture = null;
  document.removeEventListener('pointermove', onMove, true);
  document.removeEventListener('pointerup', onUp, true);
  document.removeEventListener('pointercancel', onCancel, true);
}

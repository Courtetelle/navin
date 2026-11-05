import { APP_VERSION } from '../../model/taskTemplate.ts';
import { state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** One remark kept on the phone (`ldb.remarks`). */
export interface Remark {
  /** ISO time. */
  t: string;
  /** Text with its context line. */
  text: string;
  /** Delivered to Claude. */
  sent: boolean;
}

const LIST = 'ldb.remarks';

/**
 * Remarks kept on the phone.
 * @returns The list, oldest first.
 */
export function remarks(): Remark[] {
  return store.get<Remark[]>(LIST, []);
}

/**
 * Keep the remarks (200 last).
 * @param list - Remarks, oldest first.
 */
export function saveRemarks(list: readonly Remark[]): void {
  try {
    localStorage.setItem(LIST, JSON.stringify(list.slice(-200)));
  } catch {
    // Storage full or blocked: the remark is only copied.
  }
}

/**
 * The element under the centre of the pill, as its closest meaningful
 * ancestor (nav.js:1388-1394).
 * @param pill - The pill.
 * @returns The element aimed at, or null.
 */
export function targetUnder(pill: HTMLElement): Element | null {
  const box = pill.getBoundingClientRect();
  pill.style.pointerEvents = 'none';
  const element = document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  );
  pill.style.pointerEvents = '';
  if (
    !element ||
    element === document.body ||
    element === document.documentElement
  ) {
    return null;
  }
  return (
    element.closest(
      'button, a, input, textarea, select, label, summary, .pl-it, h1, h2, h3, figure, .ck-item, .lab-row, .cf, section, details',
    ) ?? element
  );
}

/**
 * Short text of an element (nav.js:1397).
 * @param element - Element aimed at.
 * @returns Up to 140 characters.
 */
export function snippet(element: Element | null): string {
  if (!element) return '';
  const html = element as HTMLElement & {
    value?: string;
    placeholder?: string;
  };
  const raw =
    html.textContent ||
    html.value ||
    element.getAttribute('aria-label') ||
    html.placeholder ||
    '';
  return raw.replaceAll('ⓘ', '').replaceAll(/\s+/g, ' ').trim().slice(0, 140);
}

/**
 * Context line appended to a remark (nav.js:1398-1403): version, page title
 * and view, element aimed at.
 * @param element - Element aimed at.
 * @returns The bracketed context.
 */
export function remarkContext(element: Element | null): string {
  const view = state.view.currentView.value;
  const title = (
    document.querySelector<HTMLElement>('#view h1')?.textContent ?? ''
  )
    .replaceAll('ⓘ', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  const target = element ? ` · élément « ${snippet(element)} »` : '';
  return `[NavIn ${APP_VERSION} · page « ${title || view} » (${view})${target}]`;
}

/** The comments capability of the claude.ai preview (`window.claude.use('comments')`). */
export interface CommentsApi {
  anchorFor: (element: Element) => Promise<unknown>;
  sendToClaude: (input: { anchor: unknown; text: string }) => Promise<unknown>;
  canSendToClaude: () => Promise<string>;
  create: (input: { anchor: unknown; text: string }) => Promise<unknown>;
}

let comments: CommentsApi | null = null;

/**
 * Ask the preview for its comments capability, once (nav.js:1363).
 * @returns The capability when granted.
 */
export function commentsApi(): CommentsApi | null {
  return comments;
}

/** Ask the claude.ai preview for its comments capability (nav.js:1363). */
export function requestComments(): void {
  const claude = (
    globalThis as { claude?: { use?: (name: string) => Promise<unknown> } }
  ).claude;
  if (typeof claude?.use !== 'function') return;
  claude
    .use('comments')
    .then((api) => {
      comments = api as CommentsApi;
    })
    .catch(() => undefined);
}

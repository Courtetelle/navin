import { BUILD_ID } from '../../model/buildId.ts';
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
  /** Copied to be pasted in the conversation. */
  copied?: boolean;
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

/** Longest text still read as the name of one item of the map. */
const MAP_ITEM_LENGTH = 30;

/**
 * Name of an element for the reader. The text of the whole map is only a run of
 * mark and layer names, so it is simply called « Carte »; a mark keeps its name.
 * @param element - Element aimed at.
 * @returns The name, empty when the element has no text.
 */
export function targetName(element: Element | null): string {
  const text = snippet(element);
  if (!element?.closest('.leaflet-container')) return text;
  return text && text.length <= MAP_ITEM_LENGTH ? text : 'Carte';
}

/**
 * Text to paste in the conversation.
 * @param list - Remarks to join.
 * @returns One text, remarks separated by a line.
 */
export function remarksDigest(list: readonly Remark[]): string {
  return list.map((remark) => remark.text).join('\n\n――――\n\n');
}

/**
 * Remarks not yet given to Claude.
 * @param list - Remarks.
 * @returns Those neither sent nor copied.
 */
export function pendingRemarks(list: readonly Remark[]): Remark[] {
  return list.filter((remark) => !remark.sent && !remark.copied);
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
  const target = element ? ` · élément « ${targetName(element)} »` : '';
  return `[NavIn ${APP_VERSION} (${BUILD_ID}) · page « ${title || view} » (${view})${target}]`;
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

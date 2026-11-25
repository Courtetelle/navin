/**
 * When the top bar clock shows UTC, every time of day on screen turns red:
 * the times are found in the texts of the page and painted with the CSS
 * Custom Highlight API (`::highlight(utc-time)`), without touching the
 * elements React or Leaflet own. The formats themselves follow the clock
 * (`src/lib/clockMode.ts`), so a red time is a UTC time.
 *
 * Left alone: fields being typed in, the clock itself (it has its own
 * colours), the names of the lists (`.b-nm`: a name keeps the hour it was
 * given), and what is marked `data-no-hr` (texts the user wrote, times that
 * stay local such as opening hours).
 */

import { effect } from '@preact/signals-react';

import { utcClock } from '../lib/clockMode.ts';
import { timeSpans } from '../lib/timeMatches.ts';

/** The highlight of times on a light or dark background. */
const NAME = 'utc-time';
/** The highlight of times on a red background, where red would not show. */
const ON_RED = 'utc-time-on-red';
/** Texts never painted. */
const SKIP =
  '[data-no-hr], .b-nm, #clock, input, textarea, select, script, style, noscript, [contenteditable="true"], [contenteditable=""]';

interface Painted {
  ranges: Range[];
  highlight: Highlight;
}

let painted = new Map<Text, Painted>();
let observer: MutationObserver | null = null;
let queued = new Set<Node>();
let frame = 0;
let prune = false;

/**
 * Paint the times of the screen in red while the clock shows UTC, from the
 * start of the app.
 */
export function installUtcHighlight(): void {
  const registry = globalThis.CSS?.highlights;
  if (!registry || typeof Highlight === 'undefined') return;
  const normal = new Highlight();
  const onRed = new Highlight();
  registry.set(NAME, normal);
  registry.set(ON_RED, onRed);
  effect(() => {
    if (utcClock.value) start(normal, onRed);
    else stop(normal, onRed);
  });
}

function start(normal: Highlight, onRed: Highlight): void {
  if (observer) return;
  const highlights = { normal, onRed };
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') queued.add(record.target);
      for (const node of record.addedNodes) queued.add(node);
      if (record.removedNodes.length > 0) prune = true;
    }
    schedule(highlights);
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  queued.add(document.body);
  schedule(highlights);
}

function stop(normal: Highlight, onRed: Highlight): void {
  observer?.disconnect();
  observer = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  queued = new Set();
  painted = new Map();
  normal.clear();
  onRed.clear();
}

function schedule(highlights: { normal: Highlight; onRed: Highlight }): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    flush(highlights);
  });
}

function flush(highlights: { normal: Highlight; onRed: Highlight }): void {
  if (prune) {
    prune = false;
    for (const [text, done] of painted) {
      if (!text.isConnected) unpaint(text, done);
    }
  }
  const nodes = queued;
  queued = new Set();
  for (const node of nodes) {
    if (!node.isConnected) continue;
    if (node instanceof Text) {
      paint(node, highlights);
      continue;
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      paint(text as Text, highlights);
    }
  }
}

function unpaint(text: Text, done: Painted): void {
  for (const range of done.ranges) done.highlight.delete(range);
  painted.delete(text);
}

function paint(
  text: Text,
  highlights: { normal: Highlight; onRed: Highlight },
): void {
  const before = painted.get(text);
  if (before) unpaint(text, before);
  const parent = text.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const spans = timeSpans(text.data);
  if (spans.length === 0) return;
  const highlight = onRedBackground(parent)
    ? highlights.onRed
    : highlights.normal;
  const ranges = spans.map(([from, to]) => {
    const range = new Range();
    range.setStart(text, from);
    range.setEnd(text, to);
    highlight.add(range);
    return range;
  });
  painted.set(text, { ranges, highlight });
}

/**
 * The text stands on a red background (an alert, an SOS button): red letters
 * would not show there.
 * @param element - The element of the text.
 * @returns The first opaque background behind it is red.
 */
function onRedBackground(element: Element): boolean {
  for (
    let current: Element | null = element;
    current;
    current = current.parentElement
  ) {
    const color = globalThis.getComputedStyle(current).backgroundColor;
    const rgb =
      /rgba?\((?<red>\d+), (?<green>\d+), (?<blue>\d+)(?:, (?<alpha>[\d.]+))?\)/u.exec(
        color,
      )?.groups;
    if (!rgb) continue;
    if (rgb.alpha !== undefined && Number(rgb.alpha) < 0.5) continue;
    return (
      Number(rgb.red) > 150 && Number(rgb.green) < 110 && Number(rgb.blue) < 110
    );
  }
  return false;
}

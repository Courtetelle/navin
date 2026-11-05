import { buzz } from '../../lib/dom.ts';
import { VIEW_LABELS } from '../../model/views.ts';
import { sosLogActive, sosLogAdd, state, toast } from '../../state/index.ts';

import {
  simulationStep,
  sosExEnd,
  sosExOn,
  sosExStart,
  sosSimToggle,
  sosSimulation,
  watchSosPage,
} from './sosExercise.ts';

/**
 * Install what legacy ran for the whole app: the pause of the SOS log, the
 * exercise and simulation buttons, the calls blocked during an exercise, the
 * note of every touch during a procedure, and the position timers.
 */
export function installSosListeners(): void {
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('click', onExerciseClick, true);
  document.addEventListener('click', onSimulationClick, true);
  document.addEventListener('click', onTouchLogged, true);
  setInterval(() => {
    if (sosSimulation()) simulationStep();
    else readPosition();
  }, 5000);
  setTimeout(readPosition, 1500);
  setInterval(() => {
    watchSosPage(readPosition);
  }, 1000);
}

function onVisibilityChange(): void {
  if (!sosLogActive()) return;
  if (document.visibilityState === 'hidden') {
    sosLogAdd('Application quittée : log en pause', 'pause');
    return;
  }
  sosLogAdd(
    'Application rouverte : log repris (procédure SOS pas terminée)',
    'resume',
  );
  setTimeout(() => {
    toast('🆘 Procédure SOS en cours · log repris');
  }, 300);
}

function closestOf(event: MouseEvent, selector: string): HTMLElement | null {
  const target = event.target as Element | null;
  return target?.closest?.<HTMLElement>(selector) ?? null;
}

function onExerciseClick(event: MouseEvent): void {
  const button = closestOf(event, '[data-sosex]');
  if (button) {
    event.stopPropagation();
    event.preventDefault();
    buzz();
    const kind = button.dataset.sosex ?? '';
    if (kind === 'end') sosExEnd();
    else sosExStart(kind);
    return;
  }
  if (!sosExOn()) return;
  const link = closestOf(event, 'a[href^="tel:"], a[href^="sms:"]');
  if (!link) return;
  event.preventDefault();
  event.stopPropagation();
  const number = (link.getAttribute('href') ?? '').replace(/^(?:tel|sms):/, '');
  sosLogAdd(`🧪 Exercice : appel au ${number} (non passé)`, 'note');
  // `openLink` clicks a bare anchor it appended to the body.
  toast(
    link.parentElement === document.body
      ? `🧪 Exercice : l’appel au ${number} n’est pas passé.`
      : `🧪 Exercice : l’appel au ${number} n’est pas passé. En vrai, le téléphone appellerait ce numéro.`,
  );
}

function onSimulationClick(event: MouseEvent): void {
  const button = closestOf(event, '[data-sossim]');
  if (!button) return;
  event.stopPropagation();
  sosSimToggle(button.dataset.sossim ?? '');
}

function onTouchLogged(event: MouseEvent): void {
  const touched = closestOf(
    event,
    'button, a, [data-step], [role="button"], summary',
  );
  if (!touched) return;
  // Legacy logged after the tab had reacted, so with the screen it opened.
  if (touched.closest('.top-tab')) setTimeout(() => noteTouch(touched), 0);
  else noteTouch(touched);
}

function noteTouch(touched: HTMLElement): void {
  const view = state.view.currentView.value;
  if (!sosLogActive() || view === 'soslogs') return;
  if (touched.closest('.top-tab.tab-sos, [data-sosend]')) return;
  const label =
    touched.dataset.label ||
    renderedText(touched) ||
    touched.getAttribute('aria-label') ||
    '';
  const text = label.replaceAll(/\s+/g, ' ').trim().slice(0, 90);
  if (!text) return;
  const page = VIEW_LABELS[view] || view;
  const href = touched.getAttribute('href');
  const number = href?.startsWith('tel:') ? ` (${href.slice(4)})` : '';
  sosLogAdd(`${page} › ${text}${number}`);
}

// The log keeps the text as shown: `textContent` would glue a button's label to
// its `small` line and ignore the upper-case styles.
function renderedText(element: HTMLElement): string {
  return Reflect.get(element, 'innerText');
}

function readPosition(): void {
  if (sosSimulation()) {
    simulationStep();
    return;
  }
  if (state.view.currentView.value !== 'sos' || !sosLogActive()) return;
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (fix) => {
      state.view.sosLive.value = {
        lat: fix.coords.latitude,
        lon: fix.coords.longitude,
        at: new Date().toISOString(),
      };
    },
    () => undefined,
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000 },
  );
}

import { effect } from '@preact/signals-react';

import { buzz } from '../lib/dom.ts';
import { state, toast, updateSettings } from '../state/index.ts';

/**
 * Apply the day / night theme whenever the setting changes (legacy
 * `applyTheme`, app.js:585): `data-theme` on `<html>` and the browser bar
 * colour (the `☀︎` / `☾` of `#themeBtn` is rendered by the top bar).
 * @returns Stops following the setting.
 */
export function followTheme(): () => void {
  return effect(() => {
    const night = state.preferences.settings.value.theme === 'night';
    document.documentElement.dataset.theme =
      state.preferences.settings.value.theme;
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (meta) meta.content = night ? '#000000' : '#f3f5f8';
  });
}

/** Switch day / night and save it (the hidden `#themeBtn`, app.js:3298). */
export function toggleTheme(): void {
  buzz();
  updateSettings((settings) => {
    settings.theme = settings.theme === 'night' ? 'day' : 'night';
  });
}

/** Long press on the gear: night mode, and back to day (app.js:3294). */
export function toggleThemeFromGear(): void {
  buzz();
  updateSettings((settings) => {
    settings.theme = settings.theme === 'night' ? 'day' : 'night';
  });
  toast(
    state.preferences.settings.value.theme === 'night'
      ? '☾ Mode nuit · appui long sur la roue pour revenir au jour'
      : '☀︎ Mode jour',
  );
}

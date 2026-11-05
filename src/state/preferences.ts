import { signal } from '@preact/signals-react';
import { produce } from 'immer';

import type { Settings } from '../model/settings.ts';
import { SETTINGS_DEFAULTS } from '../model/settings.ts';
import { store } from '../storage/store.ts';

/** Preferences bucket: the user settings. */
export const preferences = {
  /** User settings (`ldb.settings`), always holding the defaults. */
  settings: signal<Settings>({ ...SETTINGS_DEFAULTS }),
};

/**
 * Load the settings from storage with the legacy defaults and one-shot
 * migrations (screen kept on by default once, `noPopups` → `noHelpI`).
 */
export function loadSettings(): void {
  const settings: Settings = {
    ...SETTINGS_DEFAULTS,
    ...store.get<Partial<Settings>>('ldb.settings', {}),
  };
  if (!store.get('ldb.wakeDef', false)) {
    settings.wake = true;
    store.set('ldb.settings', settings);
    store.set('ldb.wakeDef', true);
  }
  if (settings.noPopups != null) {
    if (settings.noHelpI == null) settings.noHelpI = Boolean(settings.noPopups);
    delete settings.noPopups;
    store.set('ldb.settings', settings);
  }
  settings.vhf = settings.vhf || {};
  if (!settings.windOn423) {
    settings.windAlert = { ...settings.windAlert, on: true, basis: 'gust' };
    settings.windOn423 = true;
    store.set('ldb.settings', settings);
  }
  preferences.settings.value = settings;
}

/**
 * Persist the current settings (legacy `saveSettings`).
 * @returns `true` when written.
 */
export function saveSettings(): boolean {
  return store.set('ldb.settings', preferences.settings.value);
}

/**
 * Change the settings with an immer recipe, then persist them.
 * @param recipe - Mutates the draft settings.
 * @returns `true` when written.
 */
export function updateSettings(recipe: (draft: Settings) => void): boolean {
  preferences.settings.value = produce(preferences.settings.value, recipe);
  return saveSettings();
}

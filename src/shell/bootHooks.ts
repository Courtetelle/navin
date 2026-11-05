import { noteError } from '../storage/errLog.ts';

import { errorContext } from './errorContext.ts';

/** Start-up functions other domains provide (legacy `boot`, app.js:3301-3307). */
export interface BootHooks {
  /** Apply the chosen app icon (legacy `applyIcon`, data domain). */
  applyIcon: () => void;
  /** Resume a track that was recording when the app closed (legacy `autoResumeTrip`, tracking domain). */
  autoResumeTrip: () => void;
}

const hooks: Partial<BootHooks> = {};

/**
 * Register start-up functions. Call it from `src/features/<domain>/init.ts`,
 * which the shell imports eagerly before the first screen.
 * @param provided - Functions to register.
 */
export function registerBootHooks(provided: Partial<BootHooks>): void {
  Object.assign(hooks, provided);
}

/**
 * Run one start-up function, if registered; a failure never blocks the start.
 * @param name - Hook name.
 */
export function runBootHook(name: keyof BootHooks): void {
  try {
    hooks[name]?.();
  } catch (error) {
    noteError(
      error instanceof Error ? error.message : error,
      `boot:${name}`,
      errorContext,
    );
  }
}

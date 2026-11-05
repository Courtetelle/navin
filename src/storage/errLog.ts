import { textOf } from '../lib/format.ts';
import type { ErrorRecord } from '../model/types.ts';

import { storage } from './store.ts';

/** Context written with each error: app version and current view. */
export interface ErrorContext {
  version: () => string;
  view: () => string;
}

const ERROR_LOG_KEY = 'ldb.errLog';

/**
 * Record an unexpected error in `ldb.errLog` (50 last), silently (legacy `errLog.note`).
 * @param message - Error message (cut at 300 characters).
 * @param source - `file:line` or `promise` (cut at 120 characters).
 * @param context - Version and view getters.
 */
export function noteError(
  message: unknown,
  source: unknown,
  context: ErrorContext,
): void {
  try {
    const backend = storage();
    const list = JSON.parse(
      backend.getItem(ERROR_LOG_KEY) || '[]',
    ) as ErrorRecord[];
    list.push({
      t: new Date().toISOString(),
      v: context.version(),
      view: context.view(),
      msg: String(message).slice(0, 300),
      src: textOf(source).slice(0, 120),
    });
    backend.setItem(ERROR_LOG_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // The error log must never raise an error itself.
  }
}

/**
 * Listen to uncaught errors and rejections of a window and record them (legacy app.js 367-371).
 * @param target - The window.
 * @param context - Version and view getters.
 * @returns A function removing the listeners.
 */
export function attachErrorLog(
  target: Window,
  context: ErrorContext,
): () => void {
  const onError = (event: ErrorEvent) => {
    noteError(
      event.message,
      `${(event.filename || '').split('/').pop()}:${event.lineno || ''}`,
      context,
    );
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as
      { stack?: string; message?: string } | undefined;
    noteError(
      (reason && (reason.stack || reason.message)) || event.reason,
      'promise',
      context,
    );
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

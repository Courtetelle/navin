import { APP_VERSION } from '../model/taskTemplate.ts';
import { state } from '../state/index.ts';
import type { ErrorContext } from '../storage/errLog.ts';

/** Version and screen written with every recorded error (`ldb.errLog`). */
export const errorContext: ErrorContext = {
  version: () => APP_VERSION,
  view: () => state.view.currentView.value,
};

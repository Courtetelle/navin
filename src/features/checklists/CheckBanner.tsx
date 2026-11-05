import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

import { checkLeft, checklistSub } from './checklistProgress.ts';

/**
 * The « Check-list » banner of the logbook (legacy `#checkBanner`, filled by
 * `renderCheckBanner`): it stays empty once the built-in lists are done.
 * @returns The `#checkBanner` element.
 */
export function CheckBanner() {
  useSignals();
  const tr = useTr();
  return (
    <div id="checkBanner">
      {checkLeft().length > 0 ? (
        <div className="row" style={{ marginBottom: '12px' }}>
          <Button
            className="btn big ck-banner"
            onClick={() => {
              buzz();
              go('checklist');
            }}
          >
            {tr('✅ Check-list')}
            <small>{tr(checklistSub())}</small>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

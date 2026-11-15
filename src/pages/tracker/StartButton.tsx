import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { domainActions } from '../../shell/topbar/tabDisplays.ts';
import { START_SVG } from '../../shell/topbar/tabIcons.ts';

import { ListSign } from './ListSign.tsx';

/**
 * START: a touch starts the track; a long press opens Mes traces.
 * @returns The button.
 */
export function StartButton() {
  const tr = useTr();
  const press = useLongPress(() => go('traces'));
  return (
    <Button
      type="button"
      noUiEdit
      className={`rail-btn rail-start${press.hit ? ' lp-hit' : ''}`}
      aria-label={tr('START : démarrer la trace · appui long : Mes traces')}
      onClick={() => {
        buzz();
        domainActions.quickStart();
      }}
      {...press.handlers}
    >
      <span className="rail-icon">{markupToReact(START_SVG)}</span>
      {/* Its long press opens Mes traces */}
      <ListSign />
    </Button>
  );
}

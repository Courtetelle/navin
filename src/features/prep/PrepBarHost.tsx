import { useSignals } from '@preact/signals-react/runtime';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { PREP_STEPS } from '../../model/modes.ts';

import { PrepPills } from './PrepPills.tsx';
import { prepBarShown } from './prepBarSync.ts';
import { prepBarBack, prepBarNext } from './prepFlow.ts';
import type { PrepFlow } from './prepTypes.ts';
import { prepFlow } from './prepTypes.ts';
import { usePrepSteps } from './usePrepSteps.ts';

/**
 * The PréP bar (`#prepBar`, legacy `prepBarHtml`) on the crew and check-in
 * screens, a child of `<body>`; the nav bar relays its buttons.
 * @returns The portal, or nothing while it is not shown.
 */
export function PrepBarHost() {
  useSignals();
  const prep = prepFlow();
  if (!prepBarShown.value || !prep) return null;
  return createPortal(<PrepBar prep={prep} />, document.body);
}

function PrepBar({ prep }: { prep: PrepFlow }) {
  useSignals();
  const pills = usePrepSteps(prep, { bar: true });
  return (
    <div id="prepBar" className="prep-bar">
      <div className="prep-steps steps-up">
        <PrepPills pills={pills} />
      </div>
      <div className="prep-row">
        <Button
          className="btn nav-dup"
          data-prep="back"
          hidden
          onClick={prepBarBack}
        >
          ◀
        </Button>
        <b>{PREP_STEPS[prep.step]}</b>
        <Button className="btn primary" data-prep="next" onClick={prepBarNext}>
          Suivant ▶
        </Button>
      </div>
    </div>
  );
}

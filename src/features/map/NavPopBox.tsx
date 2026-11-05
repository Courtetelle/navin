import { useSignals } from '@preact/signals-react/runtime';
import { Suspense, lazy } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { MODES } from '../../model/modes.ts';
import { go } from '../../shell/router.ts';
import { curMode, isLake, state, toast } from '../../state/index.ts';

import { addAutoEntry, moorNow } from './external.ts';
import { closeNavPop } from './navPop.ts';
import { lastPointEvent } from './trackerPoint.ts';

const LakeButtons = lazy(() =>
  import('../onwater/index.ts').then((module) => ({
    default: module.LakeButtons,
  })),
);

function goFromPopup(view: string): void {
  buzz();
  closeNavPop();
  go(view);
}

function closeWithBuzz(): void {
  buzz();
  closeNavPop();
}

function pointNow(): void {
  buzz();
  const last = lastPointEvent();
  if (!last) {
    toast('En attente du premier point GPS');
    return;
  }
  void addAutoEntry(last.event, last.lochBase);
  toast('Point enregistré');
}

/**
 * The « Naviguer » window: the navigation buttons, each one noting the time and
 * the position in the logbook.
 * @returns `.nav-pop-box`.
 */
export function NavPopBox() {
  useSignals();
  const cruise = state.data.cruise.value;
  const tracking = state.view.tracking.value;
  const sea = !isLake();
  const name = `${MODES[curMode()].icon} ${cruise?.info.name || ''}`;
  return (
    <div className="nav-pop-box">
      <div className="nav-pop-head">
        <h1>🧭 Naviguer</h1>
        <Button className="btn" aria-label="Fermer" onClick={closeWithBuzz}>
          ✕
        </Button>
      </div>
      <p className="help">
        {name} · chaque bouton note l’heure et la position au journal.
      </p>
      <Suspense>
        <LakeButtons inPopup />
      </Suspense>
      {tracking ? (
        <div className="row">
          <Button className="btn big" onClick={pointNow}>
            📌 Point maintenant
          </Button>
        </div>
      ) : null}
      {sea ? (
        <div className="row">
          <Button className="btn big" onClick={() => goFromPopup('vhf')}>
            📻 VHF : appels de routine
          </Button>
        </div>
      ) : null}
      <div className="row c2">
        <Button className="btn" onClick={() => goFromPopup('new')}>
          📝 Saisir une entrée<small>cap, vent, mer, observations</small>
        </Button>
        <Button className="btn" onClick={() => goFromPopup('checklist')}>
          ✅ Check-lists
        </Button>
      </div>
      {tracking ? (
        <>
          <div className="row">
            <Button className="btn big" onClick={() => goFromPopup('dock')}>
              ⚓ Accostage
              <small>hauteur d’eau, pare-battages, amarres, gaffe</small>
            </Button>
          </div>
          <div className="row">
            <ArmedButton
              className="btn big danger"
              armedLabel="Toucher encore : amarré"
              onConfirm={() => {
                closeNavPop();
                void moorNow();
              }}
            >
              🔒 Amarrage<small>fin de la trace, puis check-out</small>
            </ArmedButton>
          </div>
        </>
      ) : null}
      <div className="row">
        <Button className="btn" onClick={closeWithBuzz}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

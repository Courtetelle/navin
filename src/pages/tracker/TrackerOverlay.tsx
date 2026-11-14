import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import {
  chooseCancel,
  chooseExtend,
  chooseNew,
  simulateTrack,
  trackerOverlay,
} from '../../features/map/trackerButtons.ts';

const FULL_WIDTH = { gridColumn: '1/-1' };

/**
 * What lies over the bottom of the tracker: the refused localisation, or the
 * choice between extending the previous track and a new one (legacy
 * `drawTrkButtons`, `trkChooseStart`).
 * @returns `#trkBtns`.
 */
export function TrackerOverlay() {
  useSignals();
  const overlay = trackerOverlay.value;
  // No scrolling into view: it pushed the map up and left a grey band.
  return (
    <div className="trk-over" id="trkBtns">
      {overlay.kind === 'choose' ? (
        <div className="trk-choose" style={FULL_WIDTH}>
          <HelpText nextIsRow style={{ margin: '0 0 8px' }}>
            {overlay.question}
          </HelpText>
          <div className="row c2">
            <Button className="btn big" id="trkExtend" onClick={chooseExtend}>
              ↪ Prolonger<small>la trace précédente</small>
            </Button>
            <Button className="btn big primary" id="trkNew" onClick={chooseNew}>
              ⏺ Nouvelle trace<small>repartir de zéro</small>
            </Button>
          </div>
          <div className="row">
            <Button className="btn" id="trkCancel" onClick={chooseCancel}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}
      {overlay.kind === 'idle' && overlay.denied ? (
        <>
          <p className="gps-denied" style={FULL_WIDTH}>
            📍 La localisation est refusée : la trace ne peut pas s’enregistrer.
            Sur iPhone : Réglages › Confidentialité › Service de localisation ›
            Safari (ou NavIn) › « Lorsque l’app est active ». Dans l’aperçu
            ouvert depuis Claude, le GPS est souvent bloqué : l’essai réel se
            fera dans l’appli installée.
          </p>
          {overlay.framed ? (
            <Button
              className="btn big"
              id="simGps"
              style={FULL_WIDTH}
              onClick={simulateTrack}
            >
              ▶ Simuler une trace
              <small>
                bateau fictif devant Morges, pour voir l’effet dans l’aperçu
              </small>
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

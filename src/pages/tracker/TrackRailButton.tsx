import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { DONE_SVG, STOP_SVG, TRACK_SVG } from '../../shell/topbar/tabIcons.ts';
import { stopNow } from '../../shell/topbar/topMenuState.ts';
import { state, toast } from '../../state/index.ts';

import { trackDone } from './trackDone.ts';

const DONE_MS = 3000;

const ARMED_STOP = STOP_SVG.replace(
  'class="tb-ico ',
  'class="tb-ico tb-armed ',
);

function PauseIcon() {
  return (
    <svg className="tb-ico rail-pause" viewBox="0 0 48 40" aria-hidden="true">
      <rect x="13" y="6" width="8" height="28" rx="2.5" fill="#111" />
      <rect x="27" y="6" width="8" height="28" rx="2.5" fill="#111" />
    </svg>
  );
}

/**
 * During a track, in the place of START. Short touches only, and only on this
 * button: recording (the boat sails, its dots behind), a touch pauses (black
 * II blinking orange), the pause holds until the next touch, which resumes.
 * While paused, FIN stands beside it: a touch arms it, a second one ends and
 * saves the track. Nothing goes back on its own.
 * @returns The button, and FIN while paused.
 */
export function TrackRailButton() {
  useSignals();
  const tr = useTr();
  const paused = state.view.trackPaused.value;
  const touch = () => {
    buzz();
    state.view.trackPaused.value = !paused;
    toast(
      tr(
        paused
          ? '▶ Trace reprise'
          : '⏸ Trace en pause · toucher II pour reprendre · FIN pour l’arrêter',
      ),
    );
  };
  // Recording: the button blinks in the colour of PréP; paused: orange.
  const classes = [
    'rail-btn',
    'rail-track',
    paused ? 'rail-paused' : 'rail-run',
    'menu-here',
  ];
  return (
    <div className="rail-track-wrap">
      <Button
        type="button"
        noUiEdit
        className={classes.join(' ')}
        aria-label={tr(
          paused ? 'Trace en pause : toucher pour reprendre' : 'Trace en cours',
        )}
        aria-pressed={paused}
        onClick={touch}
      >
        <span className="rail-icon">
          {paused ? <PauseIcon /> : markupToReact(TRACK_SVG)}
        </span>
      </Button>
      {paused ? <FinButton /> : null}
    </div>
  );
}

/**
 * FIN, beside the paused track: a first touch arms it, a second ends and
 * saves the track.
 * @returns The button.
 */
function FinButton() {
  const tr = useTr();
  const [armed, setArmed] = useState(false);
  return (
    <Button
      type="button"
      noUiEdit
      className={
        armed ? 'rail-btn rail-fin rail-fin-armed' : 'rail-btn rail-fin'
      }
      aria-label={tr(
        armed ? 'Confirmer la FIN de la trace' : 'FIN de la trace',
      )}
      onClick={() => {
        buzz();
        if (!armed) {
          setArmed(true);
          toast(tr('Toucher encore FIN pour arrêter et enregistrer la trace'));
          return;
        }
        trackDone.value = true;
        setTimeout(() => {
          trackDone.value = false;
        }, DONE_MS);
        void stopNow();
      }}
    >
      <span className="rail-icon">
        {markupToReact(armed ? ARMED_STOP : STOP_SVG)}
      </span>
    </Button>
  );
}

/**
 * The track just saved: the green tick, on the track button itself.
 * @returns The button.
 */
export function TrackDoneButton() {
  const tr = useTr();
  return (
    <Button
      type="button"
      noUiEdit
      className="rail-btn rail-track rail-done"
      aria-label={tr('Trace enregistrée')}
    >
      <span className="rail-icon">{markupToReact(DONE_SVG)}</span>
    </Button>
  );
}

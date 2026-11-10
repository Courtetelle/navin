import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { markupToReact } from '../../components/shared/markupToReact.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { DONE_SVG, STOP_SVG, TRACK_SVG } from '../../shell/topbar/tabIcons.ts';
import { stopNow } from '../../shell/topbar/topMenuState.ts';
import { state, toast } from '../../state/index.ts';

/** Where the track button stands: each touch moves to the next step. */
type Step = 'run' | 'askPause' | 'paused' | 'askEnd' | 'done';

/** An offered step goes back to the previous one after this long. */
const ARMED_MS = 5000;
const DONE_MS = 3000;

const ARMED_STOP = STOP_SVG.replace(
  'class="tb-ico ',
  'class="tb-ico tb-armed ',
);

function PauseIcon() {
  return (
    <svg className="tb-ico rail-pause" viewBox="0 0 48 40" aria-hidden="true">
      <rect x="13" y="6" width="8" height="28" rx="2.5" fill="#f39c12" />
      <rect x="27" y="6" width="8" height="28" rx="2.5" fill="#f39c12" />
    </svg>
  );
}

/**
 * During a track, in the place of START: TRACK en cours; a touch offers
 * Pause, a second one pauses the track; then FIN, a touch arms it and a
 * second one ends and saves the track (green tick). An offered step goes back
 * after 5 s; on pause, a long press resumes.
 * @returns The button.
 */
export function TrackRailButton() {
  useSignals();
  const tr = useTr();
  const paused = state.view.trackPaused.value;
  const [step, setStep] = useState<Step>(paused ? 'paused' : 'run');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const later = (next: Step, wait: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStep(next), wait);
  };
  const resume = useLongPress(() => {
    if (step !== 'paused' && step !== 'askEnd') return;
    buzz();
    clearTimeout(timer.current);
    state.view.trackPaused.value = false;
    setStep('run');
    toast(tr('▶ Trace reprise'));
  });
  const touch = () => {
    buzz();
    if (step === 'run') {
      setStep('askPause');
      toast(tr('Toucher encore pour mettre la trace en pause'));
      later('run', ARMED_MS);
    } else if (step === 'askPause') {
      clearTimeout(timer.current);
      state.view.trackPaused.value = true;
      setStep('paused');
      toast(
        tr('⏸ Trace en pause · FIN pour l’arrêter · appui long : reprendre'),
      );
    } else if (step === 'paused') {
      setStep('askEnd');
      toast(tr('Toucher encore pour arrêter et enregistrer la trace'));
      later('paused', ARMED_MS);
    } else if (step === 'askEnd') {
      clearTimeout(timer.current);
      setStep('done');
      later('run', DONE_MS);
      void stopNow();
    }
  };
  const faces: Record<Step, { markup?: string; label: string }> = {
    run: { markup: TRACK_SVG, label: 'TRACK en cours' },
    askPause: { label: 'Pause' },
    paused: { markup: STOP_SVG, label: 'FIN · appui long : reprendre' },
    askEnd: { markup: ARMED_STOP, label: 'Confirmer la FIN' },
    done: { markup: DONE_SVG, label: 'Trace enregistrée' },
  };
  const face = faces[step];
  const classes = ['rail-btn', 'rail-track', `rail-${step}`];
  if (resume.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      aria-label={tr(face.label)}
      onClick={touch}
      {...resume.handlers}
    >
      <span className="rail-icon">
        {face.markup ? markupToReact(face.markup) : <PauseIcon />}
      </span>
    </Button>
  );
}

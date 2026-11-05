import { untracked } from '@preact/signals-react';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { sosLogActive, sosLogEnd, toast } from '../../state/index.ts';

import { ensureMobLogs } from './mobLog.ts';
import { sosExEnd, sosExOn } from './sosExercise.ts';

/** Props of {@link SosEndButton}. */
export interface SosEndButtonProps {
  /** Redraws the page a few seconds after the end (legacy `VIEWS[view]()`). */
  onEnded: () => void;
}

type Phase = 'idle' | 'asking' | 'done' | 'leaving' | 'gone';

/**
 * « Fin de procédure SOS » (legacy `sosEndBtnHtml` and `bindSosEnd`): a long
 * press asks, a touch within 5 s confirms; the button then turns green and
 * disappears. During an exercise it ends the exercise.
 * @param props - Page redraw.
 * @returns The button, or nothing when no procedure runs.
 */
export function SosEndButton({ onEnded }: SosEndButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [refused, setRefused] = useState(0);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);
  const ended = useRef(onEnded);
  useEffect(() => {
    ended.current = onEnded;
  });
  useEffect(() => () => clearTimeout(press.current), []);
  useEffect(() => {
    if (phase === 'asking') {
      const timer = setTimeout(() => setPhase('idle'), 5000);
      return () => clearTimeout(timer);
    }
    if (phase === 'done') {
      const timer = setTimeout(() => setPhase('leaving'), 3000);
      return () => clearTimeout(timer);
    }
    if (phase === 'leaving') {
      const timer = setTimeout(() => {
        setPhase('gone');
        ended.current();
      }, 600);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase]);
  useEffect(() => {
    if (!refused) return undefined;
    const timer = setTimeout(() => setRefused(0), 1500);
    return () => clearTimeout(timer);
  }, [refused]);

  if (phase === 'gone') return null;
  if (phase === 'idle' && !untracked(sosLogActive)) return null;

  const finished = phase === 'done' || phase === 'leaving';
  const release = () => clearTimeout(press.current);
  const onClick = (event: MouseEvent) => {
    if (finished) return;
    event.stopPropagation();
    event.preventDefault();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    buzz();
    if (phase !== 'asking') {
      toast('Appui long sur « Fin de procédure SOS », puis confirmer');
      setRefused((count) => count + 1);
      return;
    }
    if (sosExOn()) {
      setPhase('idle');
      sosExEnd();
      return;
    }
    ensureMobLogs();
    sosLogEnd();
    toast('✓ Procédure SOS terminée · log gardé dans data › SOS');
    setPhase('done');
  };
  return (
    <Button
      className={classesOf(phase, refused > 0)}
      data-sosend={finished ? undefined : '1'}
      onClick={onClick}
      onPointerDown={() => {
        if (finished || phase === 'asking') return;
        clearTimeout(press.current);
        press.current = setTimeout(() => {
          buzz();
          setPhase('asking');
          longPressed.current = true;
          toast(
            'Toucher encore pour confirmer la fin de procédure SOS · sinon rien dans 5 s',
          );
        }, 650);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onContextMenu={(event) => {
        if (!finished) event.preventDefault();
      }}
    >
      {contentOf(phase)}
    </Button>
  );
}

function classesOf(phase: Phase, refused: boolean): string {
  const classes = ['btn', 'big', 'danger', 'sos-end'];
  if (phase === 'asking') classes.push('sos-end-ask');
  if (phase === 'done' || phase === 'leaving') classes.push('sos-end-done');
  if (phase === 'leaving') classes.push('sos-end-gone');
  if (refused) classes.push('lock-ask');
  return classes.join(' ');
}

function contentOf(phase: Phase): ReactNode {
  if (phase === 'asking') {
    return (
      <>
        Confirmer la fin de procédure SOS ?
        <small>toucher encore pour confirmer · sinon rien dans 5 s</small>
      </>
    );
  }
  if (phase === 'done' || phase === 'leaving') {
    return (
      <>
        ✓ Procédure SOS terminée<small>log gardé dans data › SOS</small>
      </>
    );
  }
  return (
    <>
      ⏹ Fin de procédure SOS<small>appui long, puis confirmer</small>
    </>
  );
}

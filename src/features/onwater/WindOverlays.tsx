import { useSignals } from '@preact/signals-react/runtime';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { screenLanguage } from '../../i18n/langState.ts';
import { translateMessage } from '../../i18n/translate.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';

import { flashColor } from './windLogic.ts';
import type { WindFlash } from './windOverlayState.ts';
import { removeWindFlash, windFlashes, windPopup } from './windOverlayState.ts';

const SIGNAL_MS = 1200;
const PAUSE_MS = 400;

/**
 * The colour flashes of the screen in progress (legacy `playFlash`).
 * @returns One portal per flash.
 */
export function WindFlashes() {
  useSignals();
  return (
    <>
      {windFlashes.value.map((flash) => (
        <OneFlash key={flash.id} flash={flash} />
      ))}
    </>
  );
}

function translate(text: string): string {
  return translateMessage(text, screenLanguage.value);
}

function OneFlash({ flash }: { flash: WindFlash }) {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    for (const start of [0, SIGNAL_MS + PAUSE_MS]) {
      timers.push(
        setTimeout(() => setLit(true), start),
        setTimeout(() => setLit(false), start + SIGNAL_MS),
      );
    }
    timers.push(
      setTimeout(
        () => removeWindFlash(flash.id),
        2 * SIGNAL_MS + PAUSE_MS + 100,
      ),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [flash.id]);
  const style = {
    '--flash': flash.color,
    '--ink': flash.ink,
  } as CSSProperties;
  return createPortal(
    <div className={lit ? 'wind-flash on' : 'wind-flash'} style={style}>
      <div className="wf-txt">
        <b>{flash.knots} nd</b>
        <span>{flash.force} Beaufort</span>
        {flash.other ? (
          <span className="wf-other">{translate(flash.other)}</span>
        ) : null}
        {flash.forecast ? <span className="wf-fc">PRÉVISION</span> : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The wind bubble: large text on a red glass background, edged with the colour
 * of the level; it stays until touched (legacy `windPopShow`).
 * @returns The `#windPop` portal, or nothing.
 */
export function WindPopup() {
  useSignals();
  const content = windPopup.value;
  if (!content) return null;
  const row = BEAUFORT_TBL[Math.max(0, Math.min(12, content.bf))];
  const style = {
    '--lvl': flashColor(Math.max(0, content.bf - 4)),
  } as CSSProperties;
  return createPortal(
    <div
      id="windPop"
      className="wind-pop no-print"
      role="alertdialog"
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        windPopup.value = null;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.wp-stop')) content.onStop?.();
        else if (target?.closest('.wp-live')) content.onLive?.();
        else content.onClose?.();
      }}
    >
      <div className="wp-box">
        <div className="wp-big">
          💨 {content.bf} Bf · {content.kn}
        </div>
        {content.other ? (
          <div className="wp-other">{translate(content.other)}</div>
        ) : null}
        <div className="wp-name">
          {translate(row?.[2] ?? '')}
          {content.where ? ` · ${translate(content.where)}` : ''}
        </div>
        {content.sea ? (
          <div className="wp-sea">🌊 {translate(content.sea)}</div>
        ) : null}
        {content.omm ? (
          <div className="wp-omm">📘 {translate(content.omm)}</div>
        ) : null}
        {content.note ? (
          <div className="wp-note">{translate(content.note)}</div>
        ) : null}
        <div className="wp-desc">{translate(row?.[4] ?? '')}</div>
        {content.onLive ? (
          <Button className="btn primary wp-live" noUiEdit>
            {translate('🌬 Live météo')}
          </Button>
        ) : null}
        <div className="wp-close">
          {translate(content.closeTxt ?? 'Toucher pour fermer')}
        </div>
        {content.onStop ? (
          <Button className="btn danger wp-stop" noUiEdit>
            {translate('⏹ Arrêter le test')}
          </Button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

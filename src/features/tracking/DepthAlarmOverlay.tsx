import { useSignals } from '@preact/signals-react/runtime';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';

import { depthMute, depthTestStop } from './depthAlarm.ts';
import { depthOverlayState } from './depthOverlayState.ts';

/**
 * The depth alarm over everything (legacy `#depthAlarm`, nav.js:215).
 * @returns The portal into `<body>`, once the alarm was used.
 */
export function DepthAlarmOverlay() {
  useSignals();
  const overlay = depthOverlayState.value;
  if (!overlay.mounted) return null;
  const classes = [
    overlay.on ? 'on' : '',
    overlay.danger ? 'danger' : '',
    overlay.noFlash ? 'no-flash' : '',
    overlay.test ? 'da-test' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const style: Record<string, string> = {};
  if (overlay.color) style['--da-col'] = overlay.color;
  if (overlay.opacity) style['--da-op'] = overlay.opacity;
  if (overlay.period) style['--da-per'] = overlay.period;
  return createPortal(
    <div id="depthAlarm" className={classes || undefined} style={style}>
      <div className="da-flash" />
      <div className="da-box">
        <b id="daTxt">{overlay.title}</b>
        <small id="daSub">{overlay.subtitle}</small>
        <div className="da-btns">
          <Button
            className="btn"
            id="daMute"
            onClick={(event) => {
              event.stopPropagation();
              depthMute();
            }}
          >
            🔇 Couper le son 1 min
          </Button>
          <Button
            className="btn danger"
            id="daStop"
            onClick={(event) => {
              event.stopPropagation();
              buzz();
              depthTestStop(false);
            }}
          >
            ⏹ Arrêter le test
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

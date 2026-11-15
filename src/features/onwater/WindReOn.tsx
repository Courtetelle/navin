import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';

import { REON_CHOICES, reOnRule, reOnText, setReOnRule } from './windReOn.ts';

/**
 * The ⓘ inside « Alertes de vent »: it opens the window that says when
 * alerts switched off come back on.
 * @param props - Its state.
 * @param props.onOpen - Opens the window.
 * @returns The ⓘ.
 */
export function ReOnI({ onOpen }: { onOpen: () => void }) {
  return (
    <span
      className="reon-i"
      role="button"
      aria-label="Quand les alertes se rallument"
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
        buzz();
        onOpen();
      }}
    >
      i
    </span>
  );
}

/**
 * The window of the ⓘ: when the alerts switched off come back on, a ✏️ to
 * choose it (at the end of a track, at midnight, at the launch of NavIn,
 * never), « Fermer » back to the alerts.
 * @param props - Its state.
 * @param props.onClose - Closes the window.
 * @returns The window.
 */
export function ReOnBox({ onClose }: { onClose: () => void }) {
  useSignals();
  const rule = reOnRule();
  const [editing, setEditing] = useState(false);
  return (
    <div className="reon-box" role="dialog" aria-label="Retour des alertes">
      <div className="reon-head">
        <p>{reOnText(rule)}</p>
        {editing ? null : (
          <Button
            type="button"
            className="btn reon-pen"
            aria-label="Changer quand les alertes se rallument"
            onClick={() => {
              buzz();
              setEditing(true);
            }}
          >
            ✏️
          </Button>
        )}
      </div>
      {editing ? (
        <div className="reon-choices">
          {REON_CHOICES.map(([key, label]) => (
            <Button
              key={key}
              type="button"
              className={key === rule ? 'btn on' : 'btn'}
              aria-pressed={key === rule}
              onClick={() => {
                buzz();
                setReOnRule(key);
                setEditing(false);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      <Button type="button" className="btn" onClick={onClose}>
        Fermer
      </Button>
    </div>
  );
}

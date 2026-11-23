import type { ReactNode } from 'react';

import { useTr } from '../../i18n/useTr.ts';

import type { ButtonProps } from './Button.tsx';
import { Button } from './Button.tsx';

/** Props of {@link AlertSwitch}. */
export interface AlertSwitchProps extends Omit<ButtonProps, 'children'> {
  /** The alert watches. */
  on: boolean;
  /** What it says while on, « toucher pour … » included. */
  onText: string;
  /** What it says once off. */
  offText: string;
  /** An icon before the words (the windsock), instead of 🔔 / 🔕. */
  icon?: ReactNode;
}

/**
 * The on/off button of an alert, the one of « Alertes » for all of them:
 * green while it watches (🔔), red once off (🔕), the state first then what
 * a touch does; at night filled while on, dark with a dashed edge once off.
 * @param props - The state, its two texts and the button attributes.
 * @returns The button.
 */
export function AlertSwitch({
  on,
  onText,
  offText,
  icon,
  className,
  ...rest
}: AlertSwitchProps) {
  const tr = useTr();
  const state = on ? 'alerts-live' : 'alerts-off';
  let bell = on ? '🔔 ' : '🔕 ';
  if (icon) bell = '';
  return (
    <Button
      {...rest}
      className={['btn', className, state].filter(Boolean).join(' ')}
      data-alerts-state={on ? 'on' : 'off'}
      aria-pressed={on}
    >
      {icon ?? null}
      {tr(bell + (on ? onText : offText))}
    </Button>
  );
}

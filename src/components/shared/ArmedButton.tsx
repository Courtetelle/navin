import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import type { ButtonProps } from './Button.tsx';
import { Button } from './Button.tsx';

/** Props of {@link ArmedButton}. */
interface ArmedButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Content shown after the first tap (legacy `label`, e.g. « Toucher encore : amarré »). */
  armedLabel: ReactNode;
  /** Runs on the second tap within 3 s. */
  onConfirm: () => void;
  /**
   * Runs on every tap, before the armed logic.
   * @default undefined
   */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Dangerous action confirmed by a double tap (legacy `armed`, app.js:559-565):
 * the first tap shows `armedLabel` for 3 s, a second tap in that time runs it.
 * Legacy marked the button with `data-armed="1"` meanwhile.
 * @param props - Button props, armed label and action.
 * @returns The button.
 */
export function ArmedButton({
  armedLabel,
  onConfirm,
  onClick,
  children,
  ...rest
}: ArmedButtonProps) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      {...rest}
      data-armed={armed ? '1' : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (armed) onConfirm();
        else setArmed(true);
      }}
    >
      {armed ? armedLabel : children}
    </Button>
  );
}

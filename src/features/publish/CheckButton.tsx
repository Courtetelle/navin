import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';

import { Button } from '../../components/shared/Button.tsx';

/** Props of {@link CheckButton}. */
export interface CheckButtonProps extends ComponentPropsWithoutRef<'button'> {
  /** Checked. */
  on: boolean;
  /**
   * Extra classes.
   * @default ''
   */
  extraClass?: string;
  /** Text after the box. */
  children: ReactNode;
}

/**
 * A `button.btn.check` of the Publier window: ✔ box, then its label.
 * @param props - State, classes and label.
 * @returns The button.
 */
export function CheckButton({
  on,
  extraClass = '',
  children,
  ...rest
}: CheckButtonProps): ReactElement {
  return (
    <Button
      {...rest}
      type="button"
      className={`btn check ${extraClass} ${on ? 'on' : ''}`}
    >
      <span className="box">{on ? '✔' : ''}</span>
      {children}
    </Button>
  );
}

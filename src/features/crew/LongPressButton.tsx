import type { ButtonProps } from '../../components/shared/Button.tsx';
import { Button } from '../../components/shared/Button.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';

/** Props of {@link LongPressButton}. */
interface LongPressButtonProps extends ButtonProps {
  /** A press of 550 ms opens the card of the person. */
  onLongPress: () => void;
}

/**
 * A button whose short tap keeps its own action and whose long press opens the
 * card of the person (legacy `pressModes`, nav.js:1277).
 * @param props - Button props and the long press action.
 * @returns The button.
 */
export function LongPressButton({
  onLongPress,
  className,
  ...rest
}: LongPressButtonProps) {
  const press = useLongPress(onLongPress);
  return (
    <Button
      {...rest}
      {...press.handlers}
      className={press.hit ? `${className} lp-hit` : className}
    />
  );
}

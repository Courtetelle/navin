import type { MouseEvent } from 'react';

import { Button } from '../../../components/shared/Button.tsx';
import { useTr } from '../../../i18n/useTr.ts';
import { sailColCss, sailLineTexts } from '../../../lib/boatDescription.ts';
import { buzz } from '../../../lib/dom.ts';
import { SAIL_COLORS } from '../../../lib/translateDictionary.ts';

/** Props of {@link ColorButton}. */
export interface ColorButtonProps {
  color: string;
  /**
   * Colour of the mainsail.
   * @default false
   */
  main?: boolean;
  onChange: (color: string) => void;
}

/**
 * Colour of a sail: a touch shows the next colour.
 * @param props - Colour and change handler.
 * @returns The button.
 */
export function ColorButton({
  color,
  main = false,
  onChange,
}: ColorButtonProps) {
  const tr = useTr();
  const label = color
    ? `${color.charAt(0).toUpperCase()}${color.slice(1)}`
    : '🎨 Couleur';
  return (
    <Button
      type="button"
      className={color ? 'btn sail-col on' : 'btn sail-col'}
      data-gvcol={main ? '1' : undefined}
      data-col={color}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        buzz();
        const index = SAIL_COLORS.findIndex(([name]) => name === color);
        onChange(SAIL_COLORS[index + 1]?.[0] ?? '');
      }}
    >
      <i className="sail-sw" style={{ background: sailColCss(color) }} />
      {tr(label)}
    </Button>
  );
}

/** Props of {@link SailLine}. */
export interface SailLineProps {
  name: string;
  color: string;
  text: string;
}

/**
 * The full description under a sail, in French then in English.
 * @param props - Name, colour and inscription.
 * @returns The `small.sail-line`.
 */
export function SailLine({ name, color, text }: SailLineProps) {
  const line = sailLineTexts(name, color, text);
  return (
    <small className="en-tr sail-line">
      {line ? (
        <>
          {line.fr}
          <br />
          🇬🇧 {line.en}
        </>
      ) : null}
    </small>
  );
}

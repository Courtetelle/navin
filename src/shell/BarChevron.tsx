import { setBodyClass } from './bodyClass.ts';

/**
 * The chevron of a bar of the tracker: it points to where the bar goes away, and
 * a tap puts the bar away. A small handle with a chevron the other way brings it
 * back.
 * @param props - Which bar.
 * @param props.bar - The top bar or the bottom board.
 * @returns The chevron.
 */
export function BarChevron({ bar }: { bar: 'top' | 'bottom' }) {
  return (
    <button
      type="button"
      className={`bar-chevron bar-chevron-${bar}`}
      aria-label={
        bar === 'top' ? 'Ranger le bandeau' : 'Ranger le tableau de bord'
      }
      onClick={() => {
        setBodyClass(bar === 'top' ? 'top-hidden' : 'bot-hidden', true);
      }}
    />
  );
}

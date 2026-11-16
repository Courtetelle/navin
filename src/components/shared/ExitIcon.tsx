/**
 * The blue sign of leaving a menu for another (a box, an arrow going out);
 * turned the other way, the sign of coming back.
 * @param props - Its direction.
 * @param props.back - The way back: the arrow goes in.
 * @returns The sign.
 */
export function ExitIcon({ back = false }: { back?: boolean }) {
  return (
    <span
      className={
        back ? 'wx-entry-ico exit-box exit-back' : 'wx-entry-ico exit-box'
      }
      aria-hidden="true"
    >
      <svg className="exit-ico" viewBox="0 0 30 40">
        <path
          d="M17 3H8a6 6 0 0 0-6 6v22a6 6 0 0 0 6 6h9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M11 20h17m-6-6 6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

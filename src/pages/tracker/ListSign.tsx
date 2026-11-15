/**
 * A small list in the corner of a button: its long press opens a list
 * (Mes marques on the pin, Mes traces on START).
 * @returns The sign.
 */
export function ListSign() {
  return (
    <span className="rail-list-sign" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path
          d="M5 4h9M5 8h9M5 12h9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="2" cy="4" r="1.2" fill="currentColor" />
        <circle cx="2" cy="8" r="1.2" fill="currentColor" />
        <circle cx="2" cy="12" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

/** The three sliders of the Paramétrages button. */
const SLIDERS = 'M6 12h20M36 12h6M6 24h5M21 24h21M6 36h24M40 36h2';

/**
 * The sign of Paramétrages (three sliders), the same as its button: on its
 * button, and on every link that leads there.
 * @param props - Its class.
 * @param props.className - Extra class.
 * @returns The sign.
 */
export function SettingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`gear-ico gear-sliders ${className}`.trim()}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      >
        <path d={SLIDERS} />
        <circle cx="31" cy="12" r="4.6" />
        <circle cx="16" cy="24" r="4.6" />
        <circle cx="35" cy="36" r="4.6" />
      </g>
    </svg>
  );
}

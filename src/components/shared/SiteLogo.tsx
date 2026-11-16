/**
 * The sign of a site of the internet, at the left of its button: a globe.
 * @returns The sign.
 */
export function SiteLogo() {
  return (
    <svg className="site-logo" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="4.2"
        ry="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2.8 9h18.4M2.8 15h18.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

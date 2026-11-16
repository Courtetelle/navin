/**
 * The sign of a site of the internet, at the left of its button: a hand
 * whose finger touches, pointing to the right, the touch drawn in green
 * strokes at its tip.
 * @returns The sign.
 */
export function SiteLogo() {
  return (
    <svg className="site-logo" viewBox="-1.5 -1.5 27 27" aria-hidden="true">
      <g transform="rotate(90 12 12)">
        <path
          d="M9 15.5V4.5a1.5 1.5 0 0 1 3 0V11a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V16a5.5 5.5 0 0 1-5.5 5.5h-1A4.5 4.5 0 0 1 7 19.8l-2.4-3.6a1.4 1.4 0 0 1 2.1-1.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M12 11v3M15 11.5v2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          className="site-logo-tap"
          d="M10.5 1.4V-.6M7.4 2.4 6.2 1.2M13.6 2.4l1.2-1.2M6.6 4.8H5M14.4 4.8H16"
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

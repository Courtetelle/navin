/**
 * The sign of the wind alerts: a windsock on its pole, blown to the right,
 * its bands orange and white.
 * @returns The sign.
 */
export function WindsockIcon() {
  return (
    <svg className="windsock-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 3.5v18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M3.5 9 8 5M3.5 9 8 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        className="windsock-band"
        d="M8 5l2 .35v7.3L8 13ZM13 5.88l3 .53v5.17l-3 .53ZM18.5 6.86 21 7.3v3.4l-2.5.44Z"
      />
      <path
        d="M8 5l13 2.3v3.4L8 13Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

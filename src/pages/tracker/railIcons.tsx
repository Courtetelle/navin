/** A drawing pin, slightly tilted, as on a notice board. */
function PushPin() {
  return (
    <svg className="rail-svg" viewBox="0 0 40 40" aria-hidden="true">
      <g transform="rotate(35 20 20)">
        <path
          d="M20 23v14"
          stroke="#8a9099"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M13 3h14v3.5l-2.6 1.4v8.4l5.6 5v2.7H10v-2.7l5.6-5V7.9L13 6.5z"
          fill="#d0021b"
        />
        <path
          d="M17.6 8.5v8"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}

/** A camera: body in the text colour (red by night), blue lens. */
function Camera() {
  return (
    <svg className="rail-svg" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M14 11l2.6-4.6h6.8L26 11z" fill="currentColor" />
      <rect
        x="3"
        y="10.5"
        width="34"
        height="23.5"
        rx="5"
        fill="currentColor"
      />
      <circle cx="20" cy="22.3" r="8.4" fill="#fff" />
      <circle cx="20" cy="22.3" r="6.6" fill="#1e5aa8" />
      <circle cx="20" cy="22.3" r="3.2" fill="#0b2545" />
      <circle cx="17.7" cy="20" r="1.5" fill="#fff" opacity="0.85" />
      <rect x="29" y="13.5" width="5" height="3" rx="1" fill="#f39c12" />
    </svg>
  );
}

/** A handheld VHF: body in the text colour, green screen. */
function Vhf() {
  return (
    <svg className="rail-svg" viewBox="0 0 40 40" aria-hidden="true">
      <rect
        x="15"
        y="1.5"
        width="3.4"
        height="12"
        rx="1.7"
        fill="currentColor"
      />
      <rect x="12" y="11" width="17" height="27" rx="3.5" fill="currentColor" />
      <rect x="15" y="14.5" width="11" height="7" rx="1.2" fill="#8fd19e" />
      <path
        d="M15.5 26h10M15.5 29.2h10M15.5 32.4h10"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

/** A green phone handset. */
function Phone() {
  return (
    <svg className="rail-svg" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d="M11.5 4.6c1.9-1 4.2-.2 5.1 1.8l2.2 5c.6 1.4.2 3-1 4l-2.2 1.7c1.6 3.5 4.2 6.2 7.6 8l1.6-2.2c.9-1.2 2.6-1.6 4-1l5 2.2c2 .9 2.8 3.2 1.8 5.1l-1.2 2.3c-1.2 2.3-3.8 3.5-6.4 2.9C16.3 32.4 8 24 5.9 13.4c-.5-2.5.7-5 3-6.2z"
        fill="#12a150"
      />
    </svg>
  );
}

/** The sun and cloud of the NavIn menu. */
function Weather() {
  return (
    <svg className="rail-svg rail-wx" viewBox="0 0 48 40" aria-hidden="true">
      <g stroke="#f5a623" strokeWidth="2.4" strokeLinecap="round">
        <path d="M17 2v4M6.4 6.4l2.8 2.8M2 17h4M27.6 6.4l-2.8 2.8" />
      </g>
      <circle
        cx="17"
        cy="17"
        r="7"
        fill="#f5c518"
        stroke="#f5a623"
        strokeWidth="1.6"
      />
      <path
        d="M15 29a7 7 0 0 1 3-13.4 9 9 0 0 1 17 2.4 6 6 0 0 1 1 11z"
        fill="#fff"
        stroke="#5f6f86"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g stroke="#0b3d91" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M10 33.5h22c3 0 3-4 0-4" />
        <path d="M14 38h16" />
      </g>
    </svg>
  );
}

/** The chequered flag of PréP, as in the NavIn menu. */
function Flag() {
  return (
    <svg className="rail-svg" viewBox="-2 -1 52 42" aria-hidden="true">
      <defs>
        <pattern id="railck" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#fff" />
          <rect width="4" height="4" fill="#111" />
          <rect x="4" y="4" width="4" height="4" fill="#111" />
        </pattern>
      </defs>
      <path
        d="M9 3v35"
        stroke="#5b3a1e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10 5c8-4 15 4 23 1s10-2 12-2v20c-3 0-5-1-12 2s-15-5-23-1z"
        fill="url(#railck)"
        stroke="#111"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x="29"
        y="37.6"
        textAnchor="middle"
        fontSize="11"
        fontWeight="900"
        fill="currentColor"
        fontFamily="Arial, Helvetica, sans-serif"
        textLength="26"
        lengthAdjust="spacingAndGlyphs"
      >
        PréP
      </text>
    </svg>
  );
}

/** The green start of a track, as in the NavIn menu. */
function Start() {
  return (
    <svg className="rail-svg" viewBox="0 0 48 40" aria-hidden="true">
      <path
        d="M14 25c6-1 8-10 15-10s10-7 16-10"
        stroke="#0b3d91"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="1 5"
      />
      <path
        d="M12 25V3"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M13 3l10 4.5L13 12z" fill="#12a150" />
      <circle
        cx="12"
        cy="25"
        r="3.2"
        fill="#12a150"
        stroke="#fff"
        strokeWidth="1.2"
      />
      <rect x="1" y="27.5" width="34" height="12" rx="3" fill="#12a150" />
      <text
        x="18"
        y="37.3"
        textAnchor="middle"
        fontSize="10"
        fontWeight="900"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        textLength="28"
        lengthAdjust="spacingAndGlyphs"
      >
        START
      </text>
    </svg>
  );
}

/**
 * The drawn icon of a function, where the columns have one.
 * @param props - The function key.
 * @param props.name - The function key.
 * @returns The drawing, or null to keep the emoji.
 */
export function RailIcon({ name }: { name: string }) {
  if (name === 'act:point') return <PushPin />;
  if (name === 'act:photo') return <Camera />;
  if (name === 'vhf') return <Vhf />;
  if (name === 'weather') return <Weather />;
  if (name === 'prep') return <Flag />;
  if (name === 'start') return <Start />;
  if (name === 'phone') return <Phone />;
  return null;
}

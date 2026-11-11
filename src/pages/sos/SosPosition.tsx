import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { GpsButton } from '../../features/safety/GpsButton.tsx';
import { fmtPos } from '../../lib/geo.ts';
import type { TimedPosition } from '../../state/index.ts';
import { state } from '../../state/index.ts';

/** Props of {@link PositionSection}. */
interface PositionSectionProps {
  position: TimedPosition | null;
  /** Redraws the screen after a new position. */
  onRedraw: () => void;
}

/**
 * « Position actuelle » with the GPS button.
 * @param props - Position and redraw.
 * @returns The section.
 */
export function PositionSection({ position, onRedraw }: PositionSectionProps) {
  return (
    <FoldSection title="Position actuelle">
      <div className="value" style={{ fontSize: 28 }}>
        <PositionLines position={position} />
      </div>
      <PositionTime position={position} />
      <GpsButton
        className="btn big primary"
        id="sosGps"
        onPosition={(fix) => {
          state.view.sosPos.value = {
            lat: fix.coords.latitude,
            lon: fix.coords.longitude,
            at: new Date().toISOString(),
          };
          onRedraw();
        }}
      >
        📍 Actualiser la position GPS
      </GpsButton>
    </FoldSection>
  );
}

/**
 * A position on two lines, or dashes.
 * @param props - Position.
 * @returns The text.
 */
export function PositionLines({
  position,
}: {
  position: TimedPosition | null;
}) {
  if (!position) return '– –';
  const text = fmtPos(position);
  const separator = text.indexOf('  ');
  if (separator === -1) return text;
  return (
    <>
      {text.slice(0, separator)}
      <br />
      {text.slice(separator + 2)}
    </>
  );
}

/**
 * « relevée à … » under a position.
 * @param props - Position.
 * @returns The paragraph, or nothing without a time.
 */
export function PositionTime({ position }: { position: TimedPosition | null }) {
  if (!position?.at) return null;
  return (
    <HelpText keep style={{ textAlign: 'center' }}>
      <>
        relevée à <TzTime date={new Date(position.at)} />
      </>
    </HelpText>
  );
}

import { useEffect } from 'react';

/**
 * The phone held upright: NavIn asks to be turned sideways, where it shows
 * the same buttons as the tablet (the upright layout is set aside for now).
 * The installed app also asks the system to stay sideways, where it can.
 * @returns The notice, shown by the style only on an upright phone.
 */
export function TurnPhone() {
  useEffect(() => {
    const orientation = globalThis.screen.orientation as ScreenOrientation & {
      lock?: (kind: string) => Promise<void>;
    };
    orientation.lock?.('landscape').catch(() => undefined);
  }, []);
  return (
    <div className="turn-phone" role="alert">
      <span className="turn-ico" aria-hidden="true">
        📱
      </span>
      <span>Tournez le téléphone à l’horizontale</span>
      <small>
        NavIn s’utilise pour l’instant en paysage, avec les mêmes boutons que
        sur la tablette.
      </small>
    </div>
  );
}

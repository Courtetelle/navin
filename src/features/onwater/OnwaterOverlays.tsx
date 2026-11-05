import { PhotoView } from './PhotoView.tsx';
import { WindFlashes, WindPopup } from './WindOverlays.tsx';

/**
 * Overlays shown above every screen.
 * @returns The portals of the wind alert and of the photo viewer.
 */
export function OnwaterOverlays() {
  return (
    <>
      <WindFlashes />
      <WindPopup />
      <PhotoView />
    </>
  );
}

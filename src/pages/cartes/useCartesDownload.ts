import { useState } from 'react';

import { zoneBusy, zoneDownload } from '../../features/map/zoneDownload.ts';
import type { Zone } from '../../features/map/zoneStore.ts';
import {
  radiusBounds,
  radiusZoom,
  zoneList,
  zoneSave,
} from '../../features/map/zoneStore.ts';
import { buzz } from '../../lib/dom.ts';
import { lastKnownPos, state, toast } from '../../state/index.ts';

interface CartesPosition {
  lat: number;
  lon: number;
  old?: boolean;
}

/** State of the « load the maps around me » button. */
export interface CartesDownload {
  disabled: boolean;
  /** Text of `#cartesState`. */
  status: string;
  /** Button text during the download. */
  progress: string | null;
  /** Start the download. */
  start: () => void;
}

/**
 * Load the maps around my position (legacy `VIEWS.cartes`, `#cartesGo`).
 * @param km - Radius.
 * @param onDone - Runs when the maps were kept and the screen is still open.
 * @returns The state of the button.
 */
export function useCartesDownload(
  km: number,
  onDone: () => void,
): CartesDownload {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState<string | null>(null);

  const run = async () => {
    buzz();
    if (zoneBusy.current) {
      toast('Chargement déjà en cours');
      return;
    }
    if (!navigator.onLine) {
      toast('Il faut du réseau pour charger les cartes');
      return;
    }
    setDisabled(true);
    setStatus('📍 Recherche de votre position…');
    const position = await cartesPos();
    if (!position) {
      setDisabled(false);
      setStatus('');
      toast(
        'Position GPS introuvable : autorisez la localisation puis réessayez',
      );
      return;
    }
    const { lat, lon, old } = position;
    const bounds = radiusBounds(lat, lon, km);
    const zoomMax = radiusZoom(bounds);
    const zone: Zone = {
      id: Date.now().toString(36),
      name: `Autour de moi · ${km} km`,
      b: bounds,
      zmax: zoomMax,
      at: new Date().toISOString(),
      center: [lat, lon],
      km,
    };
    const origin = old ? 'Dernière position connue' : 'Position';
    setStatus(
      `${origin} : ${lat.toFixed(3)}, ${lon.toFixed(3)} · détail jusqu’au zoom ${zoomMax}`,
    );
    zoneBusy.current = true;
    const result = await zoneDownload(zone, (done, all) => {
      setProgress(`⬇ ${done} / ${all} morceaux…`);
    });
    zoneBusy.current = false;
    if (!result.ok) {
      setDisabled(false);
      setProgress(null);
      toast('Chargement impossible');
      return;
    }
    zoneSave([...zoneList(), { ...zone, ok: result.ok, ko: result.ko }]);
    const missing = result.ko ? `, ${result.ko} manquants` : '';
    toast(
      `✓ Cartes chargées sur ${km} km autour de vous (${result.ok} morceaux${missing})`,
    );
    if (state.view.currentView.value === 'cartes') onDone();
  };

  return { disabled, status, progress, start: () => void run() };
}

function cartesPos(): Promise<CartesPosition | null> {
  return new Promise((resolve) => {
    const fallback = () => {
      const known = lastKnownPos();
      resolve(known ? { lat: known.lat, lon: known.lon, old: true } : null);
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ lat: coords.latitude, lon: coords.longitude });
      },
      fallback,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  });
}

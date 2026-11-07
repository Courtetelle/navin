import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import type { OfflineMap } from '../../features/map/offlineMapStore.ts';
import {
  deleteOfflineMap,
  importOfflineMap,
  offlineMaps,
} from '../../features/map/offlineMapStore.ts';
import { showPlace } from '../../features/map/placeTarget.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { toast } from '../../state/index.ts';

const BYTES_PER_MB = 1_000_000;

/**
 * The map files of this device, and the button that imports one.
 * @returns The section.
 */
export function OfflineMaps() {
  const tr = useTr();
  const [maps, setMaps] = useState<OfflineMap[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void offlineMaps()
      .then(setMaps)
      .catch(() => setMaps([]));
  };
  useEffect(refresh, []);
  const add = async (chosen: File) => {
    setProgress(0);
    try {
      const map = await importOfflineMap(chosen, setProgress);
      toast(`Carte ${map.name} gardée sur cet appareil`);
      refresh();
    } catch (error) {
      toast(
        error instanceof Error && error.name === 'QuotaExceededError'
          ? 'Pas assez de place sur cet appareil'
          : 'Ce fichier n’est pas une carte .pmtiles',
      );
    } finally {
      setProgress(null);
    }
  };
  return (
    <section className="field" id="offlineMaps">
      <h2>{tr('Cartes hors ligne')}</h2>
      {maps?.map((map) => (
        <SwipeRow
          key={map.id}
          id={map.id}
          name={map.name}
          onDelete={(id) => {
            void deleteOfflineMap(id).then(refresh);
          }}
        >
          <div className="cartes-z" data-offline-map={map.id}>
            <div>
              <b>{map.name}</b>
              <small>
                {`${fmtShortDate(new Date(map.at))} · ${Math.round(map.size / BYTES_PER_MB)} Mo`}
              </small>
            </div>
            <Button
              className="btn"
              aria-label={`Voir ${map.name} sur la carte`}
              onClick={() => {
                buzz();
                showPlace({
                  name: map.name,
                  lat: (map.south + map.north) / 2,
                  lon: (map.west + map.east) / 2,
                });
              }}
            >
              🗺
            </Button>
          </div>
        </SwipeRow>
      ))}
      {maps?.length === 0 ? (
        <p className="help">
          {tr('Aucune carte sur cet appareil pour l’instant.', { help: true })}
        </p>
      ) : null}
      <ButtonRow>
        <Button
          className="btn big primary"
          id="offlineImport"
          disabled={progress !== null}
          onClick={() => {
            buzz();
            file.current?.click();
          }}
        >
          {progress === null
            ? tr('⬆ Importer une carte')
            : `${tr('Import en cours…')} ${Math.round(progress * 100)} %`}
        </Button>
      </ButtonRow>
      <input
        type="file"
        id="offlineFile"
        hidden
        ref={file}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          if (chosen) void add(chosen);
        }}
      />
    </section>
  );
}

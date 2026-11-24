import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup, Map as LeafletMap, MapOptions } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import type { GeoBox } from '../../features/map/constants.ts';
import { OSM_TILES } from '../../features/map/constants.ts';
import {
  chooseBase,
  chooseOverlay,
  layerPrefs,
  mapLayerNames,
} from '../../features/map/layerPrefs.ts';
import { loadLeaflet } from '../../features/map/leaflet.ts';
import { marksFly } from '../../features/map/longPress.ts';
import type { MapSheet, SheetScale } from '../../features/map/mapSheets.ts';
import {
  PLAN_BOX,
  planSheets,
  sheetArea,
  sheetAt,
  sheetEstimate,
  sheetTitle,
} from '../../features/map/mapSheets.ts';
import type { OfflineMap } from '../../features/map/offlineMapStore.ts';
import {
  deleteOfflineMap,
  offlineMaps,
} from '../../features/map/offlineMapStore.ts';
import { onlineLayerBox } from '../../features/map/regionalLayers.ts';
import {
  downloadSheet,
  sheetJob,
  stopSheetDownload,
} from '../../features/map/sheetDownload.ts';
import { shoreGrid, squareHasShore } from '../../features/onwater/shoreFar.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

const MB = 1_000_000;
const OFFLINE_PREFIX = 'Hors ligne · ';

/** Colours of the plan, by day (the night mode reddens the whole screen). */
const COLORS = {
  sheet: '#0b3d91',
  mine: '#0a8a2a',
  online: '#d06000',
  here: '#c00000',
};

interface Place {
  lat: number;
  lon: number;
}

function inBox(box: GeoBox, { lat, lon }: Place): boolean {
  return lat >= box.s && lat <= box.n && lon >= box.w && lon <= box.e;
}

function mapBox(map: OfflineMap): GeoBox {
  return { s: map.south, w: map.west, n: map.north, e: map.east };
}

function megabytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / MB))} Mo`;
}

function part(value: number, plus: string, minus: string): string {
  let whole = Math.floor(Math.abs(value));
  let minutes = Math.round((Math.abs(value) - whole) * 60);
  if (minutes === 60) {
    whole++;
    minutes = 0;
  }
  return `${whole}°${String(minutes).padStart(2, '0')}′ ${value < 0 ? minus : plus}`;
}

function degreesText({ lat, lon }: Place): string {
  return `${part(lat, 'N', 'S')} · ${part(lon, 'E', 'W')}`;
}

/**
 * The plan of the maps of Europe, over the whole screen: the sheets to
 * download (large or detailed), the maps of this device and the online
 * backgrounds of a region, each drawn where it covers. A touch on the plan
 * lists what covers that place, with big buttons to show, hide, choose,
 * download or delete.
 * @param props - Props.
 * @param props.onClose - Closes the plan.
 * @returns The plan.
 */
export function MapPlan({ onClose }: { onClose: () => void }) {
  useSignals();
  const box = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<LeafletMap | null>(null);
  const drawn = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState<SheetScale>('detail');
  const [here, setHere] = useState<Place | null>(null);
  const [maps, setMaps] = useState<OfflineMap[]>([]);
  const [keep, setKeep] = useState<
    ((south: number, west: number) => boolean) | null
  >(null);
  const refresh = () => {
    void offlineMaps()
      .then(setMaps)
      .catch(() => setMaps([]));
  };
  useEffect(refresh, []);
  useEffect(() => {
    let live = true;
    void shoreGrid().then((grid) => {
      if (live && grid) setKeep(() => squareHasShore(grid));
    });
    return () => {
      live = false;
    };
  }, []);
  // The map of the plan: Europe on OpenStreetMap, a touch picks a place.
  useEffect(() => {
    let live = true;
    void loadLeaflet().then((L) => {
      if (!live || !box.current) return;
      const map = L.map(box.current, {
        preferCanvas: true,
        zoomControl: false,
        rotateControl: false,
        attributionControl: true,
        minZoom: 3,
        maxZoom: 12,
      } as MapOptions);
      L.tileLayer(OSM_TILES, {
        subdomains: 'abc',
        maxZoom: 19,
        maxNativeZoom: 18,
        crossOrigin: true,
        attribution: '© OpenStreetMap France',
      }).addTo(map);
      map.fitBounds([
        [PLAN_BOX.s, PLAN_BOX.w],
        [PLAN_BOX.n, PLAN_BOX.e],
      ]);
      drawn.current = L.layerGroup().addTo(map);
      map.on('click', (event) => {
        buzz();
        setHere({ lat: event.latlng.lat, lon: event.latlng.lng });
      });
      leafletMap.current = map;
      setReady(true);
    });
    return () => {
      live = false;
      leafletMap.current?.remove();
      leafletMap.current = null;
    };
  }, []);
  const sheets = useMemo(
    () => planSheets(scale, keep ?? undefined),
    [scale, keep],
  );
  const mine = new Set(maps.map((map) => map.id));
  const job = sheetJob.value;
  const names = mapLayerNames.value;
  // What the plan draws: the sheets, the maps of this device, the regional
  // online backgrounds, the place touched.
  useEffect(() => {
    const map = leafletMap.current;
    const group = drawn.current;
    if (!ready || !map || !group) return;
    void loadLeaflet().then((L) => {
      group.clearLayers();
      const rect = (area: GeoBox) =>
        [
          [area.s, area.w],
          [area.n, area.e],
        ] as [[number, number], [number, number]];
      for (const sheet of sheets) {
        const owned = mine.has(sheet.id);
        L.rectangle(rect(sheet.box), {
          interactive: false,
          color: owned ? COLORS.mine : COLORS.sheet,
          weight: owned ? 2 : 1,
          opacity: 0.7,
          fillColor: owned ? COLORS.mine : COLORS.sheet,
          fillOpacity: owned ? 0.35 : 0.04,
        }).addTo(group);
      }
      for (const item of maps) {
        L.rectangle(rect(mapBox(item)), {
          interactive: false,
          color: COLORS.mine,
          weight: 3,
          fillOpacity: mine.has(item.id) ? 0 : 0.2,
          fillColor: COLORS.mine,
        }).addTo(group);
      }
      const regional = new Set<GeoBox>();
      for (const item of names) {
        const area = onlineLayerBox(item.name);
        if (area) regional.add(area);
      }
      for (const area of regional) {
        L.rectangle(rect(area), {
          interactive: false,
          color: COLORS.online,
          weight: 3,
          dashArray: '8 6',
          fill: false,
        }).addTo(group);
      }
      if (here) {
        const sheet = sheetAt(scale, here.lat, here.lon);
        if (sheet) {
          L.rectangle(rect(sheet.box), {
            interactive: false,
            color: COLORS.here,
            weight: 4,
            fill: false,
          }).addTo(group);
        }
        L.circleMarker([here.lat, here.lon], {
          interactive: false,
          radius: 9,
          color: '#ffffff',
          weight: 3,
          fillColor: COLORS.here,
          fillOpacity: 1,
        }).addTo(group);
      }
    });
    // `mine` follows `maps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sheets, maps, names, here, scale]);
  const start = async (sheet: MapSheet) => {
    buzz();
    const kept = await downloadSheet(sheet);
    if (kept) {
      toast(`Carte ${kept.name} gardée sur cet appareil`);
      refresh();
    }
  };
  const close = () => {
    buzz();
    onClose();
  };
  return (
    <div
      className="map-plan"
      id="mapPlan"
      role="dialog"
      aria-label="Plan des cartes"
    >
      <div className="map-plan-bar">
        <Button className="btn" id="mapPlanClose" onClick={close}>
          ◀ Fermer
        </Button>
        <h2>Plan des cartes · Europe</h2>
        <div className="seg map-plan-scale">
          <Button
            className={scale === 'large' ? 'btn on' : 'btn'}
            choice
            data-scale="large"
            aria-pressed={scale === 'large'}
            onClick={() => {
              buzz();
              setScale('large');
            }}
          >
            Grandes cartes
          </Button>
          <Button
            className={scale === 'detail' ? 'btn on' : 'btn'}
            choice
            data-scale="detail"
            aria-pressed={scale === 'detail'}
            onClick={() => {
              buzz();
              setScale('detail');
            }}
          >
            Cartes détaillées
          </Button>
        </div>
      </div>
      <div className="map-plan-body">
        <div className="map-plan-mapbox">
          <div className="map-plan-map" ref={box} id="mapPlanMap" />
          <div className="map-plan-zoom">
            <Button
              className="btn"
              choice
              aria-label="Zoom avant"
              onClick={() => {
                buzz();
                leafletMap.current?.zoomIn();
              }}
            >
              +
            </Button>
            <Button
              className="btn"
              choice
              aria-label="Zoom arrière"
              onClick={() => {
                buzz();
                leafletMap.current?.zoomOut();
              }}
            >
              −
            </Button>
          </div>
        </div>
        <div className="map-plan-side" id="mapPlanSide">
          {job ? <JobRow job={job} /> : null}
          {here ? (
            <HereList
              here={here}
              scale={scale}
              maps={maps}
              mine={mine}
              busy={job !== null && job.error === undefined}
              onStart={(sheet) => void start(sheet)}
              onDeleted={refresh}
            />
          ) : (
            <PlanHelp maps={maps} onDeleted={refresh} />
          )}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="map-plan-legend">
      <li>
        <i style={{ borderColor: COLORS.sheet }} /> Carte à télécharger
      </li>
      <li>
        <i style={{ borderColor: COLORS.mine, background: '#0a8a2a59' }} /> Sur
        cet appareil
      </li>
      <li>
        <i style={{ borderColor: COLORS.online, borderStyle: 'dashed' }} /> Fond
        en ligne régional
      </li>
    </ul>
  );
}

function PlanHelp({
  maps,
  onDeleted,
}: {
  maps: OfflineMap[];
  onDeleted: () => void;
}) {
  return (
    <>
      <p className="help">
        Touchez le plan là où vous naviguez : NavIn dit quelles cartes couvrent
        ce point, pour les afficher, les masquer, choisir le fond ou télécharger
        la carte qui manque. Grandes cartes : traversées, jusqu’au zoom 10.
        Cartes détaillées : côte, ports et lacs, jusqu’au zoom 14.
      </p>
      <Legend />
      <h3>Sur cet appareil</h3>
      {maps.length === 0 ? (
        <p className="help">Aucune carte sur cet appareil pour l’instant.</p>
      ) : (
        maps.map((map) => (
          <DeviceMapRow key={map.id} map={map} onDeleted={onDeleted} />
        ))
      )}
    </>
  );
}

function JobRow({ job }: { job: NonNullable<typeof sheetJob.value> }) {
  const part = job.total ? Math.round((job.done / job.total) * 100) : 0;
  return (
    <div className="map-plan-job" id="mapPlanJob" role="status">
      <b>{sheetTitle(job.sheet)}</b>
      {job.error ? (
        <>
          <p className="help">⚠️ {job.error}</p>
          <Button
            className="btn"
            onClick={() => {
              buzz();
              sheetJob.value = null;
            }}
          >
            OK
          </Button>
        </>
      ) : (
        <>
          <progress max={100} value={part} />
          <span>
            Téléchargement {part} % ({job.done} / {job.total} morceaux)
          </span>
          <Button
            className="btn"
            id="mapPlanStop"
            onClick={() => {
              buzz();
              stopSheetDownload();
            }}
          >
            ✋ Arrêter
          </Button>
        </>
      )}
    </div>
  );
}

function HereList({
  here,
  scale,
  maps,
  mine,
  busy,
  onStart,
  onDeleted,
}: {
  here: Place;
  scale: SheetScale;
  maps: OfflineMap[];
  mine: Set<string>;
  busy: boolean;
  onStart: (sheet: MapSheet) => void;
  onDeleted: () => void;
}) {
  const order: SheetScale[] =
    scale === 'detail' ? ['detail', 'large'] : ['large', 'detail'];
  const sheets = order
    .map((one) => sheetAt(one, here.lat, here.lon))
    .filter((sheet): sheet is MapSheet => sheet !== null);
  const covering = maps.filter((map) => inBox(mapBox(map), here));
  const names = mapLayerNames.value.filter(
    (item) =>
      !item.name.startsWith(OFFLINE_PREFIX) &&
      (onlineLayerBox(item.name) === null ||
        inBox(onlineLayerBox(item.name) as GeoBox, here)),
  );
  const prefs = layerPrefs.value;
  const bases = names.filter((item) => item.kind === 'base');
  const overlays = names.filter((item) => item.kind === 'overlay');
  const base =
    bases.find((item) => item.name === prefs.base)?.name ??
    bases.find((item) => item.on)?.name;
  return (
    <div id="mapPlanHere">
      <h3>Ici : {degreesText(here)}</h3>
      <h4>Sur cet appareil</h4>
      {covering.length === 0 ? (
        <p className="help">Aucune carte de l’appareil ne couvre ce point.</p>
      ) : (
        covering.map((map) => (
          <DeviceMapRow key={map.id} map={map} onDeleted={onDeleted} />
        ))
      )}
      <h4>À télécharger (OpenFreeMap, gratuit)</h4>
      {sheets.length === 0 ? (
        <p className="help">Ce point est hors du plan de l’Europe.</p>
      ) : null}
      {sheets
        .filter((sheet) => !mine.has(sheet.id))
        .map((sheet) => (
          <div className="map-plan-row" key={sheet.id} data-sheet={sheet.id}>
            <div>
              <b>{sheetTitle(sheet)}</b>
              <small>
                {sheetArea(sheet)} · zoom {sheet.maxZoom} · environ{' '}
                {megabytes(sheetEstimate(sheet))}
              </small>
            </div>
            <Button
              className="btn primary"
              disabled={busy}
              data-download={sheet.id}
              onClick={() => onStart(sheet)}
            >
              ⬇ Télécharger
            </Button>
          </div>
        ))}
      {sheets.length > 0 && sheets.every((sheet) => mine.has(sheet.id)) ? (
        <p className="help">Les deux cartes de ce point sont déjà là.</p>
      ) : null}
      {bases.length + overlays.length > 0 ? (
        <>
          <h4>Fonds en ligne ici (réseau)</h4>
          <div className="map-layers">
            {bases.map((item) => (
              <label className="map-layer" key={item.name}>
                <input
                  type="radio"
                  name="mapPlanBase"
                  checked={item.name === base}
                  onChange={() => {
                    buzz();
                    chooseBase(item.name);
                  }}
                />
                <span>{item.name}</span>
              </label>
            ))}
            {overlays.map((item) => (
              <label className="map-layer" key={item.name}>
                <input
                  type="checkbox"
                  checked={prefs.on[item.name] ?? item.on}
                  onChange={(event) => {
                    buzz();
                    chooseOverlay(item.name, event.target.checked);
                  }}
                />
                <span>{item.name}</span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p className="help">
          Ouvrez une fois la carte : ses fonds en ligne s’affichent ici.
        </p>
      )}
    </div>
  );
}

function DeviceMapRow({
  map,
  onDeleted,
}: {
  map: OfflineMap;
  onDeleted: () => void;
}) {
  useSignals();
  const [asking, setAsking] = useState(false);
  const entry = `${OFFLINE_PREFIX}${map.name}`;
  const shown = layerPrefs.value.on[entry] ?? true;
  return (
    <div className="map-plan-row" data-plan-map={map.id}>
      <div>
        <b>{map.name}</b>
        <small>
          {megabytes(map.size)} · zoom {map.maxZoom}
        </small>
      </div>
      <div className="map-plan-acts">
        <Button
          className={shown ? 'btn on' : 'btn'}
          aria-pressed={shown}
          data-plan-show={map.id}
          onClick={() => {
            buzz();
            chooseOverlay(entry, !shown);
          }}
        >
          {shown ? '👁 Affichée' : '🚫 Masquée'}
        </Button>
        <Button
          className="btn"
          aria-label={`Voir ${map.name} sur la carte`}
          onClick={() => {
            buzz();
            marksFly.position = [
              (map.south + map.north) / 2,
              (map.west + map.east) / 2,
            ];
            go('tracker');
          }}
        >
          🗺 Voir
        </Button>
        <Button
          className={asking ? 'btn danger' : 'btn'}
          data-plan-delete={map.id}
          onClick={() => {
            buzz();
            if (!asking) {
              setAsking(true);
              return;
            }
            void deleteOfflineMap(map.id).then(() => {
              toast(`Carte ${map.name} supprimée`);
              onDeleted();
            });
          }}
        >
          {asking ? '🗑 Confirmer' : '🗑'}
        </Button>
      </div>
    </div>
  );
}

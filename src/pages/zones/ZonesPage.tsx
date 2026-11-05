import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { askConfirm } from '../../features/map/dialogs.ts';
import {
  zoneBusy,
  zoneDelete,
  zoneDownload,
} from '../../features/map/zoneDownload.ts';
import type { Zone } from '../../features/map/zoneStore.ts';
import {
  ZONE_MAX,
  ZONE_ZOOMS,
  zoneList,
  zoneSave,
  zoneTileXY,
} from '../../features/map/zoneStore.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

import { ZoneItem } from './ZoneItem.tsx';
import { mapBox, useZoneMap } from './useZoneMap.ts';

const DOWNLOAD_LABEL = '⬇ Télécharger cette zone';
const HELP =
  'Cadrez la carte sur la zone où vous allez naviguer, choisissez le niveau de détail, puis téléchargez (Wi-Fi conseillé). Le plan (données OpenStreetMap) et le balisage OpenSeaMap restent alors sur l’appareil, même sans réseau. Le balisage OpenSeaMap est incomplet par endroits et ne remplace pas une carte marine officielle.';

/**
 * Screen `zones`: choose a zone by hand and keep its maps offline (legacy `VIEWS.zones`).
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function ZonesPage() {
  const [version, setVersion] = useState(0);
  return (
    <ZonesContent
      key={version}
      onChange={() => setVersion((value) => value + 1)}
    />
  );
}

function ZonesContent({ onChange }: { onChange: () => void }) {
  useSignals();
  useNavFields();
  const tr = useTr();
  const inCruise = Boolean(state.data.cruise.value);
  const backTo = inCruise ? 'map' : 'more';
  const box = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const [zoomMax, setZoomMax] = useState(14);
  const [zones] = useState(zoneList);
  const [progress, setProgress] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { map, estimate, tooBig, unavailable } = useZoneMap(box, zoomMax);

  const download = async () => {
    buzz();
    if (!map.current || zoneBusy.current) return;
    if (!navigator.onLine) {
      toast('Il faut du réseau pour télécharger');
      return;
    }
    const bounds = mapBox(map.current);
    if (zoneTileXY(bounds, zoomMax).length > ZONE_MAX) {
      toast('Zone trop grande');
      return;
    }
    const typed = (name.current?.value ?? '').trim();
    const zoneName = typed || `Zone du ${fmtShortDate(new Date())}`;
    const zone: Zone = {
      id: Date.now().toString(36),
      name: zoneName,
      b: bounds,
      zmax: zoomMax,
      at: new Date().toISOString(),
    };
    zoneBusy.current = true;
    setDownloading(true);
    const result = await zoneDownload(zone, (done, all) => {
      setProgress(`⬇ ${done} / ${all} tuiles…`);
    });
    zoneBusy.current = false;
    if (!result.ok) {
      setDownloading(false);
      setProgress(null);
      toast('Téléchargement impossible');
      return;
    }
    zoneSave([...zoneList(), { ...zone, ok: result.ok, ko: result.ko }]);
    const missing = result.ko ? `, ${result.ko} manquantes` : '';
    toast(
      `Zone « ${zoneName} » gardée hors ligne (${result.ok} tuiles${missing})`,
    );
    onChange();
  };

  const removeZone = async (zone: Zone) => {
    buzz();
    const question = `Supprimer la zone « ${zone.name} » de l’appareil ?`;
    if (!askConfirm(question)) return;
    await zoneDelete(zone.id);
    toast('Zone supprimée');
    onChange();
  };

  return (
    <>
      <PageBack
        label={`◀ ${tr(inCruise ? 'Carte' : 'Plus')}`}
        data-go={backTo}
        onClick={() => {
          buzz();
          go(backTo);
        }}
      />
      <PageTitle helps={[HELP]}>Zones hors ligne</PageTitle>
      <div id="zoneMap" className="map" ref={box}>
        {unavailable ? (
          <div className="empty-state">{tr('Carte indisponible.')}</div>
        ) : null}
      </div>
      <h3>{tr('Détail')}</h3>
      <div className="row c4" id="zoneZ">
        {ZONE_ZOOMS.map(([zoom, label]) => (
          <Button
            key={zoom}
            className={zoom === zoomMax ? 'btn on' : 'btn'}
            data-z={zoom}
            onClick={() => {
              buzz();
              setZoomMax(zoom);
            }}
          >
            {tr(label)}
            <small>{tr(`zoom ${zoom}`)}</small>
          </Button>
        ))}
      </div>
      <div className="cf">
        <label htmlFor="zoneName">{tr('Nom de la zone')}</label>
        <input
          className="text"
          id="zoneName"
          type="text"
          placeholder={tr.placeholder('ex. Split – Hvar')}
          ref={name}
        />
      </div>
      <HelpText id="zoneEst">{estimate}</HelpText>
      <div className="row">
        <Button
          className="btn big primary"
          id="zoneGo"
          disabled={tooBig || downloading}
          onClick={() => void download()}
        >
          {progress ?? tr(DOWNLOAD_LABEL)}
        </Button>
      </div>
      <h2>{tr('Mes zones')}</h2>
      <div id="zoneList">
        {zones.length > 0 ? (
          zones.map((zone) => (
            <ZoneItem
              key={zone.id}
              zone={zone}
              onShow={() => {
                buzz();
                map.current?.fitBounds([
                  [zone.b.s, zone.b.w],
                  [zone.b.n, zone.b.e],
                ]);
                globalThis.scrollTo(0, 0);
              }}
              onDelete={() => void removeZone(zone)}
            />
          ))
        ) : (
          <p className="help">
            {tr('Aucune zone enregistrée.', { help: true })}
          </p>
        )}
      </div>
    </>
  );
}

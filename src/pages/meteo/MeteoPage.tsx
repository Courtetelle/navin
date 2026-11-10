import { useSignals } from '@preact/signals-react/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { defaultMapCenter } from '../../features/map/shownMap.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import {
  liveStations,
  stationKey,
  windConfig,
  windWatchPlace,
} from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { isLake, lastKnownPos } from '../../state/index.ts';

import { StationCard } from './StationCard.tsx';
import { StationList } from './StationList.tsx';
import type { LivePlace } from './useLiveMap.ts';
import { useLiveMap } from './useLiveMap.ts';

/** Radii offered, in km. */
const RADII = [15, 30, 60] as const;
/** The stations are read again this often while the screen is open. */
const REFRESH_MS = 2 * 60_000;

function boatPlace(): LivePlace {
  const known = lastKnownPos() ?? windWatchPlace.peek();
  if (known) return { lat: known.lat, lon: known.lon };
  return defaultMapCenter(isLake());
}

/**
 * Screen `meteo`: the wind measured now by the stations around the boat
 * (MeteoSwiss, OpenWindMap, Météo-France), on a map and in a list; a station
 * opens its live card.
 * @returns The screen content.
 */
export function MeteoPage() {
  useSignals();
  const tr = useTr();
  const config = windConfig();
  const [center, setCenter] = useState<LivePlace>(boatPlace);
  const [radius, setRadius] = useState(config.radius);
  const [stations, setStations] = useState<LiveStation[]>([]);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const box = useRef<HTMLDivElement>(null);
  const live = useLiveMap(
    box,
    stations,
    { center, radius },
    config.basis,
    (key) => {
      buzz();
      setPicked(key);
    },
  );
  const searchKey = `${center.lat},${center.lon},${radius},${config.mfKey}`;
  const loading = refreshing || readFor !== searchKey;
  const load = useCallback(() => {
    let closed = false;
    liveStations(center, radius, config.mfKey)
      .then((found) => {
        if (closed) return;
        setStations(found);
        setAt(Date.now());
      })
      .catch(() => undefined)
      .finally(() => {
        if (closed) return;
        setReadFor(searchKey);
        setRefreshing(false);
      });
    return () => {
      closed = true;
    };
  }, [center, radius, config.mfKey, searchKey]);
  useEffect(() => {
    const stop = load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const station = stations.find((item) => stationKey(item) === picked) ?? null;
  const showMap = () => {
    buzz();
    setPicked(null);
    requestAnimationFrame(() => live.invalidate());
  };
  let status = tr('Lecture des stations…');
  if (!loading || at) {
    const count = stations.length;
    status = tr(
      `${count} station${count > 1 ? 's' : ''} à moins de ${radius} km${at ? ` · lu à ${fmtTime(new Date(at))}` : ''}${loading ? ' · actualisation…' : ''}`,
    );
  }
  return (
    <>
      <PageBack
        label="◀ data"
        data-go="more"
        onClick={() => {
          buzz();
          go('more');
        }}
      >
        {tr('◀ data')}
      </PageBack>
      <h1>{tr('🌬 Conditions météo, live')}</h1>
      {station ? (
        <StationCard
          station={station}
          basis={config.basis}
          mfKey={config.mfKey}
          now={now}
          loading={loading}
          onBack={showMap}
          onRefresh={() => {
            buzz();
            setRefreshing(true);
            load();
          }}
        />
      ) : null}
      <div className={station ? 'live-map-part hidden' : 'live-map-part'}>
        <p className="keep-help live-status" role="status">
          {status}
        </p>
        <div id="liveMap" className="map live-map" ref={box}>
          {live.noMap ? (
            <div className="empty-state">
              {tr(
                'Carte indisponible sans réseau : la liste reste ci-dessous.',
              )}
            </div>
          ) : null}
        </div>
        <ButtonRow className="row c3">
          {RADII.map((value) => (
            <Button
              key={value}
              className={value === radius ? 'btn on' : 'btn'}
              onClick={() => {
                buzz();
                setRadius(value);
              }}
            >
              {tr(`${value} km`)}
            </Button>
          ))}
        </ButtonRow>
        <ButtonRow className="row c2">
          <Button
            className="btn primary"
            onClick={() => {
              buzz();
              const middle = live.center();
              if (middle) setCenter(middle);
            }}
          >
            {tr('🔍 Chercher au centre de la carte')}
          </Button>
          <Button
            className="btn"
            onClick={() => {
              buzz();
              setCenter(boatPlace());
            }}
          >
            {tr('📍 Autour du bateau')}
          </Button>
        </ButtonRow>
        {!loading && stations.length === 0 ? (
          <p className="keep-help">
            {tr(
              config.mfKey
                ? 'Aucune station ne mesure le vent ici : élargissez le rayon ou déplacez la carte.'
                : 'Aucune station ne mesure le vent ici : élargissez le rayon, déplacez la carte, ou ajoutez la clé Météo-France dans les réglages (stations françaises).',
            )}
          </p>
        ) : null}
        <StationList
          stations={stations}
          basis={config.basis}
          now={now}
          onPick={(key) => {
            buzz();
            setPicked(key);
            globalThis.scrollTo({ top: 0 });
          }}
        />
        <HelpText>
          Vent mesuré maintenant par les stations MeteoSwiss, les balises
          OpenWindMap et les stations Météo-France (avec la clé des réglages).
          Chiffre en gras : vent moyen ; en petit : rafales ; flèche : sens vers
          lequel souffle le vent. Couleur des alertes de vent. Toucher une
          station pour ses mesures en direct ; déplacer la carte puis « Chercher
          au centre de la carte » pour d’autres stations. Mise à jour toutes les
          2 min.
        </HelpText>
      </div>
    </>
  );
}

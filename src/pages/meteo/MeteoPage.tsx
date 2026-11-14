import { useSignals } from '@preact/signals-react/runtime';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { LiveStation, MfTally } from '../../features/onwater/index.ts';
import {
  liveAlertSpot,
  liveStations,
  newMfTally,
  stationKey,
  windConfig,
} from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import { useWide } from '../../lib/useWide.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go, navigation } from '../../shell/router.ts';

import { StationCard } from './StationCard.tsx';
import { StationList } from './StationList.tsx';
import { boatPlace, liveBackFrom, mapPlace } from './boatPlace.ts';
import { mfTallyText } from './liveText.ts';
import type { LivePlace } from './useLiveMap.ts';
import { useLiveMap } from './useLiveMap.ts';

/** Radii offered, in km. */
const RADII = [15, 30, 60] as const;
/** The stations are read again this often while the screen is open. */
const REFRESH_MS = 2 * 60_000;

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
  const [back] = useState(() => liveBackFrom(navigation.peek().from));
  const wide = useWide();
  // Opened from a wind alert: around the boat, the station of the alert lit.
  const [alert] = useState(() => liveAlertSpot.peek());
  useEffect(() => {
    liveAlertSpot.value = null;
  }, []);
  const [center, setCenter] = useState<LivePlace>(
    () => alert?.boat ?? mapPlace(),
  );
  const [radius, setRadius] = useState(config.radius);
  const [stations, setStations] = useState<LiveStation[]>([]);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [tally, setTally] = useState<MfTally | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const box = useRef<HTMLDivElement>(null);
  const live = useLiveMap(
    box,
    stations,
    { center, radius },
    config.basis,
    alert,
    (key) => {
      buzz();
      setPicked(key);
    },
  );
  const searchKey = `${center.lat},${center.lon},${radius},${config.mfKey}`;
  const loading = refreshing || readFor !== searchKey;
  const load = useCallback(() => {
    let closed = false;
    const counted = newMfTally();
    liveStations(center, radius, config.mfKey, counted)
      .then((found) => {
        if (closed) return;
        setStations(found);
        setTally(config.mfKey ? counted : null);
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
    return () => {
      clearInterval(timer);
    };
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
        label={back.label}
        data-go={back.view}
        onClick={() => {
          buzz();
          go(back.view);
        }}
      >
        {tr(back.label)}
      </PageBack>
      <h1 className="live-title">{tr('🌬 LiveMétéo')}</h1>
      <div className={station ? 'live-page picked' : 'live-page'}>
        {station ? (
          <StationCard
            station={station}
            basis={config.basis}
            mfKey={config.mfKey}
            now={now}
            loading={loading}
            backLabel={
              wide
                ? '◀ Revenir à la liste des stations'
                : '◀ Revenir à la carte des stations'
            }
            onBack={showMap}
            onLocate={() => {
              const key = stationKey(station);
              // On a tablet the map stays beside the card.
              if (!wide) showMap();
              requestAnimationFrame(() => live.focus(key));
            }}
            onRefresh={() => {
              buzz();
              setRefreshing(true);
              load();
            }}
          />
        ) : null}
        <div className={station ? 'live-map-part hidden' : 'live-map-part'}>
          <div className="live-map-wrap">
            <div id="liveMap" className="map live-map" ref={box}>
              {live.noMap ? (
                <div className="empty-state">
                  {tr(
                    'Carte indisponible sans réseau : la liste reste ci-dessous.',
                  )}
                </div>
              ) : null}
            </div>
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
          <ButtonRow className="row c2 live-tools">
            <Button
              className="btn primary"
              onClick={() => {
                buzz();
                const middle = live.center();
                if (middle) setCenter(middle);
              }}
            >
              {tr('🔍 Chercher au centre')}
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
          <p className="keep-help live-status" role="status">
            {status}
          </p>
          {tally ? (
            <p className="keep-help live-mf">
              {tr(mfTallyText(tally, radius))}
            </p>
          ) : null}
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
            Chiffre en gras : vent moyen ; en petit : rafales ; flèche : sens
            vers lequel souffle le vent. Couleur des alertes de vent. S’ouvre là
            où montrait la carte de NavIn ; « Autour du bateau » revient au
            bateau. Toucher une station pour ses mesures en direct ; déplacer la
            carte puis « Chercher au centre de la carte » pour d’autres
            stations. Mise à jour toutes les 2 min.
          </HelpText>
        </div>
      </div>
    </>
  );
}

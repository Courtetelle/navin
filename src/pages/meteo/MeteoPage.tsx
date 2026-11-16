import { useEffect, useState } from 'react';

import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import type { LiveStation } from '../../features/onwater/index.ts';
import {
  liveStations,
  stationKey,
  windConfig,
} from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { layLiveAround } from '../tracker/liveOnMap.ts';

import { StationCard } from './StationCard.tsx';
import { blinkKey, liveBlink, liveDetail } from './liveDetail.ts';

/**
 * Screen `meteo`: the whole card of one station, opened by a long press on
 * its badge of LiveMétéo on the NavIn map. LiveMétéo itself is on the NavIn
 * map; without a station the map comes back.
 * @returns The screen content.
 */
export function MeteoPage() {
  const [detail] = useState(() => liveDetail.peek());
  useEffect(() => {
    liveDetail.value = null;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- opened without a station (the data tile): LiveMétéo on the map
    if (detail) return;
    // The LiveMétéo tile of data: the stations of the zone on the map.
    layLiveAround();
    go('tracker');
  }, [detail]);
  return detail ? <LiveDetail station={detail} /> : null;
}

/**
 * The whole card of one station, opened from its badge on the NavIn map:
 * its past, all its measurements; ◀ back to the map and its badges.
 * @param props - The station.
 * @param props.station - The station.
 * @returns The screen content.
 */
function backToMap(): void {
  buzz();
  go('tracker');
}

function LiveDetail({ station }: { station: LiveStation }) {
  const tr = useTr();
  const config = windConfig();
  const [current, setCurrent] = useState(station);
  const [loading, setLoading] = useState(false);
  const [now] = useState(Date.now);
  return (
    <>
      <PageBack
        label="◀ Carte"
        data-go="livemap"
        data-instant="1"
        onClick={() => {
          // Back on the badge of this station, zoomed in and crowned.
          liveBlink.value = blinkKey(current);
          backToMap();
        }}
      >
        {tr('◀ Carte')}
      </PageBack>
      <TitleInNav>
        <h1 className="live-title">{tr('🌬 LiveMétéo')}</h1>
      </TitleInNav>
      <div className="live-page picked live-detail">
        <StationCard
          station={current}
          basis={config.basis}
          mfKey={config.mfKey}
          now={now}
          loading={loading}
          onRefresh={() => {
            buzz();
            setLoading(true);
            void liveStations(
              { lat: current.lat, lon: current.lon },
              5,
              config.mfKey,
            )
              .then((found) => {
                const same = found.find(
                  (one) => stationKey(one) === stationKey(current),
                );
                if (same) setCurrent(same);
              })
              .finally(() => setLoading(false));
          }}
        />
      </div>
    </>
  );
}

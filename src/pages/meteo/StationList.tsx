import { Button } from '../../components/shared/Button.tsx';
import type { LiveStation } from '../../features/onwater/index.ts';
import { stationKey, windValue } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';

import { ageText, compassPoint, windColors } from './liveText.ts';

/** Props of {@link StationList}. */
interface StationListProps {
  stations: readonly LiveStation[];
  /** Wind the colours follow, `'gust'` or `'avg'`. */
  basis: string;
  /** Epoch milliseconds, for the age of the measurements. */
  now: number;
  /** A station is touched. */
  onPick: (key: string) => void;
}

/**
 * The stations of the map as a list, the closest first.
 * @param props - Stations and action.
 * @returns The list.
 */
export function StationList({
  stations,
  basis,
  now,
  onPick,
}: StationListProps) {
  const tr = useTr();
  if (stations.length === 0) return null;
  return (
    <div className="live-list">
      {stations.map((station) => {
        const key = stationKey(station);
        const { color, ink } = windColors(windValue(station, basis));
        const gust =
          station.gust == null ? '' : ` · rafales ${Math.round(station.gust)}`;
        const from =
          station.dir == null ? '' : ` · du ${compassPoint(station.dir)}`;
        return (
          <Button
            key={key}
            className="btn live-row"
            onClick={() => onPick(key)}
          >
            <span
              className="live-badge"
              style={{ background: color, color: ink }}
            >
              {Math.round(station.avg)}
            </span>
            <span className="live-row-txt">
              <b>{station.name}</b>
              <small>
                {tr(
                  `${Math.round(station.avg)} nd${gust}${from} · ${station.net} · ${Math.round(station.km ?? 0)} km · ${ageText(station.t, now)}`,
                )}
              </small>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

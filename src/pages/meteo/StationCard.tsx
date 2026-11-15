import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { publishAlert } from '../../features/onwater/alertPublish.ts';
import type { LiveStation } from '../../features/onwater/index.ts';
import { metarRows, windValue } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtTime } from '../../lib/format.ts';
import { bft, windTxt } from '../../lib/wind.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';

import { SeaBlock } from './SeaBlock.tsx';
import { WindTrendChart } from './WindTrendChart.tsx';
import { ageText, compassPoint, forceText, windColors } from './liveText.ts';

/** Props of {@link StationCard}. */
interface StationCardProps {
  station: LiveStation;
  /** Wind the colour follows, `'gust'` or `'avg'`. */
  basis: string;
  /** Météo-France key, for the past of its stations. */
  mfKey: string;
  /** Epoch milliseconds, for the age of the measurement. */
  now: number;
  /** The stations are being read again. */
  loading: boolean;
  /** Text of the back button. */
  backLabel: string;
  /** Back to the map. */
  onBack: () => void;
  /** Back to the map, centred on this station alone for a moment. */
  onLocate: () => void;
  /** Read the stations again now. */
  onRefresh: () => void;
}

/**
 * The live measurements of one station.
 * @param props - The station and the actions.
 * @returns The card.
 */
export function StationCard({
  station,
  basis,
  mfKey,
  now,
  loading,
  backLabel,
  onBack,
  onLocate,
  onRefresh,
}: StationCardProps) {
  const tr = useTr();
  const { color, ink } = windColors(windValue(station, basis));
  const row = BEAUFORT_TBL[Math.min(12, bft(station.avg))];
  const rows: Array<[string, string]> = [
    ['Vent moyen', windTxt(station.avg)],
    ['Rafales', station.gust == null ? '—' : windTxt(station.gust)],
    [
      'Direction',
      station.dir == null
        ? '—'
        : `du ${compassPoint(station.dir)} (${Math.round(station.dir)}°)`,
    ],
  ];
  if (station.air != null) {
    rows.push([
      'Température de l’air',
      `${station.air.toFixed(1).replace('.', ',')} °C`,
    ]);
  }
  if (station.baro != null) {
    rows.push([
      'Pression (niveau de la mer)',
      `${Math.round(station.baro)} hPa`,
    ]);
  }
  rows.push(
    // An airport: what its METAR says beyond the wind.
    ...metarRows(station.metar),
    ['Mesuré', `${fmtTime(new Date(station.t))} · ${ageText(station.t, now)}`],
    [
      'Réseau',
      station.amateur ? `${station.net} · station amateur` : station.net,
    ],
    ['Distance', station.km == null ? '—' : `${Math.round(station.km)} km`],
  );
  return (
    <section className="live-card" aria-live="polite">
      <ButtonRow className="row live-card-back">
        <Button className="btn primary" onClick={onBack}>
          {tr(backLabel)}
        </Button>
      </ButtonRow>
      <div className="live-card-a">
        <Button
          className="live-head"
          style={{ background: color, color: ink }}
          onClick={onLocate}
          aria-label={tr(`${station.name} : voir sur la carte`)}
        >
          <div className="live-name">{station.name}</div>
          <div className="live-big">
            {station.dir == null ? null : (
              <i style={{ transform: `rotate(${Math.round(station.dir)}deg)` }}>
                ↓
              </i>
            )}
            <b>{Math.round(station.avg)}</b> {tr('nd')}
            {station.gust == null ? null : (
              <small> {tr(`rafales ${Math.round(station.gust)} nd`)}</small>
            )}
          </div>
          <div className="live-force">
            {tr(`${forceText(station.avg)} · ${row?.[2] ?? ''}`)}
          </div>
          <div className="live-locate">
            {tr('📍 Toucher : voir sur la carte')}
          </div>
        </Button>
        <WindTrendChart station={station} mfKey={mfKey} />
        <ShareButton
          onShare={(format) => {
            void publishAlert(
              {
                reading: station,
                wind: `${Math.round(station.avg)} nd${station.gust == null ? '' : `, rafales ${Math.round(station.gust)} nd`}`,
                forecast: false,
                boat: null,
                basis,
                station: true,
              },
              format,
            );
          }}
        />
      </div>
      <div className="live-card-b">
        <table className="live-tbl">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th>{tr(label)}</th>
                <td>{tr(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SeaBlock lat={station.lat} lon={station.lon} />
        <ButtonRow className="row">
          <Button className="btn" onClick={onRefresh} disabled={loading}>
            {tr(loading ? 'Actualisation…' : '↻ Actualiser maintenant')}
          </Button>
        </ButtonRow>
        <p className="keep-help">
          {tr('Mesures relues toutes les 2 min tant que cet écran est ouvert.')}
        </p>
      </div>
    </section>
  );
}

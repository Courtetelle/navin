import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import type { LiveStation } from '../../features/onwater/index.ts';
import { windValue } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtTime } from '../../lib/format.ts';
import { bft, windTxt } from '../../lib/wind.ts';
import { BEAUFORT_TBL } from '../../model/lists.ts';

import { WindTrendChart } from './WindTrendChart.tsx';
import { ageText, compassPoint, forceText, windColors } from './liveText.ts';

/** Props of {@link StationCard}. */
export interface StationCardProps {
  station: LiveStation;
  /** Wind the colour follows, `'gust'` or `'avg'`. */
  basis: string;
  /** Météo-France key, for the past of its stations. */
  mfKey: string;
  /** Epoch milliseconds, for the age of the measurement. */
  now: number;
  /** The stations are being read again. */
  loading: boolean;
  /** Back to the map. */
  onBack: () => void;
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
  onBack,
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
    ['Mesuré', `${fmtTime(new Date(station.t))} · ${ageText(station.t, now)}`],
    ['Réseau', station.net],
    ['Distance', station.km == null ? '—' : `${Math.round(station.km)} km`],
  );
  return (
    <section className="live-card" aria-live="polite">
      <ButtonRow className="row">
        <Button className="btn primary" onClick={onBack}>
          {tr('◀ Revenir à la carte des stations')}
        </Button>
      </ButtonRow>
      <div className="live-head" style={{ background: color, color: ink }}>
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
      </div>
      <WindTrendChart station={station} mfKey={mfKey} />
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
      <ButtonRow className="row">
        <Button className="btn" onClick={onRefresh} disabled={loading}>
          {tr(loading ? 'Actualisation…' : '↻ Actualiser maintenant')}
        </Button>
      </ButtonRow>
      <p className="keep-help">
        {tr('Mesures relues toutes les 2 min tant que cet écran est ouvert.')}
      </p>
    </section>
  );
}

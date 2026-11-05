import { HelpText } from '../../components/shared/HelpText.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { utcText } from '../../components/shared/timeText.ts';
import { fr, pad } from '../../lib/format.ts';
import { bft, kmh, knOk, windParts } from '../../lib/wind.ts';
import { state } from '../../state/index.ts';

import type { ForecastRow, WeatherNow } from './weatherLogic.ts';
import {
  capeRisk,
  directionText,
  forecastRows,
  forecastTime,
} from './weatherLogic.ts';

/** Props of {@link WeatherNowBlock}. */
export interface WeatherNowBlockProps {
  /** Weather stored in today's sheet, if any. */
  weather: WeatherNow | null | undefined;
  /**
   * Keep the explanations visible (outside `#view`).
   * @default false
   */
  keep?: boolean;
}

/**
 * Measure of the closest station, forecast table and update time (legacy
 * `wxNowHtml`); always followed by a row of buttons.
 * @param props - Weather and context.
 * @returns The block.
 */
export function WeatherNowBlock({ weather, keep }: WeatherNowBlockProps) {
  if (!weather) {
    return (
      <HelpText keep={keep} nextIsRow>
        Pas encore de météo aujourd’hui. Touchez « Mettre à jour » quand il y a
        du réseau.
      </HelpText>
    );
  }
  const measure = weather.meas;
  const forecast = weather.fc;
  return (
    <>
      {measure ? (
        <>
          <div className="wx-now">
            <WindValue knots={measure.tws} /> du {directionText(measure.twd)} ·
            rafales <WindValue knots={measure.gust} />
            {measure.air == null ? '' : ` · ${fr(measure.air)} °C`}
            {measure.baro == null ? '' : ` · ${Math.round(measure.baro)} hPa`}
          </div>
          <HelpText className="wx-src" keep={keep}>
            {measure.src}
          </HelpText>
        </>
      ) : (
        <HelpText keep={keep}>
          Aucune station MeteoSwiss proche ne répond.
        </HelpText>
      )}
      {forecast ? (
        <>
          <table className="wx-fc">
            <tbody>
              {forecastRows(weather).map((row) => (
                <ForecastLine key={row.t} row={row} />
              ))}
            </tbody>
          </table>
          <HelpText className="wx-src" keep={keep}>
            {forecast.src}
          </HelpText>
        </>
      ) : null}
      <UpdatedAt at={weather.at} keep={keep} />
    </>
  );
}

function UpdatedAt({ at, keep }: { at: number; keep: boolean | undefined }) {
  const date = new Date(at);
  const shown = state.view.tzLocalOnly.value
    ? ''
    : `${utcText(date, false)}UTC`;
  const tail = '. Les feux d’avis de tempête restent à vérifier sur place.';
  return (
    <HelpText keep={keep} nextIsRow text={`Mis à jour à ${shown}${tail}`}>
      Mis à jour à <TzTime date={date} />
      {tail}
    </HelpText>
  );
}

function ForecastLine({ row }: { row: ForecastRow }) {
  return (
    <tr>
      <th>{forecastTime(row)}</th>
      <td>
        <WindValue knots={row.tws} />
        {knOk(row.gust) ? (
          <>
            <br />
            <small className="kmh">
              raf. {Math.round(row.gust as number)} nd · {bft(row.gust)} Bf ·{' '}
              {kmh(row.gust)} km/h
            </small>
          </>
        ) : null}
      </td>
      <td>{row.twd == null ? '' : `${pad(Math.round(row.twd), 3)}°`}</td>
      <td>{row.rain ? `${fr(row.rain)} mm` : ''}</td>
      <td>{capeRisk(row.cape)}</td>
    </tr>
  );
}

function WindValue({ knots }: { knots: unknown }) {
  const parts = windParts(knots);
  if (!parts) return '…';
  return (
    <>
      <b>
        {parts.knots} nd · {parts.beaufort} Bf
      </b>{' '}
      <small className="kmh">{parts.kmh} km/h</small>
    </>
  );
}

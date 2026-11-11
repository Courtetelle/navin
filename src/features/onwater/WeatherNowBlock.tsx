import { TzTime } from '../../components/shared/TzTime.tsx';
import { utcText } from '../../components/shared/timeText.ts';
import { fr, pad } from '../../lib/format.ts';
import { bft, kmh, knOk, windParts } from '../../lib/wind.ts';
import { state } from '../../state/index.ts';

import { BoxHelp } from './BoxHelp.tsx';
import { useBoxTr } from './useBoxTr.ts';
import type {
  ForecastRow,
  WeatherMeasure,
  WeatherNow,
} from './weatherLogic.ts';
import {
  capeRisk,
  directionText,
  forecastRows,
  forecastTime,
} from './weatherLogic.ts';

/** Props of {@link WeatherNowBlock}. */
interface WeatherNowBlockProps {
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
export function WeatherNowBlock({
  weather,
  keep = false,
}: WeatherNowBlockProps) {
  const tr = useBoxTr(keep);
  if (!weather) {
    return (
      <BoxHelp keep={keep} nextIsRow>
        Pas encore de météo aujourd’hui. Touchez « Mettre à jour » quand il y a
        du réseau.
      </BoxHelp>
    );
  }
  const measure = weather.meas;
  const forecast = weather.fc;
  return (
    <>
      {measure ? (
        <>
          <div className="wx-now">
            <WindValue knots={measure.tws} keep={keep} />
            {tr(` du ${directionText(measure.twd)} · rafales `)}
            <WindValue knots={measure.gust} keep={keep} />
            {tr(measureTail(measure))}
          </div>
          <BoxHelp className="wx-src" keep={keep}>
            {measure.src}
          </BoxHelp>
        </>
      ) : (
        <BoxHelp keep={keep}>
          Aucune station MeteoSwiss proche ne répond.
        </BoxHelp>
      )}
      {forecast ? (
        <>
          <table className="wx-fc">
            <tbody>
              {forecastRows(weather).map((row) => (
                <ForecastLine key={row.t} row={row} keep={keep} />
              ))}
            </tbody>
          </table>
          <BoxHelp className="wx-src" keep={keep}>
            {forecast.src}
          </BoxHelp>
        </>
      ) : null}
      <UpdatedAt at={weather.at} keep={keep} />
    </>
  );
}

function UpdatedAt({ at, keep }: { at: number; keep: boolean }) {
  const tr = useBoxTr(keep);
  const date = new Date(at);
  const shown = state.view.tzLocalOnly.value
    ? ''
    : `${utcText(date, false)}UTC`;
  const tail = '. Les feux d’avis de tempête restent à vérifier sur place.';
  return (
    <BoxHelp keep={keep} nextIsRow text={`Mis à jour à ${shown}${tail}`}>
      {tr('Mis à jour à ', { help: true })}
      <TzTime date={date} />
      {tr(tail, { help: true })}
    </BoxHelp>
  );
}

function measureTail(measure: WeatherMeasure): string {
  const air = measure.air == null ? '' : ` · ${fr(measure.air)} °C`;
  const pressure =
    measure.baro == null ? '' : ` · ${Math.round(measure.baro)} hPa`;
  return `${air}${pressure}`;
}

function ForecastLine({ row, keep }: { row: ForecastRow; keep: boolean }) {
  const tr = useBoxTr(keep);
  return (
    <tr>
      <th>{tr(forecastTime(row))}</th>
      <td>
        <WindValue knots={row.tws} keep={keep} />
        {knOk(row.gust) ? (
          <>
            <br />
            <small className="kmh">
              {tr(
                `raf. ${Math.round(row.gust as number)} nd · ${bft(row.gust)} Bf · ${kmh(row.gust)} km/h`,
              )}
            </small>
          </>
        ) : null}
      </td>
      <td>{row.twd == null ? '' : tr(`${pad(Math.round(row.twd), 3)}°`)}</td>
      <td>{row.rain ? tr(`${fr(row.rain)} mm`) : ''}</td>
      <td>{tr(capeRisk(row.cape))}</td>
    </tr>
  );
}

function WindValue({ knots, keep }: { knots: unknown; keep: boolean }) {
  const tr = useBoxTr(keep);
  const parts = windParts(knots);
  if (!parts) return '…';
  return (
    <>
      <b>{tr(`${parts.knots} nd · ${parts.beaufort} Bf`)}</b>{' '}
      <small className="kmh">{tr(`${parts.kmh} km/h`)}</small>
    </>
  );
}

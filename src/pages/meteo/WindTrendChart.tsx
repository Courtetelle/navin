import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import type { LiveStation, WindPoint } from '../../features/onwater/index.ts';
import {
  HISTORY_SPANS,
  stationHistory,
  windTrend,
} from '../../features/onwater/index.ts';
import { chartPaths, trendText } from '../../features/onwater/trendText.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

/** Points needed for a curve. */
const ENOUGH = 3;
const SHORTEST = HISTORY_SPANS[0];
const LONGEST = HISTORY_SPANS.at(-1) ?? SHORTEST;

/** Props of {@link WindTrendChart}. */
interface WindTrendChartProps {
  station: LiveStation;
  mfKey: string;
}

/**
 * The wind of the last hours, drawn simply: the mean wind as a line, the
 * gusts as a light band above it, and one sentence for where it goes. It
 * opens on the shortest span holding enough measurements.
 * @param props - The station.
 * @returns The trend, or a short line while it is read.
 */
export function WindTrendChart({ station, mfKey }: WindTrendChartProps) {
  const tr = useTr();
  // The span touched; until then the shortest one with a curve.
  const [chosen, setChosen] = useState<number | null>(null);
  const ask = `${station.net}:${station.id}:${station.t}`;
  const [read, setRead] = useState<{
    ask: string;
    points: WindPoint[];
    now: number;
  }>({ ask: '', points: [], now: 0 });
  const { id, net } = station;
  useEffect(() => {
    let closed = false;
    // The longest span read once, the shorter ones cut from it.
    const now = Date.now();
    void stationHistory({ id, net }, mfKey, now, LONGEST * 3_600_000).then(
      (points) => {
        if (!closed) setRead({ ask, points, now });
      },
    );
    return () => {
      closed = true;
    };
  }, [ask, id, net, mfKey]);
  const within = (span: number) =>
    read.points.filter((point) => point.t > read.now - span * 3_600_000);
  const hours =
    chosen ??
    HISTORY_SPANS.find((span) => within(span).length >= ENOUGH) ??
    SHORTEST;
  const spans = (
    <div className="live-spans" role="group" aria-label={tr('Durée')}>
      {HISTORY_SPANS.map((value) => (
        <Button
          key={value}
          className={value === hours ? 'btn on' : 'btn'}
          onClick={() => {
            buzz();
            setChosen(value);
          }}
        >
          {tr(`${value} h`)}
        </Button>
      ))}
    </div>
  );
  if (read.ask !== ask) {
    return (
      <>
        {spans}
        <p className="live-trend-txt">{tr('Lecture de l’historique…')}</p>
      </>
    );
  }
  const points = within(hours);
  if (points.length < ENOUGH) {
    const longer = HISTORY_SPANS.filter(
      (span) => span > hours && within(span).length >= ENOUGH,
    );
    return (
      <>
        {spans}
        <p className="live-trend-txt">
          {tr(
            longer.length > 0
              ? `Trop peu de mesures sur ${hours} h pour une courbe (${points.length}) : voir ${longer.map((span) => `${span} h`).join(' ou ')}. Une station Météo-France n’est enregistrée que quand NavIn est ouvert sur un appareil.`
              : 'Pas encore d’historique pour cette station : NavIn enregistre toutes les 10 min les stations à moins de 120 NM de la zone ou de la position GPS, la courbe viendra.',
          )}
        </p>
      </>
    );
  }
  const paths = chartPaths(points);
  return (
    <figure className="live-trend">
      {spans}
      <figcaption className="live-trend-txt">
        {tr(trendText(windTrend(points)))}
      </figcaption>
      <div className="live-trend-box">
        <span className="live-trend-max">
          {tr(`${Math.round(paths.top)} nd`)}
        </span>
        <svg
          viewBox={`0 0 ${paths.width} ${paths.height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={tr('Vent des dernières heures')}
        >
          {paths.gust ? (
            <path className="live-trend-gust" d={paths.gust} />
          ) : null}
          <path className="live-trend-avg" d={paths.avg} />
        </svg>
      </div>
      <div className="live-trend-axis">
        <span>{tr(paths.since)}</span>
        <span>{tr('maintenant')}</span>
      </div>
      <div className="live-trend-key">
        <span className="k-avg" /> {tr('vent moyen')}
        {paths.gust ? (
          <>
            <span className="k-gust" /> {tr('rafales')}
          </>
        ) : null}
      </div>
    </figure>
  );
}

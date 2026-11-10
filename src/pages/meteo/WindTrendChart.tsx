import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import type { LiveStation, WindPoint } from '../../features/onwater/index.ts';
import {
  HISTORY_SPANS,
  stationHistory,
  windTrend,
} from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { chartPaths, trendText } from './trendText.ts';

/** Props of {@link WindTrendChart}. */
export interface WindTrendChartProps {
  station: LiveStation;
  mfKey: string;
}

/**
 * The wind of the last hours, drawn simply: the mean wind as a line, the
 * gusts as a light band above it, and one sentence for where it goes.
 * @param props - The station.
 * @returns The trend, or a short line while it is read.
 */
export function WindTrendChart({ station, mfKey }: WindTrendChartProps) {
  const tr = useTr();
  const [hours, setHours] = useState<number>(HISTORY_SPANS[0]);
  const ask = `${station.net}:${station.id}:${station.t}:${hours}`;
  const [read, setRead] = useState<{ ask: string; points: WindPoint[] }>({
    ask: '',
    points: [],
  });
  const { id, net } = station;
  useEffect(() => {
    let closed = false;
    void stationHistory({ id, net }, mfKey, Date.now(), hours * 3_600_000).then(
      (points) => {
        if (!closed) setRead({ ask, points });
      },
    );
    return () => {
      closed = true;
    };
  }, [ask, id, net, mfKey, hours]);
  const spans = (
    <div className="live-spans" role="group" aria-label={tr('Durée')}>
      {HISTORY_SPANS.map((value) => (
        <Button
          key={value}
          className={value === hours ? 'btn on' : 'btn'}
          onClick={() => {
            buzz();
            setHours(value);
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
  const { points } = read;
  if (points.length < 3) {
    return (
      <>
        {spans}
        <p className="live-trend-txt">
          {tr(
            'Pas encore d’historique pour cette station : NavIn enregistre toutes les 10 min les stations autour de votre position GPS, la courbe viendra.',
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

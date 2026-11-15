import { useEffect, useState } from 'react';

import { wxNext } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtTime, fr } from '../../lib/format.ts';
import { mapPlace } from '../meteo/boatPlace.ts';
import { compassPoint, scaleColors } from '../meteo/liveText.ts';

import type { PrepMoment } from './prepMoments.ts';
import { prepMoments } from './prepMoments.ts';

/** The forecast read: its source and its moments. */
interface Read {
  src: string;
  moments: PrepMoment[];
}

/** Hours read: up to tomorrow morning. */
const HOURS = 48;

/**
 * The forecast before leaving, where the NavIn map shows (else at the
 * boat): now, in 3 h, this evening (while more than 3 h away) and tomorrow
 * morning, one card each.
 * @returns The cards.
 */
export function PrepForecast() {
  const tr = useTr();
  const [forecast, setForecast] = useState<Read | null | 'loading'>('loading');
  useEffect(() => {
    let closed = false;
    const { lat, lon } = mapPlace();
    void wxNext(lat, lon, HOURS)
      .catch(() => null)
      .then((found) => {
        if (closed) return;
        setForecast(
          found
            ? { src: found.src, moments: prepMoments(found.rows, Date.now()) }
            : null,
        );
      });
    return () => {
      closed = true;
    };
  }, []);
  if (forecast === 'loading') {
    return <p className="keep-help">{tr('Lecture de la prévision…')}</p>;
  }
  if (!forecast || forecast.moments.length === 0) {
    return (
      <p className="keep-help">
        {tr('Prévision indisponible : pas de réseau pour le moment.')}
      </p>
    );
  }
  return (
    <div className="prep-fc">
      <div className="prep-fc-cards">
        {forecast.moments.map(({ key, label, row }) => {
          const tws = row.tws ?? 0;
          const { color, ink } = scaleColors(tws);
          return (
            <div
              key={key}
              className="prep-fc-card"
              data-moment={key}
              style={{ background: color, color: ink }}
            >
              <span className="prep-fc-when">
                {tr(label)} · {fmtTime(new Date(row.t))}
              </span>
              <span className="prep-fc-wind">
                {row.twd == null ? null : (
                  <i style={{ transform: `rotate(${Math.round(row.twd)}deg)` }}>
                    ↓
                  </i>
                )}
                <b>{Math.round(tws)}</b>
                <span>{tr('nd')}</span>
                {row.gust == null ? null : (
                  <small>
                    {tr('rafales')} {Math.round(row.gust)}
                  </small>
                )}
              </span>
              <span className="prep-fc-more">
                {row.twd == null ? '' : `${compassPoint(row.twd)} · `}
                {row.air == null ? '' : `${Math.round(row.air)} °C`}
                {row.rain ? ` · ${fr(row.rain)} mm` : ''}
              </span>
            </div>
          );
        })}
      </div>
      <p className="keep-help">
        {tr(
          `${forecast.src} là où montre la carte de NavIn (sinon au bateau) : PRÉVISION, pas une mesure · couleur : échelle de Beaufort · la flèche montre où va le vent.`,
        )}
      </p>
    </div>
  );
}

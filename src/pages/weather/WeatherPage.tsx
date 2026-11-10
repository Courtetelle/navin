import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { LinkButton } from '../../components/shared/EditableLinks.tsx';
import { windConfig } from '../../features/onwater/index.ts';
import type { Forecast } from '../../features/tracking/index.ts';
import { wxNext } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { dayKey, fmtTime } from '../../lib/format.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { isLake, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import { boatPlace, liveBack } from '../meteo/boatPlace.ts';
import { compassPoint, windColors } from '../meteo/liveText.ts';

import { forecastPeak, weatherChecks } from './weatherChecks.ts';

function openLive() {
  buzz();
  liveBack.value = { view: 'weather', label: '◀ Météo' };
  go('meteo');
}

/** Hours of forecast shown. */
const HOURS = 12;
const CHECKS_KEY = 'ldb.wx.checks';

/**
 * The Météo screen of the NavIn menu: Live météo, the forecast of the next
 * hours drawn simply, and the weather checks before leaving, ticked for the
 * day. During a track, Live météo comes first.
 * @returns The screen content.
 */
export function WeatherPage() {
  useSignals();
  const tr = useTr();
  const lake = isLake();
  const tracking = state.view.tracking.value;
  const config = windConfig();
  const [forecast, setForecast] = useState<Forecast | null | 'loading'>(
    'loading',
  );
  useEffect(() => {
    let closed = false;
    const { lat, lon } = boatPlace();
    void wxNext(lat, lon, HOURS)
      .catch(() => null)
      .then((found) => {
        if (!closed) setForecast(found);
      });
    return () => {
      closed = true;
    };
  }, []);
  const today = dayKey(new Date());
  const [ticked, setTicked] = useState<string[]>(() => {
    const kept = store.get<{ day: string; ids: string[] } | null>(
      CHECKS_KEY,
      null,
    );
    return kept?.day === today ? kept.ids : [];
  });
  const toggle = (id: string) => {
    buzz();
    const next = ticked.includes(id)
      ? ticked.filter((one) => one !== id)
      : [...ticked, id];
    setTicked(next);
    store.set(CHECKS_KEY, { day: today, ids: next });
  };
  const checks = weatherChecks(lake);
  const done = checks.filter((check) => ticked.includes(check.id)).length;
  const live = (
    <ButtonRow className="row">
      <Button className="btn primary wx-live" onClick={openLive}>
        {tr('🌬 Live météo : le vent mesuré maintenant')}
      </Button>
    </ButtonRow>
  );
  return (
    <>
      <PageBack
        label="◀ NavIn"
        data-go="tracker"
        onClick={() => {
          buzz();
          go('tracker');
        }}
      >
        {tr('◀ NavIn')}
      </PageBack>
      <h1>{tr('🌤 Météo')}</h1>
      {live}
      <section className="wx-fc">
        <h2>{tr(`Prévision des ${HOURS} prochaines heures`)}</h2>
        <ForecastStrip forecast={forecast} basis={config.basis} />
      </section>
      <section className="wx-checks">
        <h2>
          {tr(
            tracking
              ? `Procédure météo · ${done}/${checks.length}`
              : `Avant le départ · ${done}/${checks.length}`,
          )}
        </h2>
        <ul className="wx-list">
          {checks.map((check) => {
            const on = ticked.includes(check.id);
            return (
              <li key={check.id}>
                <Button
                  className={on ? 'btn wx-check on' : 'btn wx-check'}
                  aria-pressed={on}
                  onClick={() => toggle(check.id)}
                >
                  <span className="wx-box">{on ? '✔' : ''}</span>
                  <span>{tr(check.text)}</span>
                </Button>
              </li>
            );
          })}
        </ul>
        {done === checks.length ? (
          <p className="wx-done">{tr('✅ Météo vérifiée pour aujourd’hui')}</p>
        ) : null}
        <p className="keep-help">
          {tr('Les coches valent pour la journée et repartent à zéro demain.')}
        </p>
      </section>
      <section className="wx-links">
        <h2>{tr('Sources officielles')}</h2>
        <ButtonRow className="row c2">
          {lake ? (
            <LinkButton
              className="btn"
              href="https://www.meteosuisse.admin.ch/meteo/dangers.html"
              target="_blank"
              rel="noopener"
            >
              {tr('⚠️ Alertes MeteoSwiss')}
            </LinkButton>
          ) : (
            <LinkButton
              className="btn"
              href="https://meteofrance.com/meteo-marine"
              target="_blank"
              rel="noopener"
            >
              {tr('⚓ Météo marine Météo-France')}
            </LinkButton>
          )}
          <Button
            className="btn"
            onClick={() => {
              buzz();
              go(lake ? 'beaufort' : 'douglas');
            }}
          >
            {tr(lake ? '💨 Échelle de Beaufort' : '🌊 Échelle de Douglas')}
          </Button>
        </ButtonRow>
      </section>
    </>
  );
}

function ForecastStrip({
  forecast,
  basis,
}: {
  forecast: Forecast | null | 'loading';
  basis: string;
}) {
  const tr = useTr();
  if (forecast === 'loading') {
    return <p className="keep-help">{tr('Lecture de la prévision…')}</p>;
  }
  if (!forecast || forecast.rows.length === 0) {
    return (
      <p className="keep-help">
        {tr('Prévision indisponible : pas de réseau pour le moment.')}
      </p>
    );
  }
  const peak = forecastPeak(forecast.rows);
  return (
    <>
      {peak ? (
        <p className="wx-peak">
          {tr(
            `Le plus fort : ${Math.round(peak.tws)} nd${peak.gust == null ? '' : `, rafales ${Math.round(peak.gust)} nd`} vers ${fmtTime(new Date(peak.t))}`,
          )}
        </p>
      ) : null}
      <div className="wx-strip">
        {forecast.rows.map((row) => {
          const tws = row.tws ?? 0;
          const gust = row.gust ?? null;
          const { color, ink } = windColors(
            basis === 'gust' ? (gust ?? tws) : tws,
          );
          return (
            <div
              key={row.t}
              className="wx-hour"
              style={{ background: color, color: ink }}
            >
              <span className="wx-h">{fmtTime(new Date(row.t))}</span>
              {row.twd == null ? null : (
                <i
                  style={{ transform: `rotate(${Math.round(row.twd)}deg)` }}
                  title={compassPoint(row.twd)}
                >
                  ↓
                </i>
              )}
              <b>{Math.round(tws)}</b>
              {gust == null ? null : <small>{Math.round(gust)}</small>}
            </div>
          );
        })}
      </div>
      <p className="keep-help">
        {tr(
          `${forecast.src} à la position du bateau : PRÉVISION, pas une mesure · en gras le vent moyen, en petit les rafales (nd) · la flèche montre où va le vent.`,
        )}
      </p>
    </>
  );
}

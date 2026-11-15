import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { WindAlert } from '../../features/onwater/index.ts';
import type { Forecast } from '../../features/tracking/index.ts';
import { wxNext } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import type { WeatherCheck } from '../../model/weatherChecks.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import {
  isLake,
  navZone,
  newWxCheck,
  setWxChecks,
  state,
  toast,
  toggleWxCheck,
  wxChecks,
  wxTicked,
} from '../../state/index.ts';
import { boatPlace } from '../meteo/boatPlace.ts';
import {
  BEAUFORT_COLORS,
  compassPoint,
  scaleColors,
} from '../meteo/liveText.ts';
import { showLiveAround } from '../tracker/liveOnMap.ts';

import { PrepForecast } from './PrepForecast.tsx';

function openLive() {
  buzz();
  go('meteo');
}

function toggle(id: string): void {
  buzz();
  toggleWxCheck(id);
}

function openForecast() {
  buzz();
  go('weather', FORECAST);
}

/** Argument of the screen for the forecast part. */
const FORECAST = 'forecast';

/** Hours of forecast shown. */
const HOURS = 12;

/**
 * The Météo screen of the NavIn menu: an entry to its two menus, the
 * forecast (with the checks before leaving) and LiveMétéo.
 * @param props - Page props: `forecast` opens the forecast menu.
 * @returns The screen content.
 */
export function WeatherPage({ arg }: PageProps) {
  if (arg === FORECAST) return <ForecastPage />;
  if (arg === ALERTS) return <AlertsPage />;
  return <WeatherMenu />;
}

/** Argument of the screen for the wind alerts and the keys. */
const ALERTS = 'alerts';

/** The keys stay in Réglages: the bubble says the Météo menu is left. */
function openKeys() {
  buzz();
  toast('Vous sortez du menu Météo : Réglages › Clés météo');
  go('settings', 'keys');
}

function openAlerts() {
  buzz();
  go('weather', ALERTS);
}

/**
 * The wind alerts of the Météo menu: their switch and thresholds, the keys
 * of Météo-France, AEMET and the Met Office, the relay, SOCIB.
 * @returns The screen content.
 */
function AlertsPage() {
  const tr = useTr();
  return (
    <>
      <PageBack
        label="◀ Météo"
        data-go="weather"
        onClick={() => {
          buzz();
          go('weather');
        }}
      >
        {tr('◀ Météo')}
      </PageBack>
      <TitleInNav>
        <h1>{tr('🔔 Alertes de vent')}</h1>
      </TitleInNav>
      <WindAlert noTest />
    </>
  );
}

/**
 * The menu of Météo, opened by its button straight from the map (no ◀):
 * the weather check-list, the forecast here, the LiveMétéo stations on the
 * map (also a long press on the button), and LiveMétéo itself.
 * @returns The menu.
 */
function WeatherMenu() {
  const tr = useTr();
  const [here, setHere] = useState(false);
  return (
    <>
      <TitleInNav>
        <h1>{tr('🌤 Météo')}</h1>
      </TitleInNav>
      <div className="wx-menu">
        <Button
          className="btn big wx-entry"
          data-wx="check"
          onClick={openForecast}
        >
          <span className="wx-entry-ico">✅</span>
          <span>
            <b>{tr('Check-list météo')}</b>
            <small>
              {tr(
                'les points à consulter avant le départ, les prochaines heures',
              )}
            </small>
          </span>
        </Button>
        <Button
          className="btn big wx-entry"
          data-wx="here"
          aria-expanded={here}
          onClick={() => {
            buzz();
            setHere(!here);
          }}
        >
          <span className="wx-entry-ico">📈</span>
          <span>
            <b>{tr('Prévision ici')}</b>
            <small>{tr('maintenant, dans 3 h, ce soir, demain matin')}</small>
          </span>
        </Button>
        {here ? <PrepForecast /> : null}
        <Button
          className="btn big wx-entry"
          data-wx="map"
          onClick={showLiveAround}
        >
          <span className="wx-entry-ico">🗺</span>
          <span>
            <b>{tr('Stations LiveMétéo sur la carte')}</b>
            <small>
              {tr(
                'le vent mesuré sur la carte affichée (appui long sur Météo)',
              )}
            </small>
          </span>
        </Button>
        <Button
          className="btn big wx-entry"
          data-wx="alerts"
          onClick={openAlerts}
        >
          <span className="wx-entry-ico">🔔</span>
          <span>
            <b>{tr('Alertes de vent')}</b>
            <small>
              {tr('oui ou non, rafales ou vent moyen, échelle des couleurs')}
            </small>
          </span>
        </Button>
        <Button className="btn big wx-entry" data-wx="live" onClick={openLive}>
          <span className="wx-entry-ico">🌬</span>
          <span>
            <b>{tr('LiveMétéo')}</b>
            <small>{tr('le vent mesuré maintenant par les stations')}</small>
          </span>
        </Button>
        <Button
          className="btn wx-keys-link"
          data-wx="keys"
          aria-label={tr('Sortir du menu Météo vers Réglages › Clés météo')}
          onClick={openKeys}
        >
          <svg className="exit-ico" viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M14 5H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path
              d="M13 16h15m-5-5 5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {tr('🔑 Clés météo')}
            <small>{tr('sortir du menu Météo, vers Réglages')}</small>
          </span>
        </Button>
      </div>
    </>
  );
}

/**
 * The forecast of the next hours drawn simply, and the weather checks before
 * leaving, ticked for the day.
 * @returns The screen content.
 */
function ForecastPage() {
  useSignals();
  const tr = useTr();
  const lake = isLake() || navZone() === 'lac';
  const tracking = state.view.tracking.value;
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
  const [editing, setEditing] = useState(false);
  const ticked = wxTicked();
  const checks = wxChecks(lake);
  const done = checks.filter((check) => ticked.includes(check.id)).length;
  return (
    <>
      <PageBack
        label="◀ Météo"
        data-go="weather"
        onClick={() => {
          buzz();
          go('weather');
        }}
      >
        {tr('◀ Météo')}
      </PageBack>
      <TitleInNav>
        <h1>{tr('📈 Prévisions')}</h1>
      </TitleInNav>
      <div className="wx-page">
        <section className="wx-fc">
          <h2>{tr(`Prévision des ${HOURS} prochaines heures`)}</h2>
          <ForecastStrip forecast={forecast} />
        </section>
        <section className="wx-checks">
          <div className="wx-checks-head">
            <h2>
              {tr(
                tracking
                  ? `Procédure météo · ${done}/${checks.length}`
                  : `Avant le départ · ${done}/${checks.length}`,
              )}
            </h2>
            <Button
              className={editing ? 'btn wx-edit on' : 'btn wx-edit'}
              id="wxEdit"
              aria-label={tr(editing ? 'Terminer' : 'Modifier la liste')}
              onClick={() => {
                buzz();
                setEditing(!editing);
              }}
            >
              {editing ? '✔' : '✎'}
            </Button>
          </div>
          {editing ? <WxChecksEditor lake={lake} /> : null}
          <ul className="wx-list" hidden={editing}>
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
          {done === checks.length && checks.length > 0 ? (
            <p className="wx-done">
              {tr('✅ Météo vérifiée pour aujourd’hui')}
            </p>
          ) : null}
          <p className="keep-help">
            {tr(
              'Les coches valent pour la journée et repartent à zéro demain.',
            )}
          </p>
        </section>
        <section className="wx-links">
          <h2>{tr('Sources officielles')}</h2>
          {lake ? (
            <SiteLink
              id="wx-meteoswiss"
              label="⚠️ Alertes MeteoSwiss"
              url="https://www.meteosuisse.admin.ch/meteo/dangers.html"
            />
          ) : (
            <SiteLink
              id="wx-mf-marine"
              label="Bulletins Météo Spéciaux (BMS)"
              url="https://meteofrance.com/meteo-marine"
            />
          )}
          <ButtonRow className="row">
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
      </div>
    </>
  );
}

function ForecastStrip({
  forecast,
}: {
  forecast: Forecast | null | 'loading';
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
  return (
    <>
      <div className="wx-strip">
        {forecast.rows.map((row) => {
          const tws = row.tws ?? 0;
          const gust = row.gust ?? null;
          const { color, ink } = scaleColors(tws);
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
      <div className="wx-scale" aria-hidden="true">
        {BEAUFORT_COLORS.map(([from, color]) => (
          <span
            key={from}
            style={{ background: color, color: scaleColors(from).ink }}
          >
            {from}
          </span>
        ))}
      </div>
      <p className="keep-help">
        {tr(
          `${forecast.src} à la position du bateau : PRÉVISION, pas une mesure · couleur et chiffre en gras : vent moyen (échelle de Beaufort, nd) · en petit : rafales · la flèche montre où va le vent.`,
        )}
      </p>
    </>
  );
}

/**
 * The pencil of the weather checks: each check can be reworded or deleted,
 * new ones added, and the list put back as it came.
 * @param props - Lake or sea list.
 * @returns The editor.
 */
function WxChecksEditor({ lake }: { lake: boolean }) {
  useSignals();
  const tr = useTr();
  const checks = wxChecks(lake);
  const [text, setText] = useState('');
  const save = (next: WeatherCheck[]) => setWxChecks(lake, next);
  return (
    <div className="wx-editor">
      {checks.map((check, index) => (
        <div className="wx-edit-row" key={check.id}>
          <textarea
            className="text"
            rows={2}
            data-wxedit={check.id}
            defaultValue={check.text}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== check.text) {
                save(
                  checks.map((one) =>
                    one.id === check.id ? { ...one, text: value } : one,
                  ),
                );
              }
            }}
          />
          <Button
            className="btn"
            aria-label={tr('Monter')}
            disabled={index === 0}
            onClick={() => {
              buzz();
              const next = [...checks];
              const [moved] = next.splice(index, 1);
              if (moved) next.splice(index - 1, 0, moved);
              save(next);
            }}
          >
            ▲
          </Button>
          <Button
            className="btn danger"
            aria-label={tr('Supprimer')}
            onClick={() => {
              buzz();
              save(checks.filter((one) => one.id !== check.id));
            }}
          >
            ✕
          </Button>
        </div>
      ))}
      <div className="wx-edit-row">
        <input
          className="text"
          id="wxNew"
          placeholder={tr.placeholder('Nouveau point à vérifier…')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <Button
          className="btn primary"
          id="wxAdd"
          disabled={!text.trim()}
          onClick={() => {
            buzz();
            save([...checks, newWxCheck(text.trim())]);
            setText('');
          }}
        >
          {tr('Ajouter')}
        </Button>
      </div>
      <ButtonRow>
        <Button
          className="btn"
          id="wxReset"
          onClick={() => {
            buzz();
            setWxChecks(lake, null);
          }}
        >
          {tr('↺ Revenir à la liste d’origine')}
        </Button>
      </ButtonRow>
    </div>
  );
}

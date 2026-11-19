import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ExitIcon } from '../../components/shared/ExitIcon.tsx';
import { PageLink } from '../../components/shared/PageLink.tsx';
import { SettingsIcon } from '../../components/shared/SettingsIcon.tsx';
import { SiteLink } from '../../components/shared/SiteLink.tsx';
import { TitleInNav } from '../../components/shared/TitleInNav.tsx';
import { inSwissArea } from '../../features/map/index.ts';
import { lastBoatSeen } from '../../features/map/trackerState.ts';
import { bubbleBack } from '../../features/onwater/index.ts';
import type { Forecast } from '../../features/tracking/index.ts';
import { wxNext } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtTime } from '../../lib/format.ts';
import type { WeatherCheck } from '../../model/weatherChecks.ts';
import { exitOrigin } from '../../shell/exitOrigin.ts';
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

import { LakeWarnings } from './LakeWarnings.tsx';
import { LightningAlert } from './LightningAlert.tsx';
import { PrepForecast } from './PrepForecast.tsx';

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

/** Argument of the screen for the weather briefing (the checks before leaving). */
const BRIEFING = 'briefing';

function openBriefing() {
  buzz();
  go('weather', BRIEFING);
}

/** Hours of forecast shown. */
const HOURS = 12;

/**
 * The Météo screen of the NavIn menu: an entry to its two menus, the
 * forecast (with the checks before leaving) and LiveMétéo.
 * @param props - Page props: `forecast` opens the forecast menu.
 * @returns The screen content.
 */
export function WeatherPage({ arg }: PageProps) {
  if (arg === FORECAST) return <ForecastPage part="forecast" />;
  if (arg === BRIEFING) return <ForecastPage part="briefing" />;
  if (arg === LIGHTNING) return <LightningPage />;
  if (arg === LAKE_LIGHTS) return <LakeLightsPage />;
  return <WeatherMenu />;
}

/**
 * The settings of the weather (wind alerts, lake lights, keys) are in
 * Paramétrages: the bubble says Météo is left; « Revenir » at the bottom of
 * Paramétrages comes back.
 */
function openSettings() {
  buzz();
  toast('Vous sortez du menu Météo : Paramétrages');
  exitOrigin.value = { view: 'weather' };
  go('settings');
}

/**
 * Back to the alert bubble this screen was opened from, taken once.
 * @returns The way back, or null.
 */
function useBubbleBack(): (() => void) | null {
  const [back] = useState(() => bubbleBack.peek());
  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the way back is taken once, when the screen opens
    if (back) bubbleBack.value = null;
  }, [back]);
  return back;
}

/**
 * ◀ Météo, or ◀ Alerte back to the bubble the screen was opened from.
 * @param props - The way back.
 * @param props.back - Back to the bubble, or null.
 * @returns The button.
 */
function MeteoBack({ back }: { back: (() => void) | null }) {
  const tr = useTr();
  if (back) {
    return (
      <PageBack
        label="◀ Alerte"
        onClick={() => {
          buzz();
          back();
        }}
      >
        {tr('◀ Alerte')}
      </PageBack>
    );
  }
  return (
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
  );
}

/** Argument of the screen for the warning lights of the lakes. */
const LAKE_LIGHTS = 'lakelights';

function openLakeLights() {
  buzz();
  go('weather', LAKE_LIGHTS);
}

/**
 * The warnings of MeteoSwiss for the lakes.
 * @returns The screen content.
 */
function LakeLightsPage() {
  const tr = useTr();
  const back = useBubbleBack();
  return (
    <>
      <MeteoBack back={back} />
      <TitleInNav>
        <h1>{tr('🚨 Feux d’avis des lacs')}</h1>
      </TitleInNav>
      <LakeWarnings />
    </>
  );
}

/** Argument of the screen for the lightning alert. */
const LIGHTNING = 'lightning';

function openLightning() {
  buzz();
  go('weather', LIGHTNING);
}

/**
 * The lightning alert of the Météo menu.
 * @returns The screen content.
 */
function LightningPage() {
  const tr = useTr();
  const back = useBubbleBack();
  return (
    <>
      <MeteoBack back={back} />
      <TitleInNav>
        <h1>{tr('⚡ Alerte orage')}</h1>
      </TitleInNav>
      <LightningAlert />
    </>
  );
}

/**
 * The GPS now: the track's last point, else the boat last shown on the map.
 * @returns The position, or null.
 */
function gpsHere(): { lat: number; lon: number } | null {
  return state.view.lastFix.value ?? lastBoatSeen();
}

/**
 * The menu of Météo, opened by its button straight from the map (no ◀):
 * the weather check-list, the forecast here, the LiveMétéo stations on the
 * map (also a long press on the button), and LiveMétéo itself.
 * @returns The menu.
 */
function WeatherMenu() {
  useSignals();
  const tr = useTr();
  // The warning lights of the Swiss lakes.
  // NavIn forced to a sea (Atlantique, Méditerranée): never; forced to the
  // lakes: always; on the GPS: on a lake or in Switzerland.
  const forced = state.view.zoneSimV.value;
  const lakeLights =
    forced === 'mer'
      ? false
      : forced === 'lac' ||
        isLake() ||
        navZone() === 'lac' ||
        inSwissArea(gpsHere());
  return (
    <>
      <TitleInNav>
        <h1>{tr('🌤 Météorologie')}</h1>
      </TitleInNav>
      <div className="wx-menu">
        <Button
          className="btn big wx-entry"
          data-wx="forecast"
          onClick={openForecast}
        >
          <span className="wx-entry-ico">📈</span>
          <span>
            <b>{tr('Prévisions')}</b>
            <small>
              {tr(
                'ici maintenant, dans 3 h, ce soir, demain matin ; les 12 prochaines heures, sources officielles, échelles',
              )}
            </small>
          </span>
        </Button>
        <Button
          className="btn big wx-entry"
          data-wx="live"
          onClick={showLiveAround}
        >
          <span className="wx-entry-ico">🌬</span>
          <span>
            <b>{tr('LiveMétéo')}</b>
            <small>
              {tr(
                'le vent mesuré par les stations de la zone, sur la carte (rayon dans Paramétrages)',
              )}
            </small>
          </span>
        </Button>
        <Button
          className="btn big wx-entry"
          data-wx="lightning"
          onClick={openLightning}
        >
          <span className="wx-entry-ico">⚡</span>
          <span>
            <b>{tr('Alerte orage')}</b>
            <small>
              {tr('les éclairs vus par satellite dans le rayon choisi')}
            </small>
          </span>
        </Button>
        {lakeLights ? (
          <Button
            className="btn big wx-entry"
            data-wx="lakelights"
            onClick={openLakeLights}
          >
            <span className="wx-entry-ico">🚨</span>
            <span>
              <b>{tr('Feux d’avis des lacs')}</b>
              <small>
                {tr('les avis de vent fort et de tempête de MétéoSuisse')}
              </small>
            </span>
          </Button>
        ) : null}
        <Button
          className="btn big wx-entry"
          data-wx="check"
          onClick={openBriefing}
        >
          <span className="wx-entry-ico">✅</span>
          <span>
            <b>{tr('Briefing météo')}</b>
            <small>{tr('les points à vérifier avant le départ')}</small>
          </span>
        </Button>
        <Button
          className="btn big wx-entry wx-keys-link"
          data-wx="settings"
          data-settings-exit
          aria-label={tr('Paramétrages : sortir du menu Météo')}
          onClick={openSettings}
        >
          <ExitIcon />
          <span>
            <b className="wx-settings-title">
              <SettingsIcon className="wx-settings-ico" />
              {tr('Paramétrages')}
            </b>
            <small>
              {tr(
                'alertes vent, feux des lacs, clés météo : sortir du menu Météo, vers Paramétrages',
              )}
            </small>
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
function ForecastPage({ part }: { part: 'forecast' | 'briefing' }) {
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
        <h1>
          {tr(part === 'forecast' ? '📈 Prévisions' : '✅ Briefing météo')}
        </h1>
      </TitleInNav>
      <div className="wx-page wx-one">
        {part === 'forecast' ? <PrepForecast /> : null}
        {part === 'forecast' ? (
          <section className="wx-fc">
            <h2>{tr(`Prévision des ${HOURS} prochaines heures`)}</h2>
            <ForecastStrip forecast={forecast} />
          </section>
        ) : null}
        {part === 'briefing' ? (
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
        ) : null}
        {part === 'forecast' ? (
          <section className="wx-links">
            <h2>{tr('Sources officielles')}</h2>
            {lake ? (
              <SiteLink id="wx-meteoswiss" />
            ) : (
              <SiteLink id="wx-mf-marine" />
            )}
            <div className="page-links">
              <PageLink
                view="beaufort"
                icon="💨"
                label="Échelle de Beaufort"
                sub="la force du vent, de 0 à 12"
              />
              <PageLink
                view="douglas"
                icon="🌊"
                label="Échelle de Douglas"
                sub="l’état de la mer, de 0 à 9"
              />
            </div>
          </section>
        ) : null}
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

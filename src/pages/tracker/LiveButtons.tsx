import { useSignals } from '@preact/signals-react/runtime';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { Failure, Grid } from '../../features/onwater/mapWeather.ts';
import { FORECAST_HOURS } from '../../features/onwater/mapWeather.ts';
import { onLake } from '../../features/onwater/onLake.ts';
import { zonesButtonText, zonesText } from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { toast } from '../../state/index.ts';

import type { Place } from './liveButtons.ts';
import {
  LIVE_FADE_MS,
  LIVE_SOLID_MS,
  livePlace,
  placeBoxes,
} from './liveButtons.ts';
import {
  hideLiveOnMap,
  liveOnMap,
  liveOnMapAround,
  liveZonesShown,
  zonePickOpen,
} from './liveOnMap.ts';
import type { WeatherLayers } from './weatherLayers.ts';
import {
  forecastStep,
  rainRead,
  toggleLayer,
  weatherLayers,
  weatherModel,
  weatherRead,
  weatherShownAt,
} from './weatherLayers.ts';

function failText(value: Grid<unknown> | Failure | null): string | null {
  return value && 'error' in value ? value.error : null;
}

function hourText(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shown, fading, or gone: the buttons go after a while without a touch on
 * the screen, any touch brings them back.
 * @param on - LiveMétéo on the map.
 * @returns The state.
 */
function useFade(on: boolean): 'shown' | 'fading' | 'gone' {
  const [stage, setStage] = useState<'shown' | 'fading' | 'gone'>('shown');
  useEffect(() => {
    if (!on) return undefined;
    let fade: ReturnType<typeof setTimeout> | undefined;
    let gone: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      clearTimeout(fade);
      clearTimeout(gone);
      setStage('shown');
      fade = setTimeout(() => setStage('fading'), LIVE_SOLID_MS);
      gone = setTimeout(() => setStage('gone'), LIVE_SOLID_MS + LIVE_FADE_MS);
    };
    wake();
    document.addEventListener('pointerdown', wake, true);
    document.addEventListener('keydown', wake, true);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
      document.removeEventListener('pointerdown', wake, true);
      document.removeEventListener('keydown', wake, true);
    };
  }, [on]);
  return stage;
}

/**
 * LiveMétéo on the map of NavIn: at the right of Météo, buttons of its size
 * with rounded corners: the zone (a touch takes LiveMétéo away, a long press
 * the Météo-France zones), the wind forecast, the waves, the currents, the rain of the
 * radar, the badges of the stations and buoys, each coloured while shown,
 * then ◀ the hour ▶ of the forecast. Left alone they fade out; a touch on
 * the map or anywhere brings them back. A long press on a layer says its
 * source, and why it is missing when it is.
 * @returns The buttons, or nothing while LiveMétéo is off.
 */
export function LiveButtons() {
  useSignals();
  const tr = useTr();
  const on = liveOnMap.value > 0;
  const layers = weatherLayers.value;
  const step = forecastStep.value;
  const shownAt = weatherShownAt.value;
  const model = weatherModel.value;
  const drawn = weatherRead.value;
  const rain = rainRead.value;
  const lake = onLake();
  const stage = useFade(on);
  const forecast =
    layers.wind || layers.waves || layers.currents || layers.rain;
  const count = (lake ? 4 : 6) + (forecast ? 3 : 0);
  const [place, setPlace] = useState<Place | null>(null);
  const said = useRef(new Set<string>());

  useLayoutEffect(() => {
    if (!on) return undefined;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const lay = () => {
      const found = livePlace(count);
      setPlace(found);
      if (!found) wait = setTimeout(lay, 300);
    };
    lay();
    // Météo pressed a moment ago is pushed in: laid again once it is back.
    const again = setTimeout(lay, 600);
    const late = setTimeout(lay, 1500);
    globalThis.addEventListener('resize', lay);
    return () => {
      clearTimeout(wait);
      clearTimeout(again);
      clearTimeout(late);
      globalThis.removeEventListener('resize', lay);
    };
  }, [on, count]);

  // The badges of the stations hidden or shown on the map itself.
  useEffect(() => {
    if (!on) return undefined;
    const box = tracker.current?.map?.getContainer();
    box?.classList.toggle('live-st-off', !layers.stations);
    return () => box?.classList.remove('live-st-off');
  }, [on, layers.stations]);

  const failures: Partial<Record<keyof WeatherLayers, string>> = {};
  const windFail = failText(drawn.wind);
  const seaFail = lake ? null : failText(drawn.sea);
  if (windFail) failures.wind = windFail;
  if (seaFail) {
    failures.waves = seaFail;
    failures.currents = seaFail;
  }
  if (rain && 'error' in rain) failures.rain = rain.error;

  // A source that fails is said once, in words.
  useEffect(() => {
    for (const [name, text] of Object.entries(failures)) {
      const key = `${name}:${text}`;
      if (!layers[name as keyof WeatherLayers] || said.current.has(key)) {
        continue;
      }
      said.current.add(key);
      toast(`⚠ ${text}`);
    }
  });

  if (!on || !place) return null;
  const rainAt =
    rain && 'frames' in rain ? (rain.frames.at(-1)?.time ?? null) : null;
  const sources: Record<keyof WeatherLayers, string> = {
    wind: `Vent prévu : ${model || 'modèle local'}, nœuds, G = rafales.`,
    waves:
      'Vagues : Open-Meteo Marine, hauteur significative Hs en m et degré Douglas en couleur.',
    currents: 'Courants : Open-Meteo Marine, nœuds ; étale marquée à part.',
    rain:
      step === 0
        ? `Pluie : radar RainViewer${rainAt == null ? '' : ` de ${hourText(rainAt)}`}, du bleu clair (faible) au violet (forte).`
        : `Pluie prévue : ${model || 'modèle local'}, mm par heure, du bleu clair (faible) au violet (forte) ; le radar ne montre que l’heure actuelle.`,
    stations: 'Stations et bouées LiveMétéo : vent mesuré.',
  };
  const items: ReactNode[] = [
    <ZoneButton key="zone" />,
    <LayerButton
      key="wind"
      name="wind"
      label="Vent prévu"
      icon={<WindIcon />}
      fail={failures.wind}
      source={sources.wind}
    />,
  ];
  if (!lake) {
    items.push(
      <LayerButton
        key="waves"
        name="waves"
        label="Vagues"
        icon={<WavesIcon />}
        fail={failures.waves}
        source={sources.waves}
      />,
      <LayerButton
        key="currents"
        name="currents"
        label="Courants"
        icon={<CurrentIcon />}
        fail={failures.currents}
        source={sources.currents}
      />,
    );
  }
  items.push(
    <LayerButton
      key="rain"
      name="rain"
      label="Pluie (radar)"
      icon={<RainIcon />}
      fail={failures.rain}
      source={sources.rain}
    />,
    <LayerButton
      key="stations"
      name="stations"
      label="Stations et bouées"
      icon={<StationIcon />}
      source={sources.stations}
    />,
  );
  if (forecast) {
    const last = FORECAST_HOURS - 1;
    items.push(
      <Button
        key="back"
        type="button"
        noUiEdit
        className="rail-btn live-btn live-step"
        aria-label={tr('Une heure plus tôt')}
        disabled={step <= 0}
        onClick={() => {
          buzz();
          forecastStep.value = Math.max(0, step - 1);
        }}
      >
        <span className="rail-icon">◀</span>
      </Button>,
      <Button
        key="hour"
        type="button"
        noUiEdit
        className="rail-btn live-btn live-hour"
        aria-label={tr(
          step === 0
            ? 'Heure de la prévision : maintenant'
            : `Prévision dans ${step} h · toucher : maintenant`,
        )}
        onClick={() => {
          buzz();
          forecastStep.value = 0;
        }}
      >
        <span className="live-hour-time">
          {shownAt == null ? '…' : hourText(shownAt)}
        </span>
        {step === 0 ? null : <span className="live-hour-plus">+{step} h</span>}
      </Button>,
      <Button
        key="next"
        type="button"
        noUiEdit
        className="rail-btn live-btn live-step"
        aria-label={tr('Une heure plus tard')}
        disabled={step >= last}
        onClick={() => {
          buzz();
          forecastStep.value = Math.min(last, step + 1);
        }}
      >
        <span className="rail-icon">▶</span>
      </Button>,
    );
  }
  return (
    <div
      className={`live-btns live-${stage}`}
      role="group"
      aria-label={tr('LiveMétéo sur la carte')}
    >
      {placeBoxes(place, items.length).map((box, index) => {
        const item = items[index];
        const key = (item as { key?: string | null }).key ?? String(index);
        const style: CSSProperties = {
          left: box.left,
          top: box.top,
          width: place.width,
          height: place.height,
        };
        return (
          <div key={key} className="live-slot" style={style}>
            {item}
          </div>
        );
      })}
    </div>
  );
}

/**
 * One layer: coloured while shown; a touch shows or hides it, a long press
 * says its source (and why it is missing). A « ! » when its source fails.
 * @param props - The layer.
 * @param props.name - Which layer.
 * @param props.label - Its name.
 * @param props.icon - Its drawing.
 * @param props.fail - Why its data is missing, if it is.
 * @param props.source - Where its data comes from.
 * @returns The button.
 */
function LayerButton({
  name,
  label,
  icon,
  fail,
  source,
}: {
  name: keyof WeatherLayers;
  label: string;
  icon: ReactNode;
  fail?: string | undefined;
  source: string;
}) {
  useSignals();
  const tr = useTr();
  const lit = weatherLayers.value[name];
  const press = useLongPress(() => {
    buzz();
    toast(fail ? `${source} ⚠ ${fail}` : source);
  });
  const classes = ['rail-btn', 'live-btn', 'live-layer', `live-${name}`];
  if (lit) classes.push('on');
  if (press.hit) classes.push('lp-hit');
  return (
    <Button
      type="button"
      noUiEdit
      className={classes.join(' ')}
      data-layer={name}
      aria-pressed={lit}
      aria-label={tr(`${label} · appui long : source`)}
      title={tr(label)}
      onClick={() => toggleLayer(name)}
      {...press.handlers}
    >
      <span className="rail-icon live-ico">{icon}</span>
      {name === 'rain' && lit ? (
        <span className="live-rain-scale" aria-hidden="true" />
      ) : null}
      {fail && lit ? (
        <span className="live-fail" aria-hidden="true">
          !
        </span>
      ) : null}
    </Button>
  );
}

/**
 * The button of the zone: a dashed outline of a sea zone, the Météo-France
 * zone in short (or how many) and « zone? » small (« carte » for the
 * stations of the map shown). A big red cross blinks over it: a touch takes
 * LiveMétéo away; a long press opens the chooser of the Météo-France zones
 * over the map (one or several, or groups of them).
 * @returns The button.
 */
function ZoneButton() {
  useSignals();
  const tr = useTr();
  const around = liveOnMapAround.value;
  const zones = liveZonesShown.value;
  const press = useLongPress(() => {
    buzz();
    if (around) zonePickOpen.value = true;
    else go('settings', 'live');
  });
  return (
    <Button
      type="button"
      noUiEdit
      className={`rail-btn live-btn live-radius-btn live-zone-btn${press.hit ? ' lp-hit' : ''}`}
      aria-label={tr(
        around
          ? `Zones LiveMétéo : ${zonesText(zones)} · toucher : retirer LiveMétéo · appui long : choisir les zones Météo-France`
          : 'LiveMétéo de la carte affichée · toucher : retirer LiveMétéo · appui long : réglages',
      )}
      onClick={hideLiveOnMap}
      {...press.handlers}
    >
      <svg
        className="live-radius-ico"
        viewBox="0 0 40 40"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {around ? (
          <path
            d="M6 9 L19 5 L34 10 L35 27 L24 35 L8 31 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeDasharray="4 3"
            strokeLinejoin="round"
          />
        ) : (
          <rect
            x="5"
            y="8"
            width="30"
            height="24"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeDasharray="4 3"
          />
        )}
      </svg>
      <svg
        className="live-radius-x"
        viewBox="0 0 40 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="live-radius-cross"
          d="M5 5l30 30m0-30-30 30"
          stroke="#e00016"
          strokeWidth="6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {around ? (
        <span className="live-radius-nb">{zonesButtonText(zones)}</span>
      ) : null}
      <span className="live-radius-more" aria-hidden="true">
        {around ? 'zone?' : 'carte'}
      </span>
    </Button>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="live-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** A wind barb: the staff and two feathers. */
function WindIcon() {
  return (
    <Svg>
      <path d="M3 19 19 7" />
      <path d="M19 7l2.5 4.5M15.5 9.6l2.5 4.5M12 12.2l1.6 2.8" />
    </Svg>
  );
}

/** Two waves. */
function WavesIcon() {
  return (
    <Svg>
      <path d="M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1" />
      <path d="M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1" />
    </Svg>
  );
}

/** A current: a bent arrow. */
function CurrentIcon() {
  return (
    <Svg>
      <path d="M3 17c4 0 5-10 10-10h7" />
      <path d="M16.5 3.5 20 7l-3.5 3.5" />
    </Svg>
  );
}

/** A cloud and its drops. */
function RainIcon() {
  return (
    <Svg>
      <path d="M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7 15z" />
      <path d="M8 18.5 7 21M12.5 18.5l-1 2.5M17 18.5l-1 2.5" />
    </Svg>
  );
}

/** A station: the badge of its wind on its mast. */
function StationIcon() {
  return (
    <Svg>
      <circle cx="12" cy="8.5" r="6" />
      <path d="M12 14.5V22M8.5 22h7" />
      <path d="M9.5 8.5h5" strokeWidth="2.6" />
    </Svg>
  );
}

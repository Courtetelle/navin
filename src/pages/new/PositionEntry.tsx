import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { setEntryValue } from '../../features/logbook/entryActions.ts';
import { getGps } from '../../features/logbook/index.ts';
import { applyWeather, fetchWeather } from '../../features/tracking/index.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { FieldDefinition } from '../../model/field.ts';
import type { Position } from '../../model/types.ts';
import { state, toast, updateDraft } from '../../state/index.ts';

import { CommitInput } from './CommitInput.tsx';

const WEATHER_LABEL = '🌬 Vent, mer et baro du modèle météo (réseau)';

/**
 * Position of the entry: GPS, manual text, and the weather model at that place
 * (legacy `position`).
 * @param props - The field.
 * @param props.field - Field definition.
 * @returns The editor.
 */
export function PositionEntry({ field }: { field: FieldDefinition }) {
  useSignals();
  const [searching, setSearching] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const value = state.data.draft.value?.v[field.key] as Position | undefined;
  const lines = value ? fmtPos(value).split('  ') : [];
  const manualText = value?.text ?? '';
  return (
    <>
      <div
        className={value ? 'value' : 'value empty'}
        style={{ fontSize: value ? '30px' : '40px' }}
      >
        {value ? (
          <>
            {lines[0]}
            {lines.length > 1 ? <br /> : null}
            {lines.slice(1).join('  ')}
          </>
        ) : (
          '– –'
        )}
      </div>
      {value?.acc ? (
        <p className="help" style={{ textAlign: 'center' }}>
          Précision ± {Math.round(value.acc)} m
        </p>
      ) : null}
      <div className="row">
        <Button
          className="btn big primary"
          data-act="gps"
          disabled={searching}
          onClick={() => getGps(setSearching, keepPosition)}
        >
          {searching ? '⏳ Recherche GPS…' : '📍 Position GPS'}
        </Button>
      </div>
      <div className="row">
        <Button
          className="btn"
          data-act="wx"
          disabled={loadingWeather}
          onClick={() => addWeather(setLoadingWeather)}
        >
          {loadingWeather ? '⏳ Météo…' : WEATHER_LABEL}
        </Button>
      </div>
      <div className="row">
        <CommitInput
          key={manualText}
          className="text"
          type="text"
          placeholder="ou saisir à la main"
          defaultValue={manualText}
          aria-label="Position manuelle"
          onCommit={(text) => {
            const typed = text.trim();
            setEntryValue(field.key, typed ? { text: typed } : null);
          }}
        />
      </div>
    </>
  );
}

function keepPosition({ coords }: GeolocationPosition): void {
  const { latitude, longitude, accuracy, speed, heading } = coords;
  setEntryValue('pos', { lat: latitude, lon: longitude, acc: accuracy });
  // The phone's GPS sometimes also gives the speed and the course over ground.
  if (speed != null && !Number.isNaN(speed)) {
    setEntryValue('sog', Math.round(speed * 19.4384) / 10);
  }
  if (
    heading != null &&
    !Number.isNaN(heading) &&
    speed != null &&
    speed > 0.5
  ) {
    setEntryValue('cog', Math.round(heading) % 360);
  }
  toast('Position enregistrée');
}

function addWeather(setLoading: (loading: boolean) => void): void {
  const draft = state.data.draft.value;
  const position = draft?.v.pos;
  if (!draft || !position || position.text) {
    toast('Prenez d’abord la position GPS');
    return;
  }
  setLoading(true);
  fetchWeather(position.lat, position.lon, new Date(draft.t))
    .then((weather) => {
      updateDraft((form) => applyWeather(form.v, weather));
      toast(weather.src ? `Météo ajoutée : ${weather.src}` : 'Météo ajoutée');
    })
    .catch(() => toast('Pas de réseau : météo indisponible'))
    .finally(() => setLoading(false));
}

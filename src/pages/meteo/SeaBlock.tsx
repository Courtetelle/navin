import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import type { SeaNow, WaveTrain } from '../../features/onwater/index.ts';
import { seaNow, seaRows, seaSentence } from '../../features/onwater/index.ts';
import {
  STEEP_CLASSES,
  currentAgainst,
  periodRule,
  steepnessOf,
} from '../../features/onwater/steepness.ts';
import { useTr } from '../../i18n/useTr.ts';
import { inInland } from '../../model/contacts.ts';
import { navZone } from '../../state/index.ts';

/** Props of {@link SeaBlock}. */
interface SeaBlockProps {
  lat: number;
  lon: number;
}

/**
 * The sea near a station: height, direction and period of the whole sea, the
 * wind sea and the swell, and the surface current. The wind stations measure no sea: these come from a
 * model, and say so. Nothing on a lake or inland.
 * @param props - The place.
 * @returns The block, or nothing.
 */
export function SeaBlock({ lat, lon }: SeaBlockProps) {
  const tr = useTr();
  const ask = `${lat},${lon}`;
  const [read, setRead] = useState<{ ask: string; sea: SeaNow | null }>({
    ask: '',
    sea: null,
  });
  useEffect(() => {
    let closed = false;
    void seaNow({ lat, lon })
      .catch(() => null)
      .then((sea) => {
        if (!closed) setRead({ ask, sea });
      });
    return () => {
      closed = true;
    };
  }, [ask, lat, lon]);
  const sea = read.ask === ask ? read.sea : null;
  // Lakes have no sea state: waves, swell and currents are for the sea.
  if (!sea || inInland({ lat, lon }) || navZone() === 'lac') return null;
  const rows = seaRows(sea);
  return (
    <section className="live-sea">
      <h2>{tr('🌊 État de la mer')}</h2>
      <p className="live-sea-txt">
        {tr(seaSentence({ waveH: sea.total.height }))}
      </p>
      <table className="live-tbl">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th>{tr(label)}</th>
              <td>{tr(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SteepBlock sea={sea} />
      <p className="keep-help">
        {tr(
          'Hauteurs significatives (Hs) : la moyenne du tiers des plus hautes vagues ; une vague isolée peut approcher 2 × Hs. PRÉVISION des modèles de vagues et de courants Open-Meteo près de la station, pas une mesure : les stations de vent ne mesurent pas la mer. Le courant de surface du modèle est grossier près des côtes.',
        )}
      </p>
    </section>
  );
}

/**
 * The steepness of each train of waves in its colour, and the scale of the
 * five classes with the whole sea marked on it.
 * @param props - The sea.
 * @param props.sea - The sea.
 * @returns The block, or nothing without periods.
 */
function SteepBlock({ sea }: { sea: SeaNow }) {
  const tr = useTr();
  const trains: Array<[string, WaveTrain | null]> = [
    ['Mer totale', sea.total],
    ['Mer du vent', sea.windSea],
    ['Houle', sea.swell],
  ];
  const shown = trains.flatMap(([name, train]) => {
    const steep = train ? steepnessOf(train.height, train.period) : null;
    return train && steep ? [{ name, train, steep }] : [];
  });
  const whole = shown[0]?.name === 'Mer totale' ? shown[0] : null;
  if (shown.length === 0) return null;
  const against = currentAgainst(sea.total.dir, sea.current?.toward);
  return (
    <div className="steep" data-steep={whole?.steep.steep.level ?? ''}>
      <h3>{tr('Cambrure des vagues (H / L)')}</h3>
      {shown.map(({ name, train, steep }) => (
        <div
          key={name}
          className="steep-row"
          style={
            {
              '--c': steep.steep.color,
              '--ink': steep.steep.ink,
            } as CSSProperties
          }
        >
          <b className="steep-chip">{tr(`1/${steep.oneIn}`)}</b>
          <div>
            <b>{tr(`${name} · ${steep.steep.name}`)}</b>
            <div>{tr(steep.steep.text)}</div>
            {steep.small && steep.steep.level >= 2 ? (
              <div className="steep-small">
                {tr('vagues de moins d’1 m : inconfort plutôt que danger')}
              </div>
            ) : null}
            <small>
              {tr(
                `${train.height.toFixed(1).replace('.', ',')} m sur ${Math.round(steep.length)} m de longueur d’onde (période ${Math.round(train.period ?? 0)} s) · ${periodRule(train.height, train.period) ?? ''}`,
              )}
            </small>
          </div>
        </div>
      ))}
      {against ? (
        <p className="steep-warn" role="alert">
          {tr(
            '⚠️ Courant contraire aux vagues : il les raccourcit et les lève, la mer peut déferler sans plus de vent.',
          )}
        </p>
      ) : null}
      <div className="steep-scale" aria-hidden="true">
        {STEEP_CLASSES.map((one) => (
          <span
            key={one.level}
            className={
              whole?.steep.steep.level === one.level
                ? 'steep-cell here'
                : 'steep-cell'
            }
            style={{ '--c': one.color, '--ink': one.ink } as CSSProperties}
          >
            {tr(one.name)}
          </span>
        ))}
      </div>
      <p className="steep-marks">
        {tr('< 1/50 · 1/50 · 1/25 · 1/12 · ≥ 1/7 (déferlement)')}
      </p>
    </div>
  );
}

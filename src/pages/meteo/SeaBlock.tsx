import { useEffect, useState } from 'react';

import type { SeaNow, WaveTrain } from '../../features/onwater/index.ts';
import { seaNow, seaSentence } from '../../features/onwater/index.ts';
import { useTr } from '../../i18n/useTr.ts';

import { compassPoint } from './liveText.ts';

/** Props of {@link SeaBlock}. */
export interface SeaBlockProps {
  lat: number;
  lon: number;
}

/**
 * The sea near a station: height, direction and period of the whole sea, the
 * wind sea and the swell. The wind stations measure no sea: these come from a
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
  if (!sea) return null;
  const rows: Array<[string, string]> = [['Mer totale', trainText(sea.total)]];
  if (sea.windSea) rows.push(['Mer du vent', trainText(sea.windSea)]);
  if (sea.swell) rows.push(['Houle', trainText(sea.swell)]);
  if (sea.water != null) {
    rows.push(['Eau', `${sea.water.toFixed(1).replace('.', ',')} °C`]);
  }
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
      <p className="keep-help">
        {tr(
          'PRÉVISION du modèle de vagues Open-Meteo près de la station, pas une mesure : les stations de vent ne mesurent pas la mer.',
        )}
      </p>
    </section>
  );
}

function trainText(wave: WaveTrain): string {
  const parts = [`${wave.height.toFixed(1).replace('.', ',')} m`];
  if (wave.period != null) parts.push(`${Math.round(wave.period)} s`);
  if (wave.dir != null) parts.push(`du ${compassPoint(wave.dir)}`);
  return parts.join(' · ');
}

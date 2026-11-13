import { useEffect, useState } from 'react';

import type { SeaNow } from '../../features/onwater/index.ts';
import { seaNow, seaRows, seaSentence } from '../../features/onwater/index.ts';
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
      <p className="keep-help">
        {tr(
          'PRÉVISION des modèles de vagues et de courants Open-Meteo près de la station, pas une mesure : les stations de vent ne mesurent pas la mer. Le courant de surface du modèle est grossier près des côtes.',
        )}
      </p>
    </section>
  );
}

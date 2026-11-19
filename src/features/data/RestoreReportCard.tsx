import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';

import { reportLines, restoreReport } from './restoreReport.ts';

/**
 * After a restoration: what came from the file, under the button that chose
 * it (Paramétrages › Sauvegarde, Exporter), until « OK ».
 * @returns The card, or nothing.
 */
export function RestoreReportCard() {
  useSignals();
  const report = restoreReport.value;
  if (!report) return null;
  return (
    <div className="restore-report" role="status">
      <b>🔄 Récupération terminée : tout est bien arrivé</b>
      <ul>
        {reportLines(report).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Button
        type="button"
        className="btn primary"
        onClick={() => {
          buzz();
          restoreReport.value = null;
        }}
      >
        OK
      </Button>
    </div>
  );
}

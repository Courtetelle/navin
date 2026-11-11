import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { updateSettings } from '../../state/index.ts';
import { LX_THEMES } from '../publish/index.ts';

import {
  prepReportCache,
  prepReportShare,
  reportPhotos,
  reportTheme,
} from './prepReportData.ts';
import { prepReportPrint } from './prepReportPrint.tsx';

/** Props of {@link PrepPublishBox}. */
interface PrepPublishBoxProps {
  /** Closes the window. */
  onClose: () => void;
}

/**
 * Content of the window publishing the PréP + check-in report.
 * @param props - Way out.
 * @returns The box.
 */
export function PrepPublishBox({ onClose }: PrepPublishBoxProps) {
  useSignals();
  const theme = reportTheme();
  const photos = reportPhotos();
  return (
    <div className="ck-ask-box pub-box">
      <p>Publier le rapport PréP + check-in</p>
      <p className="help pub-h">Mise en page</p>
      <div className="pub-themes">
        {LX_THEMES.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            className={theme === id ? 'btn on' : 'btn'}
            data-pubth={id}
            onClick={() => {
              buzz();
              updateSettings((settings) => {
                settings.repTheme = id;
              });
              prepReportCache();
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        className={photos ? 'btn check on' : 'btn check'}
        data-pubph="1"
        onClick={() => {
          buzz();
          updateSettings((settings) => {
            settings.repPh = !photos;
          });
          prepReportCache();
        }}
      >
        <span className="box">{photos ? '✔' : ''}</span>Inclure les photos
      </Button>
      <div className="row c2">
        <Button
          type="button"
          className="btn big"
          data-pubimg="1"
          onClick={() => {
            buzz();
            onClose();
            void prepReportShare();
          }}
        >
          📸 Image<small>écran, WhatsApp…</small>
        </Button>
        <Button
          type="button"
          className="btn big"
          data-pubpdf="1"
          onClick={() => {
            buzz();
            onClose();
            void prepReportPrint();
          }}
        >
          🖨 PDF<small>A4, imprimante</small>
        </Button>
      </div>
      <Button
        type="button"
        className="btn"
        data-pubno="1"
        onClick={() => {
          buzz();
          onClose();
        }}
      >
        Annuler
      </Button>
    </div>
  );
}

import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { SendButton } from '../../components/shared/ShareButton.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { buzz } from '../../lib/dom.ts';
import { updateSettings } from '../../state/index.ts';
import { ShareThemeNote } from '../publish/index.ts';

import {
  prepReportCache,
  prepReportShare,
  reportPhotos,
} from './prepReportData.ts';
import { prepReportPrint } from './prepReportPrint.tsx';

/** Props of {@link PrepPublishBox}. */
interface PrepPublishBoxProps {
  /** The format chosen with « Partager ». */
  format: ShareFormat;
  /** Closes the window. */
  onClose: () => void;
}

/**
 * Content of the window publishing the PréP + check-in report.
 * @param props - Way out.
 * @returns The box.
 */
export function PrepPublishBox({ format, onClose }: PrepPublishBoxProps) {
  useSignals();
  const photos = reportPhotos();
  return (
    <div className="ck-ask-box pub-box">
      <p>Partager le rapport PréP + check-in</p>
      <ShareThemeNote />
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
      <div className="row">
        <SendButton
          format={format}
          data-pubsend={format}
          onClick={() => {
            buzz();
            onClose();
            if (format === 'pdf') void prepReportPrint();
            else void prepReportShare();
          }}
        />
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

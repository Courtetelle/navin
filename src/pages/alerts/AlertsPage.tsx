import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { SwipeRow } from '../../features/prep/index.ts';
import {
  ListPublishRow,
  alertWhen,
  openListPublish,
} from '../../features/publish/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { AlertRecord } from '../../model/alertLog.ts';
import {
  ALERT_KINDS,
  alertIcon,
  alertsIn,
  latestFirst,
} from '../../model/alertLog.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  alertLog,
  eraseAlerts,
  eraseAlertsBetween,
  toast,
} from '../../state/index.ts';

/**
 * Screen `alerts` (data › Journal des alertes): every alert given, the latest
 * first; a touch shows it whole; swiped left, 👁 Visualiser, 📤 Partager and
 * 🗑 Effacer; a period erased at once; the whole journal shared by kind and
 * period.
 * @returns The screen.
 */
export function AlertsPage() {
  useSignals();
  const tr = useTr();
  const alerts = latestFirst(alertLog.value);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageBack
        label="◀ data"
        data-go="more"
        onClick={() => {
          buzz();
          go('more');
        }}
      >
        {tr('◀ data')}
      </PageBack>
      <PageTitle
        helps={[
          'Toutes les alertes données par NavIn, avec ou sans croisière ouverte : vent, orage, feux d’avis des lacs, profondeur. Toucher une alerte la montre en entier ; la glisser vers la gauche : 👁 Visualiser, 📤 Partager, 🗑 Effacer (appui long).',
        ]}
      >
        🔔 Journal des alertes
      </PageTitle>
      {alerts.length === 0 ? (
        <HelpText>Aucune alerte pour l’instant.</HelpText>
      ) : (
        <div className="alert-list">
          {alerts.map((alert) => (
            <AlertBand
              key={alert.id}
              alert={alert}
              open={open === alert.id}
              onOpen={(shown) => setOpen(shown ? alert.id : null)}
            />
          ))}
        </div>
      )}
      {alerts.length > 0 ? (
        <>
          <ListPublishRow kind="alerts" />
          <EraseBetween />
        </>
      ) : null}
    </>
  );
}

/** Props of {@link AlertBand}. */
interface AlertBandProps {
  alert: AlertRecord;
  open: boolean;
  onOpen: (open: boolean) => void;
}

/**
 * One alert, a band: its time and title, the whole message inside.
 * @param props - The alert and whether it is open.
 * @returns The band.
 */
function AlertBand({ alert, open, onOpen }: AlertBandProps) {
  const tr = useTr();
  const name = `${alertIcon(alert.kind)} ${alertWhen(alert.t)} · ${tr(alert.title)}`;
  return (
    <SwipeRow
      id={alert.id}
      name={name}
      silent
      onView={() => onOpen(true)}
      onShare={(format) => openListPublish('alerts', alert.id, format)}
      onDelete={(id) => {
        eraseAlerts([id]);
        toast('Alerte effacée');
      }}
    >
      <details
        className="section alert-band"
        data-band-id={alert.id}
        open={open}
        onToggle={(event) => onOpen(event.currentTarget.open)}
      >
        <summary>{name}</summary>
        <div className="alert-text">
          <p>{alert.text}</p>
          {alert.cruise ? (
            <p className="help">{`${tr('Croisière')} : ${alert.cruise}`}</p>
          ) : null}
        </div>
      </details>
    </SwipeRow>
  );
}

/**
 * Erase every alert between two days, after a long press.
 * @returns The block.
 */
function EraseBetween() {
  useSignals();
  const tr = useTr();
  const [shown, setShown] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const all = new Set(ALERT_KINDS.map(([kind]) => kind));
  const count = from && to ? alertsIn(alertLog.value, all, from, to).length : 0;
  if (!shown) {
    return (
      <ButtonRow>
        <Button
          className="btn"
          data-alerts="erase-range"
          onClick={() => {
            buzz();
            setShown(true);
          }}
        >
          {tr('🗑 Effacer les alertes d’une période')}
        </Button>
      </ButtonRow>
    );
  }
  return (
    <div className="alert-erase">
      <div className="row c2">
        <label className="cf">
          {tr('Du')}
          <input
            className="text"
            type="date"
            data-erase-from
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="cf">
          {tr('Au')}
          <input
            className="text"
            type="date"
            data-erase-to
            min={from || undefined}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      <ButtonRow>
        <HoldDeleteButton
          className="btn danger"
          data-alerts="erase-confirm"
          disabled={count === 0}
          onClick={buzz}
          onDelete={() => {
            const gone = eraseAlertsBetween(from, to);
            toast(
              `${gone} alerte${gone > 1 ? 's' : ''} effacée${gone > 1 ? 's' : ''}`,
            );
            setShown(false);
          }}
        >
          {tr(
            count
              ? `Effacer ${count} alerte${count > 1 ? 's' : ''} (appui long)`
              : 'Choisir les deux dates',
          )}
        </HoldDeleteButton>
      </ButtonRow>
    </div>
  );
}

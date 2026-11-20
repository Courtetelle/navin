<<<<<<< HEAD
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { fixedOnMap, fixedOpened } from '../../features/map/fixedZone.ts';
import { askMapArea } from '../../features/map/pendingArea.ts';
import { SwipeRow } from '../../features/prep/index.ts';
import { shareCards } from '../../features/publish/index.ts';
=======
import { HelpText } from '../../components/shared/HelpText.tsx';
import { fixedOnMap } from '../../features/map/fixedZone.ts';
import { askMapArea } from '../../features/map/pendingArea.ts';
>>>>>>> 0d52fb66522b114f30db0b0ea563bceba9847422
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { FixedAlert } from '../../model/fixedAlerts.ts';
import {
  FIXED_ALERTS,
  FIXED_SEAS,
  fixedBand,
} from '../../model/fixedAlerts.ts';
import { go } from '../../shell/router.ts';
<<<<<<< HEAD
import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** The alerts hidden by the sailor (swiped, 🗑). */
const HIDDEN_KEY = 'navin.fixedHidden';

function readHidden(): string[] {
  const hidden = store.get<unknown>(HIDDEN_KEY, []);
  return Array.isArray(hidden)
    ? hidden.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Show the zone of an alert on the map.
 * @param alert - The alert.
 */
function showZone(alert: FixedAlert): void {
  if (!alert.zone) return;
  buzz();
  fixedOnMap.value = alert.id;
  askMapArea(alert.zone);
  go('tracker');
}

/**
 * The lines of a card, as it is shown and shared.
 * @param alert - The alert.
 * @returns `[label, text]` pairs.
 */
function cardRows(alert: FixedAlert): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Où', alert.where],
    ['Ce qui se passe', alert.what],
    ['Quand', alert.when],
    ['Conduite', alert.conduct],
  ];
  if (alert.check) rows.push(['À vérifier avant de partir', alert.check]);
  return rows;
}

/**
 * Share a card: an image or a PDF, in the layout of NavIn.
 * @param alert - The alert.
 * @param format - Image or PDF.
 */
async function shareCard(alert: FixedAlert, format: ShareFormat) {
  const sea = FIXED_SEAS.find(([one]) => one === alert.sea)?.[1] ?? '';
  await shareCards(
    {
      title: alert.name,
      kicker: 'Alerte fixe',
      sub: sea,
      sections: [
        { title: 'Alerte fixe', rows: cardRows(alert) },
        {
          title: 'À vérifier',
          rows: [
            [
              'Texte de travail',
              'à vérifier avec les Instructions nautiques, un almanach et les cartes',
            ],
          ],
        },
      ],
      photos: [],
      photosTitle: '',
    },
    `NavIn-alerte-${alert.id}`,
    format,
  );
}

/**
 * The fixed alerts, a list as the marks and the traces: a band per alert,
 * sea by sea; a touch opens its card, 🗺 shows its zone on the map; swiped,
 * 🗺 Sur la carte, 📤 Partager and 🗑 Masquer. A touch on the zone on the map
 * comes back here, the band blinking and its card open.
=======

/**
 * The fixed alerts, sea by sea: what happens there, when, how to behave. A
 * touch on « 🗺 » opens the map on the zone; a touch on the zone comes back
 * here, the alert blinking.
>>>>>>> 0d52fb66522b114f30db0b0ea563bceba9847422
 * @returns The list.
 */
export function FixedAlerts() {
  const tr = useTr();
<<<<<<< HEAD
  const [hidden, setHidden] = useState(readHidden);
  const [open, setOpen] = useState<string | null>(() => {
    const opened = fixedOpened.peek();
    fixedOpened.value = null;
    return opened;
  });
  const hide = (id: string) => {
    const next = [...hidden.filter((one) => one !== id), id];
    store.set(HIDDEN_KEY, next);
    setHidden(next);
    toast('Alerte masquée : « Réafficher » en bas de la liste');
    return true;
  };
  const shown = FIXED_ALERTS.filter(
    (alert) => !hidden.includes(alert.id) || alert.id === open,
  );
=======
>>>>>>> 0d52fb66522b114f30db0b0ea563bceba9847422
  return (
    <div className="fixed-alerts">
      <p className="fx-draft" role="note">
        {tr(
<<<<<<< HEAD
          '⚠ Textes de travail, à vérifier avec les Instructions nautiques du SHOM, un almanach et les cartes.',
        )}
      </p>
      {FIXED_SEAS.map(([sea, title]) => {
        const alerts = shown.filter((alert) => alert.sea === sea);
        if (alerts.length === 0) return null;
        return (
          <section key={sea} className="fx-sea" data-fixed-sea={sea}>
            <h2 className="fx-sea-title">{tr(title)}</h2>
            {alerts.map((alert) => (
              <FixedRow
                key={alert.id}
                alert={alert}
                open={open === alert.id}
                onToggle={() => {
                  buzz();
                  setOpen(open === alert.id ? null : alert.id);
                }}
                onHide={hide}
              />
            ))}
          </section>
        );
      })}
      {hidden.length > 0 ? (
        <Button
          className="btn fx-unhide"
          data-fixed="unhide"
          onClick={() => {
            buzz();
            store.set(HIDDEN_KEY, []);
            setHidden([]);
          }}
        >
          {tr(
            `↺ Réafficher ${hidden.length === 1 ? 'l’alerte masquée' : `les ${hidden.length} alertes masquées`}`,
          )}
        </Button>
      ) : null}
      <HelpText>
        Les alertes fixes sont les dangers qui reviennent toujours au même
        endroit : courant de marée, plateau de roches, passe étroite, rail de
        navigation, vent local. Elles se lisent sans réseau. Toucher une bande
        ouvre sa fiche ; 🗺 montre sa zone sur la carte, et toucher la zone
        revient ici. Glissée vers la gauche, une bande offre 🗺 Sur la carte, 📤
        Partager (image ou PDF) et 🗑 Masquer (réaffichable en bas de la liste).
        Les heures et les forces du jour (marée, coefficient, courant) restent à
        lire dans l’annuaire des marées et l’almanach.
=======
          '⚠ Textes de travail, à vérifier avec les Instructions nautiques du SHOM, un almanach et les cartes : ils ne remplacent ni les unes ni les autres.',
        )}
      </p>
      {FIXED_SEAS.map(([sea, title]) => (
        <section key={sea} className="fx-sea" data-fixed-sea={sea}>
          <h2>{tr(title)}</h2>
          {FIXED_ALERTS.filter((alert) => alert.sea === sea).map((alert) => (
            <FixedCard key={alert.id} alert={alert} />
          ))}
        </section>
      ))}
      <HelpText>
        Les alertes fixes sont les dangers qui reviennent toujours au même
        endroit : courant de marée, plateau de roches, passe étroite, rail de
        navigation, vent local. Elles se lisent sans réseau. Les heures et les
        forces du jour (marée, coefficient, courant) restent à lire dans
        l’annuaire des marées et l’almanach.
>>>>>>> 0d52fb66522b114f30db0b0ea563bceba9847422
      </HelpText>
    </div>
  );
}

/**
<<<<<<< HEAD
 * One fixed alert: its band, swiped for its menu, and its card when open.
 * @param props - The alert.
 * @param props.alert - The alert.
 * @param props.open - Its card is open.
 * @param props.onToggle - Open or close its card.
 * @param props.onHide - Hide it.
 * @returns The band.
 */
function FixedRow({
  alert,
  open,
  onToggle,
  onHide,
}: {
  alert: FixedAlert;
  open: boolean;
  onToggle: () => void;
  onHide: (id: string) => boolean;
}) {
  const tr = useTr();
  const { id, name, where, zone, sources } = alert;
  return (
    <SwipeRow
      id={fixedBand(id)}
      name={name}
      silent
      onDelete={() => onHide(id)}
      onView={zone ? () => showZone(alert) : null}
      viewAs={{ icon: '🗺', label: 'Sur la carte' }}
      onShare={(format) => {
        void shareCard(alert, format);
      }}
    >
      <div
        className={
          open ? 'section mark-item fx-row open' : 'section mark-item fx-row'
        }
        data-fixed={id}
      >
        <div className="fx-band">
          <button
            type="button"
            className="mark-head"
            aria-expanded={open}
            aria-label={tr(`${name} · toucher : la fiche`)}
            onClick={onToggle}
          >
            <span className="mk-pin" aria-hidden="true">
              ⚠
            </span>
            <span className="mk-text">
              <b className="b-nm">{tr(name)}</b>
              <small>{tr(where)}</small>
            </span>
            <span className="fx-open" aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
          </button>
          {zone ? (
            <Button
              className="btn fx-map"
              data-fixed-map={id}
              aria-label={tr(`${name} : voir la zone sur la carte`)}
              onClick={() => showZone(alert)}
            >
              🗺
            </Button>
          ) : null}
        </div>
        {open ? (
          <div className="fx-card" data-fixed-card={id}>
            {cardRows(alert)
              .slice(1)
              .map(([label, text]) => (
                <p key={label}>
                  <b>{tr(`${label} : `)}</b>
                  {tr(text)}
                </p>
              ))}
            {sources?.length ? (
              <small className="fx-sources">
                {tr('Sources : ')}
                {sources.map(([label, url], index) => (
                  <span key={url}>
                    {index > 0 ? ' · ' : ''}
                    <a href={url} target="_blank" rel="noreferrer">
                      {tr(label)}
                    </a>
                  </span>
                ))}
              </small>
            ) : null}
          </div>
        ) : null}
      </div>
    </SwipeRow>
=======
 * One fixed alert: its band (blinking when come back from the map).
 * @param props - The alert.
 * @param props.alert - The alert.
 * @returns The card.
 */
function FixedCard({ alert }: { alert: FixedAlert }) {
  const tr = useTr();
  const { id, name, where, zone, what, when, conduct, check, sources } = alert;
  return (
    <article
      className="lw-row fx-row"
      data-band-id={fixedBand(id)}
      data-fixed={id}
    >
      <div>
        <b>{tr(`⚠ ${name}`)}</b>
        <small className="fx-where">{tr(where)}</small>
        <p>
          <b>{tr('Ce qui se passe : ')}</b>
          {tr(what)}
        </p>
        <p>
          <b>{tr('Quand : ')}</b>
          {tr(when)}
        </p>
        <p>
          <b>{tr('Conduite : ')}</b>
          {tr(conduct)}
        </p>
        {check ? (
          <p>
            <b>{tr('À vérifier avant de partir : ')}</b>
            {tr(check)}
          </p>
        ) : null}
        {sources?.length ? (
          <small className="fx-sources">
            {tr('Sources : ')}
            {sources.map(([label, url], index) => (
              <span key={url}>
                {index > 0 ? ' · ' : ''}
                <a href={url} target="_blank" rel="noreferrer">
                  {tr(label)}
                </a>
              </span>
            ))}
          </small>
        ) : null}
        {zone ? (
          <button
            type="button"
            className="btn fx-map"
            data-fixed-map={id}
            aria-label={tr(`${name} : voir la zone sur la carte`)}
            onClick={() => {
              buzz();
              fixedOnMap.value = id;
              askMapArea(zone);
              go('tracker');
            }}
          >
            {tr('🗺 La zone sur la carte')}
          </button>
        ) : null}
      </div>
    </article>
>>>>>>> 0d52fb66522b114f30db0b0ea563bceba9847422
  );
}

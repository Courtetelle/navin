import { HelpText } from '../../components/shared/HelpText.tsx';
import { fixedOnMap } from '../../features/map/fixedZone.ts';
import { askMapArea } from '../../features/map/pendingArea.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { FixedAlert } from '../../model/fixedAlerts.ts';
import {
  FIXED_ALERTS,
  FIXED_SEAS,
  fixedBand,
} from '../../model/fixedAlerts.ts';
import { go } from '../../shell/router.ts';

/**
 * The fixed alerts, sea by sea: what happens there, when, how to behave. A
 * touch on « 🗺 » opens the map on the zone; a touch on the zone comes back
 * here, the alert blinking.
 * @returns The list.
 */
export function FixedAlerts() {
  const tr = useTr();
  return (
    <div className="fixed-alerts">
      <p className="fx-draft" role="note">
        {tr(
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
      </HelpText>
    </div>
  );
}

/**
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
  );
}

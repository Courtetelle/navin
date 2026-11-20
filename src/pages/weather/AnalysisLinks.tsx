import { useState } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { ANALYSIS } from '../../model/analysis.ts';

/** After a day the copy kept with NavIn is old. */
const OLD_MS = 24 * 3_600_000;

/**
 * The analysis from the hemisphere down to the bay: the copy kept with NavIn
 * (offline, greyed and said old after 24 h) and the version kept up to date
 * online.
 * @returns The section.
 */
export function AnalysisLinks() {
  const tr = useTr();
  // Paris time: one hour ahead of UTC in winter, two in summer; an hour
  // more or less does not change « old ».
  const at = Date.parse(`${ANALYSIS.at}:00+01:00`);
  const [now] = useState(() => Date.now());
  const old = now - at > OLD_MS;
  const when = new Date(at).toLocaleString('fr-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <section className="wx-analysis" data-analysis={old ? 'old' : 'fresh'}>
      <h2>{tr('Situation générale')}</h2>
      <p className="keep-help">
        {tr(
          `De l’hémisphère à la baie, ${ANALYSIS.place} : jets, fronts, Manche, baie, vagues et courants, cartes avec annotations par boutons. Chiffres et cartes calculés par des scripts (${ANALYSIS.runs}) ; le texte est rédigé par une IA.`,
        )}
      </p>
      <div className="page-links">
        <a
          className={old ? 'btn page-link wx-analysis-old' : 'btn page-link'}
          data-page-link="analysis-offline"
          href={`${import.meta.env.BASE_URL}${ANALYSIS.offline}`}
          target="_blank"
          rel="noopener"
        >
          <span className="page-link-ico" aria-hidden="true">
            🗺
          </span>
          <span className="page-link-txt">
            <b>{tr('Analyse gardée hors ligne')}</b>
            <small>
              {tr(
                old
                  ? `du ${when}, ancienne : à remplacer par la version à jour`
                  : `du ${when}, lisible sans réseau`,
              )}
            </small>
          </span>
          <span className="page-link-go" aria-hidden="true">
            ›
          </span>
        </a>
        <a
          className="btn page-link"
          data-page-link="analysis-online"
          href={ANALYSIS.online}
          target="_blank"
          rel="noopener"
        >
          <span className="page-link-ico" aria-hidden="true">
            🌐
          </span>
          <span className="page-link-txt">
            <b>{tr('Analyse à jour, en ligne')}</b>
            <small>{tr('la dernière version, avec du réseau')}</small>
          </span>
          <span className="page-link-go" aria-hidden="true">
            ›
          </span>
        </a>
      </div>
    </section>
  );
}

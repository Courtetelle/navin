import { fmtTime } from '../../lib/format.ts';
import { windTxt } from '../../lib/wind.ts';

import type { MfCheck } from './coastStations.ts';

/**
 * What a key check means for the sailor.
 * @param check - Result of the check.
 * @returns The text.
 */
export function checkText(check: MfCheck): string {
  if (check.kind === 'ok') {
    const { reading, stations } = check;
    const gust =
      reading.gust == null ? '' : `, rafales ${windTxt(reading.gust)}`;
    const km = reading.km == null ? '' : ` (${Math.round(reading.km)} km)`;
    return `✅ Clé Météo-France valide · ${stations} stations · ${reading.name}${km} : ${windTxt(reading.avg)}${gust}, mesuré à ${fmtTime(new Date(reading.t))}`;
  }
  if (check.kind === 'noWind') {
    return `⚠️ Clé valide (${check.stations} stations) mais aucun vent récent près de ${check.near} · codes ${check.status}`;
  }
  if (check.kind === 'refused') {
    const { apis, detail, status } = check;
    const why = detail ? ` · ${detail}` : '';
    if (status === 403 && apis?.includes('DonneesPubliquesObservation')) {
      return `❌ Clé refusée (code 403) alors qu’elle contient bien « Données Publiques Observation »${why}`;
    }
    if (status === 403) {
      const opens =
        apis && apis.length > 0
          ? ` · cette clé ouvre seulement : ${apis.join(', ')}`
          : '';
      return `❌ Clé reconnue mais pas autorisée pour « Données Publiques Observation » (code 403)${opens} · abonnez-vous à cette API, puis générez une NOUVELLE clé « API Key » et collez-la ici${why}`;
    }
    return `❌ Clé refusée par Météo-France (code ${status}) · vérifiez le type « API Key » et l’abonnement à « Données Publiques Observation »${why}`;
  }
  if (check.kind === 'empty') {
    return `❌ Réponse inattendue de Météo-France (code ${check.status}) · ${check.sample}`;
  }
  return '📵 Pas de réseau · clé enregistrée, vérification impossible';
}

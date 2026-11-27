/** A site of the internet NavIn links to. */
export interface SiteDef {
  /** Key of the site, for the changes kept. */
  id: string;
  /** Text of its button, by default. */
  label: string;
  /** Its address, by default. */
  url: string;
  /** Where its button stands in NavIn. */
  where: string;
}

/**
 * Every site NavIn links to, the one place their buttons and addresses are
 * listed (data › Sites internet changes them).
 */
export const SITES: readonly SiteDef[] = [
  {
    id: 'wx-meteoswiss',
    label: 'Alertes MeteoSwiss',
    url: 'https://www.meteoswiss.admin.ch/weather/hazards/hazard-map.html',
    where: 'Météo › Prévisions (sur un lac)',
  },
  {
    id: 'wx-meteoswiss-mesures',
    label: 'Vent mesuré aux stations MétéoSuisse',
    url: 'https://www.meteoswiss.admin.ch/weather/measurement-values-and-satellite-images/measurement-values-at-meteorological-stations.html',
    where: 'Météo › Prévisions › Bulletin de la zone (lac)',
  },
  {
    id: 'wx-vigilance',
    label: 'Vigilance Météo-France (orages, vagues-submersion)',
    url: 'https://vigilance.meteofrance.fr/fr',
    where: 'Météo › Prévisions › Bulletin de la zone (en mer)',
  },
  {
    id: 'wx-windfinder',
    label: 'Windfinder (vent prévu et mesuré)',
    url: 'https://www.windfinder.com/',
    where: 'Météo › Prévisions › Bulletin de la zone (lac)',
  },
  {
    id: 'wx-meteoconsult',
    label: 'METEO CONSULT Marine (cartes et bulletins)',
    url: 'https://www.meteoconsult-marine.com/',
    where: 'Météo › Prévisions › Bulletin de la zone (en mer)',
  },
  {
    id: 'wx-mf-marine',
    label: 'Bulletins Météo Spéciaux (BMS)',
    url: 'https://meteofrance.com/meteo-marine',
    where: 'Météo › Prévisions (en mer)',
  },
  {
    id: 'wx-bms-manche',
    label: 'BMS côte Cap de la Hague – Penmarc’h',
    url: 'https://meteofrance.com/meteo-marine/cap-de-la-hague-penmarc-h/BMSCOTE-01-03',
    where: 'Météo › Prévisions (Manche et Atlantique)',
  },
  {
    id: 'wx-bms-provence',
    label: 'BMS côte Port-Camargue – Saint-Raphaël',
    url: 'https://meteofrance.com/meteo-marine/port-camargue-saint-raphael/BMSCOTE-02-02',
    where: 'Météo › Prévisions (Méditerranée)',
  },
  {
    id: 'wx-shom-marees',
    label: 'Marées du SHOM (heures, hauteurs, coefficients)',
    url: 'https://maree.shom.fr/',
    where: 'Météo › Prévisions (Manche et Atlantique)',
  },
  {
    id: 'blitzortung',
    label: 'Carte Blitzortung (à regarder)',
    url: 'https://map.blitzortung.org/',
    where: 'Météo › Alerte orage',
  },
  {
    id: 'map-arcgis-leman',
    label: 'Carte ArcGIS du Léman',
    url: 'https://www.arcgis.com/apps/instant/sidebar/index.html?appid=37cabc11c62a446faa17e32a035850c0&locale=fr&center=6.5218;46.366&level=10',
    where: 'data › Cartes',
  },
  {
    id: 'docs-arcgis-leman',
    label: 'Carte interactive du Léman (ArcGIS)',
    url: 'https://www.arcgis.com/apps/instant/sidebar/index.html?appid=37cabc11c62a446faa17e32a035850c0&locale=fr&center=6.5218;46.366&level=10',
    where: 'data › Règles du Léman et documents obligatoires à bord',
  },
  {
    id: 'moncvnautique',
    label: 'Mon CV Nautique (expérience en mer)',
    url: 'https://moncvnautique.com/',
    where: 'data › Sites internet',
  },
];

/**
 * A site of the list.
 * @param id - Its key.
 * @returns The site, or undefined.
 */
export function siteDef(id: string): SiteDef | undefined {
  return SITES.find((site) => site.id === id);
}

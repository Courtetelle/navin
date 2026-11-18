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
 * listed (data › Sites Internet changes them).
 */
export const SITES: readonly SiteDef[] = [
  {
    id: 'wx-meteoswiss',
    label: 'Alertes MeteoSwiss',
    url: 'https://www.meteosuisse.admin.ch/meteo/dangers.html',
    where: 'Météo › Prévisions (sur un lac)',
  },
  {
    id: 'wx-mf-marine',
    label: 'Bulletins Météo Spéciaux (BMS)',
    url: 'https://meteofrance.com/meteo-marine',
    where: 'Météo › Prévisions (en mer)',
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
    where: 'data › Documents obligatoires à bord',
  },
  {
    id: 'moncvnautique',
    label: 'Mon CV Nautique (expérience en mer)',
    url: 'https://moncvnautique.com/',
    where: 'data › Sites Internet',
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

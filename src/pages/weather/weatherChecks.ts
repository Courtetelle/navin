/** One step of the weather check before leaving. */
export interface WeatherCheck {
  id: string;
  text: string;
}

/**
 * The weather checks before leaving, for the lake or the sea.
 * @param lake - On a lake.
 * @returns The steps, in order.
 */
export function weatherChecks(lake: boolean): WeatherCheck[] {
  return [
    {
      id: 'forecast',
      text: 'Prévision lue jusqu’à l’heure de retour : vent, rafales, orages',
    },
    lake
      ? {
          id: 'warnings',
          text: 'Avis de vent fort ou de tempête : alertes MeteoSwiss et feux du lac vérifiés',
        }
      : {
          id: 'warnings',
          text: 'Bulletin météo marine et avis de grand frais ou de coup de vent (BMS) vérifiés',
        },
    {
      id: 'live',
      text: 'Live météo : le vent mesuré autour correspond à la prévision',
    },
    lake
      ? {
          id: 'storms',
          text: 'Orages et rafales descendantes : rien d’annoncé, ou repli prévu',
        }
      : {
          id: 'sea',
          text: 'État de la mer, houle et courants compatibles avec la route',
        },
    {
      id: 'boat',
      text: 'Vent et mer compatibles avec le bateau et l’équipage : ris prévus, seuils d’alerte réglés',
    },
    {
      id: 'refuge',
      text: 'Abri de repli choisi, heure de retour fixée et donnée à terre',
    },
  ];
}

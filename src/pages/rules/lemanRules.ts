/** Lake Geneva rules: section title, items (offline memo; sources in the page footer). */
export const LEMAN_RULES: ReadonlyArray<readonly [string, readonly string[]]> =
  [
    [
      '🪪 Avant de partir',
      [
        'Permis : obligatoire au-delà de 15 m² de voilure (catégorie D) ou de 6 kW de moteur (catégorie A). Savannah (45 m², 13,3 kW) : permis D pour naviguer à la voile, permis A pour naviguer au moteur (ONI art. 78-79).',
        'Documents à bord, à présenter sur demande : permis de navigation du bateau et permis de conduire (ONI art. 8). Côté français, avoir aussi le RNL et les règlements de police (papier ou smartphone).',
        'Au maximum 8 personnes sur le Savannah (permis de navigation). Enfants de moins de 12 ans : 3 enfants comptent pour 2 adultes (ONI art. 7).',
        'Un gilet de sauvetage par personne à bord, d’au moins 75 N avec col. Pour les enfants de moins de 12 ans, un gilet adapté avec col (ONI art. 134).',
        'Voilier de plus de 15 m² : en plus, une bouée à lancer d’au moins 75 N avec une drisse flottante d’au moins 10 m (ONI art. 134 al. 5).',
        'Équipement minimum : ancre avec corde ou chaîne, cordages, seau, gaffe, pavillon de détresse, klaxon ou corne, et une rame ou une pagaie si le bateau peut être mû ou gouverné ainsi (ONI annexe 15).',
        'Alcool : interdiction de conduire dès 0,5 ‰ dans le sang (0,25 mg/l dans l’air expiré). À partir de 0,8 ‰, l’ivresse est qualifiée. Les stupéfiants sont aussi interdits (ONI art. 40a).',
        'Le conducteur est responsable du respect des règles. Équipiers et passagers suivent ses ordres (ONI art. 3-4).',
      ],
    ],
    [
      '🌬 Météo et feux d’avis de tempête',
      [
        'Avis de fort vent (prudence) : feu orange à environ 40 éclats/min. Rafales de 25 à 33 nœuds (46 à 61 km/h) attendues, sans heure précise. Rejoindre un abri (ONI art. 40).',
        'Avis de tempête : feu orange à environ 90 éclats/min. Rafales de plus de 33 nœuds (61 km/h). Retour au port urgent (ONI art. 40).',
        'Il y a 23 feux autour du lac, commandés par MétéoSuisse. Les vagues peuvent atteindre 1,70 m (SISL).',
        'Bise (nord-est) : vent de beau temps, froid et sec. Une fois établie, elle souffle en rafales sans interruption.',
        'Joran (nord-ouest, depuis le Jura) : imprévisible, avec de fortes rafales dès le début. Il est souvent annoncé par de gros cumulus noirs sur le Jura et une baisse rapide de la température.',
        'Vaudaire (sud-est, Haut-Lac) : soudaine et violente, souvent liée aux orages en été.',
        'Vent (sud-ouest à ouest) : il annonce les dépressions.',
        'Bornan (surtout entre Rolle et Lutry) et môlan (Petit-Lac) : rafales soudaines qui descendent des montagnes, surtout par forte chaleur.',
        'L’eau peut descendre à 6 °C : le froid rend toute chute à l’eau dangereuse.',
      ],
    ],
    [
      '⚓ Priorités et règles de route',
      [
        'Tout bateau s’écarte, dans l’ordre : des bateaux prioritaires (ballon vert le jour, feu vert la nuit, par exemple la CGN), puis des bateaux à marchandises, puis des pêcheurs professionnels signalés, puis des voiliers. Les bateaux à moteur s’écartent aussi des bateaux à rames (ONI art. 44).',
        'Les bateaux en service régulier, comme la CGN, sont toujours prioritaires. Dégager leur route et ne pas gêner leurs manœuvres aux débarcadères (ONI art. 42a, 44, 52).',
        'Entre voiliers : celui qui reçoit le vent de bâbord s’écarte. Si les deux ont le vent du même bord, celui qui est au vent s’écarte (ONI art. 47).',
        'Au moteur, le Savannah est un bateau à moteur. Si les routes se croisent, celui qui voit l’autre sur tribord s’écarte. Face à face, chacun passe bâbord contre bâbord. Le bateau qui rattrape l’autre s’écarte (ONI art. 45-46).',
        'Distances : au moins 50 m des pêcheurs professionnels signalés et des convois remorqués, et 200 m si on passe derrière un pêcheur. Au moins 50 m d’un pavillon de plongée « A » blanc et bleu (ONI art. 48-49).',
        'Un bateau qui balance un pavillon ou un feu rouge est incapable de manœuvrer : il faut l’éviter (ONI art. 51).',
        'Au port, le bateau qui sort est prioritaire sur celui qui entre (ONI art. 52).',
      ],
    ],
    [
      '🏖 Près des rives',
      [
        'La zone riveraine intérieure va jusqu’à 150 m de la rive. La zone extérieure va de 150 à 300 m, mesurés depuis la rive, les roselières ou les constructions dans l’eau.',
        'Au moteur : 10 km/h au maximum à moins de 300 m de la rive. Dans les 150 m, on passe seulement pour accoster, partir ou stationner, et par le chemin le plus court (ONI art. 53, RNL).',
        'Il est interdit d’entrer dans les roseaux, les joncs et les nénuphars. Garder en général 25 m de distance (ONI art. 53).',
        'Les bouées jaunes délimitent des zones interdites à la navigation (baignade, réserves).',
        'La baignade est interdite à moins de 100 m de l’entrée d’un port ou d’un débarcadère de la CGN (ONI art. 77).',
      ],
    ],
    [
      '🌙 Mouillage et nuit',
      [
        'Mouiller ou s’amarrer sans gêner la navigation, jamais dans la végétation aquatique (25 m) ni près des filets de pêche signalés (ONI art. 59).',
        'Hors des places autorisées, on ne laisse pas un bateau plus de 24 h sans personne à bord (ONI art. 59).',
        'Côté français : pas de nuit au mouillage, pas d’ancrage sur les herbiers, et les bouées sont réservées à leurs titulaires (préfecture de Haute-Savoie).',
        'De nuit, un bateau au mouillage hors d’une place autorisée porte un feu blanc visible de tous les côtés (ONI art. 26).',
        'De nuit, à la voile seule : feux de côté et feu de poupe, ou feu tricolore en tête de mât. Au moteur : feux d’un bateau motorisé, c’est-à-dire feu de mât blanc, feux de côté et feu de poupe (ONI art. 24-25).',
      ],
    ],
    [
      '📣 Signaux sonores et détresse',
      [
        '1 son bref : je viens sur tribord. 2 sons brefs : je viens sur bâbord. 3 sons brefs : je bats en arrière. 4 sons brefs : je suis incapable de manœuvrer (RNL).',
        'Une série de sons très brefs signale un danger imminent d’abordage (RNL).',
        'Détresse : agiter un pavillon rouge en cercle, tirer des fusées rouges, émettre des sons prolongés répétés ou SOS (· · · – – – · · ·) en lumineux, ou lever et baisser lentement les bras tendus (ONI art. 58).',
      ],
    ],
    [
      '🚑 Accident',
      [
        'Porter secours aux personnes en danger si cela ne met pas son propre bateau en danger (ONI art. 12).',
        'S’il y a des blessés, des morts ou des disparus, avertir la police sans délai : 117 en Suisse, 112 partout. Pour une ambulance, 144. Pour l’hélicoptère, Rega 1414.',
        'En cas de dégâts matériels, prévenir le lésé dès que possible et rester disponible pour le constat (ONI art. 12).',
        'Savannah : noter l’incident dans la fiche du jour. Pour la franchise de CHF 500, voir Bateau et croisière › Règlement.',
      ],
    ],
    [
      '🇫🇷 Côté France et douane',
      [
        'La frontière passe au milieu du lac. Tous les passagers doivent avoir des papiers d’identité valables, même sans escale (OFDF).',
        'Retour en Suisse : les achats sous la franchise de CHF 150, ou déclarés avec l’app QuickZoll, passent sans formalité. Sinon, il faut s’arrêter dans un débarcadère douanier : Lausanne-Ouchy, Genève ou Hermance (OFDF).',
        'Renseignements douane : +41 58 467 15 15.',
        'Moule quagga : nettoyer et rincer la coque et le matériel avant d’aller sur un autre lac.',
      ],
    ],
    [
      '🤝 Location',
      [
        'Un bateau qui demande un permis ne se loue qu’à une personne qui présente ce permis (ONI art. 158).',
        'Le loueur signale les endroits dangereux, les particularités locales et les règles importantes (ONI art. 159).',
      ],
    ],
  ];

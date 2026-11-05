# NavIn (anciennement « Livre de bord ») — appli mobile

Appli web installable (PWA) pour tenir le livre de bord sur téléphone, pensée pour la mer :
grands boutons, fort contraste (mode jour plein soleil / mode nuit rouge), saisie quasi sans clavier,
fonctionnement sans réseau, données gardées uniquement sur le téléphone.

Aucun outil à installer : ce sont de simples fichiers (HTML, CSS, JavaScript). Une fois en ligne,
l'appli est totalement autonome : on y crée ses croisières, son bateau, son équipage, sans aide extérieure.

## Mettre en ligne sur Netlify (5 minutes, gratuit)

### Méthode simple : glisser-déposer
1. Créez un compte sur https://app.netlify.com (gratuit).
2. Ouvrez https://app.netlify.com/drop
3. Glissez le fichier `livre-de-bord.zip` (ou le dossier décompressé) dans la zone.
4. Netlify donne une adresse du type `https://xxxx.netlify.app`. Renommez-la si vous voulez
   dans *Site configuration › Change site name* (ex. `livre-de-bord-corban.netlify.app`).
5. Pour publier une nouvelle version : *Deploys* › glisser à nouveau le zip.
   Les données déjà saisies sur les téléphones sont conservées.

### Méthode automatique (avec GitHub)
1. Mettez ce dossier dans un dépôt GitHub.
2. Netlify › *Add new site › Import an existing project* › choisir le dépôt.
3. Commande de build vide, dossier de publication `.` (déjà réglé dans `netlify.toml`).

## Installer sur le téléphone (au port, avec du réseau)
Adresse : https://livredebord.netlify.app — le guide pas à pas est aussi dans l'appli (roue dentée ⚙︎ en haut).
- **iPhone (Safari)** : ouvrir l'adresse › Partager ⬆︎ › « Sur l'écran d'accueil » › « Ajouter ».
  Ouvrir ensuite toujours par l'icône (les données de l'appli installée sont séparées de Safari).
- **Android (Chrome)** : ouvrir l'adresse › menu ⋮ › « Installer l'application » › « Installer ».

Ouvrez l'appli une fois avec du réseau : elle fonctionne ensuite sans connexion.
Autorisez la localisation (le GPS du téléphone marche sans réseau).

## Les écrans
- **Saisir** : entrée du tableau horaire (heure, chef de quart, loch, position GPS, SOG, HDG, COG, allure,
  AWA, régime moteur, visibilité E/TB/B/M/F/TF, TWD, TWS, état de la mer Douglas, direction des vagues,
  baromètre, voiles, événements, observations). Chaque entrée reprend les valeurs de la précédente.
  Bouton « Vent, mer et baro du modèle météo » quand il y a du réseau.
- **Journal automatique** (en haut de Saisir) : « Départ » lance le suivi GPS. L'appli crée seule une entrée
  au départ, à chaque changement de cap durable, à intervalle régulier (60 min par défaut) et à l'arrivée,
  avec position, route fond, vitesse, loch GPS, puis vent / mer / baro du modèle Open-Meteo dès qu'il y a
  du réseau. On complète ensuite (voiles, quart, remarques) d'un geste depuis le Journal.
  Le livre ne garde qu'un petit nombre d'entrées entre départ et arrivée, choisies à l'arrivée :
  environ une par heure au plus (moins si la navigation est longue), de préférence aux changements de cap
  ou d'allure. La durée de navigation du jour s'affiche dans le Journal, la fiche Journée et le PDF. Navigateur et skipper signent au doigt en bas de la fiche Journée.
  ⚠ Le téléphone doit rester allumé avec l'appli ouverte (l'écran est maintenu allumé) : un navigateur
  ne peut pas suivre le GPS en arrière-plan. En cas d'interruption, « Reprendre » relance le suivi.
- **Journée** : prévisions météo, route prévue (ETD, ETA, lever / coucher), moteur et carburant (calculs
  automatiques), milles du jour et cumulés, contrôles à cocher, marées, quarts, escale, debriefing, signatures.
- **Journal** : toutes les entrées par jour ; les entrées automatiques sont marquées « auto ».
- **SOS** : messages MAYDAY, PAN PAN, SÉCURITÉ, annulation et consultation médicale pré-remplis
  (nom du bateau, indicatif épelé, MMSI, dernière position, heure UTC, personnes à bord) ; procédure ASN ;
  numéros utiles en un geste ; canaux bateau à bateau ; alphabet et vocabulaire radio.
- **Vent** : partout en nœuds et en Beaufort, avec les km/h en petit (saisie, journal, journée, météo du lac, alertes,
  carte, PDF). L'export CSV garde les nœuds seuls.
- **Traceur** (lac : Saisir › 🧭 Traceur, ou Plus) : carte suisse avec la trace qui se dessine en direct, flèche du bateau
  orientée au cap, vitesse (nd et km/h), cap fond, milles, durée, vitesse max ; Départ / Point / Arrivée pilotent le journal
  automatique, donc la trace reste dans le journal. « Mes traces sur le lac » liste toutes les sorties tracées (milles,
  durée, max), les affiche en violet sur la carte et les exporte en GPX.
- **Carte du Léman** (Plus › Carte du Léman) : carte nationale suisse swisstopo (profondeurs du lac, zoom jusqu'au 19)
  avec le balisage OpenSeaMap, choix du fond (bouton calques), position GPS suivie en continu avec vitesse et précision.
  « Garder la carte du Léman hors ligne » télécharge le lac jusqu'au zoom 14 (≈ 1 500 tuiles) ; les zooms plus fins
  restent en cache une fois vus. Si swisstopo ne répond pas, le plan OpenStreetMap prend le relais.
- Lien vers la carte interactive du Léman (ArcGIS, en ligne) sur la carte du Léman et la page des documents.
- **Documents obligatoires à bord** (Plus, sur le lac) : liste du port de Sciez (permis, titre de navigation, RPP, RGP,
  accord franco-suisse) ; les PDF officiels s'ouvrent en ligne ou se gardent dans l'appli (IndexedDB 'ldb-docs') pour être
  lus sans réseau ; photo ou PDF du permis et de la carte grise. Les documents restent sur le téléphone seulement.
- **À bord** (croisières en mer et sur le lac, Plus › À bord) : tournus des tâches d'après le nombre de personnes (liste
  d'équipage, ou compteur) ; modèle de départ = plan des tâches journalières pour 8 équipiers (petit déjeuner, midi, soir
  à 2, contrôle propreté et technique à 1). Chaque jour, chacun avance d'une tâche ; jour d'arrivée à partir du repas du
  soir, jour du départ jusqu'au petit déjeuner puis nettoyage par tout l'équipage. Carte du jour avec cases « fait »,
  remplacement d'un équipier d'un toucher, plan complet. « Modifier le modèle » : tâches, nombre de personnes, rôles,
  premier et dernier jour, consignes (ldb.taskTpl, compris dans la sauvegarde).
- **Briefing sécurité** : check-list de 13 points (toilettes, gilets, harnais, chaussures, winchs, pare-battages, gaz, four,
  feu, homme à la mer, VHF, pompe de cale, nœuds), chaque point avec l'action à faire en petit. Ajoutée une fois à chaque
  bateau et croisière (catégories Sécurité, Check-in) et gardée comme base ; modifiable ou supprimable comme les autres.
  Les points peuvent porter une précision (champ « Action, précision »).
- **Prise du bateau en mer** : le modèle reprend les 25 points de la fiche « Prise en main du bateau et contrôles avant
  navigation » (version du 20.02.2025), en remplaçant 5 points d'origine trop courts ; aussi gardés comme base « Prise en
  main du bateau » pour compléter une croisière déjà ouverte.
- **Check-lists nommées et catégories** : en plus des listes de prise et de fin, on crée des listes libres (ex. Avitaillement),
  chacune avec un nom et plusieurs catégories (Check-in, Check-out, Croisière, Léman, Avitaillement…, ou les siennes) ; des
  puces filtrent les listes par catégorie. **Bases** (Plus › Bases de check-list) : listes modèles gardées dans le téléphone,
  à modifier, compléter ou effacer ; « Enregistrer comme base » depuis une liste, « Nouvelle liste » ou « Ajouter les points
  d'une base » pour les reprendre. Les bases font partie de la sauvegarde et de la synchro.
- **Alphabet phonétique** (pages SOS, VHF et Plus) : grandes cases Alfa… Zulu et chiffres, avec la prononciation, et une
  case pour épeler un mot (nom du bateau par défaut).
- Sur le lac (journée et croisière), la page SOS garde la position GPS, les numéros utiles, l'équipage et l'alphabet, sans messages radio, identité radio, canaux ni appels VHF.
  Quand la position est côté français du Léman (frontière approximative au milieu du lac), les urgences françaises
  (112, 18, 17, 15, 114) s'affichent en premier, puis les numéros suisses.
- **Homme à la mer** (page SOS, mer et lac) : deux procédures rédigées par Corban, « Cas réel » et « Entraînement ».
  Étapes communes (crier, un ou deux pointeurs, bouée, MOB), puis les options du barreur selon l'allure (au près, au
  portant sous génois, au portant sous spi asymétrique), la méthode d'urgence absolue (victime inconsciente : voile ou
  filet hissé à la drisse), la règle d'or sur l'hypothermie, puis l'alerte si la personne est perdue de vue. Bouton « Noter la
  position MOB » (entrée au journal) et MAYDAY prérempli en mer. « Modifier la procédure » : sections (dont les options
  d'allure) et étapes à renommer, détailler, déplacer, ajouter ou supprimer (ldb.mob2, compris dans la sauvegarde).
- **VHF** (bouton sur la page SOS) : catalogue d'appels de routine bilingues anglais/français (essai radio, place au port,
  entrée de port, bouée, carburant, navire à navire, intentions d'un navire, météo, avis de départ, pont/écluse), pré-remplis
  avec le bateau, l'indicatif, le MMSI, les dimensions, la position, l'équipage, la destination et l'ETA du jour ;
  la station appelée (port le plus proche par défaut), le canal, les nuits et l'ETA se modifient sur place.
  La page montre aussi un exemple complet d'appel du 16 vers un canal de travail (72) et la liste des canaux habituels.
- **Plus** : croisières (nouvelle, changer, supprimer), bateau et croisière, équipage, PDF, fichiers, réglages.

## Tablette
Sur une tablette (iPad, Android), l'appli tourne dans les deux sens : les cartes de saisie se placent sur
2 ou 3 colonnes, le journal et la fiche Journée aussi, et en paysage les onglets passent sur le côté gauche.
La signature fonctionne au doigt ou au stylet (Apple Pencil, S Pen) ; avec un stylet, la main posée est ignorée.

## Icône et sauvegarde complète (roue dentée ⚙︎)
- Choisir l'icône (compas, voilier, ancre, barre, livre, nuit) avant d'ajouter l'appli à l'écran d'accueil.
- « Exporter toutes les données » : un seul fichier avec toutes les croisières, traces, signatures et réglages.
  Sur un autre appareil : installer l'appli, roue dentée › « Récupérer des données ». Rien n'est effacé.

## Trois modes : mer, lac à la journée, lac en croisière
*Plus › Mes navigations* : on choisit le mode, puis on crée ou rouvre une navigation de ce mode.
- **Croisière en mer** (location à la semaine) : check-lists « Prise du bateau » et « Restitution », propres à la croisière (modèle repris à chaque nouvelle croisière).
- **Lac · journée** : Entraînement ou Location au départ ; check-lists « Arrivée à bord » (avec relevés heures moteur, carburant %, 2 batteries V, eau %) et « Quitter le bateau », cochées chaque jour.
- **Lac · croisière** (plusieurs jours) : check-lists « Arrivée à bord » et « Fin de croisière » du bateau.
- Dans chaque check-list : une case **Constat** (texte ou dictée par le micro du clavier) et des **photos** (gardées dans le téléphone, IndexedDB).
- Check-lists : 1 appui = rouge (pas fait : valeur, photo ; les rouges descendent en bas de liste après 4 s, une fois la saisie finie), 2 appuis rapides = vert 3 s puis « Déjà fait », 3e appui pendant ces 3 s = remis à blanc, données effacées. Dans « Déjà fait », un appui long remet le point à son origine (blanc, valeur et photos effacées, v52). Un point peut demander une valeur (%, V, h, L, nombre) dans « Modifier la liste ».
- *Saisir › En navigation* : Moteur et Voile sont deux interrupteurs (les deux allumés = voile + moteur ; au moteur seul, pas d'allure ni de voiles ; voile + moteur, les voiles sans l'allure), allure, grand-voile et voile d'avant (liste du bateau, champ « Voiles d'avant à bord »), baignade (lac), photo, **Eaux noires vidées** (sur appui uniquement).
- Fiche du jour : extrait du journal ou **journal complet** (saisies, événements, points auto à chaque virage de 20° ou au plus tous les 15 min), photos ; format Image, PDF ou les deux.

## Nom automatique des sorties
[année][n° de la sortie dans l'année][plan d'eau][c si croisière]_[bateau] [port de départ] [jour] [j/m], ex. `2607L_Savannah Morges JE 9/7`, `2609Ac_Inspiration St-Malo SA 11/7` (le « c » minuscule après la zone depuis v70 ; les noms déjà créés ne changent pas).
Plan d'eau : L Léman, M Méditerranée, A Atlantique/Manche, N mer du Nord, X autre. Le port de départ vient du GPS (liste de ports intégrée, sans réseau ; avec réseau, nom de la commune sinon). Le nom reste modifiable à la création et dans « Bateau et croisière ».

## Plusieurs croisières
Chaque croisière a son journal, ses journées, son équipage et sa trace.
On peut reprendre le bateau, les numéros utiles et (au choix) l'équipage de la croisière en cours.

## Sorties lacustres, bateaux et check-lists

À la création, choisissez « ⛵ Croisière en mer » ou « 🏞 Sortie lacustre ».

- **Sortie lacustre** : choisissez le bateau dans « Mes bateaux ». Le Savannah est déjà enregistré avec les données de sa carte grise et de son certificat de construction, ainsi que le règlement de franchise. Sur un lac, il n'y a ni marées ni vagues, mais les feux d’avis de tempête et les numéros d’urgence suisses.
- **Check-lists** (Plus) : « Avant de larguer » et « Quitter le bateau ». Un point touché passe au vert puis disparaît. « Déjà fait » sert à annuler, et « Modifier la liste » à ajouter, renommer, réordonner ou supprimer des points. Les listes appartiennent au bateau.
- **Journée** : pour une sortie lacustre, c'est le livre de bord simplifié du Savannah. La date, le type de sortie, le responsable, l'équipage, les heures de départ et de retour, les milles (trace GPS) et les heures moteur de début se remplissent seuls. Une valeur corrigée à la main n'est plus remplacée.
- **Fiche du jour** : on coche ce qu’on veut communiquer (informations, trace sur carte, observations, check-lists, tarifs). Résumé noir sur blanc, à envoyer en image dans le groupe WhatsApp, en PDF ou par capture d’écran. Pour une location, elle affiche la franchise, le montant et les tarifs (rubrique « Location et règlement du bateau »).
- **Règles du Léman** (Plus) : aide-mémoire hors ligne tiré de l’ONI, du RNL et de sources officielles.
- **Mes bateaux** (Plus) : ajouter, modifier ou supprimer des bateaux. Pour chaque bateau, « Rubriques » permet d’ajouter des rubriques, de masquer celles qui ne servent pas et de copier la structure d’un autre bateau. On peut aussi copier les check-lists d’un bateau à l’autre.
- **Équipage** (sortie lacustre) : un carnet de membres (prénom, nom, téléphone) gardé sur le téléphone. D’un clic, on met un membre à bord. On choisit ensuite le responsable et le co-skipper, et le téléphone de chacun devient un bouton d’appel.
- **Location** : avec le type « Location », le montant se calcule d’après les tarifs du bateau, le jour et l’heure de départ.
- **Trace sur le lac** : uniquement par le GPS du téléphone (Saisir › Départ). L’import GPX est réservé aux croisières en mer.
- **Boutons du lac** (Saisir) : Moteur, Voile, Baignade et Retour de baignade. Chacun est noté au journal avec l’heure et la position GPS, et la fiche du jour affiche le temps au moteur et les baignades.
- **Extrait du journal** (fiche du jour) : le départ, l’arrivée et quelques entrées. Sortie courte : 2 par heure ; dès 3 heures : 1 par heure. Les saisies manuelles passent avant les changements de cap automatiques.
- **Cumul sur le lac** (Plus) : milles, heures de navigation et nombre de sorties par semaine, mois ou année, pour tous les bateaux, un seul ou plusieurs.
- Carnet de membres et bateaux sont inclus dans la sauvegarde complète.

## Carte
*Journal › 🗺* ou *Plus › Carte* : la trace (suivi GPS ou GPX importé) et les entrées sur fond OpenStreetMap
avec le balisage OpenSeaMap, jour par jour ou toute la croisière. Toucher un point affiche l'entrée.
Le fond de carte demande du réseau ; les zones déjà affichées restent disponibles hors ligne.

## PDF et impression
*Plus › PDF / impression* : cochez les pages (titre, fiche technique, équipage, sécurité, messages radio,
chaque journée, page vierge de secours), puis « Créer le PDF » et choisissez « Enregistrer en PDF ».

## Traces NavimetriX, Navionics, etc.
Avec NavimetriX, la trace GPX contient aussi la vitesse fond, la route fond et le vent réel (TWD, TWS) :
le livre les reprend directement, repère les virements et empannages (le vent change de bord) et les
changements d'allure ; seuls la mer et le baromètre viennent alors du modèle météo.

*Plus › Échanges de fichiers › Importer une trace GPX* : exportez la trace en GPX depuis l'appli de navigation,
choisissez le fichier ; le livre crée les entrées (départ, arrivée et environ une par heure entre les deux, avec
un départ / arrivée séparé si la trace contient une escale de plus de 45 min) et y ajoute la météo du modèle.
La trace enregistrée par le suivi automatique s'exporte aussi en GPX.

**En mer avec NavimetriX au premier plan** : passez brièvement dans le livre pour toucher Moteur, Voile,
allure ou un évènement (ils sont horodatés). À l'import GPX en fin de journée, ces entrées notées à la main
sont complétées par la position, la vitesse, le cap et le vent de la trace (point le plus proche à 3 min près).

## Météo du lac (MeteoSwiss)
- *Saisir* (lac) : carte « Météo MeteoSwiss » : mesure de la station SwissMetNet la plus proche (données ouvertes, 10 min, ≤ 25 km), prévision des 8 prochaines heures du modèle MeteoSwiss ICON-CH1 (sinon CH2, sinon modèle européen) via Open-Meteo, avec risque d'orage (CAPE). Mise à jour toutes les 30 min avec du réseau. Source indiquée à chaque fois, aussi dans le journal et la fiche.
- Alertes de vent (carte météo) : stations MeteoSwiss à moins de 30 km et sous 800 m d'altitude, contrôle toutes les 5 min. Seuils sur rafales (ou vent moyen) : 10 nd 1 long, 15 1 long 1 court, 20 2 longs, 25 2 longs 1 court, 30 3 longs…, de plus en plus fort, écran qui clignote au même rythme, rappel toutes les 15 min. Appli ouverte et écran allumé seulement. Chaque alerte est notée au journal.
- Les entrées du journal au lac prennent le vent mesuré par la station quand il existe pour ce moment, sinon la prévision.

## Hors ligne et synchro entre appareils
- Après une première ouverture avec du réseau (depuis l'icône de l'écran d'accueil), toute l'appli est dans l'appareil : elle marche en mode avion. ⚙︎ › « Hors ligne » le confirme.
- Internet ne sert qu'à la météo du modèle, aux fonds de carte jamais vus (ceux déjà vus sont gardés, jusqu'à 4000 tuiles) et aux mises à jour.
- ⚙︎ › « Synchroniser téléphone et tablette » : Envoyer (AirDrop, sans Internet) puis Recevoir sur l'autre appareil, et l'inverse. Entrées des deux côtés gardées, suppressions suivies, sinon la modification la plus récente gagne. Photos comprises au choix.

## Sauvegarde
Les données sont stockées dans le navigateur du téléphone. *Plus › Échanges de fichiers › Sauvegarder
la croisière* produit un fichier à garder (mail, cloud) ; « Restaurer » le recharge sur un autre téléphone.
Données personnelles de l'équipage : elles ne quittent jamais le téléphone, sauf si vous exportez.

## Modifier les rubriques
Les rubriques sont décrites en haut de `app.js` (`FIELDS`, `DAY_SECTIONS`, `INFO_SECTIONS`, `CREW_FIELDS`).
Le suivi GPS, l'import GPX et la météo sont dans `auto.js`.

## Fiches équipage (v49)
Chaque personne a une fiche réutilisable, selon le modèle de liste d'équipage : prénom et nom obligatoires, tout le reste facultatif (téléphone, naissance, nationalité, pièce d'identité, permis, VHF, courriel, adresse, proche, santé). Les fiches sont gardées sur le téléphone seulement (ldb.members) et incluses dans la sauvegarde/synchronisation. Pour chaque navigation (mer ou lac), Plus › Équipage : on touche les noms pour les mettre à bord, puis on choisit la fonction. La navigation garde une copie des infos (liste d'équipage imprimable, SOS). Les anciennes listes saisies à la main deviennent des fiches automatiquement.

## Carte vectorielle du Léman (v50, chart.js)
Carte › « Balises et ports du Léman (OpenStreetMap) » : une fois avec du réseau, l'app interroge l'API Overpass (seamark:type, leisure=marina, jetées/brise-lames) sur l'emprise du Léman, garde le résultat dans IndexedDB (ldb-docs, clé leman-osm) et le dessine en vectoriel (canvas) : feux et bouées colorés, ports ⚓, jetées, zones réglementées en pointillé, popups avec nom et caractéristique du feu. Calque optionnel « Relief du fond (swissBATHY3D) » (ombrage WMTS swisstopo, non vérifié). Isobathes vectorielles et couches cantonales : à produire hors de l'app (grille 2 m trop lourde pour un téléphone).

## Préparer sans navigation ouverte (v51)
Sans croisière ni sortie ouverte, l'onglet Plus devient « Préparer à l'avance » : bases de check-list, bateaux et leurs check-lists, fiches équipage, modèle des tâches à bord, procédures homme à la mer, règles du Léman, documents, alphabet, réglages (NO_CRUISE_VIEWS dans app.js). Les onglets Saisir, Journée, Journal et SOS renvoient toujours vers Mes navigations.

## Couleurs des flashs de vent (v53)
Chaque tranche d'alerte a sa couleur (WIND_FLASH dans lake.js) : 10/15 nd bleu clair/foncé, 20/25 vert clair/foncé, 30/35 jaune clair/foncé, 40/45 rouge clair/foncé, 50/55 nd et plus violet clair/foncé. Légende sous les alertes, l'essai joue toutes les tranches.
Son des alertes (v54) : sur iPhone, un fichier audio silencieux joué en boucle garde la sortie son ouverte (débloquée au premier toucher quand les alertes sont actives) ; si le contexte audio est suspendu, il est relancé avant chaque signal.

## Téléphones au format international (v55)
Dans les fiches équipage, le téléphone et le numéro du proche sont toujours remis au format international à la sortie du champ et à l'enregistrement : 00… devient +…, un numéro national 0… prend +41 par défaut, groupes de chiffres selon le pays (CH, FR, IT, DE, AT, UK, BE, LU, HR). Les fiches existantes ont été converties une fois (ldb.membersIntl).

## Mode édition des boutons (v56, ui-edit.js)
Réglages › « Activer le mode édition » : chaque bouton (y compris les onglets du bas) s'entoure d'orange ; un toucher ouvre l'éditeur au lieu de l'action : texte du bouton, petit texte, taille (petit à très grand), texte long (retour à la ligne, une ligne coupée, déroulant : défile une fois à l'affichage puis à chaque effleurement, v58). « Terminer » quitte le mode. Les changements sont gardés dans ldb.uiEdits (clé = vue + identifiant ou action du bouton), inclus dans la sauvegarde complète, exportables en JSON (« Exporter les modifications », kind ui-edits) pour être intégrés dans les versions suivantes, importables, et réversibles (bouton par bouton ou tous).
Équipage du lac : les rôles s'appellent Skipper, Second, Équipier (plus Responsable / Co-skipper), aussi sur la fiche du jour.

## Liste d'équipage à envoyer (v57)
Équipage › « Liste d'équipage à envoyer » : 📸 Image (partage WhatsApp, une carte par personne) ou 🖨 PDF A4 paysage (tableau dans l'ordre du modèle Word de Corban, ligne de signature du skipper). « Infos à inclure » : choix des colonnes (settings.crewCols, le nom toujours inclus ; boutons Tout / Le minimum).

## Recueil des bateaux (v59)
Plus › « Recueil des bateaux » (aussi sans navigation ouverte) : une fiche par bateau avec toutes ses informations remplies (rubriques de « Mes bateaux ») et les photos de ses documents, classées : permis de navigation, carte grise / titre, assurance, fiche bateau / certificat, autre. Les bateaux des croisières en mer peuvent être ajoutés au recueil en un toucher. Envoi en image (WhatsApp) ou PDF A4 (informations, puis page des documents). Photos dans IndexedDB (ldb-photos), liste dans b.docs ; elles voyagent toujours dans le fichier de synchronisation.

## Log homme à la mer (v60)
Chaque action de la procédure se touche comme une check-list : 1 toucher = faite (vert, heure locale + UTC, position GPS), un nouveau toucher l'annule (noté « Annulé »). Le premier toucher (ou « Démarrer le log ») ouvre le log de l'incident et enregistre aussitôt la position MOB (aussi dans le journal) ; un cadre rouge affiche la position MOB, notre position mise à jour à chaque action, la distance et le relèvement vers la MOB. Allure choisie, position MOB, MAYDAY, « Personne récupérée » et « Fin du log » sont tracés. Log partageable en texte, logs précédents gardés (cruise.mobLogs, sinon ldb.mobLogs).

## Heures à double (v60)
Heure locale et heure UTC : horloge du haut, saisie, journal, impression, CSV (colonne Heure UTC), fiche du jour, log MOB.

## Carte et traceur en plein écran (v61)
Bouton ⛶ sous le zoom de la carte et du traceur : la carte prend tout l'écran (le tableau de bord du traceur reste en haut), ✕ revient au mode normal ; sortie automatique en changeant de vue. Sur iPad, le navigateur passe aussi en vrai plein écran.
Depuis v62, à l'écran les heures sont en UTC seulement ; un effleurement sur une heure (ou sur l'horloge du haut) affiche l'heure locale pendant 3 s. Impression, CSV, fiche du jour, log partagé et messages gardent les deux heures.

## Zones des rives et baignade sur la carte (v63)
Deux calques sur la carte vectorielle (chart.js), à cocher dans le sélecteur de calques : « Zones 150 m et 300 m des rives » (bandes tracées depuis le contour du lac OSM, trait orange à 300 m, rouge à 150 m ; un toucher sur l'eau près de la rive ouvre la règle de la zone) et « Baignade interdite (100 m des ports et débarcadères) » (cercles de 100 m autour des entrées de port, feux ou balises à moins de 200 m d'un port, et des débarcadères ferry_terminal ; un toucher ouvre la règle). Indicatif, selon OSM. Il faut retélécharger une fois « Données du Léman (OpenStreetMap) » pour obtenir le contour du lac et les débarcadères.

## Isobathes (v64)
Genève : courbes SITG « Courbes bathymétriques du lac » (LCE_COURBES_BATHYMETRIQUES, accès libre, modèle Institut Forel et SITG 2004), équidistance 1 m jusqu'à 71 m, couvrant seulement les eaux genevoises (Genève à Versoix/Hermance). Converties de LV95 en WGS84, simplifiées à 3 m, livrées dans data/isobathes-ge.json (hors ligne). Calque « Isobathes (courbes de profondeur, Genève) » : tous les 10 m au large, 5 m dès le zoom 13, 1 m dès le zoom 15, 1 à 3 m en orange, étiquettes. Un toucher sur l'eau (zoom 13+) donne la profondeur estimée entre les deux courbes voisines.
Vaud : calque « Isobathes Vaud (images, réseau) » depuis le WMS cantonal (ogc.vd.ch, transmis par Corban). Le téléphone lit le GetCapabilities et garde les couches dont le nom contient bathy / isobathe / profondeur (ldb.vdIsobath, 30 jours). Images vues gardées dans le cache des tuiles. Côté France : pas de courbes.
Hors ligne (v65) : « Garder la carte du Léman hors ligne » télécharge aussi les images WMS des isobathes vaudoises (zoom 10 à 15, eaux vaudoises, environ 2 500 images) quand la couche a été trouvée. Le service worker les garde même sans CORS (réponses opaques) et les retrouve par une clé normalisée (paramètres triés, cadre arrondi au mètre, tileKey dans sw.js).

## Courbes de 1 à 5 m calculées sur l'appareil (v66)
Carte (lac) › « Courbes 1 à 5 m (swissBATHY3D) » : choisir le fichier swissBATHY3D du Léman au format ESRI ASCII (.asc, décompressé ; plusieurs fichiers possibles). L'appli le lit en flux sur l'appareil (aucun envoi), prend la grille tous les 4 m, calcule les courbes de 1, 2, 3, 4 et 5 m (marching squares, cases sans donnée ignorées, profondeur = 372 m − altitude du fond, détection automatique si le fichier donne déjà des profondeurs), convertit LV95 en WGS84 (formules approchées swisstopo), simplifie à 3 m et garde le résultat dans IndexedDB (ldb-docs, clé bathy-asc). Les courbes s'ajoutent au calque des isobathes. « Envoyer les courbes à l'autre appareil » partage un JSON (kind bathy-asc) qu'on importe avec le même bouton. Utile surtout côté France, où swissBATHY3D couvre les bords jusqu'à environ 5 m.
v67 : le bouton accepte tout fichier (iPad grisait les .asc à cause du filtre accept) et lit le zip swissBATHY3D tel quel : répertoire central (zip64 compris), puis chaque .asc décompressé en flux (DecompressionStream deflate-raw, Safari 16.4+).

## Mode édition : naviguer (v67)
La barre du mode édition a un bouton « ➜ Naviguer » / « ✎ Modifier » : en navigation (barre bleue), les boutons marchent normalement pour aller jusqu'à la bonne page, puis « ✎ Modifier » revient au choix des boutons à modifier.

## Zones hors ligne (v68)
Carte › « Zones hors ligne » (aussi dans « Préparer à l'avance ») : on cadre la carte sur la zone de navigation, on choisit le détail (zoom 12 à 15), on nomme la zone et on télécharge le plan (données OpenStreetMap servies par CARTO Voyager, car les serveurs d'OpenStreetMap interdisent le téléchargement de zones) et le balisage OpenSeaMap (dès le zoom 9). Maximum 8 000 tuiles par couche et par zone. Tuiles dans un cache à part (livre-de-bord-zones), jamais vidé automatiquement ni à la mise à jour ; le service worker le consulte avant le cache des tuiles vues. Chaque zone peut être revue ou supprimée (les tuiles partagées avec une autre zone restent). Sur la carte, le fond « Plan des zones hors ligne » est choisi d'office quand la navigation est dans une zone. Zones dans ldb.zones.

## Textes coupés qui défilent (v68)
Le nom de la croisière en haut et tout texte que la feuille de style coupe (text-overflow: ellipsis) défilent comme les boutons « déroulant » : une fois à l'affichage (ou quand le texte change), puis à chaque effleurement (uiAutoRollAll dans ui-edit.js, classe ue-roll-auto).

## Zone Baltique (v69)
Noms de sortie : nouvelle zone B Baltique (Kattegat compris, devinée d'après le GPS entre 53,5° et 66° N, 9,5° et 31° E) et ports de la Baltique (Kiel, Warnemünde, Copenhague, Gdańsk, Visby, Stockholm, Mariehamn, Helsinki, Tallinn, Göteborg).

## Cartes des lacs intégrées (v71)
Plus de bouton « Garder la carte du Léman hors ligne » : la carte du Léman et celle du lac de Neuchâtel (carte nationale swisstopo jusqu'au zoom 14, balisage OpenSeaMap, et pour le Léman les isobathes vaudoises) se téléchargent toutes seules dès que l'appli a du réseau (6 s après l'ouverture, puis au retour du réseau, en reprenant là où elle s'était arrêtée), environ 6 800 tuiles (≈ 60 Mo), dans le cache des zones (livre-de-bord-zones) jamais vidé ; une suppression de zone personnelle garde ces tuiles. État dans ldb.lakesBase, affiché sous la carte (« intégrée » / « au prochain réseau »). Les tuiles ne peuvent pas être mises dans le zip : le serveur où l'appli est préparée n'a pas accès à swisstopo ni à OpenSeaMap. Téléchargement en CORS d'abord, réponse opaque seulement en secours (une réponse opaque pèse plusieurs Mo dans le quota du navigateur).

## Isobathes genevoises retirées (v72)
À la demande de Corban, data/isobathes-ge.json est retiré (le WMS vaudois donne les isobathes). Le calque « Isobathes (canton de Vaud) » est affiché d'office et ses images sont gardées sur tout le Léman (zoom 10 à 15, environ 5 000 images), au cas où le service vaudois couvre aussi Genève. Le calque vectoriel ne garde que les courbes 1 à 5 m calculées depuis swissBATHY3D.

## Le traceur, premier écran (v73)
Corban : « c'est la navigation qui drive toute l'appli ». L'appli s'ouvre sur le traceur (nouvel onglet « Traceur », le premier des 6), pour tous les modes et même sans navigation ouverte : position GPS, vitesse, cap, carte (swisstopo en Suisse, sinon plan des zones hors ligne ou OSM). Sous la carte : « Départ : enregistrer la trace » pour la navigation ouverte (puis Point / Arrivée), et « Démarrer une navigation » : Journée de nav (lac), Croisière (lac), Croisière (mer), qui ouvrent le formulaire de création au bon type ; « Mes navigations » pour en rouvrir une. Ouvrir une navigation ramène au traceur. « Mes traces » liste les traces de tous les modes. Une vue qui demande une navigation renvoie au traceur s'il n'y en a pas.

## NavIn (v74)
L'appli s'appelle NavIn (demande de Corban, 2026-10-31) : titre, nom sous l'icône, manifestes, partage, GPX. « Livre de bord » reste le nom du document (fiches, check-lists, impression). Les clés de stockage (ldb.*) et les caches (livre-de-bord-*) ne changent pas, pour garder les données et les cartes déjà téléchargées. Sur iPhone, le nouveau nom n'apparaît sous l'icône qu'après une réinstallation sur l'écran d'accueil.
v75 : le document s'appelle aussi NavIn : fiche du jour « NavIn · bateau », impression « NavIn · Journal de bord / Log book », fichiers exportés navin-…, trace GPX sans nom « NavIn », zip navin.zip. Les textes de l'association (règlement, check-lists « livre de bord à bord ») gardent leur mot, puisqu'ils parlent du carnet papier.

## Appui long sur la carte, Go to et marques (v76, marks.js)
Sur toutes les cartes (traceur, carte du journal, zones), un appui long d'un doigt (650 ms sans bouger, clic droit sur ordinateur) ouvre un menu : position, profondeur (courbes swissBATHY3D calculées sur l'appareil, sinon « pas de courbe ici »), vent prévu à ce point (Open-Meteo, avec réseau), distance et cap vrai depuis ma position (et durée à la vitesse actuelle), boutons « 🎯 Go to » et « 📌 Enregistrer une marque ». Go to : bandeau rose au-dessus des onglets sur toutes les pages (distance, cap vrai, écart à droite/gauche par rapport au cap fond, durée selon la VMG), ligne pointillée sur les cartes, signal à l'arrivée (< 30 m), ■ pour arrêter (ldb.goto). Marques : M001, M002… (ldb.markSeq) avec date, heure, position et profondeur, affichées sur les cartes ; « Mes marques » (traceur, Plus, Préparer) : Go to, Voir sur la carte, nom/note, suppression, export GPX (waypoints) ou texte. Incluses dans la sauvegarde et la synchronisation (mergeMarks).

## Flèche « ma position » (v77)
Sous le bouton plein écran de chaque carte, une flèche bleue recentre la carte sur la position actuelle (zoom 14 au moins) et, sur le traceur, remet le suivi du bateau (addLocateControl dans map.js).

## Roue dentée selon l'onglet (v78)
La roue dentée ouvre d'abord les réglages de l'onglet ouvert (encadrés) : Traceur et cartes (écran allumé, journal automatique, distance d'arrivée du Go to settings.gotoArrive, alertes de vent au lac, cartes intégrées, liens zones et marques), Saisie (reprendre la dernière entrée, météo), Journée (météo, alertes de vent), Journal (journal automatique, météo), Sécurité (alertes de vent, écran allumé, jour/nuit), sinon Affichage. « Tous les réglages » suit, replié. « ◀ Retour : onglet » ou un second toucher sur la roue ramène à l'onglet de départ, qui reste en surbrillance (settingsFrom). Ouverts depuis Plus, les réglages restent généraux.

## Aperçu dans claude.ai : onglets en haut (v79)
Quand l'appli tourne dans un cadre (aperçu claude.ai), le bas de l'écran peut être recouvert par la fenêtre de claude.ai et les onglets ne répondent plus. Dans ce cas seulement (classe in-frame), la barre d'onglets passe en haut, collée sous l'horloge. L'appli installée (iPhone, Android) garde les onglets en bas.

## Onglets sans navigation ouverte (v80)
Corban : Saisir, Journée, Journal et Sécurité ne répondaient pas sans navigation ouverte (renvoi silencieux au traceur). Désormais Sécurité s'ouvre toujours (numéros du lac en Suisse, sinon numéros généraux, position GPS) ; Saisir, Journée et Journal ouvrent une page qui explique qu'il faut une navigation et propose de la démarrer (journée de nav, croisière lac, croisière mer) ou d'en rouvrir une (vue nonav), l'onglet restant en surbrillance.

## Épeler : mots seuls (v81)

La zone « Épeler un mot » affiche uniquement la suite de mots (India November …), sans la lettre devant chaque mot. Le tableau de référence garde la lettre.

## Traceur : bouton Naviguer et VHF sous la carte (v82)

Chaque page traite un thème et se prolonge vers le bas autant que nécessaire. Sous la carte du Traceur : d’abord « 🧭 Naviguer », qui ouvre une fenêtre avec les infos propres à la navigation (moteur, voile, allure, voiles, baignade, photo, eaux noires, météo sur le lac, accès à l’entrée complète), puis « 📻 VHF : appels de routine » (croisière en mer seulement), retiré de la page Sécurité.

## Alertes de vent : deux clignotements avec la valeur (v83)

Le son et les couleurs par tranche ne changent pas. L’écran ne clignote plus que deux fois par alerte et affiche en très grand, sur toute la largeur, le vent en nœuds (ex. 15 nd) et le chiffre Beaufort.

## Alertes de vent : deux bips (v84)

Deux signaux sonores calés sur les deux clignotements, tonalité et volume selon la tranche de 5 nd. L’écran affiche le vent exact (ex. 12 nd en bleu clair, 17 nd en bleu foncé) et le Beaufort.

## Alertes de vent hors de Suisse (v85)

En Suisse et sur le lac : stations MeteoSwiss. Ailleurs : modèle le plus fin de la région à la position du bateau (Open-Meteo, heure en cours) : France AROME HD, Italie/Adriatique/Ionienne ICON-2I, Royaume-Uni UKMO 2 km, Allemagne/Benelux/Alpes ICON-D2, Baltique/mer du Nord DMI HARMONIE, Scandinavie MET Norway Nordic, Égée/Turquie le plus fort de ICON-EU et ECMWF avec seuils abaissés de 5 nd, sinon ICON-EU. Réglage dans Naviguer (section Alertes de vent) en mer.

## Trace : reprise automatique (v86)

Si l’appli est quittée pendant un enregistrement, la trace reprend toute seule à la réouverture (ou au retour au premier plan). Le trou est complété en ligne droite, compté dans les milles et noté au journal. Seul « Arrivée » arrête la trace. Une page web ne peut pas lire le GPS quand l’appli est fermée.

## Écran allumé pendant la trace (v87)

Pendant l’enregistrement d’une trace, l’écran reste allumé automatiquement, quel que soit le réglage. Nouvelle demande après chaque retour dans l’appli ou au premier toucher, et vidéo muette de secours si le téléphone ne connaît pas le Wake Lock. Le réglage indique « allumé tant que la trace s’enregistre ».

## Traceur après Arrivée, prolonger ou nouvelle trace (v88)

Après « Arrivée », le Traceur revient à son écran initial (compteurs à zéro, carte sans la trace finie) et un nouvel enregistrement est possible. Au Départ suivant dans la même navigation, un choix apparaît : « Prolonger la trace précédente » (le trou est relié en ligne droite) ou « Nouvelle trace ». Les traces d’une même navigation sont listées séparément dans « Mes traces ».

## Suivi du bateau : flèche bleue seule (v89)

Le bouton texte « Suivi du bateau oui/non » est supprimé. La flèche bleue sous ⛶ est pleine (bleue) quand la carte suit le bateau ; déplacer la carte coupe le suivi, toucher la flèche le relance et recentre.

## Carte ArcGIS déplacée dans Plus (v90)

Le lien « 🌐 Carte ArcGIS du Léman » quitte le Traceur et se trouve dans Plus (sans navigation ouverte et sur le lac), sous « Zones hors ligne ».

## Bandeau unique en haut (v91)

Plus de barre d’onglets en bas. Un seul bandeau : heure (ou information selon le contexte) à gauche, puis NavIn (traceur, Naviguer, VHF, saisie, check-lists), DatA (journée, journal, navigations, bateaux, équipage, cartes, règles, documents, exports), SOS, et la roue dentée (réglages contextuels, avec le mode jour/nuit en tête).

## Menu NavIn (v92)

Le bouton du bandeau s’écrit « NavIn ».

## Nom NavIn partout (v93)

L’appli s’écrit désormais « NavIn » partout (titre, icône sur l’écran d’accueil, impressions, GPX, partage).

## Mes traces dans DatA (v94)

« Mes traces » quitte NavIn et devient une page de DatA. 🗺 ouvre NavIn et dessine la trace en violet, GPX l’exporte.

## NavIn : départ rapide, PréP, accostage, amarrage (v95)

- Appui long sur « NavIn » : la trace démarre tout de suite (sortie du jour réutilisée, sinon nouvelle navigation : lac en Suisse avec le dernier bateau, mer ailleurs). Les infos se complètent ensuite avec PréP.
- « PréP » (bouton en bas de NavIn) : type lac/mer › un jour/croisière › bateau › équipage › check-in › Départ.
- En route, NavIn montre moteur, voile, allure, voiles, baignade, photo, eaux noires, météo et alertes, point, VHF (mer), saisie, puis « Accostage » (hauteur d’eau, rappels pare-battages, amarres, gaffe…) et « Amarrage » (fin de la trace puis check-out).

## NavIn vert et pulsant (v96)

Pendant l’enregistrement d’une trace, le bouton NavIn du bandeau passe au vert et pulse lentement.

## Départ immédiat : reprise et mêmes paramètres (v97)

- Sortie déjà utilisée aujourd’hui : elle est reprise et l’appli propose « Prolonger » ou « Nouvelle trace » (même bateau, même équipage).
- Première trace du jour : mêmes paramètres que la navigation la plus récente. Croisière de plusieurs jours (lac ou mer) : on continue la même. Sortie du jour : nouvelle sortie avec le même bateau, le même équipage et le même type (entraînement/location).

## GPS refusé : message clair (v98)

Si la localisation est refusée, la trace ne peut pas démarrer : un encadré rouge l’explique sur NavIn (réglages iPhone, aperçu Claude souvent sans GPS). L’appui long est signalé par un contour vert.

## Hébergement Infomaniak (v99)

Paquet navin-infomaniak.zip : contenu à déposer dans le dossier « web » de l’hébergement (FTP du Manager), avec le fichier .htaccess (types du manifeste, pas de cache pour sw.js et index.html). L’adresse affichée dans le guide d’installation suit automatiquement le site. Attention : les données du téléphone sont liées à l’adresse du site ; faire une sauvegarde complète sur l’ancienne adresse et la restaurer sur la nouvelle.

## Simulation de trace dans l’aperçu (v100)

Dans l’aperçu ouvert depuis Claude (sans GPS), l’encadré « localisation refusée » propose « ▶ Simuler une trace » : un bateau fictif part devant Morges, le bouton NavIn passe au vert et pulse, et tout l’écran « en route » est visible. « Amarrage » arrête la simulation. N’apparaît pas dans l’appli installée.

## Arrêter la trace depuis NavIn (v101)

Trace en cours : un appui long sur NavIn le fait passer au rouge avec « FIN ? » ; un toucher court dans les 5 secondes arrête l’enregistrement (sinon il redevient vert).

## Carte plein écran, tout par le bandeau (v102)

La carte occupe tout l’écran sous le bandeau (transparent sur l’onglet NavIn). Plus de boutons en bas. Appui long sur NavIn : trace. Premier toucher : NavIn devient « PréP » (ou « Naviguer » pendant une trace) ; second toucher dans les 4 s : ouvre PréP (ou le menu Naviguer avec point, VHF, saisie, check-lists, accostage, amarrage). Roue dentée sans cadre, à la taille de l’heure.

## Roue dentée détaillée (v103)

La roue des réglages est un dessin vectoriel (12 dents, couronne, rayons, moyeu), plus grande (46 px), sans cadre.

## Roue intermédiaire (v104)

Roue dessinée en traits fins, gris foncé adouci, 38 px.

## Roue à la hauteur de l’heure (v105)

La roue suit la taille de l’heure (hauteur des chiffres), traits fins, gris plus léger. Zone tactile conservée (44 px).

## Bandeau : data en minuscules (v106)

« data » écrit en minuscules, textes NavIn / data / SOS agrandis, roue un peu plus foncée.

## Fonctionnement unique des boutons du bandeau (v107)

Toucher court sur NavIn, data ou SOS : ouvre sa page si on est ailleurs, sinon fait défiler ses choix sur le bouton. Après 3 s sans action, retour au nom du bouton. Appui long sur un choix : le bouton passe au vert et l’action est validée.
- NavIn : NavIn (appui long = trace ; en route = FIN ?), PréP, Check-in, Saisir, VHF (mer) ; en route : Naviguer, Point, Accostage, Amarrage, VHF.
- data : data, Journée, Journal, Traces, Équipage, Check-lists.
- SOS : SOS, MOB, Alphabet, VHF (mer).

## NavIn n’engage rien (v108)

Le nom NavIn sert seulement à trouver le bon choix. Premier choix : « Trace ! » (appui long = trace immédiate selon les règles du départ immédiat). Pendant une trace, premier choix « Fin trace » en rouge (appui long = arrêt).

## Télécommande Bluetooth (v109)

Pour l’écran mouillé : toute télécommande vue comme un clavier (ex. AirTurn DIGIT III en mode 2 « Presenter »). ← → : choix précédent / suivant du bouton ; ↑ ↓ (ou PgUp/PgDn) : passer de NavIn à data à SOS ; Entrée ou Espace (court ou long) : valider ; Échap : fermer le menu. Le bouton choisi est cerclé d’orange, retour après 3 s.

## START / STOP track et aides (v110)

« Trace ! » devient START / track (deux lignes). En route, STOP / track (rouge) : appui long, le bouton demande « STOP ? confirmer », un toucher (ou Entrée) dans les 5 s arrête la trace. Chaque choix affiché et chaque validation montre une aide en bas d’écran (blanc sur noir).

## Appui long sur le nom sans effet (v111)

Un appui long sur NavIn, data ou SOS (le nom du bouton) ne fait plus rien : ni vert, ni action. Seuls les touchers courts font défiler les choix ; l’appui long valide uniquement un choix affiché.

## Aide : les appuis courts d’abord (v112)

La bulle noire explique d’abord comment faire défiler les menus (« Touche NavIn plusieurs fois… »), puis pour chaque choix « Toucher encore : menu suivant · appui long : … ». Les bulles longues restent affichées plus longtemps (jusqu’à 4,5 s).

## Bulle sur plusieurs lignes (v113)

La bulle d’aide met une idée par ligne (appuis courts, puis appui long).

## Sélection affichée 5 s (v114)

Après un toucher court, le choix reste affiché 5 s (au lieu de 3) avant le retour au nom du bouton ; idem à la télécommande. La bulle d’aide peut rester jusqu’à 5 s.

## Zone Time (v115)

Un toucher sur l’heure affiche l’heure du fuseau avec « Zone Time » (au lieu de « heure locale »), réduit pour ne jamais dépasser la largeur de l’heure.

## START / STOP en grand (v116)

START et STOP écrits à la même taille que SOS.

## NavIn allégé (v117)

Check-in et Saisir retirés des choix de NavIn (le check-in reste dans PréP ; Saisir reste dans le menu Naviguer pendant une trace).

## Choix à la taille de SOS (v118)

PréP et les autres choix s’écrivent à la taille de SOS ; un mot trop long (Accostage, Check-lists…) est réduit juste assez pour tenir.

## PréP / TRACK en cours (v119)

Pendant la préparation, le bouton NavIn reste allumé et affiche « PréP » avec « en cours » dessous ; pendant l’enregistrement d’une trace, « TRACK » avec « en cours ». Le petit texte est ajusté à la largeur du mot.

## PréP : type de sortie lac (v120)

Première étape de PréP : Lac ou Mer. Pour le lac, trois choix : Entraînement, Location, Invitation (obligatoire pour continuer). Le choix est enregistré comme type de sortie (fiche du jour). « Invitation » ajouté aussi à la création d’une sortie et aux types de sortie.

## PréP : un toucher = étape suivante (v121)

Premier niveau : uniquement Lac ou Mer (et Retour) ; un toucher passe à la suite. Lac : niveau Type de sortie (Entraînement, Location, Invitation), un toucher passe à la durée. Durée : un toucher passe au bateau. Croix ✕ en haut à droite pour quitter PréP.

## PréP : bateau puis composition d’équipage (v122)

Lac : après le type de sortie, choix du bateau (sortie du jour). La liste met en tête le dernier bateau utilisé pour ce type de sortie, puis les autres du plus récent au moins récent. Un toucher passe à l’équipage : compositions enregistrées (comme des fiches), même ordre d’usage ; un toucher applique la composition et passe au check-in. « Nouvelle composition » ouvre la page Équipage ; « Suivant » l’enregistre. Compositions incluses dans la sauvegarde (ldb.crewSets).

## Contrôle de l’équipage (v123)

Après le choix d’une composition, une étape « Contrôle de l’équipage » permet d’ajouter ou retirer des personnes, de changer les rôles et de nommer l’équipage. Sans modification, la composition est reprise telle quelle ; avec modification, une nouvelle composition est créée avec un identifiant unique (EQ001, EQ002…), qui sert de nom si aucun nom n’est saisi. Les rôles (Skipper, Second, Équipier) appartiennent aux listes d’équipage, pas aux fiches des personnes.

## Les touchers ne repassent plus par le nom (v124)

Les touchers courts tournent entre les choix seulement (NavIn : START track → PréP → (VHF) → START track…) ; le nom du bouton ne revient qu’après 5 s sans action. Idem data, SOS et télécommande.

## Fiche personne : prénom seul obligatoire (v125)

Seul le prénom est obligatoire ; la case Nom reste à la même place, facultative.
Noms et prénoms centrés sur les pastilles de l’équipage.

## Pastille bateau (v126)

Pastille bateau : nom du bateau, dessous le modèle et à côté l’année entre parenthèses. Dans la fiche, Nom, Modèle et Année sont trois entrées distinctes (l’ancien « Modèle, année » est séparé automatiquement une fois).

## Homme ou femme (v127)

Fiche personne : choix Homme ou Femme. Pour une femme, Second devient Seconde et Équipier devient Équipière (boutons de rôle, liste d’équipage exportée).

## Fiche bateau modifiable (v128)

Mes bateaux : en ouvrant un bateau, les informations viennent en premier et se saisissent ou se corrigent directement, avec au-dessus « Rubriques à afficher » (choisir, ajouter, copier). La page Rubriques permet aussi de saisir les données. Le Recueil des bateaux montre la fiche en cases modifiables, avec le même bouton.

## Touches de navigation partout (v129)

Sous le bandeau, chaque écran a une barre toujours visible : « ◀ Retour » (ou « ✔ Terminé ») pour ressortir, et à droite l'action principale de l'écran (Nouvelle fiche, Ajouter la rubrique, Nouveau bateau…). Le bandeau reste en haut en défilant. TRACK en cours : menu « Naviguer » retiré. Sauvegarde complète : fonctionne dans l'aperçu (enregistrement de fichier) et se restaure même sans navigation (fiches bateaux, équipage, check-lists).

## Virgule décimale (v130)

Dans toutes les cases chiffrées, le point tapé sur le clavier de l'iPhone devient automatiquement une virgule.

## Pied de pilote et marge de hauteur (v131)

Données du bateau : « Tirant d’eau + pied de pilote » (tirant d’eau + 0,80 m) et « Tirant d’air + marge de hauteur » (tirant d’air + 1 m), calculés automatiquement. Une valeur saisie à la main s’affiche en rouge ; l’effacer remet le calcul automatique. Les fiches exportées reprennent ces valeurs, avec l’unité.

## Page data (v132)

Plus d’introduction : les rubriques en pastilles, l’une sous l’autre. Le bouton data n’a plus de menu déroulant, un toucher ouvre la page. Ordre par l’usage : chaque ouverture fait remonter la rubrique d’un cran, les moins utilisées descendent peu à peu (ldb.dataOrder).

## Réglages du pied de pilote et de la marge (v133)

Besoins arrondis au dixième supérieur (2,33 → 2,4 m). Roue dentée depuis data (ou Mes bateaux, Recueil) : « Pied de pilote » (0,80 m par défaut) et « Marge de hauteur » (1 m par défaut), modifiables. Cases renommées « Tirant d’eau + pied de pilote : besoin en profondeur » et « Tirant d’air + marge : besoin en hauteur ».

## Mode nuit et arrondis (v134)

Le mode nuit ne se règle plus depuis data : seulement depuis la roue de NavIn et de SOS. Roue de data : arrondi vers le haut réglable pour le besoin en profondeur et le besoin en hauteur (exact, 0,1, 0,5 ou 1 m ; 0,1 par défaut).

## Longueur en mètres ou en pieds (v135)

Données du bateau : Longueur (m) et Longueur (pieds). La première case remplie sert de base, l’autre se calcule. Une valeur tapée dans la case calculée passe en rouge ; l’effacer remet le calcul.

## Longueur de coque (v136)

« Longueur » en pieds d’abord, puis « Longueur hors-tout » en mètres (v137–v140). Les deux restent calculées l’une depuis l’autre.

## Navigants et Équipages (v139)

data : « Navigants » = les fiches des personnes avec leurs caractéristiques ; « Équipages » = les groupes de navigants avec leurs rôles (créer, nommer, modifier, supprimer ; identifiant EQ001…). En navigation, la pastille « Équipage à bord » reste. La barre du haut propose « ✔ Enregistrer » quand l’écran en a un.

## Longueur de coque et règles de calcul (v141)

Nouvelle case « Longueur de coque » (m) : longueur hors-tout − 2 % (pourcentage réglable dans la roue de data). Chaque case calculée affiche sa règle sous l’intitulé. Ordre : Longueur (pieds) | Longueur hors-tout, Longueur de coque, Largeur, Tirant d’eau | besoin en profondeur, Tirant d’air | besoin en hauteur.

## Sonde min. et Hauteur de passage min. (v142)

« Besoin en profondeur » devient « Sonde min. » et « Besoin en hauteur » devient « Hauteur de passage min. » (la règle de calcul reste affichée dessous).

## Règle de calcul cachée si la valeur est saisie (v143)

Quand une case n’est plus calculée (valeur saisie à la main, en rouge), l’indication de la règle de calcul disparaît ; elle revient quand on efface la valeur.

## Question du sondeur retirée (v144)

La case « Le sondeur indique la profondeur sous la surface ? Oui / Non » est supprimée des données du bateau, ainsi que « Profondeur mini à l’écran (marge comprise) » (v145).

## Description radio générée (v146)

Radio et identification : nouvelles cases « Couleur de la coque », « Couleur des voiles », « Inscription particulière (coque ou voiles) ». La « Description pour la radio » se génère toute seule en anglais (marque et numéro du modèle, longueur en pieds, couleurs traduites, inscription) ; un toucher bref affiche la version française pendant 3 s. « ✎ Forcer le texte » permet de l’écrire à la main (en rouge). Les appels VHF reprennent les deux langues.

## Ordre des bateaux par navigation réelle (v147)

Mes bateaux, Recueil et PréP : les bateaux sont classés par la navigation réelle la plus récente (entrées du journal, trace, fiche du jour remplie), pas par la modification de leur fiche. Dans la PréP, le dernier bateau navigué pour ce type de sortie vient en tête.

## Une seule touche par action (v148)

Règle commune à tous les écrans : l’action principale (Nouvelle fiche, Ajouter…, Enregistrer) n’apparaît qu’une fois, dans la barre du haut ; le bouton identique en bas de page est caché.

## LOA (v149)

« Longueur hors-tout (LOA) » et « Longueur de coque (LC) ».

## Aide d’introduction en popup (v150)

Les paragraphes d’aide en tête d’écran (mode de saisie, enregistrement automatique…) ne sont plus dans la page : ils s’affichent dans le popup noir en bas, disparaissent, et reviennent quand on rouvre l’écran (aussi en ouvrant un bateau dans Mes bateaux).

## Bouton Rubriques en bas, en bleu (v151)

Fiche d’un bateau (Mes bateaux et Recueil) : « ＋ Rubriques à afficher : choisir, ajouter, copier » est en bas des informations, en bleu. La page Rubriques ne montre plus que la sélection (plus de cases de données).

## v152
- Bouton « data » du bandeau : quand il est actif, fond gris moyen foncé et texte blanc (au lieu du bleu), pour le distinguer de NavIn qui a plusieurs menus et états.

## v153
- La bulle d'aide (toast) d'un menu s'efface dès qu'on touche un autre bouton du bandeau ou qu'on passe à un autre menu (NavIn, data, SOS).

## v154
- Correction : modifier une case de « Bateau et croisière » dans une navigation ne renvoie plus que cette case vers la fiche du bateau. Avant, toute la copie (parfois ancienne) gardée dans la navigation écrasait la fiche du bateau.
- À l'ouverture de « Bateau et croisière », la navigation reprend les données actuelles du bateau.
- Versions des données d'un bateau : l'état précédent est gardé avant chaque série de modifications (12 au plus). Bouton « ↺ Versions précédentes des données » dans Mes bateaux et le Recueil, avec les différences et « Remettre cette version ». Au premier lancement, les copies gardées dans les navigations deviennent des versions.

## v155
- « Pas d’hélice en marche arrière (tire à) » : une seule pastille qui alterne Bâbord / Tribord à chaque appui et affiche le choix enregistré.

## v156
- Roue des data (calculs automatiques des bateaux) : pied de pilote, marge de hauteur et réduction de la longueur de coque l'un sous l'autre, libellé à gauche et case à droite, pour que rien ne soit coupé ni décalé.

## v157
- Fiche bateau : largeur des cases au cas par cas. Textes libres (modèle, couleurs, inscription, fiche technique…) : la case va à la ligne et grandit au lieu de couper le texte ; valeurs courtes (année, pas d’hélice, longueurs, tirants, MMSI…) par deux en demi-case. Les grandes zones de texte s’agrandissent selon leur contenu.
- Pas d’hélice : pastille en demi-case, « Bâbord ⇄ Tribord » tant que rien n’est choisi.
- Partie « Météo » retirée de la fiche bateau.

## v158
- Fiche bateau : la rubrique « Bateau » s’appelle « Données techniques » et la fiche technique (constructeur, CIN, pavillon, voiles, moteur…) suit directement dans la même rubrique.

## v159
- « Longueur de coque (LH) » au lieu de (LC).

## v160
- Fiche bateau : « Pavillon » et « Port d’attache » dans deux cases. Une ancienne valeur « Suisse · Morges… » est séparée automatiquement une fois.

## v161
- Pas d’hélice : une fois le côté choisi, un appui court propose le changement (pastille orange « Changer pour … ? » et bulle d’explication) ; un appui long le confirme (vert « ✓ … »). Sans appui long dans les 4 s, le choix précédent reste.

## v162
- Mes bateaux : les check-lists et les numéros utiles ne sont plus affichés dans la fiche d’un bateau (les données restent enregistrées).

## v163
- « Sonde min. selon traceur », avec le signe « ≥ » devant la case (hors du texte saisi) et devant la valeur partout où elle s’affiche (fiche du Recueil, image, PDF).

## v164
- « Hauteur de passage min. » : même signe « ≥ » devant la case et devant la valeur partout où elle s’affiche.

## v165
- Fiche bateau : « Type de bateau » et « Gréement » dans deux cases distinctes.

## v166
- Fiche bateau : nouvelle rubrique « Données moteur » sous « Données techniques », avec le moteur (marque, transmission), la puissance et « Carburant (l) » (contenance du réservoir).

## v167
- Fiche bateau : « Déplacement lège » (poids total, inchangé) et, à côté, nouvelle case « dont quille (kg) » pour le poids de la quille compris dans le total.

## v168
- « Longueur flottaison (LWL) ». « Déplacement lège (kg) » : l’unité est dans l’intitulé ; un ancien « 5 422 kg » devient « 5 422 » une fois.

## v169
- Données de navigation critiques protégées (longueurs, largeur, LWL, tirants, sonde min., hauteur de passage min., indicatif, MMSI) : une case remplie porte un cadenas. Un appui court explique (cadre orange), un appui long déverrouille (cadre vert) ; la case se reverrouille quand on la quitte. Une case vide se remplit librement.

## v170
- Fiches navigants et équipages : enregistrement automatique, plus de bouton « ✔ Enregistrer ». Une nouvelle fiche navigant est créée dès que le prénom est saisi ; un équipage dès le premier navigant choisi. En navigation, « ＋ Mettre à bord » reste pour ajouter la personne.

## v171
- Fiche navigant : lieu de naissance, téléphone et courriel sur toute la largeur. Une fois remplis, le téléphone et le courriel sont des liens : appui court = appeler ou écrire un courriel, appui long = modifier (donnée protégée).

## v172
- Liens téléphone et courriel (fiche navigant, numéros SOS, équipage) : ouverts par un vrai lien ; dans l'aperçu Claude (page dans un cadre), ils passent par un nouvel onglet pour que le téléphone lance l'appel ou la boîte mail.

## v173
- Fiche navigant : « Homme ou femme » est une pastille tournante (Homme ⇄ Femme à chaque appui), sans confirmation.

## v174
- Fiche navigant : proche à contacter en deux cases (prénom et nom, téléphone cliquable et protégé). « ＋ Ajouter un proche » fait apparaître un 2e puis un 3e proche. L'ancien texte « Prénom Nom +41… » est séparé automatiquement une fois. Page SOS : un bouton d'appel par proche.

## v175
- Fiche navigant : l'intitulé « N° Passeport ⇄ » se touche pour passer à « N° Carte d’identité ⇄ » et inversement (type gardé dans la fiche).

## v176
- SOS contextuel : un appui court ouvre les outils du lac si la position est sur un lac loin des côtes (Suisse, lacs savoyards, lacs italiens, Constance), sinon ceux de la mer (sans position récente : type de la navigation ouverte). Appui long sur « SOS » : tous les outils en deux sections, Lac et Mer.
- Roue dentée : appui court = réglages de l'onglet ouvert seulement ; appui long = tous les réglages classés par section (NavIn, SOS, data, Général avec le mode développeur, la sauvegarde, l'icône, l'installation).
- Pastille « Femme » en rose.

## v177
- Fiche navigant : « N° Passeport » écrit en rouge, « N° Carte d’identité » en bleu. Le choix est bloqué une fois fait (ou dès que le numéro est saisi) : appui court = demande (orange), appui long = confirmer ; sans appui long dans les 4 s, le choix reste.

## v178
- Touche SOS : écrite en rouge sur fond blanc ; un toucher ouvre la page SOS (fond rouge, écriture blanche). Ce n'est plus une touche tournante. Appui long : tous les outils, lac et mer.

## v179
- Homme à la mer : une section lac et une section mer (onglets 🏞 Lac / 🌊 Mer). La version mer part d'une copie de la procédure actuelle et se modifie à part (ldb.mob2mer, dans la sauvegarde). Page SOS : le bouton ouvre la section de la zone ; appui long sur SOS : un bouton dans la section Lac et un dans la section Mer.

## v180
- Homme à la mer lac : boutons d'appel 🇨🇭 Secours suisses (117), 🇫🇷 Secours français (18), puis 🆘 112 en troisième choix (le côté où l'on est en premier). Chaque appel est noté dans le log s'il est démarré. Position MOB et position actuelle (GPS suivi en continu) toujours affichées, avec distance et cap vers le MOB.

## v181
- Fiche navigant : numéros de passeport / carte d'identité, de permis et de licence VHF protégés (cadenas ; appui court = explication, appui long = modifier).

## v182
- Log SOS automatique : dès qu'on touche SOS (ou qu'on ouvre l'homme à la mer), un log démarre et note chaque action (bouton touché, appel, page) avec l'heure locale, l'heure UTC et la position. Bandeau « Procédure SOS en cours » sur la page SOS.
- Plus de bouton « Démarrer le log » dans l'homme à la mer : le log MOB démarre à l'ouverture de la page.
- Si on quitte l'appli, le log se met en pause et repart à la réouverture. Seul le bouton « ⏹ Fin de procédure SOS » (appui long, puis un toucher pour confirmer dans les 5 s) termine la procédure, le log SOS et les logs MOB ouverts.
- data › 🆘 SOS : liste des logs, partage en texte, effacement protégé par un mot de passe (choisi au premier effacement, modifiable). Logs et mot de passe (haché) dans la sauvegarde.

## v183
- Effacer par swipe : navigations, navigants, bateaux et traces. Glisser la ligne vers la gauche fait apparaître « 🗑 Supprimer … ? » ; un toucher confirme, « Annuler » ou 5 s sans rien referme.
- Traces : une trace d'une navigation à plusieurs traces est retirée seule. La trace unique d'une navigation vide (que des points automatiques) part avec sa navigation. Une trace en cours ne peut pas être supprimée.
- Numéro unique : le plus grand numéro encore enregistré dans l'année + 1. Si on efface les dernières depuis la fin, la numérotation repart depuis la dernière encore enregistrée.
- Fin de procédure SOS : le bouton est tout en bas de chaque procédure (page SOS, tous les outils, homme à la mer). Une fois confirmé, il passe en vert « ✓ Procédure SOS terminée » puis s'efface au bout de 3 s.
- Textes : « Homme à la mer » tout court, sur le lac comme en mer (les onglets Lac / Mer restent pour choisir la procédure).
- Procédures du lac (page SOS lac, homme à la mer lac, logs du lac) : heure locale seulement, plus aucune heure UTC.

## v184
- Suppressions (navigations, navigants, bateaux, traces, équipages, check-lists, sections MOB) : confirmation par appui long. Swipe : le bouton orange « 🗑 Supprimer … ? » demande un appui long. Boutons « Supprimer » : 1er toucher = orange « Appui long pour supprimer », puis appui long. Un toucher court ne supprime jamais.

## v185
- Navigants classés par ceux qui naviguent le plus : nombre de navigations réelles (entrées, trace, fiche remplie) où ils étaient à bord, puis la plus récente, puis l'ordre alphabétique. Même ordre dans la liste des navigants, le choix de l'équipage en PréP et l'édition des équipages.

## v186
- Bulle d'aide : si elle recouvrirait la touche qu'on vient de toucher (touche en bas d'écran), elle s'affiche en haut, sous le bandeau.

## v187
- Alarme de profondeur (lacs suisses) : d'après les courbes 1 à 5 m de la carte (swissBATHY3D) et la position GPS réelle, l'appli estime l'eau sous le bateau. Sous « sonde min. selon traceur » + 1 m (réglable), un bip de plus en plus fort, aigu et rapide, et l'écran clignote d'un dégradé jaune → orange → rouge toujours plus intense. Bouton « Couper le son 1 min ». La mer viendra plus tard selon les cartes.
- Réglages dans la roue dentée de NavIn (menu contextuel) : OUI/NON, début (+0,5 / 1 / 1,5 / 2 m), volume max., clignotement, deux scénarios de test. Les tests sont aussi dans le mode développeur.

## v188
- Alarme de profondeur : vibrations au rythme des bips, plus longues et en rafales (1, 2 puis 3) quand la marge diminue ; elles continuent quand le son est coupé. Réglage « Vibrations : OUI/NON » dans la roue dentée de NavIn. Android : vibreur du téléphone. iPhone : Safari ne permet pas de faire vibrer depuis une appli web ; essai du petit retour haptique d'iOS 18, sans garantie.

## v189
- Alarme de profondeur : dès qu'on passe SOUS la sonde min. selon traceur, sirène continue beaucoup plus forte et angoissante (deux tons qui hurlent, volume au maximum quel que soit le réglage), écran rouge qui clignote vite, vibrations longues. Au-dessus du seuil, les bips progressifs restent. « Couper le son 1 min » coupe aussi la sirène.

## v190
- iPhone : le son de l'alarme de profondeur passe même avec l'interrupteur silencieux (session audio « lecture », Safari 17 et plus).

## v191
- Sections repliables : dans chaque partie, chaque section et chaque groupe de « Tous les réglages » a une flèche ▾ / ▸ ; toucher le titre referme ou déroule. Tout est ouvert par défaut, l'état est gardé par écran. Les formulaires de saisie (entrée, journée, fiche du jour) restent dépliés.

## v192
- Sections repliables fermées par défaut, sauf sur les pages de secours (SOS, homme à la mer, logs SOS) où tout reste visible d'emblée. Ce qu'on ouvre ou ferme est gardé par écran.

## v193
- VHF en deux sections : 🏞 Intérieure (lacs) et 🌊 Extérieure (mer, océan). Dans NavIn, VHF est toujours au menu ; en l'ouvrant, la bonne section est choisie selon l'endroit, les onglets permettent de changer.
- Section intérieure (lac), préparée avec ce que l'appli sait déjà : appels des secours suisses 117 / français 18 / 112 (le côté où l'on est en premier), position à donner (heure locale), message à dicter pré-rempli (bateau, immatriculation, position, personnes à bord, description), alphabet. Emplacement prévu pour les règles VHF des lacs suisses.
- Section extérieure : les appels de routine en mer, comme avant.

## v194
- Partout, la bulle d'aide noire s'efface dès qu'on touche l'écran ou qu'on tape au clavier (une nouvelle bulle peut ensuite apparaître pour l'action touchée).

## v195
- Pas d'hélice : la pastille Bâbord est rouge, Tribord verte.

## v196
- data : plus de tuiles en bleu (Journée, Journal, Mes navigations) ; toutes les tuiles ont la même couleur.

## v197
- Fiche bateau : pastille tournante « Navigation » non protégée, comme Homme / Femme : Eaux intérieures (vert d'eau) ⇄ Eaux maritimes (bleu marine), en haut des Données techniques.
- Section « Informations » préparée sous les Données techniques, pour les données générales et informatives ; elle s'affichera dès que Corban aura dit quelles données y vont.
- Bateau tagué « Eaux intérieures » : indicatif (call sign), MMSI, canal VHF de la marina, station côtière et description radio ne sont plus proposés au remplissage (les données déjà saisies restent gardées et reviennent en « Eaux maritimes »).

## v198
- Pastille « Navigation » (Eaux intérieures ⇄ Eaux maritimes) protégée comme le pas d'hélice : une fois choisie, appui court = « Changer pour … ? » en orange, appui long = confirmer, sinon le choix reste au bout de 4 s.

## v199
- Fiche bateau : de « Constructeur » à « Puissance » (constructeur, architecte, CIN, CE, pavillon, port d'attache, francisation, immatriculation, catégorie, LWL, déplacement, quille, ancre, type, gréement, voiles, moteur, puissance), tout passe dans la section « Informations ». « Données moteur » garde le carburant.

## v200
- Pas d'hélice en marche arrière : libellé sans « (tire à) », pastille plus courte, affichée « < Bâbord » (rouge) ou « Tribord > » (vert).

## v201
- Fiches : chaque libellé et sa case ou pastille sont réunis dans un cadre fin aux angles arrondis (léger dégradé, liseré bleu en haut, halo au toucher), variante mode nuit.

## v202
- Pastilles tournantes et intitulés tournants : plus de double flèche ⇄ (Homme / Femme, Bâbord / Tribord, Eaux intérieures / Eaux maritimes, passeport / carte d’identité).

## v203
- Flèches des sections repliables agrandies : chevron épais dans une pastille ronde bleutée (pointe à droite fermé, en bas ouvert) ; chevrons des fiches bateau plus grands et bleus ; titres centrés verticalement.

## v204
- Intitulés « N° X » devenus « X n° » : Passeport n°, Carte d’identité n°, Permis n°, Licence VHF n°, CIN / HIN n°, Pavillon / francisation n° (fiches et liste d’équipage).

## v205
- Fiche bateau : « Voiles d’avant à bord » en pastilles, une par voile, avec un bouton ＋ pour en ajouter autant que nécessaire ; une pastille vidée disparaît. Toujours enregistré « A, B, C » pour les boutons de voiles.

## v206
- « Voiles d’avant à bord » déplacé dans la section Données techniques (en bas, après la hauteur de passage).

## v207
- Sur la page VHF, le bouton NavIn garde le texte « VHF », passe sur fond jaune et pulse très lentement (3 s) ; il redevient NavIn en quittant la page.

## v208
- Horloge du bandeau selon l’endroit (navZone, comme les cartes) : en eaux intérieures, Zone Time affichée et toucher = UTC 3 s ; en eaux maritimes, UTC affichée et toucher = Zone Time.

## v209
- data › 🗺 Cartes : un appui charge le plan OpenStreetMap (tuiles CARTO) et le balisage OpenSeaMap dans un rayon autour de ma position (50 km par défaut ; 20, 50, 100 ou 150 km dans la roue dentée). Détail jusqu’au zoom 14 (13 ou 12 si le rayon est grand). Cartes enregistrées listées, suppression par appui long. La sélection manuelle de zone reste accessible.
- « UTC » et « Zone Time » centrés sous l’heure du bandeau.

## v210
- Cartes : boutons (zoom, plein écran, ma position, calques) masqués ; un balayage depuis le bord gauche vers le centre les montre 4 s, relancées à chaque usage ; ils disparaissent aussi dès qu’on touche ailleurs sur la carte. Petite languette au bord gauche comme repère. Attribution des cartes toujours visible.

## v211
- Aperçu (cadre) : la carte NavIn plein écran va jusqu’au bord gauche et droit du téléphone (la marge de 16 px de l’aperçu ne s’applique plus à la carte).

## v212
- Fiche bateau : « Carburant » devient « Gasoil (l) » dans Données techniques, bouton ＋ pour un 2e réservoir (fuelCap2). Section Données moteur supprimée.
- Nouvelle case « Eau potable (l) » dans Données techniques (waterCap, retirée des calculs), ＋ jusqu’à 3 réservoirs (waterCap2, waterCap3).
- Flèches des sections repliables identiques aux chevrons des fiches bateau : chevron bleu à droite, vers le bas fermé, vers le haut ouvert.

## v213
- « Consommation moyenne (l/h) » remontée dans Données techniques (après le gasoil), ＋ pour un 2e moteur (conso2) ; les deux consommations s’additionnent dans le calcul du carburant.

## v214
- Fiche bateau, Données techniques : case « Voiles » = Grand-voile toujours en premier, puis les voiles d’avant (＋ pour en ajouter) ; sous chaque voile, une case libre « couleur, inscription ou dessin » (gvDesc, voilesDesc).
- Ces descriptions entrent dans la description radio et les textes SOS : « grand-voile (blanche, logo…) , génois (…) » ; anglais : mainsail, genoa, jib, staysail, spinnaker… La case « Couleur des voiles » ne sert plus que si aucune voile n’est décrite.

## v215
- Données techniques : juste après les voiles, « Couleur de la coque » et « Inscription remarquable ou dessin sur la coque » (déplacées depuis Radio et identification, valeurs gardées). Texte radio/SOS : « coque blanche, sur la coque : … , grand-voile (…) ».

## v216
- Descriptions libres (couleur de la coque, inscription/dessin sur la coque, chaque voile) traduites automatiquement en anglais, sans réseau (dictionnaire de bord + « nom + couleur » → « couleur + nom », descEn). Traduction affichée en italique 🇬🇧 sous chaque case et utilisée dans la description radio anglaise et les textes SOS. Mots inconnus (noms propres, numéros) laissés tels quels.

## v217
- Fiche bateau : sections « Loueur, base » et « Location et règlement du bateau » retirées (valeurs gardées ; toujours présentes dans « Bateau et croisière » d’une navigation en mer).
- « ＋ Rubriques à afficher » remplacé par « ＋ Ajouter un libellé » : on écrit le libellé, une case de texte apparaît avec lui dans la fiche, et ▲ ▼ le placent n’importe où (c.after). Suppression par appui long. Plus de rubriques masquées ni de copie depuis un autre bateau.

## v218
- data : tuile « Recueil des bateaux » retirée, seul « Mes bateaux » reste. Les photos de documents et l’envoi de la fiche (image, PDF) passent dans Mes bateaux : bouton « 📄 Documents (photos) et envoi de la fiche » sous chaque bateau, retour vers Mes bateaux.

## v219
- La section « Navigants » s’appelle maintenant « Les coéquipiers.ères » (tuile data, titre de la page, lien dans Équipages et PréP).

## v220
- Fiche coéquipier.ère : l’intitulé « Lieu de naissance » / « Lieu d’origine » est tournant (lieuType), protégé comme passeport / carte d’identité : premier choix direct, ensuite appui court = « Changer pour … ? » en orange, appui long = confirmer.

## v221
- data : tuile « Mes navigations » retirée (la page reste utilisée en interne : création d’une navigation, restauration d’une sauvegarde).

## v222
- Fiche coéquipier.ère : la pastille Homme / Femme affiche « Coéquipier » (bleu) / « Coéquipière » (rose) ; libellé « Coéquipier ou coéquipière ». Valeurs enregistrées inchangées.

## v223
- Équipages : chaque pastille montre « créé le JJ.MM.AAAA » ou « modifié le JJ.MM.AAAA » (x.at / x.mod, repérés à l’enregistrement), dans data › Équipages et dans PréP. Les équipages existants affichent une date dès leur prochaine modification.

## v224
- Équipage : « 📷 Ajouter une photo de groupe » (appareil photo ou galerie) ; une fois la photo prise, une légende s’écrit et se pose au centre, en bas de la photo. Changer la photo, ou la retirer par appui long. Photo dans la sauvegarde complète. Bouton « ＋ Nouveau coéquipier.ère ».

## v225
- Mes bateaux : en fin de fiche, « 📷 Photos et papiers officiels » : prendre une photo ou l’importer depuis la galerie (plusieurs à la fois), libellé à écrire sous chaque photo (d.cap), suppression par appui long, toucher la photo pour l’agrandir. Libellés repris dans l’envoi image / PDF. Bouton « 📤 Envoyer la fiche ».

## v226
- Mes bateaux, photos et papiers : accepte aussi les scans PDF (scanner de documents du téléphone, via « Choisir un fichier »), enregistrés dans l’appli comme les photos (base interne, stockage protégé demandé, vérification après enregistrement) et inclus dans la sauvegarde complète. Un scan s’ouvre d’un toucher ; il n’est pas repris dans l’image / PDF de la fiche.

## v227
- Équipage existant modifié (personnes ou rôles) : l’appli propose « ✎ Écraser EQ… (garder ce numéro) » ou « ＋ Nouvel équipage (nouveau numéro) », et dans data › Équipages aussi « ↺ Annuler les modifications ». Rien n’est écrit avant le choix ; le retour est bloqué tant qu’il n’est pas fait. Après le choix, l’enregistrement automatique reprend. Même choix à la validation de l’équipage dans PréP (les changements de rôle comptent désormais comme une modification).

## v228
- Équipage réel modifiable à tout moment : nouveau choix « Équipage » dans le menu NavIn pendant la trace (appui long = page Équipage à bord). Une fois parti (trace en cours ou journal commencé), chaque personne ajoutée ou retirée est notée au journal (« Embarquement » / « Débarquement », nom, nombre à bord, heure et position). L’équipage enregistré (EQ…) n’est pas modifié.

## v229
- Fiche coéquipier : le n° de passeport / carte d'identité et la date d'expiration partagent le même cadre.
- Date d'expiration contrôlée : fond jaune si elle n'est plus valable dans les 3 mois, fond rouge et texte blanc si elle est dépassée (formats JJ.MM.AAAA, JJ/MM/AA, AAAA-MM-JJ, MM.AAAA).

## v230
- Le menu NavIn ne propose plus « Équipage ». L'équipage réel se modifie seulement depuis data › « ⛵ Équipage à bord » pendant une navigation (entrées Embarquement / Débarquement au journal inchangées).

## v231
- Fiche coéquipier : quand le nom et le téléphone du 2e (ou 3e) proche sont vidés, ces deux cases disparaissent. Si le 3e proche était rempli, il remonte à la place du 2e. « ＋ Ajouter un proche » les fait réapparaître.

## v232
- Fiche coéquipier : « Permis n° » et « Établi par » (ex « Permis établi par ») réunis dans le même cadre.

## v233
- Une fiche de coéquipier.ère ne peut plus être supprimée si la personne fait partie d'un équipage (ou est à bord de la navigation en cours). Le bouton « Supprimer la fiche » est remplacé par un message 🔒 qui nomme les équipages concernés ; le glissement vers la gauche affiche le même message.
- Fiche coéquipier : la note de bas de fiche (« * obligatoire… ») est retirée ; l'astérisque après « Prénom » reste.

## v234
- En bas de chaque liste de data (Les coéquipiers.ères, Équipages, Mes bateaux, Mes traces, Mes marques, Bases de check-list, Logs SOS) : volet « 🖨 Imprimer ou envoyer la liste ». On coche les éléments à garder (tout coché par défaut, Tout cocher / Tout décocher), puis « 📄 PDF » (impression du téléphone, Enregistrer en PDF) ou « 📸 Image » (PNG partagé vers WhatsApp ou une autre app ; plusieurs images si la liste est longue). Le volet n'apparaît que si la liste contient quelque chose.

## v235
- État de la mer : chaque pastille de l'échelle de Douglas affiche en petit la hauteur des vagues (0 m … plus de 14 m).
- data › « 📋 Listes » (nouvelle tuile) : Échelle de Beaufort (force, nœuds, appellation, aspect de la mer), Échelle de Douglas (code, hauteur, état de la mer) et Alphabet phonétique (déplacé ici). Bouton 🇫🇷 Français / 🇬🇧 English sur les échelles, choix gardé.

## v236
- Voiles d'avant : aucune en base. Une seule pastille vide pour la première, puis « ＋ Ajouter une voile d’avant » autant de fois que nécessaire (6 et plus). Les voiles mises d'office sur Savannah (Foc, Génois volant, Spi) sont retirées si elles n'avaient pas été modifiées.

## v237
- Fiche bateau : « Consommation moyenne » devient « Consommation x̄ gasoil » ; les réservoirs deviennent « Vmax gasoil » et « Vmax eau potable » (max en indice ; Vₘₐₓ en texte simple dans les exports).

## v238
- Fiche bateau : sections « Radio et identification » et « Calculs moteur et carburant » retirées (données gardées ; indicatif, MMSI et description radio restent utilisés par les messages SOS et visibles dans « Bateau et croisière » d'une croisière en mer).
- Compteur moteur et carburant au départ de la croisière, vitesse au moteur : saisis dans la fiche journalière (Moteur et carburant), gardés dans la croisière.
- « Sondeₘᵢₙ selon traceur » et « Hauteur de passageₘᵢₙ » : min en indice, sans point.
- Cadre « Énergie de propulsion » : pastille tournante Gasoil (brun-jaune) / Électrique (vert). Gasoil : Vmax gasoil (+ 2e réservoir), consommation x̄ (+ 2e moteur). Électrique : Emax batteries (kWh), générateur gasoil Vmax réservoir et consommation x̄.
- Bouton FR⇄EN sur chaque fiche : actif, chaque appui sur la fiche fait passer titres, intitulés, aides et pastilles (Bâbord/Tribord compris) en anglais puis en français ; nouvel appui sur le bouton pour sortir. Abréviations (LOA, LH, LWL, MMSI) inchangées ; données saisies jamais traduites. Pendant ce mode, un appui ne modifie rien.
- Imprimer ou envoyer la liste : en plus des éléments, choix des sections (ex. Données techniques sans Informations), avec Toutes / Aucune.

## v239
- Fiche coéquipier, cadres communs : date de naissance + lieu de naissance / d'origine + nationalité ; téléphone + courriel ; permis n° + établi par + licence VHF ; chaque proche + son téléphone (le cadre entier se cache ou apparaît).

## v240
- Mes bateaux : « Nom du bateau » et la pastille « Plan d’eau » (ex « Navigation ») dans le même cadre.

## v241
- Fiche coéquipier : prénom, nom et pastille Coéquipier / Coéquipière dans le même cadre, en haut ; section « Informations complémentaires » (ex « Autres informations (facultatif) ») ; n° de pièce et date d'expiration alignés en bas.

## v242
- Bouton FR | EN simplifié : un appui sur le bouton change la langue de la fiche, rien d'autre (plus de mode « appui sur la fiche »). La langue choisie reste quand on passe d'une fiche à l'autre ; la fiche reste utilisable normalement.
- Pastille Énergie de propulsion protégée : une fois choisie, appui court = « Changer pour … ? », appui long = confirmer.

## v243
- Mes bateaux : cadres communs Modèle + Année, Longueur (pieds) + LOA + Largeur, Tirant d'eau + Sonde min, Tirant d'air + Hauteur de passage, Couleur + Inscription coque, Longueur de coque + Flottaison (dans Informations), Déplacement + Quille, Type + Gréement + Surface de voilure au près.
- Ordinaux 2ᵉᵐᵉ / 3ᵉᵐᵉ en exposant.
- « Plan d'eau » devient « Navigue en ».
- Saisies alignées en bas dans les cadres à deux colonnes.

## v244
- Titre « Les coéquipiers·ères » avec point médian.
- Fiche coéquipier : pastille Coéquipier / Coéquipière sans intitulé, au-dessus de Prénom et Nom.
- Tous les intitulés de fiche en capitales, y compris les intitulés tournants (Lieu de naissance / d'origine, Passeport / Carte d'identité).
- Santé placée avant Proche à contacter.

## v245
- Bouton de langue : appui court FR ⇄ langue étrangère ; appui long = langue suivante (FR-EN → FR-IT → FR-ES). Pastilles aux couleurs des drapeaux, FR sur fond blanc. Choix gardé.
- Italien et espagnol pour tous les textes de fiche déjà traduits en anglais.
- Popups (toasts) et messages des pastilles (« Changer pour … ? ») traduits dans la langue choisie.
- Mes bateaux : Modèle et Année sur une ligne (année étroite, 4 chiffres) ; cases Tirant d'eau / Tirant d'air et leurs minimums raccourcies.
- Imprimer ou envoyer : boutons « Toutes les sections / Aucune section » retirés ; sous chaque section cochée, chaque entrée se coche ou se décoche une à une. « Numéros utiles (page SOS) » retiré de Mes bateaux (impression et envoi).

## v246
- Fiche coéquipier : Prénom en haut à gauche, pastille Coéquipier / Coéquipière à sa droite (ajustée au texte), Nom dessous sur toute la largeur.

## v247
- Bouton de langue : un seul rond qui montre la langue vers laquelle on passe (FR sur fond blanc, EN sur drapeau britannique, IT et ES tricolores). Appui long : langue suivante.

## v248
- Rond de langue sur chaque page de data, y compris la page principale ; textes de la page data et des listes principales traduits (EN, IT, ES).
- Rond de langue un tiers plus petit (36 px).

## v249
- Le rond de langue montre la langue affichée (FR en français, EN en anglais…).

## v250
- Pastille Coéquipier / Coéquipière traduite par Male / Female (EN), Maschio / Femmina (IT), Masculino / Femenino (ES).

## v251
- Les coéquipiers·ères : section « 📨 Fiche vide à faire remplir ». 💬 envoie une fiche vide en message texte (WhatsApp…) avec des « Intitulé : » à compléter ; 📄 la même fiche vide en PDF.
- 📥 Fiche reçue : coller le message complété (une ou plusieurs fiches) → fiche créée ; si une fiche semblable existe (même nom, téléphone, courriel ou pièce), arbitrage case par case : garder l’actuelle ou la reçue, fusionner, créer à part ou ignorer.
- Correction : le choix « Lieu de naissance / d’origine » est maintenant enregistré.

## v252
- Imprimer : la liste des éléments (ex. « Savannah ») n’apparaît que s’il y en a plusieurs, sous un titre clair (« Bateaux à imprimer ») ; le nom du bateau est toujours dans le titre, plus comme entrée.
- Modèles d’impression : « Modèle 1 » d’office, ＋ pour en ajouter (copie de la sélection), chaque modèle garde ses sections et entrées cochées ; nom effacé = modèle supprimé.
- Cases de saisie : un texte plus long que la case défile une fois tout seul, puis à chaque appui.

## v253
- Fiche coéquipier : bouton « 📸 Envoyer la fiche en image » (image propre de toute la fiche, à renvoyer à la personne pour un dernier contrôle).

## v254
- Mes bateaux : la case « Pas d’hélice en marche arrière » prend toute la largeur (jusque sous Année), l’intitulé tient sur une ligne.

## v255
- Impression et envoi de la fiche bateau : la ligne Gasoil / Électrique porte l’intitulé « Énergie de propulsion ».

## v256
- Imprimer ou envoyer : les photos (papiers du bateau, photo de groupe d’un équipage) sont ajoutées par défaut avec leur libellé ; en bas de liste, « Photos à imprimer » permet de les décocher une à une (gardé dans le modèle d’impression). En PDF elles suivent la fiche, en image chaque photo part avec son libellé.

## v257
- Imprimer : les photos forment une section « Photos » (cochable comme Données techniques, chaque photo dessous) ; à l’impression, titre « Photos » avant les images.

## v258
- Envoi en image : les photos sont dans la même image que la fiche, sous un titre « Photos », chacune avec son libellé (une seule image à envoyer).
- Mes bateaux : « Supprimer ce bateau » tout en bas de la page, après Imprimer ou envoyer, visible quand le bateau est ouvert.

## v259
- Bouton provisoire « Versions précédentes des données » barré de rouge en travers (à retirer plus tard).
- « ＋ Ajouter un libellé » placé juste au-dessus de « Supprimer ce bateau », en bas de page.

## v260
- Imprimer ou envoyer : choix de mise en page « 1 · Cartes NavIn » (défaut), « 2 · Carnet marin », « 3 · Minimaliste », pour l’image et le PDF ; gardé dans le modèle d’impression. La fiche bateau envoyée depuis le bateau et la fiche coéquipier en image utilisent la même mise en page.

## v261
- Mes bateaux : intitulé « Navigue », pastille « en eaux intérieures » / « en eaux maritimes » (minuscule), aussi à l’impression. Valeurs enregistrées inchangées.

## v262
- Menu NavIn : la VHF n’apparaît qu’en eaux maritimes ; en eaux intérieures le choix devient un combiné de téléphone noir avec son cordon (appui long : appeler les secours par téléphone, page existante).

## v263
- Pastilles et intitulés protégés : même formulation partout, avec le texte affiché. Appui court : « Modifier pour en eaux maritimes ? ». Popup : « Pour modifier pour « … » : appui long … · sans appui long, « … » reste ». Confirmation : « ✓ Modifié : … ». Traductions EN/IT/ES mises à jour.

## v264
- Bouton Téléphone (eaux intérieures) : combiné penché à 45°, sans cordon, blanc sur le bouton bleu, noir sur pastille blanche sinon.

## v265
- Tous les réglages › Général : « 🧪 Simuler la zone » Auto (GPS) / Lac / Mer. Le choix persiste (ldb.zoneSim) jusqu’au retour sur Auto ; il agit sur navZone (touche VHF/Téléphone, SOS, page VHF).

## v266
- Simulation de zone : tout suit (isLake et navZone) : horloge UTC d’abord en Mer, Zone Time en Lac, rubriques, tuiles et cartes de la navigation en cours, VHF, SOS.

## v267
- Bouton NavIn : logo « Nav⛵n » ; choix en pictogrammes sans cadre : START = rond vert ▶, STOP = panneau octogonal, PréP = drapeau à damier, Téléphone (eaux intérieures) = téléphone de bureau historique au combiné soulevé.

## v268
- Fin de trace : le pictogramme STOP devient un signe de fin (trace en pointillés qui arrive à un fanion d’arrivée, étiquette FIN) ; confirmation « FIN ? confirmer ».

## v269
- START : pictogramme de départ de course (fanion vert, étiquette START, trace qui part en pointillés), pendant du signe FIN.
- (v270) Téléphone : combiné iconique qui sonne et vibre (traits + secousse). Pictogrammes sans cadre à la pleine hauteur du bouton NavIn ; logo NavIn agrandi.

## v271
- SOS : trois grandes lettres rouges ajustées à toute la pastille, sans cadre.

## v272
- SOS ouvert (page SOS) : rectangle rouge plein, SOS en blanc dedans.

## v273
- data : pictogramme livre de bord ouvert (lignes + ancre), sans cadre ; page data ouverte = fond gris.

## v274
- data : retour au mot « data » (cadre gris), plus gras, police arrondie (ui-rounded sur iPhone) qui accentue les minuscules.

## v275
- Roue des réglages redessinée : plus grande (46 px), traits fins, 12 dents, couronne, 6 évidements, moyeu avec 6 boulons.

## v276
- Téléphone (eaux intérieures) : dessin rétro plus arrondi et graphique (dégradé, reflets, cadran à 10 trous, centre rouge), toujours avec vibration.

## v277
- Roue des réglages évidée : roue crantée, couronne fine, 3 rayons et petit moyeu.

## v278
- Drapeau PréP : « PréP » en petit sous le drapeau, entre le mât et le bord, avec de l’air autour.

## v279
- Téléphone : dessin inspiré du W 48 (bakélite noire arrondie, combiné à coupelles rondes posé sur la fourche, cadran à 10 trous et butée), toujours avec vibration.

## v280
- Téléphone redessiné d’après la photo du W 48 : socle carré arrondi avec étiquette, col qui porte le cadran, fourche en U, long combiné à grosses coupelles.

## v282
- Téléphone W 48 redessiné plus fidèlement (courbes, tons de noir, brillances, coupelles inclinées, fourche en U, cordon). Seul le combiné vibre de gauche à droite sur sa fourche ; plus de traits de vibration.

## v283
- PréP en cours : le bouton NavIn montre le drapeau à damier qui flotte au vent avec « PréP » dessous (au lieu de « PréP en cours »). Choix proposé P1 inchangé (fixe).

## v284
- Téléphone : combiné d’une seule pièce, plus arrondi, écouteur et parloir fondus dans la barre.

## v285
- PréP en cours : « PréP » clignote entre noir et orange (L3). Page PréP ouverte : le drapeau flotte ; sur une autre page : drapeau fixe (L3b).

## v286
- Choix de la planche : F1 et S1 gardés ; F2 = « FIN » clignote pendant la confirmation ; S3 = trace en cours (pointillés qui défilent derrière un petit voilier) ; M1 = Point en épingle de carte.

## v287
- M3 : Amarrage = bitte d’amarrage avec son cordage.

## v288
- Fin de trace : l’étiquette rouge affiche « END » au lieu de « FIN » (choix et confirmation).

## v289
- Fin de trace : étiquette « FINISH », en pendant de « START » (vocabulaire de course).

## v290
- Après FINISH confirmé : pendant 3 s, la trace bleue immobile avec un grand V vert tracé par-dessus (sans pastille), puis retour au logo NavIn.

## v291
- Étiquette de fin : retour à « FIN ».
- Téléphone encore plus proche de la photo W 48 : coupelles en cloche ouvertes vers le bas, épaule du socle, fourche aux bras épais, cadran à chiffres.

## v292
- Menu NavIn pendant la trace : Point, Téléphone (VHF en mer), Accostage, FIN, puis Amarrage.

## v293
- Menu NavIn pendant la trace : Point, Téléphone (VHF en mer), Amarrage, FIN. Accostage retiré du menu.

## v294
- Boutons du bandeau : plus d’étape intermédiaire « ✓ choix » vert sur le bouton après l’appui long ; l’action part directement (la bulle d’aide reste).

## v295
- Écran de départ : NavIn, PréP, START, Téléphone (fixe, sans vibration).
- v295 (suite) : plus de cadre vert autour des choix en attente ni après l'appui long.
- v296 : le téléphone reste fixe aussi pendant une trace (ordre Point, Téléphone, Amarrage, FIN).
- v297 : pendant une trace, FIN revient après chaque choix (Point, FIN, Téléphone, FIN, Amarrage, FIN).
- v298 : « Point » pose une épingle rouge sur la trace. Sans GPS (aperçu), un point simulé est posé sur la trace sans rien écrire au journal.
- v299 : « Zone de navigation » en tête des réglages de la roue (court et long), un seul bouton qui alterne Eaux intérieures, Maritime, Plan d’eau par GPS. Ce n’est plus une simulation : sert à préparer une sortie à l’avance.
- v300 : PréP ne demande plus Lac ou Mer : lac → type de sortie directement, mer → durée directement, selon la Zone de navigation. Homme à la mer : onglets Lac / Mer retirés. Page « aucune navigation » : seulement les types de la zone.
- v301 : plus d'appui long sur la roue. La roue montre la Zone de navigation, les réglages de l’onglet (selon le plan d’eau) puis la partie Général.
- v302 : réglages sans bouton « Retour : NavIn » (on touche NavIn, data ou SOS) ; Zone de navigation tout en haut, puis mode nuit.
- v303 : plus d'appui long sur SOS (il agit comme un toucher) ; VHF sans onglets Intérieure / Extérieure, la Zone de navigation décide.
- v304 : « Plan d’eau par GPS » devient « 🛰️ Choix par GPS », puis « Automatique par GPS ».
- v305 : pictogramme « Eaux intérieures » = contour du Léman (nord en haut) rempli de bleu clair.
- v305 : libellé « 🛰️ Automatique par GPS ».
- v306 : libellé « En eaux intérieures ».
- v307 : horloge écrite comme sur l’iPhone (police système, demi-gras) ; Zone Time en noir, UTC en rouge.
- v308 : en navigation, la tuile « Équipage à bord » est fusionnée dans « 👥 Équipages » (équipage réel d’abord, bouton « Groupes enregistrés » dedans).
- v309 : texte d’envoi de la fiche coéquipier·ère selon le modèle de Corban (consignes, H ou F, carte d’identité OU passeport) ; anciens messages toujours lus.
- v310 : appui long sur le logo NavIn = bascule En eaux intérieures ⇄ Maritime.
- v311 : logo NavIn selon la zone (LD Léman bleu clair en eaux intérieures, MA grande vague en maritime).
- v312 : bouton NavIn actif en eaux intérieures sur fond bleu-vert du Léman (C1, #0e6e7e) ; la mer garde le bleu.
- v313 : téléphone réduit dans un rectangle arrondi (fond ivoire), comme la touche VHF.
- v314 : sur la page Téléphone, tout le téléphone vibre.
- v315 : touche Téléphone en bakélite blanche sur fond gris foncé chaud (#4d4842), différent de data.
- v316 : téléphone de nouveau en bakélite noire, fond transparent avec cadre fin ; vibre plus fort sur la page Téléphone.
- v317 : petit satellite en haut à droite du logo NavIn quand la zone est automatique par GPS.
- v318 : appui long sur NavIn = En eaux intérieures → Maritime → Automatique par GPS (troisième appui).
- v319 : le petit satellite n'apparaît que sur le logo NavIn (pas sur le téléphone ni les autres états).
- v320 : appui long sur la roue = mode nuit, nouvel appui long = mode jour.
- v321 : en mode nuit, fond de carte sombre et atténué façon traceur (tuiles inversées, assombries).
- v322 : téléphone gris clair en mode nuit.
- v323 : nouvelle fiche directement en ♂ Coéquipier (plus de grosse pastille vide), symboles ♂ / ♀ sur la pastille (FR/EN/IT/ES).
- v324 : pastille sexe en symboles seuls (♂ / ♀, « ♂ / ♀ ? » tant que rien n'est choisi), plus de mots Coéquipier / Coéquipière dans aucune langue, pastille placée avant le prénom ; nouvelle fiche démarre sur « ♂ / ♀ ? ».
- v325 : pastille ♂ / ♀ remise après le prénom (Corban).
- v326 : case ♂ / ♀ même hauteur que Prénom et Nom (60 px), largeur fixe, symboles centrés.
- v327 : traduction complète EN / IT / ES des pages data, fiches et réglages (environ 610 textes ajoutés : SOS, homme à la mer, règles du Léman, documents, Beaufort, Douglas, alphabet, réglages, croisière, journée, fiche du jour, À bord, impression, échanges, cartes, zones). Fiche vide à faire remplir envoyée (texte et PDF) dans la langue affichée, relue au retour quelle que soit la langue.
- v328 : PréP avec « ◀ Retour » en haut à gauche comme les pages data (en équipage et check-in aussi) ; chaque page PréP = pastilles + titre seul (sans « PréP n/6 », sans ✕).
- v329 : pastilles PréP sans saut (lac : 5 étapes sans Durée ; mer : 5 étapes sans Type).
- v330 : touche « ✕ Sortir » à droite de Retour sur chaque page (PréP : quitte PréP ; ailleurs : racine de l'onglet). Boutons d'ajout (＋ …) toujours dans la page sous les listes, plus dans la barre du haut.
- v331 : « Sortir ✖ » tout à droite, croix pleine après le texte ; Retour et Sortir même graisse et même largeur.
- v332 : Retour / Sortir en texte normal, grande flèche ◀ calée à gauche et grande croix ✖ calée à droite (CSS).
- v333 : en PréP, pastilles remontées dans la barre entre la grande flèche et la grande croix, sans les mots Retour / Sortir.
- v334 : PréP Équipage sans « Contrôle de l’équipage » : un équipage enregistré choisi passe directement au check-in ; « Nouvelle composition » ouvre « Nouvel équipage » (personnes, rôles, « ＋ Ajouter une personne », Valider). Cadre du nom réparé (label.field en bloc).
- v335 : PréP équipage / check-in : bouton ▶ Suivant en haut (entre les pastilles et la croix), barre du bas supprimée (Corban ne pouvait pas passer à la page suivante).
- v336 : en mode nuit, cadre rouge autour du téléphone quand il vibre (page Téléphone).
- v337 : pastilles PréP en grand dans la barre ; si la place manque, seulement précédente / en cours / suivante avec « … » et le dernier numéro.
- v338 : mode nuit, « PréP » sous le drapeau en blanc (clignote blanc / orange).
- v339 : roue › Général : « Bulles d’aide (pop-up) : OUI / NON » masque ou réaffiche toutes les bulles noires (settings.noPopups).
- v340 : PréP en mode nuit, parties blanches du drapeau et texte en rouge nuit (clignote rouge/orange).
- v341 : pastilles PréP plus grandes (42 px), espacées, cliquables pour consulter sans remplir ; remplie / en cours / consultée (numéro orange).
- v342 : bulles d'aide en blanc sur noir translucide (flou de l'arrière-plan), plus légères et aérées ; nuit : rouge sur noir translucide.
- v343 : Réglages réorganisés en 8 rubriques dépliables (ordre logique, rubrique de l'onglet ouverte) ; textes d'explication remplacés par ⓘ (bulle) ; bulle déplaçable au doigt (position gardée, double toucher = origine, toucher = fermer).
- v344 : PréP Check-in = check-in unique du bateau, page simplifiée ; data › Check-lists des bateaux : check-in de chaque bateau (modifier, dupliquer, nouvelle liste de check-in) puis bases modèles.
- v345 : roue des réglages remplacée par le dessin G3 (trois curseurs), jour et nuit.
- v346 : curseurs G3 à intérieur transparent (la carte se voit à travers).
- v347 : T3 retenu, boutons NavIn (tous ses états) et data en verre dépoli, plus foncé la nuit ; cases blanches du drapeau PréP transparentes le jour ; bulles en verre dépoli.
- v348 : boutons NavIn et data sans cadre au repos (verre dépoli seul) ; cadre seulement pendant le choix.
- v349 : couleurs de fond d'origine de NavIn et data remises, en verre dépoli semi-transparent (jour et nuit).
- v350 : pages data, boutons d'action pleine largeur l'un sous l'autre, ＋ en bleu, les autres en blanc (Équipage : Nouvelle fiche / Modifier les fiches, etc.).
- v351 : bouton data en cadre filaire, fond transparent sans effet de verre.
- v351 (suite) : page de départ, une bulle présente un bouton à chaque ouverture (NavIn, data, SOS, curseurs, heure, bulles), une fois chacune, le bouton présenté pulse en orange.
- v352 : page de départ, glisser les boutons du haut vers le haut et le tableau du bas vers le bas pour libérer la carte ; poignée pour les rappeler ; retour automatique en revenant sur la vue.
- v353 : NavIn sans aucun cadre dans tous ses états (verre semi-transparent seul).
- v354 : data, fond gris clair quand on est dans le menu data.
- v355 : messages vides suivis d'une explication (ex. PréP Équipage) : 1re phrase visible, explication en ⓘ.
- v356 : pastille sexe vide = ⚲ sur fond blanc ; tap cycle ♂ ♀ ⚲ (Non genré, violet).
- v357 : data sélectionné sans cadre, fond gris.
- v358 : sigles ♂ ♀ ⚲ dessinés en SVG (même cercle, même trait), tailles proportionnelles.
- v359 : typologie des boutons : tout ＋ (ajouter/créer) bleu plein partout, toute la largeur ; consulter/modifier blanc bordé ; supprimer rouge.
- v360 : page Équipages = équipage à bord (en navigation) + équipages enregistrés + ＋ Nouvel équipage ; plus de lien vers les fiches ; ＋ Nouveau coéquipier.ère ouvre une fiche vide et l'ajoute à l'équipage.
- v361 : coche verte ✔ entre Retour et Sortir sur chaque fiche (valide et revient) ; listes de fiches : toucher court = sélectionner, appui long = ouvrir et modifier.
- v361 : glisser la barre du haut / le tableau du bas fonctionne au doigt (touch-action none ; la bande de bord de la carte ne couvre plus l'heure).
- v362 : PréP étape 4 titrée « Check-in » seul ; sous chaque titre, en petit, les choix déjà faits (ex. Entraînement · Savannah · Crack).
- v363 : barres de rappel de la carte collées tout en haut et tout en bas de l'écran.
- v364 : bouton Valider de page (PréP › Nouvel équipage) remplacé par la coche verte du haut ; coche aussi sur l'édition d'un équipage ; petite barre du bas collée au bord même.
- v365 : étape Départ de PréP : « Check-in » ajouté au rappel des choix, orange clignotant s'il n'est pas terminé, gris sinon.
- v366 : check-list : un point rouge reste à sa place ; seuls les points verts descendent dans Déjà fait.
- v367 : PréP : chaque mot du rappel des choix se touche pour revenir à son étape ; étape pas faite (bateau, équipage…) ou check-in pas fini en orange clignotant.
- v368 : PréP sans pastilles : ligne des titres d'étape sous la barre (gris rien fait, orange commencé, vert fini ; le titre devient le choix ; toucher = aller à l'étape) ; barre ◀ ▶ ✔ ✖ toujours présente.
- v369 : check-lists : tous les points restent à leur place (verts compris), plus de « Déjà fait » ; pastille verte faits/total en bas à gauche ; appui long sur un vert = remis à faire.
- v370 : titre de chaque page fixe sous la barre (ne défile plus) ; compteur faits/total des check-lists juste avant le titre.
- v371 : barre de progression « n / total fait » retirée des check-lists (doublon du compteur du titre).
- v371 : état intermédiaire des check-lists en orange (couleur de la préparation) au lieu du rouge.
- v372 : heure : un toucher bascule UTC / Zone Time pendant 5 s, un 2e toucher revient tout de suite.
- v373 : PréP : appui long sur la croix rouge = tout remettre à zéro (choix, équipage à bord, points du check-in) ; toucher court = quitter.
- v374 : appui long sur la croix rouge de PréP n'efface plus que les sélections (bateaux, fiches, équipage à bord, check-in intacts) ; « Type de sortie » renommé « Sortie ».
- v375 : titre de la page du choix de sortie : « Sortie de type ».
- v375 : ligne des étapes : « Sortie » reste grise tant que rien n'est choisi ; après remise à zéro, Check-in gris aussi.
- v376 : remise à zéro de PréP (appui long croix rouge) : garde lac ou mer et revient directement aux trois choix de sortie.
- v377 : rapport PréP + check-in (sortie, bateau, équipage, points, observations, photos) en image ou PDF : boutons à la fin du check-in et page « PréP et check-in » dans data › PDF / impression. « Ouvrir la batterie du moteur » retiré du check-in Savannah. Nom du bateau corrigé dans la liste d'équipage.
- v378 : « Tout cocher / Tout décocher » (listes à imprimer) et « Tout / Rien » (PDF / impression) remplacés par une case maîtresse « Tout » en haut de liste (✔ tout, – une partie, vide rien) ; aussi pour les sections à imprimer.
- v379 : check-in : appui simple = orange, appui long = vert ; appui long sur un vert = retour au blanc (valeur gardée), et s'il y a une photo, question « supprimer la photo ? » (suppression par appui long). Plus de double appui. Mes bateaux : flèche à droite retirée.
- v380 : check-in : bouton ✎ à droite du titre : édition sur place (texte, ordre ▲▼, suppression par appui long, ajout, « Copier la liste » pour l'envoyer et la reprendre comme liste de base).
- v381 : check-in : appui court sur un point vert = montre ou cache ses photos (avec « Ajouter une photo ») ; nombre de photos 📷 n sur le point ; « Ajouter une photo » dans le point orange ; suppression d'une photo par appui long.
- v382 : check-in Savannah de base = liste validée par Corban (9 points) ; « Allumer le moteur et relever les heures moteur ».
- v383 : check-in Savannah de base = 8 points validés par Corban (frigo retiré du check-in, gardé en croisière) ; relevés : « Checker le niveau de carburant », « Tension de la batterie 1/2 », « Niveau d’eau potable ».
- v384 : check-in : points à valeur : un point qui finit par « : » demande un chiffre ; l'unité fixe (%, L, kWh, V, h, bar, °C ou nombre) se choisit en édition ✎ sous chaque point. Liste copiée avec les unités. En édition, la liste normale est masquée.
- v385 : check-in Savannah de base = 9 points (ajout « Sortir la bouée fer à cheval » après les gilets).
- v386 : check-in : après une saisie dans un point orange, bulle « Appui long sur le point pour valider la valeur (vert) ».
- v387 : check-in : « Fiche du jour » retirée ; constat remplacé par un bouton « Observations » (violet, dans son propre cadre, en fin de liste : commentaire + photos) ; la liste dans son cadre ; les deux boutons de rapport remplacés par « 📤 Publier » (gris anthracite) qui propose image ou PDF.
- v388 : « Publier » : choix des 3 mises en page (Cartes NavIn, Carnet marin, Minimaliste), case « Inclure les photos », puis Image (écran) ou PDF A4 ; même gabarit que l'impression des listes ; choix gardés (settings.repTheme / repPh).
- v389 : alertes de vent à chaque degré Beaufort dès 4 Bf (11 nd), au lieu de tranches de 5 nd dès 10 nd ; légende en Beaufort.
- v390 : rapport PréP + check-in : toutes les photos d'un point juste sous ce point (image et PDF), celles des observations sous les observations.
- v391 : légendes des photos écrites DANS la photo (en bas), avec un contraste choisi selon la clarté de la photo : images partagées, PDF, vignettes de l'appli.
- v392 : durée des bulles selon leur longueur (lecture normale ≈ 200 mots/min : 1,5 s + 0,3 s par mot, de 2,5 à 25 s).
- v393 : bouton « 📤 Publier » gris anthracite sur les listes data (coéquipiers, équipages, bateaux, traces, marques…) : même fenêtre que le check-in (mise en page, photos, Image ou PDF), puis réglages de l'envoi et envois propres (fiche vide, fiche de contrôle vide). Photos sur la fiche coéquipier·ère (photothèque, fichier ou appareil photo).
- v394 : bouton « 📷 + photo » identique partout ; « 📤 Publier » remplace Envoyer la fiche (bateau, coéquipier), PDF A4 de la liste d'équipage et du dossier, Partager les logs SOS / MOB ; vignette ronde du visage (cadrage auto si possible, sinon à la main) à côté du nom, aussi dans les fiches publiées.
- v395 : PréP lac : trois chemins indépendants (Entraînement, Location, Invitation), chacun garde bateau, équipage, étape et check-in ; la croix rouge (appui long) n'efface que le chemin en cours. Location : fiche « Tarif » après le bateau (tarif du moment proposé, montant dans la fiche du jour).
- v396 : listes data (bateaux, coéquipiers·ères, équipages) : un toucher ouvre directement (l'appui long reste là où l'élément est cité ailleurs). Bateaux : crayon ✎ à droite du nom (Mes bateaux et dossier) pour renommer les libellés, ajouter, ordonner et supprimer les siens ; plus de bouton « ＋ Ajouter un libellé ».
- v397 : crayon ✎ sur la fiche coéquipier·ère (libellés communs à toutes les fiches : renommer, ajouter, ordonner, supprimer) ; « PDF / impression » devient « 📤 Publier le livre de bord » (bouton anthracite Publier).
- v398 : PréP : dès deux ou trois chemins lancés, petit bouton « 2x » / « 3x » tout à gauche de la ligne des étapes (retour au choix du chemin) ; le chemin en cours reste orange jusqu'au départ ou à l'effacement.
- v399 : PréP : plus de prix dans la ligne des étapes ; si les étapes ne tiennent pas en largeur, la ligne défile au doigt, l'étape en cours est centrée et un fondu montre qu'il en reste d'un côté.
- v400 : fenêtre Publier : fiche coéquipier, deux cases claires « 🙂 Vignette du visage » et « 🖼 Photos complètes » ; une seule photo = une seule case, la liste photo par photo n'apparaît qu'à partir de deux.
- v401 : PréP Location : « Tarif » remis dans la ligne des étapes (puis « CHF n » une fois choisi).
- v402 : « Tarif » gris tant qu'aucun tarif n'est choisi.
- v403 : « Tarif » : gris tant que pas vu, vert avec le montant une fois choisi, orange si l'étape est sautée ; plus de tarif appliqué d'office (le tarif du moment reste proposé sur la fiche).
- v404 : au choix du bateau en Location, le tarif du moment (journée ou soir, semaine ou week-end) est mis d'office (vert), modifiable sur la fiche Tarif ; gris ou orange seulement si aucun tarif ne correspond.
- v405 : le tarif du moment est seulement présélectionné sur la fiche Tarif ; « Tarif » reste gris dans la ligne tant qu'on ne l'a pas touché (vert une fois choisi, orange si sauté).
- v406 : pastille 💬 déplaçable sur toutes les pages : la poser sur l'endroit à améliorer, toucher, écrire ou dicter la remarque, « 📨 Envoyer à Claude » (dans l'aperçu : commentaire ancré envoyé à Claude ; ailleurs : gardée et copiée, « Mes remarques »).
- v407 : carte maritime simulée (fond dessiné, rives du Léman, teintes d'eau selon la distance à la rive, quadrillage, rose des vents), prise d'office si les cartes ne chargent pas ; pastille remarque : envoi direct tenté d'abord, raison affichée sinon.
- v408 : pastille remarque : si claude.ai refuse l'envoi direct, la remarque est posée, copiée, et la fenêtre dit d'écrire « remarque » dans la conversation ; plus de double envoi.
- v409 : fiche « 📡 Instruments du bateau » (nmea.js) : connexion Signal K en Wi-Fi (WebSocket, aussi NMEA 0183 texte), mode d'emploi en 7 étapes, import de fichiers NMEA 0183 (comme GPX) ; position des instruments prioritaire sur le GPS du téléphone, vent réel ajouté au journal automatique. Mode nuit des cartes : plus clair et contrasté, carte simulée avec palette de nuit.
- v410 (nettoyage de nuit) : explications plus jamais automatiques, pastille « i » à côté du titre ; réglage « Bulles d'aide (i) : OUI/NON » (remplace « pop-up », les bulles de confirmation restent) ; 155 traductions EN/IT/ES ajoutées (toutes les bulles de confirmation et d'aide des pages data) ; robustesse : listes lues sûrement (store.arr), journal d'erreurs ldb.errLog (dans la sauvegarde), copie ldb.preRestore avant restauration ; ARCHITECTURE.md.
- v411 : check-lists traduites (bouton de langue aussi sur la page check-list, 120 points et titres en EN/IT/ES) ; Réglages › Alertes : alertes de vent toujours visibles, test de l'alarme de profondeur rangé ici (sorti du mode développeur).
- v412 : alertes de vent en couleurs progressives (vert → jaune → orange → rouge → bordeaux → violet noir) ; en mer, état de la mer (Douglas) et hauteur des vagues du modèle Open-Meteo Marine dans l'alerte, la bulle et l'entrée du journal ; nouvelle section Réglages › 🧪 Tests (essai des signaux de vent, tests de l'alarme de profondeur).
- v413 : essai des signaux de vent : chaque niveau affiche aussi l'état de la mer (Douglas) et la hauteur des vagues probables (repères OMM en haute mer).
- v414 : valeurs de base des calculs des bateaux (Corban) : pied de pilote 0,6 m, marge de hauteur 1,5 m, réduction de coque 1 %.
- v415 : alertes de vent en deux temps : d'abord les deux bips et les flashs de couleur avec le degré Beaufort, puis une fenêtre vitrée rouge en grand texte (Beaufort, vent, état de la mer, vagues) qui reste jusqu'au toucher.
- v416 : bouton renommé « ▶ Essai des alertes de vent » (Réglages › Tests et Alertes).
- v417 : carte maritime simulée en mer : côte de Méditerranée (Provence, Marseille à Saint-Raphaël, îles d'Hyères) au lieu du Léman quand la zone simulée est « mer » ; la position réelle en Suisse n'impose plus le Léman dans ce mode.
- v418 : changement de zone sur le traceur : la carte se recentre tout de suite (mer simulée = Méditerranée, eaux intérieures ou automatique = Léman ou position GPS).
- v419 : Réglages : toutes les rubriques fermées à l'arrivée, chevron bleu comme dans le reste de l'appli (rouge la nuit).
- v420 : « ▶ Test des alertes de vent » : arrêtable à tout moment (le bouton devient « ⏹ Arrêter le test », et la fenêtre d'alerte a aussi ce bouton).
- v421 : fiche Savannah de base mise à jour (fiche de Corban, champs calculés gardés automatiques) ; voiles : bouton de couleur + inscription ou dessin ; Mes bateaux : vignette rectangulaire sur le titre (🖼 Vignette sous une photo, reprise par Publier), Supprimer dans la fiche, Ajouter un bateau à part, plus de 2e Publier ; Tests : titre « Test des alertes de vent » ; alarme de profondeur : fenêtre plus haute, Couper le son et Arrêter le test côte à côte pendant un test.
- v422 : fenêtre d'alerte de vent en mer : hauteur de vagues du modèle à la position ET valeur théorique OMM de l'échelle de Beaufort (pleine mer, vent établi) ; le test affiche la valeur théorique OMM.
- v423 : alertes de vent OUI par défaut (rafales), actives dès que l'appli est allumée, avec ou sans navigation, sur tous les écrans ; bouton « 🔕 Pas d'alertes jusqu'à la fin de la trace en cours » (levé tout seul à la fin de la trace) ; voiles : description complète en petit (français + anglais) ; test profondeur : « Arrêter le test » seulement dans la fenêtre ; test du vent : exemple fictif de valeur du modèle à côté de la valeur théorique OMM, avec la réserve d'usage.
- v424 : fiche bateau : rubriques repliables (chevron) ; pas d'hélice « Sans » (blanc) en premier ; puissance en kW (« 13,3 kW » converti une fois) ; moteur électrique : type de batteries, puissance du pod, puissance du générateur thermique (back-up).
- v425 : type de batteries, puissance du pod électrique et du générateur thermique déplacés sous Informations (visibles seulement si l'énergie est « Électrique »).
- v426 : puissance en kW et en ch côte à côte (l'une calculée depuis l'autre, 1 kW = 1,36 ch) ; moteur et puissance thermiques masqués si l'énergie est « Électrique » (valeurs gardées).
- v427 : pod électrique et générateur aussi en kW + ch (calcul dans les deux sens) ; côté ch, seule l'unité est affichée ; « thermique » retiré du libellé du générateur.
- v428 : ancre en deux pastilles (type et chaîne / poids en kg), surface de voilure au près en nombre avec l'unité m² dans le titre (anciennes valeurs converties une fois).
- v429 : fiche personne, licence VHF en haut à droite et « Permis établi par » dessous ; plus d'espace entre les pastilles du bas (photos, publier, supprimer) ; sous-titre de « Publier » lisible.
- v430 : 2ᵉ bateau d'exemple « Inspiration » (Dufour 530, 2024, mer, électrique), ajouté une fois sauf si un bateau de ce nom existe déjà.
- v431 : 6 fiches coéquipier·ère d'exemple entièrement inventées (♂ ♀ ⚲, passeport ou carte, 1 à 3 proches, pièce valide, bientôt expirée ou expirée) et 3 bateaux fictifs (Alizé, catamaran Lagoon 42 à deux moteurs ; Bise Noire, Surprise du Léman ; Mistral, Bavaria C42), ajoutés une fois.
- v432 : 3 équipages d'exemple (Régate du jeudi, Croisière en Méditerranée, Sortie découverte) composés avec les fiches inventées, ajoutés une fois.
- v433 : tuile « Logs SOS » ; réglages Synchroniser et Mode édition, boutons empilés de même taille avec de l'air ; 4 icônes NavIn à essayer (marine, clair, Léman, voile), vignettes contenues dans leur bouton.
- v434 : 2 icônes NavIn combinant lac et mer (Léman + vagues) en tête du choix d'icône.
- v435 : icône « NavIn marine » par défaut pour tous (fichiers icon.svg, icon-192/512, apple-touch-icon et index.html) ; rubrique « Icône de l'appli » retirée des réglages.
- v436 : 11 marques d'exemple (7 sur le Léman, 4 en Méditerranée près de Toulon), ajoutées une fois.
- v437 : data, tuile Réglages retirée (roue dentée) ; « Cartes » devient « Mes cartes » et rassemble la carte ArcGIS du Léman (section Cartes en ligne).
- v438 : tuile « Mes check-lists » ; boutons de carte redessinés et rangés en une colonne à gauche.
- v439 : boutons de carte visibles jusqu'à action volontaire (bouton ‹ pour les ranger), plus de masquage automatique.
- v440 : rangement de nuit (aucun changement visible) : 221 déclarations CSS écrasées retirées, lectures de nav.js par la couche stockage.
- v441 : NavIn (et data) quitte les réglages vers la page principale ; « Garder l’écran allumé » OUI par défaut ; ligne « Essais de l’alarme » retirée des Alertes.
- v442 : page SOS : position SOS figée, position actuelle (30 s) et Go To, en chiffres et en mots ; phrase sous « Homme à la mer » retirée ; fenêtre Remarque déplaçable ; bouton mode nuit au-dessus de la zone.
- v443 : cadre SOS (libellés, mise à jour 5 s, simulation de position), section « Position actuelle » masquée pendant un SOS ; boutons Activer/Désactiver (écran, bulles) ; « Zone de navigation » dans le bouton.
- v444 : deux simulations SOS sur le Léman (Lausanne, eaux suisses ; Meillerie, eaux françaises) qui mettent à jour les numéros ; bouton de zone « Passer à : … ».
- v445 : page SOS sans chevrons (tout fixe) ; la fenêtre Remarque revient là où on l'a déplacée.
- v446 : simulations de position SOS déplacées dans Réglages › 🧪 Tests (Lausanne, Meillerie, Toulon), sans procédure ni log, arrêt en quittant la page SOS.
- v447 : Réglages › Tests : « Simulation complète du bouton SOS » (exercice Lausanne, Meillerie, Toulon : vrai déroulé, aucun appel réel, bandeau orange, log 🧪 Exercice).
- v448 : position SOS en mots : Léman par lignes entre rives (km) ; mer zone 1 cap Sicié → Saint-Aygulf par amers (milles et direction).
- v449 : dans le log SOS, chaque position GPS est complétée par la position en mots.
- v450 : nouveau répertoire Réglages › 🆘 Simulation SOS (exercice complet et simulation de position), sortis de 🧪 Tests.
- v451 : « ⏹ Terminer l’exercice » ramène dans Réglages › 🆘 Simulation SOS au lieu de rester sur la page SOS.
- v452 : exercice SOS sans vrai SOS (touche SOS du haut et fin de procédure restent dans l’exercice, retour Réglages › Simulation SOS) ; Léman : « dans l’axe entre A et B, à N km de B ».
- v453 : data actif = écriture blanche sur pastille grise ; roue active (Réglages et simulations SOS) = barres blanches sur pastille grise ; « SIMULATION » en travers du bouton SOS pendant une simulation.

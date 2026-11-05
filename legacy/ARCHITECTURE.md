# NavIn : architecture du code

NavIn est une appli web hors ligne (PWA), écrite en JavaScript simple, sans outil de compilation. Les fichiers sont chargés dans cet ordre (index.html) et partagent le même espace de noms :

`app.js` → `lake.js` → `map.js` → `chart.js` → `ui-edit.js` → `marks.js` → `prep.js` → `auto.js` → `nmea.js` → `nav.js`

`sw.js` met tous ces fichiers en cache, ce qui permet à l'appli de marcher sans réseau. À chaque version, il faut changer le nom du cache dans `sw.js` et `APP_VERSION` dans `ui-edit.js`.

## Les couches et où vit chaque règle

| Couche | Où | Contenu |
|---|---|---|
| 1. Stockage | `app.js` : `store` | `store.get` (lecture sûre avec valeur de repli), `store.set` (écriture protégée, alerte « Mémoire pleine »), `store.arr` (une liste est toujours un tableau d'objets), journal `ldb.errLog`. Toutes les clés commencent par `ldb.`. Les photos et PDF sont dans IndexedDB (`ldb-photos`, `putPhoto` / `getPhoto` dans `lake.js`). |
| 2. Données par entité | bateaux `lake.js` (`boats`, `saveBoats`, historique `b.hist`) ; coéquipiers `lake.js` (`members`, `saveMembers`) ; équipages `prep.js` (`crewSets`, `saveCrewSets`) ; navigations `app.js` (`cruise`, `index`, `saveCruise`, `openCruise`) ; marques `marks.js` ; logs SOS `prep.js` (`sosLogs`) | Chaque fiche s'enregistre toute seule : il n'y a jamais de bouton « Enregistrer ». Les migrations sont faites une seule fois et marquées par une clé ou un drapeau (`ldb.modelSplit`, `b.ck383`…). |
| 3. Comportements d'écran partagés | `nav.js` | Bandeau du haut et barre ◀ Retour / ✔ / ✖, bulles (toast, avec une durée de lecture), pastilles d'aide « i » (`helpToPopup`, réglage `settings.noHelpI`), suppression par appui long (`holdDel`, défini dans `app.js`), case maîtresse « Tout », modes de liste (toucher court ou long), pastille de remarque 💬. |
| 4. Préparation (PréP) | `prep.js` | Machine à étapes : but, bateau, tarif, équipage, check-in, départ. Les trois buts du lac sont trois chemins indépendants (`ldb.prepPaths`). Une remise à zéro ne supprime JAMAIS de données. |
| 5. Check-lists | `lake.js` | Gestes (toucher court = orange, appui long = vert, appui long sur un vert = blanc), mode ✎ (ordre, nom, unités, copie), points avec valeur, photos, observations. |
| 6. Carte, trace, journal | `map.js`, `chart.js`, `auto.js`, `marks.js`, `nmea.js` | Tracker et cartes Leaflet, carte simulée, courbes de profondeur du Léman, suivi GPS et entrées automatiques, import GPX et NMEA, instruments en Wi-Fi (Signal K). |
| 7. Sécurité | `prep.js`, `app.js`, `nav.js` | SOS et homme à la mer avec un log automatique, alarme de profondeur, alertes de vent par degré Beaufort dès 4 Bf, horloge UTC / Zone Time, zone de navigation (automatique ou simulée). |
| 8. Publication | `nav.js` (`lxOpen`, `cardsPng`, `printList`, `pubModal`), `app.js` (`printBook`), `prep.js` (rapport PréP) | Une seule fenêtre « 📤 Publier » remplace toutes les impressions et tous les exports. Les données transférées (sauvegarde, synchro, GPX) restent à part. |
| 9. Langues | `nav.js` : `TR_V327`, `FICHE_DICT`, `UI_FIXED`, `UI_PAT`, `FICHE_PARTS`, `window.uiTr` | Le français est la langue de base. L'anglais, l'italien et l'espagnol sont appliqués sur les pages data quand on choisit une langue avec le bouton de langue. Chaque nouveau texte reçoit ses trois traductions. |

## Règles de robustesse

- Une lecture ne plante jamais : une donnée abîmée redonne la valeur par défaut (`store.get`, `store.arr`), et une fiche reçoit les champs qui lui manquent (`info`, `crew`, `id`).
- Les erreurs imprévues sont notées dans `ldb.errLog` (les 50 dernières), sans rien afficher. Ce journal part dans la sauvegarde.
- Avant une restauration, une copie des bateaux, des coéquipiers et des équipages est gardée dans `ldb.preRestore`. La restauration vérifie le fichier, puis fusionne sans rien écraser.
- Aucune donnée personnelle de Corban ni de l'équipage n'est écrite dans le code. Les vraies données passent seulement par le fichier de sauvegarde.

## Aide et bulles

- Les explications ne s'affichent plus toutes seules. Un texte d'aide (`p.help`) est remplacé par une pastille « i » ; en tête d'un écran, elle se place à côté du titre. Un toucher affiche le texte dans la bulle.
- Le réglage « Bulles d'aide (i) : OUI/NON » (Réglages › Zone et écran) masque toutes les pastilles. Les bulles qui confirment une action, les alarmes et les erreurs restent toujours affichées.

## Suite du rangement (prochaines nuits)

### Nuit 2 (2026-11-05, v440)

- `style.css` : 221 déclarations qui étaient toujours écrasées plus loin par la même règle (même sélecteur, même propriété, importance égale ou plus forte) ont été retirées ; chaque réglage ne vit plus qu'à l'endroit qui s'applique réellement, avec son commentaire de décision. Les règles dont la version gagnante utilise une fonction récente (`:has`, `dvh`, `color-mix`, `backdrop-filter`, `field-sizing`) ont été gardées, pour les anciens téléphones. Vérifié : styles calculés de chaque élément identiques sur 160 vues (vide / avec exemples, jour / nuit), bulle et bouton d'aide identiques.
- `nav.js` : les lectures JSON (`ldb.folds2`, `ldb.toastPos`, `ldb.remPill`, `ldb.remarks`) passent par `store.get` (même résultat, même repli). Les écritures restent silencieuses comme avant (pas d'alerte « Mémoire pleine » pour ces réglages d'affichage).
- Restent pour les prochaines nuits : regrouper les 13 observateurs d'écran de `nav.js` (couche 3) en un seul passage, puis les couches 4 à 9 ; les blocs CSS par version qui se complètent (sans s'écraser) à fusionner règle par règle.

Le code garde encore des blocs ajoutés version après version (`/* v3xx (Corban) … */`) et des surcharges CSS empilées. Ils seront regroupés couche par couche, dans l'ordre du tableau ci-dessus. Chaque étape sera vérifiée par les captures d'écran, les tests de fonctionnement et le balayage de robustesse avant d'être publiée.

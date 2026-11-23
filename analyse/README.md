# Analyse météo, de l'hémisphère au local

Fabriquée sans Claude par le workflow GitHub « Analyse météo » (`.github/workflows/analyse.yml`) :

- toutes les 30 minutes il regarde si ECMWF IFS ou DWD ICON-EU ont publié un nouveau run ; si oui, il refait l'analyse des zones automatiques (`auto=True` dans `zones.py`, aujourd'hui Saint-Quay-Portrieux) ;
- le bouton « Run workflow » de GitHub, ou les boutons « Relancer » de NAVIn (Météo › Prévisions › Situation générale), refont une zone d'essai ou l'analyse autour d'un point GPS ;
- chaque version complète (page, cartes en WebP) est gardée dans la branche `analyses`, publiée avec NAVIn sous `analyse/v/` ; le menu déroulant des versions lit `analyse/v/index.json`.

Les scripts de `bin/` font les cartes et les chiffres, `texte.py` écrit le texte avec des règles fixes (aucune IA, aucune donnée inventée ; ce qui manque est dit avec un lien). Les courants Copernicus Marine demandent les secrets `COPERNICUSMARINE_SERVICE_USERNAME` et `COPERNICUSMARINE_SERVICE_PASSWORD` du dépôt.

Essai en local :

```sh
pip install -r analyse/requirements.txt
python3 -I analyse/run.py --store /tmp/store --zone saint-quay
python3 -I analyse/run.py --store /tmp/store --lat 48.7167 --lon -2.75
```
- `pluie.py` : pluie prévue heure par heure (ICON-EU, 48 h) pour la carte LiveMétéo, dans `pluie/`, publiée sous `analyse/v/pluie/`.

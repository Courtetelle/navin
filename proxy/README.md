# Relais de NavIn (METAR et bouées NOAA)

Les serveurs des METAR (aviationweather.gov) et des bouées NOAA (ndbc.noaa.gov,
dont les bateaux-feux et bouées du Met Office en Manche et mer du Nord) ne
laissent pas une page web lire leurs données. Ce petit relais les lit à la
place de NavIn et les lui rend avec la permission.

## Installer (gratuit, 5 minutes)

1. Créer un compte sur https://dash.cloudflare.com (offre gratuite).
2. Workers & Pages › Create › Create Worker › nommer « navin-relay » › Deploy.
3. Edit code : remplacer tout le contenu par celui de `navin-relay.js`, Deploy.
4. Copier l’adresse du Worker (https://navin-relay.<compte>.workers.dev).
5. Dans NavIn : Réglages › Clés météo › « Relais des METAR et bouées », coller
   l’adresse, Enregistrer.

Le relais ne sert que le site de NavIn, ne lit que ces deux serveurs, et garde
chaque réponse 5 minutes. L’offre gratuite de Cloudflare permet 100 000
requêtes par jour, très au-delà de l’usage de NavIn.

## Enregistrer les stations à clé NavIn fermé (facultatif)

Avec l’enregistrement installé (KV « NAVIN » et déclencheur toutes les 10
minutes), le relais peut lire lui-même les stations Météo-France autour des
points de NavIn (le GPS et les trois zones), même quand NavIn est fermé.

1. Workers & Pages › navin-relay › Paramètres › Variables et secrets ›
   Ajouter › type « Secret », nom `MF_KEY`, valeur : la clé Météo-France
   copiée depuis le portail de Météo-France › Déployer.
2. Pour l’Espagne : de même `AEMET_KEY` avec la clé AEMET OpenData.
3. Recopier le code du relais (NavIn › « 📋 Copier le code du relais ») et
   Déployer.

Les clés restent chez Cloudflare comme secrets : le relais ne les renvoie
jamais. Il lit à chaque passage les stations les plus proches de chaque point
et, à tour de rôle, les suivantes (environ toutes les 30 minutes), dans la
limite de 50 requêtes par passage de l’offre gratuite.

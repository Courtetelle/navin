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
5. Dans NavIn : Réglages › Alertes › « Relais des METAR et bouées », coller
   l’adresse, Enregistrer.

Le relais ne sert que le site de NavIn, ne lit que ces deux serveurs, et garde
chaque réponse 5 minutes. L’offre gratuite de Cloudflare permet 100 000
requêtes par jour, très au-delà de l’usage de NavIn.

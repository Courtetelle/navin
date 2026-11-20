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

## Enregistrer toutes les stations NavIn fermé

Avec l’enregistrement installé (KV « NAVIN » et déclencheur toutes les 10
minutes), le relais lit lui-même, autour des points de NavIn (le GPS et les
trois zones), les stations de tous les réseaux de NavIn : MeteoSwiss, balises
OpenWindMap, aéroports (METAR), bouées NOAA, ItaliaMeteo, Puertos del Estado,
SOCIB, IPMA, Rijkswaterstaat, DMI, SMHI, FMI et DHMZ. Il les lit à tour de
rôle (chaque réseau toutes les 20 à 30 minutes environ), dans la limite de 50
requêtes par passage de l’offre gratuite.

Les réseaux à clé s’y ajoutent avec un secret chacun : Workers & Pages ›
navin-relay › Paramètres › Variables et secrets › Ajouter › type « Secret » :

- `MF_KEY` : la clé Météo-France ;
- `AEMET_KEY` : la clé AEMET OpenData (Espagne) ;
- `METOFFICE_KEY` : la clé Met Office (Royaume-Uni) ;
- `FROST_KEY` : l’identifiant client Frost (Norvège).

Puis recopier le code du relais (NavIn › « 📋 Copier le code du relais ») et
Déployer. Les clés restent chez Cloudflare comme secrets : le relais ne les
renvoie jamais.

## Synchroniser les appareils (facultatif)

Avec le stockage « NAVIN » installé, le relais garde aussi les données que
chaque appareil de NavIn y dépose pour les autres (Paramétrages › Sauvegarde
et synchronisation). Elles sont chiffrées sur l’appareil avec une clé qui ne
passe jamais par le relais : il ne peut pas les lire. Rien à régler ici,
sinon recopier le code du relais une fois et Déployer. Les clés météo de
NavIn voyagent dans ces données chiffrées. Les menus (listes, boutons), sans
aucune donnée personnelle, sont gardés en clair à l’adresse `/menus` du
relais, pour le développement de NavIn.

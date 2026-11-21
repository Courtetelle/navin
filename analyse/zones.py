"""Zones de l'analyse « de l'hémisphère au local » (zones d'essai de Corban du 20/11/2026, et tout point GPS).
Chaque zone : cadre régional (IFS) et local (ICON-EU, EWAM, Copernicus IBI), point de référence en mer pour les chiffres,
points à marquer. Le type dit ce qui a du sens : « maree » (vent, vagues, courants), « mer » (vent, vagues), « lac » (vent),
« auto » (point GPS : décidé d'après les données). `auto: True` = relancée automatiquement à chaque nouveau run."""

ZONES = {
    'saint-quay': dict(
        nom='Saint-Quay-Portrieux', court='Saint-Quay', bassin='baie de Saint-Brieuc', eyebrow='Zone Atlantique',
        lat=48.65210, lon=-2.83063, type='maree', auto=True,
        reg=(-12, 4, 44, 54), reg_nom='Manche et golfe de Gascogne', loc=(-3.25, -2.2, 48.45, 49.02),
        ref=('Point GPS de test', 48.7167, -2.75),
        points=[('Saint-Quay', 48.652, -2.8306, 'port'), ('Point GPS de test', 48.7167, -2.75, 'gps'), ('Grand Léjon', 48.7417, -2.6583, 'amer')],
        parc=(48.86, -2.52, 8.0)),
    'porquerolles': dict(
        nom='Porquerolles, Hyères et Toulon', court='Porquerolles', bassin='rade d\'Hyères et îles d\'Or', eyebrow='Zone Méditerranée',
        lat=43.00025, lon=6.20230, type='mer', auto=False,
        reg=(-1, 13, 38.5, 46.5), reg_nom='golfe du Lion et mer Ligure', loc=(5.75, 6.75, 42.82, 43.22),
        ref=('Sud de Porquerolles', 42.96, 6.20),
        points=[('Porquerolles', 43.000, 6.202, 'port'), ('Toulon', 43.10, 5.93, 'amer'), ('Hyères', 43.12, 6.13, 'amer')],
        parc=None),
    'rolle': dict(
        nom='Rolle, Léman', court='Rolle', bassin='Léman', eyebrow='Zone Lacs',
        lat=46.46015, lon=6.33805, type='lac', auto=False,
        reg=(1, 13, 42.5, 50), reg_nom='Alpes, Jura et Plateau', loc=(6.05, 6.95, 46.17, 46.62),
        ref=('Large de Rolle', 46.43, 6.36),
        points=[('Rolle', 46.460, 6.338, 'port'), ('Morges', 46.51, 6.50, 'amer'), ('Genève', 46.20, 6.15, 'amer')],
        parc=None),
}


def dms(lat, lon):
    """48.652, -2.83 -> « 48°39,1' N 002°49,8' W »."""
    def one(v, w):
        a = abs(v); d = int(a); m = (a - d) * 60
        return f"{d:0{w}d}°{m:04.1f}'".replace('.', ',')
    return f"{one(lat, 2)} {'N' if lat >= 0 else 'S'} {one(lon, 3)} {'E' if lon >= 0 else 'W'}"


def proche(lat, lon, km=5):
    """La zone d'essai à moins de km du point, sinon None (NAVIn envoie le lieu de sa zone ou le GPS)."""
    import math
    for zid, z in ZONES.items():
        d = math.hypot((z['lat'] - lat) * 111.2, (z['lon'] - lon) * 111.2 * math.cos(math.radians(lat)))
        if d <= km: return zid
    return None


def gps(lat, lon, nom=''):
    """Zone construite autour d'un point : lieu de la zone choisie dans NAVIn, ou position GPS (Corban, 21/11/2026)."""
    lat, lon = round(float(lat), 4), round(float(lon), 4)
    if not (30 <= lat <= 66 and -10.5 <= lon <= 30):
        raise SystemExit(f'point {lat} {lon} hors du domaine couvert (30–66° N, 10,5° W–30° E : ICON-EU et EWAM)')
    nom = (nom or '').strip()[:60]
    return dict(nom=nom or f'Point GPS {dms(lat, lon)}', court='Point GPS', bassin='autour du point', eyebrow='Position GPS',
                lat=lat, lon=lon, type='auto', auto=False,
                reg=(lon - 8, lon + 8, lat - 5, lat + 5), reg_nom='région', loc=(lon - 0.55, lon + 0.55, lat - 0.33, lat + 0.33),
                ref=('Point GPS', lat, lon), points=[('Point GPS', lat, lon, 'gps')], parc=None)


def slug_gps(lat, lon):
    return f"gps-{float(lat):.3f}_{float(lon):.3f}".replace('-', 'm').replace('gpsm', 'gps-').replace('.', 'p')

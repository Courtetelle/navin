"""Pluie prévue pour la carte LiveMétéo de NAVIn (demande de Corban du 23/11/2026) : aux heures à venir, la même
finesse que le radar de l'heure actuelle, au lieu de grandes cases autour des points de vent.

  python3 -I analyse/pluie.py --store DIR      prend le dernier run ICON-EU complet s'il n'est pas déjà là

Source : DWD ICON-EU (6,5 km, grille régulière 0,0625°, données ouvertes), TOT_PREC cumulé ; la pluie d'une heure est
la différence entre deux échéances, comme la « precipitation » d'Open-Meteo (cumul de l'heure qui précède).
Sorties, publiées avec NAVIn sous analyse/v/pluie/ :
  DIR/pluie/index.json            run, cadre (lat, lon), taille, échelle, heures valides et fichiers
  DIR/pluie/<run>_<hhh>.png       une image en niveaux de gris par heure : valeur = mm/h × 10 (255 = 25,5 mm/h et plus),
                                  ligne 0 au nord, une colonne par point de grille
Seul le dernier run est gardé."""
import argparse, bz2, datetime as dt, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import runs as R

# Cadre : Manche, golfe de Gascogne, Méditerranée française et Corse, Léman.
LAT = (38.0, 55.0)
LON = (-12.0, 16.0)
HOURS = 48
SCALE = 0.1   # mm/h par niveau de gris
URL = ('https://opendata.dwd.de/weather/nwp/icon-eu/grib/{h}/tot_prec/'
       'icon-eu_europe_regular-lat-lon_single-level_{run}_{step:03d}_TOT_PREC.grib2.bz2')


def field(run, step):
    """Pluie cumulée depuis le début du run (mm) sur le cadre, ligne 0 au nord."""
    import eccodes
    url = URL.format(h=run[8:], run=run, step=step)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r: raw = bz2.decompress(r.read())
            break
        except Exception:
            if attempt == 3: raise
    g = eccodes.codes_new_from_message(raw)
    try:
        ni, nj = eccodes.codes_get(g, 'Ni'), eccodes.codes_get(g, 'Nj')
        lat0 = eccodes.codes_get(g, 'latitudeOfFirstGridPointInDegrees')
        lon0 = eccodes.codes_get(g, 'longitudeOfFirstGridPointInDegrees')
        d = eccodes.codes_get(g, 'iDirectionIncrementInDegrees')
        north = eccodes.codes_get(g, 'jScansPositively') == 1
        v = eccodes.codes_get_values(g).reshape(nj, ni)
    finally:
        eccodes.codes_release(g)
    if lon0 > 180: lon0 -= 360
    if north: v = v[::-1]; top = lat0 + d * (nj - 1)
    else: top = lat0
    r0, r1 = round((top - LAT[1]) / d), round((top - LAT[0]) / d)
    c0, c1 = round((LON[0] - lon0) / d), round((LON[1] - lon0) / d)
    return v[r0:r1 + 1, c0:c1 + 1].astype(np.float32)


def png(values, path):
    from PIL import Image
    q = np.clip(np.round(np.maximum(values, 0) / SCALE), 0, 255).astype(np.uint8)
    Image.fromarray(q, 'L').save(path, optimize=True)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--store', required=True); a = ap.parse_args()
    out = os.path.join(a.store, 'pluie'); os.makedirs(out, exist_ok=True)
    idx_path = os.path.join(out, 'index.json')
    run = R.icon_eu()
    if not run: raise SystemExit('run ICON-EU introuvable')
    try: old = json.load(open(idx_path, encoding='utf-8'))
    except Exception: old = {}
    if old.get('run') == run: print('pluie : run', run, 'déjà là'); return
    with ThreadPoolExecutor(8) as pool: acc = list(pool.map(lambda s: field(run, s), range(0, HOURS + 1)))
    base = dt.datetime.strptime(run, '%Y%m%d%H').replace(tzinfo=dt.timezone.utc)
    hours, files = [], []
    for step in range(1, HOURS + 1):
        name = f'{run}_{step:03d}.png'
        png(acc[step] - acc[step - 1], os.path.join(out, name))
        hours.append((base + dt.timedelta(hours=step)).strftime('%Y-%m-%dT%H:%MZ')); files.append(name)
    h, w = acc[0].shape
    idx = dict(model='ICON-EU', source='DWD', run=run, lat=list(LAT), lon=list(LON), w=int(w), h=int(h), scale=SCALE,
               hours=hours, files=files)
    json.dump(idx, open(idx_path + '.tmp', 'w', encoding='utf-8'), indent=1); os.replace(idx_path + '.tmp', idx_path)
    for f in os.listdir(out):
        if f.endswith('.png') and f not in files: os.remove(os.path.join(out, f))
    print('pluie : run', run, f'{len(files)} heures, {w}×{h} points')


if __name__ == '__main__':
    main()

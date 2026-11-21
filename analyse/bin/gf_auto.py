"""Déclenchement automatique de la section « Goutte froide » de l'analyse (Corban, 20/11/2026).
Pour chaque échéance (12 UTC des jours suivis), cherche les gouttes froides CONFIRMÉES sur le dernier run IFS
(dépression fermée à 500 hPa dont le cœur est au moins 1 °C plus froid que l'anneau 500–900 km, featlib.analyser),
mesure leur distance aux zones d'essai et leur déplacement sur 12 h, et attribue le niveau d'alerte de Corban :
  1 : 800 à 1 500 km et déplacement > 16 nd ; 2 : < 800 km et < 13,5 nd ; 3 : < 500 km à l'ouest ou au sud-ouest et < 8 nd.
Une goutte froide à moins de 1 500 km d'une zone, quel que soit le déplacement, déclenche la section (niveau 0 si aucun
critère complet). Au-delà de 1 500 km : rien. Sortie data/gf_auto.json ; quand "section" est vrai, lancer gf_pair.py
(paire sol / altitude) au centre indiqué et ajouter la section à la page.
Usage : RUN=AAAAMMJJHH STEPS="30 54 78" python3 -I gf_auto.py"""
import os, sys, json, math, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import featlib
from geo import situer
ZONES = {'Saint-Quay': (48.652, -2.831), 'Porquerolles': (43.000, 6.202), 'Rolle': (46.460, 6.338)}
if os.environ.get('EXTRA_SITE'):
    _n, _a, _b = os.environ['EXTRA_SITE'].split(';'); ZONES[_n] = (float(_a), float(_b))
run = dt.datetime.strptime(os.environ['RUN'], '%Y%m%d%H'); steps = [int(s) for s in os.environ['STEPS'].split()]

def dist(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1] - a[1])
    return 6371 * math.acos(min(1, max(-1, math.sin(p1) * math.sin(p2) + math.cos(p1) * math.cos(p2) * math.cos(dl))))

def bearing(frm, to):  # cap de frm vers to, degrés
    p1, p2 = math.radians(frm[0]), math.radians(to[0]); dl = math.radians(to[1] - frm[1])
    return (math.degrees(math.atan2(math.sin(dl) * math.cos(p2), math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl))) + 360) % 360

def cold(step):
    return [c for c in featlib.analyser(featlib.champs(run, step))['depressions_500'] if c['froid']]

out = {'run': run.isoformat(), 'echeances': [], 'section': False}
for s in steps:
    now, later = cold(s), cold(s + 12)
    for c in now:
        p = (c['lat'], c['lon'])
        nxt = min(later, key=lambda d: dist(p, (d['lat'], d['lon'])), default=None)
        kn = None
        if nxt and dist(p, (nxt['lat'], nxt['lon'])) < 600:
            kn = round(dist(p, (nxt['lat'], nxt['lon'])) / 12 / 1.852, 1)
        for z, zp in ZONES.items():
            d = dist(zp, p)
            if d >= 1500: continue
            side = bearing(zp, p); west = 202.5 <= side <= 292.5  # SO à O
            lvl = 3 if (d < 500 and west and kn is not None and kn < 8) else 2 if (d < 800 and kn is not None and kn < 13.5) else 1 if (800 <= d < 1500 and kn is not None and kn > 16) else 0
            out['section'] = True
            out['echeances'].append({'step': s, 'valid': (run + dt.timedelta(hours=s)).isoformat(), 'zone': z, 'km': round(d),
                                     'lieu': situer(c['lat'], c['lon']), 'centre': p, 'z500_dam': c['val'],
                                     'tcoeur': c['tcoeur'], 'tpourtour': c['tpourtour'], 'deplacement_kn': kn, 'niveau': lvl})
json.dump(out, open('data/gf_auto.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:800])

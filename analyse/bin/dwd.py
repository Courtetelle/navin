"""Cartes officielles du DWD (Deutscher Wetterdienst), serveur opendata.dwd.de (demandé par Corban le 8/11/2026).
Télécharge la dernière analyse de surface avec fronts (Atlantique Nord et Europe), les cartes prévues de surface
avec fronts (ICON, +36 à +108 h) et les panneaux 500 hPa + pression mer (ICON). Sorties : fig/dwd_*.jpg, site/_dwd.html, data/dwd.json.
Usage : python3 -I bin/dwd.py"""
import re, os, json, subprocess, datetime as dt, io
from PIL import Image
B='https://opendata.dwd.de/weather/charts/'
def ls(path):
    r=subprocess.run(['curl','-s','-m','40',B+path],capture_output=True,text=True,check=True).stdout
    return [h for h in re.findall(r'href="(Z__C_EDZW_\d{14}_[^"]+)"',r)]
def latest(path,key):
    c=[]
    for h in ls(path):
        m=re.search(r'%2C(.+?)_(\d{12})_(WV\w+)\.png$',h)
        if m and m.group(1)==key: c.append((m.group(2),h[10:24],not m.group(3).endswith('SW'),h))
    if not c: return None
    c.sort(); b,e,_,h=c[-1]; return b,e,h   # base la plus récente, version couleur (sans SW) de préférence
def get(path,key,out,maxw=2000):
    L=latest(path,key)
    if not L: return None
    base,emis,h=L
    if dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)-dt.datetime.strptime(base,'%Y%m%d%H%M')>dt.timedelta(hours=36): return None   # règle : pas de carte périmée
    raw=subprocess.run(['curl','-s','-m','90',B+path+h],capture_output=True,check=True).stdout
    im=Image.open(io.BytesIO(raw)).convert('RGB')
    if im.width>maxw: im=im.resize((maxw,round(im.height*maxw/im.width)),Image.LANCZOS)
    im.save(f'fig/{out}.jpg',quality=85,optimize=True)
    return dict(fichier=f'fig/{out}.jpg',base=base,emis=emis,source=B+path+h)
J=['lun','mar','mer','jeu','ven','sam','dim']
def txt(t): return f"{J[t.weekday()]} {t.day}/{t.month} {t:%H} UTC"
D={}
D['ana_na']=get('analysis/','ana_bwkman_dwdna_O_000000_000000','dwd_ana_na')
D['ana_eu']=get('analysis/','ana_bwkman_dwdc_O_000000_000000','dwd_ana_eu')
for s in (36,60,84,108): D[f'tkb_{s}']=get('forecasts/icon/global/na/',f'ico_tkb_na_N_{s:06d}_000000',f'dwd_tkb_{s:03d}',maxw=1600)
for rng in ('036072','084120'): D[f'htp_{rng}']=get('forecasts/icon/global/na/',f'ico_htp_na_N_{rng}_000500',f'dwd_htp_{rng}',maxw=1500)
json.dump(D,open('data/dwd.json','w'),indent=1)
fig=lambda f,cap: f'<figure><img src="{f}" alt="{cap}" loading="lazy"><figcaption>{cap}</figcaption></figure>'
parts=['<p>Cartes officielles du service météorologique allemand (DWD), téléchargées telles quelles sur son serveur de données ouvertes. Elles ne sont pas modifiées : ce sont les fronts et les centres d\'action analysés et prévus par les prévisionnistes et le modèle ICON du DWD. « T » = dépression (Tief), « H » = anticyclone (Hoch) ; fronts froids en bleu, chauds en rouge, occlusions en violet.</p>']
a=[]
for k,lab in (('ana_na','Atlantique Nord'),('ana_eu','Europe')):
    d=D.get(k)
    if d: t=dt.datetime.strptime(d['base'],'%Y%m%d%H%M'); a.append(fig(d['fichier'],f"Analyse de surface DWD, {lab}, {txt(t)} : pression mer (hPa), fronts et observations."))
if a: parts.append('<h3>Analyse de surface (pression et fronts)</h3><div class="grid2">'+''.join(a)+'</div>')
p=[]
for s in (36,60,84,108):
    d=D.get(f'tkb_{s}')
    if d: t=dt.datetime.strptime(d['base'],'%Y%m%d%H%M'); p.append(fig(d['fichier'],f"Prévision DWD de surface avec fronts, ICON {t:%d/%m %H} UTC + {s} h, valable {txt(t+dt.timedelta(hours=s))}."))
if p: parts.append('<h3>Cartes prévues de surface avec fronts</h3><div class="grid2">'+''.join(p)+'</div>')
q=[]
for rng in ('036072','084120'):
    d=D.get(f'htp_{rng}')
    if d: t=dt.datetime.strptime(d['base'],'%Y%m%d%H%M'); q.append(fig(d['fichier'],f"ICON {t:%d/%m %H} UTC, échéances +{int(rng[:3])} à +{int(rng[3:])} h toutes les 12 h. À gauche : géopotentiel 500 hPa (dam) et température 500 hPa (°C). À droite : pression mer (hPa)."))
if q: parts.append('<h3>Altitude et surface côte à côte (500 hPa et pression mer)</h3><div class="grid2">'+''.join(q)+'</div>')
missing=[k for k,v in D.items() if not v]
parts.append('<p class="src">Source : Deutscher Wetterdienst, opendata.dwd.de, cartes reproduites sans modification. Sur les cartes 500 hPa (≈ 5 600 m) et pression mer, les repères et les éléments remarquables sont des calques transparents posés par-dessus (dwd_overlay.py).'+(f" Cartes non disponibles à jour ce run (non affichées) : {', '.join(missing)} ; voir le bouton « Cartes DWD »." if missing else '')+'</p>')
open('site/_dwd.html','w').write('\n'.join(parts)); print('dwd',{k:(v['base'] if v else None) for k,v in D.items()})

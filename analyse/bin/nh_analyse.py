"""Carte de l'analyse hémisphérique, centrée sur l'Europe, avec calque d'annotations (demandes de Corban du 9/11/2026 :
« centrer ta carte un peu plus sur l'Europe pour l'analyse hémisphérique et rajouter un bouton permettant de visualiser les analyses
(talweg, dorsales, anticyclone etc.) »).
Règle n° 1 : DERNIER run ECMWF IFS publié (recherché sur le miroir GCS). Échéance : jour cible (TARGET) à 12 UTC.
Carte de base (sans annotation, affichée par défaut) : Z500 (dam), pression mer (hPa), T850 (°C).
Calque « Avec annotations », détecté automatiquement sur ce run :
  - anticyclones (A) et dépressions (D) au sol : extrêmes de pression mer ;
  - thalwegs et dorsales : minima / maxima de l'anomalie zonale du Z500 suivis de latitude en latitude ;
  - dépressions fermées à 500 hPa ; « goutte froide » seulement si le cœur à 500 hPa est plus froid que son pourtour (≥ 1 °C).
Sorties : fig/nh_base.png, fig/nh_annot.png, data/nh_analyse.json, site/_nh.html. Usage : TARGET=AAAA-MM-JJ python3 -I bin/nh_analyse.py"""
import os, json, time, datetime as dt, urllib.request
import numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import cartopy.crs as ccrs, cartopy.feature as cf, eccodes, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); from geo import situer; import reperes   # points Morges, Saint-Malo, Toulon (Corban, 9/11/2026)   # repères géographiques (Corban, 9/11/2026)
from scipy.ndimage import minimum_filter, maximum_filter, gaussian_filter, uniform_filter1d
B='https://storage.googleapis.com/ecmwf-open-data/'
def get(url,rng=None):
    for i in range(8):
        try:
            rq=urllib.request.Request(url)
            if rng: rq.add_header('Range','bytes=%d-%d'%rng)
            with urllib.request.urlopen(rq,timeout=60) as r: return r.read()
        except Exception as e:
            if getattr(e,'code',None)==404: return None
            time.sleep(min(2*1.6**i,30))
    return None
def idx_url(r,s): return f"{B}{r:%Y%m%d}/{r:%H}z/ifs/0p25/oper/{r:%Y%m%d%H}0000-{s}h-oper-fc.index"
now=dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
r=now.replace(minute=0,second=0,microsecond=0,hour=now.hour//6*6)
for _ in range(8):
    if get(idx_url(r,144)) is not None: break
    r-=dt.timedelta(hours=6)
else: raise SystemExit('aucun run ECMWF récent trouvé')
RUN=r
T=dt.datetime.strptime(os.environ.get('TARGET',now.strftime('%Y-%m-%d')),'%Y-%m-%d')
VT=T+dt.timedelta(hours=12)
if VT<RUN: VT=RUN                       # jour cible déjà passé à 12 UTC : on prend l'analyse du run
S=int((VT-RUN).total_seconds()//3600)
F={}
for L in get(idx_url(RUN,S)).decode().splitlines():
    j=json.loads(L); k=(j['param'],j.get('levelist'))
    if k in (('gh','500'),('t','500'),('t','850'),('msl',None)):
        g=get(idx_url(RUN,S).replace('.index','.grib2'),(j['_offset'],j['_offset']+j['_length']-1))
        h=eccodes.codes_new_from_message(g); ni,nj=eccodes.codes_get(h,'Ni'),eccodes.codes_get(h,'Nj')
        F[k[0]+(k[1] or '')]=eccodes.codes_get_values(h).reshape(nj,ni); eccodes.codes_release(h)
# grille ECMWF open data : lat 90 -> -90, lon -180 -> 180 (premier point à 180° = -180°) ; on passe à 1° pour l'analyse
lat=90-0.25*np.arange(721); lon=-180+0.25*np.arange(1440)
z=F['gh500']/10; t5=F['t500']-273.15; t8=F['t850']-273.15; m=F['msl']/100
la1,lo1=lat[::4],lon[::4]; Z=gaussian_filter(z[::4,::4],(1.5,1.5),mode=('nearest','wrap')); M=gaussian_filter(m[::4,::4],(1.2,1.2),mode=('nearest','wrap')); T5=t5[::4,::4]
NH=(la1>=15)&(la1<=85)
def extrema(A,mode,size,thr,latmin=20,latmax=80):
    G=(minimum_filter if mode=='min' else maximum_filter)(A,size=size,mode=('nearest','wrap'))
    out=[]
    for y,x in zip(*np.where(A==G)):
        if latmin<=la1[y]<=latmax and ((A[y,x]<thr) if mode=='min' else (A[y,x]>thr)):
            out.append(dict(lat=float(la1[y]),lon=float(lo1[x]),val=round(float(A[y,x]))))
    return out
D=extrema(M,'min',15,1005); A=extrema(M,'max',15,1025)
# dépressions fermées à 500 hPa et test du cœur froid
def ring(y,x,r0,r1):
    yy,xx=np.mgrid[0:len(la1),0:len(lo1)]
    dy=(la1[yy]-la1[y])*111; dx=((lo1[xx]-lo1[x]+180)%360-180)*111*np.cos(np.radians(la1[y])); d=np.hypot(dx,dy)
    return (d>=r0)&(d<r1)
CL=[]
for c in extrema(Z,'min',13,600,25,75):
    y=int(np.argmin(abs(la1-c['lat']))); x=int(np.argmin(abs(lo1-c['lon'])))
    rim=ring(y,x,450,650)
    if Z[rim].min()-Z[y,x]<2: continue                     # pas fermée
    core=T5[ring(y,x,0,200)].mean(); out=T5[ring(y,x,500,900)].mean()
    c.update(tcoeur=round(float(core),1),tpourtour=round(float(out),1),froid=bool(core<=out-1.0)); CL.append(c)
# thalwegs et dorsales : anomalie zonale du Z500, extrêmes le long de chaque latitude, chaînés vers le nord
def axes(mode):
    pts={}
    for y in np.where((la1>=25)&(la1<=72))[0]:
        row=Z[y]-Z[y].mean(); row=uniform_filter1d(row,5,mode='wrap')
        G=(minimum_filter if mode=='min' else maximum_filter)(row,size=31,mode='wrap')   # fenêtre ±15°
        for x in np.where(row==G)[0]:
            w=np.r_[row[x-25:],row[:x+26]] if x<25 else np.r_[row[x-25:x+26],row[:max(0,x+26-len(row))]]
            prom=(w.max()-row[x]) if mode=='min' else (row[x]-w.min())
            if prom>=6: pts.setdefault(float(la1[y]),[]).append(float(lo1[x]))
    lines=[]
    for la in sorted(pts):
        for lo in pts[la]:
            best=None
            for L in lines:
                if L['done'] or L['p'][-1][0]!=la-1: continue
                dl=abs((lo-L['p'][-1][1]+180)%360-180)
                if dl<=4 and (best is None or dl<best[0]): best=(dl,L)
            if best: best[1]['p'].append((la,lo))
            else: lines.append(dict(p=[(la,lo)],done=False))
        for L in lines:
            if L['p'][-1][0]<la: L['done']=True
    res=[]
    for L in lines:
        if len(L['p'])>=10:
            p=np.array(L['p']); lo=np.unwrap(np.radians(p[:,1])); lo=np.degrees(uniform_filter1d(lo,5,mode='nearest'))
            res.append([[float(a),float((b+180)%360-180)] for a,b in zip(p[:,0],lo)])
    return res
TH=axes('min'); DO=axes('max')
inbox=lambda la,lo: -65<=lo<=75 and 22<=la<=84
D=[d for d in D if inbox(d['lat'],d['lon'])]; A=[d for d in A if inbox(d['lat'],d['lon'])]; CL=[c for c in CL if inbox(c['lat'],c['lon'])]
TH=[L for L in TH if any(inbox(a,b) for a,b in L)]; DO=[L for L in DO if any(inbox(a,b) for a,b in L)]
for o in D+A+CL: o['lieu']=situer(o['lat'],o['lon'])
# même analyse 24 h plus tard, pour le déplacement des centres et des axes (résumé de « L'essentiel », Corban 9/11/2026)
S24=S+24; F2={}
for L in get(idx_url(RUN,S24)).decode().splitlines():
    j=json.loads(L); k=(j['param'],j.get('levelist'))
    if k in (('gh','500'),('msl',None)):
        g=get(idx_url(RUN,S24).replace('.index','.grib2'),(j['_offset'],j['_offset']+j['_length']-1))
        h=eccodes.codes_new_from_message(g); ni,nj=eccodes.codes_get(h,'Ni'),eccodes.codes_get(h,'Nj')
        F2[k[0]]=eccodes.codes_get_values(h).reshape(nj,ni); eccodes.codes_release(h)
_Z0=Z; Z=gaussian_filter(F2['gh'][::4,::4]/10,(1.5,1.5),mode=('nearest','wrap')); M24=gaussian_filter(F2['msl'][::4,::4]/100,(1.2,1.2),mode=('nearest','wrap'))
SUIV=dict(step=S24,depressions=extrema(M24,'min',15,1010),anticyclones=extrema(M24,'max',15,1020),thalwegs=axes('min'),dorsales=axes('max'))
Z=_Z0
def milieu(L):
    a=min(L,key=lambda q:abs(q[0]-50)); return dict(lat=a[0],lon=a[1],lieu=situer(a[0],a[1]),de=situer(*L[0]),a=situer(*L[-1]))
PROJ=ccrs.Orthographic(central_longitude=5,central_latitude=52)
EXT=[-70,80,18,90]
J=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
VTXT=f"{J[VT.weekday()]} {VT.day}/{VT.month} {VT:%H} UTC"
def carte(annot):
    fig=plt.figure(figsize=(10,9),dpi=125); ax=plt.axes(projection=PROJ); ax.set_extent(EXT,ccrs.PlateCarree())
    cs=ax.contourf(lon[::2],lat[::2],t8[::2,::2],levels=np.arange(-30,25,2),cmap='RdBu_r',extend='both',transform=ccrs.PlateCarree(),alpha=0.85)
    ax.add_feature(cf.COASTLINE.with_scale('50m'),lw=0.5,color='#3d3d3a'); ax.add_feature(cf.BORDERS.with_scale('50m'),lw=0.3,color='#6b6a66')
    ax.gridlines(lw=0.3,color='#8a8983',alpha=0.6,xlocs=range(-180,181,20),ylocs=range(0,91,10))
    c1=ax.contour(lo1,la1,Z,levels=np.arange(480,600,4),colors='k',linewidths=1.0,transform=ccrs.PlateCarree()); ax.clabel(c1,fmt='%d',fontsize=7)
    c2=ax.contour(lo1,la1,M,levels=np.arange(940,1060,5),colors='white',linewidths=0.7,transform=ccrs.PlateCarree()); ax.clabel(c2,fmt='%d',fontsize=6,colors='white')
    plt.colorbar(cs,ax=ax,orientation='horizontal',shrink=0.7,pad=0.03,label='Température à 850 hPa (≈ 1 500 m) (°C)')
    P=ccrs.PlateCarree(); H=[]
    if annot:
        for L in TH:
            a=np.array(L); ax.plot(a[:,1],a[:,0],color='#7b2d26',lw=3,ls=(0,(6,3)),transform=P)
        for L in DO:
            a=np.array(L); ax.plot(a[:,1],a[:,0],color='#c2410c',lw=3,transform=P)
        for d in D:
            ax.text(d['lon'],d['lat'],'D',color='#b3261e',fontsize=17,weight='bold',ha='center',va='center',transform=P,clip_on=True)
            ax.text(d['lon'],d['lat']-2.2,str(d['val']),color='#b3261e',fontsize=8,weight='bold',ha='center',va='center',transform=P,clip_on=True)
        for d in A:
            ax.text(d['lon'],d['lat'],'A',color='#1d4ed8',fontsize=17,weight='bold',ha='center',va='center',transform=P,clip_on=True)
            ax.text(d['lon'],d['lat']-2.2,str(d['val']),color='#1d4ed8',fontsize=8,weight='bold',ha='center',va='center',transform=P,clip_on=True)
        for c in CL:
            col='#6d28d9' if c['froid'] else '#0f766e'
            ax.plot(c['lon'],c['lat'],marker='o',ms=17,mfc='none',mec=col,mew=2.5,transform=P,clip_on=True)
            ax.text(c['lon'],c['lat']+3,'GF' if c['froid'] else 'B',color=col,fontsize=11,weight='bold',ha='center',transform=P,clip_on=True)
        H=[Line2D([],[],color='#7b2d26',lw=3,ls=(0,(6,3)),label='Thalweg (500 hPa, ≈ 5 600 m)'),Line2D([],[],color='#c2410c',lw=3,label='Dorsale (500 hPa, ≈ 5 600 m)'),
           Line2D([],[],ls='',marker='$D$',ms=10,color='#b3261e',label='Dépression au sol (hPa)'),Line2D([],[],ls='',marker='$A$',ms=10,color='#1d4ed8',label='Anticyclone au sol (hPa)'),
           Line2D([],[],ls='',marker='o',ms=11,mfc='none',mec='#0f766e',mew=2,label='B : dépression fermée à 500 hPa (≈ 5 600 m)'),
           Line2D([],[],ls='',marker='o',ms=11,mfc='none',mec='#6d28d9',mew=2,label='GF : goutte froide (cœur froid confirmé)')]
        ax.legend(handles=H,loc='lower left',fontsize=7.5,framealpha=0.92,title='Annotations (analyse automatique de ce run)',title_fontsize=8)
    ax.set_title(f"ECMWF IFS 0,25°, run du {RUN:%d/%m/%Y %H} UTC, +{S} h, valable {VTXT}\nGéopotentiel 500 hPa (≈ 5 600 m) (dam, noir) · Pression mer (hPa, blanc) · T 850 hPa (≈ 1 500 m) (couleurs)",fontsize=9,loc='left')
    fig.savefig(f"fig/nh_{'annot' if annot else 'base'}.png",bbox_inches='tight'); plt.close(fig)
os.makedirs('fig',exist_ok=True); carte(False); carte(True)
vis=lambda o: -70<=o['lon']<=80
json.dump(dict(run=RUN.isoformat(),valid=VT.isoformat(),step=S,depressions=D,anticyclones=A,depressions_500=CL,thalwegs=TH,dorsales=DO,plus24=SUIV),open('data/nh_analyse.json','w'),ensure_ascii=False,indent=1)
EU=lambda o: -40<=o['lon']<=45 and 30<=o['lat']<=72
def liste(xs,f): return '; '.join(f(x) for x in xs)
th=[milieu(L) for L in TH]; do=[milieu(L) for L in DO]
th=[x for x in th if EU(x)]; do=[x for x in do if EU(x)]
gf=[c for c in CL if c['froid'] and EU(c)]; bb=[c for c in CL if not c['froid'] and EU(c)]
parts=[]
if [d for d in D if EU(d)]: parts.append('Dépressions au sol : '+liste([d for d in D if EU(d)],lambda d:f"{d['val']} hPa {d['lieu']}"))
if [d for d in A if EU(d)]: parts.append('Anticyclones : '+liste([d for d in A if EU(d)],lambda d:f"{d['val']} hPa {d['lieu']}"))
if th: parts.append('Thalwegs : '+liste(th,lambda x:f"axe passant {x['lieu']} (de « {x['de']} » à « {x['a']} »)"))
if do: parts.append('Dorsales : '+liste(do,lambda x:f"axe passant {x['lieu']} (de « {x['de']} » à « {x['a']} »)"))
parts.append(('Goutte froide (cœur froid confirmé) : '+liste(gf,lambda c:c['lieu'])) if gf else 'Aucune goutte froide confirmée sur l\'Europe et l\'Atlantique proche')
if bb: parts.append('Dépression fermée à 500 hPa sans cœur froid : '+liste(bb,lambda c:c['lieu']))
cap=(f"Hémisphère Nord centré sur l'Europe, IFS run du {RUN:%d/%m %H} UTC, valable {VTXT}. Carte de base sans annotation ; le bouton « Avec annotations » ajoute les thalwegs, dorsales, anticyclones (A), dépressions (D) et dépressions fermées en altitude, détectés automatiquement sur ce run.")
desc='<ul class="src geo">'+''.join(f'<li>{p}.</li>' for p in parts)+'</ul>'
html=f'''<figure data-map><div class="toggle" role="group" aria-label="Affichage"><button type="button" data-v="base" aria-pressed="true">Carte de base</button><button type="button" data-v="ann" aria-pressed="false">Avec annotations</button></div>
<div class="stack"><img src="fig/nh_base.png" alt="Analyse hémisphérique centrée sur l'Europe, carte de base" loading="lazy"><img class="ann" src="fig/nh_annot.png" alt="Même carte avec annotations : thalwegs, dorsales, anticyclones, dépressions" loading="lazy" hidden></div><figcaption>{cap}</figcaption></figure>
<p><strong>Où se trouvent les structures (repères géographiques, Europe et Atlantique proche) :</strong></p>{desc}'''
open('site/_nh.html','w').write(html)
print('nh ok run',RUN,'+',S,'D',[(d['lat'],d['lon'],d['val']) for d in D if vis(d)],'A',[(d['lat'],d['lon'],d['val']) for d in A if vis(d)],'500',[(c['lat'],c['lon'],c['froid']) for c in CL if vis(c)],'TH',len(TH),'DO',len(DO))

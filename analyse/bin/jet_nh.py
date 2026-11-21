"""Courants-jets sur l'hémisphère Nord, vue centrée sur l'Europe occidentale (demandé par Corban le 9/11/2026 :
« un bouton permettant de visualiser d'un coup d'œil les courants-jets au-dessus de l'hémisphère nord centré sur l'Europe occidentale »).
Règle n° 1 : toujours le DERNIER run ECMWF IFS publié (00, 06, 12 ou 18 UTC, recherché sur le miroir GCS), jamais un run ancien.
Télécharge seulement u, v à 250 hPa (≈ 10 400 m) et Z500 (≈ 5 600 m) (plages d'octets de l'index). Normale : ERA5 1990-2019 (WeatherBench2, climlib).
Sorties : fig/jet_nh_<k>_base.png et fig/jet_nh_<k>_anom.png (k = 0..4, jour cible puis J+1..J+4 à 12 UTC),
data/jet_nh.json, site/_jet_nh.html (bouton + fenêtre). Usage : RUN=... TARGET=AAAA-MM-JJ python3 -I bin/jet_nh.py"""
import os, sys, json, time, datetime as dt, urllib.request
import numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
import cartopy.crs as ccrs, cartopy.feature as cf, eccodes
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import climlib
from geo import situer
import reperes   # points Morges, Saint-Malo, Toulon posés par reperes.py (Corban, 9/11/2026)   # repères géographiques (Corban, 9/11/2026)
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
# dernier run complet jusqu'à +144 h
now=dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
r=now.replace(minute=0,second=0,microsecond=0,hour=now.hour//6*6)
for _ in range(8):
    if get(idx_url(r,144)) is not None: break
    r-=dt.timedelta(hours=6)
else: raise SystemExit('aucun run ECMWF récent trouvé')
RUN=r
T=dt.datetime.strptime(os.environ.get('TARGET',now.strftime('%Y-%m-%d')),'%Y-%m-%d')
VT=[T+dt.timedelta(days=k,hours=12) for k in range(5)]
VT=[v for v in VT if 0<=(v-RUN).total_seconds()/3600<=144]
J=['lun','mar','mer','jeu','ven','sam','dim']
lab=lambda v: f"{J[v.weekday()]} {v.day}/{v.month} 12 UTC"
def field(step):
    out={}
    for L in get(idx_url(RUN,step)).decode().splitlines():
        j=json.loads(L); k=(j['param'],j.get('levelist'))
        if k in (('u','250'),('v','250'),('gh','500')):
            g=get(idx_url(RUN,step).replace('.index','.grib2'),(j['_offset'],j['_offset']+j['_length']-1))
            h=eccodes.codes_new_from_message(g)
            ni,nj=eccodes.codes_get(h,'Ni'),eccodes.codes_get(h,'Nj')
            out[k[0]]=eccodes.codes_get_values(h).reshape(nj,ni); eccodes.codes_release(h)
    return out
lat=90-0.25*np.arange(721); lon=-180+0.25*np.arange(1440)
def roll(a): return a          # la grille ECMWF open data commence déjà à 180° = -180° (longitudeOfFirstGridPoint=180)
def clim(v):
    """vitesse de la moyenne vectorielle ERA5 à 250 hPa (≈ 10 400 m) (la normale des vitesses instantanées est un peu plus forte)."""
    h=int(round(v.hour/6))*6%24; d=v.timetuple().tm_yday
    u=climlib.block('u_component_of_wind',d,h,250); w=climlib.block('v_component_of_wind',d,h,250)
    sp=np.hypot(u,w)*1.9438
    return np.roll(sp[::-1] if climlib.lat()[0]<0 else sp,720,axis=1)
PROJ=ccrs.Orthographic(central_longitude=5,central_latitude=52); EXT=[-70,80,18,90]   # recentré sur l'Europe (Corban, 9/11/2026), même cadre que nh_analyse.py
SITES=[('Saint-Quay',48.652,-2.831),('Porquerolles',43.00,6.20),('Rolle',46.46,6.34)]
import os as _os
if _os.environ.get('EXTRA_SITE'):   # point GPS demandé (relance à la position), ajouté aux zones d'essai
    _n,_a,_b=_os.environ['EXTRA_SITE'].split(';'); SITES.append((_n,float(_a),float(_b)))

OFF={'Rolle':(1.5,2.0,'left'),'Saint-Quay':(-1.5,1.2,'right'),'Porquerolles':(1.5,-2.5,'left')}
os.makedirs('fig',exist_ok=True); meta=[]
for k,v in enumerate(VT):
    s=int((v-RUN).total_seconds()//3600); F=field(s)
    u,w,z=roll(F['u'])*1.9438,roll(F['v'])*1.9438,roll(F['gh'])/10; sp=np.hypot(u,w)
    sel=lat>=0; la,uu,ww,zz,ss=lat[sel],u[sel],w[sel],z[sel],sp[sel]
    an=None   # Corban 20/11/2026 : pas d'écart à la normale pour les jets (JET_ANOM=1 pour le réactiver)
    if os.environ.get('JET_ANOM')=='1':
        try: cn=clim(v)[sel]; an=ss-cn
        except Exception as e: print('normale indisponible',e); an=None
    i,j=np.unravel_index(np.argmax(np.where((la[:,None]>20)&(la[:,None]<80)&(lon[None,:]>-80)&(lon[None,:]<40),ss,0)),ss.shape)
    vmax=dict(kn=round(float(ss[i,j])),lat=float(la[i]),lon=float(lon[j])); vmax['lieu']=situer(vmax['lat'],vmax['lon'])
    for kind in ('base','anom'):
        if kind=='anom' and an is None: continue
        fig=plt.figure(figsize=(9.5,9.5),dpi=120); ax=plt.axes(projection=PROJ); ax.set_extent(EXT,ccrs.PlateCarree())
        ax.add_feature(cf.LAND.with_scale('110m'),color='#ebe8df'); ax.add_feature(cf.COASTLINE.with_scale('110m'),lw=0.5,color='#55534d')
        ax.gridlines(lw=0.3,color='#9a988f',alpha=0.6,xlocs=range(-180,181,30),ylocs=range(0,91,15))
        if kind=='base':
            cs=ax.contourf(lon,la,ss,levels=[60,80,100,120,140,160,180,200],cmap='YlOrRd',extend='max',transform=ccrs.PlateCarree())
            lbl='Vent à 250 hPa (≈ 10 400 m) (kn)'
        else:
            cs=ax.contourf(lon,la,an,levels=np.arange(-70,71,10),cmap='PuOr_r',extend='both',transform=ccrs.PlateCarree())
            ax.contour(lon,la,ss,levels=[80],colors='#b42318',linewidths=0.9,transform=ccrs.PlateCarree())
            lbl='Écart du vent 250 hPa (≈ 10 400 m) à la normale (kn)'
        c=ax.contour(lon,la,zz,levels=np.arange(480,600,8),colors='#333',linewidths=0.6,transform=ccrs.PlateCarree()); ax.clabel(c,fmt='%d',fontsize=6)
        st=8; m=ss[::st,::st]>=70
        Lo,La=np.meshgrid(lon[::st],la[::st])
        ax.quiver(Lo[m],La[m],(uu[::st,::st]/ss[::st,::st].clip(1))[m],(ww[::st,::st]/ss[::st,::st].clip(1))[m],transform=ccrs.PlateCarree(),scale=55,width=0.0022,color='#1f2937',regrid_shape=None)
        ax.plot(vmax['lon'],vmax['lat'],marker='x',ms=9,color='#7f1d1d',mew=2,transform=ccrs.PlateCarree())
        cb=plt.colorbar(cs,ax=ax,orientation='horizontal',shrink=0.75,pad=0.03); cb.set_label(lbl)
        ax.set_title(f"ECMWF IFS 0,25°, run du {RUN:%d/%m/%Y %H} UTC, +{s} h, valable {lab(v)}\n"
                     +("Courant-jet : vent à 250 hPa (≈ 10 400 m) (couleurs, kn), flèches = sens du vent ≥ 70 kn, Z500 (≈ 5 600 m) (dam, traits)" if kind=='base' else
                       "Écart à la normale ERA5 1990-2019 (orange = plus fort, violet = plus faible), trait rouge = jet ≥ 80 kn")
                     +f"\n× = vent maximal Atlantique Nord–Europe {vmax['kn']} kn, {vmax['lieu']}",fontsize=8.5,loc='left')
        fig.savefig(f'fig/jet_nh_{k}_{kind}.png',bbox_inches='tight'); plt.close(fig)
    pt={}
    for n,a,b in SITES:
        jj=int(np.argmin(abs(la-a))); ii=int(np.argmin(abs(lon-b)))
        # jet le plus proche (vent ≥ 80 kn) : distance et repère géographique
        yy,xx=np.where(ss>=80); dd=np.hypot((la[yy]-a)*111,((lon[xx]-b+180)%360-180)*111*np.cos(np.radians(a)))
        jp=None
        if len(dd): q=int(np.argmin(dd)); jp=dict(km=int(round(dd[q]/50)*50),kn=round(float(ss[yy[q],xx[q]])),lieu=situer(float(la[yy[q]]),float(lon[xx[q]])))
        pt[n]=dict(kn=round(float(ss[jj,ii])),normale=(round(float(cn[jj,ii])) if an is not None else None),jet_proche=jp)
    meta.append(dict(k=k,valid=v.isoformat(),step=s,label=lab(v),vmax=vmax,points=pt,anom=an is not None))
    print('jet',k,lab(v),s,vmax,pt,flush=True)
json.dump(dict(run=RUN.isoformat(),cartes=meta),open('data/jet_nh.json','w'),ensure_ascii=False,indent=1)
# bouton + fenêtre (HTML autonome, sans dépendance)
f=lambda x:str(x)
tabs=''.join(f'<button type="button" data-k="{m["k"]}" aria-pressed="{"true" if m["k"]==0 else "false"}">{m["label"][:-7]}</button>' for m in meta)
rows=''.join(f'<tr><th>{m["label"]}</th><td>{m["vmax"]["kn"]}</td><td class="cmt">{m["vmax"]["lieu"]}</td>'+''.join(f'<td>{m["points"][n]["kn"]}</td><td>{m["points"][n]["normale"] if m["points"][n]["normale"] is not None else "n.d."}</td>' for n,_,_ in SITES)+'</tr>' for m in meta)
H=' '.join(f'<th>{n} : vent 250 hPa (≈ 10 400 m) (kn)</th><th>{n} : normale (kn)</th>' for n,_,_ in SITES)
html=f"""<button type="button" class="btn jetbtn" data-open-jet>Courants-jets, hémisphère Nord ⤢</button>
<dialog id="jetdlg" aria-label="Courants-jets sur l'hémisphère Nord">
<div class="jethead"><strong>Courants-jets, hémisphère Nord centré sur l'Europe de l'Ouest</strong><button type="button" class="btn" data-close-jet aria-label="Fermer">Fermer ✕</button></div>
<p class="src">Dernier run ECMWF IFS publié : {RUN:%d/%m/%Y %H} UTC. Choisissez le jour, puis la carte de base ou l'écart à la normale.</p>
<div class="toggle" role="group" aria-label="Jour" data-jet-day>{tabs}</div>
<div class="toggle" role="group" aria-label="Affichage" data-jet-kind><button type="button" data-v="base" aria-pressed="true">Carte de base</button><button type="button" data-v="anom" aria-pressed="false">Écart à la normale</button></div>
<img id="jetimg" src="fig/jet_nh_0_base.png" alt="Vent à 250 hPa (≈ 10 400 m) sur l'hémisphère Nord, centré sur l'Europe de l'Ouest">
<div class="tbl"><table><thead><tr><th>Échéance (UTC)</th><th>Vent max du jet, Atlantique Nord–Europe (20–80° N, 80° O–40° E) (kn)</th><th class="cmt">Position du maximum (repère géographique)</th>{H}</tr></thead><tbody>{rows}</tbody><tfoot><tr><th>Échéance (UTC)</th><th>Vent max du jet, Atlantique Nord–Europe (20–80° N, 80° O–40° E) (kn)</th><th class="cmt">Position du maximum (repère géographique)</th>{H}</tr></tfoot></table></div>
<p class="src">Normale : vitesse de la moyenne vectorielle ERA5 1990-2019 à 250 hPa (≈ 10 400 m) (WeatherBench2), un peu plus faible que la vitesse moyenne réelle. Source des prévisions : données ouvertes ECMWF.</p>
</dialog>
<script>(function(){{var d=document.getElementById('jetdlg'),img=document.getElementById('jetimg'),k=0,v='base';
function upd(){{img.src='fig/jet_nh_'+k+'_'+v+'.png';}}
document.querySelectorAll('[data-open-jet]').forEach(function(b){{b.onclick=function(){{d.showModal?d.showModal():d.setAttribute('open','')}}}});
d.querySelector('[data-close-jet]').onclick=function(){{d.close?d.close():d.removeAttribute('open')}};
d.addEventListener('click',function(e){{if(e.target===d)d.close()}});
[['[data-jet-day] button','k'],['[data-jet-kind] button','v']].forEach(function(p){{var bs=d.querySelectorAll(p[0]);bs.forEach(function(b){{b.onclick=function(){{if(p[1]=='k')k=b.dataset.k;else v=b.dataset.v;bs.forEach(function(x){{x.setAttribute('aria-pressed',String(x===b))}});upd();}}}})}});}})();</script>"""
open('site/_jet_nh.html','w').write(html); print('jet_nh ok, run',RUN)

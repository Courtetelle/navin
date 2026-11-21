"""Calques sur les cartes officielles DWD « 500 hPa + pression mer » (ico_htp_na), demandés par Corban le 9/11/2026 :
points et noms Morges, Saint-Malo, Toulon (visibles par défaut) et éléments remarquables en couleur (bouton « Avec annotations »)
pour suivre leur évolution d'une échéance à l'autre. La carte DWD n'est pas modifiée : les calques sont des PNG transparents
posés par-dessus dans la page.
Géoréférencement : stéréographique polaire nord, méridien central 10,02° E, ajusté sur le trait de côte (écart moyen < 1 px
sur les 8 vignettes lors de la mise en place). Le script REVÉRIFIE cet ajustement sur chaque nouvelle carte et n'ajoute aucun calque
si l'écart dépasse 3 px (mise en page DWD changée) : il le dit alors dans la page.
Éléments remarquables : calculés sur ECMWF IFS (featlib.py) aux mêmes échéances, run de même heure de base que la carte DWD
s'il est publié, sinon le dernier run.
Entrées : data/dwd.json et fig/dwd_htp_*.jpg (dwd.py). Sorties : fig/dwd_htp_<r>_rep.png, fig/dwd_htp_<r>_ann.png,
data/dwd_overlay.json ; met à jour site/_dwd.html. Usage : python3 -I bin/dwd_overlay.py (après dwd.py)."""
import os, sys, json, re, math, datetime as dt
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cartopy.crs as ccrs, cartopy.feature as cf
from scipy.ndimage import distance_transform_edt
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import featlib
from geo import dist, situer
G=dict(c=10.0187,s=2.06890e-4,x0=1041.96,y0=-219.07,W=3271,dx=1634,dy=1180,ymax=1048,xmin=40,xmax=1630)
SITES=[('Saint-Quay',48.652,-2.831,(-12,-26)),('Porquerolles',43.00,6.20,(10,6)),('Rolle',46.46,6.34,(10,-26))]
PR=ccrs.NorthPolarStereo(central_longitude=G['c'],true_scale_latitude=60); PC=ccrs.PlateCarree()
def xy(lat,lon,col,row,f):
    q=PR.transform_points(PC,np.atleast_1d(np.asarray(lon,float)),np.atleast_1d(np.asarray(lat,float)))
    u=G['s']*q[:,0]+G['x0']; v=-G['s']*q[:,1]+G['y0']
    ok=(u>=G['xmin'])&(u<=G['xmax'])&(v>=0)&(v<=G['ymax'])
    return (u+col*G['dx'])*f,(v+row*G['dy'])*f,ok
def verifier(img):
    """Écart moyen (px pleine résolution) entre le trait de côte projeté et les traits sombres de la vignette 1."""
    f=img.width/G['W']; a=np.array(img.convert('L'))<160
    pts=[]
    for g in cf.COASTLINE.with_scale('50m').geometries():
        for line in (g.geoms if hasattr(g,'geoms') else [g]):
            c=np.asarray(line.coords); m=(c[:,1]>30)&(c[:,1]<72)&(c[:,0]>-40)&(c[:,0]<40)
            if m.sum(): pts.append(c[m][::3])
    L=np.vstack(pts); u,v,ok=xy(L[:,1],L[:,0],0,0,f)
    dtm=distance_transform_edt(~a)
    return float(np.minimum(dtm[v[ok].astype(int),u[ok].astype(int)],15).mean()/f)
def police(n):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p,n)
    return ImageFont.load_default()
def texte(dr,x,y,t,fill,fn,anchor='lm'):
    dr.text((x,y),t,fill=fill,font=fn,anchor=anchor,stroke_width=4,stroke_fill=(255,255,255,235))
def ligne(dr,X,Y,ok,col,w,dash=None):
    seg=[]
    for x,y,o in zip(X,Y,ok):
        if o: seg.append((x,y))
        elif len(seg)>1: _trace(dr,seg,col,w,dash); seg=[]
        else: seg=[]
    if len(seg)>1: _trace(dr,seg,col,w,dash)
def _trace(dr,seg,col,w,dash):
    for (a,b),(c,d) in zip(seg[:-1],seg[1:]): dr.line([(a-1,b),(c-1,d)],fill=(255,255,255,200),width=w+4)
    if not dash: dr.line(seg,fill=col,width=w,joint='curve'); return
    acc=0; on=True
    for (a,b),(c,d) in zip(seg[:-1],seg[1:]):
        L=math.hypot(c-a,d-b); t=0
        while t<L:
            st=min(dash[0 if on else 1]-acc,L-t); t2=t+st
            if on: dr.line([(a+(c-a)*t/L,b+(d-b)*t/L),(a+(c-a)*t2/L,b+(d-b)*t2/L)],fill=col,width=w)
            acc+=st; t=t2
            if acc>=dash[0 if on else 1]-1e-6: acc=0; on=not on
def suivre(etapes,cle,typ_ok=lambda c:True,rmax=900):
    """Trajectoires : relie d'une échéance à la suivante le centre le plus proche (≤ rmax km)."""
    tr=[]
    for k,E in enumerate(etapes):
        for c in [c for c in E[cle] if typ_ok(c)]:
            best=None
            for t in tr:
                if t[-1][0]==k-1:
                    d=dist(t[-1][1]['lat'],t[-1][1]['lon'],c['lat'],c['lon'])
                    if d<=rmax and (best is None or d<best[0]): best=(d,t)
            (best[1].append((k,c)) if best else tr.append([(k,c)]))
    return tr
from zoneinfo import ZoneInfo
ZURICH=ZoneInfo('Europe/Zurich'); JOURS=['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche']
def heure_suisse(v):
    """Heure UTC -> « dimanche 22/11 à 1 h, heure suisse » (Corban, 21/11/2026 : jour et heure précis au lieu de +36 h)."""
    t=v.replace(tzinfo=dt.timezone.utc).astimezone(ZURICH); return f"{JOURS[t.weekday()]} {t.day}/{t.month} à {t.hour} h"
def legendes(img,f,base,vts,h0,step):
    """Calque toujours affiché : remplace, par-dessus, les petites légendes allemandes du DWD par un texte lisible."""
    L=Image.new('RGBA',img.size,(0,0,0,0)); dr=ImageDraw.Draw(L)
    f1=police(max(12,int(36*f))); f2=police(max(10,int(27*f)))
    for row,v in enumerate(vts):
        h=h0+step*row
        for col,titre in ((0,'Géopotentiel 500 hPa (≈ 5 600 m, dam), température (°C)'),(1,'Pression au niveau de la mer (hPa)')):
            x0=col*G['dx']*f; y0=(row*G['dy']+G['ymax']+3)*f; x1=x0+990*f; y1=(row+1)*G['dy']*f-2
            dr.rectangle([x0,y0,x1,y1],fill=(255,255,255,255),outline=(20,33,43,255),width=max(1,int(3*f)))
            dr.text((x0+12*f,y0+(y1-y0)*0.22),f"{heure_suisse(v)}, heure suisse",fill=(11,93,122,255),font=f1,anchor='lm')
            dr.text((x0+12*f,y0+(y1-y0)*0.55),titre,fill=(20,33,43,255),font=f2,anchor='lm')
            dr.text((x0+12*f,y0+(y1-y0)*0.83),f"modèle ICON du DWD, run du {base:%d/%m à %H} UTC, +{h} h",fill=(83,99,111,255),font=f2,anchor='lm')
    return L
def jets(img,f,run,vts):
    """Calque « Courants-jets 250 hPa » (Corban, 21/11/2026) : isotaches 80, 100, 120 et 140 nd du vent à 250 hPa (≈ 10 400 m)
    et flèches dans le sens du vent, ECMWF IFS aux mêmes heures, sur les deux vignettes de chaque ligne."""
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    J=Image.new('RGBA',img.size,(0,0,0,0)); dj=ImageDraw.Draw(J)
    lat=90-0.25*np.arange(721); lon=-180+0.25*np.arange(1440); sel=(lat>=20)&(lat<=80)
    COL={80:(250,204,21,255),100:(249,115,22,255),120:(220,38,38,255),140:(136,19,55,255)}
    W=max(2,int(5*f)); info=[]
    for row,v in enumerate(vts):
        s=int((v-run).total_seconds()//3600)
        F=featlib.champs(run,s,want=(('u','250'),('v','250')))
        if 'u250' not in F: info.append(None); continue
        u,w=F['u250'][sel]*1.9438,F['v250'][sel]*1.9438; sp=np.hypot(u,w); la=lat[sel]
        fig=plt.figure(); cs=plt.contour(lon,la,sp,levels=sorted(COL)); plt.close(fig)
        for lev,segs in zip(cs.levels,cs.allsegs):
            for seg in segs:
                if len(seg)<4: continue
                for col in (0,1):
                    X,Y,ok=xy(seg[:,1],seg[:,0],col,row,f); ligne(dj,X,Y,ok,COL[int(lev)],W)
        st=12
        for j in range(0,len(la),st):
            for i in range(0,len(lon),st):
                if sp[j,i]<80: continue
                for col in (0,1):
                    X,Y,ok=xy([la[j]],[lon[i]],col,row,f)
                    if not ok[0]: continue
                    n=max(1e-6,sp[j,i]); L=34*f; ex,ey=u[j,i]/n*L,-w[j,i]/n*L
                    a=(X[0]-ex/2,Y[0]-ey/2); b=(X[0]+ex/2,Y[0]+ey/2)
                    dj.line([a,b],fill=(30,41,59,230),width=max(2,int(4*f)))
                    ang=math.atan2(ey,ex)
                    for d in (2.6,-2.6): dj.line([b,(b[0]+14*f*math.cos(ang+d),b[1]+14*f*math.sin(ang+d))],fill=(30,41,59,230),width=max(2,int(4*f)))
        jm=np.unravel_index(np.argmax(np.where((lon[None,:]>-60)&(lon[None,:]<40),sp,0)),sp.shape)
        info.append(dict(valid=v.isoformat(),max_kn=round(float(sp[jm])),ou=situer(float(la[jm[0]]),float(lon[jm[1]]))))
    return J,info
D=json.load(open('data/dwd.json')); html=open('site/_dwd.html').read(); meta={}
F_SITE=None
for key,(h0,step) in (('htp_036072',(36,12)),('htp_084120',(84,12))):
    d=D.get(key)
    if not d: continue
    img=Image.open(d['fichier']); f=img.width/G['W']; base=dt.datetime.strptime(d['base'],'%Y%m%d%H%M')
    err=verifier(img); print(key,'écart de géoréférencement',round(err,2),'px')
    meta[key]=dict(ecart_px=round(err,2))
    if err>3:
        html=html.replace(f'<figcaption>',f'<figcaption>',1)
        meta[key]['calque']=False; continue
    vts=[base+dt.timedelta(hours=h0+step*k) for k in range(4)]
    run=featlib.dernier_run(prefer=base)
    E=[]
    for v in vts:
        s=int((v-run).total_seconds()//3600)
        E.append(featlib.analyser(featlib.champs(run,s)) if 0<=s<=144 else None)
    if any(e is None for e in E): meta[key]['calque']=False; print(key,'échéances IFS absentes'); continue
    fn=police(max(12,int(34*f))); fs=police(max(10,int(26*f))); fb=police(max(14,int(46*f)))
    rep=Image.new('RGBA',img.size,(0,0,0,0)); dr=ImageDraw.Draw(rep)
    for row in range(4):
        for col in range(2):
            for n,la,lo,(ox,oy) in SITES:
                X,Y,ok=xy(la,lo,col,row,f)
                if not ok[0]: continue
                r=max(4,int(11*f)); dr.ellipse([X[0]-r,Y[0]-r,X[0]+r,Y[0]+r],fill=(255,212,0,255),outline=(0,0,0,255),width=max(2,int(4*f)))
                texte(dr,X[0]+ox*f*2.2,Y[0]+oy*f*1.6,n,(0,0,0,255),fs,'lm' if ox>0 else 'rm')
    ann=Image.new('RGBA',img.size,(0,0,0,0)); da=ImageDraw.Draw(ann)
    TD=suivre(E,'depressions'); TA=suivre(E,'anticyclones'); TC=suivre(E,'depressions_500')
    W=max(3,int(9*f))
    for row,e in enumerate(E):
        # vignette de gauche : 500 hPa
        for L in e['thalwegs']:
            a=np.array(L); X,Y,ok=xy(a[:,0],a[:,1],0,row,f); ligne(da,X,Y,ok,(123,45,38,255),W,dash=(int(40*f)+6,int(22*f)+4))
        for L in e['dorsales']:
            a=np.array(L); X,Y,ok=xy(a[:,0],a[:,1],0,row,f); ligne(da,X,Y,ok,(234,88,12,255),W)
        for t in TC:
            p=[c for k,c in t if k<=row]
            if not p or t[-1][0]<row and all(k!=row for k,_ in t): continue
            if all(k!=row for k,_ in t): continue
            X,Y,ok=xy([c['lat'] for c in p],[c['lon'] for c in p],0,row,f)
            if len(p)>1: ligne(da,X,Y,ok,(109,40,217,170),max(2,W//2))
            c=p[-1]; col=(109,40,217,255) if c['froid'] else (15,118,110,255)
            if ok[-1]:
                r=int(48*f); da.ellipse([X[-1]-r,Y[-1]-r,X[-1]+r,Y[-1]+r],outline=col,width=W)
                texte(da,X[-1],Y[-1]-r-int(18*f),'GF' if c['froid'] else 'B',col,fn,'mm')
        # vignette de droite : pression mer, centres et trajectoires depuis la première échéance
        for T,lab,col in ((TD,'D',(179,38,30,255)),(TA,'A',(29,78,216,255))):
            for t in T:
                if all(k!=row for k,_ in t): continue
                p=[c for k,c in t if k<=row]
                X,Y,ok=xy([c['lat'] for c in p],[c['lon'] for c in p],1,row,f)
                if len(p)>1:
                    ligne(da,X,Y,ok,col[:3]+(190,),max(2,W//2))
                    for x,y,o in zip(X[:-1],Y[:-1],ok[:-1]):
                        if o: rr=max(3,int(8*f)); da.ellipse([x-rr,y-rr,x+rr,y+rr],fill=col[:3]+(190,))
                if ok[-1]:
                    texte(da,X[-1],Y[-1],lab,col,fb,'mm'); texte(da,X[-1],Y[-1]+int(42*f),str(p[-1]['val']),col,fs,'mm')
    out=d['fichier'].replace('.jpg','')
    rep.save(out+'_rep.png',optimize=True); ann.save(out+'_ann.png',optimize=True)
    legendes(img,f,base,vts,h0,step).save(out+'_leg.png',optimize=True)
    JL,jinfo=jets(img,f,run,vts); JL.save(out+'_jet.png',optimize=True)
    meta[key].update(calque=True,run_ifs=run.isoformat(),base_dwd=base.isoformat(),pas=[h0+step*k for k in range(4)],echeances=[v.isoformat() for v in vts],
                     heures=[heure_suisse(v) for v in vts],rep=out+'_rep.png',ann=out+'_ann.png',leg=out+'_leg.png',jet=out+'_jet.png',jets=jinfo)
    # remplacer la figure simple par une figure à calques
    m=re.search(r'<figure><img src="'+re.escape(d['fichier'])+r'" alt="([^"]*)" loading="lazy"><figcaption>(.*?)</figcaption></figure>',html,re.S)
    if m:
        cap=m.group(2)+(f" Calques ajoutés par-dessus la carte officielle, non modifiée : Saint-Quay-Portrieux, Porquerolles et Rolle (toujours affichés) ; "
             f"avec le bouton « Avec annotations », éléments remarquables calculés sur ECMWF IFS (run du {run:%d/%m %H} UTC, mêmes échéances) : "
             f"thalwegs (tirets bruns) et dorsales (orange) à 500 hPa à gauche, dépressions D et anticyclones A avec leur trajectoire depuis la première échéance à droite, "
             f"dépressions fermées à 500 hPa (B) et gouttes froides (GF, seulement si le cœur froid est confirmé).")
        new=(f'<figure data-map><div class="toggle" role="group" aria-label="Affichage"><button type="button" data-v="base" aria-pressed="true">Carte de base</button>'
             f'<button type="button" data-v="ann" aria-pressed="false">Avec annotations</button></div>'
             f'<div class="stack"><img src="{d["fichier"]}" alt="{m.group(1)}" loading="lazy"><img class="rep" src="{out}_rep.png" alt="" loading="lazy">'
             f'<img class="ann" src="{out}_ann.png" alt="Éléments remarquables : thalwegs, dorsales, dépressions, anticyclones et leurs trajectoires" loading="lazy" hidden></div>'
             f'<figcaption>{cap}</figcaption></figure>')
        html=html[:m.start()]+new+html[m.end():]
json.dump(meta,open('data/dwd_overlay.json','w'),indent=1)
if any(not v.get('calque') for v in meta.values()):
    html=html.replace('<p class="src">Source : Deutscher Wetterdienst','<p class="src">Calques non posés sur certaines cartes 500 hPa + pression mer (mise en page DWD changée ou échéances IFS absentes). Source : Deutscher Wetterdienst',1)
open('site/_dwd.html','w').write(html); print('dwd_overlay',meta)

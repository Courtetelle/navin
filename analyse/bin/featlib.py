"""Détection automatique des éléments remarquables sur des champs IFS 0,25° (grille open data ECMWF) :
dépressions D / anticyclones A au sol, thalwegs et dorsales à 500 hPa, dépressions fermées à 500 hPa et gouttes froides
(cœur ≥ 1 °C plus froid que le pourtour). Même méthode que nh_analyse.py. Utilisé par dwd_overlay.py.
Champs attendus : gh500 (m), t500 (K), msl (Pa) sur la grille 721 x 1440 (lat 90 -> -90, lon -180 -> 180)."""
import json, time, urllib.request, datetime as dt
import numpy as np, eccodes
from scipy.ndimage import minimum_filter, maximum_filter, gaussian_filter, uniform_filter1d
B='https://storage.googleapis.com/ecmwf-open-data/'
def _get(url,rng=None):
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
def dernier_run(now=None,prefer=None,smax=144):
    """Dernier run IFS complet ; `prefer` (datetime) est pris s'il est publié (même heure de base que la carte à annoter)."""
    if prefer is not None and _get(idx_url(prefer,smax)) is not None: return prefer
    now=now or dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    r=now.replace(minute=0,second=0,microsecond=0,hour=now.hour//6*6)
    for _ in range(8):
        if _get(idx_url(r,smax)) is not None: return r
        r-=dt.timedelta(hours=6)
    raise SystemExit('aucun run ECMWF récent trouvé')
def champs(run,step,want=(('gh','500'),('t','500'),('msl',None))):
    F={}
    for L in _get(idx_url(run,step)).decode().splitlines():
        j=json.loads(L); k=(j['param'],j.get('levelist'))
        if k in want:
            g=_get(idx_url(run,step).replace('.index','.grib2'),(j['_offset'],j['_offset']+j['_length']-1))
            h=eccodes.codes_new_from_message(g); ni,nj=eccodes.codes_get(h,'Ni'),eccodes.codes_get(h,'Nj')
            F[k[0]+(k[1] or '')]=eccodes.codes_get_values(h).reshape(nj,ni); eccodes.codes_release(h)
    return F
LAT=90-np.arange(181)*1.0; LON=-180+np.arange(360)*1.0
def analyser(F):
    la1,lo1=LAT,LON
    Z=gaussian_filter((F['gh500']/10)[::4,::4],(1.5,1.5),mode=('nearest','wrap'))
    M=gaussian_filter((F['msl']/100)[::4,::4],(1.2,1.2),mode=('nearest','wrap'))
    T5=(F['t500']-273.15)[::4,::4]
    def extrema(A,mode,size,thr,latmin=20,latmax=80):
        G=(minimum_filter if mode=='min' else maximum_filter)(A,size=size,mode=('nearest','wrap'))
        return [dict(lat=float(la1[y]),lon=float(lo1[x]),val=round(float(A[y,x]))) for y,x in zip(*np.where(A==G))
                if latmin<=la1[y]<=latmax and ((A[y,x]<thr) if mode=='min' else (A[y,x]>thr))]
    def ring(y,x,r0,r1):
        yy,xx=np.mgrid[0:len(la1),0:len(lo1)]
        d=np.hypot(((lo1[xx]-lo1[x]+180)%360-180)*111*np.cos(np.radians(la1[y])),(la1[yy]-la1[y])*111)
        return (d>=r0)&(d<r1)
    CL=[]
    for c in extrema(Z,'min',13,600,25,75):
        y=int(np.argmin(abs(la1-c['lat']))); x=int(np.argmin(abs(lo1-c['lon'])))
        if Z[ring(y,x,450,650)].min()-Z[y,x]<2: continue
        core=T5[ring(y,x,0,200)].mean(); out=T5[ring(y,x,500,900)].mean()
        c.update(tcoeur=round(float(core),1),tpourtour=round(float(out),1),froid=bool(core<=out-1.0)); CL.append(c)
    def axes(mode):
        pts={}
        for y in np.where((la1>=25)&(la1<=72))[0]:
            row=uniform_filter1d(Z[y]-Z[y].mean(),5,mode='wrap')
            G=(minimum_filter if mode=='min' else maximum_filter)(row,size=31,mode='wrap')
            for x in np.where(row==G)[0]:
                w=np.take(row,range(x-25,x+26),mode='wrap')
                if ((w.max()-row[x]) if mode=='min' else (row[x]-w.min()))>=6: pts.setdefault(float(la1[y]),[]).append(float(lo1[x]))
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
                p=np.array(L['p']); lo=np.degrees(uniform_filter1d(np.unwrap(np.radians(p[:,1])),5,mode='nearest'))
                res.append([[float(a),float((b+180)%360-180)] for a,b in zip(p[:,0],lo)])
        return res
    return dict(depressions=extrema(M,'min',15,1005),anticyclones=extrema(M,'max',15,1025),depressions_500=CL,thalwegs=axes('min'),dorsales=axes('max'))

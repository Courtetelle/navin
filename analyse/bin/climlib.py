"""Normales ERA5 1990-2019 (WeatherBench2, 0,25°, toutes les 6 h) en un point. Les blocs téléchargés sont mis en cache disque (clim/cache)."""
import os, json, urllib.request, numpy as np, blosc, datetime as dt
WB="https://storage.googleapis.com/weatherbench2/datasets/era5-hourly-climatology/1990-2019_6h_1440x721.zarr/"
LEV=[50,100,150,200,250,300,400,500,600,700,850,925,1000]
CD=os.path.join('clim','cache'); os.makedirs(CD,exist_ok=True)
_lat=None
def lat():
    global _lat
    if _lat is None:
        m=json.loads(urllib.request.urlopen(WB+'latitude/.zarray',timeout=60).read())
        _lat=np.frombuffer(blosc.decompress(urllib.request.urlopen(WB+'latitude/0',timeout=60).read()),dtype=m['dtype'])
    return _lat
def block(var,doy,hour,level=None):
    hi=[0,6,12,18].index(hour); di=doy-1
    key=f"{var}/{hi//3}.{di//3}"+(f".{LEV.index(level)}" if level else "")+".0.0"
    fn=os.path.join(CD,key.replace('/','_'))
    if not os.path.exists(fn):
        for k in range(5):
            try: open(fn,'wb').write(urllib.request.urlopen(WB+key,timeout=180).read()); break
            except Exception:
                if k==4: raise
    a=np.frombuffer(blosc.decompress(open(fn,'rb').read()),dtype='<f4').reshape(3,3,721,1440)
    return a[hi%3,di%3]
def point(var,when_utc,la,lo,level=None):
    """when_utc : datetime UTC, arrondi à l'heure synoptique 00/06/12/18 la plus proche."""
    h=int(round(when_utc.hour/6.0))*6; w=when_utc.replace(hour=0,minute=0)+dt.timedelta(hours=h)
    a=block(var,w.timetuple().tm_yday,w.hour,level)
    j=int(np.argmin(abs(lat()-la))); i=int(round((lo%360)/0.25))%1440
    v=float(a[j,i])
    if var=='geopotential': v/=9.80665
    elif var=='temperature': v-=273.15
    elif var=='mean_sea_level_pressure': v/=100
    elif var=='relative_humidity': v*= (100 if v<=1.5 else 1)
    return v

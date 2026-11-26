"""Niveaux régional et local de l'analyse, pour une zone d'essai ou un point GPS (zones.py), sans intervention de Claude.
Demandes de Corban : 20/11/2026 (analyse de l'hémisphère au local, cartes de base et annotations par boutons) et
21/11/2026 (« une carte toutes les 3 heures pour se caler sur le rythme des courants », à chaque bascule de courant
ou changement de vent important).

Sources, les DERNIERS runs publiés (règle n° 1), passés par run.py :
- régional : ECMWF IFS 0,25° (miroir GCS) : vent 10 m, rafales, pression mer ;
- local : DWD ICON-EU 6,5 km (vent 10 m, rafales) et DWD EWAM 0,05° (Hs, direction des vagues) ;
- courants : Copernicus Marine IBI 0,027° au quart d'heure (uo, vo, zos), si la zone est dans son domaine et si les
  identifiants COPERNICUSMARINE_SERVICE_USERNAME / _PASSWORD sont fournis. Sinon la page le dit.

Sorties (dossier courant) :
  fig/reg_<t>_{base,annot}.png, fig/loc_<t>_{base,annot}.png  (une échéance par jour, 15 UTC)
  fig/sys_fond.png + fig/sys_<t>_{vent,vagues,courants,annot}.png  (toutes les 3 h, 06 à 18 UTC, + renverses de courant)
  fig/cur_<t>_{base,annot}.png  (pics de flot et de jusant de chaque jour)
  data/local.json
Usage : ZONE='<json>' DAYS="AAAA-MM-JJ ..." RUN=<IFS AAAAMMJJHH> RUN_ICON=... RUN_EWAM=... python3 -I bin/local.py"""
import os, sys, bz2, json, time, math, hashlib, urllib.request, datetime as dt, concurrent.futures as cf
from zoneinfo import ZoneInfo
import numpy as np, eccodes, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt, matplotlib.patheffects as pe
from matplotlib.lines import Line2D
from matplotlib.colors import ListedColormap, BoundaryNorm
import cartopy.crs as ccrs, cartopy.feature as cfeat
from scipy.ndimage import gaussian_filter, minimum_filter, maximum_filter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import situer, situer_local
import reperes  # points des zones d'essai sur toutes les cartes (Corban, 9/11/2026)

PARIS = ZoneInfo('Europe/Paris'); UTC = dt.timezone.utc
KN = 1 / 0.514444
Z = json.loads(os.environ['ZONE'])
DAYS = [dt.date.fromisoformat(d) for d in os.environ['DAYS'].split()]
RUN, RI, RE = os.environ['RUN'], os.environ['RUN_ICON'], os.environ['RUN_EWAM']
r_ifs, r_icon, r_ewam = (dt.datetime.strptime(x, '%Y%m%d%H') for x in (RUN, RI, RE))
REG, LOC = tuple(Z['reg']), tuple(Z['loc'])
REF = (Z['ref'][1], Z['ref'][2])
P = ccrs.PlateCarree()
HALO = [pe.withStroke(linewidth=2.8, foreground='white')]
CACHE = os.environ.get('CACHE', 'cache')
for d in ('fig', 'data', CACHE): os.makedirs(d, exist_ok=True)
ICON_MAX, EWAM_MAX = 120, 78
J = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']


def paris(V):
    return V.replace(tzinfo=UTC).astimezone(PARIS)


def hhmm(t):
    return f"{t.hour} h" if t.minute == 0 else f"{t.hour} h {t.minute:02d}"


def quand(V):
    t = paris(V); return f"{J[t.weekday()]} {t.day}/{t.month} {hhmm(t)}"


# ---------------------------------------------------------------- téléchargements
def get(url, rng=None):
    key = os.path.join(CACHE, hashlib.sha1((url + str(rng)).encode()).hexdigest())
    if os.path.exists(key): return open(key, 'rb').read()
    for i in range(8):
        try:
            rq = urllib.request.Request(url, headers={'User-Agent': 'navin-analyse'})
            if rng: rq.add_header('Range', 'bytes=%d-%d' % rng)
            with urllib.request.urlopen(rq, timeout=90) as r: raw = r.read()
            open(key, 'wb').write(raw); return raw
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            time.sleep(2 * (i + 1))
        except Exception: time.sleep(2 * (i + 1))
    return None


def grid(msg):
    h = eccodes.codes_new_from_message(msg)
    ni, nj = eccodes.codes_get(h, 'Ni'), eccodes.codes_get(h, 'Nj')
    la1, lo1 = eccodes.codes_get(h, 'latitudeOfFirstGridPointInDegrees'), eccodes.codes_get(h, 'longitudeOfFirstGridPointInDegrees')
    di, dj = eccodes.codes_get(h, 'iDirectionIncrementInDegrees'), eccodes.codes_get(h, 'jDirectionIncrementInDegrees')
    sc = eccodes.codes_get(h, 'jScansPositively'); miss = eccodes.codes_get(h, 'missingValue')
    v = eccodes.codes_get_values(h).reshape(nj, ni).astype(float); eccodes.codes_release(h)
    v[(v == miss) | (v > 9e19)] = np.nan
    lat = la1 + np.arange(nj) * dj * (1 if sc else -1)
    lon = (lo1 + np.arange(ni) * di + 180) % 360 - 180
    o = np.argsort(lon); return lat, lon[o], v[:, o]


def crop(lat, lon, v, box, pad=1.0):
    x0, x1, y0, y1 = box
    j = (lat >= y0 - pad) & (lat <= y1 + pad); i = (lon >= x0 - pad) & (lon <= x1 + pad)
    return lat[j], lon[i], v[np.ix_(j, i)]


def step(V, r): return int((V - r).total_seconds() // 3600)


def ifs(V):
    s = step(V, r_ifs); B = f"https://storage.googleapis.com/ecmwf-open-data/{RUN[:8]}/{RUN[8:]}z/ifs/0p25/oper/{RUN}0000-{s}h-oper-fc"
    idx = get(B + '.index')
    if not idx: return V, s, None
    out = {}
    for L in idx.decode().splitlines():
        j = json.loads(L)
        if j.get('levelist') is None and j['param'] in ('10u', '10v', '10fg', 'msl', 'lsm'):
            o, n = j['_offset'], j['_length']
            raw = get(B + '.grib2', (o, o + n - 1))
            if raw: out[j['param']] = crop(*grid(raw), REG)
    return V, s, out


def dwd(kind, V, var):
    if kind == 'icon':
        s = step(V, r_icon)
        if s < 0 or s > ICON_MAX or (s > 78 and s % 3): return (kind, V, var), None
        u = f'https://opendata.dwd.de/weather/nwp/icon-eu/grib/{RI[8:]}/{var.lower()}/icon-eu_europe_regular-lat-lon_single-level_{RI}_{s:03d}_{var}.grib2.bz2'
    else:
        s = step(V, r_ewam)
        if s < 0 or s > EWAM_MAX: return (kind, V, var), None
        u = f'https://opendata.dwd.de/weather/maritime/wave_models/ewam/grib/{RE[8:]}/{var.lower()}/EWAM_{var}_{RE}_{s:03d}.grib2.bz2'
    raw = get(u)
    return (kind, V, var), ((s, crop(*grid(bz2.decompress(raw)), LOC, 0.3)) if raw else None)


DD = {}
def fetch_dwd(times):
    jobs = [('icon', V, x) for V in times for x in ('U_10M', 'V_10M', 'VMAX_10M')] + [('ewam', V, x) for V in times for x in ('SWH', 'MWD')]
    jobs = [j for j in jobs if j not in DD]
    with cf.ThreadPoolExecutor(10) as ex:
        for k, val in ex.map(lambda a: dwd(*a), jobs): DD[k] = val


def icon_at(V):
    a, b, g = DD.get(('icon', V, 'U_10M')), DD.get(('icon', V, 'V_10M')), DD.get(('icon', V, 'VMAX_10M'))
    if not (a and b): return None
    lat, lon, u = a[1]; v = b[1][2]
    return dict(s=a[0], lat=lat, lon=lon, u=u, v=v, g=g[1][2] if g else None)


def ewam_at(V):
    a, b = DD.get(('ewam', V, 'SWH')), DD.get(('ewam', V, 'MWD'))
    if not (a and b): return None
    lat, lon, hs = a[1]; return dict(s=a[0], lat=lat, lon=lon, hs=hs, md=b[1][2])


def nearest_finite(lat, lon, a, p, maxkm=15):
    """Indice de la maille la plus proche du point p ayant une valeur (en mer)."""
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    d = np.hypot((LA - p[0]) * 111, (LO - p[1]) * 111 * math.cos(math.radians(p[0])))
    d = np.where(np.isfinite(a), d, np.inf); j, i = np.unravel_index(np.argmin(d), d.shape)
    return (j, i) if d[j, i] <= maxkm else None


def ang(a, b): return np.abs((a - b + 540) % 360 - 180)


def frm(u, v): return float((math.degrees(math.atan2(u, v)) + 180) % 360)


ROSE = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
def rose(d): return ROSE[int((d % 360) / 22.5 + .5) % 16]


# ---------------------------------------------------------------- type de zone
def in_ibi(p): return 26 <= p[0] <= 56 and -19 <= p[1] <= 5


LAKES = None
def in_lake(p):
    global LAKES
    from shapely.geometry import Point
    if LAKES is None: LAKES = list(cfeat.LAKES.with_scale('10m').geometries())
    q = Point(p[1], p[0]); return any(g.contains(q) for g in LAKES)


# ---------------------------------------------------------------- heures étudiées
def utc(d, h): return dt.datetime(d.year, d.month, d.day, h)


SLOTS = [utc(d, h) for d in DAYS for h in (6, 9, 12, 15, 18)]   # toutes les 3 h, de 7 h à 19 h (hiver) ou 8 h à 20 h (été) à Paris
REGT = [utc(d, 15) for d in DAYS]                                # une carte régionale et locale par jour, l'après-midi
fetch_dwd(sorted(set(SLOTS + REGT)))
ztype = Z['type']
e0 = next((ewam_at(V) for V in SLOTS if ewam_at(V)), None)
sea_ref = e0 is not None and nearest_finite(e0['lat'], e0['lon'], e0['hs'], REF, 12) is not None
if ztype == 'auto':
    ztype = ('maree' if in_ibi(REF) else 'mer') if sea_ref else ('lac' if in_lake(REF) else 'terre')
SEA = ztype in ('maree', 'mer')
OUT = {'zone': Z['nom'], 'type': ztype, 'run_ifs': RUN, 'run_icon': RI, 'run_ewam': RE, 'days': [d.isoformat() for d in DAYS],
       'manque': [], 'echeances': [], 'heures': [], 'courants': None, 'jours': []}

# ---------------------------------------------------------------- courants (Copernicus IBI)
IBI = None
if ztype == 'maree':
    if not os.environ.get('COPERNICUSMARINE_SERVICE_USERNAME'):
        OUT['manque'].append('courants : identifiants Copernicus Marine absents (secrets COPERNICUSMARINE_SERVICE_USERNAME et _PASSWORD)')
    else:
        try:
            import copernicusmarine as cm, xarray as xr
            cm.subset(dataset_id='cmems_mod_ibi_phy_anfc_0.027deg-2D_PT15M-i', variables=['uo', 'vo', 'zos'],
                      minimum_longitude=LOC[0] - .05, maximum_longitude=LOC[1] + .05, minimum_latitude=LOC[2] - .05, maximum_latitude=LOC[3] + .05,
                      start_datetime=f'{DAYS[0]}T00:00:00', end_datetime=f'{DAYS[-1]}T23:45:00',
                      output_filename='ibi.nc', output_directory=CACHE, overwrite=True)
            IBI = xr.open_dataset(os.path.join(CACHE, 'ibi.nc'))
            OUT['courants_source'] = 'cmems_mod_ibi_phy_anfc_0.027deg-2D_PT15M-i'
        except Exception as e:
            OUT['manque'].append(f'courants : Copernicus Marine n\'a pas répondu ({type(e).__name__})')
elif ztype == 'mer':
    OUT['manque'].append('courants : hors du domaine du modèle IBI ; en Méditerranée la marée est faible, courants non calculés')

EVENTS = {}   # heure UTC -> étiquettes (renverse, pic, saute de vent)
CUR = None
if IBI is not None:
    lat_c, lon_c = IBI.latitude.values, IBI.longitude.values
    t0 = IBI.isel(time=0); ij = nearest_finite(lat_c, lon_c, t0.uo.values, REF, 8)
    if ij is None:
        OUT['manque'].append('courants : pas de valeur du modèle près du point de référence'); IBI = None
    else:
        s = IBI.isel(latitude=ij[0], longitude=ij[1])
        tt = [dt.datetime.utcfromtimestamp(int(x) / 1e9) for x in s.time.values.astype('datetime64[ns]').astype('int64')]
        cu, cv, zo = s.uo.values * 1.943844, s.vo.values * 1.943844, s.zos.values
        sp = np.hypot(cu, cv); to = (np.degrees(np.arctan2(cu, cv)) + 360) % 360
        # axe principal du courant et sens du flot (marée montante : zos qui monte)
        X = np.vstack([cu, cv]); w, vec = np.linalg.eigh(np.cov(X)); ax_ = vec[:, -1]; along = ax_ @ X
        dz = np.gradient(zo)
        if np.nanmean(along[dz > 0]) < 0: ax_, along = -ax_, -along
        flot_vers = (math.degrees(math.atan2(ax_[0], ax_[1])) + 360) % 360
        CUR = dict(point=Z['ref'][0], lat=float(lat_c[ij[0]]), lon=float(lon_c[ij[1]]), flot_vers=round(flot_vers), jusant_vers=round((flot_vers + 180) % 360),
                   serie=[], renverses=[], pics=[])
        for k in range(len(tt)):
            CUR['serie'].append(dict(t=tt[k].isoformat(), kn=round(float(sp[k]), 2), vers=round(float(to[k])), phase='flot' if along[k] > 0 else 'jusant'))
        day_ok = lambda t: 6 <= paris(t).hour <= 21 and paris(t).date() in DAYS
        for k in range(1, len(tt)):
            if np.sign(along[k]) != np.sign(along[k - 1]) and day_ok(tt[k]):
                kind = 'flot' if along[k] > 0 else 'jusant'
                CUR['renverses'].append(dict(t=tt[k].isoformat(), debut=kind))
                h = (tt[k] + dt.timedelta(minutes=30)).replace(minute=0)
                EVENTS.setdefault(h, []).append(f'renverse, début du {kind}')
        for d in DAYS:
            for kind, sgn in (('flot', 1), ('jusant', -1)):
                m = [k for k in range(len(tt)) if paris(tt[k]).date() == d and 6 <= paris(tt[k]).hour <= 20 and sgn * along[k] > 0]
                if not m: continue
                k = max(m, key=lambda q: sp[q])
                CUR['pics'].append(dict(t=tt[k].isoformat(), phase=kind, kn=round(float(sp[k]), 1), vers=round(float(to[k]))))
        CUR['pics'].sort(key=lambda p: p['t'])
OUT['courants'] = CUR

# heures de la carte « système » : toutes les 3 h + renverses de courant (dans la portée des modèles)
SYS = sorted(set(SLOTS) | {h for h in EVENTS if 0 <= step(h, r_icon) <= 78})
PEAKS = [(dt.datetime.fromisoformat(p['t']) + dt.timedelta(minutes=30)).replace(minute=0) for p in (CUR['pics'] if CUR else [])]
fetch_dwd(sorted(set(SYS) | set(PEAKS)))
for V in SYS:
    if not icon_at(V): OUT['manque'].append(f'ICON-EU : pas d\'échéance pour {quand(V)}')
    if SEA and not ewam_at(V): OUT['manque'].append(f'vagues EWAM : au-delà de +{EWAM_MAX} h pour {quand(V)}')

# ---------------------------------------------------------------- outils de cartes
WCOL = ['#f7fbff', '#d6ebf7', '#a9d3ea', '#6fb3dc', '#3e8fc5', '#2c9f5b', '#9ccc44', '#f2d33a', '#f39a2b', '#e2462e', '#b0174a', '#6b0f6b']
WLEV = [0, 5, 10, 14, 18, 22, 25, 28, 32, 36, 42, 50, 60]
WCM, WN = ListedColormap(WCOL), BoundaryNorm(WLEV, len(WCOL))
HCM = plt.get_cmap('YlGnBu'); HLEV = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5]


def frame(box, size, axes=(0.01, 0.07, 0.98, 0.84)):
    fig = plt.figure(figsize=size, dpi=130)
    proj = ccrs.LambertConformal(central_longitude=(box[0] + box[1]) / 2, central_latitude=(box[2] + box[3]) / 2) if box == REG else ccrs.Mercator()
    ax = fig.add_axes(list(axes), projection=proj); ax.set_extent(box, P)
    if box == LOC: ax._reperes = True   # à l'échelle locale, marks() pose déjà les points (pas de doublon de reperes.py)
    return fig, ax


def decor(ax, lakes=True):
    ax.add_feature(cfeat.LAND.with_scale('10m'), facecolor='#ece6da', zorder=2)
    if lakes: ax.add_feature(cfeat.LAKES.with_scale('10m'), facecolor='#dcecf3', edgecolor='#444', lw=.5, zorder=2.5)
    ax.add_feature(cfeat.COASTLINE.with_scale('10m'), linewidth=0.7, zorder=3)
    ax.add_feature(cfeat.BORDERS.with_scale('10m'), linewidth=0.4, zorder=3)
    gl = ax.gridlines(draw_labels=True, linewidth=0.3, color='#888', alpha=0.5, zorder=4); gl.top_labels = gl.right_labels = False
    gl.xlabel_style = gl.ylabel_style = {'size': 7}


def cbar(fig, mappable, label, ticks):
    cax = fig.add_axes([0.15, 0.03, 0.7, 0.018]); c = fig.colorbar(mappable, cax=cax, orientation='horizontal', ticks=ticks)
    c.set_label(label, fontsize=8); c.ax.tick_params(labelsize=7)


def marks(ax, fs=8):
    for n, a, b, k in Z['points']:
        ax.plot(b, a, marker={'port': 'o', 'gps': 'D'}.get(k, '^'), ms=7, mfc='#ffd400' if k == 'port' else '#6a1b9a', mec='#222' if k == 'port' else 'white', transform=P, zorder=9)
        t = ax.text(b + .02, a - .035, n, fontsize=fs, color='#222' if k == 'port' else '#4a148c', weight='bold', transform=P, zorder=9, clip_on=True); t.set_path_effects(HALO)
    if Z.get('parc'):
        la0, lo0, rk = Z['parc']; th = np.linspace(0, 2 * np.pi, 120)
        ax.plot(lo0 + rk / (111.32 * np.cos(np.radians(la0))) * np.cos(th), la0 + rk / 110.57 * np.sin(th), color='#e65100', lw=1.3, ls='--', transform=P, zorder=8)
        t = ax.text(lo0, la0 + .085, 'Parc éolien', fontsize=fs, color='#bf360c', weight='bold', ha='center', transform=P, zorder=9); t.set_path_effects(HALO)


def water_mask(lat, lon, e):
    """Mailles en mer (EWAM a une valeur) ou dans un lac ; pour la terre ferme, tout le cadre."""
    LA, LO = np.meshgrid(lat, lon, indexing='ij')
    box = (LA >= LOC[2]) & (LA <= LOC[3]) & (LO >= LOC[0]) & (LO <= LOC[1])
    if SEA and e is not None:
        jh = np.abs(e['lat'][:, None] - lat[None, :]).argmin(0); ih = np.abs(e['lon'][:, None] - lon[None, :]).argmin(0)
        return box & np.isfinite(e['hs'])[np.ix_(jh, ih)]
    if ztype == 'lac':
        from shapely.geometry import Point
        from shapely.prepared import prep
        global LAKES
        if LAKES is None: LAKES = list(cfeat.LAKES.with_scale('10m').geometries())
        G = [prep(g) for g in LAKES if g.intersects(__import__('shapely.geometry', fromlist=['box']).box(LOC[0], LOC[2], LOC[1], LOC[3]))]
        m = np.array([[any(g.contains(Point(o, a)) for g in G) for o in lon] for a in lat])
        return box & m if m.any() else box
    return box


def centres(lat, lon, msl):
    sm = gaussian_filter(msl, 1.5); res = []
    for kind, f in (('D', minimum_filter), ('A', maximum_filter)):
        m = (sm == f(sm, size=17))
        for j, i in zip(*np.where(m)):
            if 2 < j < len(lat) - 3 and 2 < i < len(lon) - 3 and REG[2] <= lat[j] <= REG[3] and REG[0] <= lon[i] <= REG[1]:
                res.append((kind, float(lat[j]), float(lon[i]), round(float(sm[j, i]))))
    return res


# ---------------------------------------------------------------- 3. régional (IFS)
with cf.ThreadPoolExecutor(3) as ex: IFS = {V: (s, d) for V, s, d in ex.map(ifs, REGT)}
for V in REGT:
    tag = V.strftime('%Y%m%d%H'); info = {'valid': V.isoformat(), 'quand': quand(V), 'tag': tag}
    s, d = IFS[V]
    if not d or not all(k in d for k in ('10u', '10v', '10fg', 'msl')):
        OUT['manque'].append(f'ECMWF IFS : échéance +{s} h absente du run {RUN}'); info['regional'] = None
    else:
        lat, lon, u = d['10u']; v = d['10v'][2]; g = d['10fg'][2]; hpa = d['msl'][2] / 100
        sp, gk = np.hypot(u, v) * KN, g * KN
        land = d['lsm'][2] > 0.5 if 'lsm' in d else np.zeros_like(sp, bool)
        spm, gkm = np.where(land, np.nan, sp), np.where(land, np.nan, gk)
        LO, LA = np.meshgrid(lon, lat); inreg = (LA > REG[2]) & (LA < REG[3]) & (LO > REG[0]) & (LO < REG[1])
        C = centres(lat, lon, hpa)
        jm, im = np.unravel_index(np.nanargmax(np.where(inreg & (~land if SEA else True), sp, -1)), sp.shape)
        jz, iz = np.abs(lat - Z['lat']).argmin(), np.abs(lon - Z['lon']).argmin()
        frac = lambda a, k: round(float(np.nanmean((a >= k)[inreg & ~land])), 2) if (inreg & ~land).any() else None
        info['regional'] = {'pas': s, 'centres': [dict(type=k, lat=a, lon=b, hpa=p, ou=situer(a, b)) for k, a, b, p in C],
                            'vent_max_kn': round(float(sp[jm, im])), 'vent_max_ou': situer(float(lat[jm]), float(lon[im])),
                            'part_18': frac(sp, 18), 'part_25': frac(sp, 25),
                            'zone_kn': round(float(sp[jz, iz])), 'zone_du': round(frm(u[jz, iz], v[jz, iz])), 'zone_hpa': round(float(hpa[jz, iz]))}
        for annot in (False, True):
            fig, ax = frame(REG, (8.2, 7.2)); decor(ax, lakes=ztype == 'lac')
            cf_ = ax.contourf(lon, lat, sp, levels=WLEV, cmap=WCM, norm=WN, transform=P, zorder=1, extend='max')
            cs = ax.contour(lon, lat, gaussian_filter(hpa, 1), levels=np.arange(950, 1050, 2), colors='#222', linewidths=0.7, transform=P, zorder=5)
            ax.clabel(cs, fontsize=6.5, fmt='%d')
            k = 3; ax.barbs(lon[::k], lat[::k], (u * KN)[::k, ::k], (v * KN)[::k, ::k], length=4.6, linewidth=0.5, transform=P, zorder=6, color='#111')
            if annot:
                for lev, col in ((18, '#f39a2b'), (25, '#d62728')):
                    ax.contour(lon, lat, spm, levels=[lev], colors=col, linewidths=2.2, transform=P, zorder=7)
                ax.contour(lon, lat, gkm, levels=[35], colors='#7b1fa2', linewidths=2, linestyles='--', transform=P, zorder=7)
                for kk, a, b, p in C:
                    col = '#c62828' if kk == 'D' else '#1565c0'
                    t = ax.text(b, a, kk, color=col, fontsize=20, weight='bold', ha='center', va='center', transform=P, zorder=9); t.set_path_effects(HALO)
                    t = ax.text(b, a - 0.55, str(p), color=col, fontsize=8, weight='bold', ha='center', transform=P, zorder=9); t.set_path_effects(HALO)
                ax.plot(lon[im], lat[jm], marker='*', ms=13, mfc='#d62728', mec='white', transform=P, zorder=9)
                ax.legend(handles=[Line2D([], [], color='#f39a2b', lw=2.2, label='Vent moyen 18 nd (orange au près)'),
                                   Line2D([], [], color='#d62728', lw=2.2, label='Vent moyen 25 nd (rouge au près)'),
                                   Line2D([], [], color='#7b1fa2', lw=2, ls='--', label='Rafales 35 nd (rouge)'),
                                   Line2D([], [], marker='*', ls='', color='#d62728', ms=11, label=f"Vent max {round(float(sp[jm, im]))} nd")],
                          loc='lower left', fontsize=7, framealpha=0.9).set_zorder(20)
            fig.text(0.01, 0.975, f"Régional · {Z['reg_nom']} · ECMWF IFS 0,25°, run {r_ifs:%d/%m %H} UTC, +{s} h · {quand(V)} (heure de Paris)", fontsize=9, weight='bold', va='top')
            fig.text(0.01, 0.945, 'Vent moyen 10 m (nd, couleurs et barbules) · pression mer (hPa, traits noirs)', fontsize=8, va='top')
            cbar(fig, cf_, 'Vent moyen à 10 m (nd)', WLEV[:-1])
            fig.savefig(f"fig/reg_{tag}_{'annot' if annot else 'base'}.png"); plt.close(fig)

    # ---------------- 4. local (ICON-EU + EWAM)
    w, e = icon_at(V), ewam_at(V)
    if not w:
        info['local'] = None
    else:
        spl = np.hypot(w['u'], w['v']) * KN; gkl = w['g'] * KN if w['g'] is not None else None
        inw = water_mask(w['lat'], w['lon'], e)
        LOw, LAw = np.meshgrid(w['lon'], w['lat'])
        loc = {'icon_pas': w['s'], 'vent_kn': [round(float(np.nanmin(spl[inw]))), round(float(np.nanmax(spl[inw])))],
               'rafales_max_kn': round(float(np.nanmax(gkl[inw]))) if gkl is not None else None}
        jx, ix = np.unravel_index(np.nanargmax(np.where(inw, spl, -1)), spl.shape)
        loc['vent_max_ou'] = situer_local(float(w['lat'][jx]), float(w['lon'][ix]))
        if e is not None and SEA:
            LAh, LOh = np.meshgrid(e['lat'], e['lon'], indexing='ij')
            inloc = (LAh >= LOC[2]) & (LAh <= LOC[3]) & (LOh >= LOC[0]) & (LOh <= LOC[1]) & np.isfinite(e['hs'])
            loc.update(ewam_pas=e['s'], hs_m=[round(float(np.nanmin(e['hs'][inloc])), 1), round(float(np.nanmax(e['hs'][inloc])), 1)])
            jh, ih = np.unravel_index(np.nanargmax(np.where(inloc, e['hs'], -1)), e['hs'].shape)
            loc['hs_max_ou'] = situer_local(float(e['lat'][jh]), float(e['lon'][ih]))
        info['local'] = loc
        for annot in (False, True):
            fig, ax = frame(LOC, (8.2, 7.9)); decor(ax)
            if SEA and e is not None:
                cf_ = ax.contourf(e['lon'], e['lat'], e['hs'], levels=HLEV, cmap=HCM, transform=P, zorder=1, extend='max')
                k = 2; rad = np.radians(e['md'][::k, ::k])
                ax.quiver(e['lon'][::k], e['lat'][::k], -np.sin(rad), -np.cos(rad), transform=P, zorder=5, color='#0d47a1', scale=38, width=0.0022, alpha=0.75)
                cl, ct = 'Hauteur significative des vagues Hs (m)', HLEV[:-1]
            else:
                cf_ = ax.contourf(w['lon'], w['lat'], np.where(inw, spl, np.nan), levels=WLEV, cmap=WCM, norm=WN, transform=P, zorder=2.6, extend='max', alpha=.85)
                cl, ct = 'Vent moyen à 10 m (nd)', WLEV[:-1]
            ax.barbs(LOw[inw], LAw[inw], (w['u'] * KN)[inw], (w['v'] * KN)[inw], length=6, linewidth=0.8, transform=P, zorder=6, color='#111')
            if annot:
                if SEA and e is not None:
                    ax.contour(e['lon'], e['lat'], e['hs'], levels=[1.0], colors='#f39a2b', linewidths=1.8, transform=P, zorder=7)
                    ax.contour(e['lon'], e['lat'], e['hs'], levels=[2.0], colors='#d62728', linewidths=2.2, transform=P, zorder=7)
                marks(ax)
                t = ax.text(w['lon'][ix], w['lat'][jx] + 0.035, f"{round(float(spl[jx, ix]))} nd", fontsize=9, color='#c62828', weight='bold', ha='center', transform=P, zorder=9, clip_on=True); t.set_path_effects(HALO)
                hd = [Line2D([], [], color='#c62828', ls='', marker='$nd$', ms=12, label='Vent max ICON-EU dans le cadre')]
                if SEA and e is not None:
                    hd = [Line2D([], [], color='#f39a2b', lw=1.8, label='Hs 1 m'), Line2D([], [], color='#d62728', lw=2.2, label='Hs 2 m (orange au près)'),
                          Line2D([], [], color='#0d47a1', marker=r'$\rightarrow$', ls='', ms=10, label='Sens des vagues')] + hd
                ax.legend(handles=hd, loc='lower right', fontsize=7, framealpha=0.9).set_zorder(20)
            src = (f"Vagues DWD EWAM 0,05° (Hs, m, couleurs ; flèches bleues), run {r_ewam:%d/%m %H} UTC +{e['s']} h · " if SEA and e is not None else '') + \
                  f"vent DWD ICON-EU 6,5 km (barbules, nd), run {r_icon:%d/%m %H} UTC +{w['s']} h"
            fig.text(0.01, 0.975, f"Local · {Z['bassin']} · {quand(V)} (heure de Paris)", fontsize=9, weight='bold', va='top')
            fig.text(0.01, 0.945, src, fontsize=7.2, va='top')
            cbar(fig, cf_, cl, ct)
            fig.savefig(f"fig/loc_{tag}_{'annot' if annot else 'base'}.png"); plt.close(fig)
    OUT['echeances'].append(info)
    print('reg/loc', tag, flush=True)

# ---------------------------------------------------------------- 6. vent, vagues, courants toutes les 3 h
SYSBOX = (0.07, 0.05, 0.91, 0.9)
fig, ax = frame(LOC, (8.2, 7.6), SYSBOX)
ax.add_feature(cfeat.OCEAN.with_scale('10m'), facecolor='#f4f8fa', zorder=0); decor(ax); marks(ax)
fig.savefig('fig/sys_fond.png'); plt.close(fig)


def ibi_at(V):
    if IBI is None: return None
    c = IBI.sel(time=np.datetime64(V), method='nearest')
    if abs((c.time.values.astype('datetime64[s]').astype(object) - V).total_seconds()) > 1800: return None
    cu, cv = c.uo.values * 1.943844, c.vo.values * 1.943844
    return dict(lat=c.latitude.values, lon=c.longitude.values, u=cu, v=cv, s=np.hypot(cu, cv))


def nearest_idx(lat, lon, la, lo):
    return np.abs(lat[:, None] - la.ravel()[None, :]).argmin(0).reshape(la.shape), np.abs(lon[:, None] - lo.ravel()[None, :]).argmin(0).reshape(lo.shape)


def at_ref(lat, lon, a):
    ij = nearest_finite(lat, lon, a, REF, 12); return ij


prev = None
for V in SYS:
    tag = V.strftime('%Y%m%d%H'); w, e, c = icon_at(V), ewam_at(V) if SEA else None, ibi_at(V)
    if not w: continue
    layers = ['vent']
    inw = water_mask(w['lat'], w['lon'], e)
    LOw, LAw = np.meshgrid(w['lon'], w['lat']); m = np.zeros_like(inw); m[::2, ::2] = True; m &= inw
    fig, ax = frame(LOC, (8.2, 7.6), SYSBOX); ax.barbs(LOw[m], LAw[m], (w['u'] * KN)[m], (w['v'] * KN)[m], length=6, linewidth=.9, color='#111', transform=P, zorder=6)
    fig.savefig(f'fig/sys_{tag}_vent.png', transparent=True); plt.close(fig)
    if e is not None:
        layers.append('vagues'); sea = np.isfinite(e['hs'])
        LOh, LAh = np.meshgrid(e['lon'], e['lat']); mh = np.zeros_like(sea); mh[::2, ::2] = True; mh &= sea
        rad = np.radians(e['md']); wu, wv = -np.sin(rad) * e['hs'], -np.cos(rad) * e['hs']
        fig, ax = frame(LOC, (8.2, 7.6), SYSBOX); ax.quiver(LOh[mh], LAh[mh], wu[mh], wv[mh], color='#1565c0', scale=28, width=.0034, alpha=.85, transform=P, zorder=5)
        fig.savefig(f'fig/sys_{tag}_vagues.png', transparent=True); plt.close(fig)
    if c is not None:
        layers.append('courants')
        LOc, LAc = np.meshgrid(c['lon'], c['lat']); mc = np.zeros(c['s'].shape, bool); mc[::3, ::3] = True; mc &= np.isfinite(c['s'])
        fig, ax = frame(LOC, (8.2, 7.6), SYSBOX); ax.quiver(LOc[mc], LAc[mc], c['u'][mc], c['v'][mc], color='#8e24aa', scale=30, width=.0028, transform=P, zorder=7)
        fig.savefig(f'fig/sys_{tag}_courants.png', transparent=True); plt.close(fig)
        jw, iw = nearest_idx(w['lat'], w['lon'], LAc, LOc); wspd = (np.hypot(w['u'], w['v']) * KN)[jw, iw]
        wto = ((np.degrees(np.arctan2(w['u'], w['v'])) + 360) % 360)[jw, iw]; cto = (np.degrees(np.arctan2(c['u'], c['v'])) + 360) % 360
        wc = (ang(cto, wto) > 135) & (c['s'] >= .5) & (wspd >= 8)
        vc = np.zeros_like(wc)
        if e is not None:
            jv, iv = nearest_idx(e['lat'], e['lon'], LAc, LOc); vto = ((e['md'] + 180) % 360)[jv, iv]; vc = (ang(cto, vto) > 135) & (c['s'] >= .5) & (e['hs'][jv, iv] >= .5)
        layers.append('annot')
        fig, ax = frame(LOC, (8.2, 7.6), SYSBOX)
        for msk, col in ((vc, '#ef6c00'), (wc, '#d62728')):
            f = np.where(msk, 1., np.nan)
            if msk.any():
                ax.contourf(c['lon'], c['lat'], f, levels=[.5, 1.5], colors=[col], alpha=.16, transform=P, zorder=6)
                ax.contour(c['lon'], c['lat'], np.nan_to_num(f), levels=[.5], colors=[col], linewidths=1.8, transform=P, zorder=7)
        fig.savefig(f'fig/sys_{tag}_annot.png', transparent=True); plt.close(fig)
    # valeurs au point de référence
    spd = np.hypot(w['u'], w['v']) * KN
    jx, ix = np.abs(w['lat'] - REF[0]).argmin(), np.abs(w['lon'] - REF[1]).argmin()
    H = {'valid': V.isoformat(), 'tag': tag, 'quand': quand(V), 'couches': layers, 'icon_pas': w['s'], 'evenements': list(EVENTS.get(V, [])),
         'vent_kn': round(float(spd[jx, ix])), 'vent_du': round(frm(w['u'][jx, ix], w['v'][jx, ix])),
         'rafales_kn': round(float(w['g'][jx, ix] * KN)) if w['g'] is not None else None}
    if e is not None:
        ij = at_ref(e['lat'], e['lon'], e['hs'])
        if ij: H.update(hs_m=round(float(e['hs'][ij]), 1), vagues_de=round(float(e['md'][ij])), ewam_pas=e['s'])
    if c is not None:
        ij = at_ref(c['lat'], c['lon'], c['s'])
        if ij:
            H.update(courant_kn=round(float(c['s'][ij]), 1), courant_vers=round(float((math.degrees(math.atan2(c['u'][ij], c['v'][ij])) + 360) % 360)))
            H['part_vent_contre_courant'] = round(float(wc.sum() / max(np.isfinite(c['s']).sum(), 1)), 2)
            H['part_vagues_contre_courant'] = round(float(vc.sum() / max(np.isfinite(c['s']).sum(), 1)), 2)
    # changement de vent important depuis l'heure précédente étudiée (même jour)
    if prev and paris(dt.datetime.fromisoformat(prev['valid'])).date() == paris(V).date():
        dk = H['vent_kn'] - prev['vent_kn']; dd = float(ang(H['vent_du'], prev['vent_du']))
        if abs(dk) >= 8 or (dd >= 45 and max(H['vent_kn'], prev['vent_kn']) >= 10):
            H['evenements'].append(f"changement de vent : {prev['vent_kn']} → {H['vent_kn']} nd, {rose(prev['vent_du'])} → {rose(H['vent_du'])}")
    prev = H
    OUT['heures'].append(H)
    print('sys', tag, H['evenements'], flush=True)

# ---------------------------------------------------------------- 5. courants : cartes aux pics de flot et de jusant
if CUR:
    HCUR = plt.get_cmap('PuBu'); CLEV = [0, .25, .5, .75, 1, 1.25, 1.5, 2, 2.5, 3, 4]
    for p, Vh in zip(CUR['pics'], PEAKS):
        V = dt.datetime.fromisoformat(p['t']); c = ibi_at(V); w = icon_at(Vh)
        if c is None: continue
        tag = V.strftime('%Y%m%d%H%M'); p['tag'] = tag; p['quand'] = quand(V)
        LOc, LAc = np.meshgrid(c['lon'], c['lat'])
        if w:
            jx, ix = np.abs(w['lat'] - REF[0]).argmin(), np.abs(w['lon'] - REF[1]).argmin()
            p['vent_kn'] = round(float(np.hypot(w['u'][jx, ix], w['v'][jx, ix]) * KN)); p['vent_du'] = round(frm(w['u'][jx, ix], w['v'][jx, ix]))
            p['ecart'] = round(float(ang((p['vent_du'] + 180) % 360, p['vers'])))
        for annot in (False, True):
            fig, ax = frame(LOC, (8.2, 7.9)); decor(ax)
            cf_ = ax.contourf(c['lon'], c['lat'], c['s'], levels=CLEV, cmap=HCUR, extend='max', transform=P, zorder=1)
            mc = np.zeros(c['s'].shape, bool); mc[::2, ::2] = True; mc &= np.isfinite(c['s'])
            ax.quiver(LOc[mc], LAc[mc], (c['u'] / np.maximum(c['s'], .05))[mc], (c['v'] / np.maximum(c['s'], .05))[mc], color='#4a148c', scale=45, width=.0022, transform=P, zorder=5)
            if annot:
                marks(ax)
                if w:
                    jw, iw = nearest_idx(w['lat'], w['lon'], LAc, LOc)
                    wto = ((np.degrees(np.arctan2(w['u'], w['v'])) + 360) % 360)[jw, iw]; wsp = (np.hypot(w['u'], w['v']) * KN)[jw, iw]
                    cto = (np.degrees(np.arctan2(c['u'], c['v'])) + 360) % 360
                    f = np.where((ang(cto, wto) > 135) & (c['s'] >= .5) & (wsp >= 8), 1., np.nan)
                    if np.isfinite(f).any():
                        ax.contourf(c['lon'], c['lat'], f, levels=[.5, 1.5], colors=['#d62728'], alpha=.2, transform=P, zorder=6)
                        ax.contour(c['lon'], c['lat'], np.nan_to_num(f), levels=[.5], colors=['#d62728'], linewidths=1.8, transform=P, zorder=7)
                for n, a, b, k in Z['points']:
                    ij = nearest_finite(c['lat'], c['lon'], c['s'], (a, b), 4)
                    if ij:
                        t = ax.text(b + .02, a + .02, f"{c['s'][ij]:.1f} nd".replace('.', ','), fontsize=8, color='#4a148c', weight='bold', transform=P, zorder=10); t.set_path_effects(HALO)
            fig.text(0.01, 0.975, f"Courants de surface · {Z['bassin']} · {quand(V)} (heure de Paris), pic de {p['phase']}", fontsize=9, weight='bold', va='top')
            fig.text(0.01, 0.945, 'Copernicus Marine IBI 0,027° (marée et météo), champ instantané · vitesse en nd, flèches dans le sens du courant' + (' · rouge : vent ICON-EU contre le courant' if annot and w else ''), fontsize=7.2, va='top')
            cbar(fig, cf_, 'Vitesse du courant (nd)', CLEV[:-1])
            fig.savefig(f"fig/cur_{tag}_{'annot' if annot else 'base'}.png"); plt.close(fig)
    CUR['serie'] = CUR['serie'][::4]  # une valeur par heure suffit pour la page

# ---------------------------------------------------------------- go / no-go par jour (règles de NAVIn, Dufour 445 GL au près)
for d in DAYS:
    hs_ = [h for h in OUT['heures'] if paris(dt.datetime.fromisoformat(h['valid'])).date() == d and 7 <= paris(dt.datetime.fromisoformat(h['valid'])).hour <= 18]
    if not hs_: OUT['jours'].append(dict(date=d.isoformat(), vide=True)); continue
    wk = max(h['vent_kn'] for h in hs_); gk = max((h['rafales_kn'] or 0) for h in hs_)
    hsv = [h['hs_m'] for h in hs_ if h.get('hs_m') is not None]; hm = max(hsv) if hsv else None
    lv = 'go'
    for val, (o, r) in ((wk, (18, 25)), (gk, (28, 35)), (hm, (2, 3.5))):
        if val is None: continue
        if val >= r: lv = 'nogo'
        elif val >= o and lv == 'go': lv = 'prudence'
    dirs = [h['vent_du'] for h in hs_]
    OUT['jours'].append(dict(date=d.isoformat(), vent_kn=wk, rafales_kn=gk, hs_m=hm, feu=lv, heures=[h['quand'] for h in hs_],
                             vent_min=min(h['vent_kn'] for h in hs_), dirs=[rose(x) for x in dirs]))
OUT['evenements'] = {h['tag']: h['evenements'] for h in OUT['heures'] if h['evenements']}
OUT['manque'] = sorted(set(OUT['manque']))
json.dump(OUT, open('data/local.json', 'w'), ensure_ascii=False, indent=1)
print('local ok', ztype, len(OUT['heures']), 'heures', flush=True)

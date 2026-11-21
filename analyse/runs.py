"""Derniers runs publiés par les fournisseurs (règle n° 1 : toujours le dernier run, jamais un ancien).
Sert à run.py pour décider s'il faut refaire l'analyse (relance automatique dès qu'un nouveau run est publié)."""
import datetime as dt, re, urllib.request, urllib.error

UA = {'User-Agent': 'navin-analyse'}


def _ok(url):
    try:
        rq = urllib.request.Request(url, method='HEAD', headers=UA)
        with urllib.request.urlopen(rq, timeout=40) as r: return r.status == 200
    except Exception:
        return False


def _ls(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r: return r.read().decode('utf-8', 'replace')
    except Exception:
        return ''


def now():
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, minute=0, second=0, microsecond=0)


def ifs(need_step=90):
    """Dernier run IFS 0,25° (miroir GCS d'ECMWF open data) qui va au moins jusqu'à need_step."""
    r = now().replace(hour=now().hour // 6 * 6)
    for _ in range(10):
        if need_step <= (90 if r.hour in (6, 18) else 144) or need_step <= 144 and r.hour in (0, 12):
            u = f"https://storage.googleapis.com/ecmwf-open-data/{r:%Y%m%d}/{r:%H}z/ifs/0p25/oper/{r:%Y%m%d%H}0000-{need_step}h-oper-fc.index"
            if _ok(u): return r.strftime('%Y%m%d%H')
        r -= dt.timedelta(hours=6)
    return None


def icon_eu():
    """Dernier run ICON-EU complet (jusqu'à +120 h)."""
    best = None
    for h in ('00', '06', '12', '18'):
        runs = set(re.findall(r'single-level_(\d{10})_120_U_10M', _ls(f'https://opendata.dwd.de/weather/nwp/icon-eu/grib/{h}/u_10m/')))
        if runs: best = max([best] + list(runs)) if best else max(runs)
    return best


def ewam():
    """Dernier run EWAM complet (jusqu'à +78 h)."""
    best = None
    for h in ('00', '12'):
        runs = set(re.findall(r'EWAM_SWH_(\d{10})_078', _ls(f'https://opendata.dwd.de/weather/maritime/wave_models/ewam/grib/{h}/swh/')))
        if runs: best = max([best] + list(runs)) if best else max(runs)
    return best


def latest():
    return {'ifs': ifs(), 'icon': icon_eu(), 'ewam': ewam()}


if __name__ == '__main__':
    print(latest())

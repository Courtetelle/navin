"""Chef d'orchestre de l'analyse « de l'hémisphère au local », sans Claude (demande de Corban du 21/11/2026).

  python3 -I analyse/run.py --store DIR --check            dit quelles zones automatiques ont un nouveau run (sortie GitHub)
  python3 -I analyse/run.py --store DIR --auto             refait les zones automatiques dont un run a changé
  python3 -I analyse/run.py --store DIR --zone rolle       refait une zone d'essai tout de suite
  python3 -I analyse/run.py --store DIR --lat 48.7 --lon -2.75   refait l'analyse autour d'un point GPS

DIR est le dossier des versions (branche « analyses » du dépôt), publié avec NAVIn sous analyse/v/ :
  DIR/index.json                   liste des versions par zone (menus déroulants)
  DIR/state.json                   derniers runs traités par zone
  DIR/<zone>/<version>/index.html  version complète (page, cartes en WebP, summary.json, files.json)
Conservation : toutes les versions des 3 derniers jours, puis la dernière de chaque jour pendant 60 jours ;
points GPS : 10 versions et 30 jours ; plafond total 700 Mo (les plus anciennes partent d'abord)."""
import argparse, datetime as dt, glob, json, os, shutil, subprocess, sys, tempfile
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__)); BIN = os.path.join(HERE, 'bin')
sys.path.insert(0, HERE)
import zones, runs as R

PARIS = ZoneInfo('Europe/Paris'); UTC = dt.timezone.utc
CLAUDE = {'saint-quay': dict(id='claude-2026112023', label='20/11 23 h 00 · rédigée par Claude', at='2026-11-20T23:00+01:00',
                             path='../saint-quay/index.html', auto=False, claude=True)}
JC = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']


def jload(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d


def jsave(p, o):
    json.dump(o, open(p + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(p + '.tmp', p)


def days_for(now_paris):
    """Les 3 jours étudiés : aujourd'hui et les 2 suivants avant 15 h, sinon les 3 jours suivants."""
    d0 = now_paris.date() + dt.timedelta(days=0 if now_paris.hour < 15 else 1)
    return [d0 + dt.timedelta(days=k) for k in range(3)]


def sh(cmd, cwd, env, log, timeout=2400):
    t = dt.datetime.now(); print('»', ' '.join(cmd[2:3] + cmd[3:]), flush=True)
    p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
    open(log, 'a').write(f"\n### {' '.join(cmd)}\n{p.stdout[-4000:]}\n{p.stderr[-4000:]}\n")
    print(f"  {'ok' if p.returncode == 0 else 'ÉCHEC'} en {(dt.datetime.now() - t).seconds} s", flush=True)
    if p.returncode: print(p.stderr[-1500:], flush=True)
    return p.returncode == 0


def to_webp(src, dst):
    from PIL import Image
    im = Image.open(src)
    if im.mode in ('P', 'LA'): im = im.convert('RGBA')
    im.save(dst, 'WEBP', quality=78, method=5)


def build(store, zid, Z, L, auto):
    now = dt.datetime.now(UTC); np_ = now.astimezone(PARIS); DAYS = days_for(np_)
    vid = now.strftime('%Y%m%d%H%M')
    W = tempfile.mkdtemp(prefix=f'analyse-{zid}-')
    for d in ('fig', 'data', 'site', 'cache'): os.makedirs(os.path.join(W, d), exist_ok=True)
    Z = dict(Z, coord=zones.dms(Z['lat'], Z['lon']))
    env = dict(os.environ, ZONE=json.dumps(Z, ensure_ascii=False), DAYS=' '.join(d.isoformat() for d in DAYS),
               RUN=L['ifs'], RUN_ICON=L['icon'], RUN_EWAM=L['ewam'], TARGET=DAYS[0].isoformat(), CACHE=os.path.join(W, 'cache'), MPLBACKEND='Agg')
    if Z['court'] not in ('Saint-Quay', 'Porquerolles', 'Rolle'): env['EXTRA_SITE'] = f"{Z['court']};{Z['lat']};{Z['lon']}"
    log = os.path.join(W, 'log.txt'); py = [sys.executable, '-I']
    sh(py + [os.path.join(BIN, 'nh_analyse.py')], W, env, log)
    sh(py + [os.path.join(BIN, 'jet_nh.py')], W, env, log)
    if sh(py + [os.path.join(BIN, 'dwd.py')], W, env, log): sh(py + [os.path.join(BIN, 'dwd_overlay.py')], W, env, log)
    if not sh(py + [os.path.join(BIN, 'local.py')], W, env, log, 3600):
        print(open(log).read()[-3000:]); raise SystemExit(f'{zid} : niveau local en échec, aucune version publiée')
    # goutte froide : 12 UTC de chaque jour, sur le run IFS de l'analyse
    r_ifs = dt.datetime.strptime(L['ifs'], '%Y%m%d%H')
    steps = [int((dt.datetime(d.year, d.month, d.day, 12) - r_ifs).total_seconds() // 3600) for d in DAYS]
    smax = 90 if r_ifs.hour in (6, 18) else 144
    steps = [s for s in steps if 0 <= s <= smax - 12]
    if steps and sh(py + [os.path.join(BIN, 'gf_auto.py')], W, dict(env, STEPS=' '.join(map(str, steps))), log):
        gf = jload(os.path.join(W, 'data', 'gf_auto.json'), {})
        G = [g for g in gf.get('echeances', []) if g['zone'] == Z['court']]
        if G:
            g = max(G, key=lambda x: x['niveau'])
            sh(py + [os.path.join(BIN, 'gf_pair.py'), str(g['step']), str(g['centre'][0]), str(g['centre'][1])], W, env, log)
    zs = jload(os.path.join(store, 'index.json'), {}).get('zones', {}).get(zid, {}).get('versions', [])
    prev = next((v for v in zs if not v.get('claude')), None)
    prev_s = ''
    if prev:
        p = os.path.join(store, os.path.dirname(prev['path']), 'summary.json')
        if os.path.exists(p): prev_s = open(p, encoding='utf-8').read()
    if not sh(py + [os.path.join(HERE, 'texte.py'), W, zid, vid, json.dumps(Z, ensure_ascii=False), json.dumps(L), prev_s], W, env, log):
        print(open(log).read()[-3000:]); raise SystemExit(f'{zid} : page en échec')
    out = os.path.join(store, zid, vid); os.makedirs(os.path.join(out, 'fig'), exist_ok=True)
    html = open(os.path.join(W, 'index.html'), encoding='utf-8').read(); files = ['index.html', 'summary.json']
    for f in sorted(glob.glob(os.path.join(W, 'fig', '*'))):
        b = os.path.splitext(os.path.basename(f))[0]
        if b.endswith('_anom') or b.startswith(('dwd_ana_na', 'dwd_tkb_108', 'dwd_htp_084120', 'jet_nh_4')): continue
        to_webp(f, os.path.join(out, 'fig', b + '.webp')); files.append(f'fig/{b}.webp')
    shutil.copy(os.path.join(W, 'index.html'), out); shutil.copy(os.path.join(W, 'summary.json'), out)
    jsave(os.path.join(out, 'files.json'), files)
    summ = jload(os.path.join(W, 'summary.json'), {})
    t = np_
    entry = dict(id=vid, label=f"{JC[t.weekday()]} {t.day:02d}/{t.month:02d} {t.hour} h {t.minute:02d} · IFS {L['ifs'][6:8]}/{L['ifs'][4:6]} {L['ifs'][8:]} UTC, ICON {L['icon'][8:]} UTC",
                 at=t.isoformat(timespec='minutes'), path=f'{zid}/{vid}/index.html', auto=auto, runs=L, jours=summ.get('jours', []), type=summ.get('type'))
    idx = jload(os.path.join(store, 'index.json'), {'zones': {}})
    zz = idx['zones'].setdefault(zid, dict(nom=Z['nom'], court=Z['court'], lat=Z['lat'], lon=Z['lon'], versions=[]))
    zz.update(nom=Z['nom'], court=Z['court'], lat=Z['lat'], lon=Z['lon'])
    zz['versions'] = [entry] + [v for v in zz['versions'] if v['id'] != vid]
    idx['updated'] = t.isoformat(timespec='minutes')
    jsave(os.path.join(store, 'index.json'), idx)
    shutil.rmtree(W, ignore_errors=True)
    print(f'{zid} : version {vid} publiée ({len(files)} fichiers)', flush=True)


def prune(store):
    idx = jload(os.path.join(store, 'index.json'), {'zones': {}}); now = dt.datetime.now(PARIS)
    for zid, zz in list(idx['zones'].items()):
        keep, seen = [], set()
        gps = zid.startswith('gps-')
        for i, v in enumerate([v for v in zz['versions'] if not v.get('claude')]):
            age = (now - dt.datetime.fromisoformat(v['at'])).days; day = v['at'][:10]
            ok = (i < 10 and age <= 30) if gps else (age < 3 or (day not in seen and age <= 60))
            seen.add(day)
            if ok: keep.append(v)
            else: shutil.rmtree(os.path.join(store, zid, v['id']), ignore_errors=True)
        if gps and not keep:
            del idx['zones'][zid]; shutil.rmtree(os.path.join(store, zid), ignore_errors=True); continue
        zz['versions'] = keep + ([CLAUDE[zid]] if zid in CLAUDE else [])
    # plafond de taille
    def size(): return sum(os.path.getsize(os.path.join(a, f)) for a, _, fs in os.walk(store) for f in fs)
    while size() > 700e6:
        allv = sorted([(v['at'], zid, v) for zid, zz in idx['zones'].items() for v in zz['versions'][1:] if not v.get('claude')])
        if not allv: break
        _, zid, v = allv[0]; shutil.rmtree(os.path.join(store, zid, v['id']), ignore_errors=True)
        idx['zones'][zid]['versions'].remove(v)
    jsave(os.path.join(store, 'index.json'), idx)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--store', required=True); ap.add_argument('--check', action='store_true'); ap.add_argument('--auto', action='store_true')
    ap.add_argument('--zone'); ap.add_argument('--lat', type=float); ap.add_argument('--lon', type=float); ap.add_argument('--nom', default='')
    a = ap.parse_args(); os.makedirs(a.store, exist_ok=True)
    L = R.latest(); print('derniers runs', L, flush=True)
    if not all(L.values()): raise SystemExit(f'runs introuvables : {L}')
    state = jload(os.path.join(a.store, 'state.json'), {})
    sig = f"{L['ifs']}|{L['icon']}"   # EWAM suit ICON ; IBI est quotidien
    todo = []
    suivis = state.setdefault('suivis', {})   # points demandés par NAVIn : refaits seuls pendant 7 jours
    now = dt.datetime.now(UTC)
    for k in [k for k, v in suivis.items() if now - dt.datetime.fromisoformat(v['demande']) > dt.timedelta(days=7)]: del suivis[k]
    if a.lat is not None and a.lon is not None:
        near = zones.proche(a.lat, a.lon)
        if near:
            todo = [(near, zones.ZONES[near], False)]
        else:
            zid = zones.slug_gps(a.lat, a.lon)
            todo = [(zid, zones.gps(a.lat, a.lon, a.nom), False)]
        suivis[todo[0][0]] = dict(lat=a.lat, lon=a.lon, nom=a.nom, demande=now.isoformat(timespec='minutes'))
    elif a.zone and a.zone != 'auto':
        names = list(zones.ZONES) if a.zone == 'toutes' else [a.zone]
        todo = [(n, zones.ZONES[n], False) for n in names]
    else:
        todo = [(n, z, True) for n, z in zones.ZONES.items() if (z['auto'] or n in suivis) and state.get(n) != sig]
        todo += [(n, zones.gps(v['lat'], v['lon'], v.get('nom', '')), True) for n, v in suivis.items() if n not in zones.ZONES and state.get(n) != sig]
    if a.check:
        print('zones à refaire :', [t[0] for t in todo])
        if os.environ.get('GITHUB_OUTPUT'):
            open(os.environ['GITHUB_OUTPUT'], 'a').write(f"build={'true' if todo else 'false'}\n")
        return
    for zid, Z, auto in todo:
        build(a.store, zid, Z, L, auto)
        state[zid] = sig
    jsave(os.path.join(a.store, 'state.json'), state)
    prune(a.store)


if __name__ == '__main__':
    main()

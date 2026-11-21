"""Assemble la page de l'analyse à partir des sorties des scripts, SANS Claude : le texte est écrit par des règles fixes
à partir des chiffres (aucune donnée inventée ; ce qui manque est dit, avec un lien pour aller le voir).
Usage : python3 -I texte.py <dossier de travail> <zone_id> <version_id> '<zone json>' '<runs json>' [<résumé version précédente json>]
Écrit <dossier>/index.html et <dossier>/summary.json."""
import os, sys, json, math, html, datetime as dt
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bin'))
from geo import situer, dist
import htmlunits

PARIS = ZoneInfo('Europe/Paris'); UTC = dt.timezone.utc
J = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
JC = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
ROSE = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO']
ROSE_L = ['nord', 'nord-nord-est', 'nord-est', 'est-nord-est', 'est', 'est-sud-est', 'sud-est', 'sud-sud-est', 'sud', 'sud-sud-ouest',
          'sud-ouest', 'ouest-sud-ouest', 'ouest', 'ouest-nord-ouest', 'nord-ouest', 'nord-nord-ouest']
BEAUFORT = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64]
DOUGLAS = [0.0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14]
E = html.escape


def rose(d): return ROSE[int((d % 360) / 22.5 + .5) % 16]
def rose_l(d): return ROSE_L[int((d % 360) / 22.5 + .5) % 16]
def du(d): r = rose_l(d); return ("d'" if r[0] in 'eo' else 'de ') + r
def au(d): r = rose_l(d); return ("à l'" if r[0] in 'eo' else 'au ') + r
def num(x, n=0): return f"{x:.{n}f}".replace('.', ',') if x is not None else 'n.d.'
def nb(x): return f"{x:,}".replace(',', ' ')
def bf(kn): return sum(kn >= b for b in BEAUFORT)
def dg(hs): return None if hs is None else sum(hs > b for b in DOUGLAS[1:])
def ang(a, b): return abs((a - b + 540) % 360 - 180)
def utc(s): return dt.datetime.fromisoformat(s)
def paris(V): return V.replace(tzinfo=UTC).astimezone(PARIS)
def hh(t): return f"{t.hour} h" if t.minute == 0 else f"{t.hour} h {t.minute:02d}"
def jour(V, court=False): t = paris(V); return f"{(JC if court else J)[t.weekday()]} {t.day}"
def quand(V): t = paris(V); return f"{J[t.weekday()]} {t.day}/{t.month} {hh(t)}"
def run_txt(r): d = dt.datetime.strptime(r, '%Y%m%d%H'); return f"{d:%d/%m} {d:%H} UTC"


W, ZID, VID = sys.argv[1], sys.argv[2], sys.argv[3]
Z = json.loads(sys.argv[4]); RUNS = json.loads(sys.argv[5])
PREV = json.loads(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] else None


def load(n):
    p = os.path.join(W, 'data', n)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


NH, JET, DWD, OVL, LOC, GF = (load(n) for n in ('nh_analyse.json', 'jet_nh.json', 'dwd.json', 'dwd_overlay.json', 'local.json', 'gf_auto.json'))
ZP = (Z['lat'], Z['lon']); NAME = Z['court']
GEN = dt.datetime.now(UTC).astimezone(PARIS)
DAYS = [dt.date.fromisoformat(d) for d in LOC['days']]
SEA = LOC['type'] in ('maree', 'mer')
MANQUE = list(LOC['manque'])


def km_to_axis(L):
    best = None
    for la, lo in L:
        d = dist(ZP[0], ZP[1], la, lo)
        if best is None or d < best[0]: best = (d, la, lo)
    return best


# ------------------------------------------------------------------ grande échelle
def grande_echelle():
    """Phrases sur l'hémisphère (jour cible de nh_analyse) et le résumé de « L'essentiel » (règles 13, 14, 15)."""
    if not NH: MANQUE.append('analyse hémisphérique : run ECMWF non lu'); return [], []
    VT = utc(NH['valid']); long_, court = [], []
    eu = lambda c: 30 <= c['lat'] <= 72 and -45 <= c['lon'] <= 35
    for nom, key in (('dorsale', 'dorsales'), ('thalweg', 'thalwegs')):
        ax = [(km_to_axis(L), L) for L in NH[key]]
        ax = sorted([a for a in ax if a[0]], key=lambda a: a[0][0])
        if ax and ax[0][0][0] < 800:
            d, la, lo = ax[0][0]
            p = (f"une <b>{nom}</b> passe à {nb(int(round(d / 50) * 50))} km de {NAME}, axe {situer(la, lo)}" if d >= 75
                 else f"l'axe d'une <b>{nom}</b> passe au-dessus de {NAME} ({situer(la, lo)})")
            long_.append(p); court.append(p)
    D = sorted([c for c in NH['depressions'] if eu(c)], key=lambda c: dist(ZP[0], ZP[1], c['lat'], c['lon']))[:2]
    A = sorted([c for c in NH['anticyclones'] if eu(c)], key=lambda c: dist(ZP[0], ZP[1], c['lat'], c['lon']))[:1]
    if D: long_.append('au sol, dépression' + ('s' if len(D) > 1 else '') + ' ' + ' ; '.join(f"{nb(c['val'])} hPa {c['lieu']}" for c in D))
    if A: long_.append(f"anticyclone {nb(A[0]['val'])} hPa {A[0]['lieu']}")
    if D: court.append(f"dépression la plus proche {nb(D[0]['val'])} hPa {D[0]['lieu']}")
    if A: court.append(f"anticyclone {nb(A[0]['val'])} hPa {A[0]['lieu']}")
    gf = [c for c in NH['depressions_500'] if c.get('froid') and dist(ZP[0], ZP[1], c['lat'], c['lon']) < 1500]
    for c in gf:
        p = (f"<b>goutte froide</b> confirmée à 500 hPa (≈ 5 600 m) {c['lieu']}, à {nb(int(round(dist(ZP[0], ZP[1], c['lat'], c['lon']) / 50) * 50))} km "
             f"(cœur {num(c['tcoeur'], 1)} °C, pourtour {num(c['tpourtour'], 1)} °C)")
        long_.append(p); court.append(p)
    return long_, court


def jets_txt():
    if not JET: MANQUE.append('courants-jets : run ECMWF non lu'); return [], []
    out, court = [], []
    key = NAME if any(NAME in c['points'] for c in JET['cartes']) else None
    for c in JET['cartes']:
        V = utc(c['valid'])
        if paris(V).date() not in DAYS or not key: continue
        p = c['points'][key]; jp = p.get('jet_proche')
        s = f"{jour(V).capitalize()} midi, {p['kn']} nd à 250 hPa (≈ 10 400 m) au-dessus de {NAME}"
        if jp:
            s += (f" : le jet (≥ 80 nd) passe au-dessus de la zone ({jp['kn']} nd {jp['lieu']})" if jp['km'] <= 100 else
                  f" ; le jet le plus proche (≥ 80 nd) est à {nb(jp['km'])} km, {jp['kn']} nd {jp['lieu']}")
            if jp['km'] <= 300: court.append(f"{jour(V)} : jet à {nb(jp['km'])} km ({jp['kn']} nd)" if jp['km'] > 100 else f"{jour(V)} : jet au-dessus de la zone ({jp['kn']} nd)")
        else:
            s += ', aucun jet de 80 nd ou plus sur la carte'
        out.append(s + '.')
    return out, court


# ------------------------------------------------------------------ tableaux
def table(head, rows, cls=''):
    t = '<div class="tblwrap"><table' + (f' class="{cls}"' if cls else '') + '><thead><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr></thead><tbody>'
    t += ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'
    return htmlunits.add_tfoot(t)


LIGHT = {'go': ('go', 'Go'), 'prudence': ('warn', 'Prudence'), 'nogo': ('nogo', 'No-go')}


def light(f): c, t = LIGHT[f]; return f'<span class="light {c}"><span class="dot"></span>{t}</span>'


def effet(h):
    """Ce que donne le croisement vent / vagues / courant (règles fixes, seuils de NAVIn)."""
    w, wd = h['vent_kn'], h['vent_du']; c = h.get('courant_kn'); out = []
    if c is not None and c >= 0.5:
        a = ang((wd + 180) % 360, h['courant_vers'])
        if a > 135:
            out.append('vent contre courant : ' + ('mer hachée et creuse, prudence' if w >= 18 or c >= 1.5 and w >= 12 else 'mer courte, clapot' if w >= 8 else 'peu d\'effet, vent faible'))
        elif a < 45:
            out.append('vent et courant dans le même sens : mer plus longue')
        else:
            out.append('courant de travers au vent : dérive à corriger')
        if c >= 1.5: out.append(f'courant fort ({num(c, 1)} nd)')
    elif c is not None:
        out.append('courant faible')
    if h.get('hs_m') is not None and h.get('vagues_de') is not None and h['hs_m'] >= 0.5 and ang(h['vagues_de'], wd) > 60:
        out.append('houle croisée avec le vent')
    if w >= 25: out.append('vent au-delà du seuil rouge au près')
    elif w >= 18: out.append('vent au-delà du seuil orange au près')
    return ' ; '.join(out) or 'conditions calmes'


# ------------------------------------------------------------------ page
ge_long, ge_court = grande_echelle()
jet_long, jet_court = jets_txt()
JOURS = [j for j in LOC['jours'] if not j.get('vide')]
H = LOC['heures']; ECH = LOC['echeances']; CUR = LOC['courants']

# L'essentiel
ess = []
resume = [x for x in jet_court + ge_court][:4]
lead = ('Grande échelle : ' + ' ; '.join(resume) + '.') if resume else 'Grande échelle : ni jet, ni thalweg, ni dorsale à proximité de la zone.'
for j in JOURS:
    d = dt.date.fromisoformat(j['date']); V = dt.datetime(d.year, d.month, d.day, 12)
    dirs = sorted(set(j['dirs']), key=j['dirs'].index)
    s = f"<li><b>{jour(V).capitalize()} : <span class=\"{LIGHT[j['feu']][0]}\">{LIGHT[j['feu']][1].lower()}</span>.</b> Vent de {j['vent_min']} à {j['vent_kn']} nd ({', '.join(dirs[:3])}), rafales jusqu'à {j['rafales_kn']} nd"
    s += (f", Hs jusqu'à {num(j['hs_m'], 1)} m" if j.get('hs_m') is not None else '') + '.'
    ev = [e for h in H if paris(utc(h['valid'])).date() == d for e in h['evenements'] if e.startswith('changement')]
    rv = [r for r in (CUR['renverses'] if CUR else []) if paris(utc(r['t'])).date() == d]
    if rv: s += ' Renverses du courant : ' + ', '.join(f"{hh(paris(utc(r['t'])))} (début du {r['debut']})" for r in rv) + '.'
    if ev: s += ' ' + ev[0][0].upper() + ev[0][1:] + '.'
    ess.append(s + '</li>')
go_rows = [[f"{jour(dt.datetime.fromisoformat(j['date'] + 'T12:00'), True)}", light(j['feu']), j['vent_kn'], j['rafales_kn'], num(j.get('hs_m'), 1),
            f"{bf(j['vent_kn'])} / {dg(j.get('hs_m')) if j.get('hs_m') is not None else 'n.d.'}"] for j in JOURS]

# version précédente
chg = ''
if PREV and PREV.get('jours'):
    pj = {x['date']: x for x in PREV['jours']}; L = []
    for j in JOURS:
        p = pj.get(j['date'])
        if not p: continue
        d = dt.datetime.fromisoformat(j['date'] + 'T12:00')
        if p['feu'] != j['feu']: L.append(f"{jour(d)} : feu {LIGHT[p['feu']][1].lower()} → <b>{LIGHT[j['feu']][1].lower()}</b>")
        elif abs(p['vent_kn'] - j['vent_kn']) >= 4: L.append(f"{jour(d)} : vent max {p['vent_kn']} → {j['vent_kn']} nd")
    chg = (f"<p class=\"meta\">Depuis la version du {E(PREV['label'])} : " + ('; '.join(L) if L else 'pas de changement notable des feux ni du vent maximal') + '.</p>')

parts = []
coord = Z.get('coord') or ''
title = f"Analyse {Z['nom']}"
parts.append(f"""<header>
  <div class="eyebrow">{E(Z['eyebrow'])} · {E(coord)}</div>
  <h1>{E(title)}, de l'hémisphère au local</h1>
  <p class="meta">Version du {GEN.day} {MO[GEN.month - 1]} {GEN.year} à {hh(GEN)} (heure de Paris), pour {', '.join(jour(dt.datetime(d.year, d.month, d.day, 12)) for d in DAYS)}. Runs : ECMWF IFS {run_txt(RUNS['ifs'])}, DWD ICON-EU {run_txt(RUNS['icon'])}{', EWAM ' + run_txt(RUNS['ewam']) if SEA else ''}. Bateau de référence : Dufour 445 Grand Large, seuils au près.</p>
  <div class="versions" id="versions" hidden><label>Version <select id="vsel" aria-label="Choisir une version"></select></label> <a id="vlast" href="#" hidden>dernière version</a></div>
  <div class="fontbar"><button id="fminus" type="button" aria-label="Réduire le texte">A−</button><button id="fplus" type="button" aria-label="Agrandir le texte">A+</button><span class="meta">Touchez une carte pour l'ouvrir en plein écran.</span></div>
</header>""")

parts.append(f"""<section aria-labelledby="h-ess">
  <h2 id="h-ess">L'essentiel</h2>
  <p>{lead}</p>
  <ul class="essentiel">{''.join(ess)}</ul>
  {table(['Jour', 'Feu', 'Vent moyen (nd)', 'Rafales (nd)', 'Hs (m)', 'Beaufort / Douglas'], go_rows) if go_rows else ''}
  <p class="meta">Valeurs maximales de 7 h à 18 h (heures étudiées toutes les 3 h) au point de référence en mer « {E(Z['ref'][0])} » : vent et rafales DWD ICON-EU{', vagues DWD EWAM' if SEA else ''}. Seuils go/no-go de NAVIn pour le Dufour 445 au près (vent 18 / 25 nd, rafales 28 / 35 nd, Hs 2 / 3,5 m ; no-go toujours à partir de 27 nd). Le calcul détaillé reste celui de NAVIn, Météo › Go / no-go.</p>
  {chg}
</section>""")

# 1. Hémisphère
if NH:
    VT = utc(NH['valid'])
    jets_btn = ''.join(f'<button type="button" data-set="jet" data-src="fig/jet_nh_{c["k"]}_base.webp" aria-pressed="{"true" if i == 0 else "false"}">{jour(utc(c["valid"])).capitalize()}</button>'
                       for i, c in enumerate(JET['cartes'][:4])) if JET else ''
    parts.append(f"""<section aria-labelledby="h-nh">
  <h2 id="h-nh">1. Hémisphère Nord <span class="scale">≈ 10 000 km</span></h2>
  <p>{jour(VT).capitalize()} midi : {'; '.join(ge_long) if ge_long else 'aucune structure marquée près de la zone'}.</p>
  <figure>
    <div class="btns" role="group" aria-label="Carte hémisphérique">
      <button type="button" data-set="nh" data-src="fig/nh_base.webp" aria-pressed="true">Carte de base</button>
      <button type="button" data-set="nh" data-src="fig/nh_annot.webp" aria-pressed="false">Avec annotations</button>
    </div>
    <div class="map" data-zoom><img id="img-nh" src="fig/nh_base.webp" alt="Géopotentiel 500 hPa, pression mer et température 850 hPa sur l'hémisphère Nord"></div>
    <figcaption>ECMWF IFS 0,25°, run {utc(NH['run']):%d/%m %H} UTC +{NH['step']} h, {quand(VT)} (heure de Paris). 500 hPa (≈ 5 600 m) en noir (dam), pression mer en blanc (hPa), 850 hPa (≈ 1 500 m) en couleurs (°C). Annotations détectées automatiquement : thalwegs, dorsales, A, D, gouttes froides (cœur froid confirmé).</figcaption>
  </figure>
  {f'''<h3>Courants-jets à 250 hPa (≈ 10 400 m)</h3>
  <p>{' '.join(jet_long)}</p>
  <figure>
    <div class="btns" role="group" aria-label="Courants-jets">{jets_btn}</div>
    <div class="map" data-zoom><img id="img-jet" src="fig/jet_nh_0_base.webp" alt="Vent à 250 hPa sur l'hémisphère Nord"></div>
    <figcaption>ECMWF IFS, run {utc(JET['run']):%d/%m %H} UTC, vent à 250 hPa (≈ 10 400 m) en nd, à midi UTC.</figcaption>
  </figure>''' if JET else ''}
</section>""")

# 2. DWD
if DWD:
    btn = []
    for k, lab in (('ana_eu', 'Analyse'), ('tkb_36', None), ('tkb_60', None), ('tkb_84', None)):
        d = DWD.get(k)
        if not d: continue
        b = dt.datetime.strptime(d['base'], '%Y%m%d%H%M')
        V = b + dt.timedelta(hours=int(k.split('_')[1]) if k.startswith('tkb') else 0)
        btn.append((f"fig/{os.path.basename(d['fichier']).replace('.jpg', '.webp')}", (f"Analyse {quand(V)}" if lab else f"Prévue {quand(V)}")))
    b0 = btn[0][0] if btn else ''
    htp = ''
    for key in ('htp_036072',):
        o = (OVL or {}).get(key); d = DWD.get(key)
        if not d: continue
        img = f"fig/{os.path.basename(d['fichier']).replace('.jpg', '.webp')}"
        if o and o.get('calque'):
            hs = o.get('heures', [])
            htp = f"""<h3>500 hPa et pression mer, {E(', '.join(hs))} (heure suisse)</h3>
  <figure>
    <div class="btns" role="group" aria-label="Calques sur la carte DWD 500 hPa">
      <button type="button" data-layer="htp-ann" aria-pressed="false">Avec annotations</button>
      <button type="button" data-layer="htp-jet" aria-pressed="false">Courants-jets 250 hPa</button>
      <button type="button" data-layer="htp-leg" data-inverse aria-pressed="false">Légendes DWD d'origine</button>
    </div>
    <div class="map" data-zoom><img src="{img}" alt="Cartes DWD 500 hPa et pression mer, quatre échéances" loading="lazy"><img class="layer" src="{img.replace('.webp', '_rep.webp')}" alt=""><img class="layer" id="htp-jet" src="{img.replace('.webp', '_jet.webp')}" alt="" hidden><img class="layer" id="htp-ann" src="{img.replace('.webp', '_ann.webp')}" alt="" hidden><img class="layer" id="htp-leg" src="{img.replace('.webp', '_leg.webp')}" alt=""></div>
    <figcaption>DWD ICON, run du {dt.datetime.strptime(d['base'], '%Y%m%d%H%M'):%d/%m à %H} UTC : 500 hPa (≈ 5 600 m, dam, à gauche) et pression mer (hPa, à droite). Les légendes en clair (jour et heure suisse calculés depuis le run) recouvrent les légendes allemandes ; le bouton « Légendes DWD d'origine » les montre. Calques : les zones d'essai ; « Avec annotations » ajoute les éléments détectés sur ECMWF IFS (run {utc(o['run_ifs']):%d/%m %H} UTC) aux mêmes heures ; « Courants-jets 250 hPa » ajoute le vent à 250 hPa (≈ 10 400 m) d'IFS aux mêmes heures : isotaches 80 nd (jaune), 100 nd (orange), 120 nd (rouge) et 140 nd (bordeaux), flèches dans le sens du vent.</figcaption>
  </figure>"""
        else:
            htp = f'<h3>500 hPa et pression mer</h3><figure><div class="map" data-zoom><img src="{img}" alt="Cartes DWD 500 hPa et pression mer" loading="lazy"></div><figcaption>Calques non posés (mise en page DWD changée ou échéances IFS absentes).</figcaption></figure>'
    parts.append(f"""<section aria-labelledby="h-eu">
  <h2 id="h-eu">2. Atlantique et Europe <span class="scale">≈ 3 000 km</span></h2>
  <p>Cartes officielles du DWD, non modifiées : fronts, anticyclones (H) et dépressions (T) tracés par le service météo allemand.</p>
  <figure>
    <div class="btns" role="group" aria-label="Cartes DWD avec fronts">{''.join(f'<button type="button" data-set="dwd" data-src="{s}" aria-pressed="{"true" if i == 0 else "false"}">{E(l)}</button>' for i, (s, l) in enumerate(btn))}</div>
    <div class="map" data-zoom><img id="img-dwd" src="{b0}" alt="Carte DWD de pression et fronts" loading="lazy"></div>
    <figcaption>DWD : analyse de surface avec fronts et prévisions ICON. Pression en hPa. Heures de Paris. © Deutscher Wetterdienst.</figcaption>
  </figure>
  {htp}
</section>""")
else:
    MANQUE.append('cartes officielles du DWD : serveur opendata.dwd.de non lu')


def daybtns(k, items, ann=True):
    b = ''.join(f'<button type="button" data-day="{k}" data-v="{t}" aria-pressed="{"true" if i == 0 else "false"}">{E(l)}</button>' for i, (t, l) in enumerate(items))
    return f'<div class="btns" role="group" aria-label="Jour">{b}' + (f'<button type="button" data-ann="{k}" aria-pressed="false">Avec annotations</button>' if ann else '') + '</div>'


# 3. Régional
R = [e for e in ECH if e.get('regional')]
if R:
    txt = []
    for e in R:
        r = e['regional']; V = utc(e['valid'])
        C = sorted(r['centres'], key=lambda c: dist(ZP[0], ZP[1], c['lat'], c['lon']))[:2]
        s = f"{quand(V).capitalize()} : au-dessus de {NAME}, vent {du(r['zone_du'])} {r['zone_kn']} nd, pression {nb(r['zone_hpa'])} hPa"
        if r.get('part_18') is not None:
            s += f" ; sur le cadre, {round(100 * r['part_18'])} % de la surface en eau au-dessus de 18 nd, {round(100 * r['part_25'])} % au-dessus de 25 nd"
        s += f" ; le plus fort {r['vent_max_kn']} nd {r['vent_max_ou']}"
        if C: s += ' ; ' + ', '.join(f"{'dépression' if c['type'] == 'D' else 'anticyclone'} {nb(c['hpa'])} hPa {c['ou']}" for c in C)
        txt.append(s + '.')
    parts.append(f"""<section aria-labelledby="h-reg">
  <h2 id="h-reg">3. {E(Z['reg_nom'][0].upper() + Z['reg_nom'][1:])} <span class="scale">≈ 1 000 km</span></h2>
  <p>{' '.join(txt)} Avec annotations : trait orange 18 nd, rouge 25 nd, violet pointillé rafales 35 nd.</p>
  {daybtns('reg', [(e['tag'], quand(utc(e['valid']))) for e in R])}
  <figure>
    <div class="map" data-zoom><img id="img-reg" src="fig/reg_{R[0]['tag']}_base.webp" alt="Vent moyen à 10 m et pression mer" loading="lazy"></div>
    <figcaption>ECMWF IFS 0,25°, run {run_txt(RUNS['ifs'])}. Vent moyen à 10 m en nd (couleurs et barbules), pression mer en hPa. Seuils et maximum calculés sur l'eau.</figcaption>
  </figure>
</section>""")

# 4. Local
Lc = [e for e in ECH if e.get('local')]
if Lc:
    txt = []
    for e in Lc:
        l = e['local']; V = utc(e['valid'])
        s = f"{quand(V).capitalize()} : vent de {l['vent_kn'][0]} à {l['vent_kn'][1]} nd" + (f", rafales jusqu'à {l['rafales_max_kn']} nd" if l.get('rafales_max_kn') else '')
        s += f" (le plus fort {l['vent_max_ou']})"
        if l.get('hs_m'): s += f", Hs de {num(l['hs_m'][0], 1)} à {num(l['hs_m'][1], 1)} m (la plus forte {l['hs_max_ou']})"
        txt.append(s + '.')
    alerts = []
    for e in Lc:
        r = e.get('regional'); V = utc(e['valid']); h = next((x for x in H if x['valid'] == e['valid']), None)
        if r and h and (abs(r['zone_kn'] - h['vent_kn']) >= 8 or (ang(r['zone_du'], h['vent_du']) >= 60 and max(r['zone_kn'], h['vent_kn']) >= 10)):
            alerts.append(f"{quand(V)} : ECMWF donne {r['zone_kn']} nd du {rose(r['zone_du'])} sur la zone, ICON-EU {h['vent_kn']} nd du {rose(h['vent_du'])} au point de référence.")
    al = (f'<div class="note alert"><h3>Les modèles ne sont pas d\'accord</h3><p>{" ".join(alerts)} À revoir au prochain run et avec le bulletin en cours.</p></div>' if alerts else '')
    parts.append(f"""<section aria-labelledby="h-loc">
  <h2 id="h-loc">4. {E(Z['bassin'][0].upper() + Z['bassin'][1:])} <span class="scale">≈ 70 km</span></h2>
  <p>{' '.join(txt)}</p>
  {al}
  {daybtns('loc', [(e['tag'], quand(utc(e['valid']))) for e in Lc])}
  <figure>
    <div class="map" data-zoom><img id="img-loc" src="fig/loc_{Lc[0]['tag']}_base.webp" alt="Vent{' et vagues' if SEA else ''} à l'échelle locale" loading="lazy"></div>
    <figcaption>{'Vagues DWD EWAM 0,05° (Hs en m, flèches dans le sens de propagation), run ' + run_txt(RUNS['ewam']) + '. ' if SEA else 'Vent moyen en couleurs (nd). '}Vent DWD ICON-EU 6,5 km (barbules, nd), run {run_txt(RUNS['icon'])}, sur l'eau seulement.{' Le modèle ICON-EU (6,5 km) lisse les effets du relief autour du lac : pour le détail, voir les modèles ICON-CH de MétéoSuisse.' if LOC['type'] == 'lac' else ''}</figcaption>
  </figure>
</section>""")

# 5. Courants
if CUR and CUR['pics']:
    pk = [p for p in CUR['pics'] if p.get('tag')]
    rows = []
    for p in CUR['pics']:
        V = utc(p['t']); ef = ''
        if p.get('vent_kn') is not None:
            a = ang((p['vent_du'] + 180) % 360, p['vers'])
            ef = 'vent contre courant' if a > 135 else 'vent et courant dans le même sens' if a < 45 else 'courant de travers au vent'
        rows.append([quand(V), p['phase'], f"{num(p['kn'], 1)} · {rose(p['vers'])} ({p['vers']}°)",
                     f"{p['vent_kn']} · {rose(p['vent_du'])}" if p.get('vent_kn') is not None else 'n.d.', ef])
    rv = ', '.join(f"{quand(utc(r['t']))} (début du {r['debut']})" for r in CUR['renverses'])
    parts.append(f"""<section aria-labelledby="h-cur">
  <h2 id="h-cur">5. Courants <span class="scale">≈ 70 km</span></h2>
  <p>Au point « {E(CUR['point'])} », le flot porte {au(CUR['flot_vers'])} ({CUR['flot_vers']}°), le jusant {au(CUR['jusant_vers'])} ({CUR['jusant_vers']}°). Renverses de jour : {rv or 'aucune entre 6 h et 21 h'}.</p>
  {table(['Moment (Paris)', 'Phase', 'Courant au point (nd, vers)', 'Vent ICON-EU (nd, du)', 'Effet'], rows)}
  {daybtns('cur', [(p['tag'], f"{p['quand']}, {p['phase']}") for p in pk]) if pk else ''}
  {f'<figure><div class="map" data-zoom><img id="img-cur" src="fig/cur_{pk[0]["tag"]}_base.webp" alt="Courants de surface" loading="lazy"></div><figcaption>Copernicus Marine IBI 0,027° (marée et météo), champ instantané au quart d\'heure. Vitesse en nd, flèches dans le sens du courant. Annotations : vitesse aux points et, en rouge, vent ICON-EU contre le courant (écart de plus de 135°, courant d\'au moins 0,5 nd, vent d\'au moins 8 nd). Phase flot / jusant d\'après la hauteur d\'eau du modèle. Les heures de pleine et basse mer restent à lire dans l\'annuaire du SHOM.</figcaption></figure>' if pk else ''}
</section>""")

# 6. Système toutes les 3 h
if H:
    head = ['Heure (Paris)', 'Vent ICON-EU (nd, du)'] + (['Vagues EWAM (Hs m, de)'] if SEA else []) + (['Courant IBI (nd, vers)'] if CUR else []) + ['Ce que ça donne']
    rows = []
    for h in H:
        V = utc(h['valid']); ev = h['evenements']
        r = [f"{quand(V)}" + (f"<br><small class=\"ev\">{E('; '.join(ev))}</small>" if ev else ''), f"{h['vent_kn']} · {rose(h['vent_du'])}" + (f", raf. {h['rafales_kn']}" if h.get('rafales_kn') else '')]
        if SEA: r.append(f"{num(h['hs_m'], 1)} · {rose(h['vagues_de'])}" if h.get('hs_m') is not None else 'n.d.')
        if CUR: r.append(f"{num(h['courant_kn'], 1)} · {rose(h['courant_vers'])}" if h.get('courant_kn') is not None else 'n.d.')
        r.append(effet(h)); rows.append(r)
    SYSJ = json.dumps([dict(t=h['tag'], q=quand(utc(h['valid'])), d=jour(utc(h['valid']), True), h=hh(paris(utc(h['valid']))), l=h['couches'], e=h['evenements']) for h in H], ensure_ascii=False)
    lay = [('vent', 'Vent (barbules noires)')] + ([('vagues', 'Vagues (flèches bleues)')] if SEA else []) + ([('courants', 'Courants (flèches violettes)'), ('annot', 'Avec annotations')] if CUR else [])
    parts.append(f"""<section aria-labelledby="h-sys">
  <h2 id="h-sys">6. Vent{', vagues' if SEA else ''}{' et courants' if CUR else ''} ensemble, toutes les 3 h <span class="scale">≈ 70 km</span></h2>
  <p>Une carte toutes les 3 heures de jour{', plus une à chaque renverse de courant' if CUR else ''} ; les changements de vent importants (8 nd ou plus, ou 45° ou plus) sont signalés. Le fond est seul au départ : ajoutez les couches une à une.</p>
  {table(head, rows, 'sys')}
  <p class="meta">Valeurs au point de référence « {E(Z['ref'][0])} ».</p>
  <div class="btns" role="group" aria-label="Jour" id="sys-days"></div>
  <div class="btns" role="group" aria-label="Heure" id="sys-hours"></div>
  <div class="btns" role="group" aria-label="Couches">{''.join(f'<button type="button" data-sys-layer="{k}" aria-pressed="{"true" if k == "vent" else "false"}">{l}</button>' for k, l in lay)}</div>
  <p class="meta" id="sys-label"></p>
  <figure>
    <div class="map" data-zoom><img src="fig/sys_fond.webp" alt="Fond de carte" loading="lazy">{''.join(f'<img class="layer" data-sys="{k}" src="" alt=""{"" if k == "vent" else " hidden"}>' for k, _ in lay)}</div>
    <figcaption>Vent DWD ICON-EU 6,5 km{' et vagues DWD EWAM 0,05°' if SEA else ''}{', courants Copernicus Marine IBI 0,027° (champ instantané)' if CUR else ''}. Flèches de vagues dans le sens de propagation, plus longues quand Hs est plus grande ; flèches de courant dans le sens du courant, plus longues quand il est plus fort.{' Annotations : en rouge, vent contre courant (écart de plus de 135°, courant d’au moins 0,5 nd, vent d’au moins 8 nd) ; en orange, vagues contre courant (Hs d’au moins 0,5 m).' if CUR else ''}</figcaption>
  </figure>
  <script type="application/json" id="sys-data">{SYSJ}</script>
</section>""")

# goutte froide
if GF and GF.get('section'):
    G = [g for g in GF['echeances'] if g['zone'] in (NAME, Z['court'])]
    if G:
        g = max(G, key=lambda x: x['niveau'])
        pair = os.path.exists(os.path.join(W, 'fig', 'gf_pair.png'))
        parts.append(f"""<section aria-labelledby="h-gf">
  <h2 id="h-gf">Goutte froide</h2>
  <div class="note alert"><p>Goutte froide confirmée à 500 hPa (≈ 5 600 m) {g['lieu']}, à {nb(g['km'])} km de {NAME}, {quand(utc(g['valid']))} : cœur {num(g['tcoeur'], 1)} °C contre {num(g['tpourtour'], 1)} °C autour, géopotentiel {g['z500_dam']} dam. Déplacement : {num(g['deplacement_kn'], 1) + ' nd' if g['deplacement_kn'] is not None else 'non suivi'}. Niveau d'alerte {g['niveau']} sur 3.</p></div>
  {'<figure><div class="map" data-zoom><img src="fig/gf_pair.webp" alt="Goutte froide : pression au sol et 500 hPa côte à côte" loading="lazy"></div><figcaption>À gauche, pression au niveau de la mer (hPa) ; à droite, 500 hPa (≈ 5 600 m) : géopotentiel (dam) et température (°C). D : centre au sol ; GF : cœur de la goutte froide, pour voir le décalage. ECMWF IFS.</figcaption></figure>' if pair else ''}
</section>""")

# ce qui manque
lk = '<li><b>Heures et hauteurs de marée officielles</b> : <a href="https://maree.shom.fr/" target="_blank" rel="noopener">annuaire des marées du SHOM</a>.</li>' if LOC['type'] == 'maree' else ''
bms = ('<li><b>Bulletin côtier et BMS en cours</b> : ils ne sont pas lus par ce générateur, consultez-les sur <a href="https://meteofrance.com/meteo-marine" target="_blank" rel="noopener">Météo-France marine</a>.</li>'
       if LOC['type'] != 'lac' else '<li><b>Avis de vent fort et prévisions locales du Léman</b> : <a href="https://www.meteoswiss.admin.ch/" target="_blank" rel="noopener">MétéoSuisse</a>.</li>')
mq = ''.join(f'<li>{E(m[0].upper() + m[1:])}.</li>' for m in sorted(set(MANQUE)))
parts.append(f"""<section aria-labelledby="h-src">
  <h2 id="h-src">Ce qui manque et sources</h2>
  <ul>{lk}{bms}{mq}</ul>
  <div class="src"><span>Sources : ECMWF open data (IFS 0,25°), DWD opendata (ICON-EU, {'EWAM, ' if SEA else ''}cartes officielles){', Copernicus Marine Service (IBI, courants)' if CUR else ''}. Cartes, chiffres et texte produits automatiquement par les scripts de NAVIn, avec des règles fixes, sans IA ; Open-Meteo n'est pas utilisé.</span></div>
</section>""")

CSS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'style.css'), encoding='utf-8').read()
JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'page.js'), encoding='utf-8').read()
doc = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>{E(title)}</title>
<style>
{CSS}
.versions{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}}
.versions select{{font:inherit;font-size:1rem;padding:.35em .5em;border-radius:8px;border:1px solid var(--line);background:var(--paper);color:var(--fg);max-width:100%}}
table.sys td:first-child{{white-space:nowrap}}
small.ev{{color:var(--nogo);white-space:normal}}
</style>
</head>
<body>
<div class="wrap" data-zone="{E(ZID)}" data-version="{E(VID)}">
{chr(10).join(parts)}
</div>
<div id="zoom" hidden role="dialog" aria-label="Carte en plein écran"><div class="stack"></div></div>
<script>
{JS}
</script>
</body>
</html>
"""
open(os.path.join(W, 'index.html'), 'w', encoding='utf-8').write(doc)
summary = dict(id=VID, zone=ZID, at=GEN.isoformat(timespec='minutes'), label=f"{GEN.day:02d}/{GEN.month:02d} {hh(GEN)}",
               runs=RUNS, jours=[dict(date=j['date'], feu=j['feu'], vent_kn=j['vent_kn'], rafales_kn=j['rafales_kn'], hs_m=j.get('hs_m')) for j in JOURS],
               type=LOC['type'], nom=Z['nom'])
json.dump(summary, open(os.path.join(W, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('page ok', len(doc))

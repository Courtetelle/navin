"""Répète l'en-tête de chaque tableau (avec ses unités) en pied de tableau, pour que les unités soient en haut ET en bas de CHAQUE tableau."""
import re
def add_tfoot(html):
    def rep(m):
        tbl=m.group(0)
        if '<tfoot>' in tbl: return tbl
        th=re.search(r'<thead>(.*?)</thead>',tbl,re.S)
        if not th: raise ValueError('tableau sans <thead> : '+tbl[:120])
        return tbl.replace('</table>','<tfoot>'+th.group(1)+'</tfoot></table>')
    return re.sub(r'<table>.*?</table>',rep,html,flags=re.S)

# --- Altitude des niveaux de pression (consigne PERMANENTE de Corban, 9/11/2026) ---
# « quand tu mets les altitudes en hPa, merci de mettre entre parenthèses la correspondance en m sur mer ».
# Atmosphère standard OACI, arrondie : la vraie altitude varie de quelques centaines de mètres avec la masse d'air (voir le géopotentiel Z).
ALT={100:'16 200',150:'13 600',200:'11 800',250:'10 400',300:'9 200',400:'7 200',500:'5 600',600:'4 200',700:'3 000',850:'1 500',925:'800'}
_LV='|'.join(str(k) for k in sorted(ALT,reverse=True))
def _ins(alt,nxt):
    return f", ≈ {alt}" if nxt==')' else f" (≈ {alt})"
def alt_txt(s):
    """Ajoute l'altitude après « 500 hPa », « 250–925 hPa », « Z500 », « T850 » (texte seul, sans balises). Idempotent."""
    s=re.sub(rf'(?<![\d,.])({_LV})\s?[–-]\s?({_LV})(\s| )?hPa(?!,? ?\(?≈)(\)?)',
             lambda m: f"{m.group(1)}–{m.group(2)} hPa"+_ins(f"{ALT[int(m.group(1))]} à {ALT[int(m.group(2))]} m",m.group(4))+m.group(4),s)
    s=re.sub(rf'(?<![\d,.–-])({_LV})(\s| )?hPa(?![\s ]?\(≈|, ≈)(\)?)',
             lambda m: f"{m.group(1)} hPa"+_ins(ALT[int(m.group(1))]+' m',m.group(3))+m.group(3),s)
    s=re.sub(rf'\b([ZT])({_LV})\b(?![\s ]?\(≈|, ≈| hPa)(\)?)',
             lambda m: f"{m.group(1)}{m.group(2)}"+_ins(ALT[int(m.group(2))]+' m',m.group(3))+m.group(3),s)
    return s
def add_alt(html):
    """Applique alt_txt au texte visible (hors balises, <script>, <style>, <title>) et ajoute l'altitude aux lignes
    « 250 », « 500 »... des tableaux dont la première colonne est « Niveau (hPa) »."""
    parts=re.split(r'(<script.*?</script>|<style.*?</style>|<title>.*?</title>|<[^>]+>)',html,flags=re.S)
    html=''.join(p if (i%2 or not p.strip()) else alt_txt(p) for i,p in enumerate(parts))
    def lev(m):
        t=m.group(0)
        if 'Niveau (hPa)' not in t: return t
        return re.sub(rf'<tr><th>({_LV})</th>',lambda q:f"<tr><th>{q.group(1)} (≈ {ALT[int(q.group(1))]} m)</th>",t)
    return re.sub(r'<table>.*?</table>',lev,html,flags=re.S)
_add_tfoot_base=add_tfoot
def add_tfoot(html):
    """Pied de tableau avec unités + altitudes des niveaux de pression (les deux consignes sont appliquées par tous les générateurs)."""
    return add_alt(_add_tfoot_base(html))

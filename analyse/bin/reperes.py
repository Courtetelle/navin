"""Points de repère sur TOUTES les cartes (consigne permanente de Corban, 9/11/2026) : Morges, Saint-Malo et Toulon,
y compris sur les cartes de base sans annotation. Il suffit d'importer ce module (`import reperes`) dans un script de cartes :
il complète Figure.savefig pour poser les trois points sur chaque carte cartopy (GeoAxes) dont le cadre les contient.
Les cartes du DWD sont reproduites sans modification et ne portent donc pas ces points."""
import matplotlib.figure
SITES=[('Saint-Quay',48.652,-2.831,(-0.35,-0.3,'right')),('Porquerolles',43.000,6.202,(0.35,-0.45,'left')),('Rolle',46.460,6.338,(0.35,0.45,'left'))]  # zones d'essai de Corban, 20/11/2026
import os as _os
if _os.environ.get('EXTRA_SITE'):   # point GPS demandé (relance à la position), ajouté aux zones d'essai
    _n,_a,_b=_os.environ['EXTRA_SITE'].split(';'); SITES.append((_n,float(_a),float(_b),(0.35,0.3,'left')))

def poser(ax):
    import cartopy.crs as ccrs
    if getattr(ax,'_reperes',False): return
    ax._reperes=True
    P=ccrs.PlateCarree()
    try: x0,x1,y0,y1=ax.get_extent(P)
    except Exception: x0,x1,y0,y1=-180,180,-90,90
    # échelle du décalage du texte : proportionnelle à la taille du cadre
    k=max(0.15,min(2.5,(y1-y0)/25))
    for n,la,lo,(dx,dy,ha) in SITES:
        if not (x0-1<=lo<=x1+1 and y0-1<=la<=y1+1) and (x1-x0)<300: continue
        ax.plot(lo,la,marker='o',ms=5.5,mfc='#ffd400',mec='#111',mew=1.2,transform=P,zorder=30,clip_on=True)
        t=ax.text(lo+dx*k*1.3,la+dy*k*1.3,n,fontsize=7.5,weight='bold',color='#111',ha=ha,va='center',transform=P,zorder=31,clip_on=True)
        try:
            import matplotlib.patheffects as pe; t.set_path_effects([pe.withStroke(linewidth=2.5,foreground='white')])
        except Exception: pass
_orig=matplotlib.figure.Figure.savefig
def _savefig(self,*a,**k):
    try:
        from cartopy.mpl.geoaxes import GeoAxes
        for ax in self.axes:
            if isinstance(ax,GeoAxes): poser(ax)
    except Exception as e: print('reperes : points non posés', e)
    return _orig(self,*a,**k)
if not getattr(matplotlib.figure.Figure,'_reperes_patch',False):
    matplotlib.figure.Figure.savefig=_savefig; matplotlib.figure.Figure._reperes_patch=True

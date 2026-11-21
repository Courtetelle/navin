"""Paire de cartes goutte froide (règle 6 de Corban) : à gauche pression mer (sol), à droite 500 hPa (≈ 5 600 m) géopotentiel
et température, côte à côte, avec le centre au sol (D) et le cœur de la goutte froide (GF) pour montrer le décalage.
Usage : RUN=AAAAMMJJHH python3 -I gf_pair.py <pas> <lat> <lon>   Sortie : fig/gf_pair.png"""
import os, sys, datetime as dt
import numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt, matplotlib.patheffects as pe, cartopy.crs as ccrs, cartopy.feature as cf
from scipy.ndimage import gaussian_filter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import featlib, reperes
run = dt.datetime.strptime(os.environ['RUN'], '%Y%m%d%H'); s = int(sys.argv[1]); la0, lo0 = float(sys.argv[2]), float(sys.argv[3])
F = featlib.champs(run, s)
lat = 90 - 0.25 * np.arange(721); lon = -180 + 0.25 * np.arange(1440)
w = 16; ext = [lo0 - w, lo0 + w, la0 - w * .6, la0 + w * .6]
j = (lat >= ext[2] - 3) & (lat <= ext[3] + 3); i = (lon >= ext[0] - 3) & (lon <= ext[1] + 3)
la, lo = lat[j], lon[i]
m = gaussian_filter(F['msl'][np.ix_(j, i)] / 100, 1); z = gaussian_filter(F['gh500'][np.ix_(j, i)] / 10, 1); t = F['t500'][np.ix_(j, i)] - 273.15
def centre(a, box=5):
    jj = (la >= la0 - box) & (la <= la0 + box); ii = (lo >= lo0 - box * 1.5) & (lo <= lo0 + box * 1.5); sub = a[np.ix_(jj, ii)]
    y, x = np.unravel_index(np.argmin(sub), sub.shape); return la[jj][y], lo[ii][x], sub[y, x]
ds, dz = centre(m), centre(z)
H = [pe.withStroke(linewidth=3, foreground='white')]
V = run + dt.timedelta(hours=s)
fig = plt.figure(figsize=(12, 5.4), dpi=120)
for k in range(2):
    ax = fig.add_subplot(1, 2, k + 1, projection=ccrs.LambertConformal(central_longitude=lo0, central_latitude=la0)); ax.set_extent(ext, ccrs.PlateCarree())
    ax.add_feature(cf.LAND.with_scale('50m'), color='#ece6da'); ax.add_feature(cf.COASTLINE.with_scale('50m'), lw=.6)
    if k == 0:
        c = ax.contour(lo, la, m, levels=np.arange(950, 1050, 4), colors='#222', linewidths=.8, transform=ccrs.PlateCarree()); ax.clabel(c, fmt='%d', fontsize=7)
        ax.set_title('Pression au niveau de la mer (hPa)', fontsize=10)
    else:
        cs = ax.contourf(lo, la, t, levels=np.arange(-44, -8, 2), cmap='coolwarm', transform=ccrs.PlateCarree(), extend='both')
        c = ax.contour(lo, la, z, levels=np.arange(480, 600, 4), colors='#222', linewidths=.8, transform=ccrs.PlateCarree()); ax.clabel(c, fmt='%d', fontsize=7)
        fig.colorbar(cs, ax=ax, shrink=.75, label='Température à 500 hPa (°C)')
        ax.set_title('500 hPa (≈ 5 600 m) : géopotentiel (dam) et température (°C)', fontsize=10)
    for (a, b, _), lab, col in ((ds, 'D', '#c62828'), (dz, 'GF', '#6d28d9')):
        tx = ax.text(b, a, lab, color=col, fontsize=16, weight='bold', ha='center', va='center', transform=ccrs.PlateCarree()); tx.set_path_effects(H)
fig.suptitle(f'ECMWF IFS run {run:%d/%m %H} UTC +{s} h, valable {V:%d/%m %H} UTC · D : centre au sol ({ds[2]:.0f} hPa) · GF : cœur à 500 hPa ({dz[2]:.0f} dam)', fontsize=10)
fig.savefig('fig/gf_pair.png', bbox_inches='tight'); print('gf_pair ok', ds, dz)

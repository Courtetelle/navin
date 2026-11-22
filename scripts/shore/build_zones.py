"""Météo-France sea zones and the 500 m coast grid, for LiveMétéo.

Run in a folder holding water-polygons-split-4326/ (osmdata.openstreetmap.de),
with shapely, pyshp and pyproj (the workflow « Zones Météo-France » does it):

  python build_zones.py OUT_DIR

It writes:
  OUT_DIR/meteo-zones.json  the zones (coast bands of 20 NM and offshore
                            zones), cut out of the OSM sea, with the circles
                            that cover their coast (the stations are read on
                            them);
  OUT_DIR/shore-sea500.bin  the land farther than 500 m from the sea, on a
                            grid of 0.004° over the French coasts (same format
                            as shore-far.bin, see build_shore.py, 250 cells
                            per degree).

The outlines are drawn from the names and limits of the bulletins of
Météo-France (Guide marine): the coast zones go from one landmark to the next
and reach 20 NM from the land; the offshore zones are drawn by hand from the
map of the guide, approximately (no official geometry is published).
"""

import json
import math
import struct
import sys
import time

import numpy as np
import shapefile
import shapely
import shapely.errors
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
to4326 = Transformer.from_crs(3035, 4326, always_xy=True)

NM = 1852
COAST_NM = 20
COAST_SIMPLIFY_M = 400
LARGE_SIMPLIFY_M = 900
# Circles read for the stations: this radius, this far apart along the coast.
READ_KM = 45
READ_STEP_KM = 70

# Coast zones: sectors (lon, lat) from one landmark to the next, wide on land
# and up to the middle of the Channel, cut by the sea and the band of 20 NM.
COAST = [
    ('belge-somme', 'Frontière belge – Baie de Somme', 'manche',
     [(2.6, 50.5), (2.6, 51.1), (2.45, 51.45), (1.8, 51.3), (1.45, 51.02),
      (1.0, 50.6), (1.0, 50.25), (1.55, 50.2), (1.9, 50.2)]),
    ('somme-hague', 'Baie de Somme – Cap de la Hague', 'manche',
     [(1.9, 50.2), (1.55, 50.2), (1.0, 50.25), (1.0, 50.6), (0.0, 50.42),
      (-1.0, 50.3), (-1.94, 50.2), (-1.94, 49.72), (-1.6, 49.6),
      (-1.45, 49.3), (-1.0, 49.0), (0.5, 49.0), (1.9, 49.6)]),
    ('hague-penmarch', 'Cap de la Hague – Penmarc’h', 'manche',
     [(-1.94, 49.72), (-1.94, 50.2), (-2.8, 50.05), (-4.0, 49.45),
      (-5.0, 49.15), (-5.85, 48.75), (-5.85, 47.8), (-5.0, 47.4),
      (-4.37, 47.80), (-4.0, 48.0), (-2.5, 48.2), (-1.4, 48.35),
      (-1.0, 49.0), (-1.45, 49.3), (-1.6, 49.6)]),
    ('penmarch-aiguillon', 'Penmarc’h – Anse de l’Aiguillon', 'atlantique',
     [(-4.37, 47.80), (-5.0, 47.4), (-4.0, 46.8), (-3.0, 46.2),
      (-2.2, 46.27), (-1.2, 46.27), (-0.9, 46.5), (-1.2, 47.4),
      (-3.0, 47.95), (-4.0, 48.0)]),
    ('aiguillon-espagne', 'Anse de l’Aiguillon – Frontière espagnole',
     'atlantique',
     [(-1.2, 46.27), (-2.2, 46.27), (-3.0, 46.2), (-2.7, 44.5),
      (-2.1, 43.75), (-1.79, 43.39), (-1.6, 43.2), (-0.2, 44.0),
      (-0.2, 45.8), (-0.9, 46.5)]),
    ('espagne-camargue', 'Frontière espagnole – Port-Camargue',
     'mediterranee',
     [(2.7, 42.45), (3.17, 42.435), (3.7, 42.43), (4.25, 43.0),
      (4.13, 43.52), (3.8, 43.85), (2.6, 43.2)]),
    ('camargue-straphael', 'Port-Camargue – Saint-Raphaël', 'mediterranee',
     [(4.13, 43.52), (4.25, 43.0), (5.0, 42.8), (6.2, 42.6), (7.0, 42.9),
      (6.77, 43.42), (6.6, 43.8), (4.3, 43.95)]),
    ('straphael-menton', 'Saint-Raphaël – Menton', 'mediterranee',
     [(6.77, 43.42), (7.0, 42.9), (7.6, 43.3), (7.53, 43.785),
      (7.5, 44.0), (6.6, 43.8)]),
    ('corse', 'Corse', 'mediterranee',
     [(8.0, 41.32), (8.0, 42.6), (8.9, 43.4), (9.6, 43.35), (10.05, 42.5),
      (9.85, 41.32)]),
]

# Offshore zones (bulletins large), by hand from the map of the guide.
LARGE = [
    ('pas-de-calais', 'Pas-de-Calais', 'manche',
     [(1.0, 50.2), (1.0, 50.75), (1.3, 51.25), (2.0, 51.5), (3.2, 51.5),
      (3.2, 50.9), (2.2, 50.2)]),
    ('antifer', 'Antifer', 'manche',
     [(-1.94, 49.2), (-1.94, 50.8), (0.0, 50.85), (1.0, 50.75),
      (1.0, 50.2), (1.9, 49.6), (0.0, 49.0)]),
    ('casquets', 'Casquets', 'manche',
     [(-3.6, 48.3), (-3.6, 50.4), (-1.94, 50.8), (-1.94, 49.2),
      (-1.0, 48.4)]),
    ('ouessant', 'Ouessant', 'manche',
     [(-6.25, 48.45), (-6.25, 50.2), (-3.6, 50.4), (-3.6, 48.3),
      (-4.6, 48.3)]),
    ('iroise', 'Iroise', 'atlantique',
     [(-8.0, 47.5), (-8.0, 48.45), (-6.25, 48.45), (-4.6, 48.3),
      (-4.0, 48.0), (-3.0, 47.5)]),
    ('yeu', 'Yeu', 'atlantique',
     [(-8.0, 46.0), (-8.0, 47.5), (-3.0, 47.5), (-1.5, 47.5),
      (-1.0, 46.0)]),
    ('rochebonne', 'Rochebonne', 'atlantique',
     [(-8.0, 44.5), (-8.0, 46.0), (-1.0, 46.0), (-0.8, 44.5)]),
    ('cantabrico', 'Cantabrico', 'atlantique',
     [(-8.0, 43.0), (-8.0, 44.5), (-0.8, 44.5), (-1.2, 43.0)]),
    ('pazenn', 'Pazenn', 'atlantique',
     [(-15.0, 44.5), (-15.0, 48.45), (-8.0, 48.45), (-8.0, 44.5)]),
    ('finisterre', 'Finisterre', 'atlantique',
     [(-15.0, 41.5), (-15.0, 44.5), (-8.0, 44.5), (-8.0, 43.0),
      (-8.5, 41.5)]),
    ('sole', 'Sole', 'atlantique',
     [(-15.0, 48.45), (-15.0, 50.5), (-6.25, 50.5), (-6.25, 48.45)]),
    ('lion', 'Lion', 'mediterranee',
     [(2.6, 41.8), (2.6, 43.6), (4.9, 43.8), (5.0, 41.8)]),
    ('provence', 'Provence', 'mediterranee',
     [(5.0, 41.8), (4.9, 43.8), (7.5, 43.9), (7.5, 43.0), (8.0, 43.0),
      (8.0, 41.8)]),
    ('ligure', 'Ligure', 'mediterranee',
     [(7.5, 43.0), (7.5, 44.6), (10.3, 44.6), (10.3, 43.5), (9.4, 43.0)]),
    ('corse-large', 'Corse', 'mediterranee',
     [(8.0, 41.3), (8.0, 43.0), (9.4, 43.0), (9.8, 42.4), (9.8, 41.3)]),
    ('elbe', 'Elbe', 'mediterranee',
     [(9.8, 41.8), (9.8, 42.4), (9.4, 43.0), (10.3, 43.5), (11.3, 43.0),
      (11.3, 41.8)]),
    ('maddalena', 'Maddalena', 'mediterranee',
     [(8.0, 40.6), (8.0, 41.3), (9.8, 41.3), (10.3, 41.0), (10.3, 40.6)]),
    ('sardaigne', 'Sardaigne', 'mediterranee',
     [(5.8, 38.8), (5.8, 41.8), (8.0, 41.8), (8.0, 40.6), (8.6, 38.8)]),
    ('minorque', 'Minorque', 'mediterranee',
     [(3.0, 39.5), (2.6, 41.8), (5.8, 41.8), (5.8, 39.5)]),
    ('baleares', 'Baléares', 'mediterranee',
     [(0.8, 38.6), (0.8, 40.3), (2.6, 41.0), (3.0, 39.5), (3.6, 38.6)]),
    ('est-cabrera', 'Est Cabrera', 'mediterranee',
     [(3.6, 37.5), (3.0, 39.5), (5.8, 39.5), (5.8, 37.5)]),
]

# Lake: the Léman, coarse; no sea, the stations within 1 km of its shore.
LAKES = [
    ('leman', 'Léman', 'lac',
     [(6.14, 46.20), (6.24, 46.38), (6.34, 46.46), (6.50, 46.52),
      (6.63, 46.52), (6.84, 46.47), (6.93, 46.40), (6.86, 46.37),
      (6.59, 46.39), (6.48, 46.37), (6.33, 46.36), (6.24, 46.30),
      (6.14, 46.20)]),
]

GRID = (-10, 12, 40, 53)
PER_DEG = 250
NEAR_M = 500


def proj(geom):
    return shapely.transform(geom, lambda xy: np.column_stack(
        to3035.transform(xy[:, 0], xy[:, 1])))


def unproj(geom):
    return shapely.transform(geom, lambda xy: np.column_stack(
        to4326.transform(xy[:, 0], xy[:, 1])))


def load_sea():
    reader = shapefile.Reader('water-polygons-split-4326/water_polygons.shp')
    kept = []
    for index in range(len(reader)):
        b = reader.shape(index).bbox
        if b[2] < -16 or b[0] > 13 or b[3] < 36 or b[1] > 54:
            continue
        geom = shape(reader.shape(index).__geo_interface__)
        # Valid again once projected (the projection can fold an edge).
        kept.append(shapely.make_valid(proj(shapely.make_valid(geom)),
                                       method='structure', keep_collapsed=False))
    print('sea pieces', len(kept), flush=True)
    return np.array(kept, dtype=object)


def sea_in(sea, tree, area):
    pieces = sea[tree.query(area)]
    try:
        cut = shapely.intersection(pieces, area)
    except shapely.errors.GEOSException:
        cut = shapely.intersection(shapely.buffer(pieces, 0), area)
    return shapely.make_valid(unary_union(cut))


def rings(geom):
    out = []
    polys = getattr(geom, 'geoms', [geom])
    for poly in polys:
        if poly.is_empty or poly.geom_type != 'Polygon':
            continue
        parts = [poly.exterior, *poly.interiors]
        out.append([[[round(x, 3), round(y, 3)] for x, y in ring.coords]
                    for ring in parts])
    return out


def read_circles(geom, land):
    """Points of the outline of the zone along its coast, READ_STEP_KM
    apart: circles of READ_KM where the stations are read."""
    near_land = shapely.buffer(land, 2000)
    shapely.prepare(near_land)
    kept = []
    lines = getattr(geom.boundary, 'geoms', [geom.boundary])
    for line in lines:
        if line.is_empty or line.length == 0:
            continue
        steps = max(1, int(line.length // 5000))
        for k in range(steps + 1):
            p = line.interpolate(k / steps, normalized=True)
            if not near_land.contains(p):
                continue
            if all(p.distance(q) > READ_STEP_KM * 1000 for q in kept):
                kept.append(p)
    out = []
    for p in kept:
        lon, lat = to4326.transform(p.x, p.y)
        out.append([round(lat, 4), round(lon, 4), READ_KM])
    return out


def zone(sea, tree, ident, name, basin, kind, outline):
    area = shapely.make_valid(proj(Polygon(outline)))
    water = sea_in(sea, tree, area)
    # The land, without the slivers left between the pieces of the sea.
    land = area.difference(water)
    land = shapely.make_valid(shapely.buffer(shapely.buffer(land, -300), 300))
    if kind == 'cote':
        land_s = shapely.simplify(land, 200)
        band = shapely.buffer(land_s, COAST_NM * NM, quad_segs=4)
        geom = water.intersection(band)
        geom = shapely.simplify(geom, COAST_SIMPLIFY_M)
    else:
        geom = shapely.simplify(water, LARGE_SIMPLIFY_M)
    geom = shapely.make_valid(geom)
    circles = read_circles(geom, shapely.simplify(land, 200))
    out = unproj(geom)
    print(ident, 'area km2', round(geom.area / 1e6), 'circles',
          len(circles), flush=True)
    return {
        'id': ident, 'name': name, 'basin': basin, 'kind': kind,
        'polys': rings(out), 'reads': circles,
    }


def varint(value, out):
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return


def grid(sea, tree, path):
    lon0, lon1, lat0, lat1 = GRID
    n_lon, n_lat = lon1 - lon0, lat1 - lat0
    kinds = bytearray()
    blobs = bytearray()
    step = 1 / PER_DEG
    offs = (np.arange(PER_DEG) + 0.5) * step
    margin = NEAR_M + 200
    started = time.time()
    for tlat in range(n_lat):
        for tlon in range(n_lon):
            lons, lats = np.meshgrid(lon0 + tlon + offs, lat0 + tlat + offs)
            xs, ys = to3035.transform(lons.ravel(), lats.ravel())
            env = box(xs.min() - margin, ys.min() - margin,
                      xs.max() + margin, ys.max() + margin)
            try:
                pieces = shapely.intersection(sea[tree.query(env)], env)
            except shapely.errors.GEOSException:
                pieces = shapely.intersection(
                    shapely.buffer(sea[tree.query(env)], 0), env)
            near = np.zeros(len(xs), dtype=bool)
            widened = shapely.buffer(
                shapely.simplify(pieces, 25), NEAR_M, quad_segs=4)
            for piece in widened:
                todo = ~near
                if not todo.any():
                    break
                if piece.is_empty:
                    continue
                shapely.prepare(piece)
                near[todo] = shapely.contains_xy(piece, xs[todo], ys[todo])
            far = ~near
            if not far.any():
                kinds.append(0)
            elif far.all():
                kinds.append(1)
            else:
                kinds.append(2)
                runs = bytearray()
                changes = np.flatnonzero(np.diff(far.astype(np.int8))) + 1
                edges = np.concatenate(([0], changes, [len(far)]))
                lengths = np.diff(edges).tolist()
                if far[0]:
                    lengths.insert(0, 0)
                for length in lengths:
                    varint(length, runs)
                assert len(runs) < 65536, 'runs of a tile too long'
                blobs += struct.pack('<H', len(runs)) + runs
        print(f'grid lat {lat0 + tlat} {time.time() - started:.0f}s',
              flush=True)
    head = b'NVSH' + struct.pack('<BBhhHH', 1, PER_DEG, lon0, lat0, n_lon,
                                 n_lat)
    with open(path, 'wb') as out:
        out.write(head + kinds + blobs)
    print('grid bytes', len(head) + len(kinds) + len(blobs))


def lake(ident, name, basin, outline):
    return {
        'id': ident, 'name': name, 'basin': basin, 'kind': 'lac',
        'polys': [[[[x, y] for x, y in outline]]],
        'reads': [[46.43, 6.53, 45]],
    }


def main(out_dir):
    sea = load_sea()
    tree = shapely.STRtree(sea)
    zones = []
    for ident, name, basin, outline in COAST:
        zones.append(zone(sea, tree, ident, name, basin, 'cote', outline))
    for ident, name, basin, outline in LARGE:
        zones.append(zone(sea, tree, ident, name, basin, 'large', outline))
    for ident, name, basin, outline in LAKES:
        zones.append(lake(ident, name, basin, outline))
    with open(f'{out_dir}/meteo-zones.json', 'w') as out:
        json.dump({'v': 1, 'zones': zones}, out, ensure_ascii=False,
                  separators=(',', ':'))
    grid(sea, tree, f'{out_dir}/shore-sea500.bin')


if __name__ == '__main__':
    main(sys.argv[1])

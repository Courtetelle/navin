"""Grid of the land farther than 5 km from the sea or a lake, for Live météo.

Run in a folder holding water-polygons-split-3857/ (osmdata.openstreetmap.de)
and water-eu.geojsonseq / water-ex.geojsonseq (osmium tags-filter
wr/natural=water, then osmium export --geometry-types=polygon), with shapely,
pyshp and pyproj: `python build_shore.py sea`, `lakes`, then `grid`; gzip
shore-far.bin into public/shore-far.bin.

Phase `sea`: OSM ocean polygons (3857) over Europe -> sea.wkb (EPSG:3035).
Phase `lakes`: OSM natural=water polygons >= 2 km2 -> lakes.wkb (EPSG:3035).
Phase `grid`: 0.01 deg cells, bit 1 = land farther than 5 km -> shore-far.bin.

File format (little endian):
  'NVSH', u8 version=1, u8 cells per degree (100), i16 lon0, i16 lat0,
  u16 tiles in lon, u16 tiles in lat,
  then one u8 per tile (lat rows from south, lon from west):
    0 = every cell kept (water or near), 1 = every cell far land, 2 = mixed,
  then for each mixed tile, in order: u16 byte length, then the runs of its
  cells (rows from south, cells from west), as LEB128 varints, alternating
  kept / far, starting with kept.
"""

import json
import pickle
import struct
import sys
import time

import numpy as np
import shapefile
import shapely
from pyproj import Transformer
from shapely.geometry import box, shape

LON0, LON1, LAT0, LAT1 = -25, 46, 27, 82
PER_DEG = 100
NEAR_M = 5000
LAKE_MIN_M2 = 2_000_000
NOT_LAKES = {
    'river', 'canal', 'stream', 'ditch', 'drain', 'wastewater', 'moat',
    'stream_pool', 'fish_pass', 'lock',
}

to3035_from3857 = Transformer.from_crs(3857, 3035, always_xy=True)
to3035 = Transformer.from_crs(4326, 3035, always_xy=True)
to3857 = Transformer.from_crs(4326, 3857, always_xy=True)


def save(name, geoms):
    with open(name, 'wb') as out:
        pickle.dump(shapely.to_wkb(np.array(geoms, dtype=object)), out)


def load(name):
    with open(name, 'rb') as inp:
        return list(shapely.from_wkb(pickle.load(inp)))


def sea():
    x0, y0 = to3857.transform(LON0 - 1, LAT0 - 1)
    x1, y1 = to3857.transform(LON1 + 1, min(LAT1 + 1, 85))
    reader = shapefile.Reader('water-polygons-split-3857/water_polygons.shp')
    kept = []
    for index in range(len(reader)):
        rec = reader.shape(index)
        b = rec.bbox
        if b[2] < x0 or b[0] > x1 or b[3] < y0 or b[1] > y1:
            continue
        geom = shape(rec.__geo_interface__)
        geom = shapely.transform(geom, lambda xy: np.column_stack(
            to3035_from3857.transform(xy[:, 0], xy[:, 1])))
        kept.append(shapely.make_valid(geom))
    save('sea.wkb', kept)
    print('sea polygons', len(kept))


def lakes():
    kept = []
    seen = 0
    for name in ('water-eu.geojsonseq', 'water-ex.geojsonseq'):
        with open(name) as inp:
            for line in inp:
                line = line.lstrip('\x1e').strip()
                if not line:
                    continue
                seen += 1
                feat = json.loads(line)
                tags = feat.get('properties') or {}
                if tags.get('natural') != 'water':
                    continue
                if tags.get('water') in NOT_LAKES or tags.get('intermittent') == 'yes':
                    continue
                geom = shape(feat['geometry'])
                geom = shapely.transform(geom, lambda xy: np.column_stack(
                    to3035.transform(xy[:, 0], xy[:, 1])))
                if geom.area < LAKE_MIN_M2:
                    continue
                kept.append(shapely.make_valid(geom))
    save('lakes.wkb', kept)
    print('water seen', seen, 'lakes kept', len(kept))


def varint(value, out):
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return


def grid():
    waters = load('sea.wkb') + load('lakes.wkb')
    shapely.prepare(waters)
    tree = shapely.STRtree(waters)
    n_lon, n_lat = LON1 - LON0, LAT1 - LAT0
    kinds = bytearray()
    blobs = bytearray()
    step = 1 / PER_DEG
    offs = (np.arange(PER_DEG) + 0.5) * step
    started = time.time()
    counts = [0, 0, 0]
    for tlat in range(n_lat):
        for tlon in range(n_lon):
            lon_w, lat_s = LON0 + tlon, LAT0 + tlat
            lons, lats = np.meshgrid(lon_w + offs, lat_s + offs)
            xs, ys = to3035.transform(lons.ravel(), lats.ravel())
            pts = shapely.points(xs, ys)
            env = box(xs.min(), ys.min(), xs.max(), ys.max())
            cand = tree.query(env.buffer(NEAR_M + 100))
            near = np.zeros(len(pts), dtype=bool)
            for gi in cand:
                todo = ~near
                if not todo.any():
                    break
                near[todo] = shapely.dwithin(waters[gi], pts[todo], NEAR_M)
            far = ~near
            if not far.any():
                kinds.append(0)
            elif far.all():
                kinds.append(1)
            else:
                kinds.append(2)
                runs = bytearray()
                cur, length = False, 0
                for value in far:
                    if value == cur:
                        length += 1
                    else:
                        varint(length, runs)
                        cur, length = value, 1
                varint(length, runs)
                blobs += struct.pack('<H', len(runs)) + runs
            counts[kinds[-1]] += 1
        print(f'lat {LAT0 + tlat} done, {time.time() - started:.0f}s, kinds {counts}', flush=True)
    head = b'NVSH' + struct.pack('<BBhhHH', 1, PER_DEG, LON0, LAT0, n_lon, n_lat)
    with open('shore-far.bin', 'wb') as out:
        out.write(head + kinds + blobs)
    print('bytes', len(head) + len(kinds) + len(blobs))


{'sea': sea, 'lakes': lakes, 'grid': grid}[sys.argv[1]]()

"""Polars of the ORC certificates, one per boat type, for the boat sheet.

Run with a clone of https://github.com/jieter/orc-data (MIT licence, the
public ORC certificates as JSON in site/data/<country>/<sail number>.json):
`python build_orc_polars.py <orc-data folder> public/polars/orc.json`.

Only the boat type, the years, the length and the speeds are kept: no boat
name, sail number or owner. For each type, every speed is the median of its
certificates.

File format (JSON):
  {"src", "licence", "twa": [52 … 150], "tws": [6 … 20],
   "boats": [[type, first year, last year, certificates, length cm,
              then 7 numbers per twa row (56), 7 beat angles, 7 beat VMG,
              7 run angles, 7 run VMG, all × 10 and rounded]]}
"""

import collections
import glob
import json
import os
import statistics
import sys

TWA = [52, 60, 75, 90, 110, 120, 135, 150]
TWS = [6, 8, 10, 12, 14, 16, 20]


def tenth(values):
    return [round(value * 10) for value in values]


def main(folder, out):
    by_type = collections.defaultdict(list)
    for path in glob.glob(os.path.join(folder, 'site', 'data', '*', '*.json')):
        try:
            with open(path, encoding='utf-8') as file:
                cert = json.load(file)
        except (OSError, ValueError):
            continue
        boat = cert.get('boat') or {}
        vpp = cert.get('vpp') or {}
        name = ' '.join((boat.get('type') or '').split())
        rows = [vpp.get(str(angle)) for angle in TWA]
        extra = [vpp.get(key) for key in
                 ('beat_angle', 'beat_vmg', 'run_angle', 'run_vmg')]
        if not name or not all(
                row and len(row) == len(TWS) for row in rows + extra):
            continue
        by_type[name.upper()].append((name, boat, rows, extra))
    boats = []
    for certs in by_type.values():
        names = collections.Counter(name for name, _, _, _ in certs)
        years = sorted(boat.get('year') for _, boat, _, _ in certs
                       if isinstance(boat.get('year'), int))
        lengths = [boat.get('sizes', {}).get('loa') or 0
                   for _, boat, _, _ in certs]
        numbers = []
        for part in ('rows', 'extra'):
            count = len(TWA) if part == 'rows' else 4
            for line in range(count):
                for column in range(len(TWS)):
                    numbers.append(statistics.median(
                        (rows if part == 'rows' else extra)[line][column]
                        for _, _, rows, extra in certs))
        boats.append([
            names.most_common(1)[0][0],
            years[0] if years else None,
            years[-1] if years else None,
            len(certs),
            round(statistics.median(lengths) * 100),
            *tenth(numbers),
        ])
    boats.sort(key=lambda row: row[0].upper())
    data = {
        'src': 'ORC certificates, github.com/jieter/orc-data',
        'licence': 'MIT, (c) Jan Pieter Waagmeester',
        'twa': TWA,
        'tws': TWS,
        'boats': boats,
    }
    with open(out, 'w', encoding='utf-8') as file:
        json.dump(data, file, ensure_ascii=False, separators=(',', ':'))
    print(len(boats), 'types', os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

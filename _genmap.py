# -*- coding: utf-8 -*-
"""把 assets/china.json 转成 assets/mapdata.js（离线省界 + 投影参数）。

用法：python _genmap.py
路径基于脚本所在目录，不依赖固定盘符。
"""
import json, io, os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'assets', 'china.json')
OUT = os.path.join(BASE, 'assets', 'mapdata.js')

data = json.load(io.open(SRC, encoding='utf-8'))

def rings(geom):
    """Yield outer rings as coordinate lists for Polygon/MultiPolygon."""
    t = geom.get('type')
    if t == 'Polygon':
        yield geom['coordinates'][0]  # outer ring only
    elif t == 'MultiPolygon':
        for poly in geom['coordinates']:
            yield poly[0]

# collect bbox
minx = miny = float('inf'); maxx = maxy = float('-inf')
for f in data['features']:
    g = f.get('geometry')
    if not g: continue
    for r in rings(g):
        for c in r:
            x, y = c[0], c[1]
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y

W = 1000.0
scale = W / (maxx - minx)
H = (maxy - miny) * scale

def mp(x, y):
    sx = (x - minx) * scale
    sy = (maxy - y) * scale   # invert latitude for SVG y-down
    return sx, sy

def path_for(geom):
    d = []
    for r in rings(geom):
        parts = []
        first = None
        for c in r:
            sx, sy = mp(c[0], c[1])
            if first is None:
                first = (sx, sy)
                parts.append("M%.1f %.1f" % (sx, sy))
            else:
                parts.append("L%.1f %.1f" % (sx, sy))
        if first:
            parts.append("Z")
        d.append("".join(parts))
    return " ".join(d)

names = []
out = ["/* China province paths (simplified from DataV GeoJSON) */", "window.CNPROV = {};"]
for f in data['features']:
    g = f.get('geometry')
    if not g: continue
    name = f['properties'].get('name')
    if not name: continue
    names.append(name)
    out.append('window.CNPROV[%r] = %r;' % (name, path_for(g)))

out.append('window.CNMAP_W = %r; window.CNMAP_H = %r;' % (round(W, 1), round(H, 1)))
out.append('window.CNMAP_MINX = %r; window.CNMAP_MINY = %r;' % (round(minx, 3), round(miny, 3)))
out.append('window.CNMAP_MAXX = %r; window.CNMAP_MAXY = %r; window.CNMAP_SCALE = %r;' % (round(maxx, 3), round(maxy, 3), round(scale, 6)))

with io.open(OUT, 'w', encoding='utf-8') as fh:
    fh.write("\n".join(out))

print("viewBox %.0f x %.0f  (lng %.1f-%.1f lat %.1f-%.1f)" % (W, H, minx, maxx, miny, maxy))
print("province count:", len(names))

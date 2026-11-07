# -*- coding: utf-8 -*-
"""把 assets/china.json 转成可在 file:// 直接加载的 assets/chinageo.js。

Leaflet 需要经纬度多边形；浏览器在 file:// 下不能 fetch 本地 JSON，
所以把简化后的 GeoJSON 包成一个普通 <script> 变量。
"""
import json
import io
import math

SRC = 'assets/china.json'
OUT = 'assets/chinageo.js'
TOL = 0.025  # 约 2.5 公里，国家级缩放足够


def point_line_dist(p, a, b):
    px, py = p
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def rdp(points, tol):
    if len(points) <= 2:
        return points
    # 迭代实现，避免长边界递归过深
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        if end <= start + 1:
            continue
        maxd = -1.0
        idx = -1
        for i in range(start + 1, end):
            d = point_line_dist(points[i], points[start], points[end])
            if d > maxd:
                maxd = d
                idx = i
        if maxd > tol and idx != -1:
            keep[idx] = True
            stack.append((start, idx))
            stack.append((idx, end))
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(ring):
    if len(ring) < 4:
        return None
    closed = ring[0] == ring[-1]
    pts = ring[:-1] if closed else ring[:]
    pts = rdp(pts, TOL)
    if len(pts) < 3:
        return None
    pts = [[round(x, 3), round(y, 3)] for x, y in pts]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts


def simplify_geometry(geom):
    t = geom.get('type')
    coords = geom.get('coordinates')
    if t == 'Polygon':
        rings = [r for r in (simplify_ring(x) for x in coords) if r]
        return {'type': 'Polygon', 'coordinates': rings} if rings else None
    if t == 'MultiPolygon':
        polys = []
        for poly in coords:
            rings = [r for r in (simplify_ring(x) for x in poly) if r]
            if rings:
                polys.append(rings)
        return {'type': 'MultiPolygon', 'coordinates': polys} if polys else None
    return None


def main():
    src = json.load(io.open(SRC, encoding='utf-8'))
    out = {'type': 'FeatureCollection', 'features': []}
    for f in src.get('features', []):
        geom = simplify_geometry(f.get('geometry') or {})
        if not geom:
            continue
        name = (f.get('properties') or {}).get('name') or ''
        out['features'].append({
            'type': 'Feature',
            'properties': {'name': name},
            'geometry': geom,
        })
    body = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with io.open(OUT, 'w', encoding='utf-8') as fp:
        fp.write('/* 由 _gengeo.py 生成：简化后的省级边界，供 Leaflet 使用 */\n')
        fp.write('window.CNGEO=' + body + ';\n')
    print('wrote', OUT, 'features', len(out['features']), 'bytes', len(body.encode('utf-8')))


if __name__ == '__main__':
    main()

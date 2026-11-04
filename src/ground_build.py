"""Builds the library of battle grounds: w3d/grounds/<id>.json and w3d/grounds/index.json.

usage: python3 src/ground_build.py [id ...]        (all grounds when no id is given)
needs: numpy, PIL, tifffile, imagecodecs, fsspec, aiohttp, pyarrow   (pip install tifffile imagecodecs fsspec aiohttp pyarrow)

Each ground is the same 30 m grid the table battle has always read as TER (198 x 132 cells, 5.94 x 3.96 km, north up,
centred on `center`), plus real relief and the country around it. Sources, per layer:
  relief      AWS Terrain Tiles (Terrarium). In Europe these are a surface model: tree canopy and buildings stand as
              false hills, so ground under woods and towns is filled from the surrounding fields (port of battle-atlas
              tools/terrain.py). Stored as uint16 of (elevation - min) x 10, little-endian, base64.
  land cover  ESA WorldCover 2021 (10 m): woods, water, wetland (marsh). This is today's cover, not 1740's.
  villages    WorldCover built-up cells, kept only near a village point in the Overture Maps divisions gazetteer
              (names: the German form when Overture has one, else today's name). Towns are cut to their period
              extent (TOWNS below; inferred, marked so).
  streams     traced from the relief (flow accumulation), not from a map; large rivers come from WorldCover water.
  Leuthen     woods, rivers, ponds, villages and roads authored in battle-atlas from period plans (src/grounds_src).
  Mollwitz    the game's original grid (src/battle_terrain.json, from OSM) with the villages between the lines cleared
              (Nathan's decision, also applied by w3d_build.py), so the opening battle is unchanged.
Downloads are cached in src/.ground_cache (not committed); the gazetteer pick is cached in src/grounds_src/<id>.places.json."""
import base64, heapq, io, json, math, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

S = Path(__file__).resolve().parent; O = S.parent
CACHE = S / '.ground_cache'; SRC = S / 'grounds_src'; OUT = O / 'w3d' / 'grounds'
CELL, COLS, ROWS = 30, 198, 132
W_M, H_M = CELL * COLS, CELL * ROWS
OUTER_HALF, OUTER_STEP = 12600, 200          # the country around the field, out to where battle3d's mesh ends (12 km)
LEGEND = {'0': 'open', '1': 'wood', '2': 'water', '3': 'village', '4': 'marsh', '5': 'vineyard'}

# Towns as they stood about 1740. Extents are inferred from the period town plans as generally known (walled core,
# rough radius or outline), not surveyed: every one is marked 'inferred' in the ground file.
GROUNDS = {
  'mollwitz': dict(title='Mollwitz', place='Mollwitz (Małujowice), 9 km west of Brieg, Silesia', center=[50.845, 17.385],
                   about='open, almost level farmland between long street villages; a few small woods; streams and ditches',
                   base='mollwitz'),
  'brieg': dict(title='Brieg', place='Brieg (Brzeg) on the Oder, Silesia: the fortress town and its approaches', center=[50.858, 17.468],
                about='fortress town on the south bank of the Oder; flat ground to the south and west; the river and its meadows to the north',
                towns=[dict(name='Brieg', lat=50.8615, lon=17.4705, r=480, why='walled and bastioned town, about 1 km across')]),
  'neisse': dict(title='Neisse', place='Neisse (Nysa) on the Glatzer Neisse, Silesia: the fortress and the river', center=[50.472, 17.333],
                 about='fortress town on the Neisse; river meadows; rising ground to the south and west',
                 towns=[dict(name='Neisse', lat=50.4738, lon=17.3325, r=560, why='walled town with bastions, about 1.1 km across')],
                 drop_water=[dict(poly=[[-2970, 200], [-1700, 200], [-1700, -1980], [-2970, -1980]], why='The Nysa reservoir, dammed in 1971')]),
  'glogau': dict(title='Glogau', place='Glogau (Głogów) on the Oder, Lower Silesia: the fortress and the cathedral island', center=[51.658, 16.086],
                 about='fortress town on the south bank of the Oder; marshy river meadows; flat ground to the south',
                 towns=[dict(name='Glogau', lat=51.6634, lon=16.0861, r=460, why='walled town, about 0.9 km across'),
                        dict(name='Dom (cathedral island)', lat=51.6686, lon=16.0900, r=180, why='cathedral precinct across the river')]),
  'chotusitz': dict(title='Chotusitz', place='Chotusitz (Chotusice), 5 km north of Czaslau (Čáslav), Bohemia', center=[49.954, 15.405],
                    about='open, gently rolling Bohemian farmland round Chotusitz; Sehuschitz and its park to the north; brooks and ponds; Czaslau 5 km south, off the field',
                    towns=[dict(name='Czaslau', lat=49.9109, lon=15.3913, r=380, why='small walled town, about 0.7 km across')]),
  'prague': dict(title='Prague', place='Prague (Praha): the walled city on both banks of the Vltava', center=[50.083, 14.418],
                 about='a great walled city astride the Vltava; the castle hill and Petřín above the left bank; vineyards east of the New Town',
                 town_polys=[dict(name='Old and New Town', why='Baroque walls of the right-bank city, approximate',
                                  poly=[[50.0925, 14.4245], [50.0918, 14.4335], [50.0890, 14.4375], [50.0840, 14.4385], [50.0775, 14.4375],
                                        [50.0715, 14.4300], [50.0650, 14.4215], [50.0640, 14.4175], [50.0700, 14.4140], [50.0800, 14.4130],
                                        [50.0870, 14.4140], [50.0915, 14.4175]]),
                             dict(name='Lesser Town and Hradschin', why='Baroque walls of the left-bank city, approximate',
                                  poly=[[50.0930, 14.4105], [50.0945, 14.4010], [50.0910, 14.3920], [50.0870, 14.3885], [50.0820, 14.3940],
                                        [50.0790, 14.3990], [50.0790, 14.4060], [50.0830, 14.4085], [50.0880, 14.4095]])],
                 vineyards=[dict(poly=[[50.0830, 14.4400], [50.0800, 14.4620], [50.0700, 14.4640], [50.0680, 14.4420], [50.0740, 14.4390]],
                                 why='the Royal Vineyards (Vinohrady) east of the New Town wall, approximate')],
                 gardens_inside=True),
  'leuthen': dict(title='Leuthen', place='Leuthen (Lutynia), 15 km west of Breslau, Silesia', center=[51.127, 16.770],
                  about='low rolling farmland west of Breslau; long villages; low rises (Butterberg, Sophienberg) and small woods; ponds at Gohlau',
                  atlas='leuthen_atlas.json'),
  'linz': dict(title='Linz', place='Linz on the Danube, Upper Austria: the town, the bridge and Urfahr', center=[48.302, 14.288],
               about='walled town on the south bank of the Danube under the castle hill; wooded heights north of the river; flat ground south and east',
               towns=[dict(name='Linz', lat=48.3053, lon=14.2862, r=330, why='walled town under the castle, about 0.6 km across'),
                      dict(name='Urfahr', lat=48.3098, lon=14.2855, r=170, why='market at the north end of the bridge')],
               drop_water=[dict(poly=[[1200, 600], [2970, 600], [2970, 1600], [1200, 1600]], why='The Linz harbour basins, 19th and 20th century')]),
}

# ---------------------------------------------------------------- geometry
def frame(c):
    lat0, lon0 = c; ky = 111200.0; kx = 111200.0 * math.cos(math.radians(lat0))
    to_en = lambda lat, lon: ((lon - lon0) * kx, (lat - lat0) * ky)
    to_ll = lambda e, n: (lat0 + n / ky, lon0 + e / kx)
    return to_en, to_ll, kx, ky

def blur(a, s):
    if s <= 0: return a
    r = max(1, int(3 * s)); k = np.exp(-0.5 * (np.arange(-r, r + 1) / s) ** 2); k /= k.sum()
    p = np.pad(a, r, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 1, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, 'valid'), 0, p)

def sample(grid, lat0, lon0, dlat, dlon, lats, lons, nearest=False):
    """grid[row, col] with row 0 at lat0 (north) and col 0 at lon0 (west); bilinear (or nearest) at lats/lons."""
    v = (lat0 - lats) / dlat - .5; u = (lons - lon0) / dlon - .5
    if nearest:
        return grid[np.clip(np.round(v).astype(int), 0, grid.shape[0] - 1), np.clip(np.round(u).astype(int), 0, grid.shape[1] - 1)]
    i = np.clip(np.floor(u).astype(int), 0, grid.shape[1] - 2); j = np.clip(np.floor(v).astype(int), 0, grid.shape[0] - 2)
    fu = np.clip(u - i, 0, 1); fv = np.clip(v - j, 0, 1)
    return (grid[j, i] * (1 - fu) + grid[j, i + 1] * fu) * (1 - fv) + (grid[j + 1, i] * (1 - fu) + grid[j + 1, i + 1] * fu) * fv

def enc16(a):
    mn = float(a.min()); q = np.clip(np.round((a - mn) * 10), 0, 65535).astype('<u2')
    return mn, base64.b64encode(q.tobytes()).decode()

# ---------------------------------------------------------------- downloads
def curl(url, rng=None):
    args = ['curl', '-s', '--fail', '--retry', '4', '--max-time', '120']
    if rng: args += ['-r', f'{rng[0]}-{rng[1]}']
    r = subprocess.run(args + [url], capture_output=True)
    if r.returncode: raise SystemExit(f'download failed ({r.returncode}): {url}')
    return r.stdout

def dem(W, S_, E, N, Z):
    """Terrarium mosaic for the bbox at zoom Z: (array, lat_top, lon_left, dlat_px, dlon_px) in Web Mercator rows."""
    n = 2 ** Z
    tx = lambda lon: (lon + 180) / 360 * n
    ty = lambda lat: (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    x0, x1, y0, y1 = int(tx(W)), int(tx(E)), int(ty(N)), int(ty(S_))
    M = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            f = CACHE / f'terrarium_{Z}_{x}_{y}.png'
            if not f.exists(): f.write_bytes(curl(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'))
            a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
            M[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    def at(lats, lons):  # bilinear in mercator pixel space
        u = ((lons + 180) / 360 * n - x0) * 256 - .5
        v = ((1 - np.arcsinh(np.tan(np.radians(lats))) / np.pi) / 2 * n - y0) * 256 - .5
        i = np.clip(np.floor(u).astype(int), 0, M.shape[1] - 2); j = np.clip(np.floor(v).astype(int), 0, M.shape[0] - 2)
        fu = np.clip(u - i, 0, 1); fv = np.clip(v - j, 0, 1)
        return (M[j, i] * (1 - fu) + M[j, i + 1] * fu) * (1 - fv) + (M[j + 1, i] * (1 - fu) + M[j + 1, i + 1] * fu) * fv
    return at

_wc = {}
def worldcover(lats, lons):
    """ESA WorldCover 2021 class at each lat/lon (nearest 10 m pixel), read tile by tile through HTTP ranges."""
    import fsspec, tifffile
    out = np.zeros(lats.shape, np.uint8)
    la0 = np.floor(lats / 3) * 3; lo0 = np.floor(lons / 3) * 3
    for a, b in set(zip(la0.ravel().tolist(), lo0.ravel().tolist())):
        name = f"ESA_WorldCover_10m_2021_v200_{'N' if a >= 0 else 'S'}{abs(int(a)):02d}{'E' if b >= 0 else 'W'}{abs(int(b)):03d}_Map.tif"
        if name not in _wc:
            f = fsspec.filesystem('https', block_size=2 ** 16).open('https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/' + name, 'rb')
            p = tifffile.TiffFile(f).pages[0]; _wc[name] = (p, f, {})
        p, f, tiles = _wc[name]
        sel = (la0 == a) & (lo0 == b)
        r = np.clip(((a + 3 - lats[sel]) * 12000).astype(int), 0, 35999); c = np.clip(((lons[sel] - b) * 12000).astype(int), 0, 35999)
        tr, tc = r // 1024, c // 1024; vals = np.zeros(r.shape, np.uint8)
        for k in set(zip(tr.tolist(), tc.tolist())):
            idx = k[0] * 36 + k[1]
            if idx not in tiles:
                cf = CACHE / f'{name}_{idx}.npy'
                if cf.exists(): tiles[idx] = np.load(cf)
                else:
                    off, cnt = p.dataoffsets[idx], p.databytecounts[idx]
                    seg = p.decode(curl('https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/' + name, (off, off + cnt - 1)), idx)[0]
                    tiles[idx] = np.asarray(seg).reshape(1024, 1024); np.save(cf, tiles[idx])
            m = (tr == k[0]) & (tc == k[1]); vals[m] = tiles[idx][r[m] - k[0] * 1024, c[m] - k[1] * 1024]
        out[sel] = vals
    return out

def gazetteer(gid, c):
    """Village and town points near the ground from Overture Maps (divisions), cached in src/grounds_src/<id>.places.json."""
    f = SRC / f'{gid}.places.json'
    if f.exists(): return json.loads(f.read_text())
    import fsspec, pyarrow.parquet as pq
    lat0, lon0 = c; R, RL = .06, .09
    rel = curl('https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/&delimiter=/').decode()
    import re
    release = sorted(re.findall(r'<Prefix>release/([^<]+)/</Prefix>', rel))[-1]
    lst = curl(f'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/?list-type=2&prefix=release/{release}/theme=divisions/type=division/').decode()
    out = []
    for key in re.findall(r'<Key>([^<]+\.parquet)</Key>', lst):
        pf = pq.ParquetFile(fsspec.filesystem('https', block_size=2 ** 20).open('https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/' + key, 'rb'))
        md = pf.metadata; ix = {pf.schema.column(i).path: i for i in range(len(pf.schema))}
        for g in range(md.num_row_groups):
            st = lambda p: md.row_group(g).column(ix[p]).statistics
            if st('bbox.xmin').min > lon0 + RL or st('bbox.xmax').max < lon0 - RL or st('bbox.ymin').min > lat0 + R or st('bbox.ymax').max < lat0 - R: continue
            for r in pf.read_row_group(g, columns=['names', 'subtype', 'class', 'bbox']).to_pylist():
                b = r['bbox']; la = (b['ymin'] + b['ymax']) / 2; lo = (b['xmin'] + b['xmax']) / 2
                if abs(la - lat0) < R and abs(lo - lon0) < RL and r['subtype'] == 'locality':
                    n = r['names'] or {}; com = dict(n.get('common') or [])
                    out.append({'name': n.get('primary'), 'de': com.get('de'), 'class': r['class'], 'lat': round(la, 5), 'lon': round(lo, 5)})
    out = {'source': f'Overture Maps Foundation, divisions, release {release} (ODbL; includes OpenStreetMap data)', 'points': sorted(out, key=lambda p: (p['lat'], p['lon']))}
    f.write_text(json.dumps(out, ensure_ascii=False, indent=0)); return out

def in_poly(e, n, P):
    hit = False
    for i in range(len(P)):
        (x1, y1), (x2, y2) = P[i], P[i - 1]
        if (y1 > n) != (y2 > n) and e < (x2 - x1) * (n - y1) / (y2 - y1) + x1: hit = not hit
    return hit

# ---------------------------------------------------------------- relief
def fill_under(h, mask, mpp):
    """Replace heights under `mask` (canopy, buildings) by a smooth estimate from the open ground around (battle-atlas)."""
    if not mask.any(): return h
    w = (~mask).astype(float); est = None
    for s in (1200 / mpp, 600 / mpp, 250 / mpp):
        e = blur(np.where(mask, 0, h) * w, s) / np.maximum(blur(w, s), 1e-6); den = blur(w, s)
        est = e if est is None else np.where(den > .35, e, est)
    m2 = np.clip(blur(mask.astype(float), 60 / mpp) * 1.6, 0, 1)
    return h * (1 - m2) + np.where(mask, est, h) * m2

def grey_open(h, r):
    """Greyscale opening with a (2r+1)-post square: removes raised features narrower than the window (buildings, blocks),
    keeps hills wider than it."""
    def step(a, f):
        p = np.pad(a, 1, mode='edge'); out = a.copy()
        for dr in (0, 1, 2):
            for dc in (0, 1, 2): out = f(out, p[dr:dr + a.shape[0], dc:dc + a.shape[1]])
        return out
    for _ in range(r): h = step(h, np.minimum)
    for _ in range(r): h = step(h, np.maximum)
    return h

def poly_mask(shape, polys_px):
    im = Image.new('L', (shape[1], shape[0]), 0); d = ImageDraw.Draw(im)
    for p in polys_px: d.polygon([tuple(q) for q in p], fill=255)
    return np.asarray(im) > 0

# ---------------------------------------------------------------- streams
def streams(h, step, min_km2):
    """D8 flow over a priority-flooded surface; returns accumulation (km2) and downstream index per cell."""
    R, C = h.shape; z = h.astype(float).copy(); done = np.zeros(h.shape, bool); pq_ = []
    for r in range(R):
        for c in (0, C - 1): heapq.heappush(pq_, (z[r, c], r, c)); done[r, c] = True
    for c in range(1, C - 1):
        for r in (0, R - 1): heapq.heappush(pq_, (z[r, c], r, c)); done[r, c] = True
    order = []
    while pq_:
        v, r, c = heapq.heappop(pq_); order.append(r * C + c)
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                rr, cc = r + dr, c + dc
                if (dr or dc) and 0 <= rr < R and 0 <= cc < C and not done[rr, cc]:
                    done[rr, cc] = True; z[rr, cc] = max(z[rr, cc], v + 1e-3); heapq.heappush(pq_, (z[rr, cc], rr, cc))
    zf = z.ravel(); down = np.full(R * C, -1)
    for k in order:
        r, c = divmod(k, C); best, bd = -1, 0.0
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                rr, cc = r + dr, c + dc
                if (dr or dc) and 0 <= rr < R and 0 <= cc < C:
                    s = (zf[k] - zf[rr * C + cc]) / math.hypot(dr, dc)
                    if s > bd: bd, best = s, rr * C + cc
        down[k] = best
    acc = np.ones(R * C)
    for k in reversed(order):
        if down[k] >= 0: acc[down[k]] += acc[k]
    return acc * step * step / 1e6, down

def trace(acc, down, shape, min_km2):
    R, C = shape; on = acc >= min_km2; seen = np.zeros(R * C, bool); lines = []
    up = np.zeros(R * C, int)
    for k in np.nonzero(on)[0]:
        if down[k] >= 0 and on[down[k]]: up[down[k]] += 1
    for k in np.nonzero(on & (up == 0))[0]:
        line = [k]; seen[k] = True; j = k
        while down[j] >= 0:
            j = down[j]; line.append(j)
            if seen[j]: break
            seen[j] = True
        lines.append(line)
    return lines

def chaikin(p, n=2):
    for _ in range(n):
        if len(p) < 3: return p
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]): q += [(.75 * a[0] + .25 * b[0], .75 * a[1] + .25 * b[1]), (.25 * a[0] + .75 * b[0], .25 * a[1] + .75 * b[1])]
        p = q + [p[-1]]
    return p

# ---------------------------------------------------------------- one ground
def build(gid):
    G = GROUNDS[gid]; c = G['center']; to_en, to_ll, kx, ky = frame(c); notes = []
    lat0, lon0 = c
    # cell centres and grid nodes of the field
    ce = -W_M / 2 + (np.arange(COLS) + .5) * CELL; cn = H_M / 2 - (np.arange(ROWS) + .5) * CELL
    E_, N_ = np.meshgrid(ce, cn); cl_lat, cl_lon = lat0 + N_ / ky, lon0 + E_ / kx
    ne = -W_M / 2 + np.arange(COLS + 1) * CELL; nn = H_M / 2 - np.arange(ROWS + 1) * CELL
    NE, NN = np.meshgrid(ne, nn); nd_lat, nd_lon = lat0 + NN / ky, lon0 + NE / kx
    # 10 m land cover of the field: 3 x 3 samples per cell
    fe = -W_M / 2 + (np.arange(COLS * 3) + .5) * 10; fn = H_M / 2 - (np.arange(ROWS * 3) + .5) * 10
    FE, FN = np.meshgrid(fe, fn); wc = worldcover(lat0 + FN / ky, lon0 + FE / kx)
    frac = lambda cls: np.isin(wc, cls).reshape(ROWS, 3, COLS, 3).mean(axis=(1, 3))
    tree, water, wet, built = frac([10]), frac([80]), frac([90]), frac([50])
    # relief: Terrarium z13 at 10 m posts over the field plus 1.2 km, canopy and buildings filled, then cut to the nodes
    M = 1200; pe = np.arange(-W_M / 2 - M, W_M / 2 + M + 1, 10.0); pn = np.arange(H_M / 2 + M, -H_M / 2 - M - 1, -10.0)
    PE, PN = np.meshgrid(pe, pn); P_lat, P_lon = lat0 + PN / ky, lon0 + PE / kx
    at13 = dem(lon0 - (W_M / 2 + M) / kx, lat0 - (H_M / 2 + M) / ky, lon0 + (W_M / 2 + M) / kx, lat0 + (H_M / 2 + M) / ky, 13)
    h = at13(P_lat, P_lon); wcp = worldcover(P_lat, P_lon)
    # buildings: an opening of 150 m over anywhere with built-up cells near (keeps castle hills, drops blocks and halls)
    urb = blur((wcp == 50).astype(float), 6) > .04
    h = np.where(urb, h * (1 - blur(urb.astype(float), 3)) + blur(grey_open(blur(h, .7), 7), 4) * blur(urb.astype(float), 3), h)
    mask = blur((wcp == 10).astype(float), 2) > .25
    A = G.get('atlas') and json.loads((SRC / G['atlas']).read_text())
    if A:
        for m in A['relief_masks']:
            if 'poly' in m:
                pm = poly_mask(h.shape, [[(((lo - lon0) * kx + W_M / 2 + M) / 10, (H_M / 2 + M - (la - lat0) * ky) / 10) for la, lo in m['poly']]])
                mask |= blur(pm.astype(float), m.get('buffer_m', 60) / 20) > .08
    h = fill_under(h, mask, 10.0)
    h = blur(h, 1.0)
    inner = sample(h, H_M / 2 + M + 5, -W_M / 2 - M - 5, 10.0, 10.0, NN, NE)  # metric 'lat/lon' = n/e here
    notes.append('Relief: Terrarium (surface model) with woods and buildings filled from the fields around them.')
    # the country around: z11 relief and 200 m cover out to 12.6 km
    oe = np.arange(-OUTER_HALF, OUTER_HALF + 1, OUTER_STEP, dtype=float); on = oe[::-1].copy()
    OE, ON = np.meshgrid(oe, on); O_lat, O_lon = lat0 + ON / ky, lon0 + OE / kx
    at11 = dem(lon0 - (OUTER_HALF + 400) / kx, lat0 - (OUTER_HALF + 400) / ky, lon0 + (OUTER_HALF + 400) / kx, lat0 + (OUTER_HALF + 400) / ky, 11)
    sub = [(-60, -60), (60, -60), (-60, 60), (60, 60), (0, 0)]
    oc = np.stack([worldcover(lat0 + (ON + dn) / ky, lon0 + (OE + de) / kx) for de, dn in sub])
    otree = np.isin(oc, [10]).mean(0); owater = np.isin(oc, [80]).mean(0); obuilt = np.isin(oc, [50]).mean(0)
    hO = at11(O_lat, O_lon)
    hO = np.where(otree > .5, np.nan, hO)
    if np.isnan(hO).any():  # canopy out of the outer relief as well
        m = np.isnan(hO); hO = fill_under(np.where(m, np.nanmean(hO), hO), m, OUTER_STEP)
    hO = np.where(obuilt > .2, grey_open(hO, 1), hO); hO = blur(hO, .7)
    # tie the outer surface to the inner one where they overlap, so the field sits level in its country
    io_ = (np.abs(OE) < W_M / 2) & (np.abs(ON) < H_M / 2)
    hO += float(np.median(sample(h, H_M / 2 + M + 5, -W_M / 2 - M - 5, 10.0, 10.0, ON[io_], OE[io_]) - hO[io_]))
    ocover = np.full(hO.shape, '0', dtype='<U1'); ocover[otree >= .6] = '1'; ocover[obuilt >= .6] = '3'; ocover[owater >= .6] = '2'
    # land cover of the field
    grid = np.full((ROWS, COLS), '0', dtype='<U1'); villages = []; rivers = []; roads = []; places_src = None
    grid[tree >= .5] = '1'; grid[wet >= .4] = '4'; grid[water >= .4] = '2'
    for dw in G.get('drop_water', []):   # modern reservoirs and harbours, in metres from the centre: meadow in 1740
        P = dw['poly']; m_ = np.vectorize(lambda e, n: in_poly(e, n, P))(E_, N_); grid[m_ & np.isin(grid, ['2', '4'])] = '0'
        notes.append(dw['why'] + ' (removed).')
    if G.get('base') == 'mollwitz':
        T = json.loads((S / 'battle_terrain.json').read_text())
        assert (T['cols'], T['rows'], T['cell']) == (COLS, ROWS, CELL)
        # the original grid was stored south-up: flipped, its woods fall on today's woods (2244 of 2470 cells) and its
        # villages on today's villages; as stored, 116 of 2470. It is turned the right way up here.
        grid = np.array([list(r) for r in T['rows_str']])[::-1].copy()
        band = grid[23:87, 25:141]; band[band == '3'] = '0'   # Mollwitz and the hamlets between the lines cleared (game decision)
        notes.append('Land cover: the game\'s original OSM grid, turned north-up; the villages between the lines are cleared (game decision).')
        BD = json.loads((S / 'battle_data.json').read_text())
        for kind, pts in BD['streams']:
            if len(pts) > 2: rivers.append({'kind': kind, 'w': 3 if kind == 'canal' else 1.5, 'p': [[round(v, 1) for v in to_en(la, lo)] for lo, la in pts], 'src': 'OSM (battle_data.json)'})
    else:
        notes.append('Woods, water and marsh: ESA WorldCover 2021, today\'s cover. Woods under 1.5 ha are dropped as orchards and hedgerows.')
        # drop specks of wood (orchards, tree rows) under 1.5 ha
        g1 = grid == '1'; lab = label(g1)
        for k, n in zip(*np.unique(lab[g1], return_counts=True)):
            if n < 17: grid[lab == k] = '0'
    # villages and towns
    gz = gazetteer(gid, c); places_src = gz['source']
    pts = []
    if A:
        for name, v in A['places'].items(): pts.append({'name': name, 'lat': v[0], 'lon': v[1], 'src': 'battle-atlas (period plans)'})
    else:
        for p in gz['points']:
            e_, n_ = to_en(p['lat'], p['lon'])
            if any(math.hypot(e_ - t_['e'], n_ - t_['n']) < t_['r'] + 300 for t_ in [dict(t, e=to_en(t['lat'], t['lon'])[0], n=to_en(t['lat'], t['lon'])[1]) for t in G.get('towns', [])]) \
               or any(in_poly(e_, n_, [to_en(*q) for q in t['poly']]) for t in G.get('town_polys', [])): continue
            pts.append({'name': p['de'] or p['name'], 'modern': p['name'], 'lat': p['lat'], 'lon': p['lon'], 'src': 'Overture Maps' + (' (German name)' if p['de'] else '')})
    towns = [dict(t, e=to_en(t['lat'], t['lon'])[0], n=to_en(t['lat'], t['lon'])[1]) for t in G.get('towns', [])]
    tpolys = [dict(t, en=[to_en(*q) for q in t['poly']]) for t in G.get('town_polys', [])]
    in_town = np.zeros((ROWS, COLS), bool)
    for t in towns: in_town |= np.hypot(E_ - t['e'], N_ - t['n']) <= t['r']
    for t in tpolys: in_town |= np.vectorize(lambda e, n: in_poly(e, n, t['en']))(E_, N_)
    if G.get('base') != 'mollwitz':
        bc = built >= .34
        # each village keeps the built cells within 650 m of its gazetteer point that are joined to that point
        keep = np.zeros_like(bc); lab = label(bc)
        town_lim = [(t['e'], t['n'], t['r'] + 900) for t in towns] + [(np.mean([q[0] for q in t['en']]), np.mean([q[1] for q in t['en']]), 2600) for t in tpolys]
        for p in pts:
            e, n = to_en(p['lat'], p['lon'])
            if any(math.hypot(e - a, n - b) < r for a, b, r in town_lim): continue   # suburbs of a town: fields in 1740
            # a village swallowed by today's town keeps only its old core (300 m); a free-standing one its whole street
            rr_, cc_ = int(np.clip((H_M / 2 - n) // CELL, 0, ROWS - 1)), int(np.clip((e + W_M / 2) // CELL, 0, COLS - 1))
            near = (np.hypot(E_ - e, N_ - n) <= (300 if blur(built, 25)[rr_, cc_] > .3 else 650))
            ids = set(lab[near & bc].tolist()) - {0}
            # the components nearest the point (within 250 m) count as the village
            close = set(lab[(np.hypot(E_ - e, N_ - n) <= 250) & bc].tolist()) - {0}
            for k in close: keep |= (lab == k) & near
        # today's towns are much larger than in 1740: inside dense modern built-up, park trees and wet patches were
        # fields, gardens and glacis then
        urban = blur(built, 6) > .3
        grid[urban & ~keep & np.isin(grid, ['1', '4'])] = '0'
        grid[keep & (grid != '2')] = '3'
        grid[in_town & (grid != '2')] = '3'
        if G.get('gardens_inside'): pass
        for v in G.get('vineyards', []):
            P = [to_en(*q) for q in v['poly']]; vm = np.vectorize(lambda e, n: in_poly(e, n, P))(E_, N_)
            grid[vm & (grid != '2') & (grid != '3')] = '5'
            notes.append('Vineyards: ' + v['why'] + ' (inferred).')
        if A:  # the atlas's period woods replace today's
            grid[grid == '1'] = '0'
            for la, lo, rx, ry in A['woods']:
                e, n = to_en(la, lo); grid[((E_ - e) / rx) ** 2 + ((N_ - n) / ry) ** 2 <= 1] = '1'
            for poly in A['water'].get('lakes', []):
                P = [to_en(*q) for q in poly]; grid[np.vectorize(lambda e, n: in_poly(e, n, P))(E_, N_)] = '2'
            for rv in A['water'].get('rivers', []):
                rivers.append({'w': max(2, rv.get('w', 2) * 4), 'p': [[round(v, 1) for v in to_en(*q)] for q in rv['p']], 'src': 'battle-atlas (period plans)'})
            for rd in A['roads']:
                P = [to_en(*(q if isinstance(q, list) else A['places'][q][:2])) for q in rd]
                roads.append({'p': [[round(a, 1), round(b, 1)] for a, b in P], 'src': 'battle-atlas (period plans)'})
            notes.append('Woods, ponds, the Weistritz, villages and roads: battle-atlas, from the Prussian General Staff plans and period maps.')
        notes.append('Villages: today\'s built-up cells (WorldCover) joined to a gazetteer point; their 1740 extent may differ.')
        for t in towns: notes.append(f"{t['name']}: {t['why']} (inferred extent).")
        for t in tpolys: notes.append(f"{t['name']}: {t['why']} (inferred).")
    # streams traced from the relief over the field and 4 km around it (45 m cells), for drawing and the grid
    if G.get('base') != 'mollwitz' and not A:
        st = 45.0; RM = 4000
        se = np.arange(-W_M / 2 - RM, W_M / 2 + RM, st); sn = np.arange(H_M / 2 + RM, -H_M / 2 - RM, -st)
        SE, SN = np.meshgrid(se, sn); S_lat, S_lon = lat0 + SN / ky, lon0 + SE / kx
        at12 = dem(lon0 - (W_M / 2 + RM + 200) / kx, lat0 - (H_M / 2 + RM + 200) / ky, lon0 + (W_M / 2 + RM + 200) / kx, lat0 + (H_M / 2 + RM + 200) / ky, 12)
        hs = at12(S_lat, S_lon); sc = worldcover(S_lat, S_lon)
        hs = fill_under(hs, blur((sc == 10).astype(float), 1) > .25, st)
        hs = np.where(blur((sc == 50).astype(float), 2) > .04, grey_open(hs, 2), hs)
        s_urban = blur((sc == 50).astype(float), 4) > .3   # traced courses are meaningless across a levelled town
        hs = np.where(sc == 80, hs - 3, hs)  # rivers and ponds already mapped: let the flow find them
        acc, down = streams(blur(hs, .8), st, 0)
        for line in trace(acc, down, hs.shape, 6.0):
            pts_ = []
            for k in line:
                r, cc = divmod(k, hs.shape[1]); e, n = se[cc], sn[r]
                inside = abs(e) < W_M / 2 + 150 and abs(n) < H_M / 2 + 150
                if inside and sc[r, cc] != 80 and not s_urban[r, cc]: pts_.append((float(e), float(n), float(acc[k])))
                elif len(pts_) > 3: rivers.append(pts_); pts_ = []
                else: pts_ = []
            if len(pts_) > 3: rivers.append(pts_)
        rv2 = []
        for p in rivers:
            if isinstance(p, dict): rv2.append(p); continue
            a = max(q[2] for q in p); sm = chaikin([(q[0], q[1]) for q in p])
            rv2.append({'w': round(min(8, 1.5 + .6 * math.sqrt(a)), 1), 'km2': round(a, 1), 'p': [[round(x, 1), round(y, 1)] for x, y in sm[::2] + [sm[-1]]], 'src': 'traced from the relief'})
        rivers = rv2
        notes.append('Brooks: traced from the relief (catchment over 6 km2), not from a map; their courses are approximate.')
    # brooks and rivers into the grid: a 30 m cell of water where a course passes (crossing slows a march)
    for rv in (rivers if G.get('base') != 'mollwitz' else []):   # Mollwitz keeps its grid exactly
        p = rv['p']
        for (x1, y1), (x2, y2) in zip(p[:-1], p[1:]):
            k = max(1, int(math.hypot(x2 - x1, y2 - y1) / 10))
            for i in range(k + 1):
                x, y = x1 + (x2 - x1) * i / k, y1 + (y2 - y1) * i / k
                cc, rr = int((x + W_M / 2) // CELL), int((H_M / 2 - y) // CELL)
                if 0 <= rr < ROWS and 0 <= cc < COLS and grid[rr, cc] in '014': grid[rr, cc] = '2'
    # names: each point inside the field that has village cells within 300 m
    seen = set()
    for p in pts:
        e, n = to_en(p['lat'], p['lon'])
        if abs(e) > W_M / 2 or abs(n) > H_M / 2: continue
        rr, cc = int((H_M / 2 - n) // CELL), int((e + W_M / 2) // CELL)
        win = grid[max(0, rr - 10):rr + 11, max(0, cc - 10):cc + 11]
        if (win == '3').sum() < 3 or p['name'] in seen or any(math.hypot(e - v['e'], n - v['n']) < 200 for v in villages): continue
        seen.add(p['name']); v = {'name': p['name'], 'e': round(e, 1), 'n': round(n, 1), 'src': p['src']}
        if p.get('modern') and p['modern'] != p['name']: v['modern'] = p['modern']
        villages.append(v)
    for t in towns + tpolys:
        e, n = (t['e'], t['n']) if 'e' in t else (np.mean([q[0] for q in t['en']]), np.mean([q[1] for q in t['en']]))
        if abs(e) < W_M / 2 and abs(n) < H_M / 2 and t['name'] not in seen: villages.append({'name': t['name'], 'e': round(float(e), 1), 'n': round(float(n), 1), 'town': True, 'src': 'inferred extent'})
    if A:
        for name, v in A['hills'].items():
            e, n = to_en(*v)
            if abs(e) < W_M / 2 and abs(n) < H_M / 2: villages.append({'name': name, 'e': round(e, 1), 'n': round(n, 1), 'hill': True, 'src': 'battle-atlas'})
    imn, ib64 = enc16(inner); omn, ob64 = enc16(hO)
    g = {'id': gid, 'title': G['title'], 'place': G['place'], 'center': c, 'about': G['about'],
         'cell': CELL, 'cols': COLS, 'rows': ROWS, 'w': W_M, 'h': H_M, 'legend': LEGEND, 'rows_str': [''.join(r) for r in grid],
         'relief': {'cols': COLS + 1, 'rows': ROWS + 1, 'step': CELL, 'min': round(imn, 2), 'max': round(float(inner.max()), 2), 'b64': ib64},
         'outer': {'half': OUTER_HALF, 'step': OUTER_STEP, 'cols': len(oe), 'rows': len(on), 'min': round(omn, 2), 'b64': ob64, 'cover': [''.join(r) for r in ocover]},
         'rivers': rivers, 'roads': roads, 'places': villages, 'notes': notes,
         'sources': ['Relief: AWS Terrain Tiles (Terrarium; Mapzen, EU-DEM, SRTM)', 'Land cover: ESA WorldCover 10 m 2021 v200 (CC BY 4.0)', 'Places: ' + (places_src or '')] + (['Scenery: ' + A['from']] if A else [])}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{gid}.json').write_text(json.dumps(g, ensure_ascii=False, separators=(',', ':')))
    preview(g)
    from collections import Counter
    print(gid, f"{(OUT / f'{gid}.json').stat().st_size // 1024} KB", dict(Counter(''.join(g['rows_str']))), f"relief {imn:.0f}-{inner.max():.0f} m", len(rivers), 'courses', len(villages), 'names')

def label(m):
    """4-connected components of a boolean grid (0 = background)."""
    lab = np.zeros(m.shape, int); n = 0; R, C = m.shape
    for r0, c0 in zip(*np.nonzero(m)):
        if lab[r0, c0]: continue
        n += 1; st = [(r0, c0)]; lab[r0, c0] = n
        while st:
            r, c = st.pop()
            for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= rr < R and 0 <= cc < C and m[rr, cc] and not lab[rr, cc]: lab[rr, cc] = n; st.append((rr, cc))
    return lab

def preview(g):
    """src/.ground_cache/<id>.png: hillshade, land cover, courses and names (for checking a ground by eye)."""
    R = np.frombuffer(base64.b64decode(g['relief']['b64']), '<u2').reshape(g['relief']['rows'], g['relief']['cols']) / 10.0
    R = R[:-1, :-1]; gy, gx = np.gradient(R, CELL); sh = np.clip(.75 + (-gx - gy) * 6, .35, 1.15)
    pal = {'0': (196, 188, 140), '1': (78, 101, 50), '2': (92, 130, 150), '3': (160, 90, 70), '4': (120, 140, 110), '5': (150, 110, 140)}
    img = np.array([[pal[ch] for ch in row] for row in g['rows_str']], float) * sh[..., None]
    t = (R - R.min()) / max(1, np.ptp(R)); img *= (.85 + .3 * t)[..., None]
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((COLS * 5, ROWS * 5), Image.NEAREST); d = ImageDraw.Draw(im)
    px = lambda e, n: ((e + W_M / 2) / CELL * 5, (H_M / 2 - n) / CELL * 5)
    for rv in g['rivers']: d.line([px(*q) for q in rv['p']], fill=(40, 80, 200), width=2)
    for rd in g['roads']: d.line([px(*q) for q in rd['p']], fill=(120, 80, 40), width=1)
    for p in g['places']: x, y = px(p['e'], p['n']); d.text((x + 3, y - 5), p['name'], fill=(0, 0, 0)); d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(0, 0, 0))
    for k in range(-5, 6):
        x, _ = px(k * 500, 0); _, y = px(0, k * 500)
        d.line([(x, 0), (x, 4)], fill=(0, 0, 0)); d.text((x + 1, 4), f'{k * 500}', fill=(60, 60, 60))
        d.line([(0, y), (4, y)], fill=(0, 0, 0)); d.text((5, y - 5), f'{k * 500}', fill=(60, 60, 60))
    d.text((6, 6), f"{g['title']}  relief {g['relief']['min']:.0f}-{g['relief']['max']:.0f} m", fill=(0, 0, 0))
    im.save(CACHE / f"{g['id']}.png")

def index():
    items = []
    for gid, G in GROUNDS.items():
        f = OUT / f'{gid}.json'
        if f.exists(): items.append({'id': gid, 'title': G['title'], 'place': G['place'], 'center': G['center'], 'about': G['about']})
    (OUT / 'index.json').write_text(json.dumps({'grounds': items, 'kinds': KINDS}, ensure_ascii=False, indent=1))

# kinds of ground the page lays out itself, on live relief, for a field not in the library (w3d/ground.js)
KINDS = {'open plain': 'level farmland, a few copses', 'river crossing': 'a river across the field along its lowest line, a village at the crossing',
         'vineyards': 'terraced vines on the sunny slopes', 'marsh': 'wet meadow and reed in the low ground, a brook through it',
         'wooded hills': 'woods over the higher and steeper ground'}

if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True); SRC.mkdir(exist_ok=True)
    for gid in (sys.argv[1:] or list(GROUNDS)): build(gid)
    index()

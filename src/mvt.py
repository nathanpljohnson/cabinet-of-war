import gzip
import struct


def _varint(b, i):
    r = 0
    s = 0
    while True:
        c = b[i]
        i += 1
        r |= (c & 0x7F) << s
        if not c & 0x80:
            return r, i
        s += 7


def _fields(b):
    i = 0
    n = len(b)
    while i < n:
        key, i = _varint(b, i)
        f, w = key >> 3, key & 7
        if w == 0:
            v, i = _varint(b, i)
        elif w == 2:
            ln, i = _varint(b, i)
            v = b[i:i + ln]
            i += ln
        elif w == 1:
            v = b[i:i + 8]
            i += 8
        elif w == 5:
            v = b[i:i + 4]
            i += 4
        else:
            raise ValueError("bad wire type %d" % w)
        yield f, w, v


def _packed(b):
    i = 0
    out = []
    while i < len(b):
        v, i = _varint(b, i)
        out.append(v)
    return out


def _zz(n):
    return (n >> 1) ^ -(n & 1)


def _value(b):
    for f, w, v in _fields(b):
        if f == 1:
            return v.decode("utf-8", "replace")
        if f == 2:
            return struct.unpack("<f", v)[0]
        if f == 3:
            return struct.unpack("<d", v)[0]
        if f == 4:
            return v - (1 << 64) if v >= 1 << 63 else v
        if f == 5:
            return v
        if f == 6:
            return _zz(v)
        if f == 7:
            return bool(v)
    return None


def _area(r):
    s = 0
    for k in range(len(r)):
        x1, y1 = r[k]
        x2, y2 = r[(k + 1) % len(r)]
        s += x1 * y2 - x2 * y1
    return s / 2


def _geom(cmds, gtype):
    parts = []
    cur = None
    x = y = 0
    i = 0
    while i < len(cmds):
        c = cmds[i]
        i += 1
        cid, cnt = c & 7, c >> 3
        if cid == 7:
            continue
        for _ in range(cnt):
            x += _zz(cmds[i])
            y += _zz(cmds[i + 1])
            i += 2
            if cid == 1:
                cur = [(x, y)]
                parts.append(cur)
            else:
                cur.append((x, y))
    if gtype == 1:
        return [p[0] for p in parts]
    if gtype == 2:
        return parts
    polys = []
    for r in parts:
        if len(r) < 3:
            continue
        a = _area(r)
        if a == 0:
            continue
        if a > 0 or not polys:
            polys.append([r])
        else:
            polys[-1].append(r)
    return polys


def _layer(b):
    name = ""
    extent = 4096
    keys = []
    vals = []
    feats = []
    for f, w, v in _fields(b):
        if f == 1:
            name = v.decode()
        elif f == 2:
            feats.append(v)
        elif f == 3:
            keys.append(v.decode())
        elif f == 4:
            vals.append(_value(v))
        elif f == 5:
            extent = v
    out = []
    for fb in feats:
        tags = []
        gtype = 0
        cmds = []
        for f, w, v in _fields(fb):
            if f == 2:
                tags = _packed(v) if w == 2 else tags + [v]
            elif f == 3:
                gtype = v
            elif f == 4:
                cmds = _packed(v) if w == 2 else cmds + [v]
        props = {keys[tags[k]]: vals[tags[k + 1]] for k in range(0, len(tags) - 1, 2)}
        out.append({"type": gtype, "props": props, "geom": _geom(cmds, gtype)})
    return name, {"extent": extent, "features": out}


def decode(data):
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    res = {}
    for f, w, v in _fields(data):
        if f == 3:
            n, l = _layer(v)
            res[n] = l
    return res


if __name__ == "__main__":
    import sys
    from collections import defaultdict
    for p in sys.argv[1:]:
        t = decode(open(p, "rb").read())
        print(p)
        for n, l in t.items():
            print("  %-18s %6d features" % (n, len(l["features"])))
        for n in ("landcover", "landuse", "water", "waterway"):
            if n in t:
                print("  %s class:" % n, sorted({f["props"].get("class") for f in t[n]["features"]}, key=str))

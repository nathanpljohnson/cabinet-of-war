"""Drop animation clips the game never plays from the .glb files in w3d/assets and repack their binary buffer.
usage: python3 src/slim_glb.py   (run from the repo root; safe to re-run)
Clip names are matched against KEEP; add a name here before playing a new clip in code."""
import json
import struct
from pathlib import Path

KEEP = {
    'ual1_standard.glb': {'Fixing_Kneeling', 'Idle_Loop', 'Idle_Talking_Loop', 'Idle_Torch_Loop', 'Jog_Fwd_Loop',
                          'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Walk_Formal_Loop', 'Walk_Loop'},
    # makeAnimal skips clip names containing '|', so those copies are never used
    'horse_bay.glb': {'Eating', 'Gallop', 'Walk', 'Idle_Headlow', 'Idle_2', 'Idle'},
    'horse_white.glb': {'Eating', 'Gallop', 'Walk', 'Idle_Headlow', 'Idle_2', 'Idle'},
    'shibainu.glb': {'Eating', 'Gallop', 'Walk', 'Idle_2', 'Idle'},
}


def read_glb(path):
    b = path.read_bytes()
    jlen = struct.unpack_from('<I', b, 12)[0]
    gltf = json.loads(b[20:20 + jlen])
    blen = struct.unpack_from('<I', b, 20 + jlen)[0]
    return gltf, b[28 + jlen:28 + jlen + blen]


def write_glb(path, gltf, binary):
    j = json.dumps(gltf, separators=(',', ':')).encode()
    j += b' ' * (-len(j) % 4)
    binary += b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(j) + 8 + len(binary)
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(j), b'JSON') + j
                     + struct.pack('<I4s', len(binary), b'BIN\0') + binary)


def slim(gltf, binary, keep):
    assert len(gltf.get('buffers', [])) == 1, 'expects one embedded buffer'
    gltf['animations'] = [a for a in gltf.get('animations', []) if a['name'] in keep]

    used_acc = set()
    for m in gltf.get('meshes', []):
        for p in m['primitives']:
            used_acc.update(p['attributes'].values())
            if 'indices' in p:
                used_acc.add(p['indices'])
            for t in p.get('targets', []):
                used_acc.update(t.values())
    for s in gltf.get('skins', []):
        if 'inverseBindMatrices' in s:
            used_acc.add(s['inverseBindMatrices'])
    for a in gltf['animations']:
        for s in a['samplers']:
            used_acc.update((s['input'], s['output']))
    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}

    accessors = [gltf['accessors'][i] for i in sorted(used_acc)]
    used_bv = {a['bufferView'] for a in accessors if 'bufferView' in a}
    for a in accessors:
        if 'sparse' in a:
            used_bv.update((a['sparse']['indices']['bufferView'], a['sparse']['values']['bufferView']))
    used_bv.update(i['bufferView'] for i in gltf.get('images', []) if 'bufferView' in i)

    out, bv_map, views = bytearray(), {}, []
    for new, old in enumerate(sorted(used_bv)):
        v = dict(gltf['bufferViews'][old])
        out += b'\0' * (-len(out) % 8)
        start = v.get('byteOffset', 0)
        chunk = binary[start:start + v['byteLength']]
        v['byteOffset'] = len(out)
        out += chunk
        views.append(v)
        bv_map[old] = new

    for a in accessors:
        if 'bufferView' in a:
            a['bufferView'] = bv_map[a['bufferView']]
        if 'sparse' in a:
            a['sparse']['indices']['bufferView'] = bv_map[a['sparse']['indices']['bufferView']]
            a['sparse']['values']['bufferView'] = bv_map[a['sparse']['values']['bufferView']]
    for i in gltf.get('images', []):
        if 'bufferView' in i:
            i['bufferView'] = bv_map[i['bufferView']]
    for m in gltf.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = acc_map[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
    for s in gltf.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
    for a in gltf['animations']:
        for s in a['samplers']:
            s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]

    gltf['accessors'], gltf['bufferViews'] = accessors, views
    gltf['buffers'][0]['byteLength'] = len(out)
    return gltf, bytes(out)


if __name__ == '__main__':
    assets = Path(__file__).resolve().parent.parent / 'w3d' / 'assets'
    for name, keep in KEEP.items():
        path = assets / name
        gltf, binary = read_glb(path)
        missing = keep - {a['name'] for a in gltf.get('animations', [])}
        assert not missing, f'{name}: clips not in file: {missing}'
        before = path.stat().st_size
        write_glb(path, *slim(gltf, binary, keep))
        print(f'{name}: {before // 1024} KB -> {path.stat().st_size // 1024} KB')

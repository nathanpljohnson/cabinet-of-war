import sys,json,math
sys.path.insert(0,'../vt')
import mvt
from pathlib import Path
Z=14;ext_cache={}
def ll(tx,ty,x,y,ext):
    n=2**Z;fx=(tx+x/ext)/n;fy=(ty+y/ext)/n
    return round(fx*360-180,5),round(math.degrees(math.atan(math.sinh(math.pi*(1-2*fy)))),5)
streams=[];smoke=[];seen=set()
for p in sorted(Path('../vt/tiles/14').rglob('*.pbf')):
    if p.stat().st_size==0:continue
    ty=int(p.stem);tx=int(p.parent.name)
    d=mvt.decode(p.read_bytes())
    for f in d.get('waterway',{}).get('features',[]):
        if f['type']!=2:continue
        for line in f['geom']:
            streams.append([f['props'].get('class','stream'),[ll(tx,ty,x,y,d['waterway']['extent']) for x,y in line[::2] or line]])
    ext=d.get('building',{}).get('extent',4096);k=0
    for f in d.get('building',{}).get('features',[]):
        if f['type']!=3:continue
        for poly in f['geom']:
            r=poly[0];xs=[q[0] for q in r];ys=[q[1] for q in r]
            if (max(xs)-min(xs))*40075016*abs(math.cos(math.radians(50.85)))/(2**Z*ext)>55:continue
            k+=1
            if k%6!=0:continue
            c=ll(tx,ty,sum(xs)/len(xs),sum(ys)/len(ys),ext)
            key=(round(c[0],4),round(c[1],4))
            if key in seen:continue
            seen.add(key);smoke.append(list(c))
json.dump({'streams':streams,'smoke':smoke},open('battle_data.json','w'),separators=(',',':'))
print(len(streams),len(smoke))

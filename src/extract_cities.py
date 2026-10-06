import sys,json,math
sys.path.insert(0,'../vt');sys.path.insert(0,'.')
import mvt
from pathlib import Path
from cities import CITIES
Z=14;n=2**Z
def tile(lon,lat):return int((lon+180)/360*n),int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n)
def ll(tx,ty,x,y,ext):
    fx=(tx+x/ext)/n;fy=(ty+y/ext)/n
    return fx*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*fy))))
out=Path('../../outputs/cities');tot=0
for cid,(lat,lon,name) in CITIES.items():
    dl,dt=0.022,0.015
    xa,yb=tile(lon-dl,lat-dt);xb,ya=tile(lon+dl,lat+dt)
    bl=[]
    for tx in range(xa,xb+1):
        for ty in range(ya,yb+1):
            p=Path(f'../vt/tiles/14/{tx}/{ty}.pbf')
            if not p.exists() or p.stat().st_size==0:continue
            d=mvt.decode(p.read_bytes());L=d.get('building')
            if not L:continue
            for f in L['features']:
                if f['type']!=3:continue
                h=f['props'].get('render_height',8) or 8;mh=f['props'].get('render_min_height',0) or 0
                for poly in f['geom']:
                    r=poly[0]
                    pts=[ll(tx,ty,x,y,L['extent']) for x,y in r]
                    if not any(lon-dl<=q[0]<=lon+dl and lat-dt<=q[1]<=lat+dt for q in pts):continue
                    kx=111320*math.cos(math.radians(lat));ky=111320
                    ar=abs(sum((pts[i-1][0]*pts[i][1]-pts[i][0]*pts[i-1][1]) for i in range(len(pts))))/2*kx*ky
                    if ar>1800 or ar<18:continue
                    if len(pts)>12:pts=pts[::max(1,len(pts)//10)]
                    h=min(max(h,7),18) if h<24 else min(h,40)
                    flat=[]
                    for q in pts:flat+= [round(q[0],5),round(q[1],5)]
                    bl.append([int(h),0,flat])
    json.dump({'c':[lat,lon],'name':name,'b':bl},open(out/f'{cid}.json','w'),separators=(',',':'))
    tot+=len(bl);print(cid,len(bl),(out/f'{cid}.json').stat().st_size//1024,'KB')

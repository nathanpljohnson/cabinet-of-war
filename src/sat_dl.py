import math,subprocess,sys,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
def tile(z,lon,lat):
    n=2**z;return int((lon+180)/360*n),int((1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n)
def run(z,lon0,lon1,lat0,lat1):
    xa,yb=tile(z,lon0,lat0);xb,ya=tile(z,lon1,lat1)
    ts=[(x,y) for x in range(xa,xb+1) for y in range(ya,yb+1)]
    def f(t):
        x,y=t;p=Path(f'{z}/{x}');p.mkdir(parents=True,exist_ok=True);p=p/f'{y}.jpg'
        if not p.exists() or p.stat().st_size==0:
            subprocess.run(['curl','-sfL','--retry','3','-A','CabinetOfWar/0.1 personal non-commercial','-o',str(p),f'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'])
            time.sleep(0.03)
    with ThreadPoolExecutor(6) as ex:list(ex.map(f,ts))
    print(z,len(ts),(xa,xb,ya,yb),flush=True)
run(14,17.29,17.47,50.80,50.90);run(13,17.29,17.47,50.80,50.90);run(12,17.29,17.47,50.80,50.90)
run(11,9.0,22.0,46.0,52.6)

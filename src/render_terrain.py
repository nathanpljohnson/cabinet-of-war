import math,io,json,sys,urllib.request
import numpy as np
from PIL import Image,ImageDraw
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
W=Path(__file__).resolve().parents[1]
Z=8;N=256*2**Z
LON0,LON1,LAT0,LAT1=6.0,26.0,43.5,54.5
def px(lon,lat):
    return (lon+180)/360*N,(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*N
x0,y1=px(LON0,LAT0);x1,y0=px(LON1,LAT1)
tx0,tx1,ty0,ty1=int(x0//256),int(x1//256),int(y0//256),int(y1//256)
OX,OY=tx0*256,ty0*256
Wd,Ht=(tx1-tx0+1)*256,(ty1-ty0+1)*256
def unpx(x,y):return x/N*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/N))))
def fetch(t):
    x,y=t;p=W/f'terrain/tiles/{Z}_{x}_{y}.png'
    if not p.exists():
        import subprocess;subprocess.run(['curl','-sfL','--retry','3','-A','CabinetOfWar/0.1','-o',str(p),f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'],check=True)
    return t
tiles=[(x,y) for x in range(tx0,tx1+1) for y in range(ty0,ty1+1)]
with ThreadPoolExecutor(8) as ex:list(ex.map(fetch,tiles))
print('tiles',len(tiles),Wd,Ht,flush=True)
elev=np.zeros((Ht,Wd),np.float32)
for x,y in tiles:
    a=np.asarray(Image.open(W/f'terrain/tiles/{Z}_{x}_{y}.png').convert('RGB')).astype(np.float32)
    elev[(y-ty0)*256:(y-ty0+1)*256,(x-tx0)*256:(x-tx0+1)*256]=a[...,0]*256+a[...,1]+a[...,2]/256-32768
# bounds of the stitched image
west,north=unpx(OX,OY);east,south=unpx(OX+Wd,OY+Ht)
print('bounds',south,west,north,east)
# masks from Natural Earth at full resolution
exec(open(W/'assets/shp2geojson.py').read().split('# Main processing')[0])
def sh(ring,bb):
    xa,xb,ya,yb=bb
    def clip(pts,ins,it):
        o=[]
        for i in range(len(pts)):
            a,b=pts[i-1],pts[i]
            if ins(b):
                if not ins(a):o.append(it(a,b))
                o.append(b)
            elif ins(a):o.append(it(a,b))
        return o
    ix=lambda x:(lambda a,b:(x,a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])))
    iy=lambda y:(lambda a,b:(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y))
    for ins,it in [(lambda p:p[0]>=xa,ix(xa)),(lambda p:p[0]<=xb,ix(xb)),(lambda p:p[1]>=ya,iy(ya)),(lambda p:p[1]<=yb,iy(yb))]:
        if not ring:return []
        ring=clip(ring,ins,it)
    return ring
SS=2
def rasterize(shp,pad=0.2,lines=False,width=2.0,keep=None,dbf=None):
    img=Image.new('L',(Wd*SS,Ht*SS),0);d=ImageDraw.Draw(img)
    bb=(west-pad,east+pad,south-pad,north+pad)
    attrs=read_dbf_attributes(dbf) if dbf else None
    for st,parts,rn in read_shp_geometries(shp):
        if keep and not keep(attrs[rn-1]):continue
        for part in parts:
            if lines:
                seg=[p for p in part]
                if not any(bb[0]<=p[0]<=bb[1] and bb[2]<=p[1]<=bb[3] for p in seg):continue
                pts=[((lambda q:((q[0]-OX)*SS,(q[1]-OY)*SS))(px(*p))) for p in seg if -90<p[1]<90]
                if len(pts)>1:d.line(pts,fill=255,width=int(width*SS),joint='curve')
            else:
                c=sh(part[:-1] if part[0]==part[-1] else part,bb)
                if len(c)<3:continue
                pts=[((lambda q:((q[0]-OX)*SS,(q[1]-OY)*SS))(px(*p))) for p in c]
                d.polygon(pts,fill=255)
    return img.resize((Wd,Ht),Image.LANCZOS)
R=W/'assets/raw/'
land=np.asarray(rasterize(R/'ne_10m_land.shp'),np.float32)/255
# land polygons: holes (lakes in ocean) aren't expressed; carve lakes from separate layer
lake=np.asarray(rasterize(R/'ne_10m_lakes.shp'),np.float32)/255
rivd=read_dbf_attributes(str(R/'ne_10m_rivers_lake_centerlines.dbf'))
def rv(width):
    return np.asarray(rasterize(R/'ne_10m_rivers_lake_centerlines.shp',lines=True,width=width),np.float32)/255
rivers=np.maximum(rv(3.4)*0.95,0)
print('masks done',flush=True)
def resz(a,w,h):return np.asarray(Image.fromarray(a.astype(np.float32),'F').resize((w,h),Image.BICUBIC))
def blur(a,f):
    h,w=a.shape;return resz(resz(a,max(2,w//f),max(2,h//f)),w,h)
def fbm(seed,base=32,oct=6,gain=.55):
    rng=np.random.default_rng(seed);out=np.zeros((Ht,Wd),np.float32);amp=1;tot=0;s=base
    for o in range(oct):
        out+=amp*resz(rng.standard_normal((max(2,Ht//s+2),max(2,Wd//s+2))),Wd,Ht);tot+=amp;amp*=gain;s=max(2,s//2)
    out/=tot;return out/out.std()
# hillshade
lat_rows=np.array([unpx(0,OY+i)[1] for i in range(Ht)],np.float32)
cell=(156543.03/2**Z)*np.cos(np.radians(lat_rows))[:,None]
land_e=np.where(land>0.5,np.maximum(elev,1),elev)
ze=land_e*2.2
gy,gx=np.gradient(ze)
gx=gx/cell;gy=gy/cell
slope=np.arctan(np.hypot(gx,gy));aspect=np.arctan2(-gx,gy)
def hs(az,alt):
    az=math.radians(az);zn=math.radians(90-alt)
    return np.cos(zn)*np.cos(slope)+np.sin(zn)*np.sin(slope)*np.cos(az-aspect)
sh1=hs(315,34);sh2=hs(10,55);flat1=math.sin(math.radians(34));flat2=math.sin(math.radians(55))
shade=0.7*(sh1/flat1)+0.3*(sh2/flat2)
relief=(land_e-blur(land_e,24))
shade=shade*(1+np.clip(relief/900,-.18,.18))
shade=1+(shade-1)*1.35
shade=np.clip(shade,0.2,1.8)
# colours
def ramp(v,stops):
    xs=[s[0] for s in stops];out=np.zeros(v.shape+(3,),np.float32)
    for c in range(3):out[...,c]=np.interp(v,xs,[s[1][c] for s in stops])
    return out
LAND=[(0,(132,142,92)),(120,(146,152,98)),(300,(158,152,100)),(550,(140,128,86)),(900,(122,106,78)),(1400,(112,96,74)),(1900,(128,116,100)),(2400,(158,152,144)),(2900,(200,198,192)),(3400,(244,244,244))]
col=ramp(np.clip(land_e,0,4000),LAND)
n1=fbm(1,64);n2=fbm(2,16,5);n3=fbm(3,128,4)
lat=lat_rows[:,None]
# tone: lowland farmland vs greener forest
col*=1+0.05*n2[...,None]
ss=lambda x,a_,b_:np.clip((x-a_)/(b_-a_),0,1)**2*(3-2*np.clip((x-a_)/(b_-a_),0,1))
forest=0.55*n1+0.9*n2+0.35*fbm(7,6,3)
fm=ss(forest,0.1,1.6)*np.clip((1600-land_e)/900,0,1)*np.clip((land_e+20)/80,0,1)
fcol=np.array([66,92,54],np.float32)
col=col*(1-0.6*fm[...,None])+fcol*0.6*fm[...,None]*(1+0.08*fbm(8,4,3)[...,None])
field=ss(fbm(9,10,4),0.2,1.4)*np.clip((450-land_e)/350,0,1)*(1-fm)
col=col*(1-0.18*field[...,None])+np.array([186,174,108],np.float32)*0.18*field[...,None]
col*=1+0.035*fbm(10,3,3)[...,None]
col*=shade[...,None]
# sea
depth=np.clip(-elev,0,4000)
SEA=[(0,(104,148,150)),(30,(84,130,142)),(150,(54,100,128)),(600,(32,68,104)),(2000,(22,48,84)),(4000,(14,34,66))]
sea=ramp(depth,SEA)
coast=blur(land,10)
sea*=1+0.12*np.clip(coast*2,0,1)[...,None]*0
sea=sea*(1+0.04*n2[...,None])
# lakes -> water colour (shallow)
lakecol=np.array([86,132,146],np.float32)
a=np.clip(land,0,1)[...,None]
out=sea*(1-a)+col*a
la=np.clip(lake,0,1)[...,None]
out=out*(1-la)+lakecol*(1+0.04*n2[...,None])*la
ra=np.clip(rivers,0,1)[...,None]*(1-la)*a
out=out*(1-ra)+np.array([56,100,132],np.float32)*ra
# coastline dark edge + shallow glow
edge=np.clip(1-np.abs(land-0.5)*2,0,1)[...,None]
out=out*(1-0.35*edge)
glow=np.clip(blur(land,6)*1.0,0,1)*(1-land)
out+=glow[...,None]*np.array([30,40,30],np.float32)*0.5
# grade: warm, slight contrast
out=np.clip(out,0,255)
out=(out-128)*1.06+128
out*=np.array([1.03,1.0,0.94],np.float32)
img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
dst=W/'terrain/terrain.jpg';img.save(dst,quality=84,progressive=True,optimize=True)
json.dump({'south':south,'west':west,'north':north,'east':east,'w':Wd,'h':Ht},open(W/'terrain/bounds.json','w'))
print('saved',dst.stat().st_size/1e6,'MB')

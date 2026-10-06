"""1740-style engraved/hand-coloured base map tiles (Europe z3-8, theatre z9-10).
usage: python engrave.py test <z> <lon> <lat> | run <outdir>"""
import sys,math,pickle,json
import numpy as np
from PIL import Image,ImageDraw
from pathlib import Path
from multiprocessing import Pool
ORIG=sys.argv[:]
OUTDIR=Path(sys.argv[2]) if len(sys.argv)>2 and sys.argv[1]=='run' else None
sys.argv=[sys.argv[0],sys.argv[1]] if len(sys.argv)>1 else sys.argv
import render_tiles as R
import paint as PT
W=R.W
EU=(-14,34,47,72)
exec(open(W/'assets/shp2geojson.py').read().split('# Main processing')[0])
# ---- polygons / lines (clipped once, cached) ----
def clip_ring(ring,bb):
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
CACHE=W/'v3/eu_geo.pkl'
def load_geo():
    if CACHE.exists():return pickle.loads(CACHE.read_bytes())
    bb=(EU[0]-1,EU[2]+1,EU[1]-1,EU[3]+1);raw=W/'assets/raw/'
    out={'land':[],'lakes':[],'rivers':[]}
    for key,fn in(('land','ne_10m_land'),('lakes','ne_10m_lakes')):
        for st,parts,rn in read_shp_geometries(str(raw/(fn+'.shp'))):
            for ring in parts:
                a=sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))/2
                c=clip_ring(list(ring[:-1] if ring[0]==ring[-1] else ring),bb)
                if len(c)>=3:out[key].append((a<0,np.array(c,np.float64)))
    attrs=read_dbf_attributes(str(raw/'ne_10m_rivers_lake_centerlines.dbf'))
    for st,parts,rn in read_shp_geometries(str(raw/'ne_10m_rivers_lake_centerlines.shp')):
        sr=(attrs[rn-1] or {}).get('scalerank',6)
        for line in parts:
            pts=[p for p in line if bb[0]<=p[0]<=bb[1] and bb[2]<=p[1]<=bb[3]]
            if len(pts)>=2:out['rivers'].append((float(sr),np.array(pts,np.float64)))
    CACHE.write_bytes(pickle.dumps(out));return out
GEO=load_geo()
def proj(arr,z,XS,YS):
    n=256*2**z;x=(arr[:,0]+180)/360*n-XS
    la=np.radians(np.clip(arr[:,1],-85,85));y=(1-np.log(np.tan(la)+1/np.cos(la))/np.pi)/2*n-YS
    return list(zip(x.tolist(),y.tolist()))
def rast_polys(items,z,XS,YS,Wd,Ht,SS=2):
    im=Image.new('L',(Wd*SS,Ht*SS),0);d=ImageDraw.Draw(im);n=256*2**z
    lo=((XS)/n*360-180);hi=((XS+Wd)/n*360-180)
    for outer,arr in items:
        if arr[:,0].max()<lo-.5 or arr[:,0].min()>hi+.5:continue
        pts=[(x*SS,y*SS) for x,y in proj(arr,z,XS,YS)]
        d.polygon(pts,fill=255 if outer else 0)
    return np.asarray(im.resize((Wd,Ht),Image.BOX),np.float32)/255
def rast_lines(lines,z,XS,YS,Wd,Ht,widthfn,SS=2):
    im=Image.new('L',(Wd*SS,Ht*SS),0);d=ImageDraw.Draw(im);n=256*2**z
    lo=((XS)/n*360-180);hi=((XS+Wd)/n*360-180)
    for sr,arr in lines:
        if arr[:,0].max()<lo or arr[:,0].min()>hi:continue
        pts=[(x*SS,y*SS) for x,y in proj(arr,z,XS,YS)]
        d.line(pts,fill=255,width=max(1,int(round(widthfn(sr)*SS))),joint='curve')
    return np.asarray(im.resize((Wd,Ht),Image.BOX),np.float32)/255

PAPER=np.array([239,228,200],np.float32);INK=np.array([74,52,34],np.float32)
SEAC=np.array([190,208,206],np.float32);RIV=np.array([88,116,138],np.float32)
def engrave(z,X0,Y0,w,h,P):
    m=22;XS,YS,Wd,Ht=X0-m,Y0-m,w+2*m,h+2*m;SS=P.get('ss',2)
    R.NOM[0]=R.M0/2**z*0.65;mp=R.NOM[0]
    X=(np.arange(Wd)+XS).astype(np.float32)[None,:];Y=(np.arange(Ht)+YS).astype(np.float32)[:,None]
    lat=R.lat_of(Y.astype(np.float64),z).astype(np.float32);mppA=(R.M0/2**z*np.cos(np.radians(lat))).astype(np.float32)
    elev=R.elev_window(z,P['zd'],XS,YS,Wd,Ht)
    land=rast_polys(GEO['land'],z,XS,YS,Wd,Ht,SS);lake=rast_polys(GEO['lakes'],z,XS,YS,Wd,Ht,SS)*land
    R.WANT[0]={'wood'};vm=R.raster_vt(z,P['zv'],XS,YS,Wd,Ht,1,False);wood=np.clip(vm['wood'],0,1)
    nf=R.fbm(X,Y,mppA,[mp*40,mp*14,mp*5],8);nm=R.fbm(X,Y,mppA,[mp*200,mp*80],5)
    # relief shading
    ve=P['ve'];e2=np.where(land>.5,np.maximum(elev,0),0)*ve
    gy,gx=np.gradient(e2);gx=gx/mppA;gy=gy/mppA;slope=np.arctan(np.hypot(gx,gy));asp=np.arctan2(-gx,gy)
    def hs(az,alt):
        a=math.radians(az);zn=math.radians(90-alt);return np.cos(zn)*np.cos(slope)+np.sin(zn)*np.sin(slope)*np.cos(a-asp)
    shade=.7*hs(315,38)/math.sin(math.radians(38))+.3*hs(20,55)/math.sin(math.radians(55))
    shade=np.clip(1+(shade-1)*1.5,.35,1.3)
    out=np.zeros((Ht,Wd,3),np.float32)+PAPER
    out*=1+0.035*nf[...,None]+0.02*nm[...,None]
    # hypsometric warm tint
    hy=np.clip(elev/2200,0,1)[...,None];out=out*(1-hy*.18)+np.array([206,176,132],np.float32)*hy*.18
    out*=(0.62+0.38*shade)[...,None]
    # hachure lines on slopes
    per=P['hatch'];sl=np.degrees(slope)
    l1=(np.sin((X+Y)*2*np.pi/per)>.35).astype(np.float32);l2=(np.sin((X-Y)*2*np.pi/per)>.35).astype(np.float32)
    a1=np.clip((sl-P['s0'])/P['s1'],0,1);a2=np.clip((sl-P['s0']*2)/P['s1'],0,1)
    dark=np.array([96,70,46],np.float32)
    k=(0.30*l1*a1+0.22*l2*a2*(shade<0.9))[...,None];out=out*(1-k)+dark*k*0.9
    # forest symbols
    spx=P['tree']
    if spx>0:
        best,nx,ny,kind=PT.crowns(X,Y,mp,spx*mp,spx*.26*mp,spx*.38*mp,101)
        ins=(best<1)&(wood>0.4)&(land>.5)&(kind>0.28)
        lit=np.clip(-.6*nx-.6*ny+.6,0,1)
        col=np.array([138,156,94],np.float32)*(0.78+0.4*lit[...,None])
        rim=((best>0.7)&ins)[...,None]
        col=np.where(rim,np.array([64,82,50],np.float32),col)
        out=np.where(ins[...,None],col,out)
        # faint wash under forests
        out=out*(1-wood[...,None]*.08)+np.array([150,166,110],np.float32)*wood[...,None]*.08
    # sea
    bl6=R.blur(land,max(2,int(8)))
    sea=np.zeros((Ht,Wd,3),np.float32)+SEAC;sea*=1+0.03*nf[...,None]
    wl=((Y%5.0)<1.0).astype(np.float32);sea=sea*(1-0.07*wl[...,None])
    for lvl in(.42,.32,.24,.17):
        rip=(np.abs(R.blur(land,max(2,int(14*(lvl*6))))-lvl)<0.018).astype(np.float32);sea=sea*(1-0.16*rip[...,None])+RIV*0.16*rip[...,None]
    inl=np.maximum(land-lake,0)
    out=out*inl[...,None]+sea*(1-inl[...,None])
    # coast line + lake outline
    e1=np.clip(1-np.abs(R.blur(land,2)-.5)*2.6,0,1)*(land>=0)
    e2_=np.clip(1-np.abs(R.blur(inl,2)-.5)*2.6,0,1)
    out=out*(1-0.8*e2_[...,None])+INK*0.8*e2_[...,None]
    # rivers
    rv=rast_lines(GEO['rivers'],z,XS,YS,Wd,Ht,lambda sr:max(.7,(1.9-.16*sr))*P['rw'],SS)
    if P.get('hydro'):
        rv=np.maximum(rv,np.clip(R.raster_rivers(z,XS,YS,Wd,Ht,P['hydro']),0,1)*.95)
    rv=np.clip(rv,0,1)*inl
    out=out*(1-rv[...,None]*.9)+RIV*rv[...,None]*.9
    out=np.clip(out[m:m+h,m:m+w],0,255)
    return out.astype(np.uint8)
PARAMS={7:dict(zd=7,zv=7,ve=7,hatch=3.6,s0=4,s1=10,tree=9,rw=1.0,ss=1),8:dict(zd=8,zv=8,ve=5,hatch=3.6,s0=3,s1=9,tree=11,rw=1.1,ss=1,hydro=30),
        9:dict(zd=10,zv=10,ve=3.4,hatch=4,s0=4,s1=10,tree=13,rw=1.2,ss=2,hydro=4),10:dict(zd=10,zv=10,ve=3.0,hatch=4.4,s0=4,s1=10,tree=15,rw=1.4,ss=2,hydro=1.2)}
def job(a):
    z,bx,by,nx,ny=a;return a,engrave(z,bx*256,by*256,nx*256,ny*256,PARAMS[z])
def runz(z,xa,xb,ya,yb,block=4,procs=4):
    jobs=[(z,bx,by,min(block,xb-bx+1),min(block,yb-by+1)) for bx in range(xa,xb+1,block) for by in range(ya,yb+1,block)]
    with Pool(procs) as pool:
        for (zz,bx,by,nx,ny),img in pool.imap_unordered(job,jobs):
            for i in range(nx):
                for k in range(ny):
                    p=OUTDIR/f'{zz}/{bx+i}/{by+k}.webp';p.parent.mkdir(parents=True,exist_ok=True)
                    Image.fromarray(img[k*256:(k+1)*256,i*256:(i+1)*256]).save(p,quality=72,method=4)
            print('block',zz,bx,by,flush=True)
def rng(z,bb):
    a=[int(v//256) for v in R.wpx(bb[0],bb[1],z)];b=[int(v//256) for v in R.wpx(bb[2],bb[3],z)];return a[0],b[0],b[1],a[1]
def pyramid(zmax,zmin,xa,xb,ya,yb):
    for z in range(zmax-1,zmin-1,-1):
        xa,xb,ya,yb=xa//2,xb//2,ya//2,yb//2
        for x in range(xa,xb+1):
            for y in range(ya,yb+1):
                im=Image.new('RGB',(512,512),(190,208,206))
                for i in range(2):
                    for k in range(2):
                        p=OUTDIR/f'{z+1}/{2*x+i}/{2*y+k}.webp'
                        if p.exists():im.paste(Image.open(p).convert('RGB'),(i*256,k*256))
                p=OUTDIR/f'{z}/{x}/{y}.webp';p.parent.mkdir(parents=True,exist_ok=True)
                im.resize((256,256),Image.LANCZOS).save(p,quality=72,method=4)
        print('pyramid',z,flush=True)
if __name__=='__main__':
    mode=ORIG[1]
    if mode=='run':
        E=(-12,34,45,72);C=(0,40,34,58);T=(8,45,23,53)
        a=rng(7,E);runz(7,*a);pyramid(7,3,*a)
        runz(8,*rng(8,C))
        for z in (9,10):runz(z,*rng(z,T))
        json.dump({'E':rng(7,E),'C':rng(8,C),'T9':rng(9,T),'T10':rng(10,T)},open(OUTDIR/'ranges.json','w'))
    if mode=='test':
        z=int(ORIG[2]);lon=float(ORIG[3]);lat=float(ORIG[4]);x,y=R.wpx(lon,lat,z)
        img=engrave(z,int(x)-512,int(y)-384,1024,768,PARAMS[z]);Image.fromarray(img).save(f'/tmp/eng_z{z}.png');print('ok')

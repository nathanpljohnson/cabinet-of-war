"""Painted (non-photographic) close-range battlefield map. usage: python paint.py test|run <outdir>"""
import sys,math
import numpy as np
from PIL import Image,ImageDraw
from multiprocessing import Pool
from pathlib import Path
ORIG=sys.argv[:]
OUTDIR=Path(sys.argv[2]) if len(sys.argv)>2 else None
CITY=[False]
sys.argv=[sys.argv[0],sys.argv[1]] if len(sys.argv)>1 else sys.argv
import render_tiles as R

def hsh(a,b,seed):return R._hash(a,b,seed)
def dil(m,k):  # cheap dilation via blur+threshold
    return (R.blur(m,k)>0.02).astype(np.float32)
def shift(a,dx,dy):
    return np.roll(np.roll(a,int(round(dy)),0),int(round(dx)),1)
def crowns(X,Y,mpp,spacing,rmin,rmax,seed):
    c=spacing/mpp
    gx=np.floor(X/c);gy=np.floor(Y/c)
    H,W=np.broadcast(X,Y).shape
    best=np.full((H,W),9.,np.float32);nx=np.zeros((H,W),np.float32);ny=np.zeros((H,W),np.float32);kind=np.zeros((H,W),np.float32)
    for dx in(-1,0,1):
        for dy in(-1,0,1):
            cx=gx+dx;cy=gy+dy
            jx=hsh(cx,cy,seed);jy=hsh(cx,cy,seed+1);rd=hsh(cx,cy,seed+2);kd=hsh(cx,cy,seed+3)
            px=(cx+0.15+0.7*jx)*c;py=(cy+0.15+0.7*jy)*c
            r=(rmin+(rmax-rmin)*rd)/mpp
            ddx=(X-px)/r;ddy=(Y-py)/r;d=np.sqrt(ddx*ddx+ddy*ddy)
            upd=d<best
            best=np.where(upd,d,best);nx=np.where(upd,ddx,nx);ny=np.where(upd,ddy,ny);kind=np.where(upd,kd,kind)
    return best,nx,ny,kind

def paint(z,X0,Y0,w,h,P):
    R.NOM[0]=R.M0/2**z*0.65;R.P_SAT[0]=False
    m=40;XS,YS,Wd,Ht=X0-m,Y0-m,w+2*m,h+2*m
    X=(np.arange(Wd)+XS).astype(np.float32)[None,:];Y=(np.arange(Ht)+YS).astype(np.float32)[:,None]
    lat=R.lat_of(Y.astype(np.float64),z).astype(np.float32);mpp=float((R.M0/2**z*np.cos(np.radians(lat))).mean())
    mppA=(R.M0/2**z*np.cos(np.radians(lat))).astype(np.float32)
    elev=R.elev_window(z,P.get('zd',12),XS,YS,Wd,Ht)
    elev=elev+(R.fbm(X,Y,mppA,[400,160,70,30],91)*0.9).astype(np.float32)
    vm=R.raster_vt(z,P.get('zv',14),XS,YS,Wd,Ht,P.get('ss',2),True)
    nb=R.fbm(X,Y,mppA,[3000,1200,500],3);nm=R.fbm(X,Y,mppA,[300,120,50,20],5);nf=R.fbm(X,Y,mppA,[40,16,7,3,1.5],8)
    # --- relief shading (subtle, painterly)
    gy,gx=np.gradient(elev*3.2);gx=gx/mppA;gy=gy/mppA
    slope=np.arctan(np.hypot(gx,gy));asp=np.arctan2(-gx,gy)
    zn=math.radians(90-38);az=math.radians(315)
    shade=(np.cos(zn)*np.cos(slope)+np.sin(zn)*np.sin(slope)*np.cos(az-asp))/math.sin(math.radians(38))
    shade=np.clip(1+(shade-1)*1.1,.6,1.25)
    # --- ground classes
    wood=vm['wood'];farm=vm['farm'];grass=vm['grass'];wet=vm['wet'];water=np.clip(vm['water'],0,1)
    urb=vm['urban'];bld=vm['bld'];road=vm['road'];track=vm['track'];stream=vm['stream']
    def rough(mk,amp=.7):
        t=R.blur(mk,2);return np.clip((t-.5+amp*(nf*.5+nm*.5))*3.0+.5,0,1)
    wood=rough(wood);farm=rough(farm,.5);grass=rough(grass,.5);wet=rough(wet);urb=rough(urb,.4)
    base=np.zeros((Ht,Wd,3),np.float32)+np.array([150,146,96],np.float32)
    base*=1+0.05*nm[...,None]
    # meadow
    gcol=np.array([132,158,82],np.float32)*(1+0.07*nf[...,None])*(1+0.05*nm[...,None])
    base=base*(1-grass[...,None]*.9)+gcol*grass[...,None]*.9
    # --- fields: strip parcels with crop colour + furrows + edges
    th=math.radians(22);c_,s_=math.cos(th),math.sin(th)
    wx=R.fbm(X,Y,mppA,[900,400],21)*38/R.NOM[0];wy=R.fbm(X,Y,mppA,[900,400],22)*38/R.NOM[0]
    u=((X+wx)*c_+(Y+wy)*s_)*R.NOM[0];v=(-(X+wx)*s_+(Y+wy)*c_)*R.NOM[0]
    cu=np.floor(u/55);cv=np.floor(v/240)
    hid=hsh(cu.astype(np.float32),cv.astype(np.float32),77);hid2=hsh(cu.astype(np.float32),cv.astype(np.float32),78)
    crops=np.array([[170,160,108],[140,156,96],[158,136,98],[122,146,84],[184,172,120],[150,128,92],[112,138,78]],np.float32)
    fc=crops[np.minimum((hid*7).astype(np.int32),6)]
    # furrows along strip direction
    if mpp<3.5:
        fr=0.5+0.5*np.sin(u/3.0*2*math.pi)
        fc=fc*(1+((fr-.5)*(0.16 if mpp<1.2 else 0.10))[...,None])
    fc=fc*(1+0.09*nf[...,None])*(1+0.05*nm[...,None])
    base=base*(1-farm[...,None]*.95)+fc*farm[...,None]*.95
    # parcel edge lines (baulks)
    eu=np.abs(u/55-np.round(u/55));ev=np.abs(v/240-np.round(v/240))
    edge=np.clip(1-np.minimum(eu*55,ev*240)/max(0.9,1.1*mpp),0,1)*farm
    base=base*(1-edge[...,None]*.35)+np.array([96,112,64],np.float32)*edge[...,None]*.35
    # wetland
    base=base*(1-wet[...,None]*.7)+np.array([108,136,98],np.float32)*(1+.12*nf[...,None])*wet[...,None]*.7
    # settlements: yards & gardens
    ucol=np.array([150,140,98],np.float32)*(1+0.16*nf[...,None])*(1+0.1*nm[...,None])
    urb2=np.clip(urb*(0.4+0.5*nm),0,1)
    base=base*(1-urb2[...,None]*.42)+ucol*urb2[...,None]*.42
    base*=shade[...,None]
    # --- forest: individual crowns
    tmask=np.clip(wood,0,1)
    out=base.copy()
    sp=9.0
    if sp/mpp>=3.2:
        best,nx,ny,kind=crowns(X,Y,mppA,sp,3.6,6.2,101)
        inside=(best<1)&(wood>0.35)
        nz=np.sqrt(np.clip(1-np.minimum(best,1)**2,0,1))
        L=np.array([-.55,-.6,.58]);lit=np.clip(nx*L[0]+ny*L[1]+nz*L[2],0,1)
        broad=np.array([84,122,58],np.float32);conif=np.array([46,80,50],np.float32)
        kk=np.clip((kind*.7+(nb*.35+.5)*.5),0,1)[...,None]
        ccol=broad*(1-kk)+conif*kk
        crown=ccol*(0.55+0.85*lit[...,None])*(1+0.1*nf[...,None])
        # shadow
        sdx=sdy=max(1,int(round(5.0/mpp)))
        sh=shift(inside.astype(np.float32),sdx,sdy)*(1-inside)
        floor=np.array([58,78,44],np.float32)*(1+0.12*nf[...,None])*(1-0.35*sh[...,None])
        forest=np.where(inside[...,None],crown,floor)
        wa=np.clip(wood*1.0,0,1)[...,None]
        out=out*(1-wa)+forest*wa
    else:
        fcol=np.array([62,92,50],np.float32)*(1+0.2*nf[...,None])*(1+0.1*nm[...,None])
        wa=np.clip(wood,0,1)[...,None];out=out*(1-wa*.93)+fcol*wa*.93
    # tree lines along streams
    if sp/mpp>=3.2:
        tl=dil(stream,max(2,int(14/mpp)))*(nm>0.0)
        best2,nx2,ny2,k2=crowns(X,Y,mppA,12.0,3.0,5.0,201)
        ins2=(best2<1)&(tl>0.5)&(wood<0.3)
        nz2=np.sqrt(np.clip(1-np.minimum(best2,1)**2,0,1));lit2=np.clip(nx2*-.55+ny2*-.6+nz2*.58,0,1)
        c2=np.array([84,120,58],np.float32)*(0.55+0.85*lit2[...,None])
        out=np.where(ins2[...,None],c2,out)
    # --- water
    wcol=np.array([72,118,138],np.float32)*(1+0.06*nm[...,None])
    sw=np.clip(vm['water']+vm['stream']*.9,0,1)
    bank=np.clip(R.blur(sw,3)*2,0,1)*(1-sw)
    out=out*(1-bank[...,None]*.25)+np.array([86,98,60],np.float32)*bank[...,None]*.25
    out=out*(1-sw[...,None])+wcol*sw[...,None]
    # hydro rivers
    rv=np.clip(R.raster_rivers(z,XS,YS,Wd,Ht,P.get('mindis',0.05)),0,1)[...,None]
    out=out*(1-rv*.9)+np.array([66,112,140],np.float32)*rv*.9
    # --- roads & tracks
    tr=np.clip(R.blur(track,2) if mpp<4 else track,0,1)[...,None]
    out=out*(1-tr*.6)+np.array([196,176,130],np.float32)*tr*.6
    rd=np.clip(R.blur(road,2) if mpp<4 else road,0,1)[...,None]
    out=out*(1-rd*.75)+np.array([208,192,150],np.float32)*rd*.75
    # --- buildings with roofs and shadows
    b=np.clip(bld,0,1)
    if b.max()>0:
        sd=max(1,int(round(3.5/mpp)));shb=shift(b,sd,sd)*(1-b)
        if not P.get('nobld'):out=out*(1-shb[...,None]*.35)
        hb=hsh(np.floor(X/ (12/mppA)),np.floor(Y/(12/mppA)),55)
        roofs=np.array([[150,70,52],[132,62,48],[120,96,78],[168,88,60],[104,84,70]],np.float32)
        rc=roofs[np.minimum((hb*5).astype(np.int32),4)]
        hl=np.clip(b-shift(b,2,2),0,1)[...,None]
        rc=rc*(1+0.25*hl)
        if P.get('nobld'):
            out=out*(1-b[...,None]*.7)+np.array([172,156,124],np.float32)*b[...,None]*.7
        else:
            out=out*(1-b[...,None]*.95)+rc*b[...,None]*.95
    out=out[m:m+h,m:m+w]
    out=np.clip(out,0,255)
    if P.get('p1740'):
        lum=out.mean(-1,keepdims=True);out=lum+(out-lum)*0.58
        out=out*np.array([1.03,0.985,0.88],np.float32)
        paper=np.array([236,224,196],np.float32);out=out*0.82+paper*0.18
        out=out*(1+0.022*nf[m:m+h,m:m+w][...,None])
        out=np.clip((out-128)*1.06+128,0,255)
    return out.astype(np.uint8)

def job(a):
    z,bx,by,nx,ny=a;P={'ss':2 if z>=15 else 1,'p1740':True}
    if z<=13:P.update(zd=10,zv=10)
    if CITY[0]:
        P['nobld']=True;R.TRACKS.update({'service','pedestrian','path','track'})
    img=paint(z,bx*256,by*256,nx*256,ny*256,P);return a,img
def runz(z,xa,xb,ya,yb,block,procs=4):
    jobs=[(z,bx,by,min(block,xb-bx+1),min(block,yb-by+1)) for bx in range(xa,xb+1,block) for by in range(ya,yb+1,block)]
    with Pool(procs) as pool:
        for (zz,bx,by,nx,ny),img in pool.imap_unordered(job,jobs):
            for i in range(nx):
                for k in range(ny):
                    p=OUTDIR/f'{zz}/{bx+i}/{by+k}.webp';p.parent.mkdir(parents=True,exist_ok=True)
                    Image.fromarray(img[k*256:(k+1)*256,i*256:(i+1)*256]).save(p,quality=74,method=4)
            print('block',zz,bx,by,flush=True)
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='test':
        z=int(ORIG[3]) if len(ORIG)>3 else 16
        x,y=R.wpx(float(ORIG[4]) if len(ORIG)>4 else 17.381,float(ORIG[5]) if len(ORIG)>5 else 50.8475,z);img=paint(z,int(x)-640,int(y)-480,1280,960,{'ss':2})
        Image.fromarray(img).save(f'/tmp/paint_z{z}.jpg',quality=92);print('ok')
    elif mode=='city':
        CITY[0]=True;R.TRACKS.update({'service','pedestrian','path','track'})
        import cities as C
        cid=ORIG[3];lat,lon,nm=C.CITIES[cid];OUTDIR=OUTDIR/cid
        for z,bl,rad in ((12,4,(0.20,0.13)),(13,6,(0.11,0.07)),(14,6,(0.06,0.04)),(15,4,(C.SDLON,C.SDLAT)),(16,4,(C.SDLON,C.SDLAT))):
            a=[int(v//256) for v in R.wpx(lon-rad[0],lat+rad[1],z)];b=[int(v//256) for v in R.wpx(lon+rad[0],lat-rad[1],z)]
            runz(z,a[0],b[0],a[1],b[1],bl)
    elif mode=='run':
        # z13-14 over the battle bbox, z15-17 over the central line
        for z,(lo,hi,bl) in {12:((17.15,50.98),(17.62,50.72),8),13:((17.22,50.94),(17.55,50.76),8),14:((17.29,50.90),(17.47,50.80),6),15:((17.345,50.865),(17.425,50.825),4),16:((17.345,50.865),(17.425,50.825),4)}.items():
            a=[int(v//256) for v in R.wpx(lo[0],lo[1],z)];b=[int(v//256) for v in R.wpx(hi[0],hi[1],z)]
            runz(z,a[0],b[0],a[1],b[1],bl)

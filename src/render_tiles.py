"""Render the realistic relief map as a Web-Mercator tile pyramid.
Inputs: Terrarium DEM (work/dem), OpenFreeMap vector tiles (work/vt), HydroRIVERS (work/hydro).
usage: python render_tiles.py overview | battle
"""
import math,json,sys,gzip,pickle,os
import numpy as np
from PIL import Image,ImageDraw
from pathlib import Path
from functools import lru_cache
from multiprocessing import Pool
W=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(W/'vt'))
import mvt
OUT=Path(sys.argv[2]) if len(sys.argv)>2 else W.parent/'outputs'/'tiles'
NOM=[1.0];P_SAT=[False];WANT=[None];TRACKS={'track'}
M0=156543.03392804097  # metres per pixel at z0, equator

def wpx(lon,lat,z):
    n=256*2**z
    return (lon+180)/360*n,(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n
def lat_of(Y,z):
    n=256*2**z;return np.degrees(np.arctan(np.sinh(np.pi*(1-2*Y/n))))

# ---------- global-coordinate value noise (seamless across windows) ----------
def _hash(ix,iy,seed):
    h=(ix.astype(np.uint32)*np.uint32(374761393))^(iy.astype(np.uint32)*np.uint32(668265263))^np.uint32(seed*2246822519%2**32)
    h=(h^(h>>np.uint32(13)))*np.uint32(1274126177);h=h^(h>>np.uint32(16))
    return (h&np.uint32(0xFFFFFF)).astype(np.float32)/np.float32(0xFFFFFF)
def vnoise(X,Y,scale_px,seed):
    gx=X/scale_px;gy=Y/scale_px;ix=np.floor(gx);iy=np.floor(gy);fx=gx-ix;fy=gy-iy
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy)
    a=_hash(ix,iy,seed);b=_hash(ix+1,iy,seed);c=_hash(ix,iy+1,seed);d=_hash(ix+1,iy+1,seed)
    return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
def fbm(X,Y,mpp,scales_m,seed,gain=.55):
    mpp=NOM[0];out=0;tot=0;amp=1
    for i,s in enumerate(scales_m):
        sp=s/mpp
        if sp<1.6:break
        out=out+amp*(vnoise(X,Y,sp,seed+i*7)-.5);tot+=amp;amp*=gain
    if tot==0:return np.zeros(np.broadcast(X,Y).shape,np.float32)
    return (out/tot*3.4).astype(np.float32)

# ---------- DEM ----------
_demc={}
def dem_tile(zd,x,y):
    k=(zd,x,y)
    if k not in _demc:
        p=W/f'dem/{zd}/{x}/{y}.png'
        if p.exists() and p.stat().st_size>0:
            a=np.asarray(Image.open(p).convert('RGB')).astype(np.float32);_demc[k]=a[...,0]*256+a[...,1]+a[...,2]/256-32768
        else:_demc[k]=np.zeros((256,256),np.float32)
    return _demc[k]
def elev_window(z,zd,XS,YS,Wd,Ht):
    s=2.0**(zd-z);xa,xb,ya,yb=XS*s,(XS+Wd)*s,YS*s,(YS+Ht)*s
    pad=2;txa,txb,tya,tyb=int((xa-pad)//256),int((xb+pad)//256),int((ya-pad)//256),int((yb+pad)//256)
    mos=np.zeros(((tyb-tya+1)*256,(txb-txa+1)*256),np.float32)
    for tx in range(txa,txb+1):
        for ty in range(tya,tyb+1):mos[(ty-tya)*256:(ty-tya+1)*256,(tx-txa)*256:(tx-txa+1)*256]=dem_tile(zd,tx,ty)
    box=(xa-txa*256,ya-tya*256,xb-txa*256,yb-tya*256)
    im=Image.fromarray(mos).resize((Wd,Ht),Image.BICUBIC,box=box)
    return np.asarray(im,np.float32)

# ---------- satellite ----------
_satc={}
def sat_tile(z,x,y):
    k=(z,x,y)
    if k not in _satc:
        p=W/f'sat/{z}/{x}/{y}.jpg'
        try:_satc[k]=np.asarray(Image.open(p).convert('RGB'),np.float32) if p.exists() and p.stat().st_size>0 else None
        except Exception:_satc[k]=None
    return _satc[k]
def sat_window(z,XS,YS,Wd,Ht):
    zs=min(z,14);f=2.0**(zs-z)
    xa,xb,ya,yb=XS*f,(XS+Wd)*f,YS*f,(YS+Ht)*f
    txa,txb,tya,tyb=int((xa-2)//256),int((xb+2)//256),int((ya-2)//256),int((yb+2)//256)
    mos=np.zeros(((tyb-tya+1)*256,(txb-txa+1)*256,3),np.uint8);have=0
    for tx in range(txa,txb+1):
        for ty in range(tya,tyb+1):
            t=sat_tile(zs,tx,ty)
            if t is not None and t.shape==(256,256,3):mos[(ty-tya)*256:(ty-tya+1)*256,(tx-txa)*256:(tx-txa+1)*256]=t.astype(np.uint8);have+=1
    if have==0:return None
    box=(xa-txa*256,ya-tya*256,xb-txa*256,yb-tya*256)
    return np.asarray(Image.fromarray(mos).resize((Wd,Ht),Image.BICUBIC,box=box),np.float32)
def nblur(S,w,k):
    num=blur3(S*w[...,None],k);den=blur(w,k)
    return num/np.maximum(den[...,None],1e-3),den
def blur3(a,k):
    return np.stack([blur(np.ascontiguousarray(a[...,c]),k) for c in range(3)],-1)
# ---------- vector tiles ----------
VT=W/'vt/tiles';CACHE=W/'vt/cache';CACHE.mkdir(exist_ok=True)
def vt_tile(zv,x,y):
    cp=CACHE/f'{zv}_{x}_{y}.pkl'
    if cp.exists():return pickle.loads(cp.read_bytes())
    p=VT/f'{zv}/{x}/{y}.pbf'
    d=mvt.decode(p.read_bytes()) if p.exists() and p.stat().st_size>0 else {}
    cp.write_bytes(pickle.dumps(d));return d
LC={'wood':'wood','forest':'wood','farmland':'farm','grass':'grass','wetland':'wet','rock':'rock','sand':'sand','ice':'ice'}
LU_URBAN={'residential','suburb','neighbourhood'}
LU_MODERN={'residential','suburb','neighbourhood','commercial','industrial','retail','garages','railway','quarry','military','landfill','construction','brownfield','port','allotments','cemetery','education','hospital','stadium','sports_centre','airfield'}
def raster_vt(z,zv,XS,YS,Wd,Ht,SS,want_roads=False):
    """returns dict name->float32 mask in [0,1] (window size) plus road/building layers"""
    names=['wood','farm','grass','wet','rock','sand','ice','water','urban','bld','road','track','stream','modern']
    ims={n:Image.new('L',(Wd*SS,Ht*SS),0) for n in names};drs={n:ImageDraw.Draw(ims[n]) for n in names}
    f=2.0**(z-zv);T=256*f
    txa,txb,tya,tyb=int(XS//T),int((XS+Wd)//T),int(YS//T),int((YS+Ht)//T)
    for tx in range(txa,txb+1):
        for ty in range(tya,tyb+1):
            tile=vt_tile(zv,tx,ty)
            ox=tx*T-XS;oy=ty*T-YS
            def tp(pt,ext):return ((ox+pt[0]/ext*T)*SS,(oy+pt[1]/ext*T)*SS)
            for lname,layer in tile.items():
                ext=layer['extent']
                for ft in layer['features']:
                    cls=ft['props'].get('class');sub=ft['props'].get('subclass')
                    if lname=='landcover' and ft['type']==3:tgt=LC.get(cls)
                    elif lname=='landuse' and ft['type']==3:
                        if cls in LU_MODERN and P_SAT[0]:
                            for poly in ft['geom']:
                                for i,ring in enumerate(poly):
                                    pts=[tp(p,ext) for p in ring]
                                    if len(pts)>=3:drs['modern'].polygon(pts,fill=255 if i==0 else 0)
                        tgt='urban' if cls in LU_URBAN else ('wood' if cls=='forest' else None)
                    elif lname=='water' and ft['type']==3:tgt='water'
                    elif lname=='aeroway':tgt='modern'
                    elif lname=='transportation' and ft['type']==2 and cls in('motorway','trunk','rail','primary') and P_SAT[0]:tgt='modern'
                    elif lname=='building' and ft['type']==3 and (want_roads or P_SAT[0]):tgt='bld'
                    elif lname=='transportation' and ft['type']==2 and want_roads:
                        tgt='road' if cls in('primary','secondary','tertiary','minor','residential','street','unclassified') else ('track' if cls in TRACKS else None)
                    elif lname=='waterway' and ft['type']==2 and want_roads:tgt='stream'
                    else:continue
                    if not tgt:continue
                    if WANT[0] is not None and tgt not in WANT[0]:continue
                    if ft['type']==3:
                        for poly in ft['geom']:
                            for i,ring in enumerate(poly):
                                pts=[tp(p,ext) for p in ring]
                                if tgt=='bld' and (max(q[0] for q in pts)-min(q[0] for q in pts)>55/(M0/2**z*.63)*SS or max(q[1] for q in pts)-min(q[1] for q in pts)>55/(M0/2**z*.63)*SS):continue
                                if len(pts)>=3:drs[tgt].polygon(pts,fill=255 if i==0 else 0)
                    else:
                        for line in ft['geom']:
                            pts=[tp(p,ext) for p in line]
                            if len(pts)>=2:
                                wm={'road':7,'track':3.5,'stream':(3 if cls in('stream','ditch','drain') else 12),'modern':45}[tgt]
                                wp=max(1,wm/(M0/2**z*0.63))*SS if tgt!='stream' else max(1,wm/(M0/2**z*0.63))*SS
                                drs[tgt].line(pts,fill=255,width=int(round(wp)),joint='curve')
    out={}
    for n,im in ims.items():
        a=im if SS==1 else im.resize((Wd,Ht),Image.BOX)
        out[n]=np.asarray(a,np.float32)/255
    return out

# ---------- rivers ----------
_hy=None
def hydro():
    global _hy
    if _hy is None:
        d=json.load(open(W/'hydro/rivers.json'))['lines'];lines=[]
        for dis,o,pts in d:
            a=np.array(pts,np.float64);lines.append((dis,o,a[:,0],a[:,1],a[:,0].min(),a[:,0].max(),a[:,1].min(),a[:,1].max()))
        _hy=lines
    return _hy
def raster_rivers(z,XS,YS,Wd,Ht,mindis,SS=3):
    n=256*2**z;lon0=XS/n*360-180;lon1=(XS+Wd)/n*360-180
    lat_top=float(lat_of(np.float64(YS),z));lat_bot=float(lat_of(np.float64(YS+Ht),z))
    im=Image.new('L',(Wd*SS,Ht*SS),0);dr=ImageDraw.Draw(im)
    mpp0=M0/2**z
    for dis,o,lo,la,a,b,c,d in hydro():
        if dis<mindis or b<lon0 or a>lon1 or d<lat_bot or c>lat_top:continue
        x=(lo+180)/360*n-XS
        y=((1-np.log(np.tan(np.radians(la))+1/np.cos(np.radians(la)))/np.pi)/2*n)-YS
        wm=7*dis**0.42  # approximate channel width in metres
        mpp=mpp0*math.cos(math.radians(float(la.mean())))
        wp=wm/mpp
        val=int(np.clip(255*min(1,wp/1.1),70,255));wpx_=max(1.0,wp)
        pts=list(zip((x*SS).tolist(),(y*SS).tolist()))
        dr.line(pts,fill=val,width=max(1,int(round(wpx_*SS))),joint='curve')
    return np.asarray(im.resize((Wd,Ht),Image.BOX),np.float32)/255

# ---------- colour ----------
def ramp(v,stops):
    xs=[s[0] for s in stops];out=np.zeros(v.shape+(3,),np.float32)
    for c in range(3):out[...,c]=np.interp(v,xs,[s[1][c] for s in stops])
    return out
GROUND=[(0,(150,152,96)),(150,(160,156,98)),(400,(150,140,92)),(800,(130,116,84)),(1300,(118,104,80)),(1900,(134,122,108)),(2400,(166,160,150)),(2900,(205,203,198)),(3500,(246,246,246))]
SEA=[(0,(96,142,150)),(25,(78,126,142)),(120,(52,96,126)),(500,(32,66,102)),(1500,(22,48,84)),(4000,(14,34,66))]
def blur(a,k):
    h,w=a.shape;return np.asarray(Image.fromarray(a).resize((max(2,w//k),max(2,h//k)),Image.BOX).resize((w,h),Image.BICUBIC),np.float32)
def render(z,X0,Y0,w,h,zd,zv,P):
    NOM[0]=M0/2**z*0.65;P_SAT[0]=bool(P.get('sat'))
    m=48;XS,YS,Wd,Ht=X0-m,Y0-m,w+2*m,h+2*m;SS=P.get('ss',2)
    X=(np.arange(Wd)+XS).astype(np.float32)[None,:];Y=(np.arange(Ht)+YS).astype(np.float32)[:,None]
    lat=lat_of(Y.astype(np.float64),z).astype(np.float32);mpp=(M0/2**z*np.cos(np.radians(lat))).astype(np.float32)
    elev=elev_window(z,zd,XS,YS,Wd,Ht)
    if P.get('microrelief'):
        elev=elev+(fbm(X,Y,mpp,[400,160,70,30,14],91)*P['microrelief']).astype(np.float32)
    vm=raster_vt(z,zv,XS,YS,Wd,Ht,SS,P.get('detail',False))
    water=np.clip(vm['water']*1.0,0,1)
    # sea: below zero elevation OR water+very low; treat deep-negative as sea
    land=1-water
    # hillshade
    ze=np.where(water>.5,np.minimum(elev,0)*0+np.maximum(elev,0),elev)*P.get('vexag',2.2)
    gy,gx=np.gradient(ze);gx=gx/mpp;gy=gy/mpp
    slope=np.arctan(np.hypot(gx,gy));aspect=np.arctan2(-gx,gy)
    def hs(az,alt):
        a=math.radians(az);zn=math.radians(90-alt)
        return np.cos(zn)*np.cos(slope)+np.sin(zn)*np.sin(slope)*np.cos(a-aspect)
    s1=hs(315,33)/math.sin(math.radians(33));s2=hs(20,58)/math.sin(math.radians(58))
    shade=.68*s1+.32*s2
    rel=elev-blur(elev,8)
    shade=shade*(1+np.clip(rel/P.get('relscale',160),-.2,.2))
    shade=np.clip(1+(shade-1)*P.get('contrast',1.45),.22,1.8)
    # base ground
    col=ramp(np.clip(elev,0,4000),GROUND)
    n_big=fbm(X,Y,mpp,[9000,4000,1600,700,300],3);n_mid=fbm(X,Y,mpp,[600,250,100,40,16,6],5);n_fine=fbm(X,Y,mpp,[60,24,10,4,2],8)
    col*=1+0.05*n_mid[...,None]
    # latitude/humidity tint: drier golden vs lush
    # land cover composites
    def rough(m,amp=.35,k=2):
        t=blur(m,k) if k>1 else m
        return np.clip((t-.5+amp*(n_fine*.6+n_mid*.4))*3.2+.5,0,1)
    for key in('wood','farm','grass','wet','urban'):vm[key]=rough(vm[key],.85 if key=='wood' else .5)
    farm=vm['farm'];grass=vm['grass'];wood=vm['wood'];wet=vm['wet'];rock=vm['rock'];sand=vm['sand'];ice=vm['ice'];urb=vm['urban']
    # farmland = parcels
    th=math.radians(22);c_,s_=math.cos(th),math.sin(th)
    nm=NOM[0]
    wx=fbm(X,Y,mpp,[900,400],21)*38/nm;wy=fbm(X,Y,mpp,[900,400],22)*38/nm
    u=((X+wx)*c_+(Y+wy)*s_)*nm;v=(-(X+wx)*s_+(Y+wy)*c_)*nm
    cu=np.floor(u/max(70,5*nm));cv=np.floor(v/max(260,16*nm))
    hid=_hash(cu.astype(np.float32),cv.astype(np.float32),77)
    pal=np.array([[170,168,114],[142,156,98],[162,148,106],[128,148,90],[178,174,126],[150,138,100]],np.float32)
    fcol=pal[np.minimum((hid*6).astype(np.int32),5)]
    furrow=0.5+0.5*np.sin(u/(3.0)*2*math.pi) if nm<1.2 else 0
    fcol=fcol*(1+0.05*n_fine[...,None])*(1+(0.04*(furrow-.5))[...,None] if nm<1.2 else 1)
    fa=np.clip(farm*1.0,0,1)[...,None]*0.85
    col=col*(1-fa)+fcol*fa
    ga=grass[...,None]*0.8;col=col*(1-ga)+np.array([138,160,84],np.float32)*(1+0.05*n_mid[...,None])*ga
    # woods: broadleaf/conifer mixed canopy
    can=n_fine*1.25+n_mid*0.5
    wcol=np.array([58,86,48],np.float32)*(1+0.18*can[...,None])
    conif=np.clip((n_big*.9+n_mid*.4)+0.2,0,1)[...,None]
    wcol=wcol*(1-.35*conif)+np.array([40,66,44],np.float32)*.35*conif*(1+0.15*can[...,None])
    wa=np.clip(wood*1.0,0,1)[...,None]
    wedge=np.clip(1-np.abs(wood-.5)*2,0,1)[...,None]
    col=col*(1-wa*.93)+wcol*wa*.93
    wta=wet[...,None]*0.7;col=col*(1-wta)+np.array([112,134,104],np.float32)*(1+.07*n_mid[...,None])*wta
    ra=rock[...,None]*0.8;col=col*(1-ra)+np.array([150,142,130],np.float32)*(1+.1*n_fine[...,None])*ra
    sa=sand[...,None]*0.8;col=col*(1-sa)+np.array([206,192,150],np.float32)*sa
    ia=ice[...,None];col=col*(1-ia)+np.array([240,244,248],np.float32)*ia
    # steep slopes expose rock
    sl=np.degrees(slope)/(P.get('vexag',2.2)/2.2)
    ex=np.clip((sl-22)/18,0,1)*np.clip(1-wood*.6,0,1)*(elev>600);col=col*(1-ex[...,None]*.45)+np.array([138,128,114],np.float32)*ex[...,None]*.45
    ua=np.clip(urb,0,1)[...,None]*0.75;col=col*(1-ua)+np.array([142,124,110],np.float32)*(1+.1*n_fine[...,None])*ua
    col=col*(1-.18*wedge)
    col*=shade[...,None]
    if P.get('detail'):
        b=np.clip(vm['bld'],0,1)[...,None];col=col*(1-b*.8)+np.array([92,70,58],np.float32)*b*.8
        tr=np.clip(vm['track'],0,1)[...,None];col=col*(1-tr*.5)+np.array([128,108,78],np.float32)*tr*.5
        rd=np.clip(vm['road'],0,1)[...,None];col=col*(1-rd*.7)+np.array([168,152,118],np.float32)*rd*.7
    # sea / lakes
    depth=np.clip(-elev,0,4000)
    sea=ramp(depth,SEA)
    # shallow lightening toward shore using land blur
    sh=blur(land,max(2,int(16)))
    lake=np.array([84,128,144],np.float32)
    isea=np.clip((-elev-3)/12,0,1)[...,None]
    wcolr=lake*(1-isea)+sea*isea
    wcolr=wcolr*(1+0.05*n_mid[...,None])
    wcolr=wcolr*(1+0.10*np.clip(sh,0,1)[...,None])
    out=col*(1-water[...,None])+wcolr*water[...,None]
    S=sat_window(z,XS,YS,Wd,Ht) if P.get('sat') else None
    if S is not None:
        l0=S.mean(-1);mx=S.max(-1);mn=S.min(-1);sat0=(mx-mn)/np.maximum(mx,1)
        bright=np.clip((l0*P.get('satgain',1.45)-150)/40,0,1)*np.clip((0.2-sat0)/0.1,0,1)
        mod=np.clip(vm['modern']+vm['bld']*.8+vm['urban']*.6+bright,0,1)
        mod=np.clip(blur(mod,max(2,int(P.get('modblur',3))))*1.8,0,1)
        S=S*P.get('satgain',1.45)
        S=np.clip(S,0,255)
        lum=S.mean(-1,keepdims=True);S=lum+(S-lum)*P.get('satsat',0.78);S=S*np.array([1.03,1.0,0.94],np.float32)
        keep=1-mod
        gmean=(S*keep[...,None]).sum((0,1))/max(keep.sum(),1)
        fill=np.zeros_like(S);rem=np.ones(mod.shape,np.float32)
        for k in (P.get('fill1',6),P.get('fill2',24),P.get('fill3',96)):
            f_,d_=nblur(S,keep,k);wgt=np.clip(d_*3,0,1)*rem
            fill+=f_*wgt[...,None];rem=rem*(1-np.clip(d_*3,0,1))
        fill+=gmean[None,None,:]*rem[...,None]
        fill=fill*(1+0.07*n_fine[...,None])*(1+0.05*n_mid[...,None])
        C=S*(1-mod[...,None])+fill*mod[...,None]
        k=P.get('satrelief',.55)
        out=C*(1+k*(shade[...,None]-1))
        if P.get('detail'):
            b_=np.clip(vm['bld'],0,1)[...,None];out=out*(1-b_*.85)+np.array([96,72,58],np.float32)*b_*.85
            tr_=np.clip(vm['track'],0,1)[...,None];out=out*(1-tr_*.35)+np.array([140,120,88],np.float32)*tr_*.35
    # rivers
    rv=raster_rivers(z,XS,YS,Wd,Ht,P.get('mindis',1.0))
    if S is not None:rv=rv*0.35
    if P.get('detail'):
        sr=np.clip(vm['stream'],0,1);rv=np.maximum(rv,sr*0.9)
    rv=np.clip(rv,0,1)[...,None]*(1-water[...,None]*0.9)
    out=out*(1-rv*.9)+np.array([62,106,136],np.float32)*(1+.15*(n_fine[...,None]))*rv*.9
    # shoreline: thin dark edge
    edge=np.clip(1-np.abs(water-.5)*2,0,1)[...,None]
    if S is None:out*=1-.22*edge
    # grade
    out=np.clip(out,0,255);out=(out-128)*1.05+128;out*=np.array([1.04,1.0,0.93],np.float32)
    # paper-ish grain
    g=fbm(X,Y,mpp,[3,1.5],41)*0.0
    out=out[m:m+h,m:m+w]
    return np.clip(out,0,255).astype(np.uint8)

PARAMS={'z11':dict(zd=11,zv=10,ss=2,mindis=0.8,vexag=2.2,contrast=1.45,relscale=160),'z11sat':dict(zd=11,zv=10,ss=2,mindis=2,vexag=2.2,contrast=1.2,relscale=160,sat=True,satrelief=.7,modblur=2,fill1=5,fill2=20,fill3=96),'overview':dict(zd=10,zv=10,ss=2,mindis=1.2,vexag=2.2,contrast=1.45,relscale=160),
        'battle':dict(zd=12,zv=14,ss=2,mindis=0.05,vexag=3.5,contrast=1.2,detail=True,microrelief=0.9,relscale=6,sat=True,satrelief=.5,modblur=2,fill1=10,fill2=40,fill3=160)}
GRADE=[False]
def save_tile(z,x,y,arr):
    p=OUT/f'{z}/{x}/{y}.jpg';p.parent.mkdir(parents=True,exist_ok=True)
    im=Image.fromarray(arr)
    if GRADE[0]:
        from PIL import ImageEnhance
        im=ImageEnhance.Brightness(im).enhance(1.2);im=ImageEnhance.Color(im).enhance(1.1);im=ImageEnhance.Contrast(im).enhance(1.04)
    im.save(p,quality=84,optimize=True,progressive=True)
def run_zoom(mode,z,xa,xb,ya,yb,block=8,procs=4):
    P=PARAMS[mode];jobs=[]
    for bx in range(xa,xb+1,block):
        for by in range(ya,yb+1,block):
            jobs.append((mode,z,bx,by,min(block,xb-bx+1),min(block,yb-by+1)))
    with Pool(procs) as pool:
        for (md,zz,bx,by,nx,ny),img in pool.imap_unordered(render_job,jobs):
            for i in range(nx):
                for k in range(ny):
                    save_tile(zz,bx+i,by+k,img[k*256:(k+1)*256,i*256:(i+1)*256])
            print('block',zz,bx,by,flush=True)
def render_job(j):
    mode,z,bx,by,nx,ny=j;P=dict(PARAMS['battle'],vexag=4.0,microrelief=0.5) if mode=='battlehi' else PARAMS[mode]
    img=render(z,bx*256,by*256,nx*256,ny*256,P['zd'],P['zv'],P)
    return j,img
def make_pyramid(zmax,zmin,xa,xb,ya,yb):
    for z in range(zmax-1,zmin-1,-1):
        xa,xb,ya,yb=xa//2,xb//2,ya//2,yb//2
        for x in range(xa,xb+1):
            for y in range(ya,yb+1):
                im=Image.new('RGB',(512,512),(29,58,77))
                for i in range(2):
                    for k in range(2):
                        p=OUT/f'{z+1}/{2*x+i}/{2*y+k}.jpg'
                        if p.exists():im.paste(Image.open(p),(i*256,k*256))
                save_tile(z,x,y,np.asarray(im.resize((256,256),Image.LANCZOS)))
        print('pyramid',z,flush=True)
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='test':  # small test window around Vienna
        z=10;x,y=wpx(16.4,48.2,z);img=render(z,int(x)-512,int(y)-384,1024,768,10,10,PARAMS['overview'])
        Image.fromarray(img).save('/tmp/test_overview.jpg',quality=88);print('ok')
    elif mode=='testbattle':
        z=14;x,y=wpx(17.381,50.8475,z);img=render(z,int(x)-640,int(y)-480,1280,960,12,14,PARAMS['battle'])
        Image.fromarray(img).save('/tmp/test_battle.jpg',quality=90);print('ok')
    elif mode=='testsat':
        z=11;x,y=wpx(14.43,50.09,z);img=render(z,int(x)-700,int(y)-450,1400,900,11,10,PARAMS['z11sat'])
        Image.fromarray(img).save('/tmp/test_sat.jpg',quality=90);print('ok')
    elif mode=='testbattlesat':
        z=14;x,y=wpx(17.381,50.8475,z);P=dict(PARAMS['battle'],sat=True,contrast=1.2,satrelief=.5,modblur=2,fill1=10,fill2=40)
        img=render(z,int(x)-640,int(y)-480,1280,960,12,14,P);Image.fromarray(img).save('/tmp/test_battlesat.jpg',quality=90);print('ok')
    elif mode=='z11':
        a=[int(v//256) for v in wpx(9.0,46.0,11)];b=[int(v//256) for v in wpx(22.0,52.6,11)]
        print('z11',a,b,flush=True);run_zoom('z11sat',11,a[0],b[0],b[1],a[1],8,4);make_pyramid(11,5,a[0],b[0],b[1],a[1])
    elif mode=='overview':
        # z10 tile range covering lon 7.8..24.2, lat 44.8..53.2
        xa,yb=[int(v//256) for v in wpx(8.0,45.0,10)];xb,ya=[int(v//256) for v in wpx(24.0,53.0,10)]
        print('z10',xa,xb,ya,yb)
        run_zoom('overview',10,xa,xb,ya,yb,8,4);make_pyramid(10,5,xa,xb,ya,yb)
    elif mode=='battlehi':
        P=PARAMS['battle'];PARAMS['battlehi']=dict(P,vexag=4.0,microrelief=0.5)
        for z in (15,16):
            a=[int(v//256) for v in wpx(17.345,50.865,z)];b=[int(v//256) for v in wpx(17.425,50.825,z)]
            run_zoom('battlehi',z,a[0],b[0],a[1],b[1],6,4)
    elif mode=='battle':
        a=[int(v//256) for v in wpx(17.29,50.90,14)];b=[int(v//256) for v in wpx(17.47,50.80,14)]
        xa,ya=a;xb,yb=b
        run_zoom('battle',14,xa,xb,ya,yb,6,4);make_pyramid(14,11,xa,xb,ya,yb)

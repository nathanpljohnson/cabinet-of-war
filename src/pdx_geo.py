"""Data for the Paradox-style political map: provinces as shared arcs (so neighbours stay matched after
simplifying), border kind per arc, and a curved label path per realm.
usage: python3 pdx_geo.py   (reads Natural Earth admin-1 from the original workspace; writes src/pdx.json)
Set COW_WORK to point at another copy of that workspace's `work/` folder."""
import json,math,os
from collections import defaultdict
import numpy as np
from PIL import Image,ImageDraw
from pathlib import Path
SRC=Path(__file__).resolve().parent
WORK=Path(os.environ.get('COW_WORK','~/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work')).expanduser()
# reuse the realm table from realms.py (single source of truth for which province belongs to which realm)
head=(SRC/'realms.py').read_text().split('def load():')[0]
for a,b in [("W=Path(__file__).resolve().parents[1]","W=WORK"),("OUT=Path(sys.argv[1])","")]:
    assert a in head,a;head=head.replace(a,b)
exec(head)
KEYS=list(COL.keys())
SHORT={'austria':'Austria','inner':'Inner Austria','tyrol':'Tyrol','bohemia':'Bohemia','moravia':'Moravia','silesia':'Silesia','hungary':'Hungary','milan':'Milan',
       'bavaria':'Bavaria','saxony':'Saxony','prussia':'Prussia','poland':'Poland','salzburg':'Salzburg','venice':'Venice','swiss':'Switzerland','empire':'Imperial States',
       'ottoman':'Ottoman Empire','austnl':'Austrian Netherlands','france':'France','spain':'Spain','portugal':'Portugal','dutch':'Dutch Republic','britain':'Great Britain',
       'denmark':'Denmark–Norway','sweden':'Sweden','russia':'Russia','savoy':'Savoy','genoa':'Genoa','papal':'Papal States','tuscany':'Tuscany','twosicilies':'Naples',
       'modena':'Modena','parma':'Parma','lucca':'Lucca'}
SECOND={'savoy':'Sardinia'}   # name for a realm's second labelled landmass
KEEP=(-14,32,47,73)          # provinces whose bbox touches this box are kept whole
VIEW=(-12,34,45,72)          # label placement is limited to the playable map
THEATRE=(7,44,24,54)         # finer simplification here
Q=1e5

def merc(lon,lat):
    la=np.radians(np.clip(lat,-85,85));return (np.asarray(lon)+180)/360*256,(1-np.log(np.tan(la)+1/np.cos(la))/np.pi)/2*256
def unmerc(x,y):
    return x/256*360-180,np.degrees(np.arctan(np.sinh(np.pi*(1-2*np.asarray(y)/256))))

# ---------- load provinces ----------
attrs=read_dbf_attributes(str(WORK/'borders/admin1/ne_10m_admin_1_states_provinces.dbf'))
geoms=read_shp_geometries(str(WORK/'borders/admin1/ne_10m_admin_1_states_provinces.shp'))
prov=[];rings=[]
for st,parts,rn in geoms:
    a=attrs[rn-1]
    if not a:continue
    cl_region=cl(a.get('region'))
    r=realm(cl(a.get('iso_a2')),cl(a.get('name')))
    if not r:continue
    xs=[p[0] for part in parts for p in part];ys=[p[1] for part in parts for p in part]
    if max(xs)<KEEP[0] or min(xs)>KEEP[2] or max(ys)<KEEP[1] or min(ys)>KEEP[3]:continue
    pi=len(prov);mine=[];big=None;bigA=0
    for part in parts:
        ring=[]
        for x,y in part:
            v=(round(x*Q),round(y*Q))
            if not ring or ring[-1]!=v:ring.append(v)
        if len(ring)>1 and ring[0]==ring[-1]:ring.pop()
        if len(ring)<3:continue
        mine.append(ring)
        ar=sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))/2
        if ar<0 and -ar>bigA:bigA=-ar;big=ring
    if big is None:continue
    own=list(range(len(rings),len(rings)+len(mine)));rings+=[(pi,r_) for r_ in mine]
    x=np.array([p[0] for p in big],float)/Q;y=np.array([p[1] for p in big],float)/Q
    x1=np.roll(x,-1);y1=np.roll(y,-1);c=x*y1-x1*y;A=c.sum()/2
    cx,cy=((x+x1)*c).sum()/(6*A),((y+y1)*c).sum()/(6*A)
    prov.append({'r':KEYS.index(r),'name':cl(a.get('name')) or '','c':(round(float(cy),3),round(float(cx),3)),'rings':own})
print('provinces',len(prov),'rings',len(rings),'vertices',sum(len(r) for _,r in rings))

# ---------- topology: junctions, arcs ----------
nb=defaultdict(set)
for _,ring in rings:
    n=len(ring)
    for i in range(n):nb[ring[i]].update((ring[i-1],ring[(i+1)%n]))
J={v for v,s in nb.items() if len(s)!=2}
del nb
arcid={};arcs=[];owners=[]
def canon(seq,closed):
    if closed:
        m=seq.index(min(seq));seq=seq[m:]+seq[:m]+[seq[m]]
    t=tuple(seq);r=t[::-1]
    return (t,1) if t<=r else (r,-1)
ringrefs=[]
for ri,(pi,ring) in enumerate(rings):
    n=len(ring);idx=[i for i in range(n) if ring[i] in J];refs=[]
    pieces=[(ring,True)] if not idx else [((ring[i:j+1] if j>i else ring[i:]+ring[:j+1]),False) for i,j in zip(idx,idx[1:]+idx[:1])]
    for seq,closed in pieces:
        t,d=canon(seq,closed)
        if t not in arcid:arcid[t]=len(arcs);arcs.append(t);owners.append([])
        a=arcid[t];owners[a].append(pi);refs.append(a if d==1 else ~a)
    ringrefs.append(refs)
del arcid
print('arcs',len(arcs))

# ---------- simplify each arc once (Douglas–Peucker in Mercator) ----------
def dp(x,y,tol):
    n=len(x);keep=np.zeros(n,bool);keep[0]=keep[-1]=True;st=[(0,n-1)]
    while st:
        a,b=st.pop()
        if b<=a+1:continue
        dx,dy=x[b]-x[a],y[b]-y[a];L=math.hypot(dx,dy)
        xs,ys=x[a+1:b],y[a+1:b]
        d=np.abs(dy*(xs-x[a])-dx*(ys-y[a]))/L if L>0 else np.hypot(xs-x[a],ys-y[a])
        k=int(d.argmax())
        if d[k]>tol:i=a+1+k;keep[i]=True;st+=[(a,i),(i,b)]
    return keep
out_arcs=[];kind=[]
def fam(r):return FAM[KEYS[r]]
for a,t in enumerate(arcs):
    lon=np.array([p[0] for p in t],float)/Q;lat=np.array([p[1] for p in t],float)/Q
    mx,my=merc(lon,lat)
    inT=lon.max()>=THEATRE[0] and lon.min()<=THEATRE[2] and lat.max()>=THEATRE[1] and lat.min()<=THEATRE[3]
    tol=(0.8/512) if inT else (1.0/128)
    if t[0]==t[-1] and len(t)>3:   # closed loop: keep a far point so the ring cannot collapse
        far=int(np.hypot(mx-mx[0],my-my[0]).argmax());k1=dp(mx[:far+1],my[:far+1],tol);k2=dp(mx[far:],my[far:],tol);keep=np.concatenate([k1,k2[1:]])
    else:keep=dp(mx,my,tol)
    q=np.round(np.stack([lon[keep],lat[keep]],1)*1e4).astype(np.int64)
    d=np.concatenate([q[:1],np.diff(q,axis=0)]).ravel().tolist();out_arcs.append(d)
    o=owners[a];rs={prov[p]['r'] for p in o}
    kind.append('x' if len(o)<2 else 'p' if len(rs)==1 else 's' if len({fam(r) for r in rs})>1 else 'c')
print('kept vertices',sum(len(d)//2 for d in out_arcs),'kinds',{k:kind.count(k) for k in 'spcx'})
# boundary arcs per realm (for the inner colour band and the selection outline)
bound=defaultdict(list)
for a,o in enumerate(owners):
    if kind[a]=='p':continue
    for p in o:
        if a not in bound[prov[p]['r']]:bound[prov[p]['r']].append(a)

# ---------- curved label paths ----------
Z=5;S=2**Z
X0,Y1=merc(VIEW[0],VIEW[1]);X1,Y0=merc(VIEW[2],VIEW[3]);X0,X1,Y0,Y1=float(X0)*S,float(X1)*S,float(Y0)*S,float(Y1)*S
Wd,Ht=int(X1-X0)+1,int(Y1-Y0)+1
def label_paths(r):
    im=Image.new('L',(Wd,Ht),0);dr=ImageDraw.Draw(im)
    for p in prov:
        if p['r']!=r:continue
        for ri in p['rings']:
            ring=rings[ri][1]
            ar=sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))
            if ar>=0:continue
            mx,my=merc(np.array([v[0] for v in ring])/Q,np.array([v[1] for v in ring])/Q)
            dr.polygon(list(zip((mx*S-X0).tolist(),(my*S-Y0).tolist())),fill=255)
    lab=Image.new('I',(Wd,Ht),0);lab.paste(im);comps=[];nxt=256
    while True:
        a=np.asarray(lab)
        ys,xs=np.nonzero(a==255)
        if not len(ys):break
        ImageDraw.floodfill(lab,(int(xs[0]),int(ys[0])),nxt);n=int((np.asarray(lab)==nxt).sum());comps.append((n,nxt));nxt+=1
    comps.sort(reverse=True);a=np.asarray(lab);res=[]
    for n,c in comps:
        if n<120 or (res and n<0.4*comps[0][0]):break
        ys,xs=np.nonzero(a==c);P=np.stack([xs,ys],1).astype(float);M=(a==c)
        m=P.mean(0);C=np.cov((P-m).T);ev,V=np.linalg.eigh(C)
        name=SECOND.get(KEYS[r],SHORT[KEYS[r]]) if res else SHORT[KEYS[r]]
        def cand(u,bend):
            if (abs(u[1])>abs(u[0]) and u[1]>0) or (abs(u[1])<=abs(u[0]) and u[0]<0):u=-u   # left-to-right, or bottom-to-top when steep
            v=np.array([-u[1],u[0]])
            t=(P-m)@u;s=(P-m)@v;t0,t1=np.percentile(t,[7,93])
            bins=np.linspace(t0,t1,19);mid=[];ww=[];th=[]
            for b0,b1 in zip(bins[:-1],bins[1:]):
                k=(t>=b0)&(t<b1)
                if k.sum()<3:continue
                mid.append(((b0+b1)/2,float(np.median(s[k]))));ww.append(float(k.sum()));lo,hi=np.percentile(s[k],[10,90]);th.append(hi-lo)
            mid=np.array(mid);L=t1-t0
            if bend and len(mid)>=4:
                A=np.polyfit(mid[:,0],mid[:,1],2,w=np.sqrt(ww));A[0]=float(np.clip(A[0],-0.5/L,0.5/L))
            else:A=np.array([0.,0.,float(np.median(s))])
            tt=np.linspace(t0,t1,9);ss=np.polyval(A,tt);pts=m+np.outer(tt,u)+np.outer(ss,v)
            seg=np.hypot(*np.diff(pts,axis=0).T).sum()/S
            # sample the real shape along the path: share of the path inside, and local thickness across it
            ts=np.linspace(t0,t1,41);sp=m+np.outer(ts,u)+np.outer(np.polyval(A,ts),v);dA=np.polyval(np.polyder(A),ts)
            nrm=np.stack([v[0]-dA*u[0],v[1]-dA*u[1]],1);nrm/=np.hypot(nrm[:,0],nrm[:,1])[:,None]
            def inside(q):
                x,y=int(round(q[0])),int(round(q[1]));return 0<=x<M.shape[1] and 0<=y<M.shape[0] and M[y,x]
            cov=np.mean([inside(q) for q in sp]);th=[]
            for q,nv in zip(sp[6:35],nrm[6:35]):
                w=0
                for sg in (1,-1):
                    k=0
                    while k<600 and inside(q+sg*nv*(k+1)*.5):k+=1
                    w+=k*.5
                th.append(w)
            h=float(np.median(th))/S if th else L/S/4
            return min(seg*0.82/(0.8*len(name)),h*0.62)*cov**2,pts,seg,h
        axis=cand(V[:,1],math.sqrt(ev[1]/max(ev[0],1e-9))>=1.45);flat=cand(np.array([1.,0.]),False)
        sc,pts,seg,h=flat if flat[0]*1.15>=axis[0] else axis   # whichever lets the name be biggest; ties go horizontal
        lon,lat=unmerc((pts[:,0]+X0)/S,(pts[:,1]+Y0)/S)
        res.append({'r':r,'t':name,'p':[[round(float(b),3),round(float(a_),3)] for a_,b in zip(lon,lat)],'len':round(float(seg),4),'h':round(h,4)})
    return res
labels=[]
for r in range(len(KEYS)):labels+=label_paths(r)
print('labels',len(labels))

out={'note':'Modern Natural Earth admin-1 provinces grouped into approximate c.1740 realms (see realms.py). Not historical borders.',
     'realms':KEYS,'short':SHORT,'arcs':out_arcs,'kind':''.join(kind),
     'prov':[[p['r'],p['name'],p['c'][0],p['c'][1],[ringrefs[i] for i in p['rings']]] for p in prov],
     'bound':{str(r):v for r,v in bound.items()},'labels':labels}
s=json.dumps(out,ensure_ascii=False,separators=(',',':'))
(SRC/'pdx.json').write_text(s);print('pdx.json',len(s)//1024,'KB')

"""Bold realm / crown-land / province boundary overlay tiles (approximate: modern provinces grouped into 1740 realms).
usage: python realms.py <outdir>"""
import sys,math,json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
from multiprocessing import Pool
W=Path(__file__).resolve().parents[1]
OUT=Path(sys.argv[1])
exec(open(W/'assets/shp2geojson.py').read().split('# Main processing')[0])
def cl(s):
    s=(s or '').replace('\x00','').strip()
    try:return s.encode('latin-1').decode('utf-8')
    except Exception:return s

FAM={'austria':'hab','inner':'hab','tyrol':'hab','bohemia':'hab','moravia':'hab','silesia':'hab','hungary':'hab','milan':'hab',
     'bavaria':'bavaria','saxony':'saxony','prussia':'prussia','poland':'poland','salzburg':'salzburg','venice':'venice','swiss':'swiss','empire':'empire','ottoman':'ottoman',
     'austnl':'hab','france':'france','spain':'spain','portugal':'portugal','dutch':'dutch','britain':'britain','denmark':'denmark','sweden':'sweden','russia':'russia','savoy':'savoy','genoa':'genoa','papal':'papal','tuscany':'tuscany','twosicilies':'twosicilies','modena':'modena','parma':'parma','lucca':'lucca'}
COL={'austria':'#f2c94c','inner':'#e8963a','tyrol':'#cdbb78','bohemia':'#e07b4f','moravia':'#c9b23f','silesia':'#f19a63','hungary':'#d95f5f','milan':'#e8c07a',
     'bavaria':'#6aa5e6','saxony':'#58b384','prussia':'#5c6fa8','poland':'#c05a7a','salzburg':'#a07acb','venice':'#4fb8b8','swiss':'#d8d8d8','empire':'#a89f8c','ottoman':'#7a9a50',
     'austnl':'#e6c07a','france':'#6f8fd6','spain':'#e8a25a','portugal':'#5fa56a','dutch':'#e8883a','britain':'#d86a6a','denmark':'#b86aa0','sweden':'#4aa0c8','russia':'#9fb06e','savoy':'#7a7ad0','genoa':'#c8b458','papal':'#d9d0a0','tuscany':'#c58a52','twosicilies':'#c4709a','modena':'#a898d0','parma':'#9ab0d8','lucca':'#d0a090'}
NAMES={'austria':'Archduchy of Austria','inner':'Inner Austria','tyrol':'Tyrol','bohemia':'Kingdom of Bohemia','moravia':'Margraviate of Moravia','silesia':'Silesia','hungary':'Kingdom of Hungary & Croatia','milan':'Austrian Milan',
       'bavaria':'Electorate of Bavaria','saxony':'Electorate of Saxony','prussia':'Brandenburg-Prussia','poland':'Poland–Lithuania','salzburg':'Archbishopric of Salzburg','venice':'Republic of Venice','swiss':'Swiss Confederation','empire':'Other Imperial states','ottoman':'Ottoman lands','austnl':'Austrian Netherlands','france':'Kingdom of France','spain':'Spain','portugal':'Portugal','dutch':'Dutch Republic','britain':'Great Britain & Ireland','denmark':'Denmark–Norway','sweden':'Sweden','russia':'Russian Empire','savoy':'Kingdom of Sardinia (Savoy)','genoa':'Republic of Genoa','papal':'Papal States','tuscany':'Grand Duchy of Tuscany','twosicilies':'Kingdom of the Two Sicilies','modena':'Duchy of Modena','parma':'Duchy of Parma','lucca':'Republic of Lucca'}
CZB={'Prague','Středočeský','Jihočeský','Plzeňský','Karlovarský','Ústecký','Liberecký','Královéhradecký','Pardubický'}
CZM={'Olomoucký','Zlínský','Jihomoravský','Vysočina'}
cl_region=''
def realm(iso,name):
    if iso=='AT':
        return {'Wien':'austria','Niederösterreich':'austria','Oberösterreich':'austria','Steiermark':'inner','Kärnten':'inner','Tirol':'tyrol','Vorarlberg':'tyrol','Salzburg':'salzburg','Burgenland':'hungary'}.get(name)
    if iso=='CZ':return 'bohemia' if name in CZB else 'moravia' if name in CZM else 'silesia' if name=='Moravskoslezský' else None
    if iso=='PL':
        if name in('Lower Silesian','Opole','Silesian'):return 'silesia'
        if name in('Lubusz','West Pomeranian','Warmian-Masurian'):return 'prussia'
        return 'poland'
    if iso in('SK','HU','HR'):return 'hungary'
    if iso=='RS':return 'hungary' if name in('Severno-Backi','Zapadno-Backi','Severno-Banatski','Sremski','Južno-Backi','Srednje-Banatski','Južno-Banatski') else 'ottoman'
    if iso=='RO':return 'hungary' if name in('Satu Mare','Arad','Bihor','Timis','Caras-Severin','Cluj','Alba','Hunedoara','Sibiu','Brasov','Mures','Harghita','Covasna','Bistrita-Nasaud','Salaj','Maramures') else 'ottoman'
    if iso=='SI':return 'inner'
    if iso=='IT':
        reg=cl_region
        if name=='Lucca':return 'lucca'
        if name in('Parma','Piacenza'):return 'parma'
        if name in('Modena','Reggio Emilia','Massa-Carrara'):return 'modena'
        if name in('Bozen','Trento'):return 'tyrol'
        if name in('Gorizia','Trieste'):return 'inner'
        return {'Piemonte':'savoy',"Valle d'Aosta":'savoy','Sardegna':'savoy','Liguria':'genoa','Lombardia':'milan','Veneto':'venice','Friuli-Venezia Giulia':'venice','Trentino-Alto Adige':'tyrol','Emilia-Romagna':'papal','Toscana':'tuscany','Marche':'papal','Umbria':'papal','Lazio':'papal','Abruzzo':'twosicilies','Molise':'twosicilies','Campania':'twosicilies','Apulia':'twosicilies','Basilicata':'twosicilies','Calabria':'twosicilies','Sicily':'twosicilies'}.get(reg)
    whole={'FR':'france','ES':'spain','PT':'portugal','NL':'dutch','BE':'austnl','LU':'austnl','DK':'denmark','NO':'denmark','IS':'denmark','SE':'sweden','FI':'sweden','EE':'russia','LV':'russia','LT':'poland','BY':'poland','RU':'russia','GB':'britain','IE':'britain','TR':'ottoman','BG':'ottoman','GR':'ottoman','AL':'ottoman','MK':'ottoman','ME':'ottoman','BA':'ottoman','MD':'ottoman','CY':'ottoman'}
    if iso in whole:
        if iso=='RU' and name=='Kaliningrad':return 'prussia'
        return whole[iso]
    if iso=='UA':
        if name=='Transcarpathia':return 'hungary'
        if name in('Odessa','Kherson','Mykolayiv','Chernivtsi'):return 'ottoman'
        if name in('Volyn','Rivne',"L'viv","Ternopil'","Khmel'nyts'kyy","Ivano-Frankivs'k",'Vinnytsya','Zhytomyr','Kiev'):return 'poland'
        return 'russia'
    if iso=='DE':
        if name=='Bayern':return 'bavaria'
        if name=='Sachsen':return 'saxony'
        if name in('Brandenburg','Berlin','Sachsen-Anhalt'):return 'prussia'
        if name=='Schleswig-Holstein':return 'denmark'
        return 'empire'
    if iso=='CH':return 'swiss'
    return None

def load():
    attrs=read_dbf_attributes(str(W/'borders/admin1/ne_10m_admin_1_states_provinces.dbf'))
    geoms=read_shp_geometries(str(W/'borders/admin1/ne_10m_admin_1_states_provinces.shp'))
    keys=list(COL.keys());fams=sorted(set(FAM.values()));polys=[]
    for st,parts,rn in geoms:
        a=attrs[rn-1]
        if not a:continue
        global cl_region
        cl_region=cl(a.get('region'))
        r=realm(cl(a.get('iso_a2')),cl(a.get('name')))
        if not r:continue
        rings=[]
        for ring in parts:
            ar=sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))/2
            if ar<0:rings.append(np.array(ring,np.float64))   # outer rings only
        if not rings:continue
        bb=(min(x[:,0].min() for x in rings),max(x[:,0].max() for x in rings),min(x[:,1].min() for x in rings),max(x[:,1].max() for x in rings))
        polys.append({'r':keys.index(r)+1,'f':fams.index(FAM[r])+1,'p':len(polys)+1,'rings':rings,'bb':bb,'area':(bb[1]-bb[0])*(bb[3]-bb[2])})
    polys.sort(key=lambda p:-p['area'])
    return polys,keys,fams
POLYS,KEYS,FAMS=load()
COREF={'hab','bavaria','saxony','prussia','poland'}
Fcore=np.zeros(len(POLYS)+2,np.int32)
for p in POLYS:Fcore[p['p']]=1 if FAM[KEYS[p['r']-1]] in COREF else 0
def hexrgb(h):return tuple(int(h[i:i+2],16) for i in (1,3,5))

def wpx(lon,lat,z):
    n=256*2**z
    return (lon+180)/360*n,(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n
def unwpx(x,y,z):
    n=256*2**z;return x/n*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n))))

def maxf(a,k):
    im=Image.fromarray((a*255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(k)),np.float32)/255

def render(z,bx,by,nx,ny):
    m=6;X0,Y0=bx*256-m,by*256-m;Wd,Ht=nx*256+2*m,ny*256+2*m
    lo=unwpx(X0,Y0+Ht,z);hi=unwpx(X0+Wd,Y0,z)
    imR=Image.new('I',(Wd,Ht),0);imF=Image.new('I',(Wd,Ht),0);imP=Image.new('I',(Wd,Ht),0)
    dR=ImageDraw.Draw(imR);dF=ImageDraw.Draw(imF);dP=ImageDraw.Draw(imP)
    for p in POLYS:
        b=p['bb']
        if b[1]<lo[0] or b[0]>hi[0] or b[3]<lo[1] or b[2]>hi[1]:continue
        for ring in p['rings']:
            n=256*2**z
            xs=(ring[:,0]+180)/360*n-X0
            la=np.radians(np.clip(ring[:,1],-85,85));ys=(1-np.log(np.tan(la)+1/np.cos(la))/np.pi)/2*n-Y0
            pts=list(zip(xs.tolist(),ys.tolist()))
            if len(pts)<3:continue
            dR.polygon(pts,fill=p['r']);dF.polygon(pts,fill=p['f']);dP.polygon(pts,fill=p['p'])
    R=np.asarray(imR);F=np.asarray(imF);Pn=np.asarray(imP)
    def edge(a,both=True):
        e=np.zeros(a.shape,bool)
        for ax in (0,1):
            for s in (1,-1):
                n_=np.roll(a,s,ax);e|=(a!=n_)&((a>0)&(n_>0) if both else True)
        return e.astype(np.float32)
    bF=edge(F);bR=edge(R)*(1-bF);bP=edge(Pn)*(1-bF)*(1-bR)*(1 if z>=6 else 0)
    bP=bP*np.isin(Fcore[Pn],[1])
    # tint
    out=np.zeros((Ht,Wd,4),np.float32)
    pal=np.array([(0,0,0)]+[hexrgb(COL[k]) for k in KEYS],np.float32)
    out[...,:3]=pal[R];out[...,3]=np.where(R>0,0.17*255,0)
    # darker, slightly stronger tint toward each realm edge for zone read
    inner=1-maxf(np.maximum(bF,bR),7)
    # lines
    def comp(layer,rgb,alpha):
        a=np.clip(layer,0,1)[...,None]*alpha
        out[...,:3]=out[...,:3]*(1-a)+np.array(rgb,np.float32)*a
        out[...,3]=np.maximum(out[...,3],a[...,0]*255)
    comp(maxf(bP,3)*0.0+bP,(110,82,50),0.6)                          # provinces 1px thin
    big=z>=6
    comp(bR,(70,40,18),0.85)
    comp(maxf(bF,5 if big else 3),(250,236,190),0.35)
    comp(maxf(bF,3) if big else bF,(34,18,10),0.92)
    o=out[m:m+ny*256,m:m+nx*256]
    return np.clip(o,0,255).astype(np.uint8)

def job(a):
    z,bx,by,nx,ny=a;return a,render(z,bx,by,nx,ny)
def runz(z,xa,xb,ya,yb,block=8,procs=4):
    jobs=[(z,bx,by,min(block,xb-bx+1),min(block,yb-by+1)) for bx in range(xa,xb+1,block) for by in range(ya,yb+1,block)]
    with Pool(procs) as pool:
        for (zz,bx,by,nx,ny),img in pool.imap_unordered(job,jobs):
            for i in range(nx):
                for k in range(ny):
                    t=img[k*256:(k+1)*256,i*256:(i+1)*256]
                    if t[...,3].max()==0:continue
                    p=OUT/f'{zz}/{bx+i}/{by+k}.png';p.parent.mkdir(parents=True,exist_ok=True)
                    Image.fromarray(t,'RGBA').save(p,optimize=True)
            print('block',zz,bx,by,flush=True)
def rng(z,bb):
    a=[int(v//256) for v in wpx(bb[0],bb[1],z)];b=[int(v//256) for v in wpx(bb[2],bb[3],z)];return a[0],b[0],b[1],a[1]
def labels():
    out=[]
    for ki,k in enumerate(KEYS):
        best=None;ar=0
        for p in POLYS:
            if p['r']!=ki+1:continue
            for ring in p['rings']:
                a=abs(sum(ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1] for i in range(len(ring)))/2)
                if a>ar:ar=a;best=ring
        if best is None:continue
        # area-weighted centroid
        x=best[:,0];y=best[:,1];x1=np.roll(x,-1);y1=np.roll(y,-1);cr=x*y1-x1*y;A=cr.sum()/2
        if abs(A)<1e-9:continue
        cx=((x+x1)*cr).sum()/(6*A);cy=((y+y1)*cr).sum()/(6*A)
        out.append({'k':k,'name':NAMES[k],'lat':round(float(cy),3),'lon':round(float(cx),3),'area':round(float(ar),2)})
    return out
if __name__=='__main__':
    E=(-12,34,45,72);C=(0,40,34,58);T=(8,45,23,53)
    for z in range(3,11):
        bb=E if z<=7 else C if z==8 else T
        xa,xb,ya,yb=rng(z,bb);runz(z,xa,xb,ya,yb)
    json.dump({'names':NAMES,'colors':COL,'fam':FAM,'labels':labels()},open(OUT/'legend.json','w'))

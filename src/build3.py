import json,re,math
from pathlib import Path
root=Path(__file__).resolve().parents[2];w=root/'work'
t=(w/'v3/desk.template.html').read_text()
css=(w/'assets/vendor/leaflet.css').read_text();css=re.sub(r'url\([^)]*images/[^)]*\)','none',css)
js=(w/'assets/vendor/leaflet.js').read_text().replace('</script','<\\/script')
g=json.loads((w/'assets/geo.json').read_text());geo=json.dumps({'places':g['places'],'regions':g['regions']},ensure_ascii=False,separators=(',',':'))
state=json.loads((w/'v3/state.json').read_text())
fnd=(root/'outputs/CAMPAIGN-FOUNDATION.md').read_text()
contract=fnd.split('## Durable adjudication contract\n')[1].split('## State and continuity')[0].strip()
contract='\n'.join(l for l in contract.splitlines() if 'one to two weeks' not in l)
contract+='\n- Time is event-driven: advance under standing instructions until developments exceed them or materially change the stakes. Dialogue does not by itself consume a strategic turn.\n- Concealed state must have documented, supported-inference, disputed, or campaign-invention status. Never invent archival quotations.'
rules={'contract':contract,'scene':'Characters speak from pre-existing priorities and only what they could know. Consequences begin immediately: record promises, disclosures, refusals. Do not advance the wider world; that happens at Resolve. End the scene naturally.'}
def tl(z,x,y):
    n=2**z;lon=x/n*360-180;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n))));return lat,lon
def bounds(z,xa,xb,ya,yb):
    n,w_=tl(z,xa,ya);s,e=tl(z,xb+1,yb+1);return {'south':s,'west':w_,'north':n,'east':e}
ob=bounds(10,534,580,333,368);bb=bounds(14,8978,8987,5492,5499)
import os
xs=sorted(int(p.name) for p in (root/'outputs/battle/16').iterdir() if p.name.isdigit());ys=sorted(int(f.stem) for f in (root/'outputs/battle/16').rglob('*.jpg'))
hb=bounds(16,xs[0],xs[-1],ys[0],ys[-1])
meta={'bounds':ob,'battle':{'bounds':[[bb['south'],bb['west']],[bb['north'],bb['east']]]},'hi':[[hb['south'],hb['west']],[hb['north'],hb['east']]]}
keep={'Austrian Empire','Milan','Prussia','Brandenburg','Hohenzollern','Polish–Lithuanian Commonwealth','Ottoman Empire','Venice','Sweden','Hanover','Holy Roman Empire'}
realms=[{'name':f['name'],'rings':f['rings']} for f in json.loads((w/'borders/borders_1715.json').read_text())['features'] if f['name'] in keep]
d11=root/'outputs/tiles/11'
if d11.exists():
    xs=sorted(int(p.name) for p in d11.iterdir() if p.name.isdigit());ys=sorted(int(f.stem) for f in d11.rglob('*.jpg'))
    zb=bounds(11,xs[0],xs[-1],ys[0],ys[-1]);meta['bounds']=zb
p14=root/'outputs/paint/14';p17=root/'outputs/paint/17'
def rng(d):
    xs=sorted(int(p.name) for p in d.iterdir() if p.name.isdigit());ys=sorted(int(f.stem) for f in d.rglob('*.jpg'));return xs[0],xs[-1],ys[0],ys[-1]
if p14.exists() and p17.exists():
    a=bounds(14,*rng(p14));c=bounds(17,*rng(p17))
    meta['paintLo']=[[a['south'],a['west']],[a['north'],a['east']]];meta['paintHi']=[[c['south'],c['west']],[c['north'],c['east']]]
import sys
sys.path.insert(0,str(w/'v3'))
from cities import CITIES
sites=[]
for cid,(lat,lon,nm) in CITIES.items():
    d=root/'outputs/cities'/cid/'16'
    if not d.exists():continue
    xs=sorted(int(p.name) for p in d.iterdir() if p.name.isdigit());ys=sorted(int(f.stem) for f in d.rglob('*.jpg'))
    bb=bounds(16,xs[0],xs[-1],ys[0],ys[-1])
    sites.append({'id':cid,'name':nm,'lat':lat,'lon':lon,'bounds':[[bb['south'],bb['west']],[bb['north'],bb['east']]]})
meta['sites']=sites
lg=root/'outputs/realms/legend.json'
meta['realms']=json.loads(lg.read_text()) if lg.exists() else {'names':{},'colors':{}}
j=lambda o:json.dumps(o,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
fonts=(w/'fonts/fell_embedded.css').read_text()
out=t.replace('/*FONTS*/',fonts).replace('/*LEAFLET_CSS*/',css).replace('/*LEAFLET_JS*/',js).replace('__RULES__',j(rules)).replace('__STATE__',j(state)).replace('__GEO__',geo.replace('<','\\u003c')).replace('__META__',j(meta)).replace('__REALMS__',j(realms)).replace('__BATTLEDATA__',(w/'v3/battle_data.json').read_text())
(root/'outputs/cabinet-of-war.html').write_text(out);(root/'outputs/opening-state.example.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
print(len(out),meta['bounds'])

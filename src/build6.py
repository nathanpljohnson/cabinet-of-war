import json,re,math,base64
from pathlib import Path
root=Path(__file__).resolve().parents[2];w=root/'work'
t=(w/'v6/desk.template.html').read_text()
css=(w/'assets/vendor/leaflet.css').read_text();css=re.sub(r'url\([^)]*images/[^)]*\)','none',css)
js=(w/'assets/vendor/leaflet.js').read_text().replace('</script','<\\/script')
state=json.loads((w/'v6/state.json').read_text())
fnd=(root/'outputs/CAMPAIGN-FOUNDATION.md').read_text()
contract=fnd.split('## Durable adjudication contract\n')[1].split('## State and continuity')[0].strip()
contract='\n'.join(l for l in contract.splitlines() if 'one to two weeks' not in l)
contract+='\n- A hidden world model (hidden.world) holds systems, plot threads, stakes and a calendar. Advance it by cause, not by script; reveal signals to the player only through reports, envoys and rumours at plausible delays. If the player changes a precondition, change the plot; never force the historical timeline back.\n- The player must be able to lose. Defeat, disgrace, inquiry, lost provinces and empty chests are legitimate outcomes; do not protect the player by fiat. Research-draft items marked inference/unverified are hypotheses, never stated as fact.\n- The player never does logistics: the staff handle supply, quarters, wagons and pay. Report to the player only what he would learn (failures, delays, costs).\n- Table-battle results are inputs: turn them into campaign consequences realistically (guns, officers, fortresses, credit, court inquiry).\n- Time is event-driven: advance under standing instructions until developments exceed them or materially change the stakes. Dialogue does not by itself consume a strategic turn.\n- Concealed state must have documented, supported-inference, disputed, or campaign-invention status. Never invent archival quotations.'
rules={'contract':contract,'scene':'Characters speak from pre-existing priorities and only what they could know. Consequences begin immediately: record promises, disclosures, refusals. Do not advance the wider world; that happens at Resolve. End the scene naturally.'}
def bounds(z,xa,xb,ya,yb):
    n=2**z
    def tl(x,y):return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n)))),x/n*360-180
    a,b=tl(xa,ya);c,d=tl(xb+1,yb+1);return {'south':c,'west':b,'north':a,'east':d}
rg=json.loads((root/'outputs/tiles1740/ranges.json').read_text()) if (root/'outputs/tiles1740/ranges.json').exists() else None
if rg:
    E=bounds(7,*rg['E']);C=bounds(8,*rg['C']);T=bounds(10,*rg['T10'])
else:
    E={'south':34,'west':-12,'north':72,'east':45};C={'south':40,'west':0,'north':58,'east':34};T={'south':45,'west':8,'north':53,'east':23}
CITIES=json.loads((w/'v6/cities.json').read_text())
sites=[]
bd=root/'outputs/paint'
def site_from(d,sid,name,lat,lon,path,blocks):
    d=Path(d)
    def rngz(z):
        dz=d/str(z)
        if not dz.exists():return None
        xs=sorted(int(p.name) for p in dz.iterdir() if p.name.isdigit());ys=sorted(int(f.stem) for f in dz.rglob('*.webp'))
        if not xs or not ys:return None
        bb=bounds(z,xs[0],xs[-1],ys[0],ys[-1]);return [[bb['south'],bb['west']],[bb['north'],bb['east']]]
    b12,b14,b16=rngz(12),rngz(14),rngz(16)
    if not (b12 and b14 and b16):return
    sites.append({'id':sid,'name':name,'lat':lat,'lon':lon,'path':path,'blocks':blocks,'bounds':b12,'b12':b12,'b14':b14,'b16':b16})
site_from(root/'outputs/paint','mollwitz','Mollwitz (Małujowice)',50.8475,17.381,'paint',False)
for cid,(lat,lon,nm) in CITIES.items():site_from(root/'outputs/cities'/cid,cid,nm,lat,lon,'cities/'+cid,True)
lg=root/'outputs/realms1740/legend.json'
realms=json.loads(lg.read_text()) if lg.exists() else {'names':{},'colors':{},'labels':[]}
realms['info']={
 'austria':{'ruler':'Maria Theresa (from 20 Oct 1740); not yet crowned in Bohemia or Hungary','claim':'documented'},
 'inner':{'ruler':'Maria Theresa','claim':'documented'},'tyrol':{'ruler':'Maria Theresa','claim':'documented'},
 'bohemia':{'ruler':'Maria Theresa (claims the Bohemian crown; coronation later)','claim':'documented'},
 'moravia':{'ruler':'Maria Theresa','claim':'documented'},
 'silesia':{'ruler':'Maria Theresa; Prussian invasion not yet known (Dec 1740)','note':'Opening dossier: Vienna learns of Frederick II’s intentions only in December.','claim':'documented'},
 'hungary':{'ruler':'Maria Theresa claims the crown; Hungarian coronation and the Diet are a separate negotiation','claim':'documented'},
 'milan':{'ruler':'Habsburg','claim':'inference'},'austnl':{'ruler':'Habsburg (Austrian Netherlands)','claim':'inference'},
 'prussia':{'ruler':'Frederick II (king since 31 May 1740)','claim':'documented'},
 'bavaria':{'ruler':'Elector Charles Albert','claim':'documented'},
 'saxony':{'ruler':'Elector Frederick Augustus II (also Augustus III of Poland)','claim':'documented'},
 'poland':{'ruler':'Augustus III','claim':'documented'},
 'britain':{'ruler':'George II','claim':'documented'},'france':{'ruler':'Louis XV','claim':'documented'},
 'spain':{'ruler':'Philip V','claim':'documented'},'portugal':{'ruler':'John V','claim':'documented'},
 'russia':{'ruler':'Empress Anna Ivanovna (dies 28 Oct 1740)','claim':'documented'},
 'ottoman':{'ruler':'Sultan Mahmud I','claim':'documented'},'sweden':{'ruler':'Frederick I','claim':'documented'},
 'denmark':{'ruler':'Christian VI','claim':'documented'},'savoy':{'ruler':'Charles Emmanuel III','claim':'documented'},
 'papal':{'ruler':'Pope Benedict XIV (elected Aug 1740)','claim':'documented'},'tuscany':{'ruler':'Francis Stephen of Lorraine (Maria Theresa’s husband)','claim':'documented'},
 'twosicilies':{'ruler':'Charles of Bourbon','claim':'documented'},'empire':{'ruler':'Imperial states; the imperial throne is vacant after 20 Oct 1740','claim':'documented'},
 'dutch':{'ruler':'States General','claim':'inference'},'swiss':{'ruler':'Confederation','claim':'inference'},'venice':{'ruler':'Republic','claim':'inference'},'genoa':{'ruler':'Republic','claim':'inference'},
 'salzburg':{'ruler':'Prince-Archbishop','claim':'inference'},'modena':{'ruler':'Duke','claim':'inference'},'parma':{'ruler':'Held by Austria (inference; check)','claim':'inference'},'lucca':{'ruler':'Republic','claim':'inference'}}
meta={'E':E,'C':C,'T':T,'sites':sites,'realms':realms}
j=lambda o:json.dumps(o,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
places=(w/'v3/places_eu.json').read_text().replace('<','\\u003c')
out=t.replace('/*LEAFLET_CSS*/',css).replace('/*LEAFLET_JS*/',js).replace('__RULES__',j(rules)).replace('__STATE__',j(state)).replace('__PLACES__',places).replace('__META__',j(meta)).replace('__BATTLEDATA__',(w/'v3/battle_data.json').read_text()).replace('__TERRAIN__',(w/'v6/battle_terrain.json').read_text())
fonts=(w/'fonts/fell_embedded.css').read_text();out=out.replace('/*FONTS*/',fonts)
(root/'outputs/cabinet-of-war.html').write_text(out)
(root/'outputs/opening-state.example.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
print(len(out),len(sites))

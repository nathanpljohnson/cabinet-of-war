"""Builds cabinet-of-war.html: the Paradox-style map layer and the orders-of-the-day flow.
usage: python3 outputs/src/pdx_build.py
Input: src/cabinet-of-war.base.html (the page before these passes; created from cabinet-of-war.html on first run),
src/pdx.json (from pdx_geo.py), src/pdx.js, src/pdx.css, src/case.js + src/staff.js (orders), src/state.json.
Re-running gives the same output."""
import json,re,shutil
from pathlib import Path
S=Path(__file__).resolve().parent;O=S.parent
base=S/'cabinet-of-war.base.html'
if not base.exists():
    cur=(O/'cabinet-of-war.html').read_text()
    assert 'id="pdx"' not in cur,'cabinet-of-war.html already has the map layer; restore the base copy first'
    shutil.copy2(O/'cabinet-of-war.html',base)
t=base.read_text()
def rep(a,b):
    global t
    assert t.count(a)==1,a[:80];t=t.replace(a,b)
# vector realms replace the raster realm tiles and the old caps labels
rep("realmL=[tl('realms1740/{z}/{x}/{y}.png',{minZoom:3,maxNativeZoom:7,maxZoom:9,bounds:E,zIndex:6}),tl('realms1740/{z}/{x}/{y}.png',{minZoom:8,maxNativeZoom:8,maxZoom:11,bounds:B(META.C),zIndex:6}),tl('realms1740/{z}/{x}/{y}.png',{minZoom:9,maxNativeZoom:10,maxZoom:11,bounds:B(META.T),zIndex:6})];","realmL=[];")
rep("initLabels();initRealmLabels();initRoutes();","initLabels();initRoutes();")
rep("initTools();initArmy();\n","initTools();initArmy();initPdx();\n")
a=t.index('function initRealmLabels(){');b=t.index('\n}\n',a)+3;t=t[:a]+t[b:]
# map modes replace the old lens radios
rep('\n <div class="eyebrow tt">Lens</div>\n <div class="tgrid"><label><input type="radio" name="lens" value="political" checked> Political</label><label><input type="radio" name="lens" value="terrain"> Terrain</label><label><input type="radio" name="lens" value="logistics"> Logistics</label></div>','')
rep("  // lenses\n  for(const r of document.querySelectorAll('input[name=lens]'))r.onchange=()=>lens(r.value);\n","")
a=t.index('function lens(v){');b=t.index("set('ly-forts',true)}}\n",a)+len("set('ly-forts',true)}}\n");t=t[:a]+t[b:]
rep('Click a name for its card.','Click a realm on the map for its card; Q–Y switch map modes.')
# orders of the day replace the writing case (letters, household, army-order letters, packet tab)
a=t.index('/* ---------- the writing case: letters, household, army orders, packet ---------- */');b=t.index('\n}\n',t.index('function renderStaff(){'))+3
t=t[:a]+(S/'case.js').read_text().strip()+'\n\n'+(S/'staff.js').read_text().strip()+'\n'+t[b:]
rep('aria-expanded="false">Case <span id="case-badge"','aria-expanded="false">Orders <span id="case-badge"')
rep('<aside id="case" aria-label="Writing case"><div class="chd"><div><div class="eyebrow">Your writing case</div><div class="ctitle">Letters, household and orders — sealed once</div>',
    '<aside id="case" aria-label="Orders"><div class="chd"><div><div class="eyebrow">Your orders</div><div class="ctitle">Orders of the day</div>')
rep("if(on){const a=el('button','Write it up →','btn small seal');a.onclick=()=>openCase('letters',undefined);row.append(a)}","")
rep("referenced=new Set();selectedPlace=null;persistState();$('confirm').close();","referenced=new Set();selectedPlace=null;BS.log=[];persistState();$('confirm').close();")
# current opening state
s=json.loads((S/'state.json').read_text());payload=json.dumps(s,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
t,n=re.subn(r'(<script type="application/json" id="initial-state">).*?(</script>)',lambda m:m[1]+payload+m[2],t,flags=re.S);assert n==1
# the layer itself
rep('</head>','<style>\n'+(S/'pdx.css').read_text()+'</style>\n</head>')
data=(S/'pdx.json').read_text().replace('<','\\u003c');js=(S/'pdx.js').read_text().replace('</script','<\\/script')
i=t.rindex('<script>');t=t[:i]+'<script type="application/json" id="pdx">'+data+'</script>\n<script>\n'+js+'</script>\n'+t[i:]
(O/'cabinet-of-war.html').write_text(t);print('cabinet-of-war.html',len(t)//1024,'KB')

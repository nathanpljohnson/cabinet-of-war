"""Turns the built desk (cabinet-of-war.html, written by src/pdx_build.py) into the game: the 3D world (w3d/) over the
desk's engine — state, battle rules, map and packet — plus the reply contract, open-ground deployment and opening state.
usage: python3 src/pdx_build.py && python3 src/w3d_build.py   (it edits cabinet-of-war.html in place, once)"""
from pathlib import Path
O=Path(__file__).resolve().parent.parent
t=(O/'cabinet-of-war.html').read_text()
assert 'w3d/main.js' not in t, 'cabinet-of-war.html already has the 3D layer: run src/pdx_build.py first'
def rep(a,b,n=None):
    global t
    k=t.count(a);assert k and (n is None or k==n),(a,k);t=t.replace(a,b)
rep('</head>','<link rel="stylesheet" href="w3d/w3d.css">\n</head>',1)
rep('</body></html>','<script type="importmap">{"imports":{"three":"./w3d/vendor/three/three.module.js","three/addons/":"./w3d/vendor/three/addons/"}}</script>\n<script type="module" src="w3d/main.js"></script>\n</body></html>',1)
# deployment on open ground: each army keeps its formation but is moved clear of villages, woods and water
# (found by search over the Mollwitz ground, w3d/grounds/mollwitz.json, north-up since game-v13; the smallest common
# move north that clears both armies is 660 m). Offsets in metres; DN is that move, applied to the fixed views below.
import json,re
DN=660
SHIFT={'A':(360,-690+DN),'B':(300,-360+DN)}
m=re.search(r'(<script type="application/json" id="initial-state">)(.*?)(</script>)',t,flags=re.S)
st=json.loads(m[2].replace('\\u003c','<'));bd=st['battleDemo']
for u in bd['units']: de,dn=SHIFT[u['side']]; u['e']+=de; u['n']+=dn
for o in bd['options']:
    for a in o.get('arrows',[]): de,dn=SHIFT[a['side']]; a['from']=[a['from'][0]+de,a['from'][1]+dn]; a['to']=[a['to'][0]+de,a['to'][1]+dn]
bd['deployment']=f'Armies moved as whole formations to open ground (A +360 E {-690+DN:+} N, B +300 E {-360+DN:+} N).'
# user decision: no village between the lines. Mollwitz and the hamlets inside the ground the armies fight over are
# farmland in the Mollwitz ground (src/ground_build.py clears them); the inline grid the desk's battle engine reads first
# is that ground's grid, so the sim, the desk and the 3D field start on the same, correctly oriented ground
bd['place']=bd['place'].split(' —')[0]+' — the village between the lines is removed'
bd['ground']='mollwitz'
tm=re.search(r'(<script type="application/json" id="terrain">)(.*?)(</script>)',t,flags=re.S)
GR=json.loads((O/'w3d'/'grounds'/'mollwitz.json').read_text())
TERj={k:GR[k] for k in ('cell','cols','rows','w','h','rows_str','legend')}; TERj['id']='mollwitz'
t=t[:tm.start(2)]+json.dumps(TERj,separators=(',',':'))+t[tm.end(2):]
payload=json.dumps(st,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
t=t[:m.start(2)]+payload+t[m.end(2):]
# the desk's army groups and battle views use fixed coordinates of the old deployment
rep("u.type==='inf'&&u.n>=-310)",f"u.type==='inf'&&u.n>={-1000+DN})",1); rep("u.type==='inf'&&u.n<-310)",f"u.type==='inf'&&u.n<{-1000+DN})",1)
rep("u.type==='cav'&&u.e<-1000)","u.type==='cav'&&u.e<-640)",1); rep("u.type==='cav'&&u.e>=-1000)","u.type==='cav'&&u.e>=-640)",1)
rep("[['A',-700,-300,'Imperial (illustrative)'],['B',-600,800,'Opposing (illustrative)']]",f"[['A',-340,{-990+DN},'Imperial (illustrative)'],['B',-300,{440+DN},'Opposing (illustrative)']]",1)
rep("[['A','Imperial army (illustrative)',-700,-520],['B','Opposing army (illustrative)',-600,980]]",f"[['A','Imperial army (illustrative)',-340,{-1210+DN}],['B','Opposing army (illustrative)',-300,{620+DN}]]",1)
rep("lo(bd.center,-300,200)",f"lo(bd.center,-320,{-275+DN})",2)
m=re.search(r'(<script type="application/json" id="initial-state">)(.*?)(</script>)',t,flags=re.S)
st=json.loads(m[2].replace('\\u003c','<'))
# the opening, researched (src/opening.json): letters, counsel, people, household, the rival and the canon. Certainty of
# every claim is kept in sourcesAppendix (shown in the notebook), never in the fiction.
OP=json.loads((O/'src'/'opening.json').read_text())
st['openingVersion']=OP['openingVersion']
st['locations']+=[l for l in OP['locations_add'] if l['id'] not in {x['id'] for x in st['locations']}]
for c in st['cast']: c.update(OP['cast_update'].get(c['id'],{}))
st['cast']+=[c for c in OP['cast_add'] if c['id'] not in {x['id'] for x in st['cast']}]
for k in ['household','mandate','reports','decision','knowledge','forces','forcesNote','remarks','sourcesAppendix']: st[k]=OP[k]
st['player']['name']='Ludwig Andreas, Count Khevenhüller'
st['world']={'mourning':True,'pay':'in arrears','roads':'good','refugees':[]}
st['hidden'].update(OP['hidden_add'])
# the opening is a campaign, not an interface demonstration: no demo briefing, scene or movements reach the adjudicator
st['briefing']=OP['briefing']
st['scene']=None
st['movements']=[mv for mv in st.get('movements',[]) if 'DEMO' not in mv.get('source','') and mv.get('claim')!='demo']
for c in st['cast']:
    if c.get('claim')=='demo': c['claim']='invention'
# the almanac (systems, plots, stakes, calendar, verification) is reference: it lives in w3d/almanac.json, not in the
# state Claude returns each turn; the state keeps one thread per plot for the adjudicator to update
W=st['hidden'].pop('world')
# Botta d'Adorno reached Berlin only in December 1740; until then Vienna's eyes there were the Resident, Demeradt
for pl in W['plots']:
    for sg in pl.get('signals',[]):
        if sg.get('via','').startswith('Botta in Berlin'): sg['via']='Demeradt, the Resident in Berlin, 5-8 days'
(O/'w3d'/'almanac.json').write_text(json.dumps(W,ensure_ascii=False,indent=1))
START=st['date']  # no thread is due for a check before the campaign begins
st['hidden']['threads']=[{'id':p['id'],'title':p['title'],'status':'dormant','next_check':max(START,p['window'][0]+('-01' if len(p['window'][0])==7 else '')) if p.get('window') else None} for p in W['plots']]
payload=json.dumps(st,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
t=t[:m.start(2)]+payload+t[m.end(2):]
# the opposing commander's temperament (state.battleDemo.enemy, set by the adjudicator) weighs the enemy's plan (w3d/campaign.js)
rep("if(BS.lastPlan&&S[BS.lastPlan]!==undefined)S[BS.lastPlan]-=.45*(BS.repeat||0);","if(window.__temper)window.__temper(S,F,M,BS.phase,avgMor);if(BS.lastPlan&&S[BS.lastPlan]!==undefined)S[BS.lastPlan]-=.45*(BS.repeat||0);",1)
rep("return{name:best,why,F}}","return{name:best,why:window.__temperWhy?window.__temperWhy(why):why,F}}",1)
# the battle grounds (w3d/grounds, game-v13) add marsh (4) and vineyards (5) to the land cover: marsh is slow going and
# worst for guns, vines and their stakes slow a march about as a village does
rep("function terMul(u,t){if(t===1)return u.type==='cav'?.3:.5;if(t===2)return u.type==='art'?.1:.25;if(t===3)return .6;return 1}",
    "function terMul(u,t){if(t===1)return u.type==='cav'?.3:.5;if(t===2)return u.type==='art'?.1:.25;if(t===3)return .6;if(t===4)return u.type==='art'?.2:u.type==='cav'?.35:.45;if(t===5)return u.type==='cav'?.5:.65;return 1}",1)
# marching (w3d/march.js, game-v13): lines keep facing and wheel, columns take routes, units give way; troop types
# (inf, gd, lt, cav, lc, art) ride on u.kind and shade men, morale, sight, fire, cover and shock. The desk's own rules
# stay as the fallback when the 3D layer is not loaded.
rep("function moveStep(u){","function moveStep(u){if(window.__march)return window.__march.move(u);",1)
rep("for(const u of us)moveStep(u);","for(const u of us)moveStep(u);if(window.__march)window.__march.after(us);",1)
rep("const base={inf:600,cav:130,art:60}[u.type];","const base=window.__march?window.__march.men(u):{inf:600,cav:130,art:60}[u.type];",1)
rep("u.mor=u.side==='A'?76:86;","u.mor=(u.side==='A'?76:86)+(window.__march?window.__march.mor(u):0);",1)
rep("function sight(u){return","function sight(u){if(window.__march)return window.__march.sight(u);return",1)
rep("*cov*(a.ammo>25?1:.5);","*cov*(a.ammo>25?1:.5);if(window.__march)k*=window.__march.fire(a)*window.__march.cover(t);",1)
rep("const pForm=t.form==='column'?.62:.32;","const pForm=(t.form==='column'?.62:.32)*(window.__march?window.__march.charge(a,t):1);",1)
rep("const pa=a.men*a.mor,pt=t.men*t.mor*","const sh=u=>window.__march?window.__march.shock(u):1;const pa=a.men*a.mor*sh(a),pt=t.men*t.mor*sh(t)*",1)
rep("const pa=a.mor*a.coh*flankMul,pt=t.mor*t.coh;","const pa=a.mor*a.coh*flankMul*(window.__march?window.__march.shock(a):1),pt=t.mor*t.coh*(window.__march?window.__march.shock(t):1);",1)
rep("function dims(u){const f=u.form||'line',d=(DIM[u.type]||DIM.inf)[f];","function dims(u){const f=u.form||'line',d=(DIM[u.kind]||DIM[u.type]||DIM.inf)[f];",1)
rep("const DIM={inf:{line:[150,12],column:[34,90]},cav:{line:[110,16],column:[30,60]},art:{line:[14,10],column:[14,10]}};",
    "const DIM={inf:{line:[150,12],column:[34,90]},cav:{line:[110,16],column:[30,60]},art:{line:[14,10],column:[14,10]},lt:{line:[300,24],column:[24,70]},lc:{line:[120,20],column:[26,56]}};",1)
(O/'cabinet-of-war.html').write_text(t);print('cabinet-of-war.html',len(t)//1024,'KB')

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
# (found by search over src/battle_terrain.json; Imperial centre otherwise stood inside Mollwitz). Offsets in metres.
import json,re
SHIFT={'A':(360,-690),'B':(300,-360)}
m=re.search(r'(<script type="application/json" id="initial-state">)(.*?)(</script>)',t,flags=re.S)
st=json.loads(m[2].replace('\\u003c','<'));bd=st['battleDemo']
for u in bd['units']: de,dn=SHIFT[u['side']]; u['e']+=de; u['n']+=dn
for o in bd['options']:
    for a in o.get('arrows',[]): de,dn=SHIFT[a['side']]; a['from']=[a['from'][0]+de,a['from'][1]+dn]; a['to']=[a['to'][0]+de,a['to'][1]+dn]
bd['deployment']='Armies moved as whole formations to open ground (A +360 E −690 N, B +300 E −360 N).'
# user decision: no village between the lines. Mollwitz and the hamlets inside the ground the armies fight over become
# farmland, in the terrain the 3D page's battle engine reads (rows ~45–108, cols ~25–140 of the 30 m grid); flank villages stay
bd['place']=bd['place'].split(' —')[0]+' — the village between the lines is removed'
tm=re.search(r'(<script type="application/json" id="terrain">)(.*?)(</script>)',t,flags=re.S)
TERj=json.loads(tm[2]); cleared=0
for r in range(45,109):
    row=list(TERj['rows_str'][r])
    for c in range(25,141):
        if row[c]=='3': row[c]='0'; cleared+=1
    TERj['rows_str'][r]=''.join(row)
assert cleared>300,cleared
t=t[:tm.start(2)]+json.dumps(TERj,separators=(',',':'))+t[tm.end(2):]
payload=json.dumps(st,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
t=t[:m.start(2)]+payload+t[m.end(2):]
# the desk's army groups and battle views use fixed coordinates of the old deployment
rep("u.type==='inf'&&u.n>=-310)","u.type==='inf'&&u.n>=-1000)",1); rep("u.type==='inf'&&u.n<-310)","u.type==='inf'&&u.n<-1000)",1)
rep("u.type==='cav'&&u.e<-1000)","u.type==='cav'&&u.e<-640)",1); rep("u.type==='cav'&&u.e>=-1000)","u.type==='cav'&&u.e>=-640)",1)
rep("[['A',-700,-300,'Imperial (illustrative)'],['B',-600,800,'Opposing (illustrative)']]","[['A',-340,-990,'Imperial (illustrative)'],['B',-300,440,'Opposing (illustrative)']]",1)
rep("[['A','Imperial army (illustrative)',-700,-520],['B','Opposing army (illustrative)',-600,980]]","[['A','Imperial army (illustrative)',-340,-1210],['B','Opposing army (illustrative)',-300,620]]",1)
rep("lo(bd.center,-300,200)","lo(bd.center,-320,-275)",2)
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
(O/'cabinet-of-war.html').write_text(t);print('cabinet-of-war.html',len(t)//1024,'KB')

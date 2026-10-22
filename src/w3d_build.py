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
# answers to orders: the 3D dispatch numbers its orders [T<turn>-<n>]; the reply format asks reports to cite them
rep("reports with dated, from_id, via and claim labels,","reports with dated, from_id, via and claim labels (and re: the list of order references such as \"T'+state.turn+'-2\" that a report answers, whenever it answers one of the bracketed orders of the day),",1)
# v8: the reply contract for the 3D page (versioned), when to wake the player, and the opening commission
CONTRACT = """## Reply contract (Cabinet of War 3D, version 2)
The player experiences this game in person, in a 3D world, and only through what reaches him. Keep it that way:
- Presence. He is in one place at a time (see the orders: a journey there moves him). Orders he gives in person take effect at once; letters take the days stated. While he is away from court, others have the ruler's ear and shape what is decided; while he is away from the army, its commanders act on old orders and their own judgement. Make absence cost something.
- Letters arrive over time. Give every report "arrives" (the date it reaches him, on or after "dated", and on or before the new state's date) so the turn unfolds day by day. Spread them realistically.
- Sources. Give every report "source": who actually saw or heard it ("our hussar patrol", "a Breslau merchant", "the envoy's clerk"). Reports may contradict each other; do not reconcile them for him. When earlier news proves wrong or right, let a later report or his secretary say so.
- Sightings. A report about a force, an army or an event at a place may carry "sighting": {"what": "...", "lat": n, "lon": n}. Several reports may place the same thing in different places.
- Answers. A report that answers one of his bracketed orders carries "re": [its references].
- Battles. A report that is the account of a battle carries "battle": true, and battleDemo holds the positions it describes. He commands battles only when he is with the army.
- Standing. Keep hidden.standing: {cast id: "warm" | "cordial" | "cool" | "hostile"} for the people who matter, and let it show only in how they write and behave. Keep "remarks": a short list of plain sentences his secretary would say to him about people, sources and how matters stand (no numbers, no scores). Keep "mandate" ({from_id, dated, title, text}) — his commission; change or withdraw it when events warrant, and set player.dismissed true if he loses his office.
- The world. Keep "world": {"mourning": bool, "pay": "paid" | "in arrears" | "unpaid", "roads": "good" | "heavy" | "impassable", "refugees": [location ids where refugees are on the roads]} — what he would see around him.
- Pace. Advance time to the moment described under "When to wake him", not further.
- People. Each cast member may carry "agenda" (what they privately want) and "voice" (how they write); keep them consistent and let agendas collide. Keep hidden.memory: {cast id: [short notes of what the player did to or for them]} and let it colour their letters and behaviour. They act without him: they meet, ally, intrigue. Give "overheard": [{place, who: [two cast ids present there], line}] — at most one or two lines a turn he could catch only in person; never repeat them in letters.
- Letters as objects. A report may carry "enclosure" ({kind: "return", title, rows: [[label, value]], note} | {kind: "order", title, text, from}), "sketch" ({title, places: [fortress or location ids]}), "cipher": true (unreadable until his clerk works on it), "intercepted" ({from, to}: a letter not meant for him), "forged": true (never reveal this in the letter itself; let later evidence or his secretary expose it).
- His own life. Keep "household" (spouse, children, estate) and player.health ("well" | "tired" | "ill" | "gravely ill"). Journeys, winter camps and overwork tire him; illness is possible. Let family write, ask, and sometimes pull against duty.
- The rival. hidden.rival names the person who wants his place. Play them by the same rules as everyone else — their own dispatches, standing and luck — and let him notice them only through the world: a letter that reached the Empress first, a minister who cooled, their courier leaving at dawn.
- This campaign's departures from history are in hidden.divergences. Treat them as the most likely course, reveal them only through evidence, and never name them as such.
- Canon. hidden.canon is an append-only list of settled facts (deaths, promises, battles, towns taken or lost): add to it every turn, never remove or rewrite. Mark the dead in the cast with "dead": true. The page checks every reply against the canon and the previous state and will ask you to correct contradictions.
- Out of office. If he is dismissed he is not out of the game: he can write memoirs (sent as "From my memoirs"), keep a private correspondence, and be recalled when events warrant. A "legacy" object means this is a new campaign as the heir of an earlier one: let the heir inherit that name's friends and enemies."""
rep("'\\n\\n## Reply format\\nReturn ONE JSON object","'\\n\\n## When to wake him\\n'+((draft.w3d&&draft.w3d.wake)||'When there is news he must decide on.')+'\\n\\n'+"+json.dumps(CONTRACT)+"+'\\n\\n## Reply format\\nReturn ONE JSON object",1)
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
payload=json.dumps(st,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
t=t[:m.start(2)]+payload+t[m.end(2):]
(O/'cabinet-of-war.html').write_text(t);print('cabinet-of-war.html',len(t)//1024,'KB')

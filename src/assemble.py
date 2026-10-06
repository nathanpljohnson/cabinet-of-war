import re
from pathlib import Path
W=Path(__file__).resolve().parents[1]
t=(W/'v3/desk.template.html').read_text()
def rep(a,b,cnt=1):
    global t
    assert a in t,a[:80]
    t=t.replace(a,b,cnt)
# ---------- HTML ----------
rep('<button class="btn quiet" id="toggleY"','<button class="btn quiet" id="toggleT" aria-controls="tools" aria-expanded="false">Tools</button>\n  <button class="btn quiet" id="toggleY"')
a=t.index('<div id="clouds"></div>');b=t.index('<svg id="compass"')
panels='''<div id="clouds"></div><div id="wind"></div><div id="seasonov"></div>
<div id="splash"><div><div class="brand" style="font-size:30px">Cabinet of War</div><div class="eyebrow" style="margin-top:8px">Unrolling the map…</div></div></div>
<div id="layers" aria-label="Map layers"><div class="eyebrow" style="margin-bottom:6px">Map layers</div>
 <label><input type="checkbox" id="ly-places" checked> Towns</label>
 <label><input type="checkbox" id="ly-natural" checked> Seas, rivers &amp; ranges</label>
 <label><input type="checkbox" id="ly-realms" checked> Realms &amp; crown lands</label>
 <div id="zones"></div>
 <div class="key">Bold = state border · mid = crown land · thin = province. Approximate: modern provinces grouped into c.1740 realms. Click a name for its card.</div>
 <label><input type="checkbox" id="ly-routes" checked> Trade routes</label>
 <label><input type="checkbox" id="ly-moves" checked> Known movements</label>
 <label><input type="checkbox" id="ly-forts" checked> Fortresses &amp; crossings</label>
 <label><input type="checkbox" id="ly-blocks" checked> 3D town blocks (zoom on a city)</label>
 <label><input type="checkbox" id="ly-ambient" checked> Living map (weather, water, smoke)</label>
</div>
<div id="tools" aria-label="Tools"><div class="eyebrow" style="margin-bottom:6px">Tools</div>
 <div class="tgrid">
  <button class="btn small" data-book="europe">1 Europe</button><button class="btn small" data-book="theatre">2 Theatre</button><button class="btn small" data-book="vienna">3 Vienna</button><button class="btn small" data-book="prague">4 Prague</button><button class="btn small" data-book="battle">5 Battle</button>
 </div>
 <div class="eyebrow tt">Lens</div>
 <div class="tgrid"><label><input type="radio" name="lens" value="political" checked> Political</label><label><input type="radio" name="lens" value="terrain"> Terrain</label><label><input type="radio" name="lens" value="logistics"> Logistics</label></div>
 <div class="eyebrow tt">Season</div>
 <select id="season"><option value="autumn" selected>Autumn (now)</option><option value="winter">Winter</option><option value="spring">Spring</option><option value="summer">Summer</option></select>
 <div class="key" id="season-note"></div>
 <div class="eyebrow tt">Measure &amp; notes</div>
 <div class="tgrid"><button class="btn small" id="tool-measure">Measure (m)</button><button class="btn small" id="tool-note">Note (n)</button><button class="btn small quiet" id="tool-clear">Clear</button></div>
 <div class="key" id="measure-out"></div><div class="key" id="scale-note"></div>
 <div class="eyebrow tt">Reach rings</div>
 <div class="tgrid"><select id="reach-place" style="width:auto"></select><button class="btn small" id="reach-btn">Show</button></div>
 <div class="tgrid"><label><input type="checkbox" id="r-courier" checked> courier</label><label><input type="checkbox" id="r-foot" checked> foot</label><label><input type="checkbox" id="r-wagon"> wagons</label></div>
 <div class="eyebrow tt">Overview</div><div id="minimap"></div>
 <div class="eyebrow tt">Comfort</div>
 <label><input type="checkbox" id="a-motion"> Reduce motion</label><label><input type="checkbox" id="a-contrast"> High-contrast labels</label><label><input type="checkbox" id="a-sound"> Ambient sound</label>
 <label style="display:flex;gap:8px;align-items:center">Panel size <input type="range" id="a-size" min="90" max="125" value="100" style="width:110px"></label>
</div>
<div id="timeline" aria-label="Timeline"></div>
<dialog id="notedlg"><h2 style="margin-top:0;font-weight:400">Map note</h2><textarea id="note-text" placeholder="What do you want to remember about this place?"></textarea><div class="row"><button class="btn seal" id="note-save">Save note</button><button class="btn quiet" id="note-cancel">Cancel</button></div></dialog>
'''
t=t[:a]+panels+t[b:]
a=t.index('<div class="legend" id="legend">');b=t.index('</div>',a)
t=t[:a]+'<div class="legend" id="legend">A hand-coloured c.1740 map built from modern elevation, coast and forest data. Realm extents are approximate (modern provinces grouped). Names: 1740 forms where known. Ground detail around towns and the battlefield is illustrative.'+t[b:]
a=t.index('<div class="bar">');b=t.index('</div>',t.index('</span>',t.index('Natural Earth',a)))
t=t[:a]+'<div class="bar"><span id="status" role="status" aria-live="polite">Ready.</span><span>Natural Earth (public domain) · Terrain Tiles · © OpenStreetMap contributors · HydroRIVERS · Leaflet'+t[b:]
rep('<script type="application/json" id="geo">__GEO__</script>','<script type="application/json" id="places">__PLACES__</script>')
t=t.replace('<script type="application/json" id="battledata">__BATTLEDATA__</script>','<script type="application/json" id="battledata">__BATTLEDATA__</script>\n<script type="application/json" id="terrain">__TERRAIN__</script>',1)
t=re.sub(r'\n<script type="application/json" id="realms">__REALMS__</script>','',t)
# ---------- v5 html ----------
rep('<button class="btn quiet" id="toggleT"','<button class="btn seal" id="toggleC" aria-controls="case" aria-expanded="false">Case <span id="case-badge" class="badge"></span></button>\n  <button class="btn quiet" id="toggleT"')
t=re.sub(r'\s*<button role="tab" id="t-orders"[^>]*>[^<]*</button>','',t)
t=re.sub(r'\s*<div role="tabpanel" id="p-orders"[^>]*></div>','',t)
rep('id="t-battle" aria-controls="p-battle" aria-selected="false" tabindex="-1">Battle<','id="t-battle" aria-controls="p-battle" aria-selected="false" tabindex="-1">Army<')
rep('<button role="tab" id="t-record"','<button role="tab" id="t-staff" aria-controls="p-staff" aria-selected="false" tabindex="-1">Staff</button>\n    <button role="tab" id="t-record"')
rep('<div role="tabpanel" id="p-record"','<div role="tabpanel" id="p-staff" aria-labelledby="t-staff" hidden></div>\n    <div role="tabpanel" id="p-record"')
rep('<div id="timeline" aria-label="Timeline"></div>','<div id="timeline" aria-label="Timeline"></div>\n<div id="armybar" aria-label="Army command"></div>\n<aside id="case" aria-label="Writing case"><div class="chd"><div><div class="eyebrow">Your writing case</div><div class="ctitle">Letters, household and orders — sealed once</div></div><button class="btn small quiet" id="case-close">Close</button></div><div id="case-tabs" class="ctabs"></div><div id="case-body" class="cbody"></div></aside>')
t=t.replace("renderOrders();renderRecord();renderBattle();","renderStaff();renderCase();renderRecord();renderBattle();")
# ---------- JS ----------
t=t.replace('initMap();renderAll();','initMap();renderAll();initCase();',1)
a=t.index("/* ---------- map ---------- */");b=t.index("/* ---------- left rail ---------- */")
_m=(W/'v6/map.js').read_text()
_a=_m.index("/* ----- army: select, order");_b=_m.index("/* ----- prefetch")
_m=_m[:_a]+(W/'v6/army.js').read_text()+"\n"+(W/'v6/battle.js').read_text()+"\n"+_m[_b:]
newmap=_m+"\n"+(W/'v6/tools.js').read_text()+"\n"
t=t[:a]+newmap+t[b:]
a=t.index("/* ---------- battle preview ---------- */");b=t.index("/* ---------- shell ---------- */")
t=t[:a]+t[b:]
rep("const rules=JSON.parse($('rules').textContent), geo=JSON.parse($('geo').textContent), META=JSON.parse($('tile-meta').textContent), REALMS=JSON.parse($('realms').textContent);","const rules=JSON.parse($('rules').textContent), META=JSON.parse($('tile-meta').textContent);")
rep("localStorage.getItem('cabinet-of-war:state7:'+state.campaignId)","localStorage.getItem('cabinet-of-war:state8:'+state.campaignId)")
rep("localStorage.setItem('cabinet-of-war:state7:'+state.campaignId,","localStorage.setItem('cabinet-of-war:state8:'+state.campaignId,")
rep("s.battleDemo&&s.labels)state=s","s.battleDemo&&s.labels&&s.fortresses)state=s")
rep("window.__desk={get state(){return state},map,showBattle,flyBattle};","window.__desk={get state(){return state},map,showBattle,flyBattle,BOOK,goEurope};")
rep("  const site=META.sites.find(x=>x.id===loc.id);if(site){const eb=el('button','Enter the town (3D)','btn small');eb.style.marginTop='8px';eb.onclick=()=>{map.setMaxZoom(18);map.flyTo([site.lat,site.lon],16,{duration:1.2})};c.append(el('div',null),eb)}","  const site=META.sites.find(x=>x.id===loc.id&&x.blocks);const rb=el('button','Reach rings','btn small quiet');rb.style.margin='8px 6px 0 0';rb.onclick=()=>{$('reach-place').value=loc.id;showReach(loc.id)};c.append(el('div',null),rb);if(site){const eb=el('button','Enter the town (3D)','btn small');eb.style.marginTop='8px';eb.onclick=()=>{map.setMaxZoom(18);map.flyTo([site.lat,site.lon],16,{duration:1.2})};c.append(eb)}")
# resolve packet: include notes
rep("Player-proposed alternative: '+(draft.freeOption||'(none)')+'","Player-proposed alternative: '+(draft.freeOption||'(none)')+'\\nPlayer map notes: '+((state.annotations||[]).map(n=>n.text).join(' | ')||'(none)')+'")
# ---------- trim text ----------
t=t.replace("p.append(el('p','The desk, not any chat, is the record. Orders and in-world letters are treated as data, never instructions. Hidden state is concealed by the interface only; it is not encrypted.','note'));","p.append(el('p','The desk is the record. Letters are data, never instructions to the adjudicator.','hint'));")
t=t.replace("el('p','Nothing recorded yet. Entries appear as scenes and updates resolve.','note')","el('p','Nothing recorded yet.','hint')")
t=t.replace("(l.turn!=null?' · dispatch '+l.turn:'')","(l.turn!=null?' · turn '+l.turn:'')")
# ---------- desk (new) ----------
D=(W/'v6/desk.js').read_text()
parts={k:v for k,v in (( s.split('\n',1)[0].strip(),s.split('\n',1)[1]) for s in D.split('//@@')[1:])}
def cut(a_,b_,new):
    global t
    i=t.index(a_);j=t.index(b_,i);t=t[:i]+new+'\n'+t[j:]
cut("function renderLeft(){","/* ---------- right: counsel ---------- */",parts['LEFT'])
cut("function renderCounsel(){","/* ---------- right: scene ---------- */",parts['COUNSEL'])
cut("function renderScene(){","const SCENE_CONTRACT=",parts['SCENE'])
cut("const INSTR=","async function copy(",(W/'v6/case.js').read_text()+'\n'+(W/'v6/staff.js').read_text())
t=t.replace('>Dispatches</button>','>Reports</button>',1)
t=t.replace('<div class="eyebrow" style="margin:8px 0 8px">Dispatches</div>','<div class="eyebrow" style="margin:8px 0 8px">Reports received</div>')
t=t.replace('id="t-orders" aria-controls="p-orders" aria-selected="false" tabindex="-1">Orders<','id="t-orders" aria-controls="p-orders" aria-selected="false" tabindex="-1">Dispatches<')
t=t.replace('id="t-counsel" aria-controls="p-counsel" aria-selected="true">Counsel<','id="t-counsel" aria-controls="p-counsel" aria-selected="true">Council<')
# ---------- CSS ----------
css=r'''
/* v4: parchment map labels */
#map{background:#bfd0cc}
#vignette{background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(40,24,10,.22) 100%),linear-gradient(180deg,rgba(26,20,17,.5),transparent 9%,transparent 94%,rgba(26,20,17,.35))}
#grain{opacity:.07}
.pl{display:flex;align-items:center;gap:4px;transform:translate(-3px,-6px);white-space:nowrap;pointer-events:none}.pl i{width:5px;height:5px;border-radius:50%;background:#3a2615;box-shadow:0 0 0 1px #efe3c0}.pl.cap i{width:7px;height:7px;background:#8a2c20}
.pl span{font:13px var(--fell);color:#2b1a0e;text-shadow:0 0 3px #efe3c0,0 0 3px #efe3c0,0 0 5px #efe3c0}
.pl.cap span{font-size:14px;font-weight:600}
.region-lbl{font:400 19px var(--fellsc);letter-spacing:.42em;text-transform:uppercase;color:rgba(70,44,22,.62);text-shadow:0 0 4px rgba(239,227,192,.9),0 0 8px rgba(239,227,192,.7);white-space:nowrap;transform:translate(-50%,-50%);pointer-events:none}
.realm-lbl{font-family:var(--fellsc);letter-spacing:.34em;text-transform:uppercase;white-space:nowrap;transform:translate(-50%,-50%);filter:brightness(.62) saturate(1.3);text-shadow:0 0 4px #efe3c0,0 0 6px #efe3c0,0 0 9px #efe3c0;cursor:pointer}
.river-lbl{color:#35567a!important;text-shadow:0 0 3px #efe3c0,0 0 4px #efe3c0!important}
.sea-lbl{color:#47697c!important;text-shadow:none!important;letter-spacing:.5em}
.mtn-lbl2{font:italic 14px var(--fell);letter-spacing:.2em;color:#5a3d22;text-shadow:0 0 3px #efe3c0;white-space:nowrap;transform:translate(-50%,-50%);pointer-events:none}
.route-lbl{color:#3a2210!important;text-shadow:0 0 3px #efe3c0,0 0 4px #efe3c0!important}
.seal-pin span{color:#2b1a0e!important;text-shadow:0 0 3px #efe3c0,0 0 3px #efe3c0,0 0 6px #efe3c0!important}
.seal-pin.stale{opacity:.55;filter:blur(.6px)}
.fort{display:flex;align-items:center;gap:3px;transform:translate(-7px,-9px);white-space:nowrap}.fort b{font-size:15px;color:#7a1f14;text-shadow:0 0 3px #efe3c0}.fort span{font:italic 12px var(--fell);color:#3a2210;text-shadow:0 0 3px #efe3c0}
.note-pin{transform:translate(-8px,-18px);font-size:18px;color:#8a2c20;text-shadow:0 0 3px #efe3c0;cursor:pointer}
.army-counter{font:700 11px var(--caps);letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border:1px solid #1a120b;white-space:nowrap;transform:translate(-50%,-50%)}.army-counter.A{background:#efe6cf;color:#2a2118}.army-counter.B{background:#3b5f9a;color:#fff}
.cnt{width:16px;height:8px;border:1.5px solid #1a120b;transform:translate(-8px,-4px)}.cnt.A{background:#efe6cf}.cnt.B{background:#3b5f9a}.cnt.cav{height:9px;background-image:linear-gradient(135deg,transparent 44%,#1a120b 44%,#1a120b 56%,transparent 56%)}.cnt.art{width:9px;height:9px;border-radius:50%;background:#1d1710}.cnt.sel{outline:2px solid #ffd45e}
#splash{position:fixed;inset:0;z-index:9000;background:#1a1411;display:flex;align-items:center;justify-content:center;text-align:center;transition:opacity .5s}
#seasonov{position:fixed;inset:0;z-index:405;pointer-events:none}
#tools,#layers{position:fixed;z-index:520;left:14px;top:70px;background:var(--panel);border:1px solid var(--line);padding:10px 14px;font:600 11px var(--caps);letter-spacing:.06em;color:var(--text);display:none;max-height:calc(100vh - 130px);overflow:auto;width:290px}
#tools{left:310px}#tools.on,#layers.on{display:block}
#tools label,#layers label{display:flex;gap:6px;align-items:center;margin:3px 0;cursor:pointer;text-transform:none;font-weight:400;font-size:12px}
.tgrid{display:flex;flex-wrap:wrap;gap:5px 10px;align-items:center;margin:4px 0}.tt{margin-top:10px;margin-bottom:3px}
#minimap{width:100%;height:130px;border:1px solid var(--line);background:#bfd0cc}
#tools select,#layers select{background:rgba(255,246,220,.08);padding:3px 6px;font-size:12px}
.btn.on{background:var(--brass);color:#1a120b}
#timeline{position:fixed;left:14px;right:14px;bottom:40px;z-index:505;display:flex;gap:6px;overflow-x:auto;padding:4px 6px;background:rgba(20,14,10,.72);border:1px solid var(--line);scrollbar-width:thin}
.tl-now{font:700 10px var(--caps);letter-spacing:.12em;text-transform:uppercase;color:var(--brass);white-space:nowrap;align-self:center;padding-right:8px;border-right:1px solid var(--line)}
.tl-chip{background:none;border:1px solid var(--line);color:var(--text);font:11px var(--caps);padding:3px 8px;white-space:nowrap;cursor:pointer}.tl-chip:hover{border-color:var(--brass)}.tl-chip.move{border-color:#7fa6ee}.tl-chip.ledger{border-color:#8fd08a}
#map.z-deep{background:#e4d6af!important}
.ahead{width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid #fff;margin:-10px 0 0 -8px;transform-origin:50% 62%;filter:drop-shadow(0 0 2px #1a120b)}
body.rm *,body.rm *::before{animation:none!important;transition:none!important}
body.hc .pl span,body.hc .seal-pin span,body.hc .region-lbl,body.hc .realm-lbl{text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 4px #fff,0 0 6px #fff!important;filter:brightness(.4)!important}
.leaflet-container{background:#bfd0cc}
.leaflet-popup-content-wrapper{background:#efe3c0;color:#2b1a0e;border-radius:2px;font:13px var(--fell)}.leaflet-popup-tip{background:#efe3c0}
.leaflet-popup-content .claim{margin-left:0}
.leaflet-bottom.leaflet-left{margin-bottom:84px}
.legend{bottom:84px!important;left:350px!important}#compass{bottom:120px!important}
.z-low .seal-pin span,.z-low .fort,.z-low .mv-lbl,.z-low .route-lbl{display:none}
@media(max-width:860px){#tools,#layers{left:8px;right:8px;width:auto}#tools{top:120px}#timeline{display:none}}
'''
css+=r'''
/* battle table */
.bstat{border:1px solid var(--line);padding:10px 12px;margin:10px 0;background:rgba(255,240,200,.04)}.brow{display:grid;grid-template-columns:92px 1fr auto;gap:8px;align-items:center;margin:4px 0;font-size:12px}.bbar{height:8px;background:rgba(255,255,255,.1);border:1px solid var(--line)}.bbar i{display:block;height:100%}.bl{font:600 10px var(--caps);letter-spacing:.1em;text-transform:uppercase;color:var(--brass)}.bn{font-size:11px;color:var(--text-d)}
.rep{border-left:2px solid var(--brass);padding:4px 10px;margin:6px 0;font-size:13px}.result.win{border-color:#8fd08a}.result.lose{border-color:#b8442f;background:rgba(138,44,32,.18)}
.cnt.ghost{opacity:.3;border-style:dashed}.cnt.rout{outline:2px dashed #b8442f}.cnt.wav{outline:2px solid #c9a24a}
/* case drawer + army bar */
#case{position:fixed;z-index:560;left:14px;top:70px;bottom:44px;width:min(660px,56vw);background:rgba(26,20,17,.97);border:1px solid var(--brass);box-shadow:0 14px 50px rgba(0,0,0,.7);display:none;flex-direction:column}#case.on{display:flex}
.chd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.ctitle{font-size:19px;color:var(--vellum)}
.ctabs{display:flex;border-bottom:1px solid var(--line)}.ctabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:10px 4px;font:600 11px var(--caps);letter-spacing:.14em;text-transform:uppercase;color:var(--text-d);cursor:pointer}.ctabs button.on{color:var(--brass);border-bottom-color:var(--brass)}
.cbody{flex:1;overflow:auto;padding:14px 16px}
.cs{display:grid;grid-template-columns:210px 1fr;gap:14px;min-height:100%}.cs-list{display:flex;flex-direction:column;gap:8px}.lcard{border:1px solid var(--line);padding:7px 9px;cursor:pointer}.lcard.on{border-color:var(--brass);background:rgba(214,178,94,.1)}.lcard:hover{border-color:var(--brass)}.lh2{display:flex;align-items:center;gap:6px;font-size:13px}.lh2 .st{margin-left:auto}.ex2{font-size:11px;color:var(--text-d);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st{font:700 9px var(--caps);letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;border:1px solid}.st-draft{color:var(--text-d)}.st-ready{color:#9fd0a0}.st-sent{color:#e2c46f}
.empty-case{border:1px dashed var(--line);padding:40px 16px;text-align:center;color:var(--text-d)}
.sec{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.sec select,.sec input{width:auto;flex:1;min-width:120px;padding:4px 6px}
.hh{display:grid;grid-template-columns:1fr 1fr;gap:10px}.hcard{border:1px solid var(--line);background:rgba(255,240,200,.04);padding:10px}.hcard b{display:block;margin-bottom:6px;color:var(--vellum)}.hcard .lr{margin:4px 0;display:block}.hcard .lab{display:block;color:var(--brass)}.hcard select,.hcard input{width:100%}
.chk div{padding:3px 0;font-size:14px}.chk .ok{color:#9fd0a0}.chk .no{color:var(--text-d)}.pk{padding:5px 8px;border-left:2px solid var(--brass);margin:4px 0;font-size:13px;background:rgba(255,240,200,.04)}
.stable{display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:13px;max-width:260px}.stable b{color:var(--brass);font-weight:600}
.plan{display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center}.plan select,.plan input{width:100%}.plan-out{margin-top:8px;font-size:13px;border-left:2px solid var(--brass);padding-left:10px}.plan-out div{margin:2px 0}
.btnchip{cursor:pointer;background:none;color:var(--text);padding:3px 10px;font:12px var(--serif)}.btnchip:hover,.btnchip.on{border-color:var(--brass);background:rgba(214,178,94,.15)}
#armybar{position:fixed;z-index:515;left:50%;bottom:84px;transform:translateX(-50%);display:none;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center;background:rgba(20,14,10,.92);border:1px solid var(--brass);padding:6px 10px;max-width:92vw}
.ab-btn{background:none;border:1px solid var(--line);color:var(--text);font:600 10px var(--caps);letter-spacing:.1em;text-transform:uppercase;padding:5px 9px;cursor:pointer}.ab-btn:hover,.ab-btn.on{border-color:var(--brass);background:rgba(214,178,94,.2);color:#fff}.ab-btn.go{background:var(--seal);border-color:var(--seal-l)}
.ab-sel{font:600 11px var(--caps);letter-spacing:.08em;color:var(--brass);min-width:90px}.ab-sel2{width:auto;padding:3px 6px;font-size:12px}.ab-cnt{font:11px var(--caps);color:var(--text-d)}
.badge{display:inline-block;min-width:16px;padding:0 4px;border-radius:8px;background:#fff;color:var(--seal);font:700 10px var(--caps);text-align:center}.badge:empty{display:none}
@media(max-width:860px){#case{left:0;right:0;width:auto;top:56px}.cs{grid-template-columns:1fr}.hh{grid-template-columns:1fr}}
/* desk */
.dh{margin:2px 0 4px;font-weight:400;font-size:20px;color:var(--vellum)}.ctx{font-size:13px;color:var(--text-d);margin:0 0 10px}
.advice{border:1px solid var(--line);background:rgba(255,240,200,.04);padding:10px 12px;margin-bottom:10px;position:relative}.advice.on{border-color:var(--brass);background:rgba(214,178,94,.12);box-shadow:inset 3px 0 0 var(--brass)}
.ah{display:flex;gap:10px;align-items:center}.at{font-size:16px;font-weight:600;color:var(--vellum);line-height:1.2}.by{font:10px var(--caps);letter-spacing:.1em;color:var(--text-d);text-transform:uppercase}.ob{margin:6px 0 4px;font-size:14px}
.mseal{flex:none;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d9604a,#8a2c20 60%,#4d150e);color:#f6e7d4;font:600 13px var(--fell);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.5)}
details{margin:6px 0}summary{cursor:pointer;font:600 10px var(--caps);letter-spacing:.16em;text-transform:uppercase;color:var(--brass)}details[open] summary{margin-bottom:6px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);padding:2px 8px 2px 3px;font-size:12px}.chip.tiny{padding:2px 8px;font-size:11px}.hint{font-size:11px;color:var(--text-d)}
.convo{display:flex;flex-direction:column;gap:8px;margin:10px 0}.bub{max-width:88%;padding:8px 11px;background:rgba(255,240,200,.08);border:1px solid var(--line);font-size:14px;align-self:flex-start}.bub b{display:block;font:600 9px var(--caps);letter-spacing:.16em;text-transform:uppercase;color:var(--brass);margin-bottom:2px}.bub.you{align-self:flex-end;background:rgba(138,44,32,.28);border-color:var(--seal-l)}.bub.narr{align-self:center;font-style:italic;color:var(--text-d);background:none;border:0}
.letter{background:#efe3c0;color:#2b1a0e;padding:12px 14px;border:1px solid #b79c5a;box-shadow:0 3px 14px rgba(0,0,0,.45);position:relative}.letter .lh{font:400 18px var(--fellsc);letter-spacing:.14em;color:#5a3d22;margin-bottom:6px}
.letter .lr{display:flex;align-items:center;gap:8px;margin:6px 0}.letter .lab{font:700 9px var(--caps);letter-spacing:.16em;text-transform:uppercase;color:#7a5a30;min-width:30px;margin:0}
.letter select,.letter textarea{background:rgba(255,255,255,.5);color:#2b1a0e;border:1px solid #c7ad72;font:14px var(--fell)}.letter textarea.paper{background:repeating-linear-gradient(transparent,transparent 23px,rgba(122,90,48,.22) 24px);line-height:24px;padding:4px 8px}
.letter summary{color:#7a5a30}.letter .hint{color:#7a5a30}.letter .chip{border-color:#b79c5a;color:#4a3018}.letter .claim{margin-left:0}
.letter input{background:rgba(255,255,255,.55);color:#2b1a0e;border:1px solid #c7ad72;font:14px var(--fell);padding:4px 8px}.letter input::placeholder,.letter textarea::placeholder{color:#8a7448}
.rcpt{display:flex;align-items:center;gap:8px;font-size:12px;margin:2px 0 4px;color:#4a3018}
.seg{display:flex}.seg button{background:rgba(255,255,255,.4);border:1px solid #c7ad72;padding:4px 10px;font:600 10px var(--caps);letter-spacing:.08em;text-transform:uppercase;color:#5a3d22;cursor:pointer}.seg button.on{background:#7a2a1f;color:#f6e7d4;border-color:#7a2a1f}
.eta{font:italic 13px var(--fell);color:#6a4a22;margin:2px 0 6px}
.sealed{background:#e8dcb6;color:#2b1a0e;border:1px solid #b79c5a;padding:8px 10px;margin:8px 0;position:relative}.sealed.sent{opacity:.85}.sealed .sh{display:flex;align-items:center;gap:8px;font:600 12px var(--caps);letter-spacing:.06em}.sealed .ex{font-size:13px;margin:4px 0 0}.sealed .eta{margin:2px 0}
.stamp{margin-left:auto;font:700 10px var(--caps);letter-spacing:.2em;color:#8a2c20;border:2px solid #8a2c20;padding:1px 6px;transform:rotate(-6deg)}
.sendbar{display:flex;flex-direction:column;gap:6px;margin:12px 0}
.report .row{gap:6px}
'''
rep("</style></head><body>",css+"</style></head><body>")
(W/'v6/desk.template.html').write_text(t)
print('assembled',len(t))

/* ----- army: select, order, preview (true scale from z15, counters when far) ----- */
let selUnits=new Set(),armyTool=null,orderLayer=L.layerGroup(),dragBox=null,dragStart=null;
const lo=(c,e,n)=>[c[0]+n/111320,c[1]+e/(111320*Math.cos(c[0]*Math.PI/180))];
const DIM={inf:{line:[150,12],column:[34,90]},cav:{line:[110,16],column:[30,60]},art:{line:[14,10],column:[14,10]}};
function dims(u){const f=u.form||'line',d=(DIM[u.type]||DIM.inf)[f];return {w:d[0],d:d[1]}}
function armyOrders(){draft.armyOrders=draft.armyOrders||{};return draft.armyOrders}
function myUnits(){return state.battleDemo.units.filter(u=>u.side==='A')}
function unitById(id){return state.battleDemo.units.find(u=>u.id===id)}
const COMMANDER={inf:'inf-general',cav:'cav-general',art:'art-officer'};
function armyGroups(){const A=myUnits(),g=[];
  g.push({id:'all',name:'Whole army',ids:A.map(u=>u.id)});
  g.push({id:'l1',name:'First line',ids:A.filter(u=>u.type==='inf'&&u.n>=-310).map(u=>u.id)});
  g.push({id:'l2',name:'Second line',ids:A.filter(u=>u.type==='inf'&&u.n<-310).map(u=>u.id)});
  g.push({id:'cl',name:'Left cavalry',ids:A.filter(u=>u.type==='cav'&&u.e<-1000).map(u=>u.id)});
  g.push({id:'cr',name:'Right cavalry',ids:A.filter(u=>u.type==='cav'&&u.e>=-1000).map(u=>u.id)});
  g.push({id:'art',name:'Artillery',ids:A.filter(u=>u.type==='art').map(u=>u.id)});
  return g.filter(x=>x.ids.length)}
function selCentroid(){let e=0,n=0,k=0;for(const id of selUnits){const u=unitById(id);if(u){e+=u.e;n+=u.n;k++}}return k?[e/k,n/k]:[0,0]}
function toMeters(ll){const c=state.battleDemo.center;return [(ll.lng-c[1])*111320*Math.cos(c[0]*Math.PI/180),(ll.lat-c[0])*111320]}
function selectUnits(ids,add){if(!add)selUnits=new Set();for(const id of ids){if(add&&selUnits.has(id))selUnits.delete(id);else selUnits.add(id)}refreshArmy()}
function refreshArmy(){syncBattle.mode=-1;if(battleOn){drawBattle();syncBattle()}renderBattle();renderArmyBar()}
function setArmyTool(t){armyTool=armyTool===t?null:t;map.getContainer().style.cursor=armyTool?'crosshair':'';renderArmyBar();if(armyTool==='move'||armyTool==='face')status(armyTool==='move'?'Move: click the map where the selection should go. Esc cancels.':'Face: click the map in the direction they should face.')}
function orderSel(fn){if(!selUnits.size){status('Select some units first (click a block, or pick a group).',true);return}for(const id of selUnits){const o=armyOrders()[id]||(armyOrders()[id]={});fn(o,unitById(id))}saveDraft();refreshArmy();renderCase&&renderCase()}
function armyMapClick(e){
  if(!armyTool||!battleOn)return;const p=toMeters(e.latlng);
  if(armyTool==='move'){const c=selCentroid();orderSel((o,u)=>{o.dest=[u.e+(p[0]-c[0]),u.n+(p[1]-c[1])];o.mode=o.mode==='retire'?'retire':'advance'});setArmyTool(null)}
  else if(armyTool==='face'){orderSel((o,u)=>{const dx=p[0]-u.e,dy=p[1]-u.n;o.facing=Math.round((Math.atan2(dx,dy)*180/Math.PI+360)%360)});setArmyTool(null)}
}
function armyForm(){orderSel((o,u)=>{o.form=(o.form||u.form||'line')==='line'?'column':'line'})}
function armyHold(){orderSel((o,u)=>{o.mode='hold';delete o.dest})}
function armyCharge(){orderSel((o,u)=>{if(u.type!=='cav'){return}const B=state.battleDemo.units.filter(x=>x.side==='B'&&alive(x)&&x.vis);if(!B.length){status('No enemy in sight to charge.',true);return}const t=B.reduce((b,x)=>!b||dist(u,x)<dist(u,b)?x:b,null);o.dest=[t.e,t.n];o.mode='charge'})}
function armyAdvance(){orderSel((o,u)=>{const a=(o.facing!=null?o.facing:u.facing)*Math.PI/180;o.dest=[u.e+Math.sin(a)*200,u.n+Math.cos(a)*200];o.mode='advance'})}
function armyRetire(){orderSel((o,u)=>{const a=(o.facing!=null?o.facing:u.facing)*Math.PI/180;o.dest=[u.e-Math.sin(a)*300,u.n-Math.cos(a)*300];o.mode='retire'})}
function armyClear(){if(selUnits.size){for(const id of selUnits)delete armyOrders()[id]}else draft.armyOrders={};saveDraft();refreshArmy();renderCase&&renderCase()}
function orderCount(){return Object.keys(armyOrders()).length}
function drawOrders(){orderLayer.clearLayers();const bd=state.battleDemo,c=bd.center;
  for(const id in armyOrders()){const o=armyOrders()[id],u=unitById(id);if(!u)continue;
    if(o.dest){const col=o.mode==='retire'?'#6a6a6a':'#8a2c20';L.polyline([lo(c,u.e,u.n),lo(c,o.dest[0],o.dest[1])],{color:col,weight:2.5,dashArray:'6 6',interactive:false}).addTo(orderLayer);
      const g=Object.assign({},u,{e:o.dest[0],n:o.dest[1],facing:o.facing!=null?o.facing:u.facing,form:o.form||u.form}),d=dims(g);g.w=d.w;g.d=d.d;
      L.polygon(rectPts(c,g),{color:col,weight:1.4,dashArray:'4 4',fillColor:col,fillOpacity:.12,interactive:false}).addTo(orderLayer)}
    else if(o.mode==='hold'){L.circleMarker(lo(c,u.e,u.n),{radius:9,color:'#2a2118',weight:2,fill:false,dashArray:'2 3',interactive:false}).addTo(orderLayer)}}}
function rectPts(c,u){const a=u.facing*Math.PI/180,f=[Math.sin(a),Math.cos(a)],r=[Math.cos(a),-Math.sin(a)];return [[-u.w/2,-u.d/2],[u.w/2,-u.d/2],[u.w/2,u.d/2],[-u.w/2,u.d/2]].map(([x,y])=>lo(c,u.e+x*r[0]+y*f[0],u.n+x*r[1]+y*f[1]))}
function drawBattle(){
  initSim();if(!unitsOrig)unitsOrig=JSON.parse(JSON.stringify(state.battleDemo.units));unitGroups={};battleLayer.clearLayers();
  const bd=state.battleDemo,c=bd.center,z=map.getZoom();
  if(z<13){for(const [side,e,n,t] of [['A',-700,-300,'Imperial (illustrative)'],['B',-600,800,'Opposing (illustrative)']])L.marker(lo(c,e,n),{interactive:false,icon:L.divIcon({className:'',html:'<div class="army-counter '+side+'">'+t+' · '+bd.units.filter(u=>u.side===side).length+' blocks</div>',iconSize:[0,0]})}).addTo(battleLayer);return}
  if(z<15){for(const u of bd.units){if(!alive(u))continue;if(u.side==='B'&&!u.vis){if(u.seenE!=null)L.marker(lo(c,u.seenE,u.seenN),{interactive:false,icon:L.divIcon({className:'',html:'<div class="cnt B ghost"></div>',iconSize:[0,0]})}).addTo(battleLayer);continue}const m=L.marker(lo(c,u.e,u.n),{keyboard:false,icon:L.divIcon({className:'',html:'<div class="cnt '+u.side+' '+u.type+(selUnits.has(u.id)?' sel':'')+(u.st==='routing'?' rout':u.st==='wavering'?' wav':'')+'"></div>',iconSize:[0,0]})}).bindTooltip(u.name+' — '+Math.round(u.men)+' men, '+moraleWord(u),{className:'unit-lbl'});m.on('click',ev=>{L.DomEvent.stopPropagation(ev);selectUnits([u.id],ev.originalEvent&&(ev.originalEvent.shiftKey||ev.originalEvent.metaKey))});m.addTo(battleLayer);unitGroups[u.id]=m}drawOrders();orderLayer.addTo(map);return}
  for(const u0 of bd.units){
    if(!alive(u0))continue;
    if(u0.side==='B'&&!u0.vis){if(u0.seenE!=null){const gh=Object.assign({},u0,dims(u0),{e:u0.seenE,n:u0.seenN});L.polygon(rectPts(c,gh),{color:'#3b5f9a',weight:1,dashArray:'3 4',fillColor:'#3b5f9a',fillOpacity:.1,interactive:false}).addTo(battleLayer)}continue}
    const u=Object.assign({},u0,dims(u0)),A=u.side==='A',col=A?'#efe6cf':'#3b5f9a',edge=A?'#2a2118':'#0e1a33',sel=selUnits.has(u.id),g=L.featureGroup();
    const stc=u0.st==='routing'?'#b8442f':u0.st==='wavering'?'#c9a24a':edge;g.addLayer(L.polygon(rectPts(c,u),{color:sel?'#ffd45e':stc,weight:sel?3.2:(u0.st==='ok'?1.2:2.6),dashArray:u0.st==='routing'?'3 3':null,fillColor:u0.st==='routing'?'#d9c9b0':col,fillOpacity:(.55+Math.min(1,u0.men/u0.max)*.42)}));
    const a=u.facing*Math.PI/180,f=[Math.sin(a),Math.cos(a)],r=[Math.cos(a),-Math.sin(a)],P=(x,y)=>lo(c,u.e+x*r[0]+y*f[0],u.n+x*r[1]+y*f[1]);
    if(u.type==='inf'&&z>=16&&(u.form||'line')==='line')for(let k=-9;k<=9;k++)g.addLayer(L.circleMarker(P(k*u.w/20,0),{radius:1,color:edge,weight:0,fillColor:edge,fillOpacity:.65,interactive:false}));
    if(u.type==='cav'){g.addLayer(L.polyline([P(-u.w/2,-u.d/2),P(u.w/2,u.d/2)],{color:edge,weight:1,interactive:false}));g.addLayer(L.polyline([P(-u.w/2,u.d/2),P(u.w/2,-u.d/2)],{color:edge,weight:1,interactive:false}))}
    if(u.type==='art'){g.addLayer(L.circle(lo(c,u.e,u.n),{radius:9,color:edge,weight:1.5,fillColor:'#1d1710',fillOpacity:1,interactive:false}));g.addLayer(L.polyline([P(0,0),P(0,26)],{color:edge,weight:3,interactive:false}))}
    g.addLayer(L.polygon([P(-6,u.d/2+1),P(6,u.d/2+1),P(0,u.d/2+9)],{color:edge,weight:1,fillColor:sel?'#ffd45e':edge,fillOpacity:.9,interactive:false}));
    g.bindTooltip(u.name+' — '+Math.round(u0.men)+' men, '+moraleWord(u0),{sticky:true,className:'unit-lbl'});unitGroups[u.id]=g;g.on('click',ev=>{L.DomEvent.stopPropagation(ev);selectUnits([u.id],ev.originalEvent&&(ev.originalEvent.shiftKey||ev.originalEvent.metaKey))});g.addTo(battleLayer)}
  for(const [side,lbl,e,n] of [['A','Imperial army (illustrative)',-700,-520],['B','Opposing army (illustrative)',-600,980]])L.marker(lo(c,e,n),{interactive:false,icon:L.divIcon({className:'',html:'<div class="army-counter '+side+'">'+lbl+'</div>',iconSize:[0,0]})}).addTo(battleLayer);
  drawOrders();orderLayer.addTo(map);
}
function drawArrows(){arrowLayer.clearLayers()}
function syncBattle(){const on=battleOn&&map.getZoom()>=10;for(const l of[battleLayer,orderLayer]){if(on&&!map.hasLayer(l))l.addTo(map);if(!on&&map.hasLayer(l))map.removeLayer(l)}
  $('armybar').style.display=battleOn?'flex':'none';
  if(on&&!marching){const z=map.getZoom(),mode=z<13?0:z<15?1:2;if(syncBattle.mode!==mode){syncBattle.mode=mode;drawBattle()}}}
function showBattle(on){battleOn=on;syncBattle.mode=-1;if(on)drawBattle();syncBattle();renderBattle();renderArmyBar()}
function flyBattle(z){const bd=state.battleDemo;map.flyTo(lo(bd.center,-300,200),z||14,{duration:1})}
function selectUnit(id){selectUnits([id])}
function playOrders(){runPhase(1)}
function resetUnits(){newBattle()}
function applyCourse(o,toAll){
  const bd=state.battleDemo;if(!o)return;const A=myUnits();selUnits=new Set();
  for(const a of o.arrows){const dx=a.to[0]-a.from[0],dy=a.to[1]-a.from[1];for(const u of A)if(Math.hypot(u.e-a.from[0],u.n-a.from[1])<520){const ord=armyOrders()[u.id]||(armyOrders()[u.id]={});ord.dest=[u.e+dx*.7,u.n+dy*.7];ord.mode='advance';selUnits.add(u.id)}}
  saveDraft();refreshArmy();renderCase&&renderCase();status('Course applied as drafted orders. Adjust them, then preview or send them to your commanders.')}
/* bottom command bar */
function renderArmyBar(){
  const b=$('armybar');b.replaceChildren();if(!battleOn)return;
  const n=selUnits.size,gs=armyGroups();
  const sel=el('span',n?n+' selected':'Nothing selected','ab-sel');b.append(sel);
  const gsel=el('select',null,'ab-sel2');gsel.append(Object.assign(el('option','Select…'),{value:''}));for(const g of gs)gsel.append(Object.assign(el('option',g.name+' ('+g.ids.length+')'),{value:g.id}));gsel.onchange=()=>{const g=gs.find(x=>x.id===gsel.value);if(g)selectUnits(g.ids);gsel.value=''};b.append(gsel);
  const mk=(txt,fn,on,tt)=>{const x=el('button',txt,'ab-btn'+(on?' on':''));x.title=tt||'';x.onclick=fn;b.append(x);return x};
  mk('Move',()=>setArmyTool('move'),armyTool==='move','Click where they should go (M)');mk('Face',()=>setArmyTool('face'),armyTool==='face','Click toward the enemy (F)');
  mk('Line/Column',armyForm,false,'Toggle formation (C)');mk('Hold',armyHold,false,'Stand fast (H)');mk('Charge',armyCharge,false,'Cavalry: charge the nearest enemy in sight');mk('Advance',armyAdvance,false);mk('Retire',armyRetire,false);
  mk('Clear',armyClear,false,selUnits.size?'Clear orders for the selection':'Clear all orders');
  const pr=mk('Run phase ▶',playOrders,false,'Carry out your orders; the enemy answers');pr.classList.add('go');
  mk('Reset',resetUnits,false,'Put every unit back');
  b.append(el('span',orderCount()+' order'+(orderCount()===1?'':'s'),'ab-cnt'))}
/* Army tab */
function renderBattle(){
  const p=$('p-battle');if(!p)return;p.replaceChildren();const bd=state.battleDemo;if(!bd){p.append(el('p','No army to command.','briefing'));return}
  const field=state.player.mode==='field';
  p.append(el('div','Army · '+bd.place,'eyebrow'),el('h2','The line','dh'));
  p.append(el('p',field?'You are with the army: your orders are obeyed directly.':'At court this is a rehearsal on the table; in the field it is the fight itself. Real orders from court go as letters (Case → Army orders).','ctx'));
  const row=el('div',null,'row');
  const b1=el('button',battleOn?'Hide the table':'Open the table','btn seal');b1.onclick=()=>{showBattle(!battleOn);if(battleOn)flyBattle(14)};
  const b2=el('button','Zoom to the line','btn');b2.onclick=()=>{if(!battleOn)showBattle(true);flyBattle(15)};row.append(b1,b2);p.append(row);
  renderBattleStatus(p);
  p.append(el('div','Select','eyebrow',{style:'margin-top:12px'}));
  const gs=armyGroups(),chips=el('div',null,'chips');for(const g of gs){const c=el('button',g.name+' · '+g.ids.length,'chip btnchip'+(g.ids.length&&g.ids.every(i=>selUnits.has(i))?' on':''));c.onclick=()=>{if(!battleOn)showBattle(true);selectUnits(g.ids);if(map.getZoom()<14)flyBattle(14)};chips.append(c)}p.append(chips);
  p.append(el('p','Click a block, Shift-click to add, or Shift-drag a box on the map. Then use the command bar at the bottom of the map.','hint'));
  p.append(el('div','Drafted orders','eyebrow',{style:'margin-top:12px'}));
  const ids=Object.keys(armyOrders());if(!ids.length)p.append(el('p','None yet. Select units and Move, Face, Hold or Advance.','hint'));
  const byG={};for(const id of ids){const u=unitById(id),g=gs.find(x=>x.id!=='all'&&x.ids.includes(id));const k=g?g.name:'Other';(byG[k]=byG[k]||[]).push([u,armyOrders()[id]])}
  for(const k in byG){const c=el('div',null,'card');const o0=byG[k][0][1];const sum=o0.dest?(o0.mode==='retire'?'retire':'advance')+' ~'+Math.round(Math.hypot(o0.dest[0]-byG[k][0][0].e,o0.dest[1]-byG[k][0][0].n))+' m':(o0.mode||'hold');c.append(el('h3',k+' ('+byG[k].length+')'),el('p',sum+(o0.form?' · '+o0.form:'')+(o0.facing!=null?' · facing '+o0.facing+'°':''),'meta'));const rm=el('button','Remove','btn small quiet');rm.onclick=()=>{for(const [u] of byG[k])delete armyOrders()[u.id];saveDraft();refreshArmy();renderCase&&renderCase()};c.append(rm);p.append(c)}
  const co=el('details');co.append(el('summary','Courses your advisers suggest'));
  for(const o of bd.options){const c=el('div',null,'advice');const h=el('div',null,'ah');h.append(seal(o.by));const t=el('div');t.append(el('div',o.title,'at'),el('div',o.by,'by'));h.append(t);c.append(h,el('p',o.objective,'ob'));
    const dl=el('dl',null,'o');for(const [k,lbl] of [['reasoning','Reasoning'],['risks','Risks'],['needs','Requires']])if(o[k])dl.append(el('dt',lbl),el('dd',o[k]));c.append(dl);
    const r=el('div',null,'row');const ap=el('button','Draft these orders','btn small');ap.onclick=()=>{if(!battleOn)showBattle(true);applyCourse(o);flyBattle(14)};r.append(ap);c.append(r);co.append(c)}
  p.append(co);
  p.append(el('div','Forces (placeholders)','eyebrow',{style:'margin-top:12px'}));
  p.append(el('p',bd.note,'hint'));
  const u=[...selUnits].map(unitById)[0];
  if(u){const c=el('div',null,'card');c.style.borderColor='var(--brass)';c.append(el('h3',u.name),el('p',({inf:'Infantry',cav:'Cavalry',art:'Artillery'}[u.type])+' · '+(u.form||'line')+' · facing '+u.facing+'° · strength '+u.strength,'meta'));p.append(c)}
}
function initArmy(){
  orderLayer.addTo(map);map.boxZoom.disable();
  map.on('click',armyMapClick);
  map.on('mousedown',e=>{if(!battleOn||!(e.originalEvent.shiftKey))return;map.dragging.disable();dragStart=e.latlng;dragBox=L.rectangle([dragStart,dragStart],{color:'#ffd45e',weight:1.5,fillOpacity:.1,interactive:false}).addTo(map)});
  map.on('mousemove',e=>{if(dragBox)dragBox.setBounds([dragStart,e.latlng])});
  map.on('mouseup',e=>{if(!dragBox)return;const b=L.latLngBounds(dragStart,e.latlng);map.removeLayer(dragBox);dragBox=null;map.dragging.enable();
    const c=state.battleDemo.center,ids=myUnits().filter(u=>b.contains(lo(c,u.e,u.n))).map(u=>u.id);if(ids.length)selectUnits(ids,e.originalEvent.metaKey)});
  addEventListener('keydown',e=>{if(!battleOn||(e.target&&['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName)))return;
    if(e.key==='Escape'){armyTool=null;map.getContainer().style.cursor='';selUnits=new Set();refreshArmy()}
    else if(e.key==='M')setArmyTool('move');else if(e.key==='F')setArmyTool('face');else if(e.key==='C')armyForm();else if(e.key==='H')armyHold()})
}

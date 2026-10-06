//@@LEFT
function seal(name,cls){const s=el('span',(name||'?').trim().charAt(0).toUpperCase(),'mseal '+(cls||''));return s}
function hav(a,b){const R=6371,r=x=>x*Math.PI/180,dl=r(b[0]-a[0]),dn=r(b[1]-a[1]),h=Math.sin(dl/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function castById(id){return (state.cast||[]).find(c=>c.id===id)}
function playerLoc(){return state.locations.find(l=>l.id===state.player.locationId)}
function eta(cid,via){const c=castById(cid),pl=playerLoc();if(!c||!pl)return null;const to=state.locations.find(l=>l.id===c.place);if(!to)return {km:null,days:null,txt:'distance unknown'};
  if(via==='person'&&c.place===pl.id)return {km:0,days:0,txt:'same place · today'};
  const km=hav([pl.lat,pl.lon],[to.lat,to.lon])*1.2,sp={courier:100,post:55,person:40}[via]||55,f=season(),days=km/(sp*f);
  const d=new Date(state.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Math.max(0,Math.ceil(days)));
  return {km,days,txt:Math.round(km)+' km · about '+(days<1?'a day':Math.ceil(days)+' days')+' · arrives '+fmt(d.toISOString().slice(0,10))}}
function renderLeft(){
  $('player-line').textContent=state.player.name;$('title').textContent=state.title;$('briefing').textContent=state.briefing;
  const rs=$('reports');rs.replaceChildren();
  for(const r of state.reports){
    const c=el('article',null,'card click report',{tabindex:'0'});
    const from=(castById(r.from_id)||{}).name||r.from||'Unknown sender';
    const e=el('div',null,'eyebrow');e.append(from+' · '+({courier:'by courier',post:'by post',audience:'in person'}[r.via]||'received')+' · '+fmt(r.dated));const cl=claim(r.claim);if(cl)e.append(cl);
    c.append(e,el('h3',r.title),el('p',r.text));
    const row=el('div',null,'row');row.style.marginTop='6px';
    const show=el('button','Show on map','btn small quiet');show.onclick=ev=>{ev.stopPropagation();selectPlace(r.place)};
    const rep=el('button','Reply','btn small');rep.onclick=ev=>{ev.stopPropagation();replyTo(r.from_id||'')};
    row.append(show,rep);c.append(row);
    const go=()=>selectPlace(r.place);c.onclick=go;c.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go()}};
    rs.append(c);
  }
  const ks=$('knowledge');ks.replaceChildren();
  for(const k of state.knowledge||[]){const c=el('div',null,'card');c.append(el('p',k.text));const cl=claim(k.claim);if(cl){const m=el('div',null,'meta');m.append(cl);c.append(m)}ks.append(c)}
  $('forces-note').textContent=state.forcesNote||'';
}
function renderHeader(){
  const f=state.player.mode==='field';const m=$('mode');m.textContent=f?'In the field':'At court';m.classList.toggle('field',f);
  const loc=state.locations.find(l=>l.id===state.player.locationId);$('where').textContent=loc?loc.name:'Location unknown';
  $('prov').hidden=!state.player.provisional;
  $('turn').textContent='Turn '+state.turn;$('date').textContent=fmt(state.date);
}
//@@COUNSEL
function renderCounsel(){
  const p=$('p-counsel');p.replaceChildren();const d=state.decision;
  if(!d){p.append(el('p','Nothing awaits your decision. Write dispatches to move events.','briefing'));return}
  p.append(el('div','The council','eyebrow'),el('h2',d.title,'dh'),el('p',d.context,'ctx'));
  for(const o of d.options){
    const on=draft.option===o.id,card=el('div',null,'advice'+(on?' on':''));
    const head=el('div',null,'ah');head.append(seal(o.by));const t=el('div');t.append(el('div',o.title,'at'),el('div',o.by,'by'));head.append(t);card.append(head,el('p',o.objective,'ob'));
    const det=el('details');det.append(el('summary','Their case'));const dl=el('dl',null,'o');
    for(const [k,lbl] of [['reasoning','Reasoning'],['risks','Risks'],['needs','Requires'],['unknown','Uncertain'],['delegation','Delegation']])if(o[k])dl.append(el('dt',lbl),el('dd',o[k]));
    det.append(dl);card.append(det);
    const row=el('div',null,'row');row.style.marginTop='6px';
    const b=el('button',on?'✓ Chosen':'Choose this','btn small'+(on?' on':''));b.onclick=()=>{draft.option=on?'':o.id;saveDraft();renderCounsel();renderCase&&renderCase()};row.append(b);
    if(on){const a=el('button','Write it up →','btn small seal');a.onclick=()=>openCase('letters',undefined);row.append(a)}
    card.append(row);p.append(card)}
  const fd=el('details');fd.append(el('summary','Propose another course'));const t=el('textarea',null,null,{placeholder:'Your own course…'});t.value=draft.freeOption||'';t.oninput=()=>{draft.freeOption=t.value;saveDraft()};fd.append(t);p.append(fd);
}
//@@SCENE
function renderScene(){
  const p=$('p-scene');p.replaceChildren();const s=state.scene;
  if(!s){p.append(el('p','No conversation is open.','briefing'));return}
  p.append(el('div',(s.status==='concluded'?'Ended':'In conversation'),'eyebrow'),el('h2',s.title,'dh'),el('p',s.setting,'ctx'));
  const chips=el('div',null,'chips');for(const pt of s.participants){const c=el('span',null,'chip');c.append(seal(pt.name),pt.name);const cl=claim(pt.claim);if(cl)c.append(cl);c.title='Wants: '+pt.wants;chips.append(c)}p.append(chips);
  const log=el('div',null,'convo');
  for(const l of s.lines){const you=l.who==='You',narr=l.who==='Narration';const b=el('div',null,'bub'+(you?' you':narr?' narr':''));if(!you&&!narr)b.append(el('b',l.who));b.append(document.createTextNode(l.text));log.append(b)}
  p.append(log);
  if(s.commitments.length){const cm=el('div',null,'chips');for(const c of s.commitments)cm.append(el('span',(c.binding?'● ':'○ ')+c.by+': '+c.text,'chip tiny'));p.append(cm)}
  if(s.status==='concluded'){p.append(el('p','The conversation has ended. Its consequences count when you send your dispatches.','note'));return}
  const t=el('textarea',null,null,{id:'reply',placeholder:'Say your piece…',rows:'3'});t.value=draft.reply||'';t.oninput=()=>{draft.reply=t.value;saveDraft()};p.append(t);
  const row=el('div',null,'row');const b=el('button','Speak (copy to Claude)','btn seal');b.onclick=sendScene;row.append(b);p.append(row);
  const det=el('details');det.append(el('summary','Paste Claude’s reply'));const ta=el('textarea',null,null,{id:'scene-in',placeholder:'Paste the scene reply here'});det.append(ta);const ib=el('button','Apply','btn');ib.onclick=()=>applyScene(ta.value,ta);det.append(ib);p.append(det);
}

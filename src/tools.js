/* ---------- tools: measure, notes, reach, season, lenses, minimap, timeline, sound, access ---------- */
function initTools(){
  noteLayer.addTo(map);reachLayer.addTo(map);measureLayer.addTo(map);
  for(const n of state.annotations||[])addNoteMarker(n);
  map.on('click',e=>{if(toolMode==='measure'){measurePts.push([e.latlng.lat,e.latlng.lng]);drawMeasure()}else if(toolMode==='note'){openNote(e.latlng)}});
  map.on('dblclick',e=>{if(toolMode==='measure'){setTool(null)}});
  addEventListener('keydown',e=>{
    if(e.target&&['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName))return;
    if(e.key==='Escape')setTool(null);
    const k={'1':'europe','2':'theatre','3':'vienna','4':'prague','5':'battle'}[e.key];if(k)BOOK[k]();
    if(e.key==='m')setTool(toolMode==='measure'?null:'measure');
    if(e.key==='n')setTool(toolMode==='note'?null:'note')});
  $('toggleT').onclick=()=>{const o=$('tools').classList.toggle('on');$('toggleT').setAttribute('aria-expanded',o);if(o)initMini()};
  $('toggleY').onclick=()=>{const o=$('layers').classList.toggle('on');$('toggleY').setAttribute('aria-expanded',o)};
  // layers
  $('ly-places').onchange=e=>{placesOn=e.target.checked;syncPlaces()};
  $('ly-natural').onchange=e=>{e.target.checked?natLabels.addTo(map):map.removeLayer(natLabels)};
  $('ly-realms').onchange=e=>{realmsOn=e.target.checked;syncView()};
  $('ly-routes').onchange=e=>e.target.checked?routesLayer.addTo(map):map.removeLayer(routesLayer);
  $('ly-moves').onchange=e=>e.target.checked?movesLayer.addTo(map):map.removeLayer(movesLayer);
  $('ly-forts').onchange=e=>e.target.checked?fortLayer.addTo(map):map.removeLayer(fortLayer);
  $('ly-blocks').onchange=e=>{BL.on=e.target.checked;drawBlocks()};
  $('ly-ambient').onchange=e=>{ambientOn=e.target.checked;syncView()};
  const zl=$('zones');for(const k in META.realms.names){const s=document.createElement('span'),i=document.createElement('i');i.style.background=META.realms.colors[k];s.append(i,META.realms.names[k]);s.onclick=()=>realmCard(k);zl.append(s)}
  // lenses
  for(const r of document.querySelectorAll('input[name=lens]'))r.onchange=()=>lens(r.value);
  $('season').onchange=e=>setSeason(e.target.value);setSeason('autumn');
  // bookmarks
  for(const b of document.querySelectorAll('[data-book]'))b.onclick=()=>BOOK[b.dataset.book]();
  $('tool-measure').onclick=()=>setTool(toolMode==='measure'?null:'measure');$('tool-note').onclick=()=>setTool(toolMode==='note'?null:'note');
  $('tool-clear').onclick=()=>{measurePts=[];measureLayer.clearLayers();reachLayer.clearLayers();$('measure-out').textContent=''};
  $('reach-btn').onclick=()=>showReach($('reach-place').value);
  for(const l of state.locations)$('reach-place').append(Object.assign(document.createElement('option'),{value:l.id,textContent:l.name}));
  // access
  $('a-motion').onchange=e=>{reduceMotion=e.target.checked;document.body.classList.toggle('rm',reduceMotion);syncView()};
  $('a-contrast').onchange=e=>document.body.classList.toggle('hc',e.target.checked);
  $('a-size').oninput=e=>{document.documentElement.style.setProperty('--ui',e.target.value/100);for(const id of['left','right','tools','layers'])$(id).style.zoom=e.target.value/100};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('a-motion').checked=true;$('a-motion').onchange({target:$('a-motion')})}
  $('a-sound').onchange=e=>sound(e.target.checked);
  $('note-save').onclick=saveNote;$('note-cancel').onclick=()=>$('notedlg').close();
  buildTimeline();
}
function setTool(t){toolMode=t;measureLayer.clearLayers&&(t!=='measure'&&0);
  $('tool-measure').classList.toggle('on',t==='measure');$('tool-note').classList.toggle('on',t==='note');
  map.getContainer().style.cursor=t?'crosshair':'';status(t==='measure'?'Measure: click points, double-click or Esc to finish.':t==='note'?'Note: click the map to place a note. Esc cancels.':'Ready.')}
function drawMeasure(){measureLayer.clearLayers();if(!measurePts.length)return;
  L.polyline(measurePts,{color:'#f4e8c8',weight:6,opacity:.8,interactive:false}).addTo(measureLayer);L.polyline(measurePts,{color:'#8a2c20',weight:3,dashArray:'6 6',interactive:false}).addTo(measureLayer);
  for(const p of measurePts)L.circleMarker(p,{radius:4,color:'#8a2c20',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(measureLayer);
  const km=pathKm(measurePts)*1.12,f=season();
  const out=Math.round(km)+' km (road allowance +12%) — foot ≈ '+Math.max(.1,km/(KMD.foot*f)).toFixed(1)+' d · horse ≈ '+Math.max(.1,km/(KMD.horse*f)).toFixed(1)+' d · wagons ≈ '+Math.max(.1,km/(KMD.wagon*f)).toFixed(1)+' d · courier ≈ '+Math.max(.1,km/(KMD.courier*f)).toFixed(1)+' d';
  $('measure-out').textContent=out+' ('+seasonName+')';status(out)}
function showReach(id){reachLayer.clearLayers();const l=state.locations.find(x=>x.id===id);if(!l)return;const f=season()*.8;
  const arms=[['courier','#7fa6ee',$('r-courier').checked],['foot','#f3d27a',$('r-foot').checked],['wagon','#d98a5a',$('r-wagon').checked]];
  for(const [a,col,on] of arms){if(!on)continue;for(const d of[1,3,7]){const r=KMD[a]*d*f*1000;if(r>1800000)continue;
    L.circle([l.lat,l.lon],{radius:r,color:col,weight:2,fill:false,dashArray:d===1?null:'8 6',opacity:.9,interactive:false}).addTo(reachLayer);
    L.marker(destPoint(l,r,a==='courier'?10:a==='foot'?100:190),{interactive:false,icon:L.divIcon({className:'',html:'<div class="mv-lbl">'+a+' · '+d+' d</div>',iconSize:[0,0]})}).addTo(reachLayer)}}
  status('Reach from '+l.name+': straight-line, reduced for roads and '+seasonName+' ('+Math.round(f*100)+'%). Real routes would be shorter.')}
function destPoint(l,r,brg){const R=6371000,b=brg*Math.PI/180,la=l.lat*Math.PI/180,lo_=l.lon*Math.PI/180,d=r/R;const la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));const lo2=lo_+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));return[la2*180/Math.PI,lo2*180/Math.PI]}
/* notes */
let pendingNote=null;
function openNote(ll){pendingNote=ll;$('note-text').value='';$('notedlg').showModal();$('note-text').focus()}
function saveNote(){const t=$('note-text').value.trim();$('notedlg').close();if(!t||!pendingNote)return;state.annotations=state.annotations||[];const n={id:'n'+Date.now(),lat:pendingNote.lat,lon:pendingNote.lng,text:t.slice(0,500),date:state.date};state.annotations.push(n);addNoteMarker(n);persistState();setTool(null)}
function addNoteMarker(n){const m=L.marker([n.lat,n.lon],{icon:L.divIcon({className:'',html:'<div class="note-pin">✎</div>',iconSize:[0,0]})}).addTo(noteLayer);
  const box=document.createElement('div');box.append(Object.assign(document.createElement('div'),{textContent:n.text}));const del=Object.assign(document.createElement('button'),{textContent:'Delete note',className:'btn small quiet'});del.style.marginTop='6px';del.onclick=()=>{noteLayer.removeLayer(m);state.annotations=state.annotations.filter(x=>x.id!==n.id);persistState()};box.append(del);m.bindPopup(box)}
/* season & lenses */
function setSeason(s){seasonName=s;const o={autumn:'rgba(190,120,50,.10)',winter:'rgba(214,228,248,.30)',spring:'rgba(150,190,110,.06)',summer:'rgba(230,190,90,.07)'}[s];$('seasonov').style.background=o;
  const note={autumn:'Autumn: roads soften with rain; marches ~85% of summer pace; forage still available.',winter:'Winter: frozen ground carries wagons but cold and short days cut marches to ~60%; armies normally go into winter quarters.',spring:'Spring: thaw and mud; marches ~75%; rivers in flood.',summer:'Summer: best marching season; forage and water vary.'}[s];$('season-note').textContent=note;
  if(measurePts.length)drawMeasure();if($('reach-place').value&&reachLayer.getLayers().length)showReach($('reach-place').value)}
function lens(v){const set=(id,on)=>{const e=$(id);e.checked=on;e.onchange({target:e})};
  if(v==='political'){set('ly-realms',true);set('ly-routes',false);set('ly-moves',true);set('ly-forts',false)}
  if(v==='terrain'){set('ly-realms',false);set('ly-routes',false);set('ly-moves',false);set('ly-forts',false)}
  if(v==='logistics'){set('ly-realms',false);set('ly-routes',true);set('ly-moves',true);set('ly-forts',true)}}
/* minimap */
let mini=null;
function initMini(){if(mini)return;mini=L.map('minimap',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false,zoomSnap:.5});
  L.tileLayer('tiles1740/{z}/{x}/{y}.webp',{minZoom:3,maxNativeZoom:5,noWrap:true,bounds:B(META.E),errorTileUrl:BLANK}).addTo(mini);
  mini.fitBounds([[34,-12],[70,44]],{animate:false});const rect=L.rectangle(map.getBounds(),{color:'#8a2c20',weight:2,fillOpacity:.08,interactive:false}).addTo(mini);
  const upd=()=>rect.setBounds(map.getBounds());map.on('move',upd);mini.on('click',e=>map.flyTo(e.latlng,Math.max(map.getZoom(),5),{duration:.8}))}
/* timeline */
function buildTimeline(){const t=$('timeline');t.replaceChildren();const ev=[];
  for(const r of state.reports)ev.push({d:r.dated,txt:r.title,kind:'report',place:r.place});
  for(const m of state.movements||[])ev.push({d:m.reported,txt:m.label,kind:'move',pt:m.pts[0]});
  for(const l of state.ledger||[])ev.push({d:l.date,txt:l.text,kind:'ledger'});
  ev.sort((a,b)=>a.d<b.d?-1:1);
  const h=el('span',fmt(state.date)+' · now','tl-now');t.append(h);
  for(const e of ev){const c=el('button',fmt(e.d)+' — '+e.txt.slice(0,46),'tl-chip '+e.kind);c.onclick=()=>{if(e.place)selectPlace(e.place);else if(e.pt)map.flyTo(e.pt,7,{duration:.8})};t.append(c)}}
/* sound (WebAudio, synthesised: no files) */
let ac=null,windG=null,bellT=null;
function sound(on){if(!on){if(ac){ac.close();ac=null}clearInterval(bellT);return}
  ac=new (window.AudioContext||window.webkitAudioContext)();const len=ac.sampleRate*2,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let l=0;for(let i=0;i<len;i++){l=l*.97+(Math.random()*2-1)*.03;d[i]=l*3}
  const src=ac.createBufferSource();src.buffer=buf;src.loop=true;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=500;windG=ac.createGain();windG.gain.value=.12;src.connect(f).connect(windG).connect(ac.destination);src.start();
  bellT=setInterval(()=>{if(!ac||!map||map.getZoom()<13)return;bell()},22000)}
function bell(){const t=ac.currentTime;for(const [fr,dl] of[[392,0],[523,1.1]]){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=fr;g.gain.setValueAtTime(0,t+dl);g.gain.linearRampToValueAtTime(.06,t+dl+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dl+3);o.connect(g).connect(ac.destination);o.start(t+dl);o.stop(t+dl+3.2)}}
let drumT=null;
function soundDrums(on){clearInterval(drumT);if(!on||!ac)return;drumT=setInterval(()=>{const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(55,t+.2);g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+.3)},520)}

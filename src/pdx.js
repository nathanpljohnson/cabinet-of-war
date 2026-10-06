/* ---------- Paradox-style political map: realm fills, borders, painted realm names, map modes ---------- */
const PFONT='"IM Fell English SC","IM Fell English",Georgia,serif';
const PCOL={austria:'#efc54c',inner:'#ecc04a',tyrol:'#eec34e',bohemia:'#e9bb46',moravia:'#ecbf4a',silesia:'#eabd48',hungary:'#e5b443',milan:'#efc54c',austnl:'#efc54c',
  bavaria:'#6fa8e0',saxony:'#5aa865',prussia:'#56699a',poland:'#cf6d7d',salzburg:'#ad86cf',venice:'#3ea597',swiss:'#d05656',empire:'#bdae92',ottoman:'#5f9e7a',
  france:'#4d72c8',spain:'#d9763a',portugal:'#4f9a5c',dutch:'#f2a03c',britain:'#c84b4b',denmark:'#b8566e',sweden:'#3d86c9',russia:'#8aa04c',savoy:'#9b7fd1',
  genoa:'#d8b25a',papal:'#efe2a2',tuscany:'#cf8b4a',twosicilies:'#c96f9e',modena:'#a990d6',parma:'#8fb0dd',lucca:'#d9a08a'};
const HCOL={austria:'#f2c94c',inner:'#e8963a',tyrol:'#cdbb78',bohemia:'#e07b4f',moravia:'#c9b23f',silesia:'#f19a63',hungary:'#d95f5f',milan:'#e8c07a',austnl:'#e6c07a'};
const REACH=[[2,'#4f9a52','≤ 2 days'],[4,'#93b44e','2–4'],[7,'#dcc24a','4–7'],[10,'#e0913f','7–10'],[14,'#cf5f3a','10–14'],[1e9,'#a3404a','14 +']];
const PMODES=[
  {id:'political',key:'q',name:'Political',hint:'Realms and crowns c.1740 on a hand-coloured map built from modern elevation, coast and forest data. Extents are modern provinces grouped, so frontiers are approximate; names use 1740 forms where known.',
   icon:'<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',ov:{routes:0,moves:0,forts:0}},
  {id:'habsburg',key:'w',name:'Habsburg lands',hint:'The crowns your sovereign holds or claims; other realms greyed.',
   icon:'<path d="M3 19h18M4 19 3 8l5 4 4-7 4 7 5-4-1 11"/>',ov:{routes:0,moves:0,forts:0}},
  {id:'terrain',key:'e',name:'Terrain',hint:'Relief, rivers and forests without political colour. Modern elevation, coast and forest data; ground detail around towns and the battlefield is illustrative.',
   icon:'<path d="M2 20 9 8l4 6 3-4 6 10z"/>',ov:{routes:0,moves:0,forts:0}},
  {id:'reach',key:'r',name:'Courier reach',hint:'Days for a courier from your location: your staff’s estimate (same rule as the reach rings), not live knowledge.',
   icon:'<path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9"/>',ov:{routes:0,moves:0,forts:0}},
  {id:'trade',key:'t',name:'Trade',hint:'Roads, rivers and salt routes (placeholders until sourced).',
   icon:'<path d="M12 3v18M7 21h10M4 7h16M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',ov:{routes:1,moves:0,forts:0}},
  {id:'intel',key:'y',name:'Intelligence',hint:'Reported movements and fortresses, with report status and age.',
   icon:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',ov:{routes:0,moves:1,forts:1}}];
const PX={mode:'political',hover:-1,sel:-1,L:{}};

function pdxMerc(lon,lat){const s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lon+180)/360*256,(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*256]}
function pdxSig(x,y){const n=x.length,s=new Float32Array(n);s[0]=s[n-1]=Infinity;const st=[[0,n-1,Infinity]];
  while(st.length){const [a,b,cap]=st.pop();if(b<=a+1)continue;const dx=x[b]-x[a],dy=y[b]-y[a],L=Math.hypot(dx,dy);let md=-1,mi=a+1;
    for(let i=a+1;i<b;i++){const d=L>0?Math.abs(dy*(x[i]-x[a])-dx*(y[i]-y[a]))/L:Math.hypot(x[i]-x[a],y[i]-y[a]);if(d>md){md=d;mi=i}}
    const v=Math.min(md,cap);s[mi]=v;st.push([a,mi,v],[mi,b,v])}
  return s}
const PdxPaint=L.Path.extend({options:{interactive:false},
  initialize(fn,o){this._fn=fn;L.setOptions(this,o)},
  _project(){this._pxBounds=L.bounds([-1e7,-1e7],[1e7,1e7])},_update(){},
  _updatePath(){if(this._map)this._fn(this._renderer._ctx,this._renderer)},
  _empty(){return false},_containsPoint(){return false}});

function initPdx(){
  const D=PX.D=JSON.parse($('pdx').textContent);PX.realm=D.realms;
  PX.ax=[];PX.ay=[];PX.as=[];PX.ab=[];
  for(const a of D.arcs){const m=a.length>>1,x=new Float64Array(m),y=new Float64Array(m);let lo=0,la=0,b=[1e9,1e9,-1e9,-1e9];
    for(let i=0;i<m;i++){lo+=a[2*i];la+=a[2*i+1];const p=pdxMerc(lo/1e4,la/1e4);x[i]=p[0];y[i]=p[1];b=[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])]}
    PX.ax.push(x);PX.ay.push(y);PX.as.push(pdxSig(x,y));PX.ab.push(b)}
  PX.prov=D.prov.map(([r,name,lat,lon,rings])=>{let b=[1e9,1e9,-1e9,-1e9];for(const ring of rings)for(const ref of ring){const q=PX.ab[ref<0?~ref:ref];b=[Math.min(b[0],q[0]),Math.min(b[1],q[1]),Math.max(b[2],q[2]),Math.max(b[3],q[3])]}return {r,name,lat,lon,rings,b}});
  PX.byRealm=PX.realm.map(()=>[]);PX.prov.forEach((p,i)=>PX.byRealm[p.r].push(i));
  PX.rb=PX.realm.map((_,r)=>D.bound[r]||[]);
  PX.labels=D.labels.map(l=>Object.assign({},l,{q:l.p.map(([la,lo])=>pdxMerc(lo,la))}));pdxMeasure();
  for(const [n,z] of [['pdxFill',350],['pdxInk',360],['pdxSel',372],['pdxHover',374]]){const p=map.createPane(n);p.style.zIndex=z;p.style.pointerEvents='none'}
  for(const [k,fn] of [['fill',pdxDrawFill],['ink',pdxDrawInk],['sel',pdxDrawSel],['hov',pdxDrawHover]]){
    const pane={fill:'pdxFill',ink:'pdxInk',sel:'pdxSel',hov:'pdxHover'}[k];PX.L[k]=new PdxPaint(fn,{renderer:L.canvas({pane,padding:.4})}).addTo(map)}
  // the legend and realm cards use the political palette
  Object.assign(META.realms.colors,PCOL);const keys=Object.keys(META.realms.names);document.querySelectorAll('#zones i').forEach((i,n)=>{if(PCOL[keys[n]])i.style.background=PCOL[keys[n]]});
  if(document.fonts)document.fonts.load('100px "IM Fell English SC"').then(()=>{pdxMeasure();PX.L.ink.redraw()}).catch(()=>{});
  pdxUI();
  map.on('mousemove',e=>{PX.lastE=e;if(!PX.raf)PX.raf=requestAnimationFrame(()=>{PX.raf=0;pdxHoverAt(PX.lastE)})});
  map.on('mouseout movestart zoomstart',()=>pdxSetHover(-1,null));map.on('zoomend',pdxLegend);
  map.on('click',e=>{if(toolMode||battleOn||armyTool||!pdxOn())return;const i=pdxProvAt(e.latlng);pdxSelect(i<0?-1:PX.prov[i].r);if(i>=0)realmCard(PX.realm[PX.prov[i].r])});
  $('ly-realms').addEventListener('change',pdxRedraw);$('season').addEventListener('change',()=>{if(PX.mode==='reach')pdxRedraw()});
  let m='political';try{m=localStorage.getItem('cabinet-of-war:mapmode')||m}catch{}
  pdxSetMode(PMODES.some(x=>x.id===m)?m:'political',true);
}
function pdxMeasure(){const c=document.createElement('canvas').getContext('2d');c.font='100px '+PFONT;
  for(const l of PX.labels){l.cw=[...l.t].map(ch=>c.measureText(ch).width);l.w1=(l.cw.reduce((a,b)=>a+b,0)+22*(l.cw.length-1))/100}}
function pdxOn(){return realmsOn&&map.getZoom()<=11}
function pdxRedraw(){for(const k in PX.L)PX.L[k].redraw();document.body.classList.toggle('pdx-names',realmsOn&&PX.mode!=='terrain');pdxLegend()}
function pdxView(r){const z=map.getZoom(),k=2**z,o=map.getPixelOrigin(),b=r._bounds;return {z,k,ox:o.x,oy:o.y,x0:(b.min.x+o.x)/k,y0:(b.min.y+o.y)/k,x1:(b.max.x+o.x)/k,y1:(b.max.y+o.y)/k,tol:.6/k}}
function pdxHit(b,v){return !(b[2]<v.x0||b[0]>v.x1||b[3]<v.y0||b[1]>v.y1)}
function pdxRing(p,refs,v){let first=true;
  for(const ref of refs){const a=ref<0?~ref:ref,x=PX.ax[a],y=PX.ay[a],s=PX.as[a],n=x.length;
    if(ref>=0){for(let i=first?0:1;i<n;i++){if(s[i]<v.tol)continue;const X=x[i]*v.k-v.ox,Y=y[i]*v.k-v.oy;if(first){p.moveTo(X,Y);first=false}else p.lineTo(X,Y)}}
    else{for(let i=first?n-1:n-2;i>=0;i--){if(s[i]<v.tol)continue;const X=x[i]*v.k-v.ox,Y=y[i]*v.k-v.oy;if(first){p.moveTo(X,Y);first=false}else p.lineTo(X,Y)}}}
  p.closePath()}
function pdxArc(p,a,v){const x=PX.ax[a],y=PX.ay[a],s=PX.as[a];p.moveTo(x[0]*v.k-v.ox,y[0]*v.k-v.oy);for(let i=1;i<x.length;i++){if(s[i]<v.tol)continue;p.lineTo(x[i]*v.k-v.ox,y[i]*v.k-v.oy)}}
function pdxRealmPath(r,v){const p=new Path2D();let any=false;for(const i of PX.byRealm[r]){const P=PX.prov[i];if(!pdxHit(P.b,v))continue;any=true;for(const ring of P.rings)pdxRing(p,ring,v)}return any?p:null}
function pdxOutline(r,v){const p=new Path2D();for(const a of PX.rb[r])if(pdxHit(PX.ab[a],v))pdxArc(p,a,v);return p}
function pdxFam(r){return (META.realms.fam||{})[PX.realm[r]]}
function pdxOrigin(){return state.locations.find(l=>l.id===state.player.locationId)||state.locations[0]}
function pdxDays(lat,lon){const o=pdxOrigin();return map.distance([o.lat,o.lon],[lat,lon])/1000/(KMD.courier*season()*.8)}
function pdxGroups(){const m=PX.mode,g=[];
  if(m==='terrain')return g;
  if(m==='reach'){for(const [lim,col] of REACH)g.push({col,a:.95,provs:[]});for(let i=0;i<PX.prov.length;i++){const d=pdxDays(PX.prov[i].lat,PX.prov[i].lon);g[REACH.findIndex(x=>d<=x[0])].provs.push(i)}return g}
  PX.realm.forEach((k,r)=>{
    if(m==='habsburg')g.push(pdxFam(r)==='hab'?{col:HCOL[k]||PCOL[k],a:1,band:1,r,provs:PX.byRealm[r]}:{col:'#a59f92',a:.4,r,provs:PX.byRealm[r]});
    else g.push({col:PCOL[k]||'#bbb',a:(m==='political'?1:.5)*(k==='empire'?.75:1),band:1,r,provs:PX.byRealm[r]})});
  return g}
function pdxAlpha(z){z=Math.round(z);return z>=12?0:[.62,.62,.62,.62,.62,.62,.56,.5,.42,.34,.26,.2][z]}
function pdxDrawFill(ctx,R){if(!pdxOn())return;const v=pdxView(R),a=pdxAlpha(v.z),K=PX.D.kind;if(!a)return;
  ctx.lineJoin='round';
  for(const g of pdxGroups()){const p=new Path2D();let any=false;
    for(const i of g.provs){const P=PX.prov[i];if(!pdxHit(P.b,v))continue;any=true;for(const ring of P.rings)pdxRing(p,ring,v)}
    if(!any)continue;ctx.globalAlpha=a*g.a;ctx.fillStyle=g.col;ctx.fill(p,'nonzero');
    if(g.band){const bp=new Path2D();for(const ai of PX.rb[g.r])if(K[ai]!=='x'&&pdxHit(PX.ab[ai],v))pdxArc(bp,ai,v);
      ctx.save();ctx.clip(p,'nonzero');ctx.globalAlpha=Math.min(1,a*1.3)*g.a;ctx.strokeStyle=g.col;ctx.lineWidth=2*Math.min(14,2+v.z*1.4);ctx.stroke(bp);ctx.restore()}}
  ctx.globalAlpha=1}
function pdxDrawInk(ctx,R){if(!pdxOn())return;const v=pdxView(R),z=v.z,K=PX.D.kind,terr=PX.mode==='terrain';
  ctx.globalAlpha=z===11?.6:1;ctx.lineJoin=ctx.lineCap='round';
  const kindPath=k=>{const p=new Path2D();for(let a=0;a<K.length;a++)if(K[a]===k&&pdxHit(PX.ab[a],v))pdxArc(p,a,v);return p};
  if(z>=5&&!terr){ctx.strokeStyle='rgba(70,44,22,'+(z>=7?.34:.24)+')';ctx.lineWidth=z>=8?.9:.7;ctx.stroke(kindPath('p'))}
  ctx.setLineDash(z>=6?[7,4]:[4,3]);ctx.strokeStyle='rgba(56,32,14,'+(terr?.4:.72)+')';ctx.lineWidth=z>=6?1.6:1.2;ctx.stroke(kindPath('c'));ctx.setLineDash([]);
  const sp=kindPath('s'),w=terr?1:Math.min(3.6,.5+z*.32);
  ctx.strokeStyle='rgba(250,240,212,'+(terr?.3:.55)+')';ctx.lineWidth=w+3;ctx.stroke(sp);ctx.strokeStyle='rgba(36,20,10,'+(terr?.55:.9)+')';ctx.lineWidth=w;ctx.stroke(sp);
  if(!terr)pdxDrawLabels(ctx,v);ctx.globalAlpha=1}
function pdxDrawLabels(ctx,v){const m=PX.mode,base=ctx.globalAlpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(const l of PX.labels){
    const am=m==='habsburg'?(pdxFam(l.r)==='hab'?1:.35):m==='political'?1:m==='reach'?.55:.45;
    const fs=Math.min(l.len*.84/l.w1,l.h*.6)*v.k;if(fs<8.5)continue;
    const fa=Math.min(1,(fs-8.5)/3)*(fs>80?Math.max(0,1-(fs-80)/60):1);if(fa<=0)continue;
    const P=l.q.map(q=>[q[0]*v.k-v.ox,q[1]*v.k-v.oy]),cum=[0];for(let i=1;i<P.length;i++)cum.push(cum[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
    const len=cum[cum.length-1],at=d=>{d=Math.max(0,Math.min(len,d));let i=1;while(i<P.length-1&&cum[i]<d)i++;const t=(d-cum[i-1])/((cum[i]-cum[i-1])||1);return [P[i-1][0]+(P[i][0]-P[i-1][0])*t,P[i-1][1]+(P[i][1]-P[i-1][1])*t]};
    const bx=Math.min(...P.map(p=>p[0]))-fs,by=Math.min(...P.map(p=>p[1]))-fs,ex=Math.max(...P.map(p=>p[0]))+fs,ey=Math.max(...P.map(p=>p[1]))+fs,rb=PX.L.ink._renderer._bounds;
    if(ex<rb.min.x||bx>rb.max.x||ey<rb.min.y||by>rb.max.y)continue;
    ctx.font=fs+'px '+PFONT;ctx.lineWidth=Math.max(2,fs*.09);ctx.globalAlpha=base*am*fa;
    const sp=fs*.22;let s=(len-l.w1*fs)/2;const chars=[...l.t];
    for(let i=0;i<chars.length;i++){const cw=l.cw[i]*fs/100,d=s+cw/2,[x,y]=at(d),a=at(d-4),b=at(d+4);
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(b[1]-a[1],b[0]-a[0]));
      ctx.strokeStyle='rgba(248,238,208,.6)';ctx.strokeText(chars[i],0,0);ctx.fillStyle='rgba(40,24,12,.82)';ctx.fillText(chars[i],0,0);ctx.restore();s+=cw+sp}}
  ctx.globalAlpha=base}
function pdxDrawHover(ctx,R){if(PX.hover<0||!pdxOn())return;const v=pdxView(R),p=pdxRealmPath(PX.hover,v);if(!p)return;
  ctx.fillStyle='rgba(255,250,228,.17)';ctx.fill(p,'nonzero');ctx.lineJoin='round';ctx.strokeStyle='rgba(255,244,200,.85)';ctx.lineWidth=1.6;ctx.stroke(pdxOutline(PX.hover,v))}
function pdxDrawSel(ctx,R){if(PX.sel<0||!pdxOn())return;const v=pdxView(R),o=pdxOutline(PX.sel,v);
  ctx.lineJoin='round';ctx.strokeStyle='rgba(28,14,4,.85)';ctx.lineWidth=6;ctx.stroke(o);ctx.shadowColor='rgba(255,210,90,1)';ctx.shadowBlur=14;ctx.strokeStyle='#fff0b0';ctx.lineWidth=2.6;ctx.stroke(o);ctx.shadowBlur=0}
function pdxSelect(r){if(r===PX.sel)return;PX.sel=r;PX.L.sel.redraw()}
function pdxProvAt(ll){const [x,y]=pdxMerc(ll.lng,ll.lat);
  for(let i=0;i<PX.prov.length;i++){const P=PX.prov[i],b=P.b;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;let c=false;
    for(const ring of P.rings){let px=null,py=null;
      for(const ref of ring){const a=ref<0?~ref:ref,ax=PX.ax[a],ay=PX.ay[a],n=ax.length;
        for(let j=0;j<n;j++){const k=ref<0?n-1-j:j,qx=ax[k],qy=ay[k];if(px!==null&&((qy>y)!==(py>y))&&x<(px-qx)*(y-qy)/(py-qy)+qx)c=!c;px=qx;py=qy}}}
    if(c)return i}
  return -1}
function pdxSetHover(r,e,i){if(r!==PX.hover){PX.hover=r;PX.L.hov.redraw()}pdxTip(r<0?null:e,i)}
function pdxHoverAt(e){if(moving||toolMode||armyTool||!pdxOn()||innerWidth<=860){pdxSetHover(-1,null);return}
  const i=pdxProvAt(e.latlng);pdxSetHover(i<0?-1:PX.prov[i].r,e,i)}
function pdxTip(e,i){const t=$('pdx-tip');if(!e||i==null||i<0){t.style.display='none';return}
  const P=PX.prov[i],k=PX.realm[P.r],info=(META.realms.info||{})[k]||{},o=pdxOrigin(),d=pdxDays(P.lat,P.lon);
  if(t._k!==i+PX.mode){t._k=i+PX.mode;t.replaceChildren();
    const h=el('div',null,'t'),sw=el('i');sw.style.background=PX.mode==='habsburg'&&pdxFam(P.r)!=='hab'?'#a59f92':(PX.mode==='habsburg'&&HCOL[k])||PCOL[k];h.append(sw,META.realms.names[k]);t.append(h);
    if(info.ruler){const r=el('div',info.ruler+' ','r'),c=claim(info.claim||'inference');if(c)r.append(c);t.append(r)}
    const dd=el('div',null,'d'+(PX.mode==='reach'?' hot':''));dd.textContent='Courier from '+o.name+' ≈ '+(d<1?'under a day':Math.round(d)+(Math.round(d)===1?' day':' days'))+' (staff estimate)';t.append(dd);
    t.append(el('div',(P.name?'Modern district: '+P.name+' · ':'')+'realm extent approximate','m'))}
  const x=e.originalEvent.clientX,y=e.originalEvent.clientY;t.style.display='block';
  t.style.left=Math.min(innerWidth-t.offsetWidth-8,x+18)+'px';t.style.top=Math.min(innerHeight-t.offsetHeight-8,y+18)+'px'}
function pdxUI(){
  const bar=el('div',null,null,{id:'pdx-modes',role:'toolbar','aria-label':'Map modes'});
  for(const m of PMODES){const b=el('button',null,null,{type:'button','data-mode':m.id,'aria-pressed':'false','aria-label':m.name+' map mode ('+m.key.toUpperCase()+')',title:m.name+' ('+m.key.toUpperCase()+')'});
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+m.icon+'</svg><kbd>'+m.key.toUpperCase()+'</kbd>';b.onclick=()=>pdxSetMode(m.id);bar.append(b)}
  document.body.append(bar,el('div',null,null,{id:'pdx-legend','aria-live':'polite'}),el('div',null,null,{id:'pdx-tip',role:'tooltip'}));
  const dock=()=>{const r=$('right'),hid=r.classList.contains('hide')||innerWidth<=860;document.documentElement.style.setProperty('--pdx-r',(hid?14:r.offsetWidth+30)+'px')};
  new MutationObserver(dock).observe($('right'),{attributes:true,attributeFilter:['class']});addEventListener('resize',dock);dock();
  addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||(e.target&&(['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)))return;
    const m=PMODES.find(x=>x.key===e.key);if(m){pdxSetMode(m.id);return}
    if(e.target!==document.body)return;
    const pan={ArrowUp:[0,-160],ArrowDown:[0,160],ArrowLeft:[-160,0],ArrowRight:[160,0]}[e.key];if(pan){e.preventDefault();map.panBy(pan)}
    if(e.key==='+'||e.key==='=')map.zoomIn();if(e.key==='-')map.zoomOut()})}
function pdxSetMode(id,quiet){PX.mode=id;try{localStorage.setItem('cabinet-of-war:mapmode',id)}catch{}
  const m=PMODES.find(x=>x.id===id);document.querySelectorAll('#pdx-modes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===id));
  for(const [k,on] of Object.entries(m.ov)){const e=$('ly-'+k);if(e&&e.checked!==!!on){e.checked=!!on;e.onchange({target:e})}}
  if(!realmsOn&&id!=='terrain'){const e=$('ly-realms');e.checked=true;e.onchange({target:e})}
  $('pdx-tip').style.display='none';pdxRedraw();if(!quiet)status('Map mode: '+m.name+'.')}
function pdxLegend(){const box=$('pdx-legend');if(!box)return;const m=PMODES.find(x=>x.id===PX.mode);box.replaceChildren(el('div',m.name,'n'),el('div',m.hint,'h'));
  const chips=el('div',null,'chips'),chip=(col,txt)=>{const s=el('span'),i=el('i');i.style.background=col;s.append(i,txt);chips.append(s)};
  if(PX.mode==='reach'){for(const [,col,txt] of REACH)chip(col,txt);box.append(el('div','From '+pdxOrigin().name+', '+$('season').selectedOptions[0].textContent.toLowerCase()+' roads','h'))}
  if(PX.mode==='habsburg')for(const k in HCOL)chip(HCOL[k],META.realms.names[k]);
  if(chips.childNodes.length)box.append(chips);
  if(!realmsOn)box.append(el('div','Realms are switched off in Layers.','h'));
  box.style.display=map.getZoom()<=11?'':'none'}

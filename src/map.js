/* ---------- map v4: a 1740-style Europe ---------- */
const EXONYM={'Wien':'Vienna','Praha':'Prague','Wrocław':'Breslau','Bratislava':'Pressburg','Brno':'Brünn','Olomouc':'Olmütz','Kraków':'Cracow','Gdańsk':'Danzig','Szczecin':'Stettin','Poznań':'Posen','Warszawa':'Warsaw','Ljubljana':'Laibach','Zagreb':'Agram','Košice':'Kaschau','Opava':'Troppau','Cheb':'Eger','Plzeň':'Pilsen','České Budějovice':'Budweis','München':'Munich','Nürnberg':'Nuremberg','Głogów':'Glogau','Nysa':'Neisse','Brzeg':'Brieg','Kłodzko':'Glatz','Opole':'Oppeln','Legnica':'Liegnitz','Świdnica':'Schweidnitz','Krnov':'Jägerndorf','Győr':'Raab','Komárno':'Komorn','Beograd':'Belgrade','Timişoara':'Temesvar','Timișoara':'Temesvar','Milano':'Milan','Köln':'Cologne','Cieszyn':'Teschen','Liberec':'Reichenberg','Ústí nad Labem':'Aussig','Hradec Králové':'Königgrätz','Pardubice':'Pardubitz','Szeged':'Szegedin','Sopron':'Ödenburg','Székesfehérvár':'Stuhlweissenburg','Budapest':'Buda / Pest','Bydgoszcz':'Bromberg','Toruń':'Thorn','Katowice':'Kattowitz','Gliwice':'Gleiwitz','London':'London','Moskva':'Moscow','Moscow':'Moscow','Sankt-Peterburg':'St Petersburg','Saint Petersburg':'St Petersburg','Istanbul':'Constantinople','København':'Copenhagen','Copenhagen':'Copenhagen','Roma':'Rome','Napoli':'Naples','Venezia':'Venice','Torino':'Turin','Genova':'Genoa','Firenze':'Florence','Lisboa':'Lisbon','Wilno':'Vilna','Vilnius':'Vilna','Lviv':'Lemberg','Kaliningrad':'Königsberg','Rīga':'Riga','Riga':'Riga','Tallinn':'Reval','Helsinki':'Helsingfors','Bucharest':'Bukarest','București':'Bukarest','Iași':'Jassy','Athínai':'Athens','Athens':'Athens','Sofia':'Sofia','Bruxelles':'Brussels','Brussels':'Brussels','Den Haag':'The Hague','Praga':'Prague','Kyiv':'Kiev','Kiev':'Kiev','Minsk':'Minsk','Edinburgh':'Edinburgh','Dublin':'Dublin','Seville':'Seville','Sevilla':'Seville','Bordeaux':'Bordeaux','Marseille':'Marseilles','Lyon':'Lyons','Nantes':'Nantes','Ghent':'Ghent','Gent':'Ghent','Antwerpen':'Antwerp','Mainz':'Mainz','Hannover':'Hanover','Braunschweig':'Brunswick','Lüneburg':'Lüneburg','Dresden':'Dresden','Wien Neustadt':'Wiener Neustadt','Zürich':'Zurich','Genève':'Geneva','Basel':'Basle','Bern':'Berne','Trieste':'Trieste','Gorizia':'Görz','Klagenfurt':'Klagenfurt','Salzburg':'Salzburg','Innsbruck':'Innsbruck','Sarajevo':'Bosna Saraj','Skopje':'Üsküb','Thessaloníki':'Salonica','Thessaloniki':'Salonica','Plovdiv':'Philippopolis','Edirne':'Adrianople','Lublin':'Lublin','Zamość':'Zamosc'};
const MAPNAMES={'Sudetes Mts.':'Sudeten'};
let map,placeLayer=L.layerGroup(),shown=[],pinLayer={},baseL=[],realmL=[],natLabels=L.layerGroup(),realmLabels=[],regionLabelM=[],routesLayer=L.layerGroup(),movesLayer=L.layerGroup(),fortLayer=L.layerGroup(),noteLayer=L.layerGroup(),reachLayer=L.layerGroup(),measureLayer=L.layerGroup(),flowLayer=L.layerGroup(),smokeLayer=L.layerGroup(),battleLayer=L.layerGroup(),arrowLayer=L.layerGroup(),unitGroups={},unitsOrig=null,battleOn=false,selUnit=null,marching=false,moving=false,ambientOn=true,realmsOn=true,toolMode=null,measurePts=[],measureLabel=null,reduceMotion=false;
const BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const PLACES=JSON.parse($('places').textContent),BD=JSON.parse($('battledata').textContent);
const tl=(path,o)=>L.tileLayer(path,Object.assign({noWrap:true,updateWhenZooming:false,keepBuffer:2,errorTileUrl:BLANK},o));
const B=a=>[[a.south,a.west],[a.north,a.east]];
function initMap(){
  const E=B(META.E),shr=[[E[0][0]+.5,E[0][1]+.7],[E[1][0]-.5,E[1][1]-.7]];
  map=L.map('map',{zoomControl:false,zoomSnap:1,zoomDelta:1,wheelPxPerZoomLevel:90,markerZoomAnimation:false,minZoom:3,maxZoom:18,attributionControl:true,maxBounds:shr,maxBoundsViscosity:1});
  map.attributionControl.setPrefix('');
  map.attributionControl.addAttribution('Relief: Terrain Tiles (USGS, Copernicus EU-DEM, NOAA ETOPO1, Austria DGM) · Coast, rivers, provinces: Natural Earth · Forests, ground, buildings: © OpenStreetMap contributors via OpenFreeMap · Rivers: HydroRIVERS · Leaflet');
  L.control.zoom({position:'topright'}).addTo(map);L.control.scale({position:'bottomleft',imperial:false,maxWidth:150}).addTo(map);
  baseL=[tl('tiles1740/{z}/{x}/{y}.webp',{minZoom:3,maxNativeZoom:7,maxZoom:9,bounds:E}),tl('tiles1740/{z}/{x}/{y}.webp',{minZoom:8,maxNativeZoom:8,maxZoom:11,bounds:B(META.C)}),tl('tiles1740/{z}/{x}/{y}.webp',{minZoom:9,maxNativeZoom:10,maxZoom:12,bounds:B(META.T)})];
  realmL=[tl('realms1740/{z}/{x}/{y}.png',{minZoom:3,maxNativeZoom:7,maxZoom:9,bounds:E,zIndex:6}),tl('realms1740/{z}/{x}/{y}.png',{minZoom:8,maxNativeZoom:8,maxZoom:11,bounds:B(META.C),zIndex:6}),tl('realms1740/{z}/{x}/{y}.png',{minZoom:9,maxNativeZoom:10,maxZoom:11,bounds:B(META.T),zIndex:6})];
  baseL.concat(realmL).forEach(l=>l.addTo(map));
  baseL[0].once('load',()=>{const s=$('splash');if(s){s.style.opacity=0;setTimeout(()=>s.remove(),500)}});
  for(const s of META.sites){const u=s.path+'/{z}/{x}/{y}.webp';s.layers=[tl(u,{minZoom:12,maxNativeZoom:13,maxZoom:18,bounds:s.b12}),tl(u,{minZoom:14,maxNativeZoom:14,maxZoom:18,bounds:s.b14}),tl(u,{minZoom:15,maxNativeZoom:16,maxZoom:18,bounds:s.b16})];s.layers.forEach(l=>l.addTo(map))}
  placeLayer.addTo(map);natLabels.addTo(map);
  initPlaces();initLabels();initRealmLabels();initRoutes();initMoves();initForts();initAmbient();initBlocksCanvas();initTools();initArmy();
  map.on('moveend zoomend',()=>{moving=false;syncView()});map.on('movestart zoomstart',()=>{moving=true;hideBlocks();$('clouds').style.opacity=0;$('wind').style.opacity=0});
  const mb=L.latLngBounds(shr);map.setMinZoom(Math.max(3,map.getBoundsZoom(mb,true)));
  fit();syncView();
}
function fit(){
  if(map.getMinZoom()>map.getZoom())map.setZoom(map.getMinZoom(),{animate:false});
  const wide=innerWidth>860,Lp=$('left').classList.contains('hide')?20:350,Rp=$('right').classList.contains('hide')?20:440;
  map.fitBounds([[46.2,9.2],[52.6,22.5]],wide?{paddingTopLeft:[Lp,80],paddingBottomRight:[Rp,60],animate:false}:{padding:[10,10],animate:false});
}
function goEurope(){map.fitBounds([[36,-8],[62,42]],{paddingTopLeft:[20,80],paddingBottomRight:[$('right').classList.contains('hide')?20:440,60],animate:true})}
const BOOK={europe:goEurope,theatre:fit,vienna:()=>map.flyTo([48.2082,16.3738],13,{duration:1}),prague:()=>map.flyTo([50.0755,14.418],15,{duration:1}),battle:()=>{showBattle(true);flyBattle(14)}};

/* ----- places (culled to the view) ----- */
function initPlaces(){
  const game=new Set(state.locations.map(l=>l.name));
  for(const p of PLACES){const name=EXONYM[p.n]||p.n;if(game.has(name))continue;
    const minZ=p.c&&p.p>=250000?3:p.p>=1500000?3:p.p>=700000?4:p.p>=350000?5:p.p>=200000?6:p.p>=120000?7:p.p>=50000?8:p.p>=25000?9:10;
    const m=L.marker([p.y,p.x],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="pl'+(p.c?' cap':'')+'"><i></i><span>'+name.replace(/[<>&]/g,'')+'</span></div>',iconSize:[0,0]})});
    shown.push({m,minZ,ll:L.latLng(p.y,p.x),pop:p.p})}
  shown.sort((a,b)=>b.pop-a.pop);
}
function syncPlaces(){const z=map.getZoom(),bd=map.getBounds().pad(.1);let n=0;const cap=z<5?35:z<7?70:110;
  for(const s of shown){const on=placesOn&&z>=s.minZ&&bd.contains(s.ll)&&n<cap;if(on)n++;if(on&&!placeLayer.hasLayer(s.m))placeLayer.addLayer(s.m);if(!on&&placeLayer.hasLayer(s.m))placeLayer.removeLayer(s.m)}}
let placesOn=true;
/* ----- labels ----- */
function lab(cls,txt,lat,lon,layer,extra){const m=L.marker([lat,lon],{interactive:!!extra,keyboard:false,icon:L.divIcon({className:'',html:'<div class="'+cls+'">'+txt.replace(/[<>&]/g,'')+'</div>',iconSize:[0,0]})}).addTo(layer||natLabels);return m}
function initLabels(){
  for(const r of state.labels.rivers)natLabels.addLayer(L.marker([r.lat,r.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="river-lbl" data-z="6-11">'+r.name+'</div>',iconSize:[0,0]})}));
  for(const r of state.labels.seas)natLabels.addLayer(L.marker([r.lat,r.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="sea-lbl" data-z="3-8">'+r.name+'</div>',iconSize:[0,0]})}));
  for(const r of state.labels.ranges||[])natLabels.addLayer(L.marker([r.lat,r.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="mtn-lbl2" data-z="5-9">'+r.name+'</div>',iconSize:[0,0]})}));
  for(const r of state.regionLabels||[]){const m=L.marker([r.lat,r.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="region-lbl" data-z="7-10">'+r.name+'</div>',iconSize:[0,0]})}).addTo(map);regionLabelM.push(m)}
}
function syncLabels(){const z=map.getZoom();
  document.querySelectorAll('[data-z]').forEach(e=>{const [a,b]=e.dataset.z.split('-').map(Number);e.style.display=(z>=a&&z<=b)?'':'none'});
  for(const r of realmLabels){const e=r.m.getElement();if(!e)continue;const d=e.firstChild;d.style.display=(realmsOn&&z>=r.a&&z<=r.b)?'':'none'}}
function realmCard(k){const i=(META.realms.info||{})[k]||{};const nm=META.realms.names[k];const box=$('place');selectedPlace=null;box.classList.add('on');box.replaceChildren();
  const c=el('div',null,'card');c.style.borderColor=META.realms.colors[k];c.append(el('div','Realm (approximate extent)','eyebrow'),el('h3',nm));
  c.append(el('p',i.ruler?('Ruler / authority: '+i.ruler):'No entry yet in the dossier.'));if(i.note)c.append(el('p',i.note,'meta'));
  const m=el('div',null,'meta');const cl=claim(i.claim||'inference');if(cl)m.append(cl);m.append(' Extent: modern provinces grouped; frontiers are approximate.');c.append(m);box.append(c);if(innerWidth>860)$('left').classList.remove('hide');else $('left').classList.add('open')}
function initRealmLabels(){
  const L_=META.realms.labels||[];
  for(const r of L_){const sz=r.area>150?19:r.area>30?15:r.area>6?12:10,a=r.area>150?3:r.area>30?4:6,b=6;
    const col=META.realms.colors[r.k];
    const m=L.marker([r.lat,r.lon],{interactive:true,keyboard:false,icon:L.divIcon({className:'',html:'<div class="realm-lbl" style="font-size:'+sz+'px;color:'+col+'">'+META.realms.names[r.k].replace(/[<>&]/g,'')+'</div>',iconSize:[0,0]})}).addTo(map);
    m.on('click',()=>realmCard(r.k));realmLabels.push({m,a,b})}
}
/* ----- sync on every move end ----- */
function inSite(){if(!map)return null;const c=map.getCenter();for(const s of META.sites){const b=s.bounds;if(c.lat>=b[0][0]&&c.lat<=b[1][0]&&c.lng>=b[0][1]&&c.lng<=b[1][1])return s}return null}
function syncView(){
  if(!map||!map._loaded)return;try{map.getCenter()}catch(e){return}
  const z=map.getZoom(),site=inSite();
  map.setMaxZoom(site?18:11);$('map').classList.toggle('z-low',z<6);$('map').classList.toggle('z-deep',z>=12);
  const ro=realmsOn?(z<=11?1:z===12?.5:0):0;realmL.forEach(l=>l.setOpacity(ro));
  const amb=ambientOn&&!reduceMotion&&site&&z>=14;
  $('clouds').style.display=$('wind').style.display=amb?'block':'none';$('clouds').style.opacity=amb?'.5':'0';$('wind').style.opacity=amb?'.3':'0';
  for(const [l,o] of [[flowLayer,ambientOn&&z>=15],[smokeLayer,ambientOn&&z>=15]]){if(o&&!map.hasLayer(l))l.addTo(map);if(!o&&map.hasLayer(l))map.removeLayer(l)}
  syncPlaces();syncLabels();syncBattle();drawBlocks();updateScale();clearTimeout(syncView.pf);syncView.pf=setTimeout(prefetch,350);
  const rb=routesLayer;for(const l of[rb,movesLayer,fortLayer]){}
  if(measureLabel)measureLabel.style.display='';
}
function updateScale(){if(!$('scale-note'))return;const z=map.getZoom(),mpp=40075016*Math.cos(map.getCenter().lat*Math.PI/180)/(Math.pow(2,z)*256);$('scale-note').textContent='1 px ≈ '+(mpp<10?mpp.toFixed(1):Math.round(mpp))+' m · battalion front ≈ '+Math.round(150/mpp)+' px'}

/* ----- pins ----- */
function renderPins(){
  for(const k in pinLayer)map.removeLayer(pinLayer[k]);pinLayer={};
  for(const loc of state.locations){
    const isYou=state.player.locationId===loc.id,kind=isYou?'court':loc.kind==='foreign'?'foreign':'';
    const rs=state.reports.filter(r=>r.place===loc.id).map(r=>r.dated).sort().pop(),age=rs?Math.round((new Date(state.date)-new Date(rs))/864e5):null;
    const html='<div class="seal-pin lab-'+(loc.lab||'e')+' '+kind+(selectedPlace===loc.id?' sel':'')+(age!=null&&age>7?' stale':'')+'" role="button" aria-label="'+loc.name.replace(/"/g,'')+'"><i></i>'+(isYou?'<div class="you-ring"></div>':'')+'<span>'+loc.name.replace(/[<>&]/g,'')+(isYou?' · you':'')+'</span></div>';
    const m=L.marker([loc.lat,loc.lon],{icon:L.divIcon({className:'',html,iconSize:[0,0]}),keyboard:true,title:loc.name+(age!=null?' — last report '+age+' d ago':''),riseOnHover:true,zIndexOffset:isYou?1000:500});
    m.on('click',()=>selectPlace(loc.id));m.on('keypress',e=>{if(e.originalEvent.key==='Enter')selectPlace(loc.id)});m.addTo(map);pinLayer[loc.id]=m}
}

/* ----- routes, movements, fortresses ----- */
function spline(pts,seg){seg=seg||8;const out=[];for(let i=0;i<pts.length-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
  for(let s=0;s<seg;s++){const u=s/seg,u2=u*u,u3=u2*u;out.push([0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u3)))}}
  out.push(pts[pts.length-1]);return out}
const SIDECOL={habsburg:'#f3d27a',prussia:'#7fa6ee',bavaria:'#8fc4f0',saxony:'#7fd1a2',france:'#c9b6e8'};
const KMD={foot:15,horse:30,wagon:12,courier:100};
function season(){return {autumn:.85,winter:.6,spring:.75,summer:1}[seasonName]||1}
let seasonName='autumn';
function badge(c){const lab={documented:'Documented',inference:'Inference',disputed:'Disputed',invention:'Invention',demo:'Demo'}[c]||c;return '<span class="claim '+(['documented','inference','disputed','invention','demo'].includes(c)?c:'demo')+'">'+lab+'</span>'}
function pathKm(pts){let d=0;for(let i=1;i<pts.length;i++)d+=map.distance(pts[i-1],pts[i]);return d/1000}
function arrowHead(a,b,col){const k=Math.cos(b[0]*Math.PI/180),brg=Math.atan2((b[1]-a[1])*k,(b[0]-a[0]))*180/Math.PI;return L.marker(b,{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="ahead" style="transform:rotate('+brg+'deg);border-bottom-color:'+col+'"></div>',iconSize:[0,0]})})}
function initRoutes(){
  const RC={river:'#7cc6d8',road:'#8a5a2a',salt:'#f6efe0'};
  for(const r of state.routes||[]){const pts=spline(r.pts,8),c=RC[r.kind]||'#8a5a2a',km=Math.round(pathKm(r.pts)*1.12);
    const days=Math.round(km/(KMD.wagon*.9));
    const html='<b>'+r.name+'</b><br>'+r.goods+'<br>≈ '+km+' km · wagons ≈ '+days+' days · foot ≈ '+Math.round(km/KMD.foot)+' days<br>'+badge(r.claim)+' <span class="meta">approximate corridor</span>';
    L.polyline(pts,{color:'#f4e8c8',weight:6,opacity:.7,interactive:false}).addTo(routesLayer);
    L.polyline(pts,{color:c,weight:3,opacity:.95,interactive:true}).bindPopup(html).addTo(routesLayer);
    L.polyline(pts,{color:'#2a1808',weight:2,opacity:.8,dashArray:'1 14',lineCap:'round',className:'flow2',interactive:false}).addTo(routesLayer);
    const m=pts[Math.floor(pts.length*.42)];L.marker(m,{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="route-lbl" data-z="6-12">'+r.name.replace(/[<>&]/g,'')+'</div>',iconSize:[0,0]})}).addTo(routesLayer)}
  routesLayer.addTo(map)
}
function initMoves(){
  const DASH={confirmed:null,reported:'12 8',rumour:'3 9'};
  for(const m of state.movements||[]){const pts=spline(m.pts,8),c=SIDECOL[m.side]||'#fff',w=m.status==='confirmed'?5:4;
    const age=Math.max(0,Math.round((new Date(state.date)-new Date(m.reported))/864e5)),op=Math.max(.38,1-age/14);
    const html='<b>'+m.label+'</b><br>'+m.status+' · reported '+fmt(m.reported)+' ('+age+' d old)<br>Source: '+m.source+'<br>'+badge(m.claim)+(age>5?' <span class="meta">may have moved since</span>':'');
    L.polyline(pts,{color:'#1a120b',weight:w+4,opacity:.55*op,interactive:false}).addTo(movesLayer);
    L.polyline(pts,{color:c,weight:w,opacity:op,dashArray:DASH[m.status],lineCap:'round',interactive:true}).bindPopup(html).addTo(movesLayer);
    const hd=arrowHead(pts[pts.length-2],pts[pts.length-1],c);hd.addTo(movesLayer);hd.setOpacity(op);
    const start=pts[0];L.circleMarker(start,{radius:5,color:c,weight:2,fillColor:'#1a120b',fillOpacity:.8,opacity:op,dashArray:'2 3',interactive:false}).addTo(movesLayer);
    const mid=pts[Math.floor(pts.length/2)];L.marker(mid,{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="mv-lbl">'+({confirmed:'Confirmed',reported:'Reported',rumour:'Rumour'}[m.status])+' · '+age+' d old</div>',iconSize:[0,0]})}).addTo(movesLayer)}
  movesLayer.addTo(map)
}
function initForts(){
  const ICON={fortress:'★',bridge:'╪',magazine:'▣',ford:'≈'};
  for(const f of state.fortresses||[]){
    const html='<b>'+f.name+'</b> ('+f.kind+')<br>Garrison: '+(f.garrison||'unknown')+'<br>'+(f.note||'')+'<br>'+badge(f.claim||'inference');
    L.marker([f.lat,f.lon],{keyboard:false,icon:L.divIcon({className:'',html:'<div class="fort"><b>'+(ICON[f.kind]||'★')+'</b><span data-z="6-14">'+f.name.replace(/[<>&]/g,'')+'</span></div>',iconSize:[0,0]})}).bindPopup(html).addTo(fortLayer)}
  fortLayer.addTo(map)
}

/* ----- ambient (painted sites only) ----- */
function noiseURL(size,seed,oct,cloud){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d'),img=x.createImageData(size,size);
  let s=seed;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  const layers=[];for(let o=0;o<oct;o++){const n=4<<o,g=[];for(let i=0;i<n*n;i++)g.push(rnd());layers.push([n,g])}
  const sm=t=>t*t*(3-2*t);
  for(let y=0;y<size;y++)for(let xx=0;xx<size;xx++){let v=0,a=1,tot=0;
    for(const [n,g] of layers){const fx=xx/size*n,fy=y/size*n,ix=Math.floor(fx),iy=Math.floor(fy),tx=sm(fx-ix),ty=sm(fy-iy);
      const gv=(i,j)=>g[((j%n)*n)+(i%n)];v+=a*((gv(ix,iy)*(1-tx)+gv(ix+1,iy)*tx)*(1-ty)+(gv(ix,iy+1)*(1-tx)+gv(ix+1,iy+1)*tx)*ty);tot+=a;a*=.5}
    v/=tot;if(cloud)v=1-Math.max(0,Math.min(1,(v-.5)*3))*.5;const k=Math.max(0,Math.min(255,Math.round(v*255)));const p=(y*size+xx)*4;img.data[p]=img.data[p+1]=img.data[p+2]=k;img.data[p+3]=255}
  x.putImageData(img,0,0);return c.toDataURL('image/png')
}
function initAmbient(){
  $('clouds').style.backgroundImage='url('+noiseURL(160,7,4,true)+')';$('wind').style.backgroundImage='url('+noiseURL(96,19,3)+')';
  for(const s of BD.streams)L.polyline(s[1].map(p=>[p[1],p[0]]),{className:'flow',color:'#c9dde6',weight:2,opacity:.7,dashArray:'3 12',interactive:false,lineCap:'round'}).addTo(flowLayer);
  for(const p of BD.smoke)L.marker([p[1],p[0]],{interactive:false,keyboard:false,icon:L.divIcon({className:'',html:'<div class="smoke"><i></i><i></i><i></i></div>',iconSize:[0,0]})}).addTo(smokeLayer);
}
function ppm(){const z=map.getZoom();return Math.pow(2,z)*256/(40075016*Math.cos(state.battleDemo.center[0]*Math.PI/180))}

/* ----- 3D town blocks (1740 core only) ----- */
const BL={on:true,data:{},loading:{},canvas:null,ctx:null};
function initBlocksCanvas(){BL.canvas=document.createElement('canvas');BL.canvas.id='blocks';map.getPane('overlayPane').appendChild(BL.canvas);BL.ctx=BL.canvas.getContext('2d')}
function hideBlocks(){if(BL.canvas)BL.canvas.style.opacity=0}
function loadSite(id){if(BL.loading[id])return;BL.loading[id]=true;fetch('cities/'+id+'.json').then(r=>r.json()).then(d=>{
  const items=d.b.map((b,i)=>{const f=b[2];let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,sy=0;const n=f.length/2;for(let k=0;k<f.length;k+=2){x0=Math.min(x0,f[k]);x1=Math.max(x1,f[k]);y0=Math.min(y0,f[k+1]);y1=Math.max(y1,f[k+1]);sy+=f[k+1]}return{h:b[0],f,x0,x1,y0,y1,cy:sy/n,i}});
  items.sort((a,b)=>b.cy-a.cy);BL.data[id]={items};drawBlocks()}).catch(()=>{BL.loading[id]=false})}
const WALLS=[[238,226,196],[226,200,152],[228,190,160],[210,204,188],[244,238,222],[218,190,142],[200,206,196],[236,214,176]],ROOFS=[[168,94,70],[152,82,62],[124,108,98],[184,112,76],[142,90,72],[110,98,92],[170,106,84],[96,104,108]];
function drawBlocks(){
  if(!BL.canvas||!map||!map._loaded)return;try{map.getCenter()}catch(e){return}
  const z=map.getZoom(),s=inSite(),ctx=BL.ctx,sz=map.getSize(),tl_=map.containerPointToLayerPoint([0,0]);
  if(BL.canvas.width!==sz.x||BL.canvas.height!==sz.y){BL.canvas.width=sz.x;BL.canvas.height=sz.y}
  L.DomUtil.setPosition(BL.canvas,tl_);ctx.clearRect(0,0,sz.x,sz.y);
  if(!BL.on||!s||!s.blocks||z<15||moving){BL.canvas.style.opacity=0;return}
  const d=BL.data[s.id];if(!d){loadSite(s.id);return}
  const bd=map.getBounds().pad(.08),sw=bd.getSouthWest(),ne=bd.getNorthEast(),ex=z>=17?.9:z>=16?1.15:1.6,pm=Math.pow(2,z)*256/(40075016*Math.cos(s.lat*Math.PI/180)),o=map.getPixelOrigin();
  const vis=[];for(const b of d.items){if(b.x1<sw.lng||b.x0>ne.lng||b.y1<sw.lat||b.y0>ne.lat)continue;vis.push(b);if(vis.length>7000)break}
  for(const b of vis){const pts=[];for(let k=0;k<b.f.length;k+=2){const p=map.project([b.f[k+1],b.f[k]],z);pts.push([p.x-o.x-tl_.x,p.y-o.y-tl_.y])}b.pts=pts}
  ctx.lineJoin='round';
  for(const b of vis){const hp=Math.min(110,b.h*pm*ex);ctx.fillStyle='rgba(35,24,12,.22)';ctx.beginPath();b.pts.forEach((p,i)=>i?ctx.lineTo(p[0]+hp*.5,p[1]+hp*.32):ctx.moveTo(p[0]+hp*.5,p[1]+hp*.32));ctx.closePath();ctx.fill()}
  for(const b of vis){
    const pts=b.pts,hp=Math.min(110,b.h*pm*ex),e=[hp*.34,-hp],wc=WALLS[b.i%8],rc=ROOFS[(b.i*7)%8];
    let cx=0,cy=0;for(const p of pts){cx+=p[0];cy+=p[1]}cx/=pts.length;cy/=pts.length;
    for(let i=0;i<pts.length;i++){const a=pts[i],c=pts[(i+1)%pts.length],dx=c[0]-a[0],dy=c[1]-a[1];let nx=dy,ny=-dx;const L2=Math.hypot(nx,ny)||1;nx/=L2;ny/=L2;
      if(nx*(cx-(a[0]+c[0])/2)+ny*(cy-(a[1]+c[1])/2)>0){nx=-nx;ny=-ny}if(nx*e[0]+ny*e[1]>=0)continue;
      const sh=Math.max(.62,Math.min(1.04,.84-.24*nx));ctx.fillStyle='rgb('+Math.round(wc[0]*sh)+','+Math.round(wc[1]*sh)+','+Math.round(wc[2]*sh)+')';
      ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(c[0]+e[0],c[1]+e[1]);ctx.lineTo(a[0]+e[0],a[1]+e[1]);ctx.closePath();ctx.fill()}
    ctx.fillStyle='rgb('+rc[0]+','+rc[1]+','+rc[2]+')';ctx.strokeStyle='rgba(50,24,12,.55)';ctx.lineWidth=.8;
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0]+e[0],p[1]+e[1]):ctx.moveTo(p[0]+e[0],p[1]+e[1]));ctx.closePath();ctx.fill();ctx.stroke();
    if(b.h>=24){const sp=Math.min(90,b.h*pm*ex*1.9);ctx.fillStyle='rgb(120,96,84)';ctx.beginPath();ctx.moveTo(cx+e[0]-4,cy+e[1]);ctx.lineTo(cx+e[0]+4,cy+e[1]);ctx.lineTo(cx+e[0]+e[0]*.35,cy+e[1]-sp*.9);ctx.closePath();ctx.fill()}}
  BL.canvas.style.opacity=1;
}

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

/* ---------- table battle: terrain, fog, combat, an opponent that adapts, and real ways to lose ---------- */
const TER=JSON.parse($('terrain').textContent);
const BS={phase:0,max:12,log:[],result:null,mem:null,obs:null,running:false,rngSeed:1};
const SPEED={inf:{line:55,column:80},cav:{line:170,column:170},art:{line:38,column:38}};
const DOCTRINE={A:{fire:1.0},B:{fire:1.18,bold:.55}};
function battleMem(){draft.battleMem=draft.battleMem||{agg:0,hold:0,refuseL:0,refuseR:0,cavL:0,cavR:0,col:0,games:0};return draft.battleMem}
function rng(){BS.rngSeed|=0;BS.rngSeed=BS.rngSeed+0x6D2B79F5|0;let t=Math.imul(BS.rngSeed^BS.rngSeed>>>15,1|BS.rngSeed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
function terrainAt(e,n){const c=Math.floor((e+TER.w/2)/TER.cell),r=Math.floor((TER.h/2-n)/TER.cell);if(c<0||r<0||c>=TER.cols||r>=TER.rows)return 0;return +TER.rows_str[r][c]}
function terMul(u,t){if(t===1)return u.type==='cav'?.3:.5;if(t===2)return u.type==='art'?.1:.25;if(t===3)return .6;return 1}
function initSim(){const bd=state.battleDemo;if(bd._sim)return;bd._sim=true;
  for(const u of bd.units){const base={inf:600,cav:130,art:60}[u.type];u.men=u.max=base;u.mor=u.side==='A'?78:82;u.coh=100;u.ammo=100;u.st='ok';u.guns=u.type==='art'?6:0;u.fire=0;u.vis=u.side==='A';u.seenE=null;u.seenN=null;u.rout=0}
  BS.rngSeed=[...(state.campaignId||'x')].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7);BS.mem=battleMem()}
function alive(u){return u.st!=='gone'&&u.men>0}
function dist(a,b){return Math.hypot(a.e-b.e,a.n-b.n)}
function ang(a,b){return(Math.atan2(b.e-a.e,b.n-a.n)*180/Math.PI+360)%360}
function dAng(a,b){let d=Math.abs(a-b)%360;return d>180?360-d:d}
function sight(u){return u.type==='cav'?1600:u.type==='art'?700:900}
function blocked(a,b){const d=dist(a,b),k=Math.floor(d/30);let w=0;for(let i=1;i<k;i++){const t=terrainAt(a.e+(b.e-a.e)*i/k,a.n+(b.n-a.n)*i/k);if(t===1)w++}return w>=4&&terrainAt(b.e,b.n)!==1}
function sees(a,b){return dist(a,b)<=sight(a)&&!blocked(a,b)}
function updateVis(){const us=state.battleDemo.units;
  for(const u of us){if(!alive(u))continue;const foes=us.filter(x=>x.side!==u.side&&alive(x)&&x.st!=='routing');let seen=false;for(const f of us){if(f.side===u.side||!alive(f))continue;if(sees(f,u)){seen=true;break}}
    if(u.side==='B'){u.vis=seen;if(seen){u.seenE=u.e;u.seenN=u.n;u.seenT=BS.phase}}else u.visE=seen}}
function inFlank(t,a){const bearing=ang(t,a),rel=dAng(bearing,t.facing);return rel>110?'rear':rel>60?'flank':'front'}
function fireStep(a,us,ev){
  if(a.st==='routing'||a.type==='cav'||a.ammo<=8)return;const R=a.type==='art'?700:150;let best=null,bd=1e9;
  for(const t of us){if(t.side===a.side||!alive(t)||t.st==='gone')continue;const d=dist(a,t);if(d>R||d>=bd)continue;if(a.type==='inf'&&dAng(ang(a,t),a.facing)>75)continue;if(!sees(a,t)&&d>250)continue;best=t;bd=d}
  if(!best)return;const t=best,d=bd,aspect=inFlank(t,a),cov=terrainAt(t.e,t.n)===1||terrainAt(t.e,t.n)===3?.55:1;
  let k;if(a.type==='art'){k=a.guns*(d<250?2.2:.75)*(1-d/700)*DOCTRINE[a.side].fire}else{k=a.men*.0045*(1-d/150)*(a.form==='column'?.4:1)*DOCTRINE[a.side].fire}
  k*=(a.st==='wavering'?.5:1)*(.6+a.mor/250)*(aspect==='front'?1:aspect==='flank'?1.4:1.8)*cov*(a.ammo>25?1:.5);
  const kills=Math.max(0,k*(.7+rng()*.6));t.men=Math.max(0,t.men-kills);a.ammo-=1.1;a.fire=1;
  const fr=kills/Math.max(1,t.max);t.mor-=fr*130+(aspect!=='front'?1.6:0.3);t.coh-=fr*60;t.hit=(t.hit||0)+kills;
  if(aspect!=='front'&&rng()<.04)ev.push((t.side==='A'?'Your ':'The enemy ')+t.name.split(' (')[0]+' is taking fire on the '+aspect+'.')}
function meleeStep(a,us,ev){
  if(a.st==='routing'||!alive(a))return;for(const t of us){if(t.side===a.side||!alive(t)||t.st==='gone'||t.st==='routing')continue;if(dist(a,t)>(a.type==='art'||t.type==='art'?24:(a.type==='cav'?30:20)))continue;
    if(a.type==='art'||(a.type==='inf'&&t.type==='cav'))continue;
    const ap=inFlank(t,a),flankMul=ap==='front'?1:ap==='flank'?1.5:2;
    if(a.type==='cav'&&t.type==='inf'){const chargeOK=a.mode==='charge'&&a.mor>25;if(!chargeOK)continue;const pForm=t.form==='column'?.62:.32;const p=Math.min(.95,pForm*flankMul*(a.mor/Math.max(20,t.mor))*(t.ammo>20?.9:1.1));
      if(rng()<p){const lost=t.men*.1;t.men-=lost;t.mor-=26;t.coh-=30;a.men-=a.men*.05;ev.push('Cavalry broke into '+(t.side==='A'?'your ':'the enemy ')+t.name.split(' (')[0]+' ('+ap+').');}
      else{a.men-=a.men*.12;a.mor-=20;a.mode='hold';a.dest=null;ev.push((a.side==='A'?'Your':'The enemy')+' horse were repulsed by steady fire.')}}
    else if(a.type==='cav'&&t.type==='cav'){const pa=a.men*a.mor,pt=t.men*t.mor*(t.mode==='charge'?1.05:1);const w=rng()<pa/(pa+pt);const L=w?t:a;L.men-=L.men*.12;L.mor-=22;(w?a:t).men-=(w?a:t).men*.06;ev.push('Cavalry clashed.')}
    else if(a.type==='inf'&&t.type==='inf'){const pa=a.mor*a.coh*flankMul,pt=t.mor*t.coh;const w=rng()<pa/(pa+pt);const L=w?t:a;L.men-=L.men*.03;L.mor-=14;(w?a:t).men-=(w?a:t).men*.015}
    else if(a.type==='cav'&&t.type==='art'){t.men=0;t.st='gone';ev.push((t.side==='A'?'Your':'Their')+' battery was overrun.');t.gunLost=true}
  }}
function moraleStep(us,ev){
  for(const u of us){if(!alive(u))continue;
    for(const f of us){if(f.side!==u.side||f===u||f.st!=='routing')continue;if(dist(f,u)<160)u.mor-=1.4}
    if(!u.hit)u.mor=Math.min(95,u.mor+(u.mode==='hold'?.7:.25));u.coh=Math.min(100,u.coh+.6);u.hit=0;u.fire=0;u.ammo=Math.min(100,u.ammo+.25);
    if(u.men<u.max*.12||u.mor<=0){u.st='gone';ev.push((u.side==='A'?'Your ':'The enemy ')+u.name.split(' (')[0]+' is destroyed.');continue}
    if(u.st!=='routing'&&u.mor<18){u.st='routing';u.rout=0;u.mode='retire';ev.push((u.side==='A'?'Your ':'The enemy ')+u.name.split(' (')[0]+' broke and ran.')}
    else if(u.st==='routing'){u.rout++;const dir=u.side==='A'?-1:1;u.n+=dir*90*.5;u.e+=(rng()-.5)*20;if(u.mor>42&&u.rout>6){u.st='wavering';u.mode='hold'}if(Math.abs(u.n)>2000||u.rout>26){u.st='gone'}}
    else if(u.mor<36&&u.st!=='wavering'){u.st='wavering';ev.push((u.side==='A'?'Your ':'The enemy ')+u.name.split(' (')[0]+' is wavering.')}
    else if(u.st==='wavering'&&u.mor>48)u.st='ok'}}
function moveStep(u){
  if(!alive(u)||u.st==='routing')return;const o=u.ord;if(!o)return;
  if(o.form&&o.form!==u.form){u.form=o.form;o.form=null}
  if(o.dest){const dx=o.dest[0]-u.e,dy=o.dest[1]-u.n,d=Math.hypot(dx,dy);
    const sp=(SPEED[u.type][u.form||'line'])*.5*terMul(u,terrainAt(u.e,u.n))*(u.st==='wavering'?.6:1)*(o.mode==='charge'&&d<260?1.6:1);
    if(d<=Math.max(4,sp)){u.e=o.dest[0];u.n=o.dest[1];o.dest=null;if(o.facing!=null){u.facing=o.facing;o.facing=null}if(o.mode==='advance'||o.mode==='retire')o.mode='hold';u.mode=o.mode||'hold'}
    else{u.e+=dx/d*sp;u.n+=dy/d*sp;const want=(Math.atan2(dx,dy)*180/Math.PI+360)%360;const rate=u.form==='column'?25:12;let df=((want-u.facing+540)%360)-180;u.facing=(u.facing+Math.max(-rate,Math.min(rate,df))+360)%360;if(o.mode)u.mode=o.mode}}
  else if(o.facing!=null){let df=((o.facing-u.facing+540)%360)-180;const rate=u.form==='column'?25:12;u.facing=(u.facing+Math.max(-rate,Math.min(rate,df))+360)%360;if(Math.abs(df)<3)o.facing=null}}
function autoTurn(u,us){if(!alive(u)||u.st==='routing'||(u.ord&&u.ord.dest))return;let bn=null,bd=1e9;for(const t of us){if(t.side===u.side||!alive(t))continue;const d=dist(u,t);if(d<500&&d<bd&&sees(u,t)){bn=t;bd=d}}if(bn){const want=ang(u,bn);let df=((want-u.facing+540)%360)-180;const rate=u.type==='cav'?30:u.form==='column'?25:10;u.facing=(u.facing+Math.max(-rate,Math.min(rate,df))+360)%360}}
/* ----- the opponent: reads you, remembers you, adapts ----- */
function enemyObserve(){const us=state.battleDemo.units,seen=us.filter(u=>u.side==='A'&&alive(u)&&us.some(b=>b.side==='B'&&alive(b)&&sees(b,u)));
  if(!seen.length)return null;const cx=seen.reduce((s,u)=>s+u.e,0)/seen.length,fn=Math.max(...seen.map(u=>u.n));
  const left=seen.filter(u=>u.e<cx-350),right=seen.filter(u=>u.e>cx+350),mid=seen.filter(u=>Math.abs(u.e-cx)<=350);
  const men=l=>l.reduce((s,u)=>s+u.men,0),cav=l=>l.filter(u=>u.type==='cav').reduce((s,u)=>s+u.men,0);
  const second=seen.filter(u=>u.type==='inf'&&u.n<fn-150).length,line=seen.filter(u=>u.type==='inf'&&u.n>=fn-150).length;
  const mean=seen.reduce((s,u)=>s+u.n,0)/seen.length,col=seen.filter(u=>u.form==='column').length;
  return{cx,fn,left,right,mid,L:men(left),R:men(right),M:men(mid),cavL:cav(left),cavR:cav(right),depth:second/Math.max(1,line),mean,col,coh:seen.reduce((s,u)=>s+u.coh,0)/seen.length,n:seen.length}}
function enemyPlan(){
  const us=state.battleDemo.units,B=us.filter(u=>u.side==='B'&&alive(u)),M=BS.mem,F=enemyObserve(),P=BS.obs;
  const avgMor=B.reduce((s,u)=>s+u.mor*u.men,0)/Math.max(1,B.reduce((s,u)=>s+u.men,0));
  if(!F)return {name:'advance_cautious',why:'The enemy cannot see you clearly and feels forward.'};
  const adv=P?F.mean-P.mean:0;const moved=P?Math.abs(adv)>60:false;
  if(P&&adv>60)M.agg++;else if(P&&Math.abs(adv)<=60)M.hold++;
  if(P&&F.L<P.L*.8)M.refuseL++;if(P&&F.R<P.R*.8)M.refuseR++;if(F.cavL>F.cavR*1.4)M.cavL++;if(F.cavR>F.cavL*1.4)M.cavR++;if(F.col>3)M.col++;
  BS.obs=F;const noise=()=>(rng()-.5)*.7,thin=(a,b)=>b/(a+b+1);
  const S={hold_bombard:.5+(adv>60?1.3:0)+M.agg*.12+noise(),
    oblique_L:.7+thin(F.R,F.L)*1.8+M.hold*.1+(F.cavL<F.cavR?.35:-.3)+M.cavR*.12+noise(),
    oblique_R:.7+thin(F.L,F.R)*1.8+M.hold*.1+(F.cavR<F.cavL?.35:-.3)+M.cavL*.12+noise(),
    flank_cav_L:(F.cavL<80?1:.2)+(F.depth<.4?.5:0)+M.refuseL*.1+noise(),flank_cav_R:(F.cavR<80?1:.2)+(F.depth<.4?.5:0)+M.refuseR*.1+noise(),
    advance_center:(F.M<F.L*.7&&F.M<F.R*.7?1.1:.2)+(F.col>2?.5:0)+noise(),
    counter_charge:(adv>120&&F.coh<85?1.6:.1)+(F.depth<.3?.4:0)+noise(),
    withdraw:avgMor<42?3.2:-2};
  let best='hold_bombard';for(const k in S)if(S[k]>S[best])best=k;
  const why={hold_bombard:'It stands and shoots, waiting for you to come to it.',oblique_L:'It leans against your '+'left, where you are thinnest.'.replace('left','left'),oblique_R:'It leans against your right, where you are thinnest.',flank_cav_L:'Its horse are working round your left.',flank_cav_R:'Its horse are working round your right.',advance_center:'It pushes at your centre.',counter_charge:'It sees you over-extended and strikes back.',withdraw:'It is losing heart and draws off.',advance_cautious:'It feels forward.'}[best];
  return{name:best,why,F}}
function enemyOrders(plan){const us=state.battleDemo.units,B=us.filter(u=>u.side==='B'&&alive(u)&&u.st!=='routing'),A=us.filter(u=>u.side==='A'&&alive(u));const F=plan.F;
  const clear=u=>{u.ord={mode:'hold'}};B.forEach(clear);const cxB=B.reduce((s,u)=>s+u.e,0)/Math.max(1,B.length);
  const toward=(u,t,d)=>{const a=ang(u,t)*Math.PI/180;return[u.e+Math.sin(a)*d,u.n+Math.cos(a)*d]};
  const nearestA=u=>A.reduce((b,t)=>!b||dist(u,t)<dist(u,b)?t:b,null);
  const side=(l)=>B.filter(u=>l==='L'?u.e<cxB:u.e>=cxB);
  switch(plan.name){
   case 'hold_bombard':break;
   case 'oblique_L':case 'oblique_R':{const L=plan.name==='oblique_L';const att=side(L?'R':'L'),ref=side(L?'L':'R');att.filter(u=>u.type==='inf').forEach((u,i)=>{const t=nearestA(u);if(t)u.ord={mode:'advance',dest:toward(u,t,260+i*0),form:'line'}});ref.forEach(u=>{u.ord={mode:'hold'}});break}
   case 'flank_cav_L':case 'flank_cav_R':{const L=plan.name==='flank_cav_L';const cv=B.filter(u=>u.type==='cav');const tgt=A.filter(u=>L?u.e<F.cx-350:u.e>F.cx+350);const t=tgt[0]||A[0];cv.forEach((u,i)=>{if(t)u.ord={mode:'charge',dest:[t.e+(L?-260:260),t.n-60]}});break}
   case 'advance_center':B.filter(u=>u.type==='inf').forEach(u=>{const t=nearestA(u);if(t)u.ord={mode:'advance',dest:toward(u,t,240)}});break;
   case 'counter_charge':B.filter(u=>u.type==='cav').forEach(u=>{const t=nearestA(u);if(t)u.ord={mode:'charge',dest:[t.e,t.n]}});B.filter(u=>u.type==='inf').forEach(u=>{const t=nearestA(u);if(t)u.ord={mode:'advance',dest:toward(u,t,120)}});break;
   case 'withdraw':B.forEach(u=>{u.ord={mode:'retire',dest:[u.e,u.n+380]}});break;
   case 'advance_cautious':B.filter(u=>u.type==='inf').forEach(u=>{u.ord={mode:'advance',dest:[u.e,u.n-120]}});break}
}
/* ----- a phase = 15 minutes = 30 half-minute ticks ----- */
function armyMorale(side){const us=state.battleDemo.units.filter(u=>u.side===side);let s=0,m=0;for(const u of us){m+=u.max*100;if(alive(u)&&u.st!=='routing')s+=u.men*u.mor}return s/m}
function losses(side){const us=state.battleDemo.units.filter(u=>u.side===side);const m=us.reduce((s,u)=>s+u.max,0),l=us.reduce((s,u)=>s+(u.max-(alive(u)?u.men:0)),0);return l/m}
function checkEnd(){const mA=armyMorale('A'),mB=armyMorale('B'),lA=losses('A'),lB=losses('B');
  if(mA<.3||lA>.5)return 'defeat';if(mB<.3||lB>.5)return 'victory';
  const infA=state.battleDemo.units.filter(u=>u.side==='A'&&u.type==='inf'&&alive(u)&&u.st!=='routing').length;if(infA<=2)return 'defeat';return null}
function draftToOrders(){const ord=armyOrders();for(const u of state.battleDemo.units)if(u.side==='A'){const o=ord[u.id];u.ord=o?JSON.parse(JSON.stringify(o)):(u.ord&&u.ord.dest?u.ord:{mode:'hold'})}}
async function runPhase(n){
  initSim();if(BS.running||marching||BS.result)return;BS.running=true;marching=true;const bd=state.battleDemo,us=bd.units;
  if(!battleOn)showBattle(true);if(map.getZoom()<14)map.setView(lo(bd.center,-300,200),14,{animate:false});
  for(let ph=0;ph<n&&!BS.result;ph++){
    BS.phase++;const ev=[];draftToOrders();const plan=enemyPlan();enemyOrders(plan);const snap=us.map(u=>u.men);
    soundDrums(true);
    for(let t=0;t<30;t++){
      for(const u of us)moveStep(u);for(const u of us)autoTurn(u,us);
      for(const u of us)if(alive(u)&&u.st!=='routing'){fireStep(u,us,ev);}
      for(const u of us)meleeStep(u,us,ev);moraleStep(us,ev);updateVis();
      if(t%2===0||t===29){drawBattle();$('armybar').querySelector('.ab-cnt')&&($('armybar').querySelector('.ab-cnt').textContent='Phase '+BS.phase+' · '+(t+1)*30/60+' min');await new Promise(r=>setTimeout(r,90))}
      const e=checkEnd();if(e){BS.result=e;break}}
    soundDrums(false);
    const lostA=us.filter(u=>u.side==='A').reduce((s,u,i)=>s+Math.max(0,snap[us.indexOf(u)]-(alive(u)?u.men:0)),0),lostB=us.filter(u=>u.side==='B').reduce((s,u)=>s+Math.max(0,snap[us.indexOf(u)]-(alive(u)?u.men:0)),0);
    const rec={phase:BS.phase,minute:BS.phase*15,lostA:Math.round(lostA),lostB:Math.round(lostB),enemyMoved:plan.why,events:[...new Set(ev)].slice(0,9),mA:+armyMorale('A').toFixed(2),mB:+armyMorale('B').toFixed(2),yourOrders:Object.keys(armyOrders()).length};
    BS.log.push(rec);draft.armyOrders={};
    if(!BS.result&&BS.phase>=BS.max)BS.result=armyMorale('A')-armyMorale('B')>.08?'marginal_win':armyMorale('B')-armyMorale('A')>.08?'marginal_loss':'draw';
    if(BS.result){const M=battleMem();M.games++;finishBattle()}
    saveDraft();drawBattle();renderBattle();renderArmyBar();renderCase&&renderCase()}
  marching=false;BS.running=false}
const OUTCOME={victory:['Victory','The enemy army broke or was driven from the field.'],defeat:['Defeat','Your army broke, or lost too many men to stand.'],marginal_win:['Marginal advantage','At the end of the day you held the better position, but nothing was decided.'],marginal_loss:['Marginal disadvantage','The day ended with the enemy better placed; you keep the field but not the initiative.'],draw:['Indecisive','Neither side gained the upper hand.'],withdrew:['You withdrew','You drew off before the army was broken.']};
function finishBattle(){const us=state.battleDemo.units,A=us.filter(u=>u.side==='A'),B=us.filter(u=>u.side==='B');
  BS.summary={outcome:BS.result,phases:BS.phase,lossesA:Math.round(losses('A')*100),lossesB:Math.round(losses('B')*100),gunsLostA:A.filter(u=>u.gunLost).length,gunsLostB:B.filter(u=>u.gunLost).length,routedA:A.filter(u=>u.st==='routing'||u.st==='gone').length,routedB:B.filter(u=>u.st==='routing'||u.st==='gone').length,enemyPlans:BS.log.map(r=>r.enemyMoved)};
  draft.battleResult=BS.summary;status((OUTCOME[BS.result]||[BS.result])[0]+': '+Math.round(losses('A')*100)+'% of your men lost, '+Math.round(losses('B')*100)+'% of theirs.')}
function withdrawBattle(){if(BS.result||BS.running)return;BS.result='withdrew';finishBattle();saveDraft();renderBattle();renderArmyBar()}
function newBattle(){if(BS.running)return;state.battleDemo._sim=false;state.battleDemo.units=JSON.parse(JSON.stringify(unitsOrig||state.battleDemo.units));BS.phase=0;BS.log=[];BS.result=null;BS.obs=null;BS.summary=null;draft.battleResult=null;draft.armyOrders={};selUnits=new Set();initSim();saveDraft();drawBattle();renderBattle();renderArmyBar()}
function moraleWord(u){return u.st==='routing'?'routing':u.st==='gone'?'gone':u.st==='wavering'?'wavering':u.mor<55?'shaken':'steady'}
function renderBattleStatus(p){
  initSim();const mA=armyMorale('A'),mB=armyMorale('B');
  const box=el('div',null,'bstat');
  const bar=(lab,v,col,note)=>{const r=el('div',null,'brow');r.append(el('span',lab,'bl'));const b=el('div',null,'bbar');const f=el('i');f.style.width=Math.round(v*100)+'%';f.style.background=col;b.append(f);r.append(b,el('span',note||Math.round(v*100)+'%','bn'));box.append(r)};
  bar('Your army',mA,mA<.4?'#b8442f':'#8fb96a','steady '+Math.round(mA*100)+'% · lost '+Math.round(losses('A')*100)+'%');
  const seen=state.battleDemo.units.some(u=>u.side==='B'&&u.vis);bar('Enemy (as you see)',mB,'#7fa6ee',seen?'about '+Math.round(mB*100/5)*5+'%':'not in sight');
  box.append(el('div','Phase '+BS.phase+' of '+BS.max+' · '+BS.phase*15+' min elapsed','hint'));p.append(box);
  if(BS.result){const [t,d]=OUTCOME[BS.result]||[BS.result,''];const c=el('div',null,'card result '+(BS.result==='victory'||BS.result==='marginal_win'?'win':BS.result==='defeat'||BS.result==='marginal_loss'?'lose':''));c.append(el('h3',t),el('p',d),el('p','You lost '+BS.summary.lossesA+'% and the enemy about '+BS.summary.lossesB+'%. Guns lost: '+BS.summary.gunsLostA+'. Units broken: '+BS.summary.routedA+'.','meta'));
    c.append(el('p','This result goes into your packet. The consequences for the campaign are decided by the adjudicator, not the table.','hint'));const nb=el('button','Fight it again','btn small');nb.onclick=newBattle;c.append(nb);p.append(c)}
  else{const row=el('div',null,'row');const r1=el('button','Run next 15 minutes ▶','btn seal');r1.onclick=()=>runPhase(1);const r3=el('button','Run 3 phases ▶▶','btn small');r3.onclick=()=>runPhase(3);const wd=el('button','Withdraw','btn small quiet');wd.onclick=withdrawBattle;row.append(r1,r3,wd);p.append(row);
    p.append(el('p','Your orders are carried out; the enemy does what it decides. You do not see its mind, only what your officers can see.','hint'))}
  if(BS.log.length){const d=el('details');d.open=true;d.append(el('summary','What happened'));for(const r of BS.log.slice(-3).reverse()){const c=el('div',null,'rep');c.append(el('b','Phase '+r.phase+' · you lost '+r.lostA+', they lost about '+r.lostB),el('div',r.enemyMoved,'meta'));for(const e of r.events)c.append(el('div','· '+e,'hint'));d.append(c)}p.append(d)}
}

/* ----- prefetch the next zoom level while idle (images feel instant) ----- */
const pfSeen=new Set();
function prefetch(){if(moving||!map)return;const z=map.getZoom()+1;if(z>10||z<4)return;const b=map.getBounds(),nw=map.project(b.getNorthWest(),z),se=map.project(b.getSouthEast(),z);
  const x0=Math.floor(nw.x/256),x1=Math.floor(se.x/256),y0=Math.floor(nw.y/256),y1=Math.floor(se.y/256);let n=0;
  for(let x=x0;x<=x1&&n<48;x++)for(let y=y0;y<=y1&&n<48;y++){const u='tiles1740/'+z+'/'+x+'/'+y+'.webp';if(!pfSeen.has(u)){pfSeen.add(u);const i=new Image();i.src=u;n++}}}

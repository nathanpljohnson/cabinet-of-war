/* ---------- table battle: terrain, fog, combat, an opponent that adapts, and real ways to lose ---------- */
const TER=JSON.parse($('terrain').textContent);
const BS={phase:0,max:12,log:[],result:null,mem:null,obs:null,running:false,rngSeed:1};
const SPEED={inf:{line:55,column:80},cav:{line:170,column:170},art:{line:38,column:38}};
const DOCTRINE={A:{fire:1.0},B:{fire:1.55,bold:.55}};
function battleMem(){draft.battleMem=draft.battleMem||{agg:0,hold:0,refuseL:0,refuseR:0,cavL:0,cavR:0,col:0,games:0};return draft.battleMem}
function rng(){BS.rngSeed|=0;BS.rngSeed=BS.rngSeed+0x6D2B79F5|0;let t=Math.imul(BS.rngSeed^BS.rngSeed>>>15,1|BS.rngSeed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}
function terrainAt(e,n){const c=Math.floor((e+TER.w/2)/TER.cell),r=Math.floor((TER.h/2-n)/TER.cell);if(c<0||r<0||c>=TER.cols||r>=TER.rows)return 0;return +TER.rows_str[r][c]}
function terMul(u,t){if(t===1)return u.type==='cav'?.3:.5;if(t===2)return u.type==='art'?.1:.25;if(t===3)return .6;return 1}
function initSim(){const bd=state.battleDemo;if(bd._sim)return;bd._sim=true;
  for(const u of bd.units){const base={inf:600,cav:130,art:60}[u.type];u.men=u.max=Math.round(base*(u.side==='B'?1.18:1));u.mor=u.side==='A'?76:86;u.coh=100;u.ammo=100;u.st='ok';u.guns=u.type==='art'?6:0;u.fire=0;u.vis=u.side==='A';u.seenE=null;u.seenN=null;u.rout=0}
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
  if(a.st==='routing'||a.type==='cav'||a.ammo<=8)return;const mv=a.moved?(a.type==='art'?0:.3):1;const R=a.type==='art'?700:150;let best=null,bd=1e9;
  for(const t of us){if(t.side===a.side||!alive(t)||t.st==='gone')continue;const d=dist(a,t);if(d>R||d>=bd)continue;if(a.type==='inf'&&dAng(ang(a,t),a.facing)>75)continue;if(!sees(a,t)&&d>250)continue;best=t;bd=d}
  if(!best)return;const t=best,d=bd,aspect=inFlank(t,a),cov=terrainAt(t.e,t.n)===1||terrainAt(t.e,t.n)===3?.55:1;
  let k;if(a.type==='art'){k=a.guns*(d<250?2.2:.75)*(1-d/700)*DOCTRINE[a.side].fire}else{k=a.men*.0045*(1-d/150)*(a.form==='column'?.4:1)*DOCTRINE[a.side].fire}
  k*=mv*(a.st==='wavering'?.5:1)*(.6+a.mor/250)*(aspect==='front'?1:aspect==='flank'?1.4:1.8)*cov*(a.ammo>25?1:.5);
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
  if(!alive(u)||u.st==='routing')return;u.moved=false;const o=u.ord;if(!o)return;
  if(o.form&&o.form!==u.form){u.form=o.form;o.form=null}
  if(o.dest){const dx=o.dest[0]-u.e,dy=o.dest[1]-u.n,d=Math.hypot(dx,dy);
    const sp=(SPEED[u.type][u.form||'line'])*.5*terMul(u,terrainAt(u.e,u.n))*(u.st==='wavering'?.6:1)*(o.mode==='charge'&&d<260?1.6:1);
    if(d<=Math.max(4,sp)){u.e=o.dest[0];u.n=o.dest[1];o.dest=null;if(o.facing!=null){u.facing=o.facing;o.facing=null}if(o.mode==='advance'||o.mode==='retire')o.mode='hold';u.mode=o.mode||'hold'}
    else{u.moved=true;if(u.type==='inf'&&terrainAt(u.e,u.n)!==0)u.coh-=1.2;u.e+=dx/d*sp;u.n+=dy/d*sp;const want=(Math.atan2(dx,dy)*180/Math.PI+360)%360;const rate=u.form==='column'?25:12;let df=((want-u.facing+540)%360)-180;u.facing=(u.facing+Math.max(-rate,Math.min(rate,df))+360)%360;if(o.mode)u.mode=o.mode}}
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
  const S={hold_bombard:.45+(adv>60?1.5:0)+M.agg*.14+(BS.phase<=3?1.1:0)+noise(),
    oblique_L:.7+thin(F.R,F.L)*1.8+M.hold*.1+(F.cavL<F.cavR?.35:-.3)+M.cavR*.12+noise(),
    oblique_R:.7+thin(F.L,F.R)*1.8+M.hold*.1+(F.cavR<F.cavL?.35:-.3)+M.cavL*.12+noise(),
    flank_cav_L:(F.cavL<80?1:.2)+(F.depth<.4?.5:0)+M.refuseL*.1+M.hold*.2+noise(),flank_cav_R:(F.cavR<80?1:.2)+(F.depth<.4?.5:0)+M.refuseR*.1+M.hold*.2+noise(),
    advance_center:(F.M<F.L*.7&&F.M<F.R*.7?1.1:.2)+(F.col>2?.5:0)+noise(),
    counter_charge:(adv>120&&F.coh<85?1.6:.1)+(F.depth<.3?.4:0)+noise(),
    withdraw:avgMor<42?3.2:-2};
  if(BS.lastPlan&&S[BS.lastPlan]!==undefined)S[BS.lastPlan]-=.45*(BS.repeat||0);
  let best='hold_bombard';for(const k in S)if(S[k]>S[best])best=k;
  if(best===BS.lastPlan)BS.repeat=(BS.repeat||0)+1;else{BS.repeat=0;BS.lastPlan=best}
  const why={hold_bombard:'It stands and shoots, waiting for you to come to it.',oblique_L:'It leans against your '+'left, where you are thinnest.'.replace('left','left'),oblique_R:'It leans against your right, where you are thinnest.',flank_cav_L:'Its horse are working round your left.',flank_cav_R:'Its horse are working round your right.',advance_center:'It pushes at your centre.',counter_charge:'It sees you over-extended and strikes back.',withdraw:'It is losing heart and draws off.',advance_cautious:'It feels forward.'}[best];
  return{name:best,why,F}}
function enemyOrders(plan){const us=state.battleDemo.units,B=us.filter(u=>u.side==='B'&&alive(u)&&u.st!=='routing'),A=us.filter(u=>u.side==='A'&&alive(u));const F=plan.F;
  const clear=u=>{u.ord={mode:'hold'}};B.forEach(clear);const cxB=B.reduce((s,u)=>s+u.e,0)/Math.max(1,B.length);
  const toward=(u,t,d)=>{const a=ang(u,t)*Math.PI/180;return[u.e+Math.sin(a)*d,u.n+Math.cos(a)*d]};
  const nearestA=u=>A.reduce((b,t)=>!b||dist(u,t)<dist(u,b)?t:b,null);
  const side=(l)=>B.filter(u=>l==='L'?u.e<cxB:u.e>=cxB);
  switch(plan.name){
   case 'hold_bombard':B.filter(u=>u.type==='art').forEach(u=>{const t=nearestA(u);if(t&&dist(u,t)>520)u.ord={mode:'advance',dest:toward(u,t,Math.min(260,dist(u,t)-500))}});break;
   case 'oblique_L':case 'oblique_R':{const L=plan.name==='oblique_L';const att=side(L?'R':'L'),ref=side(L?'L':'R');att.filter(u=>u.type==='inf').forEach((u,i)=>{const t=nearestA(u);if(t)u.ord={mode:'advance',dest:toward(u,t,260+i*0),form:'line'}});ref.forEach(u=>{u.ord={mode:'hold'}});break}
   case 'flank_cav_L':case 'flank_cav_R':{const L=plan.name==='flank_cav_L';const cv=B.filter(u=>u.type==='cav');const tgt=A.filter(u=>L?u.e<F.cx-350:u.e>F.cx+350);const t=tgt[0]||A[0];const flank=A.filter(u=>L?u.e<F.cx-350:u.e>F.cx+350);cv.forEach(u=>{const tg=flank.reduce((b,x)=>!b||dist(u,x)<dist(u,b)?x:b,null)||t;if(!tg)return;if(dist(u,tg)>520)u.ord={mode:'advance',dest:[tg.e+(L?-300:300),tg.n-40]};else u.ord={mode:'charge',dest:[tg.e,tg.n]}});B.filter(u=>u.type==='inf').forEach(u=>{const t2=nearestA(u);if(t2&&dist(u,t2)>200)u.ord={mode:'advance',dest:toward(u,t2,Math.min(150,dist(u,t2)-180))}});break}
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

/* ---------- orders of the day: one order; the staff write and send what it needs; one packet carries everything ---------- */
const STANDING0=[
 'Bring me at once, day or night, any report of troop movements near any frontier of the Queen’s lands, with its source, its date and how far it can be trusted.',
 'Obtain current returns from every frontier command and fortress (men present with their regiments, horses fit for service, guns, powder and provisions) and tell me where they differ from the paper strength.',
 'Keep me informed of the money actually in hand: what the treasury reports, what the provinces have promised, what is in the paymasters’ chests, and any pay owed to the troops.',
 'Note which foreign envoys are received at court and whom they see; bring me what is said, marked as fact, report or rumour.',
 'Sort my correspondence; bring me first anything from the Queen, the Conference or a frontier commander.',
 'Handle bread, forage, quarters, wagons and pay for my household and staff without troubling me; tell me only of failures, costs or delays.'];
function ensureCase(){draft.case=draft.case||{text:''};if(typeof draft.case.text!=='string')draft.case.text='';return draft.case}
function openCase(){ensureCase();$('case').classList.add('on');$('toggleC').setAttribute('aria-expanded','true');renderCase();const t=$('orders-text');if(t)t.focus()}
function closeCase(){$('case').classList.remove('on');$('toggleC').setAttribute('aria-expanded','false')}
function addToOrders(line){const c=ensureCase();c.text=(c.text.trim()?c.text.replace(/\s*$/,'\n'):'')+line;saveDraft();openCase();const t=$('orders-text');if(t)t.selectionStart=t.selectionEnd=t.value.length}
function replyTo(id){const rc=castById(id);addToOrders('Regarding '+(rc?rc.name+'’s':'the')+' report: ')}
function renderOrders(){renderCase()}
function renderCase(){const c=ensureCase(),t=$('orders-text');if(t&&t.value!==c.text)t.value=c.text;$('case-badge').textContent=c.text.trim()?'●':''}
async function resolve(){
  const c=ensureCase(),bd=state.battleDemo,field=state.player.mode==='field',dec=state.decision&&state.decision.options.find(x=>x.id===draft.option);
  const standing=(state.hidden&&state.hidden.standingOrders)||STANDING0;
  const army=Object.keys(armyOrders()).map(id=>{const u=unitById(id),o=armyOrders()[id];return '- '+u.name+' ('+u.id+'): '+JSON.stringify(o)}).join('\n');
  const places=[...referenced].map(id=>(state.locations.find(l=>l.id===id)||{name:id}).name).join(', ');
  const fought=BS.log.length||draft.battleResult;
  const pk='# CABINET OF WAR — RESOLVE AND ADVANCE\n\nAct as a historian and impartial adjudicator. This packet is self-contained.\n\n## Adjudication contract\n'+rules.contract+'\n\n## Location rule\nPlayer mode: '+state.player.mode+' (location: '+state.player.locationId+'). '+(field?'Player may direct only assigned forces directly; political influence travels by letter.':'Player may not direct battles; armies act on written orders that arrive after the stated delay.')
   +'\n\n## How orders work\nThe player gives one order of the day in plain words; he does not write letters. His secretary, staff and the proper offices turn it into whatever dispatches it needs, off-screen: choose recipients, channel, signature (where his office requires another’s authority) and timing. Each recipient reacts from their own priorities and knowledge when the dispatch arrives after a realistic delay. Do not show the player the dispatches or how they were worded or understood: record them in hidden.dispatches (to, via, sent, arrives, gist). He learns only results, through reports, events and what he can see. Open a scene (a conversation) only when his orders ask for an audience or events truly require him in person; keep scenes rare.'
   +'\n\n## Standing orders (kept by his staff; hidden from the player)\nCampaign invention: the character’s routine instructions. Keep them as a competent officer in his post would, adding, refining or dropping items as his knowledge and duties change, without asking the player. Apply them whenever time advances. The orders of the day override them.\n'+standing.map(s=>'- '+s).join('\n')
   +'\n\n## Orders of the day\n'+(c.text.trim()||'(none: continue under standing orders)')+(places?'\nPlaces he marked on the map for these orders: '+places:'')
   +'\n\n## Course chosen with the council\n'+(dec?dec.id+' — '+dec.title:'(none)')+'\nPlayer-proposed alternative: '+(draft.freeOption||'(none)')+'\nPlayer map notes: '+((state.annotations||[]).map(n=>n.text).join(' | ')||'(none)')
   +'\n\n## Staff work\nThe player does not manage supply, quarters, wagons or pay: the staff handles them. Resolve them in the background and report to the player only what he would learn (failures, costs, delays).'
   +'\n\n## Army orders drafted on the table ('+(field?'given directly':'sent to the commanders with his orders')+')\nPositions are metres east/north of '+bd.place+' centre; dest = destination, mode = hold/advance/retire, form = line/column.\n'+(army||'(none)')
   +'\n\n## Table battle (an input, not a verdict)\n'+(fought?(field?'':'The player is at court: this battle was fought by the field commander under his general orders, and the table result is how that commander’s battle went. ')+'Turn it into campaign consequences realistically. The player has not read this account.\n'+JSON.stringify({result:draft.battleResult||null,finished:!!draft.battleResult,phases:BS.log,enemy_adaptation_memory:battleMem(),seed:BS.rngSeed}):'(none fought)')
   +'\n\n## Scene consequences already recorded\n'+(state.scene?JSON.stringify({id:state.scene.id,status:state.scene.status,revision:state.scene.revision,commitments:state.scene.commitments,lines:state.scene.lines}):'(none)')
   +'\n\n## Reply format\nReturn ONE JSON object: the complete next state with schemaVersion 2, campaignId "'+state.campaignId+'", turn '+(state.turn+1)+', parentTurn '+state.turn+', and every field of the current state updated (date, player incl. mode and locationId, briefing, locations, reports with dated, from_id, via and claim labels, knowledge, decision (2–4 adviser-backed options or null), scene (or null), cast, battleDemo unit positions, forces, ledger appended with causal reasoning, hidden incl. hidden.standingOrders (the updated list of strings) and hidden.dispatches). Player-facing text must contain only what the character could know. Keep stable ids.\n\n## Current state (JSON)\nNote: the hidden field is not secret from anyone who can read this packet.\n'+JSON.stringify(state)+'\n';
  await copy(pk,'Orders copied. Paste them into Claude, then paste the reply back under Orders → Reply received.');
}
function initCase(){
  ensureCase();$('toggleC').onclick=()=>$('case').classList.contains('on')?closeCase():openCase();$('case-close').onclick=closeCase;$('case-tabs').hidden=true;
  const root=$('case-body');root.replaceChildren();
  const ta=el('textarea',null,'paper',{id:'orders-text',rows:'14','aria-label':'Orders of the day',placeholder:'Give your orders as you would to your staff. They write and send whatever is needed; you will hear the results in reports.'});
  ta.value=ensureCase().text;ta.oninput=()=>{ensureCase().text=ta.value;saveDraft();renderCase()};
  const b=el('button','Copy orders for Claude','btn seal');b.onclick=resolve;b.style.margin='12px 0 8px';
  const rep=el('details');rep.append(el('summary','Reply received — paste it here'));const wi=el('textarea',null,null,{id:'world-in',placeholder:'Paste Claude’s reply…',rows:'4'});rep.append(wi);const ib=el('button','Review update','btn');ib.onclick=()=>reviewWorld(wi.value);rep.append(ib);
  root.append(ta,b,rep);renderCase();
}

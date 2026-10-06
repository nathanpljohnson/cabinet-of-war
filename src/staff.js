/* ---------- staff: what you know (supply and quarters are handled for you) ---------- */
function renderStaff(){
  const p=$('p-staff');if(!p)return;p.replaceChildren();
  p.append(el('div','Staff','eyebrow'),el('h2','What your staff knows','dh'));
  p.append(el('p','Your staff handle bread, wagons, quarters and pay, and are already finding out what you would want to know. What they learn reaches you as reports. If you want something sooner, say so in your orders.','ctx'));
  const card=(title,text)=>{const c=el('div',null,'card');c.append(el('h3',title),el('p',text));p.append(c)};
  card('The army’s true strength','Not yet known. “On paper” and “present with their regiments” are different numbers, and only the clerks hold both.');
  card('Money','Known only as three different things: what the treasury says it holds, what the provinces have promised, and what is in a paymaster’s chest.');
  card('The frontier','Garrisons and stores in Silesia are unknown to you until someone reports them.');
  card('Season and roads',({autumn:'Autumn: roads are soft and the days short. Armies are thinking of winter quarters.',winter:'Winter: frozen roads carry wagons, but cold and short days slow everything.',spring:'Spring: thaw and mud; rivers in flood.',summer:'Summer: the best season for marching.'})[seasonName]||'');
}

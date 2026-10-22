/* The keeper of continuity: compares a reply with the state it continues and lists contradictions before you accept it.
   Hard breaks (time running backwards, the canon rewritten, the dead writing letters) and softer warnings (people,
   places or regiments vanishing or reappearing, a feeling turned round without a word of why). */
const STEP = { hostile: 0, cool: 1, cordial: 2, warm: 3 };
export function checkContinuity(prev, next) {
  const out = [], err = t => out.push({ level: 'error', text: t }), warn = t => out.push({ level: 'warn', text: t });
  const name = (s, id) => ((s.cast || []).find(c => c.id === id) || {}).name || id;
  if (next.date < prev.date) err('Time runs backwards: the reply is dated ' + next.date + ', before ' + prev.date + '.');
  const pc = (prev.hidden || {}).canon || [], nc = (next.hidden || {}).canon || [];
  for (const f of pc) if (!nc.includes(f)) err('A settled fact was dropped from the canon: “' + f + '”');
  const dead = new Set([...(prev.cast || []), ...(next.cast || [])].filter(c => c.dead).map(c => c.id));
  for (const r of next.reports || []) if (r.from_id && dead.has(r.from_id) && !(prev.reports || []).some(p => p.id === r.id)) err('A letter comes from ' + name(next, r.from_id) + ', who is dead.');
  for (const c of prev.cast || []) if (!(next.cast || []).some(n => n.id === c.id)) warn(c.name + ' has disappeared from the cast without explanation.');
  for (const c of prev.cast || []) { const n = (next.cast || []).find(x => x.id === c.id); if (c.dead && n && !n.dead) err(c.name + ' was dead and is alive again.'); }
  for (const l of prev.locations || []) if (!(next.locations || []).some(n => n.id === l.id)) warn(l.name + ' has disappeared from the map.');
  const ps = (prev.hidden || {}).standing || {}, ns = (next.hidden || {}).standing || {}, said = JSON.stringify([next.remarks || [], (next.reports || []).map(r => r.text)]);
  for (const id in ps) if (ns[id] && Math.abs(STEP[ns[id]] - STEP[ps[id]]) >= 2) { const n = name(next, id); if (!said.includes(n.split(' (')[0]) && !said.includes(n.split(',')[0])) warn(n + ' turns from ' + ps[id] + ' to ' + ns[id] + ' with no letter or remark that explains it.'); }
  if (prev.player && next.player && prev.player.dismissed && !next.player.dismissed && !/recall|restor|reinstat|commission/i.test(said)) warn('You are restored to office without any letter saying so.');
  const pu = ((prev.battleDemo || {}).units || []), nu = ((next.battleDemo || {}).units || []);
  for (const u of pu) { const n = nu.find(x => x.id === u.id); if (n && u.men <= 0 && n.men > 0) warn((u.name || u.id) + ' was destroyed and is back in the field.'); }
  for (const f of prev.forces || []) { const n = (next.forces || []).find(x => x.id === f.id); if (n && f.men && n.men > f.men * 1.3 && !said.includes(f.name)) warn((f.name || f.id) + ' grows from ' + f.men + ' to ' + n.men + ' men with no word of reinforcement.'); }
  return out;
}
export function correctionRequest(issues, turn) {
  return 'The reply for dispatch ' + turn + ' contradicts the established campaign:\n' + issues.map(i => '- ' + i.text).join('\n') + '\nPlease return the complete corrected state as ONE JSON object, keeping everything else the same and keeping hidden.canon as an append-only list of settled facts.';
}

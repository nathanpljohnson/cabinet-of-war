/* What awaits the player's ruling before the dispatch is sealed: urgent letters, the council's decision, every letter that
   puts a question to them ("asks", from the reply), stalled undertakings and audiences to prepare. Each is open, decided
   or set aside, from what the player has done on the page. Only what has reached them by the day shown. Pure: the
   dispatch (shell.js) shows it; the packet (turn.js, agendaSection) tells the adjudicator what was left undecided. */

const ANSWERED = { ordered: 'orders given', adopted: 'course adopted', handled: 'handled under your instructions' };
const ASIDE = { filed: 'put with your papers', aside: 'set aside' };
const QUIET = new Set(['gazette', 'scene', 'briefing', 'mandate', 'advice']);

/* inputs: letters [{id, kind, from_id, from, title, asks, urgent, dated, arrives}] (those that have reached the player),
   acted {letter id: how}, chose (letter id → the answer given, or null), decision {id, title, options}, option (the course
   adopted), undertakings [{id, title, stage, status}] as the player knows them, audiences [{id, with, date, title, status, noted}],
   briefs (audience ids prepared in this dispatch), names (cast id → name), today */
export function agenda({ letters = [], acted = {}, chose = () => null, decision = null, option = '', undertakings = [], audiences = [], briefs = [], names = {}, today } = {}) {
  const out = [], who = r => names[r.from_id] || r.from || '';
  for (const r of letters) { if (!r || QUIET.has(r.kind) || (today && (r.arrives || r.dated) > today)) continue;
    if (r.urgent) { const c = chose(r.id);
      out.push({ kind: 'urgent', id: r.id, title: r.title, from: who(r), date: r.arrives || r.dated, ask: r.urgent.prompt || r.asks || 'It needs your answer today.', state: c ? 'decided' : 'open', how: c ? 'you answered: ' + c : 'today, or the default applies' }); continue; }
    const a = acted[r.id];
    if (!r.asks && (a || r.handled)) continue; // a letter that only informs leaves the list once you have dealt with it
    out.push({ kind: 'letter', id: r.id, title: r.title, from: who(r), date: r.arrives || r.dated, ask: r.asks || null,
      state: ANSWERED[a] || r.handled ? 'decided' : ASIDE[a] ? 'aside' : 'open', how: ANSWERED[a] || (r.handled ? ANSWERED.handled : ASIDE[a] || '') }); }
  if (decision && (decision.options || []).length) { const o = decision.options.find(x => x.id === option);
    out.push({ kind: 'council', id: decision.id, title: decision.title, from: 'your advisers', ask: 'Which course do you take: ' + decision.options.map(x => x.title).join('; ') + '?', state: o ? 'decided' : 'open', how: o ? 'you adopted: ' + o.title : '' }); }
  for (const u of undertakings) if (u && u.status === 'stalled') out.push({ kind: 'stalled', id: u.id, title: u.title, ask: 'Stalled: ' + (u.stage || '') + ' What now?', state: 'open', how: '' });
  for (const a of audiences) { if (!a || (a.status || 'expected') !== 'expected' || (today && a.date && a.date < today) || (today && a.noted && a.noted > today)) continue;
    const ready = briefs.includes(a.id);
    out.push({ kind: 'audience', id: a.id, title: a.title || 'An audience', from: (a.with || []).map(id => names[id] || id).join(' and '), date: a.date, ask: 'What will you press, concede and keep back?', state: ready ? 'decided' : 'open', how: ready ? 'prepared' : 'not prepared' }); }
  const rank = x => (x.state === 'open' ? 0 : 1) * 10 + ({ urgent: 0, council: 1, letter: 2, stalled: 3, audience: 4 }[x.kind]);
  return out.sort((a, b) => rank(a) - rank(b) || (a.date || '').localeCompare(b.date || ''));
}

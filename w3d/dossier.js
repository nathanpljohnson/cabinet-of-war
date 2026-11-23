/* The people you know, as your secretary keeps them: one file a person, made only of what has reached you by the day
   shown — their letters, the letters and Diarium issues that speak of them, your orders to them and whether they were
   answered, where you saw them, what you overheard, what they said of you, the audiences ahead, and the secretary's own
   notes (state.dossier, written by the adjudicator, only grows). Never their agenda, standing or anything else hidden.
   Pure: the page (shell.js) gathers the inputs, tests/harness.mjs checks the result. */

// how letters name people the cast records more formally; ambiguous surnames (two Harrachs) are left to these or to nothing
const ALIASES = {
  maria_theresa: ['Maria Theresa', 'Her Majesty', 'the Queen'],
  francis_stephen: ['Francis Stephen', 'Grand Duke'],
  frederick: ['Frederick', 'King in Prussia', 'Prussian King'],
  countess_khevenhuller: ['Countess Khevenhüller', 'your wife'],
  harrach_joseph: ['Joseph Harrach', 'President of the Hofkriegsrat'],
  harrach_alois: ['Alois Harrach', 'Landmarschall'],
};
const TITLE = new Set('Count Countess Graf Gräfin Baron Baroness Prince Princess Duke Duchess Grand Archduchess Archduke King Queen Elector Electress Emperor Empress Cardinal Marshal General Field FML FZM Hofrat Your Envoy Resident Infantry Cavalry Artillery Quartermaster Staff My Assigned von van de of the and in II III IV'.split(' '));
// the significant words of a cast name: "FML Franz Wenzel Wallis" → Wallis; "Count Starhemberg (Gundaker Thomas)" → Starhemberg
const surname = name => { const words = String(name || '').replace(/\(.*?\)/g, '').split(/,| of | at /)[0].split(/\s+/).filter(w => /^[A-ZÀ-Ž][a-zà-ž]{2,}/.test(w) && !TITLE.has(w)); return words.length ? words[words.length - 1] : null; };
// your own command and your own secretary (who keeps the files) have none
const NOT_FILED = new Set(['own-forces', 'secretary']);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function aliasesOf(cast) {
  const people = (cast || []).filter(c => c && c.id), counts = {};
  for (const c of people) { const s = surname(c.name); if (s) counts[s] = (counts[s] || 0) + 1; }
  const out = {};
  for (const c of people) { const s = surname(c.name), own = ALIASES[c.id] || [];
    out[c.id] = [...new Set([...own, ...(s && counts[s] === 1 ? [s] : [])])]; }
  return out;
}
const matcher = names => names.length ? new RegExp('(^|[^\\p{L}])(' + names.map(escRe).join('|') + ')(?![\\p{L}])', 'u') : null;

// what a paper says, whatever its kind: a letter's text, the secretary's letter, a meeting's lines, a Diarium issue
export const textOf = r => [r.title, r.text, ...(r.b ? Object.values(r.b).filter(v => typeof v === 'string') : []),
  ...((r.scene || {}).lines || []).map(l => l && l.text), ...(r.items || []).flatMap(i => [i && i.head, i && i.text])].filter(Boolean).join(' ');

const byDate = (a, b) => (b.date || '').localeCompare(a.date || '');
const latestOf = f => [f.notes, f.letters, f.mentions, f.met, f.orders, f.overheard, f.said].flat().reduce((m, x) => x && x.date > m ? x.date : m, '');

/* inputs, each already limited to what has reached the player by `today`:
   cast, letters [{id, from_id, title, text|b|scene|items, kind, dated, arrives, place}], orders [{ref, to, line, date, answered}],
   sightings [{date, place, who:[ids], doing}], overheard [{date, line, who: names}], hearsay [{said, teller, date}],
   dossier [{who, date, note}], audiences [{id, with, date, title, status}], remarks [text], household {spouse} */
export function peopleFiles({ cast = [], letters = [], orders = [], sightings = [], overheard = [], hearsay = [], dossier = [], audiences = [], remarks = [], household = {}, today } = {}) {
  const on = d => !today || !d || d <= today, al = aliasesOf(cast), files = new Map();
  for (const c of cast) if (c && c.id && !NOT_FILED.has(c.id)) files.set(c.id, { id: c.id, name: c.name || c.id, office: c.office || '', dead: !!c.dead,
    kin: household && household.spouse === c.id ? 'your wife' : null, notes: [], letters: [], mentions: [], met: [], orders: [], overheard: [], said: [], audiences: [], remarks: [] });
  const res = Object.fromEntries([...files.keys()].map(id => [id, matcher(al[id] || [])]));
  const seenPaper = new Set();
  for (const r of letters) { if (!r || !on(r.arrives || r.dated)) continue; const key = r.id + '|' + r.dated; if (seenPaper.has(key)) continue; seenPaper.add(key);
    const date = r.arrives || r.dated, text = textOf(r);
    if (r.kind === 'scene') { for (const p of (r.scene && r.scene.participants) || []) { const f = files.get(p.id); if (f) f.met.push({ date, place: r.place, what: r.title, letter: r.id }); } }
    else if (r.from_id && files.has(r.from_id) && r.kind !== 'advice') files.get(r.from_id).letters.push({ id: r.id, title: r.title, date, dated: r.dated, place: r.place });
    for (const [id, re] of Object.entries(res)) if (re && id !== r.from_id && re.test(text)) files.get(id).mentions.push({ id: r.id, title: r.title, date, from: r.from || ((cast.find(c => c.id === r.from_id) || {}).name) || '', kind: r.kind || 'letter' }); }
  for (const o of orders) { const f = o && files.get(o.to); if (f && on(o.date)) f.orders.push({ ref: o.ref, line: o.text || o.line, date: o.date, answered: !!o.answered }); }
  for (const s of sightings) if (s && on(s.date)) for (const id of s.who || []) { const f = files.get(id); if (f && !f.met.some(m => m.date === s.date && m.place === s.place)) f.met.push({ date: s.date, place: s.place, what: s.doing || '' }); }
  for (const o of overheard) if (o && on(o.date)) for (const f of files.values()) if (String(o.who || '').includes(f.name)) f.overheard.push({ date: o.date, line: o.line });
  for (const h of hearsay) { const f = h && files.get(h.teller); if (f && on(h.date)) f.said.push({ date: h.date, said: h.said }); }
  for (const n of dossier) { const f = n && files.get(n.who); if (f && n.note && on(n.date)) f.notes.push({ date: n.date, note: n.note }); }
  for (const a of audiences) if (a && on(a.noted)) for (const id of a.with || []) { const f = files.get(id); if (f) f.audiences.push({ id: a.id, date: a.date, title: a.title || 'An audience', status: a.status || 'expected' }); }
  for (const t of remarks) for (const [id, re] of Object.entries(res)) if (re && re.test(t)) files.get(id).remarks.push(t);
  const out = [];
  for (const f of files.values()) {
    for (const k of ['notes', 'letters', 'mentions', 'met', 'orders', 'overheard', 'said']) f[k].sort(byDate);
    f.audiences.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // where they were when word of them last reached you: their own latest letter (written from), or where you saw them
    const lastLetter = f.letters.find(l => l.place), lastMet = f.met[0];
    f.last = lastMet && (!lastLetter || lastMet.date >= lastLetter.dated) ? { place: lastMet.place, date: lastMet.date, how: 'seen' } : lastLetter ? { place: lastLetter.place, date: lastLetter.dated, how: 'wrote' } : null;
    f.latest = latestOf(f);
    f.known = !!(f.kin || f.latest || f.audiences.length || f.remarks.length);
    out.push(f);
  }
  return out.sort((a, b) => (b.kin ? 1 : 0) - (a.kin ? 1 : 0) || b.latest.localeCompare(a.latest) || a.name.localeCompare(b.name));
}

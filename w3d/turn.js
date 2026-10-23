/* The turn: what goes to Claude and how its reply comes back. Pure functions (no DOM), so tests/ can run them in node.
   A reply carries only what changed (schema 3); mergeTurn applies it to the state by the rules in REPLY_RULES. */

export const REPLY_SCHEMA = 3;
// reference the adjudicator does not need to see or return every turn (kept in the page and the campaign file)
export const STATIC_KEYS = ['labels', 'routes', 'routesNote', 'sources', 'sourcesAppendix', 'regionLabels', 'movementsNote', 'annotations', 'openingVersion'];
// the player's own: a reply cannot change them
export const PLAYER_KEYS = ['trust', 'legacy', 'campaignId', 'record', 'span'];
// lists merged by id: give only new or changed items (with only the changed fields); {"id": x, "_remove": true} removes one
export const BY_ID = ['cast', 'locations', 'forces', 'fortresses', 'movements', 'hidden.threads', 'battleDemo.units', 'battleDemo.options'];
// lists that only grow: give only the new entries
export const APPEND = ['ledger', 'hidden.canon', 'hidden.dispatches', 'hidden.volumes'];
const appendPath = p => APPEND.includes(p) || p.startsWith('hidden.memory.');
// per-turn things: when a reply leaves them out, they are cleared rather than carried into the next turn
const PER_TURN_LISTS = ['reports', 'overheard', 'whereabouts', 'gazette'], PER_TURN_HIDDEN = ['decisions', 'fortune_used'], PER_TURN_NULL = ['decision', 'scene'];
export const WEATHER = ['clear', 'haze', 'overcast', 'mist', 'rain', 'snow', 'storm'];
export const SCENE_TAGS = ['alarm', 'idle_soldiers', 'bread_queue', 'empty_market', 'recruiting', 'wagons_in', 'wounded', 'prisoners', 'celebration', 'smoke'];
export const THREAD_STATUS = ['dormant', 'building', 'triggered', 'resolved', 'abandoned'];
export const TEMPERS = ['rash', 'bold', 'steady', 'cautious', 'timid'];
export const TEMPO = ['winter quarters', 'campaigning', 'truce'];
export const LOSSES = ['light', 'heavy', 'destroyed'];
// a fingerprint for the sealed record (not cryptographic: it shows tampering and stale replies, it does not stop a determined editor)
export function fingerprint(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
export const sealOf = state => { const c = ((state.record || {}).chain || []); return c.length ? c[c.length - 1].h : fingerprint('origin:' + state.campaignId); };
// the next link: the head of the chain and what this reply changed
export const nextLink = (state, payload, turn, date) => ({ turn, date, h: fingerprint(sealOf(state) + ':' + fingerprint(JSON.stringify(payload))) });
export const volumeDue = state => state.turn > 0 && (state.turn + 1) % 10 === 0;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/* ---------- merging a reply ---------- */
function mergeInto(target, patch, path, notes) {
  for (const k of Object.keys(patch)) {
    const p = path ? path + '.' + k : k, v = patch[k];
    if (!path && PLAYER_KEYS.includes(k)) { notes.push('Ignored a change to ' + k + ', which is yours to set.'); continue; }
    if (v === null) { delete target[k]; continue; }
    if (Array.isArray(v)) {
      if (appendPath(p)) target[k] = (Array.isArray(target[k]) ? target[k] : []).concat(clone(v));
      else if (BY_ID.includes(p)) target[k] = mergeById(Array.isArray(target[k]) ? target[k] : [], v, p, notes);
      else target[k] = clone(v);
    } else if (isObj(v) && isObj(target[k])) mergeInto(target[k], v, p, notes);
    else target[k] = clone(v);
  }
}
function mergeById(list, items, path, notes) {
  for (const it of items) {
    if (!isObj(it) || typeof it.id !== 'string') { notes.push('An item in ' + path + ' has no id and was skipped.'); continue; }
    const i = list.findIndex(x => x && x.id === it.id);
    if (it._remove) { if (i >= 0) list.splice(i, 1); continue; }
    if (i >= 0) mergeInto(list[i], it, path + '[]', notes); else list.push(clone(it));
  }
  return list;
}
// a branch of an urgent letter: only these parts of the state may change mid-turn
export function applyBranch(state, changes) {
  const notes = [], ch = {};
  for (const k of ['world', 'remarks', 'cast']) if (changes && k in changes) ch[k] = changes[k];
  if (changes && isObj(changes.hidden)) { ch.hidden = {}; for (const k of ['standing', 'memory']) if (k in changes.hidden) ch.hidden[k] = changes.hidden[k]; }
  mergeInto(state, ch, '', notes); return notes;
}
export function mergeTurn(prev, reply) {
  const next = clone(prev), notes = [], ch = isObj(reply.changes) ? reply.changes : {};
  mergeInto(next, ch, '', notes);
  for (const k of PER_TURN_LISTS) if (!(k in ch)) next[k] = [];
  for (const k of PER_TURN_NULL) if (!(k in ch)) next[k] = null;
  next.hidden = next.hidden || {};
  for (const k of PER_TURN_HIDDEN) if (!(isObj(ch.hidden) && k in ch.hidden)) next.hidden[k] = [];
  if (next.world) for (const k of ['weather', 'scene']) if (!(isObj(ch.world) && k in ch.world)) delete next.world[k];
  if (next.battleDemo) delete next.battleDemo._sim;
  next.span = { from: prev.date, at: (prev.player || {}).locationId || null };
  next.turn = reply.turn; next.parentTurn = reply.parentTurn; next.schemaVersion = prev.schemaVersion || 2;
  return { next, notes };
}

/* ---------- reading a pasted reply ---------- */
// takes the outermost JSON object out of the text (code fences, prose around it); repairs trailing commas; says when it was cut off
export function parseReply(text) {
  const fence = /```(?:json)?\s*([\s\S]*?)(```|$)/.exec(text || ''), t = (fence ? fence[1] : text || '').trim(), a = t.indexOf('{');
  if (a < 0) return { error: 'No reply found in the pasted text.' };
  let depth = 0, str = false, esc = false, end = -1;
  for (let i = a; i < t.length; i++) { const c = t[i];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true; else if (c === '{' || c === '[') depth++; else if (c === '}' || c === ']') { depth--; if (depth === 0) { end = i; break; } } }
  if (end < 0) return { error: 'The reply was cut off before it ended.', truncated: true };
  const body = t.slice(a, end + 1);
  let err = null;
  for (const s of [body, body.replace(/,(\s*[}\]])/g, '$1')]) { try { return { value: JSON.parse(s) }; } catch (e) { err = err || e; } }
  return { error: 'The reply is not valid JSON: ' + err.message };
}

/* ---------- checking a reply (errors stop it; warnings are shown; fixes are applied and listed) ---------- */
export function checkReply(prev, reply, ctx = {}) {
  const errors = [], warns = [], fixes = [];
  if (!isObj(reply)) return { errors: ['The reply is not an object.'], warns, fixes };
  if (reply.kind !== 'turn' || reply.schemaVersion !== REPLY_SCHEMA) errors.push('Expected a turn reply (kind "turn", schemaVersion 3).');
  if (reply.campaignId !== prev.campaignId) errors.push('This reply belongs to a different campaign.');
  if (reply.turn !== prev.turn + 1 || reply.parentTurn !== prev.turn) errors.push('This reply is for turn ' + reply.turn + ' following ' + reply.parentTurn + '; expected turn ' + (prev.turn + 1) + ' following ' + prev.turn + '.');
  const ch = reply.changes;
  if (!isObj(ch)) { errors.push('The reply has no "changes".'); return { errors, warns, fixes }; }
  for (const k of ['date', 'title', 'briefing']) if (typeof ch[k] !== 'string' || !ch[k]) errors.push('The reply is missing "' + k + '".');
  if (typeof ch.date === 'string' && ch.date < prev.date) errors.push('Time runs backwards: the reply is dated ' + ch.date + ', before ' + prev.date + '.');
  if (!Array.isArray(ch.reports)) errors.push('The reply has no "reports" (give [] if no letters arrive).');
  if (errors.length) return { errors, warns, fixes };
  const date = ch.date, castIds = new Set([...(prev.cast || []), ...(Array.isArray(ch.cast) ? ch.cast : [])].map(c => c && c.id));
  const locIds = new Set([...(prev.locations || []), ...(Array.isArray(ch.locations) ? ch.locations : [])].map(l => l && l.id));
  const refs = new Set(ctx.orderRefs || []);
  ch.reports.forEach((r, i) => {
    if (!isObj(r) || !r.id || !r.title || !r.text || !r.dated) { errors.push('Letter ' + (i + 1) + ' needs id, title, text and dated.'); return; }
    checkLetter(r, prev.date, date, refs, castIds, warns, fixes);
    if (r.urgent) checkUrgent(r, prev.date, date, refs, castIds, warns, fixes);
  });
  if (errors.length) return { errors, warns, fixes };
  for (const c of Array.isArray(ch.cast) ? ch.cast : []) if (c && c.id && !(prev.cast || []).some(x => x.id === c.id)) {
    if (!c.name) warns.push('A new person (' + c.id + ') has no name.');
    if (c.place && !locIds.has(c.place)) warns.push(c.name + ' is placed at "' + c.place + '", which is not a location on the map.');
  }
  const w = isObj(ch.world) ? ch.world : null;
  if (w && isObj(w.weather)) for (const [d, k] of Object.entries(w.weather)) if (!WEATHER.includes(k)) { fixes.push('Unknown weather "' + k + '" on ' + d + ' was left out.'); delete w.weather[d]; }
  if (w && isObj(w.scene)) for (const [place, tags] of Object.entries(w.scene)) { if (!Array.isArray(tags)) { delete w.scene[place]; continue; }
    const bad = tags.filter(t => !SCENE_TAGS.includes(t)); if (bad.length) { fixes.push('Unknown scene tags at ' + place + ' were left out: ' + bad.join(', ') + '.'); w.scene[place] = tags.filter(t => SCENE_TAGS.includes(t)); } }
  const h = isObj(ch.hidden) ? ch.hidden : {};
  if (ctx.fortune && ctx.fortune.length && !(Array.isArray(h.fortune_used) && h.fortune_used.length)) warns.push('The reply does not say how this turn’s fortune was used (hidden.fortune_used).');
  if (!(Array.isArray(h.decisions) && h.decisions.length)) warns.push('The reply does not record what the other powers decided (hidden.decisions).');
  if (typeof h.chronicle !== 'string' || !h.chronicle.trim()) warns.push('The reply does not rewrite the story so far (hidden.chronicle).');
  else if (h.chronicle.split(/\s+/).length > 420) warns.push('The story so far runs past 300 words; it will grow the packet.');
  for (const t of Array.isArray(h.threads) ? h.threads : []) {
    if (t && t.status && !THREAD_STATUS.includes(t.status)) warns.push('Thread ' + t.id + ' has an unknown status "' + t.status + '".');
    const old = ((prev.hidden || {}).threads || []).find(x => x.id === (t && t.id));
    if (old && ['resolved', 'abandoned'].includes(old.status) && t.status && ['dormant', 'building'].includes(t.status) && !t.note) warns.push('Thread "' + (old.title || old.id) + '" was ' + old.status + ' and is open again without a note why.');
  }
  if (ch.reports.some(r => r && r.battle) && !isObj(ch.battleDemo)) warns.push('A letter is marked as a battle account, but battleDemo was not set for that battle; the ground he sees will be the old one.');
  const route = ch.player && ch.player.route;
  if (Array.isArray(route)) ch.player.route = route.filter((s, i) => { const ok = isObj(s) && typeof s.date === 'string' && s.date >= prev.date && s.date <= date && (s.place === 'road' || locIds.has(s.place));
    if (!ok) fixes.push('Stage ' + (i + 1) + ' of his route was left out (it needs a date within the turn and a location id or "road").'); return ok; });
  const en = ch.battleDemo && ch.battleDemo.enemy; if (en && en.temper && !TEMPERS.includes(en.temper)) { fixes.push('Unknown enemy temper "' + en.temper + '" read as steady.'); en.temper = 'steady'; }
  for (const k of PLAYER_KEYS) if (k in ch && k !== 'campaignId') fixes.push('A change to ' + k + ' was ignored: it is yours to set.');
  if (ch.ended && !ch.epilogue) warns.push('The campaign ends but the reply has no epilogue.');
  if (ctx.seal) { if (reply.seal && reply.seal !== ctx.seal) errors.push('This reply was written for a different packet (its seal ' + reply.seal + ' is not this turn’s ' + ctx.seal + '). Paste the reply to the latest packet.'); else if (!reply.seal) warns.push('The reply does not carry this turn’s seal.'); }
  if (ctx.volumeDue && !(Array.isArray(h.volumes) && h.volumes.length)) warns.push('A volume of the chronicle was due this turn (hidden.volumes).');
  if (w && w.tempo && !TEMPO.includes(w.tempo)) { fixes.push('Unknown tempo "' + w.tempo + '" was left out.'); delete w.tempo; }
  if (Array.isArray(ch.gazette)) ch.gazette = ch.gazette.filter((g, i) => { if (!isObj(g) || !g.date || !Array.isArray(g.items) || !g.items.length) { fixes.push('Gazette issue ' + (i + 1) + ' had no date or items and was left out.'); return false; } g.id = g.id || 'gz-' + g.date; if (g.date < prev.date) g.date = prev.date; if (g.date > ch.date) g.date = ch.date; return true; });
  const af = ch.battleDemo && ch.battleDemo.aftermath; if (af && isObj(af.fallen)) for (const [id, v] of Object.entries(af.fallen)) if (!LOSSES.includes(v)) { fixes.push('Unknown losses "' + v + '" for ' + id + ' read as heavy.'); af.fallen[id] = 'heavy'; }
  return { errors, warns, fixes };
}
function checkLetter(r, from, to, refs, castIds, warns, fixes) {
  if (!r.arrives) { r.arrives = r.dated > from ? r.dated : from; }
  if (r.arrives < r.dated) { fixes.push('“' + r.title + '” arrived before it was written; it now arrives on ' + r.dated + '.'); r.arrives = r.dated; }
  if (r.arrives < from) { fixes.push('“' + r.title + '” was set to arrive before today; it arrives today.'); r.arrives = from; }
  if (r.arrives > to) { fixes.push('“' + r.title + '” was set to arrive after the turn ends; it arrives on ' + to + '.'); r.arrives = to; }
  if (Array.isArray(r.re)) { const bad = r.re.filter(x => !refs.has(x)); if (bad.length && refs.size) { fixes.push('“' + r.title + '” answered orders you never gave (' + bad.join(', ') + '); those links were dropped.'); r.re = r.re.filter(x => refs.has(x)); } }
  if (r.from_id && !castIds.has(r.from_id)) warns.push('“' + r.title + '” comes from "' + r.from_id + '", who is not among the people of the campaign.');
  if (!r.source) warns.push('“' + r.title + '” does not say who saw or heard it (source).');
}
function checkUrgent(r, from, to, refs, castIds, warns, fixes) {
  const u = r.urgent, os = Array.isArray(u.options) ? u.options.filter(o => isObj(o) && o.id && o.label) : [];
  if (os.length < 2) { fixes.push('“' + r.title + '” was marked urgent without two choices; it is an ordinary letter.'); delete r.urgent; return; }
  u.options = os.slice(0, 3);
  if (u.options.filter(o => o.default).length !== 1) { u.options.forEach(o => delete o.default); u.options[u.options.length - 1].default = true; }
  for (const o of u.options) for (const l of Array.isArray(o.letters) ? o.letters : []) if (isObj(l) && l.id && l.title && l.text && l.dated) checkLetter(l, from, to, refs, castIds, warns, fixes);
}

/* ---------- fortune: the page rolls; the same turn always rolls the same, so sealing again changes nothing ---------- */
export function rollFortune(campaignId, turn, n = 8, salt = '') {
  let s = [...(campaignId + (salt ? ':' + salt : '') + ':' + turn)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 2654435761) | 0, 0x9e3779b9);
  const r = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return Array.from({ length: n }, () => 1 + Math.floor(r() * 100));
}

/* ---------- what of the almanac goes with this turn ---------- */
export function seedThreads(almanac, from = '') { return (almanac.plots || []).map(p => { const w = p.window && p.window[0] ? p.window[0] + (p.window[0].length === 7 ? '-01' : '') : null; return { id: p.id, title: p.title, status: 'dormant', next_check: w && from > w ? from : w }; }); }
export const liveThread = t => t && ['building', 'triggered'].includes(t.status);
export const dueThread = (t, date) => t && t.status === 'dormant' && !!t.next_check && t.next_check <= addDays(date, 30);
export function activePlots(almanac, threads, date) {
  const soon = addDays(date, 30), byId = new Map((threads || []).map(t => [t.id, t]));
  return (almanac.plots || []).filter(p => {
    const t = byId.get(p.id); if (t) return liveThread(t) || dueThread(t, date);
    const [a, b] = p.window || []; return a && (a <= soon.slice(0, a.length)) && (!b || b >= date.slice(0, b.length));
  });
}
// a live thread gets its whole model; one only due for a check gets what tells whether it has begun
const compactPlot = (p, live) => { const o = {}; for (const k of live ? ['id', 'title', 'window', 'actors', 'preconditions', 'historical', 'levers', 'signals', 'failure_modes'] : ['id', 'title', 'window', 'preconditions', 'signals']) if (p[k] != null) o[k] = p[k]; return o; };
export const KEEP = { ledgerTurns: 3, canon: 40, dispatches: 12, memory: 5 };
export function liveState(state) {
  const s = clone(state); for (const k of STATIC_KEYS) delete s[k];
  if (s.hidden) { delete s.hidden.world; delete s.hidden.threads; } // threads go as the index above the state
  delete s.record; delete s.span; // the seal goes above the state; the span is the page's
  // last turn's own output: the adjudicator wrote it and the merge clears it; only an index of the letters goes back
  s.reports = (s.reports || []).map(r => ({ id: r.id, from_id: r.from_id, dated: r.dated, title: r.title, ...(r.re ? { re: r.re } : {}) }));
  for (const k of ['gazette', 'whereabouts', 'overheard']) delete s[k];
  if (s.decision) s.decision = { id: s.decision.id, title: s.decision.title };
  if (s.scene && s.scene.status === 'closed') delete s.scene;
  const h = s.hidden || {}; delete h.decisions; delete h.fortune_used;
  const t = state.turn || 0, older = (n, all) => all > n ? ' (' + (all - n) + ' earlier entries are kept by the page)' : '';
  if (Array.isArray(s.ledger)) { const all = s.ledger.length; s.ledger = s.ledger.filter(e => !(e && e.turn) || e.turn > t - KEEP.ledgerTurns); if (s.ledger.length < all) s.ledgerNote = 'Recent entries only' + older(s.ledger.length, all) + '.'; }
  if (Array.isArray(h.canon) && h.canon.length > KEEP.canon) { h.canonNote = 'The latest ' + KEEP.canon + ' settled facts' + older(KEEP.canon, h.canon.length) + '; the page checks every reply against all of them.'; h.canon = h.canon.slice(-KEEP.canon); }
  if (Array.isArray(h.dispatches) && h.dispatches.length > KEEP.dispatches) h.dispatches = h.dispatches.slice(-KEEP.dispatches);
  if (isObj(h.memory)) for (const k of Object.keys(h.memory)) if (Array.isArray(h.memory[k])) h.memory[k] = h.memory[k].slice(-KEEP.memory);
  const bd = s.battleDemo; // the table battle's ground, compactly: change units by id ({"id", "e", "n", "facing"}) when a battle moves them
  const battleNear = bd && (bd.enemy || bd.aftermath || (state.world || {}).tempo === 'campaigning' || state.player.mode === 'field');
  if (bd && !battleNear) s.battleDemo = { id: bd.id, title: bd.title, place: bd.place, center: bd.center, date: bd.date, note: 'Units and positions are sent when a battle may come (campaigning, an enemy commander named, or the player with the army).' };
  else if (bd) s.battleDemo = { id: bd.id, date: bd.date, title: bd.title, place: bd.place, center: bd.center, enemy: bd.enemy, aftermath: bd.aftermath, unitsAs: 'id, side, type, e, n, facing', units: (bd.units || []).map(u => [u.id, u.side, u.type, u.e, u.n, u.facing]) };
  return s;
}

/* ---------- the packet ---------- */
export function replyFormat(state) {
  const n = state.turn + 1;
  return `## Reply format
Return ONE JSON object and nothing else:
{"kind": "turn", "schemaVersion": 3, "campaignId": "${state.campaignId}", "turn": ${n}, "parentTurn": ${state.turn}, "seal": "${sealOf(state)}", "changes": { … }}

"changes" holds only what changed this turn, in the same shape as the current state below. The page merges it:
- Always give: date, title, briefing, reports (this turn's letters; [] if none), hidden.chronicle, hidden.decisions, hidden.fortune_used, and hidden.canon / ledger entries for what was settled.
- Objects merge key by key. Give only the keys that changed. A key set to null is removed.
- These lists merge by id — give only new or changed items, each with its id and only the fields that changed; {"id": "…", "_remove": true} removes one: ${BY_ID.join(', ')}.
- These lists only grow — give only the new entries: ${APPEND.join(', ')}, and each list in hidden.memory.
- Every other list you give replaces the old one whole (reports, knowledge, remarks, hidden.standingOrders, refugees, decision.options …).
- Cleared unless you give them again: reports, gazette, overheard, whereabouts, decision, scene, world.weather, world.scene, hidden.decisions, hidden.fortune_used.
- Never change: ${PLAYER_KEYS.join(', ')}.
- Player-facing text holds only what the character could know. Keep ids stable.
- Optional, give only when they apply: gazette (the Diarium issues of this turn), weather (only the days it changes; each day keeps the last weather given), overheard, whereabouts, decision (only a real fork), scene (an audience he asked for: {"id","title","setting","participants":[{"id","name"}],"lines":[{"who","text"}],"commitments":["…"],"status":"closed"}).
- A journey: give player.locationId where he ends the turn, and player.route [{"date","place"}] (place a location id or "road") if he stops anywhere or arrives on a day other than the distance implies. Without a route he is on the road from the first day of the turn and arrives after the usual days for the distance.
- A battle account (a report with "battle": true) needs battleDemo for that battle: title, place, center [lat, lon], date, and its units moved or removed by id. For a battle outside this campaign, write an ordinary letter instead.

Skeleton (fill it from the story; leave out what did not change):
{"kind":"turn","schemaVersion":3,"campaignId":"${state.campaignId}","turn":${n},"parentTurn":${state.turn},"seal":"${sealOf(state)}","changes":{
 "date":"YYYY-MM-DD","title":"…","briefing":"…",
 "player":{"locationId":"…","mode":"court","health":"well"},
 "reports":[{"id":"t${n}-1","from_id":"…","place":"…","dated":"…","arrives":"…","via":"courier","source":"…","category":"…","title":"…","text":"…","claim":"invention","re":["T${state.turn}-1"]}],
 "decision":{"id":"…","title":"…","options":[{"id":"…","by":"…","title":"…","objective":"…","reasoning":"…","risks":"…"}]},
 "world":{"tempo":"winter quarters","weather":{"YYYY-MM-DD":"overcast"},"scene":{"vienna":["recruiting"]}},
 "gazette":[{"date":"YYYY-MM-DD","items":[{"head":"…","text":"…"}]}],
 "household":{"purse":"what his steward would say of his money, in a sentence"},
 "whereabouts":[{"date":"…","place":"vienna","who":["…","…"],"doing":"…"}],
 "cast":[{"id":"…","place":"…"}],
 "remarks":["…"],
 "ledger":[{"date":"…","turn":${n},"text":"cause → effect"}],
 "hidden":{"chronicle":"…","decisions":[{"who":"…","knows":"…","wants":"…","decides":"…"}],"fortune_used":[{"roll":0,"for":"…","outcome":"…"}],"canon":["…"],"dispatches":[{"to":"…","via":"…","sent":"…","arrives":"…","gist":"…"}],"threads":[{"id":"…","status":"building","next_check":"…","note":"…"}],"standing":{"…":"cool"},"memory":{"…":["…"]}}
}}`;
}
export function buildPacket({ state, contract, orders, almanac, fortune, wake, trust, choices, endRequested, purse }) {
  const th = (state.hidden || {}).threads || [], date = state.date, act = activePlots(almanac || {}, th, date), byId = new Map(th.map(t => [t.id, t]));
  const shown = th.filter(t => !['resolved', 'abandoned'].includes(t.status) && (liveThread(t) || dueThread(t, date))), rest = th.length - shown.length;
  const index = shown.map(t => '- ' + t.id + ' · ' + (t.title || '') + ' · ' + (t.status || 'dormant') + (t.next_check ? ' · check ' + t.next_check : '') + (t.note ? ' · ' + t.note : '')).join('\n')
    + (rest ? (shown.length ? '\n' : '') + '(' + rest + ' other threads are dormant and not due for a check within 30 days, or closed; the page keeps them. Wake one by giving its id with a new status.)' : '');
  const soon = addDays(date, 120), cal = ((almanac || {}).calendar || []).filter(c => c.d >= date && c.d <= soon).map(c => '- ' + c.d + ': ' + c.e + ' (' + c.c + ')').join('\n');
  const tr = Object.entries(trust || {}), trusts = tr.filter(([, v]) => v === 'trust').map(([k]) => k), doubts = tr.filter(([, v]) => v === 'doubt').map(([k]) => k);
  return '# CABINET OF WAR — turn ' + state.turn + ' → ' + (state.turn + 1) + '\n\nAct as a historian and impartial adjudicator. This packet is self-contained: the current state, his orders, this turn\'s fortune and the parts of the almanac now in play.\n\n'
    + contract.trim()
    + '\n\n## When to wake him\n' + (wake || 'When there is news he must decide on.')
    + (endRequested ? '\n\n## He ends his service\nHe asks to end his service here. End the campaign this turn: set "ended" and write the epilogue.' : '')
    + '\n\n' + orders.trim()
    + '\n\n## His judgement of sources\nTrusts: ' + (trusts.join('; ') || '(none marked)') + '\nDoubts: ' + (doubts.join('; ') || '(none marked)')
    + '\n\n## Urgent letters he answered this turn\n' + ((choices || []).map(c => '- On “' + c.title + '” (' + c.id + '): he chose “' + c.label + '”' + (c.byDefault ? ' (the day passed without his answer; the default applied)' : '') + '.').join('\n') || '(none)')
    + '\n\n## His own purse\n' + (purse && purse.length ? 'Orders he pays for himself: ' + purse.join(' | ') : '(nothing from his own purse this turn)')
    + (volumeDue(state) ? '\n\n## A volume closes\nThis is turn ' + (state.turn + 1) + '. Add one entry to hidden.volumes: {"n": ' + ((state.turn + 1) / 10) + ', "turns": "' + (state.turn - 8) + '–' + (state.turn + 1) + '", "title", "text"} — these ten turns in at most 200 words. Then begin hidden.chronicle again from the end of this volume.' : '')
    + '\n\n## The seal\nThis packet\'s seal is ' + sealOf(state) + '. Copy it into the reply as "seal".' + ((state.record || {}).ironman ? ' The record is sealed (ironman): this turn cannot be replayed.' : '')
    + '\n\n## Fortune for this turn\n' + (fortune || []).join(', ') + '\nUse in order for genuinely uncertain outcomes; low is bad for him and his side, high is good. Record each one you use in hidden.fortune_used; rolls left over are simply unused.'
    + '\n\n## Almanac: systems and stakes\n' + ((almanac || {}).systems || []).map(s => '- ' + s.name + ': ' + s.summary).join('\n') + '\n' + ((almanac || {}).stakes || []).map(s => '- If ' + s.what.toLowerCase() + ': ' + s.consequence).join('\n')
    + (cal ? '\n\n## Almanac: calendar anchors in the next four months (reference, not script)\n' + cal : '')
    + '\n\n## Threads (hidden.threads)\n' + (index || '(none)')
    + '\n\n## Almanac entries for threads now in play\nProvisional causal models, not facts or schedules (sources and verification notes are in the almanac file).\n' + (act.length ? JSON.stringify(act.map(p => compactPlot(p, !byId.has(p.id) || liveThread(byId.get(p.id))))) : '(none)')
    + '\n\n' + replyFormat(state)
    + '\n\n## Current state (JSON)\nNote: the hidden field is not secret from anyone who can read this packet.\n' + JSON.stringify(liveState(state)) + '\n';
}
export function correctionRequest(issues, turn) {
  return 'Your reply for turn ' + turn + ' contradicts the established campaign:\n' + issues.map(i => '- ' + (i.text || i)).join('\n') + '\nPlease send the corrected turn reply again — the same format (kind "turn", schemaVersion 3, only what changed this turn), complete for this turn, with these points fixed. Keep hidden.canon append-only.';
}
export function resendRequest(turn) {
  return 'Your reply for turn ' + turn + ' was cut off before it ended, so the page could not read it. Please send the whole turn reply again as ONE JSON object, shorter: keep letters brief and leave out anything that did not change.';
}

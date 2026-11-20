import { TROOPS, normalizeUnit } from './march.js';
/* The turn: what goes to Claude and how its reply comes back. Pure functions (no DOM), so tests/ can run them in node.
   A reply carries only what changed (schema 3); mergeTurn applies it to the state by the rules in REPLY_RULES. */

import { cleanGround, GROUNDS, GROUND_KINDS, VILLAGE_SIZES, FIELD } from './groundspec.js';

export const REPLY_SCHEMA = 3;
// reference the adjudicator does not need to see or return every turn (kept in the page and the campaign file)
export const STATIC_KEYS = ['labels', 'routes', 'routesNote', 'sources', 'sourcesAppendix', 'regionLabels', 'movementsNote', 'annotations', 'openingVersion'];
// the player’s own: a reply cannot change them
export const PLAYER_KEYS = ['trust', 'legacy', 'campaignId', 'record', 'span'];
// lists merged by id: give only new or changed items (with only the changed fields); {"id": x, "_remove": true} removes one
export const BY_ID = ['cast', 'locations', 'forces', 'fortresses', 'movements', 'hidden.threads', 'battleDemo.units', 'battleDemo.options'];
// lists that only grow: give only the new entries
export const APPEND = ['ledger', 'hidden.canon', 'hidden.dispatches', 'hidden.volumes'];
const appendPath = p => APPEND.includes(p) || p.startsWith('hidden.memory.');
// per-turn things: when a reply leaves them out, they are cleared rather than carried into the next turn
const PER_TURN_LISTS = ['reports', 'overheard', 'whereabouts', 'gazette'], PER_TURN_HIDDEN = ['decisions', 'fortune_used'], PER_TURN_NULL = ['decision', 'scene'];
export const WEATHER = ['clear', 'haze', 'overcast', 'mist', 'frost', 'rain', 'thaw', 'snow', 'storm', 'thunder'];
export const SIGHTS = ['alarm', 'idle_soldiers', 'bread_queue', 'empty_market', 'recruiting', 'wagons_in', 'wounded', 'prisoners', 'celebration', 'smoke'];
export const THREAD_STATUS = ['dormant', 'building', 'triggered', 'resolved', 'abandoned'];
export const TEMPERS = ['rash', 'bold', 'steady', 'cautious', 'timid'];
export const TEMPO = ['winter quarters', 'campaigning', 'truce'];
export const LOSSES = ['light', 'heavy', 'destroyed'];
export const UNIT_TYPES = ['inf', 'cav', 'art'];
// battle grounds: the library ids and the kinds the page lays out (w3d/groundspec.js)
export { GROUNDS, GROUND_KINDS };
// a battle account, phase by phase (battleDemo.phases): how each formation stood, and the arrows of the moves
export const PHASE_FORMS = ['line', 'column', 'firing', 'routing', 'camp'];
export const ARROW_KINDS = ['move', 'charge', 'retreat', 'fire'];
// a fingerprint for the sealed record (not cryptographic: it shows tampering and stale replies, it does not stop a determined editor)
export function fingerprint(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}
// a scene's lines with names: the player as "You", narration with no speaker, others by the cast or the scene's participants
export const sceneLines = (scene, cast) => (scene.lines || []).map(l => ({ who: l.who === 'player' || l.who === 'You' ? 'You' : l.who === 'Narration' ? '' : (((cast || []).find(c => c.id === l.who) || (scene.participants || []).find(x => x.id === l.who) || {}).name || l.who), text: l.text }));
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
  // a battle with a new id is a new field: nothing of the old one (units, courses, aftermath, ground) carries over
  if (isObj(ch.battleDemo) && ch.battleDemo.id && next.battleDemo && ch.battleDemo.id !== next.battleDemo.id) next.battleDemo = {};
  mergeInto(next, ch, '', notes);
  for (const k of PER_TURN_LISTS) if (!(k in ch)) next[k] = [];
  for (const k of PER_TURN_NULL) if (!(k in ch)) next[k] = null;
  next.hidden = next.hidden || {};
  for (const k of PER_TURN_HIDDEN) if (!(isObj(ch.hidden) && k in ch.hidden)) next.hidden[k] = [];
  if (next.world) for (const k of ['weather', 'sights', 'scene']) if (!(isObj(ch.world) && k in ch.world)) delete next.world[k]; // world.scene: the old name of sights
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
  if (w && w.scene !== undefined) { if (w.sights === undefined) w.sights = w.scene; delete w.scene; fixes.push('world.scene is now called world.sights; it was read as sights.'); }
  if (w && isObj(w.sights)) for (const [place, tags] of Object.entries(w.sights)) { if (!Array.isArray(tags)) { delete w.sights[place]; continue; }
    const bad = tags.filter(t => !SIGHTS.includes(t)); if (bad.length) { fixes.push('Unknown sights at ' + place + ' were left out: ' + bad.join(', ') + '.'); w.sights[place] = tags.filter(t => SIGHTS.includes(t)); } }
  // an audience: the format gives its shape; the page also keeps a revision and needs lists it can walk
  if (ch.scene != null && !isObj(ch.scene)) { fixes.push('The scene was not an object and was left out.'); delete ch.scene; }
  if (isObj(ch.scene)) { const sc = ch.scene;
    for (const k of ['lines', 'commitments', 'participants']) if (!Array.isArray(sc[k])) sc[k] = [];
    if (typeof sc.revision !== 'number') sc.revision = 1;
    // the day of the meeting: it arrives in the post that day
    if (sc.date == null) sc.date = ch.date || prev.date;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(sc.date)) { fixes.push('The scene\'s date "' + sc.date + '" was not a date; it is put on the last day of the turn.'); sc.date = ch.date || prev.date; }
    else if (sc.date < prev.date || (ch.date && sc.date > ch.date)) { const d = sc.date < prev.date ? prev.date : ch.date; fixes.push('The scene was dated ' + sc.date + ', outside this turn; it is put on ' + d + '.'); sc.date = d; }
    if (!sc.lines.length) warns.push('The scene "' + (sc.title || sc.id || '') + '" has no lines.'); }
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
  if (ch.reports.some(r => r && r.battle) && !isObj(ch.battleDemo)) warns.push('A letter is marked as a battle account, but battleDemo was not set for that battle; the ground the player sees will be the old one.');
  // movements are drawn on his map: a line needs two points; side and status pick its colour and dash
  if (Array.isArray(ch.movements)) ch.movements = ch.movements.filter(m => { if (!isObj(m) || !m.id) return false; if (m._remove) return true;
    const known = ((prev.movements || []).find(x => x.id === m.id)), pts = m.pts || (known && known.pts);
    if (!Array.isArray(pts) || pts.length < 2 || pts.some(p => !Array.isArray(p) || p.length < 2 || !isFinite(p[0]) || !isFinite(p[1]))) { fixes.push('Movement ' + m.id + ' was left off the map: it needs "pts" of at least two [lat, lon] points.'); return false; }
    if (m.status && !['confirmed', 'reported', 'rumour'].includes(m.status)) { fixes.push('Movement ' + m.id + ': status "' + m.status + '" read as "reported".'); m.status = 'reported'; }
    if (!known) { m.status = m.status || 'reported'; m.reported = m.reported || date; m.label = m.label || m.id; m.source = m.source || 'unattributed'; }
    return true; });
  const route = ch.player && ch.player.route;
  if (Array.isArray(route)) ch.player.route = route.filter((s, i) => { const ok = isObj(s) && typeof s.date === 'string' && s.date >= prev.date && s.date <= date && (s.place === 'road' || locIds.has(s.place));
    if (!ok) fixes.push('Stage ' + (i + 1) + ' of the player’s route was left out (it needs a date within the turn and a location id or "road").'); return ok; });
  // in bed: the days he keeps to it ({from, to?} within or after the turn's start); health stays the word for how he is
  const ab = ch.player && ch.player.abed;
  if (ab != null) { const iso = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (!isObj(ab) || !iso(ab.from) || (ab.to != null && (!iso(ab.to) || ab.to < ab.from))) { fixes.push('player.abed needs {"from": a date, "to": a later date or none}; it was left out.'); delete ch.player.abed; }
    else { if (ab.from < prev.date) ab.from = prev.date; if (ab.to === undefined && !['ill', 'gravely ill'].includes(ch.player.health || prev.player.health)) warns.push('player.abed has no end, but the player is not ill: they leave their bed at once. Give "to", or health "ill".'); } }
  if (isObj(ch.battleDemo)) checkBattle(prev.battleDemo, ch.battleDemo, warns, fixes);
  const en = ch.battleDemo && ch.battleDemo.enemy; if (en && en.temper && !TEMPERS.includes(en.temper)) { fixes.push('Unknown enemy temper "' + en.temper + '" read as steady.'); en.temper = 'steady'; }
  for (const k of PLAYER_KEYS) if (k in ch && k !== 'campaignId') fixes.push('A change to ' + k + ' was ignored: it is yours to set.');
  if (ch.ended && !ch.epilogue) warns.push('The campaign ends but the reply has no epilogue.');
  if (ctx.seal) { if (reply.seal && reply.seal !== ctx.seal) errors.push('This reply was written for a different packet (its seal ' + reply.seal + ' is not this turn’s ' + ctx.seal + '). Paste the reply to the latest packet.'); else if (!reply.seal) warns.push('The reply does not carry this turn’s seal.'); }
  if (ctx.volumeDue && !(Array.isArray(h.volumes) && h.volumes.length)) warns.push('A volume of the chronicle was due this turn (hidden.volumes).');
  if (w && w.tempo && !TEMPO.includes(w.tempo)) { fixes.push('Unknown tempo "' + w.tempo + '" was left out.'); delete w.tempo; }
  // a place's own tempo: a location, or a fortress by its place (f-glogau → glogau)
  if (w && w.tempoAt != null) { const places = new Set([...locIds, ...(prev.fortresses || []).map(f => f && String(f.id).replace(/^f-/, ''))]);
    if (!isObj(w.tempoAt)) { fixes.push('world.tempoAt must be {place id: tempo}; it was left out.'); delete w.tempoAt; }
    else for (const [k, v] of Object.entries(w.tempoAt)) if (v !== null && (!TEMPO.includes(v) || !places.has(k))) { fixes.push('world.tempoAt "' + k + '": "' + v + '" was left out (' + (places.has(k) ? 'unknown tempo' : 'not a location or fortress on the map') + ').'); delete w.tempoAt[k]; } }
  if (Array.isArray(ch.gazette)) ch.gazette = ch.gazette.filter((g, i) => { if (!isObj(g) || !g.date || !Array.isArray(g.items) || !g.items.length) { fixes.push('Gazette issue ' + (i + 1) + ' had no date or items and was left out.'); return false; } g.id = g.id || 'gz-' + g.date; if (g.date < prev.date) g.date = prev.date; if (g.date > ch.date) g.date = ch.date; return true; });
  // the phases of an account: times, formations by id, losses, arrows; what cannot be drawn is left out with a fix
  const phs = ch.battleDemo && ch.battleDemo.phases;
  if (phs != null) {
    if (!Array.isArray(phs)) { fixes.push('battleDemo.phases must be a list; it was left out.'); delete ch.battleDemo.phases; }
    else {
      const ids = new Set([...((prev.battleDemo || {}).units || []), ...(Array.isArray(ch.battleDemo.units) ? ch.battleDemo.units : [])].filter(isObj).map(u => u.id));
      ch.battleDemo.phases = phs.filter((ph, i) => { if (!isObj(ph) || !(ph.label || ph.t)) { fixes.push('Phase ' + (i + 1) + ' of the account had no time or label and was left out.'); return false; } return true; });
      ch.battleDemo.phases.forEach((ph, i) => {
        const where = 'phase ' + (i + 1) + (ph.label ? ' (' + ph.label + ')' : '');
        if (ph.units != null && !Array.isArray(ph.units)) { fixes.push('The units of ' + where + ' were not a list and were left out.'); ph.units = []; }
        ph.units = (ph.units || []).filter(u => {
          if (!isObj(u) || !ids.has(u.id)) { fixes.push('A unit in ' + where + ' (' + (isObj(u) ? u.id : u) + ') is not in battleDemo.units and was left out.'); return false; }
          if (u.form != null && !PHASE_FORMS.includes(u.form)) { fixes.push('Unknown formation "' + u.form + '" for ' + u.id + ' in ' + where + ' read as line.'); u.form = 'line'; }
          if (u.losses != null && !LOSSES.includes(u.losses)) { fixes.push('Unknown losses "' + u.losses + '" for ' + u.id + ' in ' + where + ' read as heavy.'); u.losses = 'heavy'; }
          return true; });
        if (ph.arrows != null) ph.arrows = (Array.isArray(ph.arrows) ? ph.arrows : []).filter(a => {
          const ok = isObj(a) && ['A', 'B'].includes(a.side) && Array.isArray(a.p) && a.p.length >= 2 && a.p.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite));
          if (!ok) { fixes.push('An arrow in ' + where + ' needs side A or B and two or more [e, n] points; it was left out.'); return false; }
          if (!ARROW_KINDS.includes(a.kind)) a.kind = 'move'; return true; });
      });
    }
  }
  if (isObj(ch.battleDemo) && ch.battleDemo.center && !('ground' in ch.battleDemo)) warns.push('battleDemo.center moved but no ground was given; the old ground is kept under the new place.');
  const af = ch.battleDemo && ch.battleDemo.aftermath; if (af && isObj(af.fallen)) for (const [id, v] of Object.entries(af.fallen)) if (!LOSSES.includes(v)) { fixes.push('Unknown losses "' + v + '" for ' + id + ' read as heavy.'); af.fallen[id] = 'heavy'; }
  return { errors, warns, fixes };
}
// a battle: a new id is a new field (its units replace the old ones whole); the ground and units are made safe to draw
function checkBattle(old, bd, warns, fixes) {
  // troop types: the six of the table (w3d/march.js) are kept as the engine's class plus a kind
  if (Array.isArray(bd.units)) for (const u of bd.units) if (isObj(u) && u.type != null) {
    if (!TROOPS[u.type]) { fixes.push('Unknown troop type "' + u.type + '" for ' + (u.id || 'a unit') + ' read as inf. Types: ' + Object.keys(TROOPS).join(', ') + '.'); u.type = 'inf'; }
    normalizeUnit(u); }
  const fresh = bd.id && (!old || bd.id !== old.id);
  if (fresh) { const miss = ['title', 'center', 'date', 'ground'].filter(k => !bd[k]); if (miss.length) warns.push('The new battle "' + bd.id + '" has no ' + miss.join(', ') + '.');
    const sides = new Set((Array.isArray(bd.units) ? bd.units : []).map(u => u && u.side)); if (!sides.has('A') || !sides.has('B')) warns.push('The new battle "' + bd.id + '" needs units for both sides (A the player’s, B the enemy); the field replaces the old one whole.'); }
  if ('ground' in bd) bd.ground = cleanGround(bd.ground, fixes, warns);
  if (Array.isArray(bd.units)) bd.units = bd.units.filter((u, i) => {
    if (!isObj(u) || typeof u.id !== 'string') { fixes.push('Unit ' + (i + 1) + ' had no id and was left out.'); return false; }
    if (u._remove) return true;
    const full = fresh || !(old && (old.units || []).some(x => x.id === u.id));
    if (full && (!['A', 'B'].includes(u.side) || !UNIT_TYPES.includes(u.type))) { fixes.push('Unit ' + u.id + ' was left out: it needs side "A" or "B" and a troop type (' + Object.keys(TROOPS).join(', ') + ').'); return false; }
    const badE = typeof u.e !== 'number' || Math.abs(u.e) > FIELD.w / 2, badN = typeof u.n !== 'number' || Math.abs(u.n) > FIELD.h / 2;
    // a new unit needs both; a unit moved by id may give one of them
    if (full ? badE || badN : ('e' in u && badE) || ('n' in u && badN)) { fixes.push('Unit ' + u.id + ' was left out: e and n must place it on the field (±' + FIELD.w / 2 + ' and ±' + FIELD.h / 2 + ' m).'); return false; }
    if (full) { if (typeof u.facing !== 'number') u.facing = u.side === 'A' ? 0 : 180; if (!u.name) u.name = u.id; }
    return true; });
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
// the packet names the weekday: the adjudicator places Masses, Council days and the Diarium by it (Gregorian, as the Habsburg lands used)
export const longDate = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const KEEP = { ledgerTurns: 3, canon: 40, canonChars: 5000, dispatches: 12, memory: 3 }; // canon is capped by size too: its entries lengthen as the story thickens
export function liveState(state) {
  const s = clone(state); for (const k of STATIC_KEYS) delete s[k];
  if (s.hidden) { delete s.hidden.world; delete s.hidden.threads; } // threads go as the index above the state
  delete s.record; delete s.span; // the seal goes above the state; the span is the page's
  // the letters he is answering go whole: they are what his orders respond to, and a fresh chat cannot remember them.
  // (Gists of 260 and 420 characters cost the adjudicator promises, figures and the wording of resolutions; whole letters add ~2–3k.)
  s.reports = (s.reports || []).map(r => ({ id: r.id, from_id: r.from_id, dated: r.dated, title: r.title, ...(r.re ? { re: r.re } : {}), text: r.text }));
  for (const k of ['gazette', 'whereabouts', 'overheard']) delete s[k];
  if (s.decision) s.decision = { id: s.decision.id, title: s.decision.title };
  if (s.scene && s.scene.status === 'closed') delete s.scene;
  const h = s.hidden || {}; delete h.decisions; delete h.fortune_used;
  const t = state.turn || 0, older = (n, all) => all > n ? ' (' + (all - n) + ' earlier entries are kept by the page)' : '';
  if (Array.isArray(s.ledger)) { const all = s.ledger.length; s.ledger = s.ledger.filter(e => !(e && e.turn) || e.turn > t - KEEP.ledgerTurns); if (s.ledger.length < all) s.ledgerNote = 'Recent entries only' + older(s.ledger.length, all) + '.'; }
  if (Array.isArray(h.canon)) { let n = 0, size = 0; for (let i = h.canon.length - 1; i >= 0 && n < KEEP.canon; i--) { size += String(h.canon[i]).length; if (size > KEEP.canonChars && n) break; n++; }
    if (n < h.canon.length) { h.canonNote = 'The latest ' + n + ' settled facts' + older(n, h.canon.length) + '; the page checks every reply against all of them.'; h.canon = h.canon.slice(-n); } }
  if (Array.isArray(h.dispatches) && h.dispatches.length > KEEP.dispatches) h.dispatches = h.dispatches.slice(-KEEP.dispatches);
  if (isObj(h.memory)) for (const k of Object.keys(h.memory)) if (Array.isArray(h.memory[k])) h.memory[k] = h.memory[k].slice(-KEEP.memory);
  const bd = s.battleDemo; // the table battle's ground, compactly: change units by id ({"id", "e", "n", "facing"}) when a battle moves them
  // the opening's Mollwitz preview is an illustration, never the live field: its units go only once a reply has made it a real battle
  const preview = bd && bd.id === 'bd-demo' && !bd.enemy && !bd.aftermath;
  const phaseIndex = bd && Array.isArray(bd.phases) && bd.phases.length ? bd.phases.map(p => (p.t ? p.t + ' ' : '') + (p.label || '')).join(' · ') : undefined;
  const battleNear = bd && !preview && (bd.enemy || bd.aftermath || [(state.world || {}).tempo, ...Object.values((state.world || {}).tempoAt || {})].includes('campaigning') || state.player.mode === 'field');
  if (preview) s.battleDemo = { id: bd.id, note: 'No battle has been fought or described yet; this is the page\'s preview field. For a battle, give battleDemo a new id with its place, date, ground and units.' };
  else if (bd && !battleNear) s.battleDemo = { id: bd.id, title: bd.title, place: bd.place, center: bd.center, date: bd.date, ground: bd.ground, phases: phaseIndex, note: 'Units and positions are sent when a battle may come (campaigning, an enemy commander named, or the player with the army).' };
  else if (bd) s.battleDemo = { id: bd.id, date: bd.date, title: bd.title, place: bd.place, center: bd.center, enemy: bd.enemy, aftermath: bd.aftermath, ground: bd.ground, phases: phaseIndex, unitsAs: 'id, side, type, e, n, facing', units: (bd.units || []).map(u => [u.id, u.side, u.kind || u.type, u.e, u.n, u.facing]) };
  return s;
}

/* ---------- the packet ---------- */
export function replyFormat(state) {
  // without a state (the rules file for a Claude Project) the values that change each turn are named, and the packet gives them
  const G = !state, n = G ? '<turn>' : state.turn + 1, t0 = G ? '<turn − 1>' : state.turn, cid = G ? '<campaignId>' : state.campaignId, seal = G ? '<seal>' : sealOf(state);
  return `## Reply format
Return ONE JSON object (a fenced json block is fine). The page reads only that object; a line or two of notes after it is ignored:
{"kind": "turn", "schemaVersion": 3, "campaignId": "${cid}", "turn": ${n}, "parentTurn": ${t0}, "seal": "${seal}", "changes": { … }}${G ? '\n(The packet gives campaignId, turn, parentTurn and seal under "Reply header".)' : ''}

"changes" holds only what changed this turn, in the same shape as the current state below. The page merges it:
- Always give: date, title, briefing, reports (this turn's letters; [] if none), hidden.chronicle, hidden.decisions, hidden.fortune_used, and hidden.canon / ledger entries for what was settled.
- Objects merge key by key. Give only the keys that changed. A key set to null is removed.
- These lists merge by id — give only new or changed items, each with its id and only the fields that changed; {"id": "…", "_remove": true} removes one: ${BY_ID.join(', ')}.
- These lists only grow — give only the new entries: ${APPEND.join(', ')}, and each list in hidden.memory.
- Every other list you give replaces the old one whole (reports, knowledge, remarks, hidden.standingOrders, refugees, decision.options …).
- Cleared unless you give them again: reports, gazette, overheard, whereabouts, decision, scene, world.weather, world.sights, hidden.decisions, hidden.fortune_used.
- Never change: ${PLAYER_KEYS.join(', ')}.
- Player-facing text holds only what the character could know. Keep ids stable.
- Optional, give only when they apply: gazette (the Diarium issues of this turn), movements (forces on the move as the player has heard of them, drawn on their map: {"id","label","side":"habsburg"|"prussia"|"bavaria"|"saxony"|"france","status":"confirmed"|"reported"|"rumour","reported":"YYYY-MM-DD","source","claim","pts":[[lat,lon],[lat,lon],…]} from where they were to where they are said to go; change one by id as news comes), weather (only the days it changes; each day keeps the last weather given), overheard, whereabouts, decision (only a real fork), scene (when the player meets someone in person — an audience, a Council they sit in, a visitor at their bed — the meeting that mattered most this turn: {"id","title","date":"YYYY-MM-DD" (the day of the meeting),"setting","participants":[{"id","name"}],"lines":[{"who","text"}]; the player’s part goes as narration (who "Narration") or in the words of their orders (who "player"),"commitments":["…"],"status":"closed"}).
- Illness: player.health says how the player is at the end of the turn. player.abed {"from","to"} gives the days the player keeps to their bed (leave out "to" if they are still abed); without it, "ill" or "gravely ill" keeps them abed the whole turn. While abed, those whereabouts put with them that day come to their bedside, with their household; anyone else is reached by a note. They cannot inspect, ride out or attend the Conference.
- A journey: give player.locationId where the player ends the turn, and player.route [{"date","place"}] (place a location id or "road") if they stop anywhere or arrive on a day other than the distance implies. Without a route they are on the road from the first day of the turn and arrives after the usual days for the distance.
- A battle account (a report with "battle": true) needs battleDemo for that battle. The same battle (same id): move or remove its units by id. A new battle takes a new id and replaces the whole field: give id, title, place, center [lat, lon], date, ground and every unit of both sides ({"id","side":"A" the player’s | "B" the enemy,"type":${Object.keys(TROOPS).map(k => '"' + k + '"').join('|')},"name","e","n","facing"}, metres east and north of center, within ±${FIELD.w / 2} and ±${FIELD.h / 2}; facing in degrees, 0 = north). For a battle outside this campaign, write an ordinary letter instead.
- battleDemo.ground is the field it is drawn on and the table battle is fought over: one of ${GROUNDS.join(', ')} (the library, real ground: no features needed), or for a field elsewhere {"kind": ${GROUND_KINDS.map(k => '"' + k + '"').join(' | ')}, "villages":[{"name","e","n","size": ${Object.keys(VILLAGE_SIZES).map(k => '"' + k + '"').join(' | ')}}], "woods":[{"name","e","n","w","d"}] (w, d its extent in metres east–west and north–south), "streams":[{"name","kind":"stream"|"river","path":[[e,n],…],"crossings":[[e,n]]}] (bridges and fords), "heights":[{"name","e","n","r","h"}] (radius and height in metres)}. The page lays that kind of country on the real relief at center; name the features the account mentions and put them where it says. Units stand in metres from center (e east, n north) on a field ${FIELD.w} m by ${FIELD.h} m. A unit's type is one of ${Object.keys(TROOPS).map(k => k + ' (' + TROOPS[k].word.toLowerCase() + ')').join(', ')}. Woods and villages slow troops and give cover; water stops them except at crossings.
- A battle account may carry battleDemo.phases, the battle as the player’s staff describe it, in order: [{"t": "07:30", "label": "…", "text": "what the staff report of this hour", "units": [{"id", "e", "n", "facing", "form": ${PHASE_FORMS.map(k => '"' + k + '"').join(' | ')}, "losses": ${LOSSES.map(k => '"' + k + '"').join(' | ')}}], "arrows": [{"side": "A" | "B", "kind": ${ARROW_KINDS.map(k => '"' + k + '"').join(' | ')}, "p": [[e, n], …]}]}]. battleDemo.units is where they stood before the first phase; a phase names only the formations that moved or changed, and losses run on from phase to phase. The packet carries only the phase index; give the whole list again when it changes. For a battle outside this campaign, write an ordinary letter instead.

Skeleton (fill it from the story; leave out what did not change):
{"kind":"turn","schemaVersion":3,"campaignId":"${cid}","turn":${n},"parentTurn":${t0},"seal":"${seal}","changes":{
 "date":"YYYY-MM-DD","title":"…","briefing":"…",
 "player":{"locationId":"…","mode":"court","health":"well"},
 "reports":[{"id":"t${n}-1","from_id":"…","place":"…","dated":"…","arrives":"…","via":"courier","source":"…","category":"…","title":"…","text":"…","claim":"invention","re":["T${t0}-1"]}],
 "decision":{"id":"…","title":"…","options":[{"id":"…","by":"…","title":"…","objective":"…","reasoning":"…","risks":"…"}]},
 "world":{"tempo":"winter quarters","tempoAt":{"glogau":"campaigning"},"weather":{"YYYY-MM-DD":"overcast"},"sights":{"vienna":["recruiting"]}},
 "gazette":[{"date":"YYYY-MM-DD","items":[{"head":"…","text":"…"}]}],
 "household":{"purse":"what the player’s steward would say of their money, in a sentence"},
 "whereabouts":[{"date":"…","place":"vienna","who":["…","…"],"doing":"…"}],
 "cast":[{"id":"…","place":"…"}],
 "remarks":["…"],
 "ledger":[{"date":"…","turn":${n},"text":"cause → effect"}],
 "hidden":{"chronicle":"…","decisions":[{"who":"…","knows":"…","wants":"…","decides":"…"}],"fortune_used":[{"roll":0,"for":"…","outcome":"…"}],"canon":["…"],"dispatches":[{"to":"…","via":"…","sent":"…","arrives":"…","gist":"…"}],"threads":[{"id":"…","status":"building","next_check":"…","note":"…"}],"standing":{"…":"cool"},"memory":{"…":["…"]}}
}}`;
}
// the people, places and fortresses as tables: one line a record, the fields named once. JSON records repeat every key,
// which made these three lists a quarter of the state. They change by id in the reply exactly as before.
export const TABLES = { cast: ['id', 'name', 'office', 'place', 'claim', 'dead', 'invented', 'agenda', 'voice', 'note'], locations: ['id', 'name', 'lat', 'lon', 'kind', 'report'], fortresses: ['id', 'name', 'kind', 'lat', 'lon', 'garrison', 'note', 'claim'] };
const cell = v => v == null || v === false ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v).replace(/\s*\|\s*/g, ' / ').replace(/\n/g, ' ');
export function tableOf(rows, keys) {
  const extra = [...new Set((rows || []).flatMap(r => Object.keys(r || {})).filter(k => !keys.includes(k) && k !== 'lab'))], all = [...keys, ...extra];
  const used = all.filter(k => (rows || []).some(r => r && r[k] != null && r[k] !== false && r[k] !== ''));
  return used.join(' | ') + '\n' + (rows || []).filter(isObj).map(r => used.map(k => cell(r[k])).join(' | ').replace(/( \| )+$/, '')).join('\n');
}
/* ---------- the rules for a Claude Project: what does not change from turn to turn, in one versioned file ---------- */
const systemsText = almanac => ((almanac || {}).systems || []).map(s => '- ' + s.name + ': ' + s.summary).join('\n') + '\n' + ((almanac || {}).stakes || []).map(s => '- If ' + s.what.toLowerCase() + ': ' + s.consequence).join('\n');
export const rulesVersion = ({ contract, almanac }) => fingerprint(contract.trim() + replyFormat(null) + systemsText(almanac)).slice(0, 8);
export const rulesFileName = v => 'cabinet-of-war-rules-' + v + '.md';
export function rulesText({ contract, almanac }) {
  const v = rulesVersion({ contract, almanac });
  return '# CABINET OF WAR — the rules (version ' + v + ')\n\nThe standing rules of the campaign: how to adjudicate, how the world reaches the player, the reply format, and the almanac\'s systems and stakes. Each turn\'s packet carries the rest (the state, the player’s orders, the fortune, the threads and almanac entries in play) and names the rules version it expects.\n\n'
    + contract.trim() + '\n\n' + replyFormat(null) + '\n\n## Almanac: systems and stakes\n' + systemsText(almanac) + '\n';
}
export function buildPacket({ state, contract, orders, almanac, fortune, wake, trust, choices, endRequested, purse, waiting, rulesInProject }) {
  const th = (state.hidden || {}).threads || [], date = state.date, act = activePlots(almanac || {}, th, date), byId = new Map(th.map(t => [t.id, t]));
  const shown = th.filter(t => !['resolved', 'abandoned'].includes(t.status) && (liveThread(t) || dueThread(t, date))), rest = th.length - shown.length;
  const index = shown.map(t => '- ' + t.id + ' · ' + (t.title || '') + ' · ' + (t.status || 'dormant') + (t.next_check ? ' · check ' + t.next_check : '') + (t.note ? ' · ' + t.note : '')).join('\n')
    + (rest ? (shown.length ? '\n' : '') + '(' + rest + ' other threads are dormant and not due for a check within 30 days, or closed; the page keeps them. Wake one by giving its id with a new status; use these ids rather than starting a new thread on the same matter: ' + th.filter(t => !shown.includes(t)).map(t => t.id).join(', ') + '.)' : '');
  const soon = addDays(date, 120), cal = ((almanac || {}).calendar || []).filter(c => c.d >= date && c.d <= soon).map(c => '- ' + c.d + ': ' + c.e + ' (' + c.c + ')').join('\n');
  const tr = Object.entries(trust || {}), trusts = tr.filter(([, v]) => v === 'trust').map(([k]) => k), doubts = tr.filter(([, v]) => v === 'doubt').map(([k]) => k);
  const P = !!rulesInProject, rv = P ? rulesVersion({ contract, almanac }) : '';
  return '# CABINET OF WAR — turn ' + state.turn + ' → ' + (state.turn + 1) + ' · ' + longDate(state.date) + '\n\nAct as a historian and impartial adjudicator. '
    + (P ? 'The rules are in this project\'s knowledge: the file ' + rulesFileName(rv) + ' (rules version ' + rv + '). Follow them. If the project has no rules file of version ' + rv + ', do not adjudicate: tell the player to download the current rules (Notebook → The record) and add them to the project. This packet carries the rest: the current state, the player’s orders, this turn\'s fortune and the parts of the almanac now in play.'
      : 'This packet is self-contained: the current state, the player’s orders, this turn\'s fortune and the parts of the almanac now in play.\n\n' + contract.trim())
    + '\n\n## When to wake the player\n' + (wake || 'When there is news the player must decide on.')
    + (endRequested ? '\n\n## The player ends their service\nThe player asks to end their service here. End the campaign this turn: set "ended" and write the epilogue.' : '')
    + '\n\n' + orders.trim()
    + '\n\n## The player’s judgement of sources\nTrusts: ' + (trusts.join('; ') || '(none marked)') + '\nDoubts: ' + (doubts.join('; ') || '(none marked)')
    + ((waiting || []).length ? '\n\n## Earlier orders with no answer yet\nA letter that answers one of these carries its reference in "re" like this turn\'s.\n' + waiting.map(o => '- [' + o.ref + '] ' + (o.line.length > 200 ? o.line.slice(0, 200) + ' …' : o.line)).join('\n') : '')
    + '\n\n## Urgent letters the player answered this turn\n' + ((choices || []).map(c => '- On “' + c.title + '” (' + c.id + '): the player chose “' + c.label + '”' + (c.byDefault ? ' (the day passed without their answer; the default applied)' : '') + '.').join('\n') || '(none)')
    + '\n\n## The player’s own purse\n' + (purse && purse.length ? 'Orders the player pays for themselves: ' + purse.join(' | ') : '(nothing from the player’s own purse this turn)')
    + (volumeDue(state) ? '\n\n## A volume closes\nThis reply makes turn ' + (state.turn + 1) + '. Add one entry to hidden.volumes: {"n": ' + ((state.turn + 1) / 10) + ', "turns": "' + (state.turn - 8) + '–' + (state.turn + 1) + '", "title", "text"} — these ten turns, this reply\'s events included, in at most 200 words. Then write hidden.chronicle afresh as the opening of the next volume: how things stand now, who wants what, what is unresolved.' : '')
    + '\n\n## The seal\nThis packet\'s seal is ' + sealOf(state) + '. Copy it into the reply as "seal".' + ((state.record || {}).ironman ? ' The record is sealed (ironman): this turn cannot be replayed.' : '')
    + '\n\n## Fortune for this turn\n' + (fortune || []).join(', ') + '\nUse in order for genuinely uncertain outcomes; low is bad for the player and their side, high is good. Record each one you use in hidden.fortune_used; rolls left over are simply unused.'
    + (P ? '' : '\n\n## Almanac: systems and stakes\n' + systemsText(almanac))
    + (cal ? '\n\n## Almanac: calendar anchors in the next four months (reference, not script)\n' + cal : '')
    + '\n\n## Threads (hidden.threads)\n' + (index || '(none)')
    + '\n\n## Almanac entries for threads now in play\nProvisional causal models, not facts or schedules (sources and verification notes are in the almanac file).\n' + (act.length ? JSON.stringify(act.map(p => compactPlot(p, !byId.has(p.id) || liveThread(byId.get(p.id))))) : '(none)')
    + '\n\n' + (P ? '## Reply header\nThe reply format is in the rules. This turn\'s reply begins: {"kind": "turn", "schemaVersion": 3, "campaignId": "' + state.campaignId + '", "turn": ' + (state.turn + 1) + ', "parentTurn": ' + state.turn + ', "seal": "' + sealOf(state) + '", "changes": { … }}; its first letter is "t' + (state.turn + 1) + '-1", and its answers cite this turn\'s orders as "T' + state.turn + '-1" and so on.' : replyFormat(state))
    + '\n\n## People, places and fortresses\nThe state\'s "cast", "locations" and "fortresses", one record a line under its field names (true shows as the word). Change them by id in "changes" as JSON records, as the reply format says.\n'
    + Object.entries(TABLES).map(([k, keys]) => '### ' + k + '\n' + tableOf(state[k], keys)).join('\n')
    + '\n\n## Current state (JSON)\nNote: the hidden field is not secret from anyone who can read this packet. cast, locations and fortresses are in the tables above.\n' + JSON.stringify(withoutTables(liveState(state))) + '\n';
}
const withoutTables = s => { for (const k of Object.keys(TABLES)) delete s[k]; return s; };
export function correctionRequest(issues, turn) {
  return 'Your reply for turn ' + turn + ' contradicts the established campaign:\n' + issues.map(i => '- ' + (i.text || i)).join('\n') + '\nPlease send the corrected turn reply again — the same format (kind "turn", schemaVersion 3, only what changed this turn), complete for this turn, with these points fixed. Keep hidden.canon append-only.';
}
export function resendRequest(turn) {
  return 'Your reply for turn ' + turn + ' was cut off before it ended, so the page could not read it. Please send the whole turn reply again as ONE JSON object, shorter: keep letters brief and leave out anything that did not change.';
}

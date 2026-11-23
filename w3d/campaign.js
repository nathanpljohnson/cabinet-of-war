/* The campaign's keeper: builds the packet for Claude, reads its reply, keeps the saves safe and the book of the campaign.
   The rules live in turn.js (pure) and contract.md (what Claude is told); this file joins them to the desk's page. */
import { checkSkeleton, courierErrand, isBattleNear, buildPacket, rulesText, rulesVersion, rulesFileName, parseReply, checkReply, mergeTurn, applyBranch, rollFortune, seedThreads, correctionRequest, resendRequest, TEMPERS, fingerprint, sealOf, nextLink, volumeDue, sceneLines, pendingOrders, exchangeRecord } from './turn.js';
import { checkContinuity } from './continuity.js';

const P = 'cabinet-of-war:', HIGH_KEY = P + 'w3d-highwater', BOOK_KEY = P + 'w3d-book', CHOICE_KEY = P + 'w3d-choices', SENT_KEY = P + 'w3d-sent', AUTO_KEY = P + 'w3d-autosave', RULES_KEY = P + 'w3d-rules-in-project', COURIER_KEY = P + 'w3d-courier-route', SEALED_KEY = P + 'w3d-sealed';
const $ = id => document.getElementById(id);
const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let contract = '', almanac = {}, toast = () => {}, onChange = () => {};

export async function initCampaign(opts) {
  toast = opts.toast; onChange = opts.onChange || onChange;
  const [c, a] = await Promise.all([fetch('w3d/contract.md', { cache: 'no-store' }).then(r => r.text()), fetch('w3d/almanac.json', { cache: 'no-store' }).then(r => r.json())]);
  contract = c; almanac = a;
  migrate(); guardStorage(); installReview(); installAccept(); installRecord(); installTemper();
  window.__campaign = { packet, almanac: () => almanac, aftermathOfTable, seal: () => sealOf(state), courier: courierMode, lookForCourier, turnPath };
  installCourier();
}

/* ---------- older saves: the almanac leaves the state; threads, trust and the chronicle arrive ---------- */
function migrate() {
  const h = state.hidden = state.hidden || {}; let ch = false;
  if (h.world) { delete h.world; ch = true; }
  if (!Array.isArray(h.threads)) { h.threads = seedThreads(almanac, state.date); ch = true; }
  if (!state.trust) { state.trust = {}; ch = true; }
  if (!state.record) { state.record = { chain: [], ironman: false }; ch = true; }
  // each campaign its own dice: the same turn still rolls the same, so sealing again changes nothing
  if (!state.record.salt) { state.record.salt = Math.floor(Math.random() * 2 ** 32).toString(16).padStart(8, '0'); ch = true; }
  if (!state.exchange) {
    // Recover promises from the existing book as well as the current meeting.
    let exchange = {};
    for (const entry of store(BOOK_KEY, [])) if (entry.audience) exchange = exchangeRecord({ exchange, date: entry.date, scene: { ...entry.audience, id: 'book-' + entry.turn } });
    state.exchange = exchange;
  }
  const exchange = exchangeRecord(state, store(SENT_KEY, []), Object.values(store(P + 'w3d-archive', {})));
  if (JSON.stringify(exchange) !== JSON.stringify(state.exchange)) { state.exchange = exchange; ch = true; }
  markHigh();
  if (ch) persistState();
}

/* ---------- the packet ---------- */
const sentOrders = () => [...((state.exchange || {}).orders || []).map(o => o.ref), ...store(SENT_KEY, []).flatMap(s => (s.orders || []).filter(o => o && o.ref).map(o => o.ref))];
const choicesNow = () => store(CHOICE_KEY, []).filter(c => c.turn === state.turn);
// Include the archive when migrating an older save; durable orders then live in the campaign state.
const waiting = () => pendingOrders(state, store(SENT_KEY, []).filter(s => s.turn < state.turn), Object.values(store(P + 'w3d-archive', {})));
// what the player decided, with ids a letter can cite in "follows": courses taken in council, answers given at once, promises made in person
export function earlierDecisions() {
  const out = [], add = (id, date, label) => out.push({ id, date, label, text: label.replace(/^./, c => c.toUpperCase()) + ' (' + date + ')' });
  for (const e of store(BOOK_KEY, []).filter(e => e.turn < state.turn).slice(-8)) {
    if (e.course) add('C' + e.turn, e.date, 'the course you adopted in council: ' + e.course);
    (e.choices || []).forEach((c, i) => add('U' + e.turn + '-' + (i + 1), e.date, 'your answer at once on ' + c)); }
  const o = state.decision && typeof draft !== 'undefined' && (state.decision.options || []).find(x => x.id === draft.option);
  if (o) add('C' + state.turn, state.date, 'the course you adopted in council: ' + o.title);
  choicesNow().forEach((c, i) => add('U' + state.turn + '-' + (i + 1), state.date, 'your answer at once on ' + c.title + ': ' + c.label));
  const cm = exchangeRecord(state).commitments; // the meeting in hand included, in the order the record keeps them
  cm.forEach((c, i) => { if (i >= cm.length - 8) add('M' + (i + 1), c.date, 'what was undertaken in person: ' + c.text); });
  return out;
}
export const fortune = () => rollFortune(state.campaignId, state.turn, 8, (state.record || {}).salt || '');
async function packet(orders) {
  const w = draft.w3d || {}, note = (w.gameNote || '').trim(), dispatch = fingerprint(state.campaignId + ':' + state.turn + ':' + sealOf(state) + ':' + orders + ':' + note).slice(0, 10), repo = courierMode() === 'repo';
  keep(SEALED_KEY, { turn: state.turn, dispatch, at: new Date().toISOString(), ...(note ? { note } : {}) }); // what the next turn must answer
  if (repo) setTimeout(lookForCourier, 30000);
  const packetState = { ...state, exchange: exchangeRecord(state, store(SENT_KEY, []), Object.values(store(P + 'w3d-archive', {}))) };
  const pk = buildPacket({ state: packetState, contract, orders, almanac, fortune: fortune(), wake: w.wake, trust: state.trust, choices: choicesNow(), waiting: waiting(), endRequested: !!w.end, rulesInProject: store(RULES_KEY, false), earlier: earlierDecisions(), purse: (w.items || []).filter(i => i.purse).map(i => i.text), courier: repo ? 'repo' : null, dispatch, note });
  if (!repo) return pk;
  const check = { orderRefs: sentOrders(), followIds: earlierDecisions().map(d => d.id), fortune: fortune(), seal: sealOf(state), volumeDue: volumeDue(state), dispatch, ...(note ? { gameNote: true } : {}), prev: checkSkeleton(state) };
  return courierErrand({ repo: repoName(), path: turnPath(), dispatch, turn: state.turn + 1, version: rulesVersion({ contract, almanac }), battle: isBattleNear(state), note: !!note }) + '\n\n' + pk + '\n<!-- check: ' + JSON.stringify(check) + ' -->\n';
}

/* ---------- the courier: a coding agent (Claude Code, Codex) adjudicates in the repository and pushes the turn; the page fetches it ---------- */
const courierMode = () => { const m = store(COURIER_KEY, 'repo'); return m === 'hand' ? 'hand' : 'repo'; };
const safeId = id => String(id).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
export const turnPath = (turn = state.turn + 1) => 'turns/' + safeId(state.campaignId) + '/turn-' + String(turn).padStart(3, '0') + '.json';
// the repository the page is served from (owner.github.io/name), so the errand names the right one
function repoName() { const h = location.hostname.match(/^([^.]+)\.github\.io$/), first = location.pathname.split('/').filter(Boolean)[0]; return h && first ? h[1] + '/' + first : 'nathanpljohnson/cabinet-of-war'; }
let looking = false;
// the courier comes back by the repository: fetch the next turn's file; apply it at once if it passes every check, else show the review
export async function lookForCourier(manual) {
  if (looking || (!manual && courierMode() !== 'repo')) return; looking = true;
  try {
    if ($('confirm') && $('confirm').open) return;
    let res = null; try { res = await fetch(turnPath() + '?t=' + Date.now(), { cache: 'no-store' }); } catch { }
    if (!res || !res.ok) { if (manual) toast('No courier yet: ' + turnPath() + ' is not in the repository. A push takes about a minute to reach the game.'); return; }
    const text = await res.text(), key = P + 'w3d-courier-seen:' + fingerprint(text);
    if (!manual) { try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { } }
    const out = window.reviewWorld(text);
    if (out && out.clean) { $('accept').click(); toast('The courier is in. Turn ' + state.turn + ' — ' + (state.title || '') + '.'); }
  } finally { looking = false; }
}
function installCourier() {
  const awaiting = () => { const s = store(SEALED_KEY, null); return courierMode() === 'repo' && s && s.turn === state.turn; };
  if (awaiting()) setTimeout(lookForCourier, 1500);
  setInterval(() => { if (awaiting() && document.visibilityState === 'visible') lookForCourier(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && awaiting()) lookForCourier(); });
}

/* ---------- reading the reply ---------- */
function installReview() {
  const legacy = window.reviewWorld;
  window.reviewWorld = text => {
    candidate = null; pending = null; // a rejected reply must never leave an earlier candidate available
    const field = $('world-in'); if (field) { field.value = text; draft.incomingReply = text; saveDraft(); }
    const p = parseReply(text);
    if (p.error) return show({ title: p.truncated ? 'The reply was cut off' : 'The reply could not be read', errors: [p.error], request: p.truncated ? resendRequest(state.turn + 1) : correctionRequest([p.error], state.turn + 1), requestLabel: 'Copy a request to send it again' });
    const reply = p.value;
    if (reply.schemaVersion === 2 && reply.kind !== 'turn') { // a whole state (older replies, imported state files)
      if (state.record.ironman) return show({ title: 'The record is sealed', errors: ['A whole saved state cannot be loaded into a sealed campaign. Paste Claude’s reply to the latest packet instead.'] });
      $('confirm').querySelector('h2').textContent = 'Accept this update?'; $('accept').hidden = false; pending = { payload: reply }; legacy(text); return; }
    const sealed = (s => s && s.turn === state.turn ? s : null)(store(SEALED_KEY, null)), note = sealed && sealed.note;
    const r = checkReply(state, reply, { orderRefs: sentOrders(), followIds: earlierDecisions().map(d => d.id), dispatch: sealed ? sealed.dispatch : null, fortune: fortune(), seal: sealOf(state), volumeDue: volumeDue(state), gameNote: !!note });
    if (r.errors.length) return show({ title: 'This reply cannot be accepted', errors: r.errors, request: correctionRequest(r.errors, state.turn + 1) });
    const { next, notes } = mergeTurn(state, reply, { sent: store(SENT_KEY, []), reports: Object.values(store(P + 'w3d-archive', {})), note });
    try { validateState(next); } catch (e) { return show({ title: 'This reply cannot be accepted', errors: [e.message], request: correctionRequest([e.message], state.turn + 1) }); }
    const cont = checkContinuity(state, next), hard = cont.filter(i => i.level === 'error');
    if (fought() && next.battleDemo && !next.battleDemo.aftermath) next.battleDemo.aftermath = aftermathOfTable();
    candidate = next; pending = { payload: reply.changes };
    const clean = !hard.length && !cont.length && !r.warns.length;
    show({ title: 'Accept this turn?', summary: next, errors: hard.map(i => i.text), warns: [...cont.filter(i => i.level !== 'error').map(i => i.text), ...r.warns], fixes: [...r.fixes, ...notes], request: cont.length || r.warns.length ? correctionRequest([...cont, ...r.warns], state.turn + 1) : null, accept: true });
    return { accept: true, clean };
  };
}
// one dialog for every outcome: what the turn is, what was corrected, what may be wrong, and a way to ask Claude again
function show({ title, summary, errors = [], warns = [], fixes = [], request, requestLabel, accept }) {
  const d = $('confirm'), b = $('confirm-body'); d.querySelector('h2').id = 'cw-review-title'; d.setAttribute('aria-labelledby', 'cw-review-title'); d.querySelector('h2').textContent = title; $('accept').hidden = !accept;
  b.setAttribute('aria-live', 'polite');
  b.innerHTML = (summary ? '<p class="cw-sum">Turn ' + summary.turn + ' · ' + esc(summary.date) + ' — “' + esc(summary.title) + '”<br><small>' + summary.reports.length + ' letter' + (summary.reports.length === 1 ? '' : 's') + ' on the way. Your current state is kept as a snapshot first.</small></p>' : '')
    + list('cw-err', errors.length && accept ? 'It contradicts what is settled' : null, errors)
    + list('cw-warn', 'Worth a look', warns)
    + list('cw-fix', 'Corrected on arrival', fixes)
    + (!accept ? '<p class="hint">Your campaign, orders and pasted reply are unchanged. Correct this reply in the same chat, or close this review and seal a fresh dispatch if the campaign, turn or seal is wrong.</p>' : '');
  if (request) { const c = document.createElement('button'); c.className = 'btn'; c.textContent = requestLabel || 'Copy a correction request for Claude'; c.onclick = () => navigator.clipboard.writeText(request).then(() => toast('Copied — paste it into the same chat, then paste the new reply here.'), () => toast('Could not copy.')); b.append(c); }
  if (request) { const details = document.createElement('details'), summary = document.createElement('summary'), text = document.createElement('textarea');
    summary.textContent = 'Select and copy the correction request'; text.value = request; text.readOnly = true; text.rows = 5; text.setAttribute('aria-label', 'Correction request'); details.append(summary, text); b.append(details); }
  if (!d.open) d.showModal();
}
const list = (cls, head, items) => items.length ? '<div class="cw-list ' + cls + '">' + (head ? '<b>' + head + '</b>' : '') + items.map(t => '<p>' + esc(t) + '</p>').join('') + '</div>' : '';

/* ---------- accepting: the record takes its next link, the book the turn you lived; then the campaign file is written ---------- */
let pending = null;
function installAccept() {
  const btn = $('accept'), orig = btn.onclick;
  btn.onclick = e => {
    if (!candidate) return; const prev = state;
    if (candidate.turn === prev.turn + 1) {
      const rec = prev.record || { chain: [], ironman: false };
      candidate.record = { ...rec, chain: [...rec.chain, nextLink(prev, (pending && pending.payload) || candidate, candidate.turn, candidate.date)] };
      addToBook(prev, candidate);
    }
    pending = null;
    orig.call(btn, e);
    if (state !== prev && state.gameNote) setTimeout(() => toast('Your note on the game has an answer: Notebook → Notes on the game.'), 3500);
    if (state !== prev) { if ($('world-in')) $('world-in').value = ''; markHigh(); onChange(); if (store(AUTO_KEY, true)) setTimeout(() => saveCampaignFile(true), 600); }
  };
  $('confirm').addEventListener('cancel', () => { candidate = null; pending = null; });
  $('cancel') && $('cancel').addEventListener('click', () => { candidate = null; });
}
const fought = () => typeof BS !== 'undefined' && (BS.log.length || draft.battleResult);
function aftermathOfTable() {
  const fallen = {}, guns = [];
  for (const u of state.battleDemo.units || []) { if (!u.max) continue; const lost = 1 - Math.max(0, u.men) / u.max;
    if (lost >= .85 || u.st === 'gone') fallen[u.id] = 'destroyed'; else if (lost >= .4) fallen[u.id] = 'heavy'; else if (lost >= .12) fallen[u.id] = 'light';
    if (u.type === 'art' && (u.gunLost || u.st === 'gone')) guns.push(u.id); }
  const out = (draft.battleResult && draft.battleResult.outcome) || '';
  return { date: state.date, held_by: /victory/i.test(out) ? 'A' : /defeat/i.test(out) ? 'B' : 'A', fallen, guns_taken: guns, note: 'The ground of the table battle, as it was left.' };
}
function addToBook(prev, next) {
  const book = store(BOOK_KEY, []).filter(e => e.turn !== prev.turn), sent = store(SENT_KEY, []).find(s => s.turn === prev.turn) || {};
  const newCanon = ((next.hidden || {}).canon || []).filter(f => !((prev.hidden || {}).canon || []).includes(f));
  book.push({ turn: prev.turn, date: prev.date, to: next.date, title: prev.title, briefing: prev.briefing, at: prev.player.locationId,
    letters: (prev.reports || []).map(r => ({ from: ((prev.cast || []).find(c => c.id === r.from_id) || {}).name || r.from || '', place: r.place, dated: r.dated, title: r.title, text: r.text, battle: !!r.battle, source: r.source || '' })),
    orders: (sent.orders || []).map(o => o.line || o), own: sent.own || '', choices: choicesNow().map(c => c.title + ': ' + c.label),
    course: (() => { const o = prev.decision && typeof draft !== 'undefined' && (prev.decision.options || []).find(x => x.id === draft.option); return o ? o.title : ''; })(),
    audience: prev.scene && (prev.scene.lines || []).length ? { title: prev.scene.title, setting: prev.scene.setting, lines: sceneLines(prev.scene, prev.cast), commitments: (prev.scene.commitments || []).map(c => typeof c === 'string' ? c : c.text) } : null,
    gazette: (prev.gazette || []).flatMap(g => (g.items || []).map(i => ({ date: g.date, head: i.head, text: i.text }))), purse: (prev.household || {}).purse || '',
    secret: { chronicle: (next.hidden || {}).chronicle || '', decisions: (next.hidden || {}).decisions || [], fortune: (next.hidden || {}).fortune_used || [], canon: newCanon,
      volumes: ((next.hidden || {}).volumes || []).filter(v => !((prev.hidden || {}).volumes || []).some(x => x.n === v.n)) } });
  keep(BOOK_KEY, book);
}
export const book = () => store(BOOK_KEY, []);

/* ---------- saves: storage fills up; never fail silently ---------- */
const ours = () => Object.keys(localStorage).filter(k => k.startsWith(P));
function used() { let n = 0; for (const k of ours()) n += (localStorage.getItem(k) || '').length + k.length; return n * 2; }
function prune(keepSnaps = 3) {
  const snaps = ours().filter(k => k.startsWith(P + 'snap:' + state.campaignId + ':')).sort((a, b) => +a.split(':').pop() - +b.split(':').pop());
  for (const k of snaps.slice(0, Math.max(0, snaps.length - keepSnaps))) localStorage.removeItem(k);
  // drafts of turns long past (the desk keeps one per turn)
  for (const k of ours()) { const m = k.match(new RegExp('^' + P + state.campaignId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)$')); if (m && +m[1] < state.turn - 1) localStorage.removeItem(k); }
}
let warned = false;
function guardStorage() {
  prune();
  window.persistState = () => {
    const v = JSON.stringify(state), k = P + 'state8:' + state.campaignId;
    try { localStorage.setItem(k, v); return; } catch { }
    prune(0); try { localStorage.setItem(k, v); return; } catch { }
    if (!warned) { warned = true; alert('Your browser has run out of room to save this campaign. Download the campaign file now (Notebook → The record → Download the campaign file) — it holds everything.'); }
    toast('Not saved: browser storage is full. Download the campaign file from the record.');
  };
  window.snapshotLocal = () => { prune(2); try { localStorage.setItem(P + 'snap:' + state.campaignId + ':' + state.turn, JSON.stringify(state)); } catch { } };
}
function markHigh() { const all = store(HIGH_KEY, {}), h = all[state.campaignId]; if (!h || state.turn >= h.turn) { all[state.campaignId] = { turn: state.turn, seal: sealOf(state) }; keep(HIGH_KEY, all); } }
const fileSeal = (st, local) => fingerprint(JSON.stringify(st) + '|' + JSON.stringify(local));
export function campaignFile() {
  const local = {}; for (const k of ours()) if (!k.includes(':snap:') && !k.endsWith('w3d-gfx') && k !== HIGH_KEY) local[k] = localStorage.getItem(k);
  return { kind: 'cabinet-of-war-campaign', version: 2, savedAt: new Date().toISOString(), campaignId: state.campaignId, turn: state.turn, date: state.date, seal: fileSeal(state, local), state, local };
}
function saveCampaignFile(auto) {
  dl('cabinet-of-war-turn' + String(state.turn).padStart(2, '0') + '-' + state.date + '.json', JSON.stringify(campaignFile()), 'application/json');
  toast(auto ? 'Campaign file saved to your downloads (turn ' + state.turn + ').' : 'Campaign file downloaded.');
}
async function loadCampaignFile(file) {
  const f = JSON.parse(await file.text());
  if (f.kind !== 'cabinet-of-war-campaign' || !f.state || !f.local) throw Error('This is not a Cabinet of War campaign file.');
  const altered = f.version >= 2 && f.seal !== fileSeal(f.state, f.local), sealed = !!(f.state.record || {}).ironman, high = store(HIGH_KEY, {})[f.state.campaignId];
  if (sealed && altered) throw Error('This campaign file has been altered since it was saved, and the campaign is sealed. It cannot be loaded.');
  if (sealed && high && f.turn < high.turn) throw Error('The record is sealed: this browser has already lived to turn ' + high.turn + ', and this file is from turn ' + f.turn + '. A sealed campaign cannot go back.');
  if (altered && !confirm('This campaign file has been altered since it was saved. Load it anyway?')) return;
  if (!confirm('Load the campaign of ' + f.date + ' (turn ' + f.turn + ')? The campaign in this browser is replaced; download its file first if you want to keep it.')) return;
  for (const k of ours()) if (!k.endsWith('w3d-gfx') && k !== HIGH_KEY) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(f.local)) localStorage.setItem(k, v);
  localStorage.setItem(P + 'state8:' + f.state.campaignId, JSON.stringify(f.state));
  location.reload();
}

/* ---------- the record: the campaign file, the almanac for a Claude Project, how full storage is ---------- */
function installRecord() {
  const orig = window.renderRecord;
  window.renderRecord = () => { orig(); const p = $('p-record'); if (!p) return;
    const box = document.createElement('div'); box.className = 'cw-record';
    const kb = Math.round(used() / 1024), auto = store(AUTO_KEY, true);
    box.innerHTML = '<div class="eyebrow">The campaign file</div><p class="hint">One file holds the whole campaign: the state, your letters, your dispatches and the book. Keep the latest one; load it on any browser to carry on.</p>'
      + '<div class="row"><button class="btn" data-a="save">Download the campaign file</button><button class="btn quiet" data-a="load">Load a campaign file</button></div>'
      + '<label class="cw-auto"><input type="checkbox" data-a="auto"' + (auto ? ' checked' : '') + '> Download it after every turn</label>'
      + '<p class="hint">This browser holds about ' + kb + ' KB of the campaign (most browsers allow about 5,000 KB).</p>'
      + '<div class="eyebrow" style="margin-top:14px">The sealed record</div><p class="hint">Each accepted turn is linked to the one before; the packet carries the latest seal, and a reply must answer it. Current seal: <code>' + esc(sealOf(state)) + '</code> · ' + state.record.chain.length + ' turn' + (state.record.chain.length === 1 ? '' : 's') + ' sealed.</p>'
      + (state.record.ironman ? '<p class="hint"><b>Ironman.</b> This campaign cannot go back: older campaign files, altered files and whole saved states are refused.</p>' : '<div class="row"><button class="btn quiet" data-a="ironman">Seal the record — no going back</button></div>')
      + '<div class="eyebrow" style="margin-top:14px">How the courier rides</div>'
      + '<label class="cw-auto"><input type="radio" name="cw-courier" data-a="courier" value="repo"' + (courierMode() === 'repo' ? ' checked' : '') + '> Through the repository: sealing copies an errand for a coding agent (Claude Code or Codex) working in this game\u2019s GitHub repository. It writes the turn, checks it and pushes it; the game picks it up about a minute later, and applies it at once if it passes every check.</label>'
      + '<label class="cw-auto"><input type="radio" name="cw-courier" data-a="courier" value="hand"' + (courierMode() !== 'repo' ? ' checked' : '') + '> By hand: sealing copies the packet for a chat; paste Claude\u2019s reply on the order sheet when it comes.</label>'
      + '<div class="row"><button class="btn quiet" data-a="look">Look for the courier now</button></div><p class="hint">The next turn is expected at <code>' + esc(turnPath()) + '</code>.</p>'
      + '<div class="eyebrow" style="margin-top:14px">A fresh chat each turn</div><p class="hint">Every packet stands alone: the state, your orders and the parts of the almanac in play. Start a new chat for each turn; nothing is lost, and a long chat only fills Claude\u2019s memory with old turns.</p>'
      + '<div class="eyebrow" style="margin-top:14px">For a Claude Project</div><p class="hint">The rules (how to judge, how the world reaches you, the reply format, the almanac\u2019s systems) do not change from turn to turn. Put them in a Claude Project once and each packet leaves them out: it is about half as long. When the game\u2019s rules change, the packet names a new version and Claude will ask you for the new file.</p>'
      + '<label class="cw-auto"><input type="checkbox" data-a="rulesmode"' + (store(RULES_KEY, false) ? ' checked' : '') + '> My Claude Project holds the rules (version ' + esc(rulesVersion({ contract, almanac })) + ')</label>'
      + '<div class="row"><button class="btn quiet" data-a="rules">Download the rules for the project</button><button class="btn quiet" data-a="almanac">Download the whole almanac</button></div>';
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.hidden = true; box.append(f);
    f.onchange = async () => { try { if (f.files[0]) await loadCampaignFile(f.files[0]); } catch (e) { toast(e.message); } f.value = ''; };
    box.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'save') saveCampaignFile(); if (a === 'load') f.click(); if (a === 'almanac') dl('cabinet-of-war-almanac.json', JSON.stringify(almanac, null, 1), 'application/json'); if (a === 'rules') dl(rulesFileName(rulesVersion({ contract, almanac })), rulesText({ contract, almanac }), 'text/markdown'); if (a === 'contract') dl('cabinet-of-war-contract.md', contract, 'text/markdown');
      if (a === 'look') lookForCourier(true);
      if (a === 'ironman') { const b = e.target; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Click again: from now on this campaign can never load an older turn'; return; } state.record.ironman = true; persistState(); markHigh(); toast('The record is sealed. What is done is done.'); window.renderRecord(); } };
    box.onchange = e => { if (e.target.dataset.a === 'courier') { keep(COURIER_KEY, e.target.value); toast(e.target.value === 'repo' ? 'The courier rides through the repository: seal, paste the errand into Claude Code or Codex, and the turn comes back by itself.' : 'The courier rides by hand: paste the packet into a chat, and its reply on the order sheet.'); }
      if (e.target.dataset.a === 'auto') keep(AUTO_KEY, e.target.checked); if (e.target.dataset.a === 'rulesmode') { keep(RULES_KEY, e.target.checked); toast(e.target.checked ? 'Packets now leave out the rules. Add the rules file to your Claude Project.' : 'Packets carry the rules again.'); } };
    p.prepend(box); };
  window.renderRecord();
}

/* ---------- urgent letters: his choice applies its branch at once and goes with the next dispatch ---------- */
export const choiceFor = id => store(CHOICE_KEY, []).find(c => c.turn === state.turn && c.id === id);
export function choose(r, optId, byDefault) {
  if (choiceFor(r.id)) return; const o = r.urgent.options.find(x => x.id === optId); if (!o) return;
  for (const l of o.letters || []) if (l && l.id && !state.reports.some(x => x.id === l.id)) state.reports.push(l);
  applyBranch(state, o.changes || {});
  const all = store(CHOICE_KEY, []).filter(c => c.turn >= state.turn - 1); all.push({ turn: state.turn, id: r.id, title: r.title, opt: o.id, label: o.label, byDefault: !!byDefault }); keep(CHOICE_KEY, all);
  persistState(); onChange();
}

/* ---------- his judgement of sources ---------- */
export const trustOf = src => (state.trust || {})[src] || null;
export function setTrust(src, mark) { state.trust = state.trust || {}; if (mark) state.trust[src] = mark; else delete state.trust[src]; persistState(); }

/* ---------- the enemy commander's temperament weighs the opposing army's plan (hooked into the desk's enemyPlan) ---------- */
function installTemper() {
  const en = () => (state.battleDemo || {}).enemy || null;
  window.__temper = (S, F, M, phase, mor) => {
    const e = en(); if (!e) return; const t = TEMPERS.includes(e.temper) ? e.temper : 'steady';
    const push = { rash: 1, bold: .55, steady: 0, cautious: -.55, timid: -1 }[t];
    S.hold_bombard -= push * .9; S.advance_center += push * .7; S.counter_charge += push * .6; S.withdraw += (mor < 55 ? -push * 1.6 : 0);
    if (e.favours === 'cavalry') { S.flank_cav_L += .6; S.flank_cav_R += .6; } if (e.favours === 'guns') S.hold_bombard += .6; if (e.favours === 'infantry') S.advance_center += .4;
    if (e.habit === 'flanks') { S.oblique_L += .5; S.oblique_R += .5; } if (e.habit === 'centre') S.advance_center += .6; if (e.habit === 'defence') S.hold_bombard += .7;
  };
  window.__temperWhy = why => { const e = en(); return e && e.commander ? e.commander + ': ' + why.replace(/^It /, 'his army ').replace(/^The enemy /, 'his army ') : why; };
}

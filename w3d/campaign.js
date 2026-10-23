/* The campaign's keeper: builds the packet for Claude, reads its reply, keeps the saves safe and the book of the campaign.
   The rules live in turn.js (pure) and contract.md (what Claude is told); this file joins them to the desk's page. */
import { buildPacket, parseReply, checkReply, mergeTurn, applyBranch, rollFortune, seedThreads, correctionRequest, resendRequest, TEMPERS } from './turn.js';
import { checkContinuity } from './continuity.js';

const P = 'cabinet-of-war:', BOOK_KEY = P + 'w3d-book', CHOICE_KEY = P + 'w3d-choices', SENT_KEY = P + 'w3d-sent', AUTO_KEY = P + 'w3d-autosave';
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
  window.__campaign = { packet, almanac: () => almanac };
}

/* ---------- older saves: the almanac leaves the state; threads, trust and the chronicle arrive ---------- */
function migrate() {
  const h = state.hidden = state.hidden || {}; let ch = false;
  if (h.world) { delete h.world; ch = true; }
  if (!Array.isArray(h.threads)) { h.threads = seedThreads(almanac); ch = true; }
  if (!state.trust) { state.trust = {}; ch = true; }
  if (ch) persistState();
}

/* ---------- the packet ---------- */
const sentOrders = () => store(SENT_KEY, []).flatMap(s => (s.orders || []).filter(o => o && o.ref).map(o => o.ref));
const choicesNow = () => store(CHOICE_KEY, []).filter(c => c.turn === state.turn);
export const fortune = () => rollFortune(state.campaignId, state.turn);
async function packet(orders) {
  const w = draft.w3d || {};
  return buildPacket({ state, contract, orders, almanac, fortune: fortune(), wake: w.wake, trust: state.trust, choices: choicesNow(), endRequested: !!w.end });
}

/* ---------- reading the reply ---------- */
function installReview() {
  const legacy = window.reviewWorld;
  window.reviewWorld = text => {
    const p = parseReply(text);
    if (p.error) return show({ title: p.truncated ? 'The reply was cut off' : 'The reply could not be read', errors: [p.error], request: p.truncated ? resendRequest(state.turn + 1) : null, requestLabel: 'Copy a request to send it again' });
    const reply = p.value;
    if (reply.schemaVersion === 2 && reply.kind !== 'turn') { $('confirm').querySelector('h2').textContent = 'Accept this update?'; $('accept').hidden = false; legacy(text); return; } // a whole state (older replies, imported state files)
    const r = checkReply(state, reply, { orderRefs: sentOrders(), fortune: fortune() });
    if (r.errors.length) return show({ title: 'This reply cannot be accepted', errors: r.errors, request: correctionRequest(r.errors, state.turn + 1) });
    const { next, notes } = mergeTurn(state, reply);
    try { validateState(next); } catch (e) { return show({ title: 'This reply cannot be accepted', errors: [e.message], request: correctionRequest([e.message], state.turn + 1) }); }
    const cont = checkContinuity(state, next), hard = cont.filter(i => i.level === 'error');
    candidate = next;
    show({ title: 'Accept this turn?', summary: next, errors: hard.map(i => i.text), warns: [...cont.filter(i => i.level !== 'error').map(i => i.text), ...r.warns], fixes: [...r.fixes, ...notes], request: cont.length || r.warns.length ? correctionRequest([...cont, ...r.warns], state.turn + 1) : null, accept: true });
  };
}
// one dialog for every outcome: what the turn is, what was corrected, what may be wrong, and a way to ask Claude again
function show({ title, summary, errors = [], warns = [], fixes = [], request, requestLabel, accept }) {
  const d = $('confirm'), b = $('confirm-body'); d.querySelector('h2').textContent = title; $('accept').hidden = !accept;
  b.innerHTML = (summary ? '<p class="cw-sum">Turn ' + summary.turn + ' · ' + esc(summary.date) + ' — “' + esc(summary.title) + '”<br><small>' + summary.reports.length + ' letter' + (summary.reports.length === 1 ? '' : 's') + ' on the way. Your current state is kept as a snapshot first.</small></p>' : '')
    + list('cw-err', errors.length && accept ? 'It contradicts what is settled' : null, errors)
    + list('cw-warn', 'Worth a look', warns)
    + list('cw-fix', 'Corrected on arrival', fixes);
  if (request) { const c = document.createElement('button'); c.className = 'btn'; c.textContent = requestLabel || 'Copy a correction request for Claude'; c.onclick = () => navigator.clipboard.writeText(request).then(() => toast('Copied — paste it into the same chat, then paste the new reply here.'), () => toast('Could not copy.')); b.append(c); }
  if (!d.open) d.showModal();
}
const list = (cls, head, items) => items.length ? '<div class="cw-list ' + cls + '">' + (head ? '<b>' + head + '</b>' : '') + items.map(t => '<p>' + esc(t) + '</p>').join('') + '</div>' : '';

/* ---------- accepting: the book takes the turn you lived, then the campaign file is written ---------- */
function installAccept() {
  const btn = $('accept'), orig = btn.onclick;
  btn.onclick = e => {
    if (!candidate) return; const prev = state;
    if (candidate.turn === prev.turn + 1) addToBook(prev, candidate);
    orig.call(btn, e);
    if (state !== prev) { onChange(); if (store(AUTO_KEY, true)) setTimeout(() => saveCampaignFile(true), 600); }
  };
  $('cancel') && $('cancel').addEventListener('click', () => { candidate = null; });
}
function addToBook(prev, next) {
  const book = store(BOOK_KEY, []).filter(e => e.turn !== prev.turn), sent = store(SENT_KEY, []).find(s => s.turn === prev.turn) || {};
  const newCanon = ((next.hidden || {}).canon || []).filter(f => !((prev.hidden || {}).canon || []).includes(f));
  book.push({ turn: prev.turn, date: prev.date, to: next.date, title: prev.title, briefing: prev.briefing, at: prev.player.locationId,
    letters: (prev.reports || []).map(r => ({ from: ((prev.cast || []).find(c => c.id === r.from_id) || {}).name || r.from || '', place: r.place, dated: r.dated, title: r.title, text: r.text, battle: !!r.battle, source: r.source || '' })),
    orders: (sent.orders || []).map(o => o.line || o), own: sent.own || '', choices: choicesNow().map(c => c.title + ': ' + c.label),
    secret: { chronicle: (next.hidden || {}).chronicle || '', decisions: (next.hidden || {}).decisions || [], fortune: (next.hidden || {}).fortune_used || [], canon: newCanon } });
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
export function campaignFile() {
  const local = {}; for (const k of ours()) if (!k.includes(':snap:') && !k.endsWith('w3d-gfx')) local[k] = localStorage.getItem(k);
  return { kind: 'cabinet-of-war-campaign', version: 1, savedAt: new Date().toISOString(), campaignId: state.campaignId, turn: state.turn, date: state.date, state, local };
}
function saveCampaignFile(auto) {
  dl('cabinet-of-war-turn' + String(state.turn).padStart(2, '0') + '-' + state.date + '.json', JSON.stringify(campaignFile()), 'application/json');
  toast(auto ? 'Campaign file saved to your downloads (turn ' + state.turn + ').' : 'Campaign file downloaded.');
}
async function loadCampaignFile(file) {
  const f = JSON.parse(await file.text());
  if (f.kind !== 'cabinet-of-war-campaign' || !f.state || !f.local) throw Error('This is not a Cabinet of War campaign file.');
  if (!confirm('Load the campaign of ' + f.date + ' (turn ' + f.turn + ')? The campaign in this browser is replaced; download its file first if you want to keep it.')) return;
  for (const k of ours()) if (!k.endsWith('w3d-gfx')) localStorage.removeItem(k);
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
      + '<div class="eyebrow" style="margin-top:14px">For a Claude Project</div><p class="hint">The packet already carries everything Claude needs. If you play in a Claude Project, you can add these as project knowledge.</p>'
      + '<div class="row"><button class="btn quiet" data-a="almanac">Download the almanac</button><button class="btn quiet" data-a="contract">Download the contract</button></div>';
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json'; f.hidden = true; box.append(f);
    f.onchange = async () => { try { if (f.files[0]) await loadCampaignFile(f.files[0]); } catch (e) { toast(e.message); } f.value = ''; };
    box.onclick = e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'save') saveCampaignFile(); if (a === 'load') f.click(); if (a === 'almanac') dl('cabinet-of-war-almanac.json', JSON.stringify(almanac, null, 1), 'application/json'); if (a === 'contract') dl('cabinet-of-war-contract.md', contract, 'text/markdown'); };
    box.onchange = e => { if (e.target.dataset.a === 'auto') keep(AUTO_KEY, e.target.checked); };
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

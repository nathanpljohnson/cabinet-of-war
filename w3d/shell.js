/* One shell over every view (room, map, field). A quiet bar of the things you carry — map, letters, the day's
   dispatch, notebook, travel — and papers that open one at a time. Counsel, your commission and the post all arrive as
   letters; the notebook holds matters in hand, your secretary's remarks, your staff's knowledge and the record. You give orders; you do not converse:
   every order, journey, inspection or answer to a letter is an entry in the day's dispatch, composed into the
   desk's own orders text (draft.case.text), so the packet for the adjudicator is unchanged in form. */
import { travel, loc, roadKm, letterDays, travelDays, placeOn } from './places.js';
import { choose, choiceFor, trustOf, setTrust, book } from './campaign.js';
import { personOf } from './people.js';
const $ = id => document.getElementById(id);
const ARCHIVE_KEY = 'cabinet-of-war:w3d-archive', CIPHER_KEY = 'cabinet-of-war:w3d-cipher', HEARD_KEY = 'cabinet-of-war:w3d-overheard', FAIR_KEY = 'cabinet-of-war:w3d-fair';
const READ_KEY = 'cabinet-of-war:w3d-read', ACTED_KEY = 'cabinet-of-war:w3d-acted', SENT_KEY = 'cabinet-of-war:w3d-sent', POST_KEY = 'cabinet-of-war:w3d-post';
const ICON = {
  map: '<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  reports: '<rect x="3" y="6" width="18" height="12.5" rx="1"/><path d="M3 7l9 6.5L21 7"/>',
  orders: '<path d="M20 3.5C13 5 8.5 10 6.5 17.5L5 21l3-2.2C15 16 19.5 11 20 3.5z"/><path d="M7.5 17l6-6"/>',
  council: '<circle cx="8" cy="8" r="2.8"/><circle cx="16" cy="8" r="2.8"/><path d="M2.5 20c.3-3.6 2.5-5.5 5.5-5.5s5.2 1.9 5.5 5.5M10.5 20c.3-3.6 2.5-5.5 5.5-5.5s5.2 1.9 5.5 5.5"/>',
  notebook: '<path d="M6 3.5h11.5a1.5 1.5 0 011.5 1.5v15.5H8a3 3 0 01-3-3V5a1.5 1.5 0 011-1.5z"/><path d="M5 17.5a3 3 0 013-3h11"/>',
  travel: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  field: '<path d="M6 21V3.5"/><path d="M6 4h12l-3 4 3 4H6"/>',
  more: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
};
const svg = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>';

export function createShell({ act, onSeal, clock }) {
  const shell = document.createElement('div'); shell.id = 'w3d-shell';
  const item = (a, label, extra = '') => `<button data-a="${a}" id="sh-b-${a}">${svg(a)}<span>${label}</span>${extra}</button>`;
  shell.innerHTML = `
  <div class="sh-place"><small id="sh-date"></small><b id="sh-zone">Headquarters</b><span id="sh-sub"></span></div>
  <nav class="sh-bar" aria-label="What you carry">
    ${item('map', 'Map')}${item('reports', 'Letters', '<i class="cnt" id="sh-unread"></i>')}${item('orders', 'Dispatch', '<i class="cnt quiet" id="sh-ocount"></i>')}${item('notebook', 'Notebook', '<i class="cnt quiet" id="sh-matters"></i>')}${item('travel', 'Travel')}${item('field', 'Field')}${item('more', '')}
    <div class="sh-pop sh-go" id="sh-go" hidden></div>
    <div class="sh-pop" id="sh-more" hidden><button data-a="book">The book of the campaign</button><button data-a="record">The record · save &amp; load</button><button data-a="gfx">Graphics &amp; sound</button></div>
  </nav>
  <aside class="sh-panel" id="sh-panel" hidden aria-label="Papers"><div class="sh-ph"><div><div class="eyebrow" id="sh-panel-eyebrow"></div><h2 id="sh-panel-title"></h2></div><button class="sh-x" id="sh-panel-x" aria-label="Close">✕</button></div><div class="sh-pbody" id="sh-pbody"></div></aside>
  <section class="sh-paper sh-letters" id="sh-letters" hidden aria-label="Letters">
    <div class="sh-ph"><div><div class="eyebrow" id="sh-l-eyebrow"></div><h2 id="sh-l-title">Your correspondence</h2></div><button class="sh-x" data-close="sh-letters" aria-label="Close">✕</button></div>
    <div class="sh-l-grid"><div class="sh-l-col"><ul class="sh-l-list" id="sh-l-list"></ul><div class="sh-post" id="sh-post" hidden></div></div><article class="sh-letter" id="sh-letter"></article></div>
  </section>
  <section class="sh-paper sh-notebook" id="sh-notebook" hidden aria-label="Notebook">
    <div class="sh-ph"><div><div class="eyebrow" id="sh-nb-eyebrow">Notebook</div><h2>Your notebook</h2></div><button class="sh-x" data-close="sh-notebook" aria-label="Close">✕</button></div>
    <div class="sh-nb" id="sh-nb"></div>
  </section>
  <section class="sh-paper sh-book" id="sh-book" hidden aria-label="The book of the campaign">
    <div class="sh-ph"><div><div class="eyebrow" id="sh-bk-eyebrow">The book of the campaign</div><h2 id="sh-bk-title">The book of the campaign</h2></div><div class="sh-bk-tools"><button id="sh-bk-save">Save as a page</button><button class="sh-x" data-close="sh-book" aria-label="Close">✕</button></div></div>
    <div class="sh-bk" id="sh-bk"></div>
  </section>
  <section class="sh-sheet" id="sh-sheet" aria-label="The day’s dispatch" hidden>
    <div class="sh-sh-hd"><div><div class="eyebrow" id="sh-sheet-eyebrow"></div><h2>The day’s dispatch</h2></div><button class="sh-x" id="sh-sheet-x" aria-label="Close the dispatch">✕</button></div>
    <div class="sh-sh-grid">
      <div class="sh-sh-main" id="sh-sh-main">
        <ol class="sh-items" id="sh-items"></ol>
        <label class="sh-own-l" for="sh-own">In your own words</label>
        <textarea id="sh-own" rows="6" placeholder="Anything else, as you would say it to your secretary."></textarea>
        <div id="sh-desk"></div>
      </div>
      <div class="sh-sh-side">
        <div class="eyebrow">Give an order</div>
        <div class="sh-give"><select id="sh-to"></select><textarea id="sh-give-t" rows="3" placeholder="What is to be done…"></textarea><button id="sh-give-go">Add to the dispatch</button></div>
        <div class="eyebrow">Wake me</div>
        <select id="sh-wake" class="sh-wake"></select>
        <div class="eyebrow">Carried with it</div><ul class="sh-carried" id="sh-carried"></ul>
        <p class="sh-hint" id="sh-days"></p>
      </div>
    </div>
  </section>
  <div class="sh-card" id="sh-card" hidden><button class="sh-x" id="sh-card-x" aria-label="Close">✕</button><div id="sh-card-body"></div></div>
  <div class="sh-ctx" id="sh-ctx" hidden></div>
  <div class="sh-talk" id="sh-talk" hidden role="dialog" aria-label="In person"><button class="sh-x" id="sh-talk-x" aria-label="Close">✕</button><div id="sh-talk-body"></div></div>`;
  document.body.append(shell);
  let quillT = 0; shell.addEventListener('input', e => { if (/TEXTAREA|INPUT/.test(e.target.tagName) && performance.now() - quillT > 140) { quillT = performance.now(); act('sound:quill'); } });

  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const cast = id => (state.cast || []).find(c => c.id === id);
  const fromName = r => (cast(r.from_id) || {}).name || r.from || 'Unknown';
  const short = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const days = (a, b) => { const A = loc(a), B = loc(b); return A && B && a !== b ? letterDays(roadKm(A, B)) : 0; };
  const RULERS = new Set(['maria_theresa', 'francis_stephen']);
  const whereNow = c => placeOn(c, today());
  function presentHere(c) { return whereNow(c) === travel.here() && !RULERS.has(c.id) && c.id !== 'own-forces' && !c.dead; }

  /* ---------- the desk's own content, moved in ---------- */
  const place = $('place'); if (place) $('sh-card-body').append(place);
  const paneNodes = { council: [$('p-counsel'), $('p-scene')], record: [$('p-record')], staff: [$('p-staff')], army: [$('p-battle')], scene: [$('p-scene')] };
  const parking = el('div'); parking.hidden = true; document.body.append(parking);
  for (const k in paneNodes) for (const n of paneNodes[k]) if (n) parking.append(n);
  const leftBody = document.querySelector('#left .body'); if (leftBody) parking.append(leftBody); // briefing and reports are drawn here from state instead
  const caseBody = $('case-body'); $('sh-desk').append(...caseBody.childNodes);
  const deskTa = $('orders-text'); if (deskTa) deskTa.hidden = true; // the dispatch writes it
  const sealBtn = [...$('sh-desk').querySelectorAll('button')].find(b => /Copy orders/.test(b.textContent));
  if (sealBtn) { sealBtn.textContent = 'Seal the dispatch & copy it for Claude'; sealBtn.addEventListener('click', () => { recordSent(); onSeal(); }); }
  const reply = $('sh-desk').querySelector('details'); if (reply) reply.querySelector('summary').textContent = 'The courier is back — paste Claude’s reply here';

  /* ---------- open papers: one at a time ---------- */
  const TITLES = { council: ['The council', 'Advice and audiences'], record: ['The record', 'Save, load and history'], staff: ['Your staff', 'What your staff knows'], army: ['The army', 'Forces, orders and courses'] };
  let openPanel = null;
  const papers = ['sh-letters', 'sh-notebook', 'sh-sheet', 'sh-talk', 'sh-book'];
  function closeAll(except) { for (const id of papers) if (id !== except) $(id).hidden = true; if (except !== 'panel') { $('sh-panel').hidden = true; openPanel = null; } $('sh-go').hidden = $('sh-more').hidden = true; }
  function showPanel(k) {
    if (k === 'reports') return showLetters();
    if (k === 'council') return showLetters(letters().find(x => x.kind === 'advice')?.id);
    if (k === 'notebook' || k === 'record' || k === 'staff' || k === 'army') return showNotebook(k);
    if (openPanel === k) { closePanel(); return; }
    closeAll('panel'); const body = $('sh-pbody'); parking.append(...body.childNodes);
    for (const n of paneNodes[k]) if (n) { body.append(n); n.hidden = false; }
    $('sh-panel-eyebrow').textContent = TITLES[k][0]; $('sh-panel-title').textContent = TITLES[k][1];
    $('sh-panel').hidden = false; openPanel = k; refresh(); syncVeil();
  }
  function closePanel() { $('sh-panel').hidden = true; openPanel = null; syncVeil(); }
  function toggleSheet(on) { const s = $('sh-sheet'), want = on ?? s.hidden; if (want) { closeAll('sh-sheet'); s.hidden = false; renderSheet(); } else { s.hidden = true; document.activeElement?.blur(); } syncVeil(); }
  const anyOpen = () => !!openPanel || papers.some(id => !$(id).hidden);
  const syncVeil = () => document.body.classList.toggle('sh-papers', anyOpen());
  $('sh-panel-x').onclick = closePanel; $('sh-sheet-x').onclick = () => toggleSheet(false); $('sh-card-x').onclick = () => { $('sh-card').hidden = true; };
  $('sh-talk-x').onclick = () => { $('sh-talk').hidden = true; syncVeil(); };
  shell.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; syncVeil(); });

  let view = 'room';
  shell.querySelector('.sh-bar').addEventListener('click', e => {
    const b = e.target.closest('button'), a = b && b.dataset.a; if (!a) return; // the travel list's own buttons sit inside the bar
    if (a === 'more') { $('sh-go').hidden = true; $('sh-more').hidden = !$('sh-more').hidden; return; }
    if (a === 'travel') { $('sh-more').hidden = true; if ($('sh-go').hidden) showTravel(); else $('sh-go').hidden = true; return; }
    $('sh-more').hidden = $('sh-go').hidden = true;
    if ((a === 'map' || a === 'field') && view === a) return act('room'); // the active view's item puts it away
    if (a === 'notebook') return showNotebook();
    if (a === 'record') return showNotebook('record');
    if (a === 'book') return showBook();
    act(a);
  });

  /* ---------- the day's dispatch: one entry per order ---------- */
  const ref = i => 'T' + state.turn + '-' + (i + 1);
  const W = () => draft.w3d || (draft.w3d = { own: ensureCase().text || '', items: [] }); // per turn: the desk replaces draft on a new turn
  function itemLine(it) {
    if (it.kind === 'journey' || it.kind === 'inspect') return it.text;
    const r = it.ref && state.reports.find(x => x.id === it.ref), re = r ? 'On ' + fromName(r) + '’s letter of ' + fmtDate(r.dated) + ' (“' + r.title + '”) — ' : '';
    if (it.to === 'staff') return re + 'To my staff: ' + it.text;
    const c = cast(it.to), name = c ? c.name : it.to;
    return re + (it.inPerson ? 'To ' + name + ', given in person at ' + it.at + ': ' : 'To ' + name + ' at ' + it.at + ', by letter (about ' + it.days + ' day' + (it.days > 1 ? 's' : '') + ' on the road): ') + it.text;
  }
  function compose() {
    const w = W(), lines = w.items.map((it, i) => '[' + ref(i) + '] ' + itemLine(it));
    ensureCase().text = [w.own.trim(), w.memoir && w.memoir.trim() ? 'From my memoirs, written this turn:\n' + w.memoir.trim() : '', lines.length ? 'Orders given today (references in brackets):\n' + lines.join('\n') : ''].filter(Boolean).join('\n\n');
    saveDraft(); renderCase(); refresh(); if (!$('sh-sheet').hidden) renderSheet();
  }
  function setItem(it) { const w = W(); it.id = it.id || 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e3); const k = w.items.findIndex(x => x.id === it.id); if (k >= 0) w.items[k] = it; else w.items.push(it); compose(); return it.id; }
  function dropItem(id) { const w = W(); w.items = w.items.filter(x => x.id !== id); compose(); }
  // an order to someone: in person if they are here, otherwise by letter with its days on the road
  function orderTo(to, text, ref) {
    const here = travel.here(), c = cast(to);
    if (to === 'staff' || !c) return setItem({ kind: 'order', to: 'staff', text, ref });
    const inPerson = presentHere(c); return setItem({ kind: 'order', to, text, ref, inPerson, at: inPerson ? locName(here) : locName(whereNow(c)), days: inPerson ? 0 : Math.max(1, days(here, whereNow(c))) });
  }
  // older lines written straight into the text (before the dispatch had entries)
  function appendOrder(line) { setItem({ kind: 'inspect', text: line }); }
  function removeOrder(line) { const w = W(); if (line && w.own.includes(line)) { w.own = w.own.replace(line, '').replace(/\n{2,}/g, '\n').trim(); } w.items = w.items.filter(x => x.text !== line); compose(); }

  function renderSheet() {
    const S = state, w = W(), here = travel.here(), hl = loc(here);
    $('sh-sheet-eyebrow').textContent = 'Written at ' + locName(here) + ' · ' + fmtDate(S.date) + ' · turn ' + S.turn + (travel.get() ? ' · journey not yet adjudicated' : '');
    const ol = $('sh-items'); ol.replaceChildren();
    for (const it of w.items) {
      const li = el('li'), head = el('div', 'sh-it-h'), c = cast(it.to);
      head.textContent = it.kind === 'journey' ? 'Journey' : it.kind === 'inspect' ? 'In person' : it.to === 'staff' ? 'To my staff' : 'To ' + (c ? c.name : it.to) + (it.inPerson ? ' · in person' : ' · by letter, ~' + it.days + ' d');
      const r = it.ref && S.reports.find(x => x.id === it.ref); if (r) head.append(el('span', 'sh-it-re', ' · on their letter “' + r.title + '”'));
      const x = el('button', 'sh-it-x', 'strike'); x.title = 'Strike this from the dispatch'; x.onclick = () => { if (it.id === 'journey') act('go:cancel'); else dropItem(it.id); };
      li.append(head, el('p', null, it.kind === 'order' ? it.text : itemLine(it)), x); ol.append(li);
    }
    if (!w.items.length) ol.append(el('li', 'sh-empty', 'No orders yet. Give them here, to people you meet, or on the letters you receive.'));
    const own = $('sh-own'); if (document.activeElement !== own) own.value = w.own;
    const ul = $('sh-carried'); ul.replaceChildren();
    const li = (txt, rm) => { const x = el('li', null, txt); if (rm) { const b = el('button', null, 'remove'); b.onclick = () => { rm(); saveDraft(); renderSheet(); refresh(); }; x.append(b); } ul.append(x); };
    const dec = S.decision && S.decision.options.find(o => o.id === draft.option);
    if (dec) li('Council course: ' + dec.title, () => { draft.option = ''; renderAll(); });
    for (const id of referenced) li('Place marked: ' + locName(id), () => { referenced.delete(id); });
    const ord = armyOrders(), ids = Object.keys(ord);
    for (const id of ids.slice(0, 6)) { const u = unitById(id), o = ord[id]; if (u) li('Field: ' + u.name.split(' (')[0] + ' — ' + (o.mode || 'hold') + (o.dest ? ' ' + Math.round(Math.hypot(o.dest[0] - u.e, o.dest[1] - u.n)) + ' m' : '') + (o.form ? ', ' + o.form : ''), () => { delete ord[id]; }); }
    if (ids.length > 6) li('… and ' + (ids.length - 6) + ' more field orders');
    if (BS.log.length || draft.battleResult) li('Table battle: ' + (draft.battleResult ? draft.battleResult.outcome : BS.log.length + ' phase(s) fought'));
    if (!ul.children.length) li('Nothing else — standing orders apply.');
    const to = $('sh-to'), was = to.value; to.replaceChildren(new Option('My staff (here)', 'staff'));
    const people = (S.cast || []).filter(c => c.id !== 'own-forces' && !RULERS.has(c.id) && !c.dead);
    for (const c of people.filter(presentHere)) to.append(new Option(c.name + ' — here, in person', c.id));
    for (const c of people.filter(c => !presentHere(c))) to.append(new Option(c.name + ' — ' + locName(whereNow(c)) + ', by letter ~' + Math.max(1, days(here, whereNow(c))) + ' d', c.id));
    if (was) to.value = was;
    const wk = $('sh-wake'); if (!wk.options.length) for (const t of WAKE) wk.append(new Option(t, t)); wk.value = w.wake || WAKE[0];
    const far = ['vienna', 'breslau', 'prague'].filter(id => id !== here && hl && loc(id)).map(id => locName(id) + ' ' + days(here, id) + ' d');
    $('sh-days').textContent = far.length ? 'From ' + locName(here) + ' a letter takes about: ' + far.join(' · ') + '.' : '';
  }
  $('sh-own').oninput = e => { W().own = e.target.value; compose(); };
  const WAKE = ['When there is news I must decide on.', 'When the first answers to these orders arrive.', 'In three days, whatever happens.', 'In a week, unless something urgent comes.', 'Not before a fortnight, unless something urgent comes.'];
  $('sh-wake').onchange = e => { W().wake = e.target.value; saveDraft(); };
  $('sh-give-go').onclick = () => { const t = $('sh-give-t').value.trim(); if (!t) return; orderTo($('sh-to').value, t); $('sh-give-t').value = ''; };

  /* ---------- the post: letters reach you day by day through the turn ---------- */
  const arrives = r => r.arrives || r.dated;
  const postDays = () => [...new Set(state.reports.map(arrives))].sort();
  function today() { const p = store(POST_KEY, null); if (p && p.turn === state.turn) return p.upto; const d = postDays()[0] || state.date; keep(POST_KEY, { turn: state.turn, upto: d }); return d; }
  const onTheRoad = () => state.reports.filter(r => arrives(r) > today());
  const shownDate = () => onTheRoad().length ? today() : state.date;
  function passDay() { for (const r of seen()) if (r.urgent && !choiceFor(r.id)) { const d = r.urgent.options.find(o => o.default) || r.urgent.options[r.urgent.options.length - 1]; choose(r, d.id, true); act('toast:The day passed without your answer to “' + r.title + '”; ' + d.label.replace(/^./, x => x.toLowerCase()) + '.'); }
    const next = [...new Set(onTheRoad().map(arrives))].sort()[0]; if (!next) return 0; keep(POST_KEY, { turn: state.turn, upto: next }); return state.reports.filter(r => arrives(r) === next).length; }
  const seen = () => state.reports.filter(r => arrives(r) <= today());
  // your commission and your advisers' counsel come as letters as well
  function letters() {
    const out = [], m = state.mandate, d = state.decision;
    if (m) out.push({ id: 'mandate', kind: 'mandate', from_id: m.from_id, place: (cast(m.from_id) || {}).place || 'vienna', dated: m.dated || state.date, title: m.title || 'Your commission', text: m.text, claim: m.claim, category: null, via: 'courier' });
    if (d) for (const o of d.options) out.push({ id: 'adv-' + d.id + '-' + o.id, kind: 'advice', o, from: o.by, from_id: ((state.cast || []).find(c => c.name === o.by) || {}).id, place: travel.here(), dated: today(), title: o.title, text: o.objective, category: 'counsel on ' + (d.title || 'the decision before you').replace(/\s*\(illustrative\)/, ''), via: 'audience', claim: 'demo' });
    return out.concat(seen());
  }
  /* ---------- letters: one at a time, with their seals and their days on the road ---------- */
  const rk = r => r.id + '|' + r.dated, rkOf = id => { const r = letters().find(x => x.id === id); return r ? rk(r) : id; };
  const readSet = () => new Set(store(READ_KEY, []));
  function unread() { const r = readSet(); return letters().filter(x => !r.has(rk(x))); }
  function markRead(id) { const r = readSet(); for (const x of letters()) if (id == null || x.id === id) r.add(rk(x)); keep(READ_KEY, [...r]); refresh(); }
  const actedRaw = () => store(ACTED_KEY, {});
  const acted = () => { const a = actedRaw(), out = {}; for (const r of letters()) if (a[rk(r)]) out[r.id] = a[rk(r)]; return out; };
  const setActed = (id, how) => { const a = actedRaw(); if (how) a[rkOf(id)] = how; else delete a[rkOf(id)]; keep(ACTED_KEY, a); };
  // which sealed order a letter answers (the adjudicator marks reports with "re": ["T0-3", …])
  const sentOrders = () => store(SENT_KEY, []).flatMap(s => s.orders.map(o => typeof o === 'string' ? { ref: null, line: o, date: s.date, turn: s.turn } : { ...o, date: s.date, turn: s.turn }));
  // if the reply did not tag a report, match it ourselves: it names the reference (sure), or it comes from the person
  // the order went to, or it shares the order's key words (probable). Only orders sealed before this turn can be answered.
  const STOP = new Set('about after again their there these those which while where would could should shall other every under order orders letter state staff report write writing person given today'.split(' '));
  const words = t => new Set((t || '').toLowerCase().match(/[a-zà-ž]{5,}/g)?.filter(w => !STOP.has(w)) || []);
  function links() {
    const out = new Map(), orders = sentOrders().filter(o => o.ref && o.turn < state.turn), tagged = new Set(seen().flatMap(r => r.re || []));
    const add = (ref, r, sure) => { if (!out.has(ref)) out.set(ref, []); if (!out.get(ref).some(x => x.r === r)) out.get(ref).push({ r, sure }); };
    for (const r of seen()) for (const id of r.re || []) add(id, r, true);
    for (const o of orders) { if (tagged.has(o.ref)) continue; const ow = words(o.text || o.line);
      for (const r of seen()) { if ((r.re || []).length) continue; const body = r.title + ' ' + r.text;
        if (body.includes(o.ref)) { add(o.ref, r, true); continue; }
        const rw = words(body); let k = 0; for (const w of ow) if (rw.has(w)) k++;
        if ((o.to && o.to !== 'staff' && r.from_id === o.to) || k >= 2) add(o.ref, r, false); } }
    return out;
  }
  const answersTo = refId => links().get(refId) || [];
  const answeredBy = r => [...links()].filter(([, a]) => a.some(x => x.r === r)).map(([id, a]) => ({ id, sure: a.find(x => x.r === r).sure }));
  let openLetter = null, listMode = 'now';
  function archive() { const a = store(ARCHIVE_KEY, {}); let ch = false; for (const r of seen()) { const k = rk(r); if (!a[k]) { a[k] = { ...r, turn: state.turn }; ch = true; } } if (ch) keep(ARCHIVE_KEY, a); return a; }
  const archived = () => Object.values(archive()).filter(x => x.turn < state.turn).sort((x, y) => (y.arrives || y.dated).localeCompare(x.arrives || x.dated));
  // a ciphered letter is unreadable until your clerk has worked on it for a few hours (or the day has passed)
  const ciphers = () => store(CIPHER_KEY, {});
  const readable = r => { if (!r.cipher) return true; const c = ciphers()[rk(r)]; return !!c && (today() > c.day || (clock && clock.hour >= c.ready)); };
  const cipherText = t => t.replace(/[A-Za-z]+/g, w => [...w].map(ch => String((ch.toLowerCase().charCodeAt(0) * 7) % 89 + 10)).join('·'));
  function showLetters(id, mode) {
    if (mode) listMode = mode; if (id && !letters().some(x => x.id === id)) listMode = 'archive'; else if (id) listMode = 'now';
    closeAll('sh-letters'); $('sh-letters').classList.remove('sh-single'); $('sh-l-title').textContent = 'Your correspondence'; const here = travel.here();
    $('sh-l-eyebrow').textContent = 'Letters · ' + locName(here) + ' · ' + fmtDate(shownDate());
    const all = letters(), arch = archived(), rs = listMode === 'archive' ? arch : [...all.filter(x => x.kind), ...all.filter(x => !x.kind).reverse()], r = readSet(), a = acted();
    openLetter = id || openLetter && rs.find(x => x.id === openLetter)?.id || (unread()[0] || rs[0] || {}).id;
    const ul = $('sh-l-list'); ul.replaceChildren();
    const tabs = el('li', 'sh-l-tabs'); for (const [m, lab] of [['now', 'This turn'], ['archive', 'Your archive' + (arch.length ? ' (' + arch.length + ')' : '')]]) { const b = el('button', listMode === m ? 'on' : null, lab); b.onclick = () => { openLetter = null; showLetters(null, m); }; tabs.append(b); } ul.append(tabs);
    for (const x of rs) {
      const li = el('li', (x.id === openLetter ? 'sh-l-on ' : '') + (r.has(rk(x)) ? 'sh-l-read' : 'sh-l-sealed')); li.tabIndex = 0;
      const sl = (personOf(x.from_id).seal || ['#8a2f26', '#f3ead8', (fromName(x)[0] || '·')]);
      li.innerHTML = '<i class="sh-seal" style="--seal-c:' + sl[0] + ';--seal-t:' + sl[1] + '">' + esc(sl[2]) + '</i><b>' + esc(fromName(x)) + '</b><small>' + (x.kind === 'mandate' ? 'your commission' : x.kind === 'advice' ? 'counsel' : esc(locName(x.place)) + ' · ' + short(x.dated)) + (a[x.id] ? ' · ' + ({ filed: 'filed', adopted: 'adopted', aside: 'set aside' }[a[x.id]] || 'answered') : '') + '</small><span>' + esc(x.title) + '</span>';
      li.onclick = li.onkeydown = ev => { if (ev.type === 'keydown' && ev.key !== 'Enter') return; showLetters(x.id); }; ul.append(li);
    }
    if (!rs.length) ul.append(el('li', 'sh-empty', listMode === 'archive' ? 'Nothing kept from earlier turns yet.' : 'No letters have reached you.'));
    const L = rs.find(x => x.id === openLetter); if (L) { if (!readSet().has(rk(L))) act('sound:seal'); drawLetter(L); markRead(L.id); } else $('sh-letter').replaceChildren();
    const road = onTheRoad().length, post = $('sh-post'); post.hidden = !road; post.replaceChildren();
    if (road) { post.append(el('p', null, 'More letters are on the road.')); const b = el('button', null, 'Let the day pass'); b.onclick = () => { const n = passDay(); act('post:' + n); showLetters(); }; post.append(b); }
    $('sh-letters').hidden = false; syncVeil(); refresh();
  }
  function drawLetter(r) {
    const box = $('sh-letter'), here = travel.here(), c = cast(r.from_id), d = days(r.place, here), a = acted()[r.id];
    const via = { courier: 'by courier', post: 'by the post', audience: 'given you in person' }[r.via] || 'received';
    const answers = answeredBy(r).map(({ id, sure }) => ({ ...(sentOrders().find(o => o.ref === id) || { ref: id, line: '' }), sure }));
    const hand = personOf(r.from_id).hand, fair = !!store(FAIR_KEY, false), ok = readable(r), ic = r.intercepted;
    box.innerHTML = '<div class="sh-lt-sheet' + (hand && !fair ? ' sh-hand' : '') + (ic ? ' sh-lt-intercepted' : '') + '"' + (hand ? ' style="--hand:' + esc(hand) + '"' : '') + '>'
      + (ic ? '<div class="sh-lt-ic">Intercepted — from ' + esc(ic.from || 'unknown') + ' to ' + esc(ic.to || 'unknown') + '</div>' : '')
      + '<div class="sh-lt-head">' + esc(locName(r.place)) + ', ' + esc(fmtDate(r.dated)) + '</div>'
      + answers.map(o => '<div class="sh-lt-re">' + (o.sure ? 'In answer to your order ' : 'Probably in answer to your order ') + esc(o.ref) + (o.date ? ' of ' + esc(fmtDate(o.date)) : '') + (o.line ? ': “' + esc(o.line.length > 140 ? o.line.slice(0, 140) + '…' : o.line) + '”' : '') + '</div>').join('')
      + (r.category ? '<div class="sh-lt-cat">Concerning ' + esc(r.category.toLowerCase()) + '</div>' : '')
      + '<h3>' + esc(ok ? r.title : 'A letter in cipher') + '</h3><p class="sh-lt-body' + (ok ? '' : ' sh-cipher') + '">' + esc(ok ? r.text : cipherText(r.text)) + '</p>'
      + '<p class="sh-lt-sig">' + esc(fromName(r)) + (c && c.office ? '<small>' + esc(c.office) + '</small>' : '') + '</p>'
      + (r.kind === 'advice' ? [['Their reasoning', r.o.reasoning], ['The risk', r.o.risks], ['What it needs', r.o.needs], ['What is not known', r.o.unknown], ['Who does the work', r.o.delegation]].filter(([, v]) => v).map(([k, v]) => '<p class="sh-lt-ps"><i>' + k + '.</i> ' + esc(v) + '</p>').join('') : '')
      + (r.source ? '<p class="sh-lt-src">Their source: ' + esc(r.source) + (trustOf(r.source) ? ' <i>· you ' + trustOf(r.source) + ' this source</i>' : '') + '</p>' : '')
      + (r.urgent && ok ? '<div class="sh-urgent"><b>' + esc(r.urgent.prompt || 'This needs your answer today.') + '</b>' + (choiceFor(r.id) ? '<p>' + (choiceFor(r.id).byDefault ? 'The day passed without your answer: ' : 'You answered: ') + esc(choiceFor(r.id).label) + '</p>' : '') + '</div>' : '')
      + '<p class="sh-lt-foot">' + via + (r.via !== 'audience' && d ? ' · from ' + esc(locName(r.place)) + ' a letter is about ' + d + ' day' + (d > 1 ? 's' : '') + ' on the road to ' + esc(locName(here)) : '') + '</p></div>'
      + (ok ? enclosures(r) : '');
    box.firstChild.classList.toggle('sh-lt-commission', r.kind === 'mandate');
    const acts = el('div', 'sh-lt-acts');
    if (!ok) { const c = ciphers()[rk(r)], b = el('button', 'sh-primary', c ? 'Your clerk is working on it' : 'Give it to your clerk'); b.disabled = !!c; b.onclick = () => { const all = ciphers(); all[rk(r)] = { day: today(), ready: (clock ? clock.hour : 9) + 3 }; keep(CIPHER_KEY, all); act('hours:.25'); act('toast:Your clerk takes it away; he expects to have it in clear in about three hours.'); showLetters(r.id); }; acts.append(b); box.append(acts); return; }
    if (hand) { const f = el('button', 'sh-fair', fair ? 'Read it in their hand' : 'Read the fair copy'); f.onclick = () => { keep(FAIR_KEY, !fair); showLetters(r.id); }; acts.append(f); }
    if (r.kind === 'mandate') { box.append(acts); if (state.player.dismissed) acts.append(el('p', 'sh-done', 'Your commission has been withdrawn.')); return; }
    if (r.kind === 'advice') {
      const on = draft.option === r.o.id; if (on) acts.append(el('p', 'sh-done', 'This is the course you have adopted; it goes with the dispatch.'));
      const ad = el('button', 'sh-primary', on ? 'Withdraw your assent' : 'Adopt this course'), aside = el('button', null, 'Set it aside');
      ad.onclick = () => { draft.option = on ? '' : r.o.id; saveDraft(); renderAll(); setActed(r.id, on ? null : 'adopted'); showLetters(r.id); };
      aside.onclick = () => { if (on) { draft.option = ''; saveDraft(); renderAll(); } setActed(r.id, 'aside'); showLetters(r.id); };
      acts.append(ad, aside); box.append(acts); return;
    }
    if (r.urgent && !choiceFor(r.id)) { for (const o of r.urgent.options) { const b = el('button', 'sh-primary', o.label); b.onclick = () => { choose(r, o.id); setActed(r.id, 'ordered'); act('sound:seal'); act('toast:Your answer goes at once.'); showLetters(r.id); }; acts.append(b); } box.append(acts); trustRow(r, box); return; }
    if (a) acts.append(el('p', 'sh-done', a === 'filed' ? 'Filed without orders.' : 'You have given orders on this letter.'));
    const give = el('button', 'sh-primary', a === 'ordered' ? 'Give further orders on it' : 'Give orders on this');
    const file = el('button', null, a === 'filed' ? 'Back among matters in hand' : 'File it — no orders');
    const show = el('button', null, 'Show ' + locName(r.place) + ' on the map');
    give.onclick = () => composeOn(r, acts);
    file.onclick = () => { setActed(r.id, a === 'filed' ? null : 'filed'); showLetters(r.id); };
    show.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('map'); setTimeout(() => selectPlace(r.place), 1700); };
    acts.append(give, file, show);
    if (r.sighting) { const sg = el('button', null, 'Where they place it'); sg.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('sighting:' + r.id); }; acts.append(sg); }
    if (r.battle) { const bt = el('button', null, 'See the ground as described'); bt.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('account'); }; acts.append(bt); }
    box.append(acts); trustRow(r, box);
  }
  // how far you believe whoever saw or heard it: your staff weigh their reports by it, and you can be wrong
  function trustRow(r, box) {
    if (!r.source) return; const m = trustOf(r.source), row = el('div', 'sh-trust');
    row.append(el('span', null, 'Their source, ' + r.source + ':'));
    for (const [k, lab] of [['trust', 'I trust it'], ['doubt', 'I doubt it']]) { const b = el('button', m === k ? 'on' : null, lab); b.onclick = () => { setTrust(r.source, m === k ? null : k); act('toast:' + (m === k ? 'Your staff will weigh this source as they see fit.' : k === 'trust' ? 'Your staff will treat this source as reliable.' : 'Your staff will treat this source with caution.')); showLetters(r.id); }; row.append(b); }
    box.append(row);
  }
  // what came with the letter: a return of figures, a captured order, a sketch of the ground
  function enclosures(r) {
    let h = ''; const e = r.enclosure;
    if (e && e.kind === 'return') h += '<div class="sh-enc sh-enc-return"><div class="sh-enc-t">Enclosed · ' + esc(e.title || 'a return') + '</div><table>' + (e.rows || []).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table>' + (e.note ? '<p>' + esc(e.note) + '</p>' : '') + '</div>';
    if (e && e.kind === 'order') h += '<div class="sh-enc sh-enc-order"><div class="sh-enc-t">Enclosed · ' + esc(e.title || 'a captured order') + '</div><p>' + esc(e.text || '') + '</p>' + (e.from ? '<p class="sh-enc-sig">' + esc(e.from) + '</p>' : '') + '</div>';
    const sk = r.sketch; if (sk) { const pts = (sk.places || []).map(id => (state.fortresses || []).find(f => f.id === id) || loc(id)).filter(Boolean);
      if (pts.length) { const la = pts.map(p => p.lat), lo = pts.map(p => p.lon), x0 = Math.min(...lo) - .25, x1 = Math.max(...lo) + .25, y0 = Math.min(...la) - .15, y1 = Math.max(...la) + .15, W = 420, H = Math.round(W * (y1 - y0) / ((x1 - x0) * .64));
        const X = v => ((v - x0) / (x1 - x0) * W).toFixed(1), Y = v => ((y1 - v) / (y1 - y0) * H).toFixed(1), path = pts.slice().sort((a, b) => b.lat - a.lat).map((p, i) => (i ? 'L' : 'M') + X(p.lon) + ' ' + Y(p.lat)).join(' ');
        h += '<div class="sh-enc sh-enc-sketch"><div class="sh-enc-t">Enclosed · ' + esc(sk.title || 'a sketch') + '</div><svg viewBox="-20 -14 ' + (W + 40) + ' ' + (H + 28) + '"><path d="' + path + '" class="road"/>' + pts.map(p => '<g transform="translate(' + X(p.lon) + ' ' + Y(p.lat) + ')"><rect x="-5" y="-5" width="10" height="10" transform="rotate(45)"/><text x="10" y="4">' + esc(p.name) + '</text></g>').join('') + '</svg></div>'; } }
    return h;
  }
  // one letter on its own (the opening night), with a single way to put it down
  function showSingle(r, label, done) {
    closeAll('sh-letters'); $('sh-letters').classList.add('sh-single'); $('sh-l-title').textContent = 'A letter'; $('sh-l-eyebrow').textContent = 'A letter by courier · ' + fmtDate(r.dated);
    drawLetter(r); const acts = $('sh-letter').querySelector('.sh-lt-acts'); acts.replaceChildren(); const b = el('button', 'sh-primary', label); b.onclick = () => { $('sh-letters').classList.remove('sh-single'); done(); }; acts.append(b);
    $('sh-letters').hidden = false; syncVeil(); setTimeout(() => b.focus(), 50);
  }
  function composeOn(r, acts) { // orders on a letter: to its writer (in person or by letter), or to your own staff
    const f = el('form', 'sh-compose'), to = el('select'), t = el('textarea'); t.rows = 3; t.placeholder = 'Your orders on this letter…';
    const c = cast(r.from_id); if (c && !RULERS.has(c.id)) to.append(new Option(presentHere(c) ? 'To ' + c.name + ', in person' : 'To ' + c.name + ' at ' + locName(whereNow(c)) + ', by letter ~' + Math.max(1, days(travel.here(), whereNow(c))) + ' d', c.id));
    to.append(new Option('To my staff', 'staff'));
    const go = el('button', 'sh-primary', 'Add to the dispatch'); f.append(to, t, go); acts.replaceChildren(f); t.focus();
    f.onsubmit = e => { e.preventDefault(); if (!t.value.trim()) return; orderTo(to.value, t.value.trim(), r.id); setActed(r.id, 'ordered'); act('toast:Added to the day’s dispatch.'); showLetters(r.id); };
  }

  /* ---------- notebook: matters in hand, the situation, what you know ---------- */
  function recordSent() { const w = W(), sent = store(SENT_KEY, []).filter(s => s.turn !== state.turn); sent.push({ turn: state.turn, date: state.date, at: locName(travel.here()), orders: w.items.map((it, i) => ({ ref: ref(i), line: itemLine(it), to: it.to || null, text: it.text })), own: w.own.trim().slice(0, 160) }); keep(SENT_KEY, sent.slice(-8)); }
  function matters() {
    const a = acted(), out = [];
    for (const r of seen()) if (!a[r.id]) out.push({ k: 'letter', r });
    if (state.decision && !draft.option && !letters().some(x => x.kind === 'advice' && a[x.id])) out.push({ k: 'council' });
    if (onTheRoad().length) out.push({ k: 'post' });
    for (const s of store(SENT_KEY, [])) { if (s.settled) continue; const os = s.orders.map(o => typeof o === 'string' ? { ref: null, line: o } : o); if (os.length && os.every(o => o.ref && answersTo(o.ref).length)) continue; out.push({ k: 'sent', s, os }); }
    if (travel.get()) out.push({ k: 'journey' });
    for (const p of state.pending || []) out.push({ k: 'pending', p });
    return out;
  }
  function showNotebook(open) {
    closeAll('sh-notebook'); const nb = $('sh-nb'); parking.append(...[...nb.querySelectorAll('#p-staff,#p-record,#p-battle,#p-scene')]); nb.replaceChildren(); const m = matters();
    const sec = (title, note) => { const s = el('section', 'sh-nb-sec'); s.append(el('h3', null, title)); if (note) s.append(el('p', 'sh-hint', note)); nb.append(s); return s; };
    const s1 = sec('Matters in hand', 'Letters you have neither answered nor filed, dispatches still awaiting an answer, and business carried over from earlier turns.');
    const ul = el('ul', 'sh-matters'); s1.append(ul);
    for (const x of m) {
      const li = el('li');
      if (x.k === 'letter') { li.innerHTML = '<b>Letter from ' + esc(fromName(x.r)) + '</b> · ' + esc(locName(x.r.place)) + ', ' + short(x.r.dated) + ' — “' + esc(x.r.title) + '”'; const b = el('button', null, 'Read'); b.onclick = () => showLetters(x.r.id); li.append(b); }
      if (x.k === 'sent') {
        const done = x.os.filter(o => o.ref && answersTo(o.ref).length).length;
        li.innerHTML = '<b>Your dispatch of ' + short(x.s.date) + '</b> from ' + esc(x.s.at) + (state.turn > x.s.turn ? ' — ' + done + ' of ' + x.os.length + ' orders answered' : ' — on the road');
        const sub = el('div', 'sh-orders');
        for (const o of x.os) { const ans = o.ref ? answersTo(o.ref) : [], row = el('div', ans.length ? 'sh-o-ok' : 'sh-o-wait'); row.append(el('span', 'sh-o-ref', o.ref || '·'), el('span', 'sh-o-t', o.line.length > 110 ? o.line.slice(0, 110) + '…' : o.line));
          for (const { r, sure } of ans) { const lb = el('button', 'sh-o-lnk' + (sure ? '' : ' sh-o-maybe'), (sure ? 'Answered by ' : 'Probably answered by ') + fromName(r) + ' →'); lb.onclick = () => showLetters(r.id); row.append(lb); }
          if (!ans.length) row.append(el('span', 'sh-o-st', state.turn > x.s.turn ? 'no answer yet' : 'on the road')); sub.append(row); }
        if (!x.os.length) sub.append(el('div', 'sh-o-wait', x.s.own || 'standing orders'));
        li.append(sub); const b = el('button', null, 'Settled'); b.onclick = () => { const all = store(SENT_KEY, []); const t = all.find(s => s.turn === x.s.turn); if (t) t.settled = true; keep(SENT_KEY, all); showNotebook(); refresh(); }; li.append(b); }
      if (x.k === 'council') { li.innerHTML = '<b>Your advisers await your decision</b> · ' + esc(state.decision.title); const b = el('button', null, 'Read their counsel'); b.onclick = () => showPanel('council'); li.append(b); }
      if (x.k === 'post') { li.innerHTML = '<b>More letters are on the road</b>'; const b = el('button', null, 'Let the day pass'); b.onclick = () => { const n = passDay(); act('post:' + n); showNotebook(); }; li.append(b); }
      if (x.k === 'journey') li.innerHTML = '<b>Your journey</b> to ' + esc(locName(travel.here())) + ' — not yet adjudicated';
      if (x.k === 'pending') li.textContent = typeof x.p === 'string' ? x.p : (x.p.title || x.p.text || JSON.stringify(x.p));
      ul.append(li);
    }
    if (!m.length) ul.append(el('li', 'sh-empty', 'Nothing outstanding.'));
    if (state.mandate) { const sc = sec(state.player.dismissed ? 'Your commission — withdrawn' : 'Your commission'); sc.append(el('p', 'sh-nb-quote', state.mandate.text)); const b = el('button', 'sh-nb-link', 'Read the letter'); b.onclick = () => showLetters('mandate'); sc.append(b); }
    if (state.epilogue) { const e = state.epilogue, se = sec(e.title || 'The verdict of history'); se.append(el('p', 'sh-nb-quote', e.text || '')); if (e.verdict) se.append(el('p', 'sh-nb-remark', e.verdict)); const b = el('button', 'sh-nb-link', 'Read the book of the campaign, with what was hidden'); b.onclick = () => showBook(); se.append(b); }
    if ((state.remarks || []).length) { const sr = sec('Your secretary’s remarks'); for (const t of state.remarks) sr.append(el('p', 'sh-nb-remark', t)); }
    const hh = state.household; if (hh) { const sh = sec('Your household'), sp = cast(hh.spouse), kids = (hh.children || []).map(k => k.name).join(' and ');
      if (sp) sh.append(el('p', null, sp.name + ', your wife' + (sp.place && sp.place !== travel.here() ? ', is at ' + locName(sp.place) : ', is here') + '.'));
      if (kids) sh.append(el('p', null, 'Your daughters: ' + kids + '.')); if (hh.estate) sh.append(el('p', null, hh.estate));
      const h = state.player.health || hh.health; if (h && h !== 'well') sh.append(el('p', 'sh-nb-remark', { tired: 'You are tired; the journeys have told on you.', ill: 'You are unwell. Your secretary would have you rest.', 'gravely ill': 'You are gravely ill.' }[h] || h)); }
    const ov = store(HEARD_KEY, []); if (ov.length) { const so = sec('Overheard', 'What you caught in passing, in person.'); for (const o of ov.slice(-8).reverse()) so.append(el('p', 'sh-nb-remark', '“' + o.line + '” — ' + o.who + ', ' + short(o.date))); }
    if (state.player.dismissed || state.player.dead || state.ended) {
      const sm = sec('Your memoirs', 'Out of office, you can still write — and how you tell it shapes how you are remembered. What you write here goes with the dispatch.');
      const t = el('textarea', 'sh-memoir'); t.rows = 5; t.value = W().memoir || ''; t.placeholder = 'This turn’s pages…'; t.oninput = () => { W().memoir = t.value; compose(); act('sound:quill'); }; sm.append(t);
      const hb = el('button', 'sh-nb-link', 'Begin anew as your heir'); hb.onclick = () => { if (hb.dataset.sure) return act('heir'); hb.dataset.sure = 1; hb.textContent = 'Click again: this campaign is kept in the record, and your heir inherits your memoirs, friends and enemies'; }; sm.append(hb); }
    { const sb = sec('The book of the campaign', 'Every turn you have lived: your orders, the letters that reached you, the battles.'); const b = el('button', 'sh-nb-link', 'Open the book'); b.onclick = () => showBook(); sb.append(b); }
    if (!state.ended) { const sv = sec('Your service'), w = W();
      if (w.end) { sv.append(el('p', 'sh-nb-remark', 'You have asked to end your service. It goes with the dispatch, and the next courier brings the verdict.')); const b = el('button', 'sh-nb-link', 'Withdraw the request'); b.onclick = () => { w.end = false; dropItem('end'); showNotebook(); }; sv.append(b); }
      else { const b = el('button', 'sh-nb-link', 'End your service here'); b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Click again: the next reply ends the campaign and writes its verdict'; return; } w.end = true; setItem({ id: 'end', kind: 'inspect', text: 'I end my service here. Let the story of it be told.' }); showNotebook(); }; sv.append(b); } }
    const s2 = sec('The situation'); s2.append(el('p', null, state.briefing || ''));
    if (state.player) s2.append(el('p', 'sh-hint', state.player.name + (state.player.note ? ' — ' + state.player.note : '')));
    const s3 = sec('What you would know'); for (const k of state.knowledge || []) s3.append(el('p', null, k.text));
    if (state.forcesNote) { const s4 = sec('Forces'); s4.append(el('p', null, state.forcesNote)); }
    { const ss = el('details', 'sh-nb-more'); ss.append(el('summary', null, 'Sources and certainty'));
      const CL = { documented: 'documented', inference: 'inferred', invention: 'written for the game', disputed: 'disputed', demo: 'placeholder' };
      for (const x of state.sourcesAppendix || []) { const p = el('p', 'sh-src'); p.innerHTML = '<b>' + esc(x.about) + '</b> <i>' + esc(CL[x.claim] || x.claim || '') + '</i> — ' + esc(x.note) + (x.url ? ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">source</a>' : ''); ss.append(p); }
      for (const r of seen().filter(r => r.claim)) ss.append(el('p', 'sh-src', 'Letter “' + r.title + '” — ' + (CL[r.claim] || r.claim)));
      nb.append(ss); }
    for (const [k, title] of [['staff', 'What your staff know'], ['army', 'The army and its courses'], ['scene', 'Conversations on record'], ['record', 'The record · save and load']]) {
      const n = paneNodes[k][0]; if (!n || (k === 'scene' && !state.scene)) continue; const d = el('details', 'sh-nb-more'); d.append(el('summary', null, title), n); n.hidden = false; d.open = open === k; nb.append(d); if (open === k) setTimeout(() => d.scrollIntoView({ block: 'start' }), 30); }
    $('sh-notebook').hidden = false; syncVeil();
  }

  /* ---------- the book of the campaign: the turns you lived; when it is over, what was hidden as well ---------- */
  function chapters() {
    const past = book(), w = draft.w3d || { items: [] };
    return [...past, { turn: state.turn, date: state.date, to: null, title: state.title, briefing: state.briefing, at: state.player.locationId, current: true,
      letters: seen().map(r => ({ from: fromName(r), place: r.place, dated: r.dated, title: r.title, text: r.text, battle: !!r.battle, source: r.source || '' })), orders: w.items.map(itemLine), own: (w.own || '').trim() }];
  }
  function bookHtml(forFile) {
    const over = !!state.ended, cs = chapters(), h = [], e = state.epilogue;
    if (e) h.push('<section class="bk-epi"><h3>' + esc(e.title || 'The verdict of history') + '</h3><p>' + esc(e.text || '') + '</p>' + (e.verdict ? '<p class="bk-verdict">' + esc(e.verdict) + '</p>' : '') + '</section>');
    cs.forEach((c, i) => {
      h.push('<section class="bk-ch"><div class="bk-n">Chapter ' + (i + 1) + (c.current ? ' · this turn' : '') + '</div><h3>' + esc(c.title || '') + '</h3><p class="bk-when">' + esc(fmtDate(c.date)) + (c.to ? ' – ' + esc(fmtDate(c.to)) : '') + ' · at ' + esc(locName(c.at)) + '</p><p>' + esc(c.briefing || '') + '</p>');
      const os = [...(c.orders || []), ...(c.own ? [c.own] : [])]; if (os.length) h.push('<h4>Your orders</h4><ol class="bk-orders">' + os.map(o => '<li>' + esc(o) + '</li>').join('') + '</ol>');
      if ((c.choices || []).length) h.push('<h4>What you answered at once</h4><ul>' + c.choices.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>');
      if ((c.letters || []).length) h.push('<h4>Letters</h4>' + c.letters.map(l => '<details' + (l.battle || forFile ? ' open' : '') + ' class="bk-letter' + (l.battle ? ' bk-battle' : '') + '"><summary><b>' + esc(l.title) + '</b> — ' + esc(l.from || 'unsigned') + ', ' + esc(locName(l.place)) + ', ' + esc(fmtDate(l.dated)) + '</summary><p>' + esc(l.text) + '</p>' + (l.source ? '<p class="bk-src">Their source: ' + esc(l.source) + '</p>' : '') + '</details>').join(''));
      if (over && c.secret) { const s = c.secret; h.push('<div class="bk-secret"><h4>What was hidden from you</h4>' + (s.chronicle ? '<p>' + esc(s.chronicle) + '</p>' : '') + ((s.decisions || []).length ? '<ul>' + s.decisions.map(d => '<li><b>' + esc(d.who) + '</b> knew ' + esc(d.knows || '—') + '; wanted ' + esc(d.wants || '—') + '; decided ' + esc(d.decides || '—') + '</li>').join('') + '</ul>' : '') + ((s.fortune || []).length ? '<p class="bk-src">Fortune: ' + s.fortune.map(f => esc(f.for) + ' (' + esc(f.roll) + '): ' + esc(f.outcome)).join(' · ') + '</p>' : '') + '</div>'); }
      h.push('</section>');
    });
    if (over) { const dv = (state.hidden || {}).divergences || []; if (dv.length) h.push('<section class="bk-ch"><h3>How this campaign departed from history</h3><ul>' + dv.map(d => '<li>' + esc(d.text) + '</li>').join('') + '</ul></section>'); }
    return h.join('');
  }
  function showBook() {
    closeAll('sh-book'); $('sh-bk-title').textContent = 'The book of ' + (state.player.name || 'the campaign');
    $('sh-bk-eyebrow').textContent = state.ended ? 'The campaign is over · with what was hidden from you' : 'The book of the campaign · ' + (book().length + 1) + ' chapter' + (book().length ? 's' : '');
    $('sh-bk').innerHTML = bookHtml(false); $('sh-book').hidden = false; syncVeil(); act('sound:seal');
  }
  $('sh-bk-save').onclick = () => {
    const css = 'body{max-width:720px;margin:48px auto;padding:0 20px;background:#f3eee3;color:#25221d;font:18px/1.6 "Iowan Old Style",Palatino,Georgia,serif}h1,h3{font-family:Baskerville,Georgia,serif;font-weight:400}h1{font-size:40px;margin-bottom:4px}h3{font-size:28px;margin:6px 0}h4{font:15px Baskerville,Georgia,serif;font-variant-caps:all-small-caps;letter-spacing:.08em;color:#776f62;margin:22px 0 6px}.bk-n,.bk-when{color:#776f62;font-size:15px}.bk-ch{border-top:1px solid rgba(70,60,45,.2);padding:28px 0}summary{cursor:pointer}.bk-letter{margin:8px 0}.bk-battle summary b{color:#8a2f26}.bk-src{font-style:italic;color:#776f62;font-size:15px}.bk-secret{border-left:3px solid #8a2f26;padding:4px 16px;margin-top:18px;background:rgba(138,47,38,.05)}.bk-epi{padding:24px 0}.bk-verdict{font-style:italic}';
    dl('the-book-of-the-campaign.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The book of ' + esc(state.player.name) + '</title><style>' + css + '</style><h1>The book of ' + esc(state.player.name) + '</h1><p class="bk-when">Cabinet of War · ' + esc(fmtDate(state.date)) + '</p>' + bookHtml(true) + '</html>', 'text/html');
    act('toast:The book is saved to your downloads.');
  };

  function overhear(o, whoNames) { const all = store(HEARD_KEY, []); if (!all.some(x => x.line === o.line)) { all.push({ line: o.line, who: whoNames, date: shownDate() }); keep(HEARD_KEY, all.slice(-40)); } }

  /* ---------- in person: travel, instructions, seeing for yourself ---------- */
  function showTravel() {
    const g = $('sh-go'), here = travel.here(), hl = loc(here), j = travel.get(); g.replaceChildren();
    g.append(el('div', 'eyebrow', 'Go in person — you leave at once'));
    for (const l of state.locations) { if (l.id === here) continue; const km = hl ? roadKm(hl, l) : 0, b = el('button');
      b.innerHTML = esc(l.name) + ' <small>' + (km ? km + ' km · ' + travelDays(km) + ' d' : '') + (l.kind === 'foreign' ? ' · abroad' : '') + '</small>';
      b.onclick = () => { g.hidden = true; act('go:' + l.id); }; g.append(b); }
    const m = travel.mode(), b = el('button', 'sh-go-mode', m === 'field' ? 'Leave the army for court' : 'Join the army in camp');
    b.onclick = () => { g.hidden = true; act(m === 'field' ? 'join:court' : 'join:field'); }; g.append(b);
    if (j) { const c = el('button', 'sh-go-mode', 'Stay at ' + locName(state.player.locationId) + ' after all'); c.onclick = () => { g.hidden = true; act('go:cancel'); }; g.append(c); }
    g.append(el('p', 'sh-hint', 'The journey goes into the dispatch for the adjudicator.'));
    g.hidden = false;
  }
  function card(eyebrow, title, sub) { closeAll('sh-talk'); const b = $('sh-talk-body'); b.replaceChildren(el('div', 'eyebrow', eyebrow), el('h2', null, title)); if (sub) b.append(el('p', 'sh-talk-sub', sub)); $('sh-talk').hidden = false; syncVeil(); return b; }
  // someone here: give them an order, or act on what they have written to you
  function showTalk(people, viaChamberlain) {
    let who = people[0];
    const draw = () => {
      const b = card(viaChamberlain ? 'The Hofburg · through the chamberlain' : 'In person · ' + locName(travel.here()), who.name, who.office || '');
      if (people.length > 1) { const tabs = el('div', 'sh-tabs'); for (const p of people) { const t = el('button', p === who ? 'on' : null, p.name); t.onclick = () => { who = p; draw(); }; tabs.append(t); } b.insertBefore(tabs, b.children[1]); }
      const manner = { warm: 'They greet you warmly.', cordial: '', cool: 'They keep a polite distance.', hostile: 'They turn away as you approach, and answer shortly.' }[((state.hidden || {}).standing || {})[who.id]];
      if (manner) b.append(el('p', 'sh-manner', manner));
      const theirs = seen().filter(r => r.from_id === who.id);
      for (const r of theirs) { const x = el('button', 'sh-ref', 'Their letter of ' + short(r.dated) + ': “' + r.title + '”'); x.onclick = () => showLetters(r.id); b.append(x); }
      const f = el('form', 'sh-compose'), t = el('textarea'); t.rows = 3;
      t.placeholder = viaChamberlain ? 'What you ask to put before ' + who.name + '…' : 'Your orders to ' + who.name + '…';
      const starters = el('div', 'sh-starters');
      for (const s of viaChamberlain ? [] : ['Report to me in writing on ', 'Prepare ', 'Go at once to ', 'See that ']) { const x = el('button', null, s.trim() + '…'); x.type = 'button'; x.onclick = () => { t.value = s; t.focus(); }; starters.append(x); }
      const go = el('button', 'sh-primary', viaChamberlain ? 'Send in the request' : 'Give the order'); f.append(starters, t, go); b.append(f);
      f.onsubmit = e => { e.preventDefault(); const v = t.value.trim(); if (!v) return;
        if (viaChamberlain) setItem({ kind: 'inspect', text: 'At the Hofburg, through the chamberlain, I request an audience with ' + who.name + ' to put before them: ' + v });
        else { orderTo(who.id, v, theirs[0] && theirs[0].id); act('hours:.5'); }
        if (theirs[0]) setActed(theirs[0].id, 'ordered');
        $('sh-talk').hidden = true; syncVeil(); act('toast:Added to the day’s dispatch.'); };
      setTimeout(() => t.focus(), 30);
    };
    draw();
  }
  function showInspect(kind) {
    const here = travel.here(), l = loc(here) || { name: here }, name = l.name, camp = travel.mode() === 'field' ? 'the army’s camp near ' + name : 'the camp of the garrison of ' + name;
    const T = { muster: ['Inspect the companies', 'In person at ' + camp + ', I inspect the companies myself — men present against the rolls, sick, arms, shoes and coats, and their drill. Report what I see.'],
      stores: ['Look over the stores', 'In person at ' + camp + ', I look over the wagons and stores myself — bread and flour, forage, powder and shot, and how many days they would last. Report what I find.'],
      market: ['Listen in the market', 'In person in ' + name + ', I spend the day in the market and the inns, listening — the price of bread and forage, rumours, and the town’s mood towards the succession. Report what I hear.'],
      walls: ['Walk the walls', 'In person at ' + name + ', I walk the walls and the gate — the state of the works, guns mounted, the garrison present and its stores. Report what I see.'] }[kind];
    const b = card('See for yourself · ' + name, T[0], 'Your papers already hold:');
    const facts = el('ul', 'sh-facts'), fact = t => facts.append(el('li', null, t));
    if (kind === 'market') { if (l.report) fact(l.report); for (const r of state.routes || []) if (l.lat && r.pts.some(([a, o]) => Math.hypot(a - l.lat, (o - l.lon) * .66) < .15)) fact(r.name + ' passes here: ' + (r.goods || '') + (r.claim ? ' (' + r.claim + ')' : '')); }
    if (kind === 'walls') { const f = (state.fortresses || []).find(f => f.name.startsWith(name)); fact(f ? f.name + ': ' + f.note + ' Garrison: ' + f.garrison + (f.claim ? ' (' + f.claim + ')' : '') : 'Nothing on the works here.'); }
    if (kind === 'muster' || kind === 'stores') { const fs = (state.forces || []).filter(f => !f.locationId || f.locationId === here); if (fs.length) for (const f of fs.slice(0, 6)) fact((f.name || f.id) + (f.men ? ': ' + f.men + ' men' : '')); else fact('No muster rolls or returns for these troops have reached you.'); }
    if (!facts.children.length) fact('Nothing on record.');
    const done = W().items.some(x => x.id === 'inspect:' + kind);
    const go = el('button', 'sh-primary', done ? 'Already in the day’s dispatch' : 'Do it — add to the day’s dispatch'); go.disabled = done;
    go.onclick = () => { setItem({ id: 'inspect:' + kind, kind: 'inspect', text: T[1] }); act('hours:3'); $('sh-talk').hidden = true; syncVeil(); act('toast:Added to the day’s dispatch.'); };
    b.append(facts, go);
  }

  /* ---------- selection card (the desk's own place/realm card) and the map's context menu ---------- */
  if (place) new MutationObserver(() => { if (place.textContent.trim() && document.body.classList.contains('w3d-map')) $('sh-card').hidden = false; }).observe(place, { childList: true, subtree: true, characterData: true });
  function mapContext(e) {
    if (!document.body.classList.contains('w3d-map')) return;
    e.originalEvent.preventDefault();
    const m = window.__desk.map, p = m.latLngToContainerPoint(e.latlng); let best = null, bd = 42;
    for (const l of state.locations) { const q = m.latLngToContainerPoint([l.lat, l.lon]), d = q.distanceTo(p); if (d < bd) { bd = d; best = l; } }
    const name = best ? best.name : 'the ground near ' + e.latlng.lat.toFixed(2) + '° N, ' + e.latlng.lng.toFixed(2) + '° E';
    const items = [['March on ' + name + '.', 'Order a march on ' + name], ['Send a trusted officer to ' + name + ' to report on its state, garrison and stores.', 'Send an officer to report'], ['Estimate how long it would take to move troops to ' + name + '.', 'Ask the staff for a march estimate']];
    const c = $('sh-ctx'); c.replaceChildren(el('div', 'eyebrow', name));
    for (const [line, label] of items) { const b = el('button', null, label); b.onclick = () => { c.hidden = true; orderTo('staff', line); toggleSheet(true); }; c.append(b); }
    if (best && best.id !== travel.here()) { const b = el('button', null, 'Go there yourself'); b.onclick = () => { c.hidden = true; act('go:' + best.id); }; c.append(b); }
    if (best) { const b = el('button', null, (referenced.has(best.id) ? 'Unmark ' : 'Mark ') + best.name + ' for the dispatch'); b.onclick = () => { c.hidden = true; referenced.has(best.id) ? referenced.delete(best.id) : referenced.add(best.id); saveDraft(); renderPins && renderPins(); refresh(); }; c.append(b); }
    c.style.left = Math.min(innerWidth - 300, e.originalEvent.clientX) + 'px'; c.style.top = Math.min(innerHeight - 220, e.originalEvent.clientY) + 'px'; c.hidden = false;
  }
  window.__desk.map.on('contextmenu', mapContext);
  addEventListener('pointerdown', e => { if (!e.target.closest('#sh-ctx')) $('sh-ctx').hidden = true; if (!e.target.closest('.sh-bar')) { $('sh-more').hidden = true; $('sh-go').hidden = true; } }, true);

  /* ---------- state shown on the bar and the place line ---------- */
  function refresh(v, zone, sub) {
    const S = state, j = travel.get();
    $('sh-date').textContent = fmtDate(shownDate()) + (clock ? ' · ' + clock.word : '') + ' · ' + (travel.mode() === 'field' ? 'with the army' : 'at ' + locName(travel.here())) + (j ? ' · journey not yet adjudicated' : '');
    if (zone) $('sh-zone').textContent = zone; if (sub != null) $('sh-sub').textContent = sub;
    if (v) view = v;
    $('sh-b-field').hidden = travel.mode() !== 'field' && view !== 'field';
    for (const k of ['map', 'field']) { const b = $('sh-b-' + k); b.classList.toggle('on', view === k); b.querySelector('span').textContent = view === k ? (k === 'map' ? 'Stand up' : 'Leave field') : k === 'map' ? 'Map' : 'Field'; }
    const n = unread().length; $('sh-unread').textContent = n || '';
    const w = draft.w3d, on = (w ? w.items.length + (w.own.trim() ? 1 : 0) : (ensureCase().text.trim() ? 1 : 0)) + Object.keys(armyOrders()).length; $('sh-ocount').textContent = on || '';
    $('sh-matters').textContent = matters().length || '';
  }
  return {
    showPanel, closePanel, toggleSheet, refresh, showBook, unread, passDay, letters, seen, get today() { return shownDate(); }, markRead, appendOrder, removeOrder, setItem, dropItem, showTravel, showTalk, showInspect, showLetters, showNotebook, showSingle, presentHere, overhear, archive, archivedCount: () => archived().length,
    get talkOpen() { return !$('sh-talk').hidden; },
    get papersOpen() { return anyOpen(); },
    get sheetOpen() { return !$('sh-sheet').hidden; },
    closeTop() {
      if (!$('sh-ctx').hidden) { $('sh-ctx').hidden = true; return true; }
      if (!$('sh-go').hidden || !$('sh-more').hidden) { $('sh-go').hidden = $('sh-more').hidden = true; return true; }
      for (const id of papers) if (!$(id).hidden) { $(id).hidden = true; syncVeil(); return true; }
      if (openPanel) { closePanel(); return true; }
      if (!$('sh-card').hidden) { $('sh-card').hidden = true; return true; }
      return false;
    },
    hideCard() { $('sh-card').hidden = true; },
  };
}
export const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const locName = id => (state.locations.find(l => l.id === id) || { name: id }).name;

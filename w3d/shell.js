/* One shell over every view (room, map, field). A quiet bar of the things you carry — map, letters, the day's
   dispatch, notebook, travel — and papers that open one at a time. Counsel, your commission and the post all arrive as
   letters; the notebook holds matters in hand, your secretary's remarks, your staff's knowledge and the record. You give orders; you do not converse:
   every order, journey, inspection or answer to a letter is an entry in the day's dispatch, composed into the
   desk's own orders text (draft.case.text), so the packet for the adjudicator is unchanged in form. */
import { travel, loc, roadKm, letterDays, travelDays, placeOn, playerOn, routeDays, abedOn, abedDays, bedsideOn } from './places.js';
import { choose, choiceFor, trustOf, setTrust, book, earlierDecisions } from './campaign.js';
import { sceneLines, pendingOrders, QUESTIONS, MANNERS } from './turn.js';
import { personOf } from './people.js';
import { peopleFiles } from './dossier.js';
const $ = id => document.getElementById(id);
const ARCHIVE_KEY = 'cabinet-of-war:w3d-archive', CIPHER_KEY = 'cabinet-of-war:w3d-cipher', HEARD_KEY = 'cabinet-of-war:w3d-overheard', FAIR_KEY = 'cabinet-of-war:w3d-fair';
const SEEN_KEY = 'cabinet-of-war:w3d-seen-people';
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
    <div class="sh-l-grid"><div class="sh-l-col" id="sh-l-col"><button class="sh-l-toggle" id="sh-l-toggle" aria-expanded="true" aria-controls="sh-l-list">Choose a letter</button><ul class="sh-l-list" id="sh-l-list"></ul><div class="sh-post" id="sh-post" hidden></div></div><article class="sh-letter" id="sh-letter"></article></div>
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
        <div class="sh-give"><select id="sh-to"></select><textarea id="sh-give-t" rows="3" placeholder="What is to be done…"></textarea><label class="sh-purse"><input type="checkbox" id="sh-purse"> From my own purse</label><button id="sh-give-go">Add to the dispatch</button></div>
        <div class="eyebrow">Wake me</div>
        <select id="sh-wake" class="sh-wake"></select>
        <div class="eyebrow">Your instructions to your secretary</div>
        <p class="sh-hint sh-ins-sum" id="sh-ins-sum"></p><button class="sh-ins-b" id="sh-ins-b">Write them</button>
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
  // the Queen and the co-regent are petitioned, not ordered; a foreign sovereign is not written to by a minister at all
  const RULERS = new Set(['maria_theresa', 'francis_stephen']), ruler = c => !!c && (RULERS.has(c.id) || /\b(King|Queen|Elector|Emperor|Empress|Tsar|Tsarina|Sultan)\b/.test(c.name || ''));
  const whereNow = c => placeOn(c, today());
  // your steward travels with you; on the road no one else is about
  function presentHere(c) { if (c.id === 'steward') return !c.dead; if (abedOn(today())) return !travel.onRoad() && bedsideOn(today(), travel.here()).some(x => x.id === c.id); return !travel.onRoad() && whereNow(c) === travel.here() && !ruler(c) && c.id !== 'own-forces' && !c.dead; }

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
  const ref = i => 'T' + state.turn + '-' + (i + 1), ownRef = () => 'T' + state.turn + '-0'; // T<n>-0 is the order in his own words
  const W = () => draft.w3d || (draft.w3d = { own: ensureCase().text || '', items: [] }); // per turn: the desk replaces draft on a new turn
  function itemLine(it) {
    if (it.kind === 'journey' || it.kind === 'inspect' || it.kind === 'brief') return it.text;
    const r = it.ref && state.reports.find(x => x.id === it.ref), re = r ? 'On ' + fromName(r) + '’s letter of ' + fmtDate(r.dated) + ' (“' + r.title + '”) — ' : '';
    const own = it.purse ? 'At my own expense — ' : '';
    if (it.to === 'staff') return re + own + 'To my staff: ' + it.text;
    const c = cast(it.to), name = c ? c.name : it.to;
    return re + own + (it.inPerson ? 'To ' + name + ', given in person at ' + it.at + ': ' : 'To ' + name + ' at ' + it.at + ', by letter (about ' + it.days + ' day' + (it.days > 1 ? 's' : '') + ' on the road): ') + it.text;
  }
  function compose() {
    const w = W(), lines = w.items.map((it, i) => '[' + ref(i) + '] ' + itemLine(it)), own = w.own.trim();
    ensureCase().text = [own ? '[' + ownRef() + '] ' + own : '', w.memoir && w.memoir.trim() ? 'From my memoirs, written this turn:\n' + w.memoir.trim() : '', lines.length ? 'Orders given today (references in brackets):\n' + lines.join('\n') : ''].filter(Boolean).join('\n\n');
    saveDraft(); renderCase(); refresh(); if (!$('sh-sheet').hidden) renderSheet();
  }
  function setItem(it) { const w = W(); it.id = it.id || 'i' + Date.now().toString(36) + Math.floor(Math.random() * 1e3); const k = w.items.findIndex(x => x.id === it.id); if (k >= 0) w.items[k] = it; else w.items.push(it); compose(); return it.id; }
  function dropItem(id) { const w = W(); w.items = w.items.filter(x => x.id !== id); compose(); }
  // an order to someone: in person if they are here, otherwise by letter with its days on the road
  function orderTo(to, text, ref, purse) {
    const here = travel.here(), c = cast(to);
    if (to === 'staff' || !c) return setItem({ kind: 'order', to: 'staff', text, ref, purse });
    const inPerson = presentHere(c); return setItem({ kind: 'order', to, text, ref, purse, inPerson, at: inPerson ? locName(here) + (abedOn(today()) ? ', at my bedside' : '') : locName(whereNow(c)), days: inPerson ? 0 : Math.max(1, days(here, whereNow(c))) });
  }
  // older lines written straight into the text (before the dispatch had entries)
  function appendOrder(line) { setItem({ kind: 'inspect', text: line }); }
  function removeOrder(line) { const w = W(); if (line && w.own.includes(line)) { w.own = w.own.replace(line, '').replace(/\n{2,}/g, '\n').trim(); } w.items = w.items.filter(x => x.text !== line); compose(); }

  function renderSheet() {
    const S = state, w = W(), here = travel.here(), hl = loc(here);
    $('sh-sheet-eyebrow').textContent = 'Written at ' + locName(here) + ' · ' + fmtDate(shownDate()) + ' · turn ' + S.turn + (travel.get() ? ' · you set out for ' + locName(travel.get().to) + ' when it is sealed' : '');
    const ol = $('sh-items'); ol.replaceChildren();
    for (const it of w.items) {
      const li = el('li'), head = el('div', 'sh-it-h'), c = cast(it.to);
      head.textContent = (it.purse ? 'At your own expense · ' : '') + (it.kind === 'journey' ? 'Journey' : it.kind === 'brief' ? 'Prepared for an audience' : it.kind === 'inspect' ? 'In person' : it.to === 'staff' ? 'To my staff' : 'To ' + (c ? c.name : it.to) + (it.inPerson ? ' · in person' : ' · by letter, ~' + it.days + ' d'));
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
    const people = (S.cast || []).filter(c => c.id !== 'own-forces' && !ruler(c) && !c.dead);
    for (const c of people.filter(presentHere)) to.append(new Option(c.name + (abedOn(today()) ? ' — at your bedside, in person' : ' — here, in person'), c.id));
    for (const c of people.filter(c => !presentHere(c))) to.append(new Option(c.name + ' — ' + locName(whereNow(c)) + ', by letter ~' + Math.max(1, days(here, whereNow(c))) + ' d', c.id));
    if (was) to.value = was;
    const ins = state.instructions; $('sh-ins-sum').textContent = ins && ins.text ? '“' + ins.text.trim().slice(0, 140) + (ins.text.trim().length > 140 ? '…' : '') + '” — left ' + short(ins.revised || ins.written) : 'None left yet. Your secretary does only what each dispatch says.';
    $('sh-ins-b').textContent = ins && ins.text ? 'Revise them' : 'Write them';
    if (sealBtn) sealBtn.textContent = window.__campaign && window.__campaign.courier && window.__campaign.courier() === 'repo' ? 'Seal the dispatch & copy the courier’s errand' : 'Seal the dispatch & copy it for Claude';
    const wk = $('sh-wake'); if (!wk.options.length) for (const t of WAKE) wk.append(new Option(t, t)); wk.value = w.wake || WAKE[0];
    const far = ['vienna', 'breslau', 'prague'].filter(id => id !== here && hl && loc(id)).map(id => locName(id) + ' ' + days(here, id) + ' d');
    $('sh-days').textContent = far.length ? 'From ' + locName(here) + ' a letter takes about: ' + far.join(' · ') + '.' : '';
  }
  $('sh-own').oninput = e => { W().own = e.target.value; compose(); };
  const WAKE = ['When there is news I must decide on.', 'When the first answers to these orders arrive.', 'In three days, whatever happens.', 'In a week, unless something urgent comes.', 'Not before a fortnight, unless something urgent comes.', 'Only for what my instructions to my secretary do not cover.', 'Not for a month, unless something my instructions do not cover arrives.'];
  $('sh-ins-b').onclick = () => showInstructions();
  $('sh-wake').onchange = e => { W().wake = e.target.value; saveDraft(); };
  $('sh-give-go').onclick = () => { const t = $('sh-give-t').value.trim(); if (!t) return; orderTo($('sh-to').value, t, null, $('sh-purse').checked); $('sh-give-t').value = ''; $('sh-purse').checked = false; };

  /* ---------- the post: letters reach you day by day through the turn ---------- */
  const arrives = r => r.arrives || r.dated;
  // the Wiennerisches Diarium's issues come with the post like letters (state.gazette, from the reply)
  const gazettes = () => (state.gazette || []).map(g => ({ id: g.id || 'gz-' + g.date, kind: 'gazette', from: 'Wiennerisches Diarium', place: 'vienna', dated: g.date, arrives: g.date, title: (g.items[0] || {}).head || 'The Diarium', text: '', items: g.items, via: 'post' }));
  // a meeting in person comes on its day too, written out on paper (state.scene, from the reply)
  const scenes = () => { const sc = state.scene; if (!sc || !(sc.lines || []).length) return []; const d = sc.date || state.date, who = (sc.participants || []).find(p => p.id !== 'player') || {};
    return [{ id: 'scene-' + (sc.id || d), kind: 'scene', from_id: who.id, from: who.name || 'In person', place: sc.place || playerOn(d), dated: d, arrives: d, title: sc.title || 'A meeting', via: 'audience', scene: sc }]; };
  const post = () => [...state.reports, ...gazettes(), ...scenes()];
  const postDays = () => [...new Set(post().map(arrives))].sort();
  // the days worth living through: the post, your own setting out and arriving, anyone to be seen where you are, and the day you are woken
  const turnFrom = () => (state.span && state.span.from) || null;
  function eventDays() { const from = turnFrom(), seenThere = (state.whereabouts || []).filter(w => w && w.date && w.place === playerOn(w.date)).map(w => w.date);
    return [...new Set([...postDays(), ...routeDays(), ...abedDays(), ...seenThere, state.date].filter(d => d && (!from || d >= from) && d <= state.date))].sort(); }
  function today() { const p = store(POST_KEY, null); if (p && p.turn === state.turn) return p.upto; const d = turnFrom() || eventDays()[0] || state.date; keep(POST_KEY, { turn: state.turn, upto: d }); return d; }
  const onTheRoad = () => post().filter(r => arrives(r) > today());
  const nextDay = () => eventDays().find(d => d > today()) || null;
  const shownDate = () => today();
  function passDay() { for (const r of seen()) if (r.urgent && !choiceFor(r.id)) { const d = r.urgent.options.find(o => o.default) || r.urgent.options[r.urgent.options.length - 1]; choose(r, d.id, true); act('toast:The day passed without your answer to “' + r.title + '”; ' + d.label.replace(/^./, x => x.toLowerCase()) + '.'); }
    const was = playerOn(today()), bedWas = abedOn(today()), next = nextDay(); if (!next) return 0; keep(POST_KEY, { turn: state.turn, upto: next });
    const now = playerOn(next); if (now !== was) act('toast:' + (now === 'road' ? 'You set out on the road to ' + locName(state.player.locationId) + '.' : 'You arrive at ' + locName(now) + '.'));
    if (abedOn(next) !== bedWas) act('toast:' + (abedOn(next) ? 'You keep to your bed.' : 'You are out of your bed again.'));
    return post().filter(r => arrives(r) === next).length; }
  const seen = () => post().filter(r => arrives(r) <= today());
  const seenLetters = () => seen().filter(r => r.kind !== 'gazette' && r.kind !== 'scene');
  // the secretary's letter: what changed, why it matters, what wants your orders (state.staffBriefing; after the opening, the
  // turn's briefing on the day you are woken if the reply gave none). It arrives on its day, like any letter.
  function briefingLetter() {
    const b = state.staffBriefing; if (!b && !(state.turn > 0 && state.briefing)) return null;
    const d = (b && b.dated) || state.date, at = playerOn(d);
    return { id: 'briefing-' + state.turn, kind: 'briefing', from_id: 'secretary', place: at === 'road' ? null : at, dated: d, arrives: d, title: (b && b.title) || 'How matters stand', b: b || { changed: state.briefing }, via: 'audience' };
  }
  // your commission and your advisers' counsel come as letters as well
  function letters() {
    const out = [], m = state.mandate, d = state.decision, br = briefingLetter();
    if (br && br.arrives <= today()) out.push(br);
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
  const acted = () => { const a = actedRaw(), out = {}; for (const r of letters()) if (a[rk(r)]) out[r.id] = a[rk(r)]; else if (r.handled) out[r.id] = 'handled'; return out; };
  const setActed = (id, how) => { const a = actedRaw(); if (how) a[rkOf(id)] = how; else delete a[rkOf(id)]; keep(ACTED_KEY, a); };
  // which sealed order a letter answers (the adjudicator marks reports with "re": ["T0-3", …])
  const sentOrders = () => store(SENT_KEY, []).flatMap(s => s.orders.map(o => typeof o === 'string' ? { ref: null, line: o, date: s.date, turn: s.turn } : { ...o, date: s.date, turn: s.turn }));
  // if the reply did not tag a report, match it ourselves: it names the reference (sure), or it comes from the person
  // the order went to, or it shares the order's key words (probable). Only orders sealed before this turn can be answered.
  const STOP = new Set('about after again their there these those which while where would could should shall other every under order orders letter state staff report write writing person given today'.split(' '));
  const words = t => new Set((t || '').toLowerCase().match(/[a-zà-ž]{5,}/g)?.filter(w => !STOP.has(w)) || []);
  function links() {
    const out = new Map(), orders = sentOrders().filter(o => o.ref && o.turn < state.turn), tagged = new Set(seenLetters().flatMap(r => r.re || []));
    const add = (ref, r, sure) => { if (!out.has(ref)) out.set(ref, []); if (!out.get(ref).some(x => x.r === r)) out.get(ref).push({ r, sure }); };
    for (const r of seenLetters()) for (const id of r.re || []) add(id, r, true);
    for (const r of seen().filter(x => x.kind === 'scene')) for (const id of r.scene.re || []) add(id, r, true);
    for (const o of orders) { if (tagged.has(o.ref)) continue; const ow = words(o.text || o.line);
      for (const r of seenLetters()) { if ((r.re || []).length) continue; const body = r.title + ' ' + r.text;
        if (body.includes(o.ref)) { add(o.ref, r, true); continue; }
        const rw = words(body); let k = 0; for (const w of ow) if (rw.has(w)) k++;
        if ((o.to && o.to !== 'staff' && r.from_id === o.to) || k >= 2) add(o.ref, r, false); } }
    return out;
  }
  const answersTo = refId => links().get(refId) || [];
  // answered before this turn: the record keeps it, though the letter or meeting that answered it is now in the archive
  const answeredBefore = () => { const now = new Set([...(state.reports || []).flatMap(r => r.re || []), ...((state.scene || {}).re || [])]); return new Set(((state.exchange || {}).answered || []).filter(x => !now.has(x))); };
  const isAnswered = refId => !!refId && (answersTo(refId).length > 0 || answeredBefore().has(refId));
  const answeredBy = r => [...links()].filter(([, a]) => a.some(x => x.r === r)).map(([id, a]) => ({ id, sure: a.find(x => x.r === r).sure }));
  let openLetter = null, listMode = 'now';
  // on a phone the list of letters folds away while you read; on a wide screen it always stands open
  // (a plain column, not <details>: the list must stay a flex child to scroll inside the paper)
  const narrow = matchMedia('(max-width: 640px)'), foldIndex = fold => { $('sh-l-col').classList.toggle('folded', fold); $('sh-l-toggle').setAttribute('aria-expanded', String(!fold)); };
  foldIndex(narrow.matches); narrow.addEventListener('change', () => foldIndex(narrow.matches));
  $('sh-l-toggle').onclick = () => foldIndex(!$('sh-l-col').classList.contains('folded'));
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
    const all = letters(), arch = archived(), rs = listMode === 'archive' ? arch : [...all.filter(x => x.kind && x.kind !== 'gazette' && x.kind !== 'scene'), ...all.filter(x => !x.kind || x.kind === 'gazette' || x.kind === 'scene').reverse()], r = readSet(), a = acted();
    const before = openLetter; openLetter = id || openLetter && rs.find(x => x.id === openLetter)?.id || (unread()[0] || rs[0] || {}).id;
    const ul = $('sh-l-list'); ul.replaceChildren();
    const tabs = el('li', 'sh-l-tabs'); for (const [m, lab] of [['now', 'This turn'], ['archive', 'Your archive' + (arch.length ? ' (' + arch.length + ')' : '')]]) { const b = el('button', listMode === m ? 'on' : null, lab); b.onclick = () => { openLetter = null; showLetters(null, m); }; tabs.append(b); } ul.append(tabs);
    for (const x of rs) {
      const li = el('li', (x.id === openLetter ? 'sh-l-on ' : '') + (r.has(rk(x)) ? 'sh-l-read' : 'sh-l-sealed')); li.tabIndex = 0;
      const sl = (personOf(x.from_id).seal || ['#8a2f26', '#f3ead8', (fromName(x)[0] || '·')]);
      li.innerHTML = '<i class="sh-seal" style="--seal-c:' + sl[0] + ';--seal-t:' + sl[1] + '">' + esc(sl[2]) + '</i><b>' + esc(fromName(x)) + '</b><small>' + (x.kind === 'briefing' ? 'how matters stand · ' + short(x.dated) : x.kind === 'mandate' ? 'your commission' : x.kind === 'advice' ? 'counsel' : x.kind === 'gazette' ? 'the gazette · ' + short(x.dated) : x.kind === 'scene' ? 'in person · ' + esc(locName(x.place)) + ' · ' + short(x.dated) : esc(locName(x.place)) + ' · ' + short(x.dated)) + (a[x.id] ? ' · ' + ({ filed: 'filed', adopted: 'adopted', aside: 'set aside', handled: 'handled in your name' }[a[x.id]] || 'answered') : '') + '</small><span>' + esc(x.title) + '</span>';
      li.onclick = li.onkeydown = ev => { if (ev.type === 'keydown' && ev.key !== 'Enter') return; showLetters(x.id); }; ul.append(li);
    }
    if (!rs.length) ul.append(el('li', 'sh-empty', listMode === 'archive' ? 'Nothing kept from earlier turns yet.' : 'No letters have reached you.'));
    const L = rs.find(x => x.id === openLetter); if (L) { if (!readSet().has(rk(L))) act('sound:seal'); drawLetter(L); if (id && id !== before) { $('sh-letter').scrollTop = 0; if (narrow.matches) foldIndex(true); } markRead(L.id); } else $('sh-letter').replaceChildren();
    const road = !!nextDay(), post = $('sh-post'); post.hidden = !road; post.replaceChildren();
    if (road) { post.append(el('p', null, onTheRoad().length ? 'More letters are on the road.' : 'The days pass until you are woken.')); const b = el('button', null, 'Let the day pass'); b.onclick = () => { const n = passDay(); act('post:' + n); showLetters(); }; post.append(b); post.append(waitingRow()); }
    $('sh-letters').hidden = false; syncVeil(); refresh();
  }
  function drawLetter(r) {
    $('sh-letter').onclick = null;
    if (r.kind === 'gazette') return drawGazette(r);
    if (r.kind === 'scene') return drawScene(r);
    if (r.kind === 'briefing') return drawBriefing(r);
    const box = $('sh-letter'), here = travel.here(), c = cast(r.from_id), d = days(r.place, here), a = acted()[r.id];
    const via = { courier: 'by courier', post: 'by the post', audience: 'given you in person' }[r.via] || 'received';
    // only what the letter itself says it answers; the notebook may guess, the letter does not
    const answers = answeredBy(r).filter(x => x.sure).map(({ id }) => sentOrders().find(o => o.ref === id) || { ref: id });
    const hand = personOf(r.from_id).hand, fair = !!store(FAIR_KEY, false), ok = readable(r), ic = r.intercepted;
    box.innerHTML = '<div class="sh-lt-sheet' + (hand && !fair ? ' sh-hand' : '') + (ic ? ' sh-lt-intercepted' : '') + '"' + (hand ? ' style="--hand:' + esc(hand) + '"' : '') + '>'
      + (ic ? '<div class="sh-lt-ic">Intercepted — from ' + esc(ic.from || 'unknown') + ' to ' + esc(ic.to || 'unknown') + '</div>' : '')
      + '<div class="sh-lt-head">' + esc(locName(r.place)) + ', ' + esc(fmtDate(r.dated)) + '</div>'
      + (r.handled ? '<div class="sh-lt-re sh-lt-handled">Handled in your name, under your instructions: ' + esc(r.handled) + '</div>' : '')
      + follows(r).map(f => '<div class="sh-lt-re sh-lt-follows">This bears on ' + esc(f.label) + (f.date ? ' <small>(' + esc(fmtDate(f.date)) + ')</small>' : '') + '</div>').join('')
      + answers.map(o => { const said = o.text || ''; return '<div class="sh-lt-re">In answer to your order' + (o.date ? ' of ' + esc(fmtDate(o.date)) : '') + (o.to && o.to !== 'staff' && cast(o.to) ? ' to ' + esc(cast(o.to).name) : '') + (said ? ': “' + esc(said.length > 120 ? said.slice(0, 120) + '…' : said) + '”' : '') + '</div>'; }).join('')
      + (r.category ? '<div class="sh-lt-cat">Concerning ' + esc(r.category.replace(/^(The|A|An|Your|His|Her|Our|Home|Money|News)\b/, w => w.toLowerCase())) + '</div>' : '')
      + '<h3>' + esc(ok ? r.title : 'A letter in cipher') + '</h3><p class="sh-lt-body' + (ok ? '' : ' sh-cipher') + '">' + (ok ? linked(r.text) : esc(cipherText(r.text))) + '</p>'
      + '<p class="sh-lt-sig">' + esc(fromName(r)) + (c && c.office ? '<small>' + esc(c.office) + '</small>' : '') + '</p>'
      + (r.kind === 'advice' ? questionsHtml(r) + [['What is not known', r.o.unknown], ['Who does the work', r.o.delegation]].filter(([, v]) => v).map(([k, v]) => '<p class="sh-lt-ps"><i>' + k + '.</i> ' + esc(v) + '</p>').join('') + debateHtml() : '')
      + (ok ? guidanceHtml(r.kind === 'advice' ? r.o.guidance : r.guidance, r.kind === 'advice' ? 'What they know, and what they only suspect' : null) : '')
      + (r.source ? '<p class="sh-lt-src">Their source: ' + esc(r.source) + (trustOf(r.source) ? ' <i>· you ' + trustOf(r.source) + ' this source</i>' : '') + '</p>' : '')
      + (r.urgent && ok ? '<div class="sh-urgent"><b>' + esc(r.urgent.prompt || 'This needs your answer today.') + '</b>' + (choiceFor(r.id) ? '<p>' + (choiceFor(r.id).byDefault ? 'The day passed without your answer: ' : 'You answered: ') + esc(choiceFor(r.id).label) + '</p>' : '') + '</div>' : '')
      + '<p class="sh-lt-foot">' + via + (r.via !== 'audience' && d ? ' · from ' + esc(locName(r.place)) + ' a letter is about ' + d + ' day' + (d > 1 ? 's' : '') + ' on the road to ' + esc(locName(here)) : '') + '</p></div>'
      + (ok ? enclosures(r) : '');
    box.firstChild.classList.toggle('sh-lt-commission', r.kind === 'mandate');
    if (ok && r.kind !== 'mandate') box.firstChild.insertAdjacentHTML('beforeend', onMapHtml(r));
    wireLetter(box, r);
    const acts = el('div', 'sh-lt-acts');
    if (!ok) { const c = ciphers()[rk(r)], b = el('button', 'sh-primary', c ? 'Your clerk is working on it' : 'Give it to your clerk'); b.disabled = !!c; b.onclick = () => { const all = ciphers(); all[rk(r)] = { day: today(), ready: (clock ? clock.hour : 9) + 3 }; keep(CIPHER_KEY, all); act('hours:.25'); act('toast:Your clerk takes it away; he expects to have it in clear in about three hours.'); showLetters(r.id); }; acts.append(b); box.append(acts); return; }
    if (hand) { const f = el('button', 'sh-fair', fair ? 'Read it in their hand' : 'Read the fair copy'); f.onclick = () => { keep(FAIR_KEY, !fair); showLetters(r.id); }; acts.append(f); }
    if (c && c.id && c.id !== 'secretary') { const pf = el('button', 'sh-fair', 'Your file on them'); pf.onclick = () => showNotebook('person:' + c.id); acts.append(pf); }
    if (r.kind === 'mandate') { box.append(acts); if (state.player.dismissed) acts.append(el('p', 'sh-done', 'Your commission has been withdrawn.')); return; }
    if (r.kind === 'advice') {
      const on = draft.option === r.o.id; if (on) acts.append(el('p', 'sh-done', 'This is the course you have adopted; it goes with the dispatch.'));
      const ad = el('button', 'sh-primary', on ? 'Withdraw your assent' : 'Adopt this course'), aside = el('button', null, 'Set it aside');
      ad.onclick = () => { draft.option = on ? '' : r.o.id; saveDraft(); renderAll(); setActed(r.id, on ? null : 'adopted'); showLetters(r.id); };
      aside.onclick = () => { if (on) { draft.option = ''; saveDraft(); renderAll(); } setActed(r.id, 'aside'); showLetters(r.id); };
      acts.append(ad, aside); box.append(acts); return;
    }
    if (r.urgent && !choiceFor(r.id)) { for (const o of r.urgent.options) { const b = el('button', 'sh-primary', o.label); b.onclick = () => { choose(r, o.id); setActed(r.id, 'ordered'); act('sound:seal'); act('toast:Your answer goes at once.'); showLetters(r.id); }; acts.append(b); } box.append(acts); trustRow(r, box); return; }
    if (a) acts.append(el('p', 'sh-done', a === 'filed' ? 'Filed without orders.' : a === 'handled' ? 'Your secretary has dealt with it. You may still give orders on it.' : 'You have given orders on this letter.'));
    const give = el('button', 'sh-primary', a === 'ordered' ? 'Give further orders on it' : 'Give orders on this');
    const file = el('button', null, a === 'filed' ? 'Back among matters in hand' : 'File it — no orders');
    const show = el('button', null, 'Follow it on the map');
    give.onclick = () => composeOn(r, acts);
    file.onclick = () => { setActed(r.id, a === 'filed' ? null : 'filed'); showLetters(r.id); };
    show.onclick = () => toMap(r);
    acts.append(give, file, show);
    if (r.sighting) { const sg = el('button', null, 'Where they place it'); sg.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('sighting:' + r.id); }; acts.append(sg); }
    if (r.battle) { const bt = el('button', null, 'See the ground as described'); bt.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('account'); }; acts.append(bt); }
    if (r.battle && (state.battleDemo || {}).aftermath) { const af = el('button', null, 'Ride over the field afterwards'); af.onclick = () => { $('sh-letters').hidden = true; syncVeil(); act('aftermath'); }; acts.append(af); }
    box.append(acts); trustRow(r, box);
  }
  // how far you believe whoever saw or heard it: your staff weigh their reports by it, and you can be wrong
  function trustRow(r, box) {
    if (!r.source) return; const m = trustOf(r.source), row = el('div', 'sh-trust');
    row.append(el('span', null, 'Their source, ' + r.source + ':'));
    for (const [k, lab] of [['trust', 'I trust it'], ['doubt', 'I doubt it']]) { const b = el('button', m === k ? 'on' : null, lab); b.onclick = () => { setTrust(r.source, m === k ? null : k); act('toast:' + (m === k ? 'Your staff will weigh this source as they see fit.' : k === 'trust' ? 'Your staff will treat this source as reliable.' : 'Your staff will treat this source with caution.')); showLetters(r.id); }; row.append(b); }
    box.append(row);
  }
  /* ---------- your staff explain: the secretary's letter, the note on a letter, counsel you can question ---------- */
  const GUIDE = [['known', 'What is known'], ['suspected', 'What is suspected'], ['disputed', 'Where accounts differ'], ['stakes', 'What it means for you'], ['explain', 'How such things go']];
  function guidanceHtml(g, title, open) {
    const rows = GUIDE.filter(([k]) => g && g[k]); if (!rows.length) return '';
    return '<details class="sh-explain"' + (open ? ' open' : '') + '><summary>' + esc(title || 'What they know, and what they only suspect') + '</summary>' + rows.map(([k, lab]) => '<p><i>' + lab + '.</i> ' + linked(g[k]) + '</p>').join('') + '</details>';
  }
  // what a letter says came of your own decisions (its "follows": courses in council, answers at once, promises in person)
  const follows = r => { const all = earlierDecisions(); return (r.follows || []).map(id => all.find(d => d.id === id)).filter(Boolean); };
  // places and the movements you have heard of, as they are named in a letter: each opens the map there
  const heard = () => (state.movements || []).filter(m => m && m.label && (!m.reported || m.reported <= today()));
  const reEsc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function namesIn(text) {
    const t = text || '', out = [];
    for (const l of state.locations || []) if (l.name && l.name.length > 2 && new RegExp('(^|[^\\p{L}])' + reEsc(l.name) + '(?![\\p{L}])', 'u').test(t)) out.push({ kind: 'place', id: l.id, name: l.name });
    for (const m of heard()) if (m.label.length > 4 && t.toLowerCase().includes(m.label.toLowerCase())) out.push({ kind: 'move', id: m.id, name: m.label });
    return out;
  }
  function linked(text) {
    const names = namesIn(text).sort((a, b) => b.name.length - a.name.length); let h = esc(text || '');
    if (!names.length) return h;
    const re = new RegExp('(^|[^\\p{L}])(' + names.map(n => reEsc(esc(n.name))).join('|') + ')(?![\\p{L}])', 'giu');
    return h.replace(re, (all, pre, w) => { const n = names.find(x => esc(x.name).toLowerCase() === w.toLowerCase()); return pre + (n ? '<button type="button" class="sh-lk" data-' + n.kind + '="' + esc(n.id) + '" title="Show on the map">' + w + '</button>' : w); });
  }
  // the places and forces a letter names, with its own road: where and when it was written, where it reached you
  function onMapHtml(r) {
    const texts = [r.text, r.title, ...(r.b ? [r.b.changed, r.b.stakes, r.b.attention] : []), ...Object.values(r.guidance || (r.o && r.o.guidance) || {})].join(' \n ');
    const seenIds = new Set(), items = [...(r.place && loc(r.place) ? [{ kind: 'place', id: r.place, name: locName(r.place) }] : []), ...((r.b && r.b.places) || []).filter(loc).map(id => ({ kind: 'place', id, name: locName(id) })), ...namesIn(texts)]
      .filter(x => !seenIds.has(x.kind + x.id) && seenIds.add(x.kind + x.id));
    if (!items.length) return '';
    return '<div class="sh-onmap"><i>On the map</i>' + items.map(x => '<button type="button" class="sh-lk" data-' + x.kind + '="' + esc(x.id) + '">' + esc(x.name) + (x.kind === 'move' ? ' <small>· last reported</small>' : '') + '</button>').join('') + '</div>';
  }
  function toMap(r, target) { $('sh-letters').hidden = true; syncVeil(); act('letter-map:' + r.id + (target ? '|' + target : '')); }
  // a question put to counsel: the answer they gave, inline; one they did not give becomes an order to them
  const QASK = { why: t => 'Set down for me in writing why you advise “' + t + '”.', needs: t => 'Tell me in writing what “' + t + '” would require: men, money, time, and whose consent.', risk: t => 'Tell me in writing what could go wrong with “' + t + '”, and how we should know of it early.', wait: t => 'Tell me in writing what follows if we decide nothing on “' + t + '” for a fortnight.' };
  const asked = new Set();
  function questionsHtml(r) {
    const who = fromName(r);
    return '<div class="sh-qs"><i>Put a question to ' + esc(who) + '</i><div class="sh-q-row">' + QUESTIONS.map(([k, lab]) => '<button type="button" class="sh-q' + (asked.has(r.id + k) ? ' on' : '') + '" data-q="' + k + '" aria-expanded="' + asked.has(r.id + k) + '">' + lab + '</button>').join('') + '</div>'
      + QUESTIONS.filter(([k]) => asked.has(r.id + k)).map(([k, lab, f]) => '<div class="sh-q-a"><b>' + lab + '</b> ' + (r.o[f] ? linked(r.o[f]) : '<span class="sh-q-none">' + esc(who) + ' has not said. You can ask in the dispatch.</span> <button type="button" class="sh-q-ask" data-ask="' + k + '">Ask ' + esc(who) + ' in writing</button>') + '</div>').join('') + '</div>';
  }
  function debateHtml() {
    const d = state.decision, ls = (d && d.debate) || []; if (!ls.length) return '';
    const name = w => (cast(w) || {}).name || w;
    return '<div class="sh-debate"><i>Where they differ in council</i>' + ls.map(l => '<p><b>' + esc(name(l.who)) + '.</b> ' + linked(l.text) + '</p>').join('') + '</div>';
  }
  const redraw = r => { const box = $('sh-letter'), y = box.scrollTop; drawLetter(r); box.scrollTop = y; };
  function wireLetter(box, r) {
    box.onclick = e => {
      const lk = e.target.closest('.sh-lk'); if (lk) return toMap(r, lk.dataset.place ? 'place:' + lk.dataset.place : 'move:' + lk.dataset.move);
      const q = e.target.closest('.sh-q'); if (q && r.o) { const k = r.id + q.dataset.q; asked.has(k) ? asked.delete(k) : asked.add(k); return redraw(r); }
      const ask = e.target.closest('.sh-q-ask'); if (ask && r.o) { const text = QASK[ask.dataset.ask](r.o.title); if (W().items.some(x => x.text === text)) return act('toast:That question is already in the dispatch.'); orderTo(r.from_id && cast(r.from_id) ? r.from_id : 'staff', text, null); act('toast:Added to the day’s dispatch.'); return redraw(r); }
      const lt = e.target.closest('[data-letter]'); if (lt) return showLetters(lt.dataset.letter);
    };
  }
  // the secretary's letter: plain sections, the letters behind it (only those come), the places on the map
  function drawBriefing(r) {
    const b = r.b, box = $('sh-letter'), sec = (k, lab) => b[k] ? '<h4 class="sh-bf-h">' + lab + '</h4><p class="sh-lt-body">' + linked(b[k]) + '</p>' : '';
    const come = new Set(seen().map(x => x.id)), ls = (b.letters || []).filter(id => come.has(id)).map(id => state.reports.find(x => x.id === id)).filter(Boolean);
    const sc = cast('secretary');
    box.innerHTML = '<div class="sh-lt-sheet sh-briefing"><div class="sh-lt-head">' + esc(r.place ? locName(r.place) : 'On the road') + ', ' + esc(fmtDate(r.dated)) + '</div><h3>' + esc(r.title) + '</h3>'
      + sec('changed', 'What has changed') + sec('stakes', 'Why it matters to you') + sec('attention', 'What wants your orders')
      + (ls.length ? '<div class="sh-bf-letters"><i>The letters behind this</i>' + ls.map(x => '<button type="button" data-letter="' + esc(x.id) + '">' + esc(fromName(x)) + ' — “' + esc(x.title) + '”</button>').join('') + '</div>' : '')
      + guidanceHtml(b.guidance, 'What is known, and what is not', true)
      + '<p class="sh-lt-sig">' + esc((sc && sc.name) || 'Your secretary') + '<small>set down for you</small></p></div>';
    box.firstChild.insertAdjacentHTML('beforeend', onMapHtml(r)); wireLetter(box, r);
    const acts = el('div', 'sh-lt-acts'), go = el('button', 'sh-primary', 'Open the day’s dispatch'), file = el('button', null, 'Put it with your papers');
    go.onclick = () => toggleSheet(true); file.onclick = () => { setActed(r.id, 'filed'); showLetters(); };
    acts.append(go, file); box.append(acts);
  }
  // a meeting as it was said: the setting, each speaker by name, you as "You", narration in italics, what was promised
  function drawScene(r) {
    const sc = r.scene, box = $('sh-letter'), cm = (sc.commitments || []).map(c => typeof c === 'string' ? c : c.text).filter(Boolean);
    box.innerHTML = '<div class="sh-lt-sheet sh-scene"><div class="sh-lt-head">' + esc(locName(r.place)) + ', ' + esc(fmtDate(r.dated)) + '</div><h3>' + esc(r.title) + '</h3>'
      + (sc.setting ? '<p class="sc-setting">' + esc(sc.setting) + '</p>' : '')
      + sceneLines(sc, state.cast).map(l => l.who ? '<p class="sc-line"><b>' + esc(l.who) + '.</b> ' + esc(l.text) + '</p>' : '<p class="sc-narr">' + esc(l.text) + '</p>').join('')
      + (cm.length ? '<div class="sc-commit"><i>Undertaken</i><ul>' + cm.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' : '')
      + '<p class="sh-lt-foot">in person · set down by your secretary</p></div>';
    const acts = el('div', 'sh-lt-acts'), file = el('button', null, 'Put it with your papers'); file.onclick = () => { setActed(r.id, 'filed'); showLetters(); }; acts.append(file); box.append(acts);
  }
  // the public version: printed, late, deferential, sometimes wrong
  function drawGazette(r) {
    const box = $('sh-letter');
    box.innerHTML = '<div class="sh-lt-sheet sh-gazette"><div class="gz-mast">Wiennerisches Diarium</div><div class="gz-date">' + esc(fmtDate(r.dated)) + ' · printed by authority</div>'
      + r.items.map(i => '<h4>' + esc(i.head || '') + '</h4><p>' + esc(i.text || '') + '</p>').join('') + '</div>';
    const acts = el('div', 'sh-lt-acts'), file = el('button', null, 'Put the paper down'); file.onclick = () => { setActed(r.id, 'filed'); showLetters(); }; acts.append(file); box.append(acts);
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
    const c = cast(r.from_id); if (c && !ruler(c)) to.append(new Option(presentHere(c) ? 'To ' + c.name + ', in person' : 'To ' + c.name + ' at ' + locName(whereNow(c)) + ', by letter ~' + Math.max(1, days(travel.here(), whereNow(c))) + ' d', c.id));
    to.append(new Option('To my staff', 'staff'));
    const go = el('button', 'sh-primary', 'Add to the dispatch'); f.append(to, t, go); acts.replaceChildren(f); t.focus();
    f.onsubmit = e => { e.preventDefault(); if (!t.value.trim()) return; orderTo(to.value, t.value.trim(), r.id); setActed(r.id, 'ordered'); act('toast:Added to the day’s dispatch.'); showLetters(r.id); };
  }

  /* ---------- notebook: matters in hand, the situation, what you know ---------- */
  function recordSent() { const w = W(), sent = store(SENT_KEY, []).filter(s => s.turn !== state.turn); sent.push({ turn: state.turn, date: state.date, at: locName(travel.here()), orders: [...(w.own.trim() ? [{ ref: ownRef(), line: 'In my own words: ' + w.own.trim(), to: null, text: w.own.trim() }] : []), ...w.items.map((it, i) => ({ ref: ref(i), line: itemLine(it), to: it.to || null, text: it.text }))], own: w.own.trim().slice(0, 160) }); keep(SENT_KEY, sent.filter(s => s.turn >= state.turn - 7 || (!s.settled && pendingOrders(state, [s], Object.values(archive())).some(o => (s.orders || []).some(x => x.ref === o.ref))))); }
  function matters() {
    const a = acted(), out = [];
    for (const r of seenLetters()) if (!a[r.id]) out.push({ k: 'letter', r });
    if (state.decision && !draft.option && !letters().some(x => x.kind === 'advice' && a[x.id])) out.push({ k: 'council' });
    if (nextDay()) out.push({ k: 'post' });
    for (const s of store(SENT_KEY, [])) { if (s.settled) continue; const os = s.orders.map(o => typeof o === 'string' ? { ref: null, line: o } : o); if (os.length && os.every(o => isAnswered(o.ref))) continue; out.push({ k: 'sent', s, os }); }
    if (travel.get()) out.push({ k: 'journey' });
    for (const p of state.pending || []) out.push({ k: 'pending', p });
    for (const u of undertakings()) if (u.shown.status === 'stalled' && u.shown.date >= (turnFrom() || state.date)) out.push({ k: 'stalled', u });
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
        const done = x.os.filter(o => isAnswered(o.ref)).length;
        li.innerHTML = '<b>Your dispatch of ' + short(x.s.date) + '</b> from ' + esc(x.s.at) + (state.turn > x.s.turn ? ' — ' + done + ' of ' + x.os.length + ' orders answered' : ' — on the road');
        const sub = el('div', 'sh-orders');
        for (const o of x.os) { const ans = o.ref ? answersTo(o.ref) : [], row = el('div', isAnswered(o.ref) ? 'sh-o-ok' : 'sh-o-wait'); row.append(el('span', 'sh-o-ref', o.ref ? o.ref.split('-').pop() : '·'), el('span', 'sh-o-t', o.line.length > 110 ? o.line.slice(0, 110) + '…' : o.line));
          for (const { r, sure } of ans) { const lb = el('button', 'sh-o-lnk' + (sure ? '' : ' sh-o-maybe'), (sure ? 'Answered by ' : 'Probably answered by ') + fromName(r) + ' →'); lb.onclick = () => showLetters(r.id); row.append(lb); }
          if (!ans.length) row.append(el('span', 'sh-o-st', isAnswered(o.ref) ? 'answered' : state.turn > x.s.turn ? 'no answer yet' : /, given in person at |^In my own words: /.test(o.line) ? 'given' : 'on the road')); sub.append(row); }
        if (!x.os.length) sub.append(el('div', 'sh-o-wait', x.s.own || 'standing orders'));
        li.append(sub); const b = el('button', null, 'Settled'); b.onclick = () => { const all = store(SENT_KEY, []); const t = all.find(s => s.turn === x.s.turn); if (t) t.settled = true; keep(SENT_KEY, all); showNotebook(); refresh(); }; li.append(b); }
      if (x.k === 'council') { li.innerHTML = '<b>Your advisers await your decision</b> · ' + esc(state.decision.title); const b = el('button', null, 'Read their counsel'); b.onclick = () => showPanel('council'); li.append(b); }
      if (x.k === 'post') { li.innerHTML = '<b>' + (onTheRoad().length ? 'More letters are on the road' : 'The days pass until you are woken') + '</b>'; const b = el('button', null, 'Let the day pass'); b.onclick = () => { const n = passDay(); act('post:' + n); showNotebook(); }; li.append(b, waitingRow()); }
      if (x.k === 'journey') li.innerHTML = '<b>Your journey</b> to ' + esc(locName(travel.get().to)) + ' — you set out when the dispatch is sealed';
      if (x.k === 'stalled') { li.innerHTML = '<b>Stalled:</b> ' + esc(x.u.title) + ' — ' + esc(x.u.shown.stage); const b = el('button', null, 'Give orders on it'); b.onclick = () => orderOn(x.u); li.append(b); }
      if (x.k === 'pending') li.textContent = typeof x.p === 'string' ? x.p : (x.p.title || x.p.text || JSON.stringify(x.p));
      ul.append(li);
    }
    if (!m.length) ul.append(el('li', 'sh-empty', 'Nothing outstanding.'));
    deskSections(sec); peopleSection(sec, open);
    if (state.mandate) { const sc = sec(state.player.dismissed ? 'Your commission — withdrawn' : 'Your commission'); sc.append(el('p', 'sh-nb-quote', state.mandate.text)); const b = el('button', 'sh-nb-link', 'Read the letter'); b.onclick = () => showLetters('mandate'); sc.append(b); }
    if (state.epilogue) { const e = state.epilogue, se = sec(e.title || 'The verdict of history'); se.append(el('p', 'sh-nb-quote', e.text || '')); if (e.verdict) se.append(el('p', 'sh-nb-remark', e.verdict)); const b = el('button', 'sh-nb-link', 'Read the book of the campaign, with what was hidden'); b.onclick = () => showBook(); se.append(b); }
    if ((state.remarks || []).length) { const sr = sec('Your secretary’s remarks'); for (const t of state.remarks) sr.append(el('p', 'sh-nb-remark', t)); }
    const hh = state.household; if (hh) { const sh = sec('Your household'), sp = cast(hh.spouse), kids = (hh.children || []).map(k => k.name).join(' and ');
      if (sp) sh.append(el('p', null, sp.name + ', your wife' + (sp.place && sp.place !== travel.here() ? ', is at ' + locName(sp.place) : ', is here') + '.'));
      if (kids) sh.append(el('p', null, 'Your daughters: ' + kids + '.')); if (hh.estate) sh.append(el('p', null, hh.estate));
      if (hh.purse) sh.append(el('p', 'sh-nb-remark', 'Your steward: “' + hh.purse + '”'));
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
    if (typeof open === 'string' && open.startsWith('person:')) setTimeout(() => { const f = $('sh-pp-' + open.slice(7)); if (f) f.scrollIntoView({ block: 'start' }); }, 30);
    for (const [k, title] of [['staff', 'What your staff know'], ['army', 'The army and its courses'], ['scene', 'Conversations on record'], ['record', 'The record · save and load']]) {
      const n = paneNodes[k][0]; if (!n || (k === 'scene' && !state.scene)) continue; const d = el('details', 'sh-nb-more'); d.append(el('summary', null, title), n); n.hidden = false; d.open = open === k; nb.append(d); if (open === k) setTimeout(() => d.scrollIntoView({ block: 'start' }), 30); }
    $('sh-notebook').hidden = false; syncVeil();
  }

  /* ---------- the people you know: one file a person, only what has reached you (w3d/dossier.js) ---------- */
  // whom you saw, and where: whereabouts are the reply's for one turn, so what you saw is kept (it goes in the campaign file)
  function sightings() {
    const all = store(SEEN_KEY, []), d = today(); let ch = false;
    for (const w of state.whereabouts || []) { if (!w || !w.date || w.date > d || !Array.isArray(w.who) || playerOn(w.date) !== w.place) continue;
      const who = abedOn(w.date) ? w.who.filter(id => bedsideOn(w.date, w.place).some(x => x.id === id)) : w.who; if (!who.length) continue;
      const k = w.date + '|' + w.place + '|' + who.join(','); if (!all.some(x => x.k === k)) { all.push({ k, date: w.date, place: w.place, who, doing: w.doing || '' }); ch = true; } }
    if (ch) keep(SEEN_KEY, all.slice(-300)); return all;
  }
  function files() {
    const papers = [...letters(), ...archived()].filter(readable);
    const orders = sentOrders().filter(o => o.to && cast(o.to)).map(o => ({ ...o, answered: isAnswered(o.ref) }));
    return peopleFiles({ cast: state.cast, letters: papers, orders, sightings: sightings(), overheard: store(HEARD_KEY, []), hearsay: state.hearsay, dossier: state.dossier, audiences: state.audiences, remarks: state.remarks, household: state.household, today: today() });
  }
  const clip = (t, n = 150) => { t = String(t || ''); return t.length > n ? t.slice(0, n) + '…' : t; };
  function peopleSection(sec, open) {
    const fs = files(), known = fs.filter(f => f.known), rest = fs.filter(f => !f.known && !f.dead && f.id !== 'steward');
    const sc = sec('People you know', 'Your secretary’s file on each person, kept from what has reached you: their letters, what others wrote of them, your orders and their answers, where you saw them. The most recent dealings first.');
    for (const f of known) sc.append(personFile(f, open === 'person:' + f.id));
    if (!known.length) sc.append(el('p', 'sh-empty', 'No one yet.'));
    if (rest.length) sc.append(el('p', 'sh-hint', 'Not yet dealt with: ' + rest.map(f => f.name + (f.office ? ' (' + f.office + ')' : '')).join('; ') + '.'));
  }
  function personFile(f, isOpen) {
    const c = cast(f.id) || {}, d = el('details', 'sh-pp'); d.id = 'sh-pp-' + f.id; d.open = !!isOpen;
    const s = el('summary'); s.innerHTML = '<b>' + esc(f.name) + (f.dead ? ' †' : '') + '</b><small>' + esc(f.kin || f.office) + (f.latest ? ' · last word ' + esc(short(f.latest)) : '') + '</small>'; d.append(s);
    const b = el('div', 'sh-pp-b'); d.append(b);
    const head = (t, items, row, max = 4) => { if (!items.length) return; b.append(el('h4', null, t)); const box = el('div'); items.slice(0, max).forEach(x => box.append(row(x)));
      if (items.length > max) { const more = el('details', 'sh-pp-more'); more.append(el('summary', null, 'Earlier (' + (items.length - max) + ')')); items.slice(max).forEach(x => more.append(row(x))); box.append(more); } b.append(box); };
    const line = (date, html, onOpen) => { const p = el('div', 'sh-pp-row'); p.innerHTML = '<span class="sh-cal-d">' + esc(date ? short(date) : '') + '</span><span>' + html + '</span>'; if (onOpen) { const a = el('button', 'sh-o-lnk', 'Read →'); a.onclick = onOpen; p.append(a); } return p; };
    // where word of them last came from; where a letter would find them, as your staff would address it
    const where = [];
    if (f.last) where.push((f.last.how === 'seen' ? 'Last seen at ' : 'Last wrote from ') + locName(f.last.place) + ', ' + short(f.last.date) + '.');
    if (!f.dead && !ruler(c) && c.id && c.place) where.push(presentHere(c) ? 'Here, where you are.' : (n => 'A letter would find them at ' + locName(whereNow(c)) + ', about ' + n + ' day' + (n > 1 ? 's' : '') + ' away.')(Math.max(1, days(travel.here(), whereNow(c)))));
    if (where.length) b.append(el('p', 'sh-pp-where', where.join(' ')));
    head('Your secretary’s notes', f.notes, n => line(n.date, esc(n.note)), 3);
    head('Your secretary’s remarks', f.remarks.map(t => ({ t })), x => line(null, esc(x.t)));
    head('Their letters to you', f.letters, l => line(l.date, '“' + esc(l.title) + '”' + (l.place ? ' <small>from ' + esc(locName(l.place)) + '</small>' : ''), () => showLetters(l.id)));
    head('Spoken of', f.mentions, m => line(m.date, '“' + esc(m.title) + '”' + (m.from ? ' <small>' + esc(m.kind === 'gazette' ? 'in the Diarium' : 'from ' + m.from) + '</small>' : ''), () => showLetters(m.id)));
    head('Seen in person', f.met, m => line(m.date, esc(locName(m.place)) + (m.what ? ' — ' + esc(m.what) : ''), m.letter ? () => showLetters(m.letter) : null));
    head('Your orders to them', f.orders, o => line(o.date, esc(clip(o.line)) + ' <small>' + (o.answered ? 'answered' : 'no answer yet') + '</small>'));
    head('Overheard', f.overheard, o => line(o.date, '<i>“' + esc(o.line) + '”</i>'), 3);
    head('What they say of you', f.said, h => line(h.date, '<i>“' + esc(h.said) + '”</i>'), 3);
    head('Audiences', f.audiences, a => line(a.date, esc(a.title) + ' <small>' + esc(a.status) + '</small>'));
    if (!f.dead && c.id && !ruler(c)) { const w = el('button', 'sh-nb-link', presentHere(c) ? 'Give them an order in person' : 'Write to them');
      w.onclick = () => { toggleSheet(true); $('sh-to').value = c.id; $('sh-give-t').focus(); }; b.append(w); }
    return d;
  }

  /* ---------- your desk: the calendar on the wall, the undertakings in hand, what is said of you, audiences to prepare ---------- */
  // an undertaking as you know it today: news of a new stage reaches you on its day, and until then the last one stands
  function undertakings() {
    const d = today(), out = [];
    for (const u of state.undertakings || []) { if (!u || !u.id) continue;
      const hist = (u.history || []).filter(h => !h.date || h.date <= d), now = !u.updated || u.updated <= d;
      const shown = now ? { stage: u.stage, status: u.status || 'in hand', date: u.updated || u.started } : hist.length ? { stage: hist[hist.length - 1].stage, status: 'in hand', date: hist[hist.length - 1].date } : null;
      if (shown) out.push({ ...u, shown, past: now ? hist : hist.slice(0, -1) }); }
    return out;
  }
  const orderOn = u => { toggleSheet(true); const t = $('sh-give-t'); t.value = 'On “' + u.title + '”: '; t.focus(); };
  const longDay = d => /^\d{4}-\d{2}$/.test(d || '') ? new Date(d + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : short(d);
  const names = ids => (ids || []).map(id => (cast(id) || {}).name || id).join(' and ');
  function calendarEntries() {
    const d = today(), out = [];
    for (const c of state.calendar || []) if (c && c.date && (!c.noted || c.noted <= d)) out.push({ date: c.date, what: c.what, how: c.certainty || 'expected', source: c.source });
    for (const a of state.audiences || []) if (a && a.date && (!a.noted || a.noted <= d) && ['expected', 'postponed'].includes(a.status || 'expected')) out.push({ date: a.date, what: (a.title || 'An audience') + ' — with ' + names(a.with) + (a.place ? ', ' + locName(a.place) : ''), how: a.status === 'postponed' ? 'postponed' : 'appointed', aud: a });
    for (const u of undertakings()) if (u.due && ['in hand', 'stalled'].includes(u.shown.status)) out.push({ date: u.due, what: u.title + ' — due', how: 'expected' });
    // your staff's reckoning: an order by letter, answered by return, comes back in about twice its days on the road
    for (const o of sentOrders()) { const m = /about (\d+) days? on the road/.exec(o.line || ''); if (!m || !o.ref || isAnswered(o.ref) || !o.to || !cast(o.to)) continue;
      const back = new Date(o.date + 'T12:00:00Z'); back.setUTCDate(back.getUTCDate() + 2 * +m[1]); out.push({ date: back.toISOString().slice(0, 10), what: 'An answer from ' + cast(o.to).name + ' could come', how: 'reckoned', source: 'your order of ' + short(o.date) }); }
    const week = new Date(d + 'T12:00:00Z'); week.setUTCDate(week.getUTCDate() - 7); const old = week.toISOString().slice(0, 10);
    return out.filter(e => (e.date.length === 7 ? e.date + '-28' : e.date) >= old).sort((a, b) => a.date.localeCompare(b.date));
  }
  const HOW = { appointed: 'appointed', fixed: 'fixed', expected: 'expected', rumoured: 'rumoured', reckoned: 'your staff’s reckoning', postponed: 'postponed' };
  function deskSections(sec) {
    const d = today();
    { const ins = state.instructions, sc = sec('Your instructions to your secretary', 'Left on your secretary’s desk and followed every day until you revise them. What they do not cover waits for you.');
      if (ins && ins.text) { sc.append(el('p', 'sh-nb-quote', ins.text)); sc.append(el('p', 'sh-hint', 'Left ' + fmtDate(ins.written) + (ins.revised && ins.revised !== ins.written ? '; revised ' + fmtDate(ins.revised) : '') + '.')); }
      const b = el('button', 'sh-nb-link', ins && ins.text ? 'Revise them' : 'Write them'); b.onclick = () => showInstructions(); sc.append(b); }
    { const es = (state.daybook || []).filter(e => e && (!e.date || e.date <= d)).slice().reverse(); if (es.length) {
      const sc = sec('Done in your name', 'From your secretary’s day-book.'), row = e => { const p = el('div', 'sh-db'); p.innerHTML = '<span class="sh-cal-d">' + esc(short(e.date)) + '</span><span>' + esc(e.entry) + '</span>';
        for (const id of e.letters || []) { const r = [...state.reports, ...archived()].find(x => x.id === id); if (r) { const b = el('button', 'sh-o-lnk', fromName(r) + ': “' + r.title + '” →'); b.onclick = () => showLetters(r.id); p.append(b); } } return p; };
      for (const e of es.slice(0, 8)) sc.append(row(e));
      if (es.length > 8) { const more = el('details', 'sh-hs-more'); more.append(el('summary', null, 'Earlier entries (' + (es.length - 8) + ')')); for (const e of es.slice(8)) more.append(row(e)); sc.append(more); } } }
    { const sc = sec('The calendar on your wall', 'What you know is coming, and how sure it is.'), ul = el('ul', 'sh-cal'); sc.append(ul);
      for (const e of calendarEntries()) { const past = (e.date.length === 7 ? e.date + '-28' : e.date) < d, li = el('li', past ? 'past' : e.date === d ? 'today' : null);
        li.innerHTML = '<span class="sh-cal-d">' + esc(longDay(e.date)) + '</span><span class="sh-cal-w">' + esc(e.what) + '<small>' + esc(HOW[e.how] || e.how) + (e.source ? ' · ' + esc(e.source) : '') + '</small></span>';
        if (e.aud && !past) { const prep = W().items.find(x => x.id === 'brief:' + e.aud.id), b = el('button', null, prep ? 'Revise your preparation' : 'Prepare for it'); b.onclick = () => showBrief(e.aud); li.append(b); }
        ul.append(li); }
      if (!ul.children.length) ul.append(el('li', 'sh-empty', 'Nothing marked yet.'));
      const ask = el('button', 'sh-nb-link', 'Ask for an audience, and prepare for it'); ask.onclick = () => showBrief(null); sc.append(ask); }
    { const us = undertakings(); if (us.length) { const sc = sec('Undertakings', 'What you have set in train, as the last news left it.');
      for (const u of us.sort((a, b) => ['stalled', 'in hand', 'done', 'abandoned'].indexOf(a.shown.status) - ['stalled', 'in hand', 'done', 'abandoned'].indexOf(b.shown.status))) {
        const box = el('div', 'sh-dossier st-' + u.shown.status.replace(' ', '-')), began = (u.re || []).map(r => sentOrders().find(o => o.ref === r)).filter(Boolean)[0];
        box.innerHTML = '<div class="sh-dos-h"><b>' + esc(u.title) + '</b><small>' + esc(u.shown.status) + (u.started ? ' · begun ' + esc(short(u.started)) : '') + (u.shown.date ? ' · last news ' + esc(short(u.shown.date)) : '') + '</small></div>'
          + '<p class="sh-dos-stage">' + esc(u.shown.stage) + '</p>'
          + (u.waiting && u.shown.stage === u.stage ? '<p class="sh-dos-f"><i>Waiting on</i> ' + esc(u.waiting) + '</p>' : '') + (u.obstacle && u.shown.stage === u.stage ? '<p class="sh-dos-f"><i>In the way</i> ' + esc(u.obstacle) + '</p>' : '')
          + (began ? '<p class="sh-dos-f"><i>Begun by</i> your order of ' + esc(short(began.date)) + ': “' + esc((began.text || began.line).slice(0, 110)) + ((began.text || began.line).length > 110 ? '…' : '') + '”</p>' : '')
          + (u.past.length ? '<details><summary>Earlier stages (' + u.past.length + ')</summary><ol>' + u.past.map(h => '<li><small>' + esc(short(h.date)) + '</small> ' + esc(h.stage) + '</li>').join('') + '</ol></details>' : '');
        if (['in hand', 'stalled'].includes(u.shown.status)) { const b = el('button', null, 'Give orders on it'); b.onclick = () => orderOn(u); box.append(b); }
        sc.append(box); } } }
    { const hs = (state.hearsay || []).filter(h => h && (!h.date || h.date <= d)); if (hs.length) {
      const sc = sec('What is said of you', 'As it reached you. Whoever told you may be mistaken, or may want something of you.'), ordered = hs.slice().reverse();
      const row = h => { const p = el('div', 'sh-hs'), who = h.teller && cast(h.teller) ? cast(h.teller).name : null, src = h.source || who || 'unknown';
        p.innerHTML = '<p>“' + esc(h.said) + '”</p><small>' + esc('from ' + src) + (h.date ? ' · ' + esc(short(h.date)) : '') + (h.place ? ' · ' + esc(locName(h.place)) : '') + (trustOf(src) ? ' · <i>you ' + trustOf(src) + ' this source</i>' : '') + '</small>';
        const t = el('span', 'sh-hs-t'); for (const [k, lab] of [['trust', 'trust'], ['doubt', 'doubt']]) { const b = el('button', trustOf(src) === k ? 'on' : null, lab); b.onclick = () => { setTrust(src, trustOf(src) === k ? null : k); showNotebook(); }; t.append(b); } p.append(t); return p; };
      for (const h of ordered.slice(0, 6)) sc.append(row(h));
      if (ordered.length > 6) { const more = el('details', 'sh-hs-more'); more.append(el('summary', null, 'Older talk (' + (ordered.length - 6) + ')')); for (const h of ordered.slice(6)) more.append(row(h)); sc.append(more); } } }
  }
  // an instruction left with your secretary, as a minister of the time left one with his chancery: what to answer in your name,
  // what to keep, what to refuse, what to send on at once. The packet carries it each turn; the reply's day-book says what was done.
  function showInstructions() {
    const ins = state.instructions || {}, b = card('Your instructions to your secretary', ins.text ? 'Revise your instructions' : 'Leave your instructions', 'Your secretary and household follow them every day until you change them: routine letters answered in your name, your appointments kept, what you refuse refused. Anything they do not cover, or that needs your decision, is laid before you.');
    const f = el('form', 'sh-compose sh-brief'), t = el('textarea'); t.rows = 9; t.value = ins.text || '';
    t.placeholder = 'For example:\n— Acknowledge routine returns and forward them to the Hofkriegsrat.\n— Answer petitions for posts with my thanks and no promise.\n— I attend the Conference on its days; I receive callers on Tuesday mornings only.\n— Refuse every offer of a loan.\n— Anything from Silesia, or from Her Majesty, is brought to me at once, day or night.';
    const go = el('button', 'sh-primary', 'Leave them with your secretary'); f.append(t, go);
    if (ins.text) { const x = el('button', null, 'Withdraw them'); x.type = 'button'; x.onclick = () => { delete state.instructions; persistState(); $('sh-talk').hidden = true; syncVeil(); act('toast:Your secretary will do only what each dispatch says.'); refresh(); showNotebook(); }; f.append(x); }
    b.append(f); setTimeout(() => t.focus(), 30);
    f.onsubmit = e => { e.preventDefault(); const v = t.value.trim(); if (!v) return t.focus();
      state.instructions = { text: v, written: ins.written || today(), revised: today() }; persistState(); act('sound:seal');
      $('sh-talk').hidden = true; syncVeil(); act('toast:Your instructions are on your secretary’s desk. They go with every dispatch.'); refresh(); showNotebook(); };
  }
  // before an audience: what you will press, what you may give, what you will not say, and how you will carry yourself.
  // It goes in the dispatch under a reference; the meeting, if it comes, is written from it — and the others answer as they will.
  function showBrief(a) {
    const id = a ? 'brief:' + a.id : null, old = id ? W().items.find(x => x.id === id) : null;
    const b = card(a ? 'Before the audience · ' + longDay(a.date) + (a.place ? ' · ' + locName(a.place) : '') : 'Ask for an audience', a ? (a.title || 'An audience') + ' — ' + names(a.with) : 'With whom, and to what end', a && a.purpose ? a.purpose : 'Set down how you mean to conduct it. It goes with the dispatch; what comes of it is theirs to answer.');
    const f = el('form', 'sh-compose sh-brief'); let who = null;
    if (!a) { who = el('select'); for (const c of (state.cast || []).filter(c => !c.dead && c.id !== 'own-forces' && c.id !== 'steward' && c.id !== 'secretary')) who.append(new Option(c.name + (ruler(c) ? ' — through the chamberlain' : ' — ' + locName(whereNow(c))), c.id)); f.append(who); }
    const field = (k, lab, ph) => { const l = el('label', null, lab), t = el('textarea'); t.rows = 2; t.placeholder = ph; t.value = (old && old[k]) || ''; t.dataset.k = k; l.append(t); f.append(l); return t; };
    const press = field('press', 'What I will press', 'What you want from them, and the argument you will make…');
    const give = field('concede', 'What I may concede', 'What you can give, if pressed…');
    const keepq = field('withhold', 'What I will not say', 'What they must not learn from you…');
    const ml = el('label', null, 'My manner'), mm = el('select'); for (const m of MANNERS) mm.append(new Option(m, m)); mm.value = (old && old.manner) || 'candid'; ml.append(mm); f.append(ml);
    const go = el('button', 'sh-primary', old ? 'Revise it in the dispatch' : 'Put it in the day’s dispatch'); f.append(go);
    if (old) { const x = el('button', null, 'Strike it'); x.type = 'button'; x.onclick = () => { dropItem(id); $('sh-talk').hidden = true; syncVeil(); act('toast:Struck from the dispatch.'); showNotebook(); }; f.append(x); }
    b.append(f); setTimeout(() => press.focus(), 30);
    f.onsubmit = e => { e.preventDefault(); if (!press.value.trim()) return press.focus();
      const c = a ? null : cast(who.value), whom = a ? names(a.with) : c.name, parts = [['I will press', press.value], ['I may concede', give.value], ['I will not say', keepq.value]].filter(([, v]) => v.trim()).map(([k, v]) => k + ': ' + v.trim().replace(/[.\s]+$/, '') + '.');
      const head = a ? 'For my audience with ' + whom + (a.title ? ', “' + a.title + '”' : '') + ', expected ' + fmtDate(a.date) + (a.place ? ' at ' + locName(a.place) : '') : (ruler(c) ? 'Through the chamberlain, I ask for an audience with ' + whom + ' at the first chance' : 'I ask ' + whom + ' for an audience at the first chance') + '. For it';
      setItem({ id: id || 'brief:ask-' + c.id, kind: 'brief', aud: a ? a.id : null, to: a ? null : c.id, press: press.value.trim(), concede: give.value.trim(), withhold: keepq.value.trim(), manner: mm.value, text: head + ' — ' + parts.join(' ') + ' My manner: ' + mm.value + '.' });
      $('sh-talk').hidden = true; syncVeil(); act('toast:Your preparation goes with the dispatch.'); showNotebook(); };
  }

  /* ---------- the book of the campaign: the turns you lived; when it is over, what was hidden as well ---------- */
  function chapters() {
    const past = book(), w = draft.w3d || { items: [] };
    return [...past, { turn: state.turn, date: state.date, to: null, title: state.title, briefing: state.briefing, at: state.player.locationId, current: true,
      gazette: seen().filter(r => r.kind === 'gazette').flatMap(g => g.items.map(i => ({ head: i.head, text: i.text }))),
      letters: seenLetters().map(r => ({ from: fromName(r), place: r.place, dated: r.dated, title: r.title, text: r.text, battle: !!r.battle, source: r.source || '' })), orders: w.items.map(itemLine), own: (w.own || '').trim() }];
  }
  function bookHtml(forFile) {
    const over = !!state.ended, cs = chapters(), h = [], e = state.epilogue;
    if (e) h.push('<section class="bk-epi"><h3>' + esc(e.title || 'The verdict of history') + '</h3><p>' + esc(e.text || '') + '</p>' + (e.verdict ? '<p class="bk-verdict">' + esc(e.verdict) + '</p>' : '') + '</section>');
    cs.forEach((c, i) => {
      h.push('<section class="bk-ch"><div class="bk-n">Chapter ' + (i + 1) + (c.current ? ' · this turn' : '') + '</div><h3>' + esc(c.title || '') + '</h3><p class="bk-when">' + esc(fmtDate(c.date)) + (c.to ? ' – ' + esc(fmtDate(c.to)) : '') + ' · at ' + esc(locName(c.at)) + '</p><p>' + esc(c.briefing || '') + '</p>');
      const os = [...(c.orders || []), ...(c.own && !(c.orders || []).some(o => /^In my own words: /.test(o)) ? [c.own] : [])]; if (os.length) h.push('<h4>Your orders</h4><ol class="bk-orders">' + os.map(o => '<li>' + esc(o) + '</li>').join('') + '</ol>');
      if (c.course) h.push('<h4>The course you took in council</h4><p>' + esc(c.course) + '</p>');
      if (c.audience) { const a = c.audience; h.push('<h4>' + esc(a.title || 'An audience') + '</h4>' + (a.setting ? '<p class="bk-when">' + esc(a.setting) + '</p>' : '') + a.lines.map(l => '<p>' + (l.who ? '<b>' + esc(l.who) + ':</b> ' : '<i>') + esc(l.text) + (l.who ? '' : '</i>') + '</p>').join('') + ((a.commitments || []).length ? '<ul>' + a.commitments.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '')); }
      if ((c.choices || []).length) h.push('<h4>What you answered at once</h4><ul>' + c.choices.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>');
      if ((c.gazette || []).length) h.push('<h4>In the Diarium</h4><ul class="bk-gz">' + c.gazette.map(g => '<li><b>' + esc(g.head) + '</b> — ' + esc(g.text) + '</li>').join('') + '</ul>');
      if ((c.letters || []).length) h.push('<h4>Letters</h4>' + c.letters.map(l => '<details' + (l.battle || forFile ? ' open' : '') + ' class="bk-letter' + (l.battle ? ' bk-battle' : '') + '"><summary><b>' + esc(l.title) + '</b> — ' + esc(l.from || 'unsigned') + ', ' + esc(locName(l.place)) + ', ' + esc(fmtDate(l.dated)) + '</summary><p>' + esc(l.text) + '</p>' + (l.source ? '<p class="bk-src">Their source: ' + esc(l.source) + '</p>' : '') + '</details>').join(''));
      if (over && c.secret) { const s = c.secret; h.push('<div class="bk-secret"><h4>What was hidden from you</h4>' + (s.volumes || []).map(v => '<p><b>Volume ' + esc(v.n) + (v.title ? ': ' + esc(v.title) : '') + '</b> (' + esc(v.turns || '') + ') ' + esc(v.text || '') + '</p>').join('') + (s.chronicle ? '<p>' + esc(s.chronicle) + '</p>' : '') + ((s.decisions || []).length ? '<ul>' + s.decisions.map(d => '<li><b>' + esc(d.who) + '</b> knew ' + esc(d.knows || '—') + '; wanted ' + esc(d.wants || '—') + '; decided ' + esc(d.decides || '—') + '</li>').join('') + '</ul>' : '') + ((s.fortune || []).length ? '<p class="bk-src">Fortune: ' + s.fortune.map(f => esc(f.for) + ' (' + esc(f.roll) + '): ' + esc(f.outcome)).join(' · ') + '</p>' : '') + '</div>'); }
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
      const b = card(viaChamberlain ? 'The Hofburg · through the chamberlain' : (abedOn(today()) ? 'At your bedside · ' : 'In person · ') + locName(travel.here()), who.name, who.office || '');
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
  // while the couriers ride: things a commander does with the days. Each is an ordinary order in the dispatch, and takes hours;
  // what comes of it is the adjudicator's, never granted by the click.
  const WAITS = [['intel', 'Review the intelligence'], ['household', 'Hear the household'], ['quarters', 'Inspect the quarters'], ['prepare', 'Set preparations in hand']];
  function waitingRow() {
    const box = el('div', 'sh-wait'); box.append(el('i', null, 'While the couriers ride'));
    for (const [k, lab] of WAITS) { if (k === 'quarters' && travel.onRoad()) continue; const b = el('button', W().items.some(x => x.id === 'wait:' + k) ? 'on' : null, lab); b.type = 'button'; b.onclick = () => showWaiting(k); box.append(b); }
    return box;
  }
  function showWaiting(kind) {
    const here = travel.here(), name = travel.onRoad() ? 'the road' : locName(here), hh = state.household || {}, sp = cast(hh.spouse), id = 'wait:' + kind;
    const T = { intel: ['Review the intelligence', 'With my staff, I go over the intelligence received: where each report places the enemy, how old it is, which informants agree and which do not. Set down for me what is known, what is only reported, and what we must find out next.', 2],
      household: ['Hear the household', sp ? (whereNow(sp) === here && !travel.onRoad() ? 'I spend the evening with ' + sp.name + ' and the children, and hear what concerns the household and the house’s affairs.' : 'I write to ' + sp.name + ' at ' + locName(whereNow(sp)) + ' for news of the children and of the household, and what concerns the house.') : 'I hear my steward on the household and its affairs.', 2],
      quarters: ['Inspect the quarters', 'In person at ' + name + ', I go round the quarters of the troops and of my staff — billets, sick, fuel and straw, discipline, and what the townspeople say of them. Report what I see.', 3],
      prepare: ['Set preparations in hand', '', 1] }[kind];
    const b = card('While the couriers ride · ' + name, T[0], 'Your papers already hold:'), facts = el('ul', 'sh-facts'), fact = t => facts.append(el('li', null, t));
    if (kind === 'intel') { for (const m of heard().slice(-6)) fact(m.label + ' — ' + (m.status || 'reported') + (m.reported ? ', ' + short(m.reported) : '') + (m.source ? ' (' + m.source + ')' : ''));
      for (const r of seenLetters().filter(r => r.sighting).slice(-4)) fact((r.sighting.what || r.title) + ' — so ' + fromName(r) + ' reports, ' + short(r.dated));
      const ls = seenLetters(); if (ls.length) fact(ls.length + ' letter' + (ls.length > 1 ? 's have' : ' has') + ' come this turn, from ' + [...new Set(ls.map(r => locName(r.place)))].join(', ') + '; the latest written ' + short(ls.map(r => r.dated).sort().pop()) + '.');
      const tr = Object.entries(state.trust || {}); if (tr.length) fact('Sources you trust: ' + (tr.filter(([, v]) => v === 'trust').map(([k]) => k).join('; ') || 'none marked') + '. You doubt: ' + (tr.filter(([, v]) => v === 'doubt').map(([k]) => k).join('; ') || 'none marked') + '.'); }
    if (kind === 'household') { if (sp) fact(sp.name + (whereNow(sp) === here ? ' is here.' : ' is at ' + locName(whereNow(sp)) + '.')); if (hh.purse) fact('Your steward: “' + hh.purse + '”'); const h = state.player.health; if (h && h !== 'well') fact('You are ' + h + '.'); }
    if (kind === 'quarters') { const fs = (state.forces || []).filter(f => !f.locationId || f.locationId === here); for (const f of fs.slice(0, 6)) fact((f.name || f.id) + (f.men ? ': ' + f.men + ' men' : '')); }
    if (!facts.children.length) fact('Nothing on record.');
    const done = W().items.some(x => x.id === id), go = el('button', 'sh-primary', done ? 'Already in the day’s dispatch' : 'Do it — add to the day’s dispatch'); go.disabled = done;
    let t = null; if (kind === 'prepare') { t = el('textarea'); t.rows = 3; t.placeholder = 'What should be ready before the answers come: wagons, a route surveyed, a draft for the Conference…'; }
    go.onclick = () => { if (t && !t.value.trim()) return t.focus();
      const text = kind === 'prepare' ? 'Set in hand now, without waiting for the answers: ' + t.value.trim() : T[1];
      if (kind === 'household' && sp) orderTo(sp.id, text); else setItem({ kind: kind === 'quarters' ? 'inspect' : 'order', to: kind === 'quarters' ? undefined : 'staff', text });
      const items = W().items, last = items[items.length - 1]; if (last) { last.id = id; compose(); }
      act('hours:' + T[2]); $('sh-talk').hidden = true; syncVeil(); act('toast:Added to the day’s dispatch.'); };
    b.append(facts); if (t) b.append(t); b.append(go); if (t) setTimeout(() => t.focus(), 30);
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
    $('sh-date').textContent = fmtDate(shownDate()) + (clock ? ' · ' + clock.word : '') + ' · ' + (travel.onRoad() ? 'on the road to ' + locName(state.player.locationId) : travel.mode() === 'field' ? 'with the army' : 'at ' + locName(travel.here())) + (j ? ' · bound for ' + locName(j.to) : '');
    if (zone) $('sh-zone').textContent = zone; if (sub != null) $('sh-sub').textContent = sub;
    if (v) view = v;
    $('sh-b-field').hidden = travel.mode() !== 'field' && view !== 'field';
    for (const k of ['map', 'field']) { const b = $('sh-b-' + k); b.classList.toggle('on', view === k); b.querySelector('span').textContent = view === k ? (k === 'map' ? 'Stand up' : 'Leave field') : k === 'map' ? 'Map' : 'Field'; }
    const n = unread().length; $('sh-unread').textContent = n || '';
    const w = draft.w3d, on = (w ? w.items.length + (w.own.trim() ? 1 : 0) : (ensureCase().text.trim() ? 1 : 0)) + Object.keys(armyOrders()).length; $('sh-ocount').textContent = on || '';
    $('sh-matters').textContent = matters().length || '';
  }
  return {
    showPanel, closePanel, toggleSheet, refresh, showBook, unread, passDay, letters, seen, get today() { return shownDate(); }, markRead, appendOrder, removeOrder, setItem, dropItem, showTravel, showTalk, showInspect, showWaiting, showBrief, showInstructions, showLetters, showNotebook, showSingle, presentHere, overhear, archive, archivedCount: () => archived().length,
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

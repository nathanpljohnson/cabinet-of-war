// Runs the reply pipeline (w3d/turn.js, w3d/continuity.js) on the opening state and the mock replies; prints JSON for pytest.
import { readFileSync } from 'node:fs';
import { parseReply, checkReply, mergeTurn, buildPacket, liveState, rollFortune, applyBranch, activePlots, STATIC_KEYS, sealOf, nextLink, fingerprint, volumeDue, GROUNDS, GROUND_KINDS } from '../w3d/turn.js';
import { checkContinuity } from '../w3d/continuity.js';
import { wheel, separation, findRoute, rasterize, normalizeUnit, TROOPS, bearing, crestBetween, slopePace } from '../w3d/march.js';
const root = new URL('../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const html = read('cabinet-of-war.html'), m = html.match(/id="initial-state">([\s\S]*?)<\/script>/);
const opening = JSON.parse(m[1].replace(/\\u003c/g, '<')), almanac = JSON.parse(read('w3d/almanac.json')), contract = read('w3d/contract.md');
const out = { mocks: {} };
const reply = (state, changes) => ({ kind: 'turn', schemaVersion: 3, campaignId: state.campaignId, turn: state.turn + 1, parentTurn: state.turn, seal: sealOf(state), changes: JSON.parse(JSON.stringify(changes)) });
for (const name of ['answers', 'winter', 'dismissed', 'backwards', 'contradiction', 'living', 'ending', 'account']) {
  const mk = JSON.parse(read('w3d/mocks/' + name + '.json')), r = reply(opening, mk.changes);
  const chk = checkReply(opening, r, { orderRefs: ['T0-1', 'T0-2', 'T0-3'], fortune: rollFortune(opening.campaignId, 0), seal: sealOf(opening) });
  const res = { errors: chk.errors, warns: chk.warns, fixes: chk.fixes };
  if (!chk.errors.length) { const { next } = mergeTurn(opening, r); res.next = { turn: next.turn, date: next.date, reports: next.reports.length, canon: next.hidden.canon.length, cast: next.cast.length, threads: next.hidden.threads.length, decision: next.decision, world: next.world, ended: next.ended || null, kessler: next.cast.find(c => c.id === 'kessler') || null, thread: next.hidden.threads.find(t => t.id === 'pol_prussian_invasion'), standingOrders: !!next.hidden.standingOrders, forces: next.forces.length, enemy: (next.battleDemo || {}).enemy || null, urgent: (next.reports.find(x => x.urgent) || {}).urgent || null, gazette: next.gazette, household: next.household, aftermath: (next.battleDemo || {}).aftermath || null, phases: ((next.battleDemo || {}).phases || []).map(p => [p.t, (p.units || []).length, (p.arrows || []).length]), ground: (next.battleDemo || {}).ground, purse: next.hidden.purse || null };
    res.continuity = checkContinuity(opening, next); }
  out.mocks[name] = res;
}
// merge rules on a small state
const s0 = { campaignId: 'c', turn: 0, date: '1740-10-21', schemaVersion: 2, cast: [{ id: 'a', name: 'A', place: 'vienna', agenda: 'x' }, { id: 'b', name: 'B', place: 'vienna' }], ledger: [{ text: 'l0' }], hidden: { canon: ['c0'], memory: { a: ['m0'] }, standing: { a: 'warm', b: 'cool' }, threads: [] }, trust: { 'a spy': 'doubt' }, reports: [{ id: 'old' }], decision: { id: 'd' }, world: { pay: 'paid', roads: 'good', weather: { '1740-10-21': 'rain' }, scene: { vienna: ['alarm'] } } };
const { next: s1, notes } = mergeTurn(s0, { turn: 1, parentTurn: 0, changes: { date: '1740-10-22', cast: [{ id: 'a', place: 'prague' }, { id: 'b', _remove: true }, { id: 'c', name: 'C' }], ledger: [{ text: 'l1' }], hidden: { canon: ['c1'], memory: { a: ['m1'] }, standing: { b: null } }, trust: {}, world: { roads: 'heavy' }, reports: [{ id: 'new' }] } });
out.merge = { s1, notes };
// reading pasted text
out.parse = { fenced: parseReply('Here it is:\n```json\n{"a": 1, "b": [1,2,],}\n```\nGood luck'), truncated: parseReply('{"a": {"b": "c'), none: parseReply('no json here'), bad: parseReply('{"a": nope}') };
// fixes on arrival
const late = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [{ id: 'x', title: 'x', text: 'x', dated: '1740-10-22', arrives: '1740-12-01', source: 's', re: ['T0-1', 'T9-9'] }, { id: 'y', title: 'y', text: 'y', dated: '1740-10-22', source: 's', urgent: { prompt: 'p', options: [{ id: 'one', label: 'One' }] } }], world: { weather: { '1740-10-22': 'hail' }, scene: { vienna: ['alarm', 'dragons'] } }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
const lc = checkReply(opening, late, { orderRefs: ['T0-1'] });
out.fixes = { fixes: lc.fixes, warns: lc.warns, letter: late.changes.reports[0], urgent: late.changes.reports[1], world: late.changes.world };
// the packet
const packet = buildPacket({ state: opening, contract, orders: '## Orders of the day\nTest orders.', almanac, fortune: rollFortune(opening.campaignId, 0), wake: 'When the first answers arrive.', trust: { 'a Breslau merchant': 'doubt' }, choices: [], endRequested: false });
out.packet = { bytes: packet.length, oldStateBytes: JSON.stringify(opening).length, hasContract: packet.includes('## Fortune'), hasTrust: packet.includes('Doubts: a Breslau merchant'), live: Object.keys(liveState(opening)), staticKeys: STATIC_KEYS, active: activePlots(almanac, opening.hidden.threads, opening.date).map(p => p.id), fortune: [rollFortune('x', 3), rollFortune('x', 3), rollFortune('x', 4)] };
// a branch may touch only world, remarks, cast, standing and memory
const sb = JSON.parse(JSON.stringify(s0)); applyBranch(sb, { remarks: ['r'], date: '1999-01-01', hidden: { standing: { a: 'cool' }, canon: ['no'] } }); out.branch = sb;
// the sealed record
const s9 = { ...opening, turn: 9, record: { chain: [] } }, r9 = reply(s9, { date: '1740-12-01', title: 't', briefing: 'b', reports: [], hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
const wrongSeal = { ...r9, seal: 'feedfeedfeedfeed' }, link1 = nextLink(s9, r9.changes, 10, '1740-12-01'), s10 = { ...s9, turn: 10, record: { chain: [link1] } };
out.record = { origin: sealOf(opening), stable: sealOf(opening) === sealOf(JSON.parse(JSON.stringify(opening))), wrong: checkReply(s9, wrongSeal, { seal: sealOf(s9) }).errors, missing: checkReply(s9, { ...r9, seal: undefined }, { seal: sealOf(s9) }).warns, volumeDue: [volumeDue(s9), volumeDue(s10), volumeDue(opening)], volumeWarn: checkReply(s9, r9, { volumeDue: true }).warns, link1, nextSeal: sealOf(s10), fp: [fingerprint('a'), fingerprint('a'), fingerprint('b')],
  packetSeal: buildPacket({ state: s9, contract, orders: '', almanac, fortune: [] }).includes(sealOf(s9)), packetVolume: buildPacket({ state: s9, contract, orders: '', almanac, fortune: [] }).includes('A volume closes'), recordKept: mergeTurn(s10, { turn: 11, parentTurn: 10, changes: { record: { chain: [] } } }).next.record.chain.length };
const bad = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], world: { tempo: 'siesta' }, gazette: [{ date: '1740-10-22' }, { date: '1740-09-01', items: [{ head: 'h', text: 't' }] }], battleDemo: { aftermath: { fallen: { A1: 'some' } } }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
const bc = checkReply(opening, bad, {}); out.badFixes = { fixes: bc.fixes, world: bad.changes.world, gazette: bad.changes.gazette, fallen: bad.changes.battleDemo.aftermath.fallen };
// the packet after a turn: last turn's output goes back only as an index; threads and plots follow their own next_check
{ const r1 = reply(opening, JSON.parse(read('w3d/mocks/living.json')).changes), { next: n1 } = mergeTurn(opening, r1);
  n1.hidden.threads = n1.hidden.threads.map(t => t.id === 'rel-papal-neutrality-1741' ? { ...t, status: 'dormant', next_check: '1741-06-01' } : t);
  const ls = liveState(n1), pk = buildPacket({ state: n1, contract, orders: '## Orders of the day\nTest.', almanac, fortune: [] });
  out.after = { span: n1.span, live: Object.keys(ls), reportKeys: [...new Set((ls.reports || []).flatMap(r => Object.keys(r)))], hiddenKeys: Object.keys(ls.hidden), bytes: pk.length,
    active: activePlots(almanac, n1.hidden.threads, n1.date).map(p => p.id), battleUnits: !!(ls.battleDemo || {}).units, openingUnits: !!(liveState(opening).battleDemo || {}).units, openingBytes: packet.length };
  const rt = reply(opening, { date: '1740-10-30', title: 't', briefing: 'b', reports: [], player: { locationId: 'breslau', route: [{ date: '1740-10-22', place: 'road' }, { date: '1740-10-27', place: 'breslau' }, { date: '1741-01-01', place: 'breslau' }, { date: '1740-10-25', place: 'atlantis' }] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const rc = checkReply(opening, rt, {}); out.route = { fixes: rc.fixes, route: rt.changes.player.route };
  out.salt = [rollFortune('c', 1, 8, 'aa'), rollFortune('c', 1, 8, 'aa'), rollFortune('c', 1, 8, 'bb'), rollFortune('c', 1)];
  out.opening = { briefing: opening.briefing, scene: opening.scene, movements: opening.movements.length, wallis: opening.cast.find(c => c.id === 'wallis').place, early: opening.hidden.threads.filter(t => t.next_check && t.next_check < opening.date).length, demoCast: opening.cast.filter(c => c.claim === 'demo').length }; }
// battle grounds: library ids and kinds pass, anything else is laid out as open plain with a warning
{ const g = ground => { const r = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { center: [50.1, 14.4], ground }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } }); const c = checkReply(opening, r, {}); return { warns: c.warns, ground: r.changes.battleDemo.ground }; };
  const r0 = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { center: [50.1, 14.4] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const index = JSON.parse(read('w3d/grounds/index.json'));
  out.grounds = { lib: g('prague'), kind: g({ kind: 'marsh' }), unknownId: g('atlantis'), unknownKind: g({ kind: 'swamp' }), noGround: checkReply(opening, r0, {}).warns, ids: GROUNDS, kinds: GROUND_KINDS, index: index.grounds.map(x => x.id), indexKinds: Object.keys(index.kinds), opening: opening.battleDemo.ground,
    packetHasIds: GROUNDS.every(id => packet.includes(id)), live: liveState(opening).battleDemo.ground,
    files: index.grounds.map(x => { const f = JSON.parse(read('w3d/grounds/' + x.id + '.json')); return { id: x.id, cols: f.cols, rows: f.rows, cell: f.cell, w: f.w, h: f.h, rows: f.rows_str.length, len: new Set(f.rows_str.map(r => r.length)), chars: [...new Set(f.rows_str.join(''))].sort().join(''), relief: atob(f.relief.b64).length === 2 * f.relief.cols * f.relief.rows, outer: atob(f.outer.b64).length === 2 * f.outer.cols * f.outer.rows, sources: f.sources.length, notes: f.notes.length }; }) };
  out.grounds.files.forEach(f => f.len = [...f.len]);
  const T = JSON.parse(html.match(/id="terrain">([\s\S]*?)<\/script>/)[1]), M = JSON.parse(read('w3d/grounds/mollwitz.json'));
  { const r = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { ground: 'mollwitz', units: [{ id: 'B20', side: 'B', type: 'lc', e: 0, n: 900, facing: 180 }, { id: 'B21', side: 'B', type: 'pandour', e: 0, n: 900, facing: 180 }, { id: 'A1', e: 10 }] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
    const c = checkReply(opening, r, {}); out.grounds.troops = { units: r.changes.battleDemo.units, fixes: c.fixes }; }
  out.grounds.inlineIsMollwitz = JSON.stringify(T.rows_str) === JSON.stringify(M.rows_str); }
// marching: a wheel turns on its inner flank, rectangles push apart, columns go round water and take the road
{ const u = { e: 0, n: 0, facing: 0 }, w = wheel(u, 90, 150, 90), w2 = wheel(u, -30, 150, 12);
  const flank = (x, f, s) => [x.e + s * Math.cos(f * Math.PI / 180) * 75, x.n - s * Math.sin(f * Math.PI / 180) * 75];
  const g = { cols: 20, rows: 10, cell: 30, w: 600, h: 300 }, river = (c, r) => c === 10 && r !== 8; // a river down column 10, a ford at row 8
  const cost = (c, r) => river(c, r) ? 8 : 1, ctr = (c, r) => [-300 + (c + .5) * 30, 150 - (r + .5) * 30];
  const route = findRoute(g, cost, ctr(2, 2), ctr(17, 2)), roadCells = rasterize([[ctr(2, 6), ctr(17, 6)]], g);
  const road = findRoute(g, (c, r) => roadCells.has(r * 20 + c) ? .5 : river(c, r) ? 8 : 1, ctr(2, 5), ctr(17, 5));
  const cellsOf = pts => { const out = []; let prev = ctr(2, 2); for (const p of pts) { for (let k = 1; k <= 20; k++) { const x = prev[0] + (p[0] - prev[0]) * k / 20, y = prev[1] + (p[1] - prev[1]) * k / 20; out.push([Math.floor((x + 300) / 30), Math.floor((150 - y) / 30)]); } prev = p; } return out; };
  out.march = { wheel: { to: w, pivotBefore: flank(u, 0, 1), pivotAfter: flank(w, w.facing, 1), small: w2 },
    sep: { overlap: separation({ e: 0, n: 0, facing: 0 }, { w: 150, d: 12 }, { e: 0, n: 8, facing: 180 }, { w: 150, d: 12 }), apart: separation({ e: 0, n: 0, facing: 0 }, { w: 150, d: 12 }, { e: 0, n: 30, facing: 0 }, { w: 150, d: 12 }) },
    route: { pts: route, wet: cellsOf(route).filter(([c, r]) => river(c, r)).length, ford: cellsOf(route).some(([c, r]) => c === 10 && r === 8) },
    road: { pts: road, onRoad: cellsOf(road).filter(([c, r]) => roadCells.has(r * 20 + c)).length },
    types: ['gd', 'lt', 'lc', 'inf', 'cav', 'art'].map(t => normalizeUnit({ type: t })), troops: Object.keys(TROOPS), north: bearing(0, 1), east: bearing(1, 0) }; }
// a bad account: unknown ids, forms and losses, a broken arrow, a phase with neither time nor label
{ const r = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { phases: [{ t: '08:00', label: 'x', units: [{ id: 'A1', e: 1, n: 2, form: 'square' }, { id: 'Z9', e: 0, n: 0 }, { id: 'B1', losses: 'some' }], arrows: [{ side: 'A', kind: 'feint', p: [[0, 0], [1, 1]] }, { side: 'C', p: [[0, 0]] }] }, { text: 'nothing' }] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const c = checkReply(opening, r, {}); out.badAccount = { fixes: c.fixes, phases: r.changes.battleDemo.phases, packet: liveState({ ...opening, battleDemo: { ...opening.battleDemo, phases: r.changes.battleDemo.phases } }).battleDemo.phases }; }
// the lie of the ground: a 20 m ridge at n = 500 hides what stands just behind it, not what stands on it or far beyond
{ const ridge = (e, n) => 100 + 20 * Math.exp(-((n - 500) ** 2) / (2 * 60 ** 2)), flat = () => 100, a = { e: 0, n: 0 };
  out.lie = { behind: crestBetween(ridge, a, { e: 0, n: 650 }), onTop: crestBetween(ridge, a, { e: 0, n: 500 }), farBeyond: crestBetween(ridge, a, { e: 0, n: 3000 }),
    flat: crestBetween(flat, a, { e: 0, n: 1500 }), fromTop: crestBetween(ridge, { e: 0, n: 500 }, { e: 0, n: 900 }), close: crestBetween(ridge, { e: 0, n: 440 }, { e: 0, n: 555 }),
    pace: { level: slopePace(.01, 'inf'), up10: slopePace(.1, 'inf'), up10cav: slopePace(.1, 'cav'), up10art: slopePace(.1, 'art'), up10road: slopePace(.1, 'inf', true), down4: slopePace(-.04, 'inf'), down15: slopePace(-.15, 'art'), cliff: slopePace(1, 'art') } }; }
console.log(JSON.stringify(out));

// Runs the reply pipeline (w3d/turn.js, w3d/continuity.js) on the opening state and the mock replies; prints JSON for pytest.
import { readFileSync } from 'node:fs';
import { checkSkeleton, courierErrand, isBattleNear, prevFromPacket, replyFormat, rulesText, rulesVersion, tableOf, TABLES, parseReply, checkReply, mergeTurn, buildPacket, liveState, rollFortune, applyBranch, activePlots, STATIC_KEYS, sealOf, nextLink, fingerprint, volumeDue, GROUNDS, GROUND_KINDS, sceneLines, pendingOrders, exchangeRecord } from '../w3d/turn.js';
import { checkContinuity } from '../w3d/continuity.js';
import { peopleFiles, aliasesOf } from '../w3d/dossier.js';
import { stampFeatures, FIELD } from '../w3d/groundspec.js';
import { wheel, separation, findRoute, rasterize, normalizeUnit, TROOPS, bearing, crestBetween, slopePace } from '../w3d/march.js';
import { seasonOf, sunTimes, sunVector, moonPhase, LOOK, LEAVES, COUNTRY } from '../w3d/season.js';
import { WEATHER } from '../w3d/turn.js';
const root = new URL('../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const html = read('cabinet-of-war.html'), m = html.match(/id="initial-state">([\s\S]*?)<\/script>/);
const opening = JSON.parse(m[1].replace(/\\u003c/g, '<')), almanac = JSON.parse(read('w3d/almanac.json')), contract = read('w3d/contract.md');
const out = { mocks: {} };
const reply = (state, changes) => ({ kind: 'turn', schemaVersion: 3, campaignId: state.campaignId, turn: state.turn + 1, parentTurn: state.turn, seal: sealOf(state), changes: JSON.parse(JSON.stringify(changes)) });
for (const name of ['answers', 'winter', 'dismissed', 'backwards', 'contradiction', 'living', 'ending', 'journey', 'battle', 'account', 'fever', 'meeting']) {
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
const late = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [{ id: 'x', title: 'x', text: 'x', dated: '1740-10-22', arrives: '1740-12-01', source: 's', re: ['T0-1', 'T9-9'] }, { id: 'y', title: 'y', text: 'y', dated: '1740-10-22', source: 's', urgent: { prompt: 'p', options: [{ id: 'one', label: 'One' }] } }], world: { weather: { '1740-10-22': 'hail' }, sights: { vienna: ['alarm', 'dragons'] } }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
const lc = checkReply(opening, late, { orderRefs: ['T0-1'] });
out.fixes = { fixes: lc.fixes, warns: lc.warns, letter: late.changes.reports[0], urgent: late.changes.reports[1], world: late.changes.world };
// the packet
const packet = buildPacket({ state: opening, contract, orders: '## Orders of the day\nTest orders.', almanac, fortune: rollFortune(opening.campaignId, 0), wake: 'When the first answers arrive.', trust: { 'a Breslau merchant': 'doubt' }, choices: [], endRequested: false });
const pkW = buildPacket({ state: opening, contract, orders: '', almanac, fortune: [], waiting: [{ ref: 'T0-2', line: 'To Wallis: hold Glogau.' }] });
out.packet = { waiting: pkW.includes('## Earlier orders with no answer yet') && pkW.includes('[T0-2] To Wallis: hold Glogau.'), noWaiting: !packet.includes('## Earlier orders with no answer yet'),  bytes: packet.length, oldStateBytes: JSON.stringify(opening).length, hasContract: packet.includes('## Fortune'), hasTrust: packet.includes('Doubts: a Breslau merchant'), openingLetters: liveState(opening).reports.every(r => r.text), live: Object.keys(liveState(opening)), staticKeys: STATIC_KEYS, active: activePlots(almanac, opening.hidden.threads, opening.date).map(p => p.id), fortune: [rollFortune('x', 3), rollFortune('x', 3), rollFortune('x', 4)] };
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
    active: activePlots(almanac, n1.hidden.threads, n1.date).map(p => p.id), texts: (ls.reports || []).map(r => r.text), battleUnits: !!(ls.battleDemo || {}).units, openingUnits: !!(liveState(opening).battleDemo || {}).units, openingBytes: packet.length };
  const rt = reply(opening, { date: '1740-10-30', title: 't', briefing: 'b', reports: [], player: { locationId: 'breslau', route: [{ date: '1740-10-22', place: 'road' }, { date: '1740-10-27', place: 'breslau' }, { date: '1741-01-01', place: 'breslau' }, { date: '1740-10-25', place: 'atlantis' }] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const rc = checkReply(opening, rt, {}); out.route = { fixes: rc.fixes, route: rt.changes.player.route };
  out.salt = [rollFortune('c', 1, 8, 'aa'), rollFortune('c', 1, 8, 'aa'), rollFortune('c', 1, 8, 'bb'), rollFortune('c', 1)];
  out.opening = { briefing: opening.briefing, scene: opening.scene, movements: opening.movements.length, wallis: opening.cast.find(c => c.id === 'wallis').place, early: opening.hidden.threads.filter(t => t.next_check && t.next_check < opening.date).length, demoCast: opening.cast.filter(c => c.claim === 'demo').length }; }
// a new battle replaces the field whole; its ground is drawn from what the reply described, the same way every time
{ const mk = JSON.parse(read('w3d/mocks/battle.json')).changes, r = reply(opening, mk); checkReply(opening, r, {}); const { next } = mergeTurn(opening, r), bd = next.battleDemo;
  const blank = Array.from({ length: FIELD.rows }, () => '1'.repeat(FIELD.cols)), stamp = b => stampFeatures(blank, b.ground, b.units, b.id), g = { ...FIELD, ...stamp(bd) }, g2 = stamp(JSON.parse(JSON.stringify(bd))), at = (e, n) => { const c = Math.floor((e + g.w / 2) / g.cell), rr = Math.floor((g.h / 2 - n) / g.cell); return +g.rows_str[rr][c]; };
  const G = bd.ground, s = G.streams[0];
  out.battle = { ids: bd.units.map(u => u.id).sort(), mockIds: mk.battleDemo.units.map(u => u.id).sort(), options: (bd.options || []).map(o => o.id), aftermath: bd.aftermath || null,
    cells: { village: at(G.villages[0].e, G.villages[0].n), hamlet: at(G.villages[1].e, G.villages[1].n), wood: at(G.woods[0].e, G.woods[0].n), stream: at(s.path[2][0], s.path[2][1]), bridge: at(...s.crossings[0]), ford: at(...s.crossings[1]) },
    unitCells: [...new Set(bd.units.map(u => at(u.e, u.n)))], same: JSON.stringify(stamp(bd)) === JSON.stringify(g2), kind: G.kind, rivers: g.rivers.length, names: g.names.map(x => x.name),
    size: [g.cols, g.rows, g.rows_str.length, g.rows_str[0].length],
    packet: (liveState(next).battleDemo || {}).ground ? 'ground' : 'none' };
  const sameId = reply(next, { date: '1740-12-23', title: 't', briefing: 'b', reports: [], battleDemo: { units: [{ id: 'GA1', e: -880 }, { id: 'GB7', _remove: true }] } });
  out.battle.sameId = mergeTurn(next, sameId).next.battleDemo.units.length;
  const badB = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { id: 'bd-x', ground: { kind: 'swamp', villages: [{ name: 'Far', e: 9000, n: 0 }, { name: 'Ok', e: 0, n: 0, size: 'city' }] }, units: [{ id: 'X1', side: 'C', type: 'inf', e: 0, n: 0 }, { id: 'X2', side: 'A', type: 'inf', e: 0, n: 99999 }, { id: 'X3', side: 'A', type: 'cav', e: 10, n: 10 }] } });
  const bb = checkReply(opening, badB, {}); out.battle.bad = { fixes: bb.fixes, warns: bb.warns, kind: badB.changes.battleDemo.ground.kind, villages: badB.changes.battleDemo.ground.villages.map(v => v.name + ':' + v.size), units: badB.changes.battleDemo.units.map(u => u.id + ':' + u.facing) };
}
{ const big = JSON.parse(JSON.stringify(opening)); big.turn = 9; big.hidden.canon = Array.from({ length: 60 }, (_, i) => 'fact ' + i + ' ' + 'x'.repeat(190)); big.hidden.memory = { a: ['1', '2', '3', '4', '5', '6'] };
  const lb = liveState(big); out.caps = { canon: lb.hidden.canon.length, chars: lb.hidden.canon.join('').length, last: lb.hidden.canon[lb.hidden.canon.length - 1].slice(0, 7), note: lb.hidden.canonNote || '', memory: lb.hidden.memory.a }; }
{ const mv = reply(opening, { date: '1740-12-11', title: 't', briefing: 'b', reports: [], movements: [{ id: 'm1', label: 'Prussian regiments towards Crossen', side: 'prussia', status: 'heard', pts: [[52.52, 13.40], [52.05, 15.10]] }, { id: 'm2', label: 'bad', pts: [[52, 13]] }] });
  const mc = checkReply(opening, mv, {}); out.moves = { ids: mv.changes.movements.map(m => m.id + ':' + m.status + ':' + m.reported), fixes: mc.fixes.filter(f => /Movement/.test(f)).length, fmt: replyFormat(opening).includes('"status":"confirmed"|"reported"|"rumour"') }; }
{ const camp = JSON.parse(JSON.stringify(opening)); camp.world = { ...(camp.world || {}), tempo: 'campaigning' }; const bd = liveState(camp).battleDemo; out.preview = { units: !!bd.units, note: /preview field/.test(bd.note || ''), title: bd.title || null }; }
// battle grounds: library ids and kinds pass, anything else is laid out as open plain with a warning
{ const g = ground => { const r = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { center: [50.1, 14.4], ground }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } }); const c = checkReply(opening, r, {}); return { warns: c.warns, ground: r.changes.battleDemo.ground }; };
  const r0 = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { center: [50.1, 14.4] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const index = JSON.parse(read('w3d/grounds/index.json'));
  out.grounds = { lib: g('prague'), kind: g({ kind: 'marsh' }), unknownId: g('atlantis'), unknownKind: g({ kind: 'tundra' }), aliasKind: g({ kind: 'swamp' }), noGround: checkReply(opening, r0, {}).warns, ids: GROUNDS, kinds: GROUND_KINDS, index: index.grounds.map(x => x.id), indexKinds: Object.keys(index.kinds), opening: opening.battleDemo.ground,
    packetHasIds: GROUNDS.every(id => packet.includes(id)), live: liveState(opening).battleDemo.ground,
    files: index.grounds.map(x => { const f = JSON.parse(read('w3d/grounds/' + x.id + '.json')); return { id: x.id, towns: (f.towns || []).map(t => [t.name, t.works, t.poly.length]), bridges: (f.bridges || []).filter(b => b.p.length === 2).length, named: (f.bridges || []).filter(b => b.name).map(b => b.name), cols: f.cols, rows: f.rows, cell: f.cell, w: f.w, h: f.h, rows: f.rows_str.length, len: new Set(f.rows_str.map(r => r.length)), chars: [...new Set(f.rows_str.join(''))].sort().join(''), relief: atob(f.relief.b64).length === 2 * f.relief.cols * f.relief.rows, outer: atob(f.outer.b64).length === 2 * f.outer.cols * f.outer.rows, sources: f.sources.length, notes: f.notes.length }; }) };
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
  const c = checkReply(opening, r, {}); out.badAccount = { fixes: c.fixes, phases: r.changes.battleDemo.phases, packet: liveState({ ...opening, battleDemo: { ...opening.battleDemo, id: 'bd-acc', phases: r.changes.battleDemo.phases } }).battleDemo.phases }; }
// the lie of the ground: a 20 m ridge at n = 500 hides what stands just behind it, not what stands on it or far beyond
{ const ridge = (e, n) => 100 + 20 * Math.exp(-((n - 500) ** 2) / (2 * 60 ** 2)), flat = () => 100, a = { e: 0, n: 0 };
  out.lie = { behind: crestBetween(ridge, a, { e: 0, n: 650 }), onTop: crestBetween(ridge, a, { e: 0, n: 500 }), farBeyond: crestBetween(ridge, a, { e: 0, n: 3000 }),
    flat: crestBetween(flat, a, { e: 0, n: 1500 }), fromTop: crestBetween(ridge, { e: 0, n: 500 }, { e: 0, n: 900 }), close: crestBetween(ridge, { e: 0, n: 440 }, { e: 0, n: 555 }),
    pace: { level: slopePace(.01, 'inf'), up10: slopePace(.1, 'inf'), up10cav: slopePace(.1, 'cav'), up10art: slopePace(.1, 'art'), up10road: slopePace(.1, 'inf', true), down4: slopePace(-.04, 'inf'), down15: slopePace(-.15, 'art'), cliff: slopePace(1, 'art') } }; }
// in bed: a bad abed is left out with a fix; an abed with no end while he is well is warned of
{ const h = { chronicle: 'c', decisions: [{}], fortune_used: [{}] };
  const bad = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], player: { abed: { from: '1740-10-26', to: '1740-10-24' } }, hidden: h }), cb = checkReply(opening, bad, {});
  const open = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], player: { abed: { from: '1740-10-22' } }, hidden: h }), co = checkReply(opening, open, {});
  const sick = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], player: { health: 'ill', abed: { from: '1740-10-01' } }, hidden: h }), cs = checkReply(opening, sick, {});
  out.abed = { badFix: cb.fixes.some(f => /player\.abed/.test(f)), badGone: !('abed' in bad.changes.player), openWarn: co.warns.some(w => /player\.abed has no end/.test(w)), sickWarns: cs.warns.filter(w => /abed/.test(w)).length, clamped: sick.changes.player.abed.from, fmt: replyFormat(opening).includes('player.abed'), contract: /player\.abed/.test(contract) }; }
// the packet: people, places and fortresses as tables; with the rules in a Claude Project, a packet without them
{ const args = { state: opening, contract, orders: '## His orders\n(test)', almanac, fortune: rollFortune(opening.campaignId, 0) };
  const full = buildPacket(args), lean = buildPacket({ ...args, rulesInProject: true }), rules = rulesText({ contract, almanac }), v = rulesVersion({ contract, almanac });
  const stateJson = JSON.parse(full.slice(full.indexOf('\n', full.indexOf('## Current state (JSON)') + 25)).split('\n').find(l => l.startsWith('{')));
  out.lean = { full: full.length, lean: lean.length, rules: rules.length, v, names: lean.includes('cabinet-of-war-rules-' + v + '.md'), noContract: !lean.includes('## Adjudication principles') && !lean.includes('## Reply format'),
    header: lean.includes('"seal": "' + sealOf(opening) + '"'), rulesHave: ['## Adjudication principles', '## Reply format', '<campaignId>', '## Almanac: systems and stakes'].every(k => rules.includes(k)), rulesNoState: !rules.includes(opening.campaignId),
    tablesInFull: Object.keys(TABLES).every(k => full.includes('### ' + k)), notInJson: Object.keys(TABLES).filter(k => k in stateJson), everyCast: opening.cast.every(c => full.includes('\n' + c.id + ' | ')),
    pipe: tableOf([{ id: 'a', note: 'x | y' }, { id: 'b', dead: true }], ['id', 'dead', 'note']) }; }
// the new weather words are accepted, unknown ones still left out; every weather has a look; the sun and moon by the calendar
{ const rw = reply(opening, { date: '1740-10-25', title: 't', briefing: 'b', reports: [], world: { weather: { '1740-10-21': 'frost', '1740-10-22': 'thaw', '1740-10-23': 'thunder', '1740-10-24': 'hail' } } });
  const cw = checkReply(opening, rw, {});
  out.weather = { kept: Object.values(rw.changes.world.weather), fixes: cw.fixes.filter(f => f.includes('weather')), looks: WEATHER.filter(w => !LOOK[w]), lookKeys: [...new Set(Object.values(LOOK).map(l => ['sun', 'sunC', 'hemi', 'top', 'hor', 'fog', 'near', 'far', 'cover', 'shade', 'wind', 'wet', 'rime'].every(k => k in l)))] };
  out.sky = { seasons: ['1740-10-21', '1741-01-15', '1741-04-10', '1741-07-01'].map(seasonOf), dec: +sunTimes('1740-12-21').length.toFixed(1), jun: +sunTimes('1741-06-21').length.toFixed(1),
    noonDec: Math.round(sunVector('1740-12-21', 12).alt), noonJun: Math.round(sunVector('1741-06-21', 12).alt), morningEast: sunVector('1740-10-21', 9).x > 0, newMoon: +moonPhase('2024-04-08').toFixed(2), fullMoon: +moonPhase('2024-04-23').toFixed(2),
    palettes: Object.keys(LEAVES).every(k => COUNTRY[k] && COUNTRY[k].grass.length === 3 && COUNTRY[k].fields.length === 4) }; }
// a place's own tempo: bad values and unknown places are left out; it lasts, merges per place, and makes a battle near
{ const h = { chronicle: 'c', decisions: [{}], fortune_used: [{}] }, real = JSON.parse(JSON.stringify(opening)); real.battleDemo = { ...real.battleDemo, id: 'bd-real' };
  const r1 = reply(real, { date: '1740-10-25', title: 't', briefing: 'b', reports: [], world: { tempo: 'winter quarters', tempoAt: { glogau: 'campaigning', brieg: 'truce', prague: 'marching', atlantis: 'campaigning' } }, hidden: h });
  const c1 = checkReply(real, r1, {}), n1 = mergeTurn(real, r1).next;
  const r2 = reply(n1, { date: '1740-10-30', title: 't', briefing: 'b', reports: [], world: { tempoAt: { brieg: null, neisse: 'campaigning' } }, hidden: h }); checkReply(n1, r2, {});
  const n2 = mergeTurn(n1, r2).next, r3 = reply(n2, { date: '1740-11-04', title: 't', briefing: 'b', reports: [], hidden: h }), n3 = mergeTurn(n2, r3).next;
  const quiet = JSON.parse(JSON.stringify(n3)); quiet.world.tempoAt = { glogau: 'truce', neisse: 'truce' };
  out.tempoAt = { kept: r1.changes.world.tempoAt, fixes: c1.fixes.filter(f => f.includes('tempoAt')).length, merged: n2.world.tempoAt, lasts: n3.world.tempoAt, near: !!liveState(n3).battleDemo.units, notNear: !!liveState(quiet).battleDemo.units, fmt: replyFormat(opening).includes('"tempoAt"'), contract: contract.includes('**tempoAt**') }; }
// a scene on its day: none given → the last day of the turn; outside the turn → clamped; a bad date → the last day
{ const h = { chronicle: 'c', decisions: [{}], fortune_used: [{}] }, sc = date => ({ id: 's', title: 't', lines: [{ who: 'player', text: 'x' }], ...(date === undefined ? {} : { date }) });
  const one = date => { const r = reply(opening, { date: '1740-10-28', title: 't', briefing: 'b', reports: [], scene: sc(date), hidden: h }), c = checkReply(opening, r, {}); return [r.changes.scene.date, c.fixes.filter(f => /scene/i.test(f)).length]; };
  const mk = JSON.parse(read('w3d/mocks/meeting.json')).changes, mr = reply(opening, mk); checkReply(opening, mr, {});
  out.sceneDate = { none: one(), inside: one('1740-10-24'), before: one('1740-10-01'), after: one('1740-11-30'), bad: one('Thursday'), mock: mergeTurn(opening, mr).next.scene.date, fmt: replyFormat(opening).includes('"date":"YYYY-MM-DD" (the day of the meeting)'),
    names: sceneLines(mk.scene, opening.cast).map(l => l.who) }; }
// world.scene is the old name of world.sights: read as sights with a fix, and an old save's tags are cleared at the next turn
{ const r = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], world: { scene: { vienna: ['alarm', 'dragons'] } }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } }), c = checkReply(opening, r, {});
  out.sights = { world: r.changes.world, fixes: c.fixes.filter(f => /scene|sights/.test(f)).length, fmt: replyFormat(opening).includes('"sights":{"vienna"') && !replyFormat(opening).includes('"scene":{"vienna"') }; }
// Campaign continuity survives long delays, compact packets and save-file round trips.
{
  const scene = { id: 'promise', date: '1740-10-21', title: 'A promise', status: 'closed', participants: [{ id: 'a', name: 'Adviser' }], lines: [{ who: 'a', text: 'The men will need reinforcements.' }], commitments: ['Send two regiments.', { text: 'Report by Friday.' }] };
  const start = { ...s0, scene }, long = 'To Wallis: ' + 'Keep this exact qualification. '.repeat(20), sent = [{ turn: 0, orders: [{ ref: 'T0-1', line: long }, { ref: 'T0-2', line: 'Hold the bridge.' }] }];
  let next = mergeTurn(start, { turn: 1, parentTurn: 0, changes: { date: '1740-10-22' } }, { sent }).next;
  for (let i = 2; i <= 12; i++) next = mergeTurn(next, { turn: i, parentTurn: i - 1, changes: { date: '1740-11-02' } }).next;
  next = JSON.parse(JSON.stringify(next)); // the state inside a campaign file, without browser storage
  const pk = buildPacket({ state: next, contract: '', orders: '', almanac: {}, fortune: [] });
  const answered = mergeTurn(next, { turn: 13, parentTurn: 12, changes: { reports: [{ id: 'answer', re: ['T0-1'] }] } }, { sent }).next;
  const later = mergeTurn(answered, { turn: 14, parentTurn: 13, changes: {} }, { sent }).next;
  const final = mergeTurn(later, { turn: 15, parentTurn: 14, changes: { exchange: { orders: [], commitments: [] } } }).next;
  const settled = pendingOrders(next, [{ ...sent[0], settled: true }]);
  const badTurn = checkReply(opening, { ...reply(opening, {}), turn: 99 }, {});
  out.exchange = { refs: next.exchange.orders.map(o => o.ref), commitments: next.exchange.commitments.map(c => c.text), scene: next.exchange.lastScene, currentScene: next.scene,
    packet: pk.includes(long) && pk.includes('Send two regiments.') && pk.includes('The men will need reinforcements.'),
    answered: later.exchange.orders.map(o => o.ref), forged: final.exchange.commitments.length, settled: settled.length,
    dedup: exchangeRecord({ ...next, scene }).commitments.length,
    forged: final.exchange.commitments.length, dedup: exchangeRecord({ ...next, scene }).commitments.length, recovery: badTurn.errors.some(e => e.includes('Copy a fresh dispatch')) };
}
// your staff explain: the secretary's letter points only to letters already come; notes, follows and debate are made safe
{ const lv = reply(opening, JSON.parse(read('w3d/mocks/living.json')).changes), lc = checkReply(opening, lv, {}), { next: n1 } = mergeTurn(opening, lv);
  const r2 = reply(n1, { date: '1740-10-27', title: 't', briefing: 'b', reports: [], hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const bad = reply(opening, { date: '1740-10-25', title: 't', briefing: 'b', hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] },
    reports: [{ id: 'a', title: 'Early', text: 'At Breslau.', dated: '1740-10-22', arrives: '1740-10-22', source: 's', follows: ['C0', 'C9'], guidance: { known: 'k', secret: 'x' } },
      { id: 'b', title: 'Late', text: 'Later news.', dated: '1740-10-25', arrives: '1740-10-25', source: 's', guidance: 'not an object' }],
    staffBriefing: { dated: '1740-10-23', changed: 'Breslau writes.', letters: ['a', 'b', 'nope'], places: ['breslau', 'atlantis'], guidance: { suspected: 's' } },
    decision: { id: 'd', title: 'd', options: [{ id: 'o', by: 'x', title: 'O', ifWait: 3, guidance: { known: 'k' } }], debate: [{ who: 'a', text: 'yes' }, { text: 'no who' }] } });
  const bc = checkReply(opening, bad, { followIds: ['C0', 'U0-1'] });
  const dropped = reply(opening, { date: '1740-10-25', title: 't', briefing: 'b', reports: [], staffBriefing: { letters: [] }, hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } }), dc = checkReply(opening, dropped, {});
  const pk = buildPacket({ state: opening, contract, orders: '', almanac, fortune: [], earlier: [{ id: 'C0', text: 'The course you adopted in council: X (1740-10-21)' }] });
  out.staff = { living: { fixes: lc.fixes, warns: lc.warns, briefing: n1.staffBriefing, guidance: n1.reports.find(r => r.id === 't1-3').guidance }, cleared: mergeTurn(n1, r2).next.staffBriefing,
    live: 'staffBriefing' in liveState(n1), briefing: bad.changes.staffBriefing, reports: bad.changes.reports, decision: bad.changes.decision, fixes: bc.fixes, errors: bc.errors,
    dropped: { has: 'staffBriefing' in dropped.changes, fixes: dc.fixes }, packet: pk.includes('## The player’s earlier decisions') && pk.includes('- [C0] The course you adopted'), noEarlier: !buildPacket({ state: opening, contract, orders: '', almanac, fortune: [] }).includes('## The player’s earlier decisions'),
    format: replyFormat(opening).includes('staffBriefing') && replyFormat(null).includes('"follows"'), contract: contract.includes('## Your staff explain') };
}
// your desk: undertakings keep their stages, hearsay only grows, the calendar and audiences are checked; a scene can answer a preparation
{ const lv = reply(opening, JSON.parse(read('w3d/mocks/living.json')).changes), lc = checkReply(opening, lv, {}), { next: n1 } = mergeTurn(opening, lv);
  const r2 = reply(n1, { date: '1740-10-30', title: 't', briefing: 'b', reports: [], hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] },
    undertakings: [{ id: 'u-daybook', stage: 'The receipts show the entry twice; a clerk is questioned.', updated: '1740-10-29', history: [{ stage: 'forged' }] }, { id: 'u-bad' }, { id: 'u-st', title: 'T', stage: 'S', status: 'paused', due: 'soon' }],
    hearsay: [{ said: 'He is honest, which will not last.', source: 'a footman', date: '1741-01-01' }, { said: '' }, { said: 'x', teller: 'nobody' }],
    calendar: [{ id: 'cal-bad' }, { id: 'cal-r', date: '1740-12-25', what: 'Christmas', certainty: 'sure' }, { id: 'cal-roads', _remove: true }],
    audiences: [{ id: 'aud-starhemberg', status: 'held' }, { id: 'aud-x', with: ['ghost'], date: '1740-11-02', status: 'soon' }, { id: 'aud-bad', with: [] }],
    scene: { id: 'sc', title: 'With Starhemberg', date: '1740-10-28', lines: [{ who: 'starhemberg', text: 'Well?' }], re: ['T1-1', 'T9-9'] } });
  const c2 = checkReply(n1, r2, { orderRefs: ['T1-1'] }), { next: n2 } = mergeTurn(n1, r2), u = n2.undertakings.find(x => x.id === 'u-daybook');
  const brief = { turn: 1, orders: [{ ref: 'T1-1', line: 'For my audience with Count Starhemberg — I will press: the chests.' }] };
  out.desk = { living: { fixes: lc.fixes, warns: lc.warns, u: n1.undertakings, hearsay: n1.hearsay, calendar: n1.calendar, audiences: n1.audiences },
    errors: c2.errors, fixes: c2.fixes, warns: c2.warns, u, undertakings: n2.undertakings.map(x => x.id), st: n2.undertakings.find(x => x.id === 'u-st'), hearsay: n2.hearsay, calendar: n2.calendar, audiences: n2.audiences, sceneRe: n2.scene.re,
    pending: pendingOrders(n2, [brief]).map(o => o.ref), pendingBefore: pendingOrders(n1, [brief]).map(o => o.ref),
    live: (() => { const big = { ...n2, hearsay: Array.from({ length: 15 }, (_, i) => ({ said: 's' + i })) }, ls = liveState(big); return { hearsay: ls.hearsay.length, history: ls.undertakings.some(x => 'history' in x) }; })(),
    format: replyFormat(null).includes('"undertakings"') && replyFormat(null).includes('"hearsay"'), contract: contract.includes('## Your desk') };
}
// instructions to the secretary, the day-book, the courier through the repository
{ const lv = reply(opening, JSON.parse(read('w3d/mocks/living.json')).changes), lc = checkReply(opening, lv, {}), { next: n1 } = mergeTurn(opening, lv);
  const withIns = { ...opening, instructions: { text: 'Acknowledge routine returns. Refuse loans.', written: '1740-10-21', revised: '1740-10-21' } };
  const pk = buildPacket({ state: withIns, contract, orders: '## Orders of the day\nTest.', almanac, fortune: [], courier: 'repo', dispatch: 'abc123' });
  const bad = reply(opening, { date: '1740-10-25', title: 't', briefing: 'b', hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] }, instructions: { text: 'forged' },
    reports: [{ id: 'a', title: 'A', text: 'x', dated: '1740-10-22', source: 's', handled: 3 }], daybook: [{ entry: '' }, { entry: 'Answered A.', date: '1741-05-01', letters: ['a', 'zzz'] }] });
  const bc = checkReply(opening, bad, {});
  const disp = ok => checkReply(opening, { ...reply(opening, { date: '1740-10-22', title: 't', briefing: 'b', reports: [] }), dispatch: ok ? 'd1' : 'd0' }, { dispatch: 'd1' }).errors;
  // the packet read back, as the coding agent's check sees it
  const back = prevFromPacket(pk + '\n<!-- check: {"orderRefs":["T0-1"],"seal":"' + sealOf(opening) + '","dispatch":"abc123"} -->\n');
  out.courier = { living: { fixes: lc.fixes, warns: lc.warns, daybook: n1.daybook, handled: n1.reports.find(r => r.id === 't1-3').handled },
    packet: { ins: pk.includes('## The player’s instructions to their secretary (written 1740-10-21)') && pk.includes('Refuse loans.'), tool: pk.includes('node tools/turn-tool.mjs rules'), dispatch: pk.includes('"dispatch": "abc123"'), noContract: !pk.includes('## Adjudication principles') },
    live: 'instructions' in liveState(withIns), kept: mergeTurn(withIns, lv).next.instructions, badFixes: bc.fixes, daybook: bad.changes.daybook, handled: 'handled' in bad.changes.reports[0],
    dispatch: { same: disp(true), other: disp(false) },
    back: { cast: back.prev.cast.length, castWas: opening.cast.length, lat: back.prev.locations[0].lat, locs: back.prev.locations.length, ctx: back.ctx, date: back.prev.date, check: checkReply(back.prev, lv, back.ctx).errors } };
}
// lean exchange: the check block alone gives the same verdict as the whole state; the rules leave out battles when none is near
{ const mkL = JSON.parse(read('w3d/mocks/living.json')).changes, lv = reply(opening, mkL), { next: n1 } = mergeTurn(opening, lv);
  const verdict = (prev, r, ctx) => { const c = checkReply(prev, JSON.parse(JSON.stringify(r)), ctx); return { errors: c.errors, warns: c.warns, fixes: c.fixes, cont: c.errors.length ? [] : checkContinuity(prev, mergeTurn(prev, JSON.parse(JSON.stringify(r)), {}).next).map(i => i.level + ':' + i.text) }; };
  const roundTrip = st => prevFromPacket('<!-- check: ' + JSON.stringify({ seal: sealOf(st), prev: checkSkeleton(st) }) + ' -->').prev;
  const r2 = reply(n1, { date: '1740-10-30', title: 't', briefing: 'b', reports: [{ id: 'x', title: 'X', text: 'x', dated: '1740-10-27', source: 's', from_id: 'ghost' }], cast: [{ id: 'kessler', _remove: true }], undertakings: [{ id: 'u-daybook', stage: 'moved' }, { id: 'u-new' }], audiences: [{ id: 'aud-starhemberg', status: 'held' }], movements: [{ id: 'mv-new', label: 'x' }], hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}], standing: { bartenstein: 'hostile' } } });
  const sk0 = JSON.stringify(checkSkeleton(opening)).length, sk1 = JSON.stringify(checkSkeleton(n1)).length;
  const rulesQuiet = rulesText({ contract, almanac }, { battle: false }), rulesFull = rulesText({ contract, almanac });
  const er = b => courierErrand({ repo: 'o/r', path: 'turns/c/turn-002.json', dispatch: 'dd', turn: 2, version: 'v1', battle: b });
  out.slim = { same: [JSON.stringify(verdict(opening, lv, {})) === JSON.stringify(verdict(roundTrip(opening), lv, {})), JSON.stringify(verdict(n1, r2, {})) === JSON.stringify(verdict(roundTrip(n1), r2, {}))],
    v2: verdict(roundTrip(n1), r2, {}), skeleton: [sk0, sk1],
    rules: { quiet: rulesQuiet.length, full: rulesFull.length, sameVersionLine: rulesQuiet.split('\n')[0] === rulesFull.split('\n')[0], hint: rulesQuiet.includes('rules --battle'), noGrounds: !rulesQuiet.includes('## Battle grounds') && !rulesQuiet.includes('battleDemo.ground is'), fullGrounds: rulesFull.includes('## Battle grounds') },
    near: [isBattleNear(opening), isBattleNear(n1)],
    errand: { quiet: er(false), battle: er(true) } };
}
// the people you know: the secretary's notes are checked, kept by the page and never sent; the files hold only what reached the player
{ const r = reply(opening, { date: '1740-10-30', title: 't', briefing: 'b', reports: [], dossier: [{ who: 'wallis', date: '1740-10-25', note: 'Glogau has its first payment.' }, { who: 'nobody', note: 'x' }, { who: 'neipperg' }, { who: 'bartenstein', date: '1741-03-01', note: 'Late.' }], hidden: { chronicle: 'c', decisions: [{}], fortune_used: [{}] } });
  const chk = checkReply(opening, r, {}), { next } = mergeTurn(opening, r);
  const files = (today, extra = {}) => peopleFiles({ cast: opening.cast, letters: [...opening.reports, { id: 'mandate', kind: 'mandate', from_id: opening.mandate.from_id, dated: opening.mandate.dated, title: opening.mandate.title, text: opening.mandate.text }], dossier: next.dossier, remarks: opening.remarks, household: opening.household, hearsay: [], audiences: [], today, ...extra });
  const f = files('1740-10-26', { orders: [{ ref: 'T0-1', to: 'wallis', line: 'To Wallis: hold Glogau.', date: '1740-10-21', answered: false }], sightings: [{ date: '1740-10-22', place: 'vienna', who: ['sinzendorf'], doing: 'at the Conference' }], overheard: [{ date: '1740-10-22', line: 'He counts too much.', who: 'Count Sinzendorf and Johann Christoph Bartenstein' }], hearsay: [{ teller: 'starhemberg', said: 'Honest.', date: '1740-10-23' }, { teller: 'starhemberg', said: 'Later.', date: '1740-10-29' }] });
  const pick = (fs, id) => fs.find(x => x.id === id), early = files('1740-10-21');
  out.dossier = { fixes: chk.fixes.filter(x => /dossier|note on/.test(x)), kept: next.dossier.map(n => [n.who, n.date]), sent: 'dossier' in liveState(next), openingWho: (opening.dossier || []).map(n => n.who), cast: opening.cast.map(c => c.id),
    aliases: aliasesOf(opening.cast), order: f.filter(x => x.known).map(x => x.id),
    wallis: pick(f, 'wallis'), wallisEarly: pick(early, 'wallis').notes.map(n => n.note), bartenstein: pick(f, 'bartenstein'), neipperg: pick(f, 'neipperg'), francis: pick(f, 'francis_stephen'), sinzendorf: pick(f, 'sinzendorf'), starhemberg: pick(f, 'starhemberg'), dresden: pick(f, 'dresden-envoy'), queen: pick(f, 'maria_theresa'), own: !!pick(f, 'own-forces'), secretary: !!pick(f, 'secretary') }; }
console.log(JSON.stringify(out));

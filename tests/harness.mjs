// Runs the reply pipeline (w3d/turn.js, w3d/continuity.js) on the opening state and the mock replies; prints JSON for pytest.
import { readFileSync } from 'node:fs';
import { parseReply, checkReply, mergeTurn, buildPacket, liveState, rollFortune, applyBranch, activePlots, STATIC_KEYS, sealOf, nextLink, fingerprint, volumeDue } from '../w3d/turn.js';
import { checkContinuity } from '../w3d/continuity.js';
import { makeGround, groundKey } from '../w3d/ground.js';
const root = new URL('../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const html = read('cabinet-of-war.html'), m = html.match(/id="initial-state">([\s\S]*?)<\/script>/);
const opening = JSON.parse(m[1].replace(/\\u003c/g, '<')), almanac = JSON.parse(read('w3d/almanac.json')), contract = read('w3d/contract.md');
const out = { mocks: {} };
const reply = (state, changes) => ({ kind: 'turn', schemaVersion: 3, campaignId: state.campaignId, turn: state.turn + 1, parentTurn: state.turn, seal: sealOf(state), changes: JSON.parse(JSON.stringify(changes)) });
for (const name of ['answers', 'winter', 'dismissed', 'backwards', 'contradiction', 'living', 'ending', 'journey', 'battle']) {
  const mk = JSON.parse(read('w3d/mocks/' + name + '.json')), r = reply(opening, mk.changes);
  const chk = checkReply(opening, r, { orderRefs: ['T0-1', 'T0-2', 'T0-3'], fortune: rollFortune(opening.campaignId, 0), seal: sealOf(opening) });
  const res = { errors: chk.errors, warns: chk.warns, fixes: chk.fixes };
  if (!chk.errors.length) { const { next } = mergeTurn(opening, r); res.next = { turn: next.turn, date: next.date, reports: next.reports.length, canon: next.hidden.canon.length, cast: next.cast.length, threads: next.hidden.threads.length, decision: next.decision, world: next.world, ended: next.ended || null, kessler: next.cast.find(c => c.id === 'kessler') || null, thread: next.hidden.threads.find(t => t.id === 'pol_prussian_invasion'), standingOrders: !!next.hidden.standingOrders, forces: next.forces.length, enemy: (next.battleDemo || {}).enemy || null, urgent: (next.reports.find(x => x.urgent) || {}).urgent || null, gazette: next.gazette, household: next.household, aftermath: (next.battleDemo || {}).aftermath || null, purse: next.hidden.purse || null };
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
  const g = makeGround(bd), g2 = makeGround(JSON.parse(JSON.stringify(bd))), at = (e, n) => { const c = Math.floor((e + g.w / 2) / g.cell), rr = Math.floor((g.h / 2 - n) / g.cell); return +g.rows_str[rr][c]; };
  const G = bd.ground, s = G.streams[0];
  out.battle = { ids: bd.units.map(u => u.id).sort(), mockIds: mk.battleDemo.units.map(u => u.id).sort(), options: (bd.options || []).map(o => o.id), aftermath: bd.aftermath || null,
    cells: { village: at(G.villages[0].e, G.villages[0].n), hamlet: at(G.villages[1].e, G.villages[1].n), wood: at(G.woods[0].e, G.woods[0].n), stream: at(s.path[2][0], s.path[2][1]), bridge: at(...s.crossings[0]), ford: at(...s.crossings[1]) },
    unitCells: [...new Set(bd.units.map(u => at(u.e, u.n)))], same: JSON.stringify(g) === JSON.stringify(g2), relief: g.relief, names: g.names.map(x => x.name),
    mollwitz: makeGround(opening.battleDemo), keyChanges: groundKey(opening.battleDemo) !== groundKey(bd), size: [g.cols, g.rows, g.rows_str.length, g.rows_str[0].length],
    packet: (liveState(next).battleDemo || {}).ground ? 'ground' : 'none' };
  const sameId = reply(next, { date: '1740-12-23', title: 't', briefing: 'b', reports: [], battleDemo: { units: [{ id: 'GA1', e: -880 }, { id: 'GB7', _remove: true }] } });
  out.battle.sameId = mergeTurn(next, sameId).next.battleDemo.units.length;
  const badB = reply(opening, { date: '1740-10-23', title: 't', briefing: 'b', reports: [], battleDemo: { id: 'bd-x', ground: { kind: 'swamp', villages: [{ name: 'Far', e: 9000, n: 0 }, { name: 'Ok', e: 0, n: 0, size: 'city' }] }, units: [{ id: 'X1', side: 'C', type: 'inf', e: 0, n: 0 }, { id: 'X2', side: 'A', type: 'inf', e: 0, n: 99999 }, { id: 'X3', side: 'A', type: 'cav', e: 10, n: 10 }] } });
  const bb = checkReply(opening, badB, {}); out.battle.bad = { fixes: bb.fixes, warns: bb.warns, kind: badB.changes.battleDemo.ground.kind, villages: badB.changes.battleDemo.ground.villages.map(v => v.name + ':' + v.size), units: badB.changes.battleDemo.units.map(u => u.id + ':' + u.facing) };
}
console.log(JSON.stringify(out));

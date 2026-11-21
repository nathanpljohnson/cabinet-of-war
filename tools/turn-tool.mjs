#!/usr/bin/env node
// The courier's tools, for a coding agent (Claude Code, Codex) adjudicating a turn in this repository.
//   node tools/turn-tool.mjs rules [--battle]            print the rules (versioned); the battle rules only with --battle
//   node tools/turn-tool.mjs check <check> <reply.json>  check a reply against the check block (or the whole packet) it answers, as the game will
// The game page checks again when it loads the turn; this is the same check run first, so mistakes are fixed before the push.
import { readFileSync } from 'node:fs';
import { rulesText, rulesVersion, checkReply, mergeTurn, parseReply, prevFromPacket } from '../w3d/turn.js';
import { checkContinuity } from '../w3d/continuity.js';

const root = new URL('../', import.meta.url), read = p => readFileSync(new URL(p, root), 'utf8');
const contract = read('w3d/contract.md'), almanac = JSON.parse(read('w3d/almanac.json'));
const [cmd, packetPath, replyPath] = process.argv.slice(2);

if (cmd === 'rules') {
  process.stdout.write(rulesText({ contract, almanac }, { battle: process.argv.includes('--battle') }));
} else if (cmd === 'version') {
  console.log(rulesVersion({ contract, almanac }));
} else if (cmd === 'check' && packetPath && replyPath) {
  const { prev, ctx } = prevFromPacket(readFileSync(packetPath, 'utf8'));
  const p = parseReply(readFileSync(replyPath, 'utf8'));
  if (p.error) { console.log('ERROR: ' + p.error); process.exit(1); }
  const reply = p.value, r = checkReply(prev, reply, ctx);
  let cont = [];
  if (!r.errors.length) { try { cont = checkContinuity(prev, mergeTurn(prev, reply, {}).next); } catch (e) { cont = [{ level: 'warn', text: 'Continuity check could not run: ' + e.message }]; } }
  const errors = [...r.errors, ...cont.filter(i => i.level === 'error').map(i => i.text)], warns = [...r.warns, ...cont.filter(i => i.level !== 'error').map(i => i.text)];
  for (const e of errors) console.log('ERROR: ' + e);
  for (const w of warns) console.log('WARNING: ' + w);
  for (const f of r.fixes) console.log('FIX ON ARRIVAL: ' + f + ' (correct it in the file instead)');
  if (!errors.length && !warns.length && !r.fixes.length) console.log('OK: turn ' + reply.turn + ' is ready to push.');
  process.exit(errors.length ? 1 : warns.length || r.fixes.length ? 2 : 0);
} else {
  console.log('Usage:\n  node tools/turn-tool.mjs rules [--battle]\n  node tools/turn-tool.mjs check <check block or packet file> <reply file>');
  process.exit(cmd ? 1 : 0);
}

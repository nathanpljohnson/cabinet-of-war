# game-v10: backend and living-world pass

## A. Backend
- [x] 1 Turn replies are changes only (schema 3), merged by the page
- [x] 2 Almanac (static research) out of the state; packet carries index + active plots
- [x] 3 Safe saves: prune snapshots, warn on failure, campaign file per turn, load it back
- [x] 4 Chronicle: Claude keeps a short story-so-far
- [x] 5 Threads: plot tracker Claude updates
- [x] 6 Stricter reply checks + cut-off paste handling
- [x] 7 Tests for the reply format (pytest + node)
- [x] 8 Contract and almanac as small files
- [x] 9 CLAUDE.md, docs tidy

## B/C. World
- [x] 10 Dice rolled by the page
- [x] 11 Other powers decide first
- [x] 12 Claude can add people
- [x] 13 Weather from the story
- [x] 14 Scene tags
- [x] 15 Enemy general's temperament
- [x] 16 Urgent letters with branches
- [x] 17 Whereabouts
- [x] 18 Trust / doubt sources
- [x] 19 Endings and epilogue
- [x] 20 Book of the campaign

## Verify
- [x] Tests pass
- [x] Full loop in browser with mock replies
- [x] lightCheck passes with new weather

# game-v11: the record, the Diarium, the purse, the seasons, the field afterwards
- [x] 2 Sealed record (seal chain, file fingerprint, ironman)
- [x] 4 Chronicle volumes every ten turns
- [x] 6 Wiennerisches Diarium
- [x] 10 His own purse
- [x] 11 Winter quarters / campaigning / truce
- [x] 13 Ride over the field afterwards
- [x] Tests (21) and browser check

# Road and Glogau scenes (playtest follow-up)
- [x] On the road: a post-house on the high road (inn, stables, coach-house, your coach with fresh horses, well, the post sign), no camp, town or cast; steward says when you ride on
- [x] Glogau: bastioned trace with rampart, brick scarp, dry ditch, covered way, cleared glacis, gate through the east front, sentry boxes and guns on the salients; brick hall church
- [x] Brünn: the Spielberg citadel on its hill
- [x] Browser check (separate profile, muted, autosave off): road summer and winter, Glogau, Brünn, Vienna unchanged; lightCheck passes on the road and at Glogau; tests pass

# Battlefields: each battle its own ground
- [x] battleDemo.ground: a kind (plain, farmland, wooded, hills, river) plus named villages, woods, streams with crossings, heights
- [x] w3d/ground.js draws the 30 m grid the rules read; background clears round the armies; a river kind without a river gets one between them
- [x] A new battle id replaces the field whole (units, courses, aftermath, ground); same id still merges by id
- [x] 3D field: relief by kind, named heights, valleys and shallow beds by distance to water, dry valleys past the edge
- [x] Desk: lines and wings read from where the army stands and faces; labels and view on the armies; reset follows the battle
- [x] Reply checks and format, contract, battle mock and tests (30 pass); browser: Mollwitz unchanged, new field, a phase fought, aftermath ride
- [x] The desk map draws the battle's ground (same warped outlines as the 3D field, field patches, villages) with the named features, under the units; Mollwitz keeps the real map

# Simulated playthrough + debug (Nov 2026)
- [x] Driver: Playwright page held open (scratchpad), helpers to read letters, give orders, seal, paste, walk days
- [x] Play turns 0 → 11 (21 Oct → 22 Dec 1740; stopped after the crossing and volume 1 — no battle is plausible before spring) on a fresh profile (sound off, autosave off); a fresh adjudicator agent answers each packet cold
- [x] Log every finding (game, packet, checker, history) as it happens
- [x] Rank findings; fix the bugs in code; tests for each fix (30 → 33); re-run the affected turn
- [x] Write the report (tasks/playtest-2026-11-20.md)

## Review
17 fixes on the branch (one blocker: every audience refused; one leak path: the Mollwitz preview sent as the live field once campaigning). Open: illness in 3D (design), one global tempo (design), context budget (~35k tokens a turn), scenes not rare, no price/weather baselines. Untested: table battle, endings, urgent letters, forged letters.
# game-v13: each battle on its own ground (plan, 4 Nov 2026)

**Problem.** Every battle uses one baked 30 m land-cover grid of Mollwitz (`<script id="terrain">`, read as `TER` by the sim in `src/battle.js`, the desk map and `w3d/battle3d.js`). Relief is noise (`height()` in battle3d.js). `battleDemo.center` moves the units' lat/lon, not the ground.

**What battle-atlas gives us.** Real relief from AWS Terrarium tiles (CORS open, reachable), stored as uint16 (elev−min)×10 base64; scenery authored per battle from period maps (woods as ellipses, rivers as polylines, villages as points, roads); season tint; phase-keyed unit moves (lines keep formation, columns snake along roads, contact push). Leuthen (Breslau, 1757) and Rossbach are already authored.

## Plan
- [ ] 1 Ground file format `w3d/grounds/<id>.json`: bbox, relief grid (atlas encoding), 30 m land-cover rows (open/wood/water/village + new: marsh, vineyard, hill-steep), rivers, roads, villages with names.
- [ ] 2 Build tool `src/ground_build.py` (port of atlas `terrain.py` + `battlekit` scenery rasteriser): DEM fetch → relief; authored scenery → land-cover grid.
- [ ] 3 Library of likely fields for 1740–45, scenery from period sources: Mollwitz (re-cut from today's grid), Breslau/Leuthen ground (from atlas), Brieg, Neisse, Glogau, Chotusitz, Prague, Linz/Danube. List in the packet as vocabulary.
- [ ] 4 `battleDemo.ground`: Claude picks a library id, or gives `ground: {kind}` (river crossing, vineyards, marsh, wooded hills, open plain) for a field not in the library; the page then fetches real relief for `center` at runtime and lays land cover from the kind. Reply check warns on unknown ids. Contract + `replyFormat()` + tests together.
- [ ] 5 Page: swap `TER` in place on load (sim, desk map and 3D see the same ground); battle3d uses real relief instead of noise; vineyards/marsh get their own paint and props.
- [ ] 6 Sim: ridges block sight (relief in `blocked()`), uphill slows a march. Small, in `src/battle.js`.
- [ ] 7 Replay a battle account phase by phase (atlas `setPhase`): Claude gives positions per phase; "See the ground as described" steps through them.
- [ ] 8 Atlas-style marching in the table battle: lines keep formation, columns follow roads, contact push.
- [ ] 9 Atlas camera (orbit) + clock rail (←/→, Play) for both the replay and the commanded battle; in the commanded battle a rail step = one phase of orders then moves.

Decisions (Nathan, 4 Nov): library + live fallback; replay accounts; atlas marching; atlas camera + clock rail everywhere.
- [ ] Verify: pytest, mock reply per ground kind, screenshots of 3+ grounds, lightCheck, sound off, separate profile.

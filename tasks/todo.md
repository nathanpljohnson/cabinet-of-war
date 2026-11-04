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

# game-v13: each battle on its own ground (plan, 4 Nov 2026)

**Problem.** Every battle uses one baked 30 m land-cover grid of Mollwitz (`<script id="terrain">`, read as `TER` by the sim in `src/battle.js`, the desk map and `w3d/battle3d.js`). Relief is noise (`height()` in battle3d.js). `battleDemo.center` moves the units' lat/lon, not the ground.

**What battle-atlas gives us.** Real relief from AWS Terrarium tiles (CORS open, reachable), stored as uint16 (elev−min)×10 base64; scenery authored per battle from period maps (woods as ellipses, rivers as polylines, villages as points, roads); season tint; phase-keyed unit moves (lines keep formation, columns snake along roads, contact push). Leuthen (Breslau, 1757) and Rossbach are already authored.

## Plan
- [x] 1 Ground file format `w3d/grounds/<id>.json`: bbox, relief grid (atlas encoding), 30 m land-cover rows (open/wood/water/village + new: marsh, vineyard, hill-steep), rivers, roads, villages with names.
- [x] 2 Build tool `src/ground_build.py` (port of atlas `terrain.py` + `battlekit` scenery rasteriser): DEM fetch → relief; authored scenery → land-cover grid.
- [x] 3 Library of likely fields for 1740–45, scenery from period sources: Mollwitz (re-cut from today's grid), Breslau/Leuthen ground (from atlas), Brieg, Neisse, Glogau, Chotusitz, Prague, Linz/Danube. List in the packet as vocabulary.
- [x] 4 `battleDemo.ground`: Claude picks a library id, or gives `ground: {kind}` (river crossing, vineyards, marsh, wooded hills, open plain) for a field not in the library; the page then fetches real relief for `center` at runtime and lays land cover from the kind. Reply check warns on unknown ids. Contract + `replyFormat()` + tests together.
- [x] 5 Page: swap `TER` in place on load (sim, desk map and 3D see the same ground); battle3d uses real relief instead of noise; vineyards/marsh get their own paint and props.
- [ ] 6 Sim: ridges block sight (relief in `blocked()`), uphill slows a march. Small, in `src/battle.js`.
- [ ] 7 Replay a battle account phase by phase (atlas `setPhase`): Claude gives positions per phase; "See the ground as described" steps through them.
- [x] 8 Atlas-style marching in the table battle: lines keep formation, columns follow roads, contact push.
- [ ] 9 Atlas camera (orbit) + clock rail (←/→, Play) for both the replay and the commanded battle; in the commanded battle a rail step = one phase of orders then moves.

Decisions (Nathan, 4 Nov): library + live fallback; replay accounts; atlas marching; atlas camera + clock rail everywhere.
- [ ] Verify: pytest, mock reply per ground kind, screenshots of 3+ grounds, lightCheck, sound off, separate profile.

## Stage 1 done (4 Nov): grounds, library, TER swap, real relief
- `src/ground_build.py` → `w3d/grounds/<id>.json` (+ `index.json`): the 30 m grid, relief at its nodes and 200 m relief + cover 12.6 km round, brooks, roads (Leuthen only), named places, notes and sources. Library: mollwitz, brieg, neisse, glogau, chotusitz, prague, leuthen, linz.
- Sources: Terrarium relief (surface model: canopy filled from the fields, buildings removed by a 150 m opening); ESA WorldCover 2021 for woods/water/marsh (today's cover, said so in each file); villages = WorldCover built-up joined to Overture Maps gazetteer points (German name where Overture has one); town extents for 1740 inferred and marked; brooks traced from the relief; Leuthen scenery from battle-atlas. Removed by hand: Nysa reservoir (1971), Linz harbour basins.
- **Found: the game's Mollwitz grid was stored south-up.** Flipped, 2244 of 2470 wood cells fall on today's woods (116 as stored). Now north-up; both armies moved 660 m north to stay on open ground; the band of cleared villages redone in true orientation; older saves are moved the same way at boot.
- Page: `w3d/ground.js` loads a library ground or lays out a `{kind}` field on Terrarium relief fetched in the browser, then `Object.assign(TER, …)`; synced at boot, after each accepted turn and before the field is built; `battle3d` is rebuilt when the ground changes (`dispose()`), uses real relief (level ground up to 2× so it reads), paints marsh and vines, draws brooks at their width, water at its own level, and the country round from the outer grid.
- Rules: `GROUNDS`, `GROUND_KINDS` in `turn.js`; unknown ground → warning and open plain; contract lists the library with centres; sim `terMul` knows marsh and vines.

### Known gaps (later stages or follow-ups)
- Roads only at Leuthen (atlas); others need a source before stage 8 (columns follow roads).
- Towns are houses scattered over a walled area; no walls, bastions or bridges yet. Prague reads as a large village.
- Small modern embankments (rail, roads) of a few metres remain in the relief at Brieg and Glogau.
- Place names are in the ground files but not yet shown on the field.
- In headless (software) rendering, woods beyond ~2 km draw white; the same happens on `main`, so it is the renderer, not this change.

## Stage 8 (4 Nov): marching
- `w3d/march.js` hooks the desk's battle engine (`window.__march`, wired in `src/w3d_build.py`): lines keep their facing up to 60° off the front (advance, oblique, giving ground at 0.6 pace) and wheel on the inner flank (outer flank marches the arc, ≤ 12°/step); columns route over the 30 m grid by A* (roads ×1.3 speed and bridge water; woods, marsh, vines, villages at their slowing; water ×2 dearer off-road) with straight runs merged; after every move, overlapping units are pushed apart (oriented-rectangle separation), the mover giving way, a routing unit most.
- Troop types (atlas): inf, gd, lt, cav, lc, art. `u.type` stays the engine class (inf/cav/art), `u.kind` carries the type; men, morale, sight, fire, cover and shock shaded per type (`TROOPS`). Replies may give any of the six as `type`; unknown → inf with a fix.
- Roads for every library ground: today's country roads from Overture Maps (primary, secondary, tertiary, unclassified; left out inside today's towns), labelled as such; Leuthen keeps the atlas's period roads; live fields get illustrative tracks. Painted on the field.
- 3D: columns snake along their own track; light infantry in open order (2 ranks, loose); light horse looser.
- Tests: wheel pivot, separation, route fords and roads, troop types in replies (33 pass). In-page check on Mollwitz: line kept facing over a 500 m advance, second line wheeled 40° on its right flank, column marched 3.8 km, no overlaps.


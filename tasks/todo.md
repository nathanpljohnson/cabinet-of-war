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
- [x] 1 Ground file format `w3d/grounds/<id>.json`: bbox, relief grid (atlas encoding), 30 m land-cover rows (open/wood/water/village + new: marsh, vineyard, hill-steep), rivers, roads, villages with names.
- [x] 2 Build tool `src/ground_build.py` (port of atlas `terrain.py` + `battlekit` scenery rasteriser): DEM fetch → relief; authored scenery → land-cover grid.
- [x] 3 Library of likely fields for 1740–45, scenery from period sources: Mollwitz (re-cut from today's grid), Breslau/Leuthen ground (from atlas), Brieg, Neisse, Glogau, Chotusitz, Prague, Linz/Danube. List in the packet as vocabulary.
- [x] 4 `battleDemo.ground`: Claude picks a library id, or gives `ground: {kind}` (river crossing, vineyards, marsh, wooded hills, open plain) for a field not in the library; the page then fetches real relief for `center` at runtime and lays land cover from the kind. Reply check warns on unknown ids. Contract + `replyFormat()` + tests together.
- [x] 5 Page: swap `TER` in place on load (sim, desk map and 3D see the same ground); battle3d uses real relief instead of noise; vineyards/marsh get their own paint and props.
- [x] 6 Sim: ridges block sight (relief in `blocked()`), uphill slows a march. Small, in `src/battle.js`.
- [x] 7 Replay a battle account phase by phase (atlas `setPhase`): Claude gives positions per phase; "See the ground as described" steps through them.
- [x] 8 Atlas-style marching in the table battle: lines keep formation, columns follow roads, contact push.
- [x] 9 Atlas camera (orbit) + clock rail (←/→, Play) for both the replay and the commanded battle; in the commanded battle a rail step = one phase of orders then moves. (Replay half waits on 7.)

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

## Zig-zag fix and stage 9 (5 Nov)
- Zig-zag: `autoTurn` now goes through `w3d/march.js`: a line keeps its front for any enemy within 60°, wheels for one on its flank or rear, else dresses on the battalions beside it; horse turn only beyond 30°. Mollwitz scenario: first-line facing spread 26–47° → 10–12° (1° by phase 5).
- Camera: three.js OrbitControls (damping .08, as battle-atlas) on the field, kept in step with `cam` so arrival, the ride over the field, WASD/↑↓ and scripts still drive it; touch gets pinch and two-finger pan.
- Clock rail above the order bar: a stop at the deployment and after every phase (kept in `draft.battleTrack` with the battle it belongs to), ◀ ▶| Play and ←/→. Looking back draws the field as it stood, read-only. From the last stop a step runs the next phase (orders, then moves); Play runs on until paused or the battle ends. Stops are generic `{phase, units}` so stage 7 can feed account phases.
- Checked in page: → runs a phase; the dashed next stop runs one; ← draws the deployment; → → returns without running; left-drag turns, right-drag pans; no page errors.

## Stage 7 (5 Nov): an account, phase by phase
- `battleDemo.phases`: [{t, label, text, units: [{id, e, n, facing, form: line|column|firing|routing|camp, losses}], arrows: [{side, kind: move|charge|retreat|fire, p}]}]. Units carry forward from `battleDemo.units` (before the first phase); losses run on. `checkReply` leaves out unknown ids, bad arrows and empty phases, and reads unknown forms as line and unknown losses as heavy (fixes); the packet carries only the phase index. Contract and reply format say so.
- Page: in the read-only field ("See the ground as described"), the rail's stops are the account's phases. Moving between them, lines march straight in formation and columns by their route (roads preferred) over ~3 s, firing lines smoke, routed units run, and the phase's arrows lie on the ground as ribbons. The card carries the phase's time, label and text. Play steps every 4 s.
- Mock: `w3d/mocks/account.json`, a test account on the Chotusitz ground (illustrative, not the history). Tests: the mock is accepted clean; a bad account is fixed (5 fixes).


### Stage 6 result (5 Nov)
`crestBetween` and `slopePace` in `w3d/march.js`, hooked into `blocked()` and the march step. A crest must stand 1.5 m clear of the line of sight (the relief is good to a metre or two). Share of random unit pairs 300–1500 m apart hidden by a crest: Mollwitz 1%, Leuthen 2%, Brieg 6%, Chotusitz 6%, Neisse 9%, Glogau 9%, Linz 28%, Prague 42%. Share of 30 m steps slowed by 5% or more: 0–5% on the plains, 16% Linz, 26% Prague.

## Towns and names (5 Nov)
- Ground files carry `towns` (wall trace in metres, `works`: bastioned | walled; open towns such as Urfahr have none; all inferred and marked) and `bridges` (named ones from the config: Charles Bridge, the Linz Danube bridge; others wherever a road crosses broad water for 15–700 m, including today's crossings in towns).
- Field: bastioned towns get an earth rampart, an arrowhead bastion at every salient corner, a wet ditch and a glacis; walled towns a curtain wall with towers every 60 m; gate towers where roads cross the trace; town cells build up close (two larger houses a cell) with a church about every 260 m; bridges as stone decks on piers with parapets.
- Village, town and hill names stand over the field in small capitals, fading with distance (under the formations' labels).
- Not found: Glogau's Oder bridge (the river there is under the grid's water threshold where the road crosses); no bridge drawn rather than a guessed one.


# Bedchamber and a leaner packet (20 Nov 2026)
- [x] Illness: `player.abed {from, to?}` (or "ill"/"gravely ill" for the whole turn) puts the day in the bedchamber; visitors are those whereabouts put with him plus his household; orders to them are in person "at my bedside", anyone else by note; map and accounts open from bed; he cannot rise, ride out or attend the Conference
- [x] Reply checks for abed; contract and reply format; mock `fever`; tests
- [x] Browser: the fever turn (bed 25–28 Oct, visitors on the 26th and 27th, up on the 29th), map from bed and back, the order card at the bedside, lying flat when gravely ill; bedchamber light rows pass LIGHT_FLOOR (day and night, summer and winter)
- [x] Packet: cast, locations and fortresses as tables (−24% on those lists)
- [x] Packet: rules in a Claude Project (versioned rules file; packet about half as long); the page says to start a fresh chat each turn

# Sky, seasons and weather
- [x] Weather words frost, thaw, thunder (reply checks, contract, tests)
- [x] Four seasons from the date: foliage (blossom in spring, thinning in late autumn), fields, grass; snow in midwinter or after it falls
- [x] Sky: the sun where it stands for date, hour and place (day length 8 h in December to 16 h in June); stars; the moon in its phase
- [x] Clouds by weather (few and bright to a grey deck to storm towers), drifting with the wind; darker at night
- [x] Weather on the ground: rain darkens it and fills puddles, frost rimes it, a thaw leaves snow in patches and mud on the roads
- [x] Wind sways trees and grass by the weather; rain falls in streaks slanted by it; thunderstorms flash, and thunder follows
- [x] The battlefield takes the season and weather of its day
- [x] lightCheck passes for every weather in all four seasons; frame rate unchanged against main

# Tempo per place, scenes on their day, sights (20 Nov 2026; spec in tasks/next-tempo-and-scenes.md)
- [x] `world.tempoAt` {place: tempo}: a location or a fortress's place (f-glogau → glogau); unknown places and tempos left out; lasts until changed, merges per place, null removes; any place campaigning makes a battle near; the place you are in takes its own tempo
- [x] Scenes: written whenever he meets someone in person (one a turn); `scene.date` defaults to the reply's and is kept inside the turn; it arrives in the post that day on paper (setting, names, You, narration, what was undertaken); not counted as a letter to answer; shared `sceneLines()` for the book
- [x] `world.scene` (the tags) renamed `world.sights`; the old name is read as sights with a fix, and old saves lose the old tags at the next turn
- [x] Tests 56 pass; browser: the meeting on day 3, Glogau campaigning while Vienna is in winter quarters, Vienna's sights drawn
- [x] Rules text says "the player" (they/their) instead of he/his: contract, orders section, packet
- Not done, on purpose: merging hidden.dispatches into the ledger (the ledger is the player's own timeline; dispatches are hidden)
- [x] The desk map knows only the post that has come by the day shown: the timeline strip (its "now" too), the town pins' last report, the town card, the desk's report list and the movement arrows follow the day walk; movements are redrawn each day and each turn (they were drawn once at load). Browser: day by day, and after a reload mid-turn
- [x] Map tools cleanup: Map tools and Map layers buttons on the map-mode bar (lit while open); the two panels open one at a time in one place, clear of the bars at the foot of the map; the map's season follows the day shown; reach rings are now marching rings (foot, wagons) from where you are, couriers being the Courier reach map mode; the map's own ambient-sound switch is hidden in the 3D page (the game's setting rules)

# Map tools, season, rain, sound (20 Nov 2026, after the review)
- [x] Map panels hide with their button, a × in the corner, or Esc (a second Esc stands up from the table); they never show away from the map
- [x] The map's season is the season of the day, shown as text; no picker
- [x] Rain: 10,000 drops in a 40 m box round you (was 2,400 in 70 m), streaks about 30 cm (was 90), none within 2.5 m of the eye
- [x] Sound: Volume and Music sliders under Graphics & sound (100% = the old level); moving one up turns sound on
- [x] Screenshots kept as JPEG in tasks/visual/review-2026-11-20 and tasks/visual/people-looks; .playwright-mcp/ ignored

# Notes, rain, map sound, trade routes (20 Nov 2026)
- [x] Map notes go to Claude with their place ("at Glogau: …", "about 36 km from Glatz: …")
- [x] Rain darkens the courtyard flagstones and leaves puddles (not under snow); lightCheck passes autumn, spring, summer
- [x] The map's wind and bells, and the table battle's drums, play with the game's sound on the map and the field, at its Volume
- [x] UI-IDEAS.md marks match the game
- [x] Trade routes from sources: Danube, Bohemian Elbe, Salzkammergut salt to Budweis, the Trieste road over the Semmering, Vienna–Prague post road, Vienna–Breslau by Brünn and Olmütz, the High Road Breslau–Leipzig, the Golden Road Prague–Nuremberg, the Hungarian ox drive; each names its source and what is not sourced; drawn from the page, so old saves get them. Dropped: the Salzach route (Salzburg's, not the Crown's) and Moravia–Cracow (no source found)

# Staff who explain (six ideas; the Codex pass on Nathan's Mac was never pushed, rebuilt here from bc05912)
- [x] 1 Secretary's letter: reply `staffBriefing` {dated, changed, stakes, attention, letters, places, guidance}; arrives on its day, pinned first; links to letters already come and to places on the map. Later letters are dropped from its links (fix). Without it (turn > 0) the briefing itself is the secretary's note on the wake day.
- [x] 2 Known / suspected / disputed / what it means / how such things go: `guidance` on any letter and on each counsel option; shown as the secretary's note on the paper
- [x] 3 Letters to the map: places and movements a letter names become links; the map draws the letter's road (written where and when, reached you where and when, km and days from you) and the formation's last reported line; nothing reported after the day shown
- [x] 4 Counsel you can question: Why? / What would it require? / What could go wrong? / What if we wait? inline from the option; an unanswered question becomes an order to that adviser; `decision.debate` lines shown as a short exchange in council
- [x] 5 Consequences: `follows` on a letter cites the player's earlier council courses, urgent answers and promises (ids listed in the packet); the letter says what it follows from
- [x] 6 While the couriers ride: review the intelligence, hear the household, inspect the quarters, set preparations in hand — each an ordinary dispatch entry with hours passing, never a discovery granted by clicking
- [x] Phone: the letter list folds into "Choose a letter"
- [x] Contract + reply format + mock + tests; browser check (fresh profile, muted, autosave off); push to main; verify Pages

## Review (21 Nov 2026)
- Tests 60 → 64 (secretary's letter merges and clears; never points ahead; notes, follows and debate made safe; packet lists earlier decisions). All pass.
- Browser (fresh profile on port 8811, sound off, autosave off, opening skipped): counsel questions answer inline, an unanswered one adds an order to the adviser; the living mock's secretary letter is absent on 21 Oct and present on 26 Oct, links its two letters; the Glogau note opens; "Follow it on the map" draws the letter's road with dates; a second reply's secretary letter dated 27 Oct lost its link to a letter arriving 30 Oct (fix shown in review), `follows: ["C0","C7"]` kept C0 only and the letter says what it bears on; the movement link is absent on 27 Oct and present on 30 Oct with its last reported date and distance; waiting entries land in the dispatch as [T1-n] orders; phone list folds. No console errors (two Leaflet default-icon 404s found and fixed).
- Not verified: lightCheck (no lighting change); the map transition is slow in this container (1.5 fps; a plain act('map') takes ~43 s) — environmental, not this change.
- Rules version changes (contract and reply format grew): a Claude Project holding the rules needs the new file once.

# Your desk (undertakings, hearsay, calendar, audiences)
- [x] Undertakings: reply `undertakings` by id {title, stage, waiting, obstacle, status, updated, due, re}; the page keeps earlier stages; a new stage shows from its `updated` day; stalled ones go to matters in hand; "Give orders on it"
- [x] What is said of you: reply `hearsay` (only grows) {said, source, teller, date, place}; shown from its day, newest first, with trust/doubt on the teller; never corrected, may be wrong
- [x] The calendar on your wall: reply `calendar` by id {date or month, what, certainty, source, noted}, plus audiences, undertakings due, and the staff's reckoning of when an answer by letter could come
- [x] Audiences: reply `audiences` by id; prepare one (press / concede / will not say / manner) or ask for one (through the chamberlain for a ruler); the preparation is a dispatch order; a scene with `re` answers it
- [x] Contract "Your desk" (staff section tightened to keep the packet under 60 KB: 58.8 KB now), reply format, living mock, 5 new tests (69 pass)
- [x] Browser (fresh profile, port 8812, muted, autosave off): notebook on 24 Oct shows the audience, the dossier, Kessler's talk; Martinmas appears on 26 Oct (noted that day), not before; preparation and the Queen request land in the dispatch as [T1-1], [T1-2]; turn 2: the old stage shows on 26 Oct, the stalled stage with earlier stages on 29 Oct; the meeting answers T1-1 ("1 of 2 orders answered"); the reckoned answer from Wallis shows; phone layout; no console errors

# The courier through the repository; instructions to the secretary
- [x] Sealing (repository mode, the default) copies an errand for Claude Code or Codex: pull, save the packet, read the rules (`node tools/turn-tool.mjs rules`, versioned), write `turns/<campaignId>/turn-NNN.json` with the dispatch id, check it (`node tools/turn-tool.mjs check`), push only that file, say nothing of outcomes
- [x] The page polls for the next turn's file after a seal (30 s, on load, on returning to the tab); clean → applied at once; otherwise the review; a reply to an earlier sealing of the turn is refused
- [x] Notebook → The record: how the courier rides (repository / by hand), look for the courier now
- [x] Instructions to the secretary: written on the dispatch's side or in the Notebook; the player's own (reply cannot change them); in every packet; the secretary's day-book ("Done in your name"); letters handled under them marked and kept out of matters in hand
- [x] Wake: "Only for what my instructions to my secretary do not cover", "Not for a month…"; contract's Pace allows a month when asked
- [x] Storage key clash found in the browser check: the 3D courier ride already used `w3d-courier`; the setting is `w3d-courier-route`
- [x] Tests 69 → 74 (day-book and handled, instructions stay the player's, courier packet, packet read back, the tool on a good and a stale reply); packet 58.5 KB (reply-format lines now point to the contract)
- [x] Browser: instructions saved and in the errand; turn file "pushed" → applied within one poll; handled letter and day-book; stale dispatch refused; no console errors

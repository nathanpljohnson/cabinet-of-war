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

# Bedchamber and a leaner packet (20 Nov 2026)
- [x] Illness: `player.abed {from, to?}` (or "ill"/"gravely ill" for the whole turn) puts the day in the bedchamber; visitors are those whereabouts put with him plus his household; orders to them are in person "at my bedside", anyone else by note; map and accounts open from bed; he cannot rise, ride out or attend the Conference
- [x] Reply checks for abed; contract and reply format; mock `fever`; tests
- [x] Browser: the fever turn (bed 25–28 Oct, visitors on the 26th and 27th, up on the 29th), map from bed and back, the order card at the bedside, lying flat when gravely ill; bedchamber light rows pass LIGHT_FLOOR (day and night, summer and winter)
- [x] Packet: cast, locations and fortresses as tables (−24% on those lists)
- [x] Packet: rules in a Claude Project (versioned rules file; packet about half as long); the page says to start a fresh chat each turn

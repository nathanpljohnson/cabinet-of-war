# Cabinet of War

A solo historical strategy game set in the Habsburg monarchy in October 1740, the night Charles VI died and the War of the Austrian Succession began. You play a commander with access to the court in Vienna, in person, in a 3D world: you walk the courtyard, give orders to the people who are there, read the letters that reach you day by day, lean over the map table, travel to Prague, Breslau or the army, and seal the day's dispatch. An AI chat (Claude or any other) acts as the adjudicator and returns what changed in the world.

The page is the record of the campaign. It does not depend on any chat remembering the game.

**Play:** https://nathanpljohnson.github.io/cabinet-of-war/ (Chrome or Safari; needs WebGL 2).

## How to play

1. **The first night.** A courier rides in with one letter. In the morning, letters wait on your desk.
2. **Read your letters** (**Letters**, `R`). Each is from someone, somewhere, and names its source; they arrive over the days of a turn — **Let the day pass** to receive the next post. Your commission and your advisers' counsel come as letters too.
3. **Give orders.** On a letter (**Give orders on this**), to someone in front of you (walk up, `E`), or in the day's dispatch (**Dispatch**, `O`). Orders to people who are elsewhere go by letter and take days. You can also see for yourself — the market, the walls, the camp, the stores — and **Travel** (`T`) anywhere at once; the journey goes into the dispatch.
4. **Seal the dispatch** and copy it for Claude. Choose when you want to be woken. Paste the packet into a new chat and send it: it holds the state of the world, your orders, the rules the adjudicator follows and this turn's dice (the page rolls them, not Claude).
5. **Bring the reply back.** Paste it under **The courier is back — paste Claude's reply here**, review it and accept. If something is wrong — a cut-off reply, a dead man writing — the page says so and copies a correction request for the same chat. The courier rides in with the new letters; your notebook (`N`) shows which of your orders have been answered. Some letters are urgent: answer them in person before the day passes.

Keys: `WASD` walk · drag to look · `E` act on what is in front of you · `M` map · `R` letters · `O` dispatch · `N` notebook · `T` travel · `Esc` put things down. With the army, `B` takes you onto the field, where you command the battle (click a formation, `M`ove, `F`ace, `H`old, `Enter` runs 15 minutes).

The game saves in the browser and downloads a **campaign file** after every turn (Notebook → The record): load it on any browser to carry on. **The book of the campaign** (the `⋯` menu or the notebook) holds every turn you have lived; when the campaign ends it shows what was hidden from you. For a campaign with no going back, seal the record (ironman) in the same place.

### Run it locally

```bash
git clone https://github.com/nathanpljohnson/cabinet-of-war.git
cd cabinet-of-war
python3 w3d/dev_server.py 8000
```
Then open http://localhost:8000/. On macOS, `app/build_app.sh` installs `Cabinet of War.app` in `~/Applications`.

To rebuild the page after changing the sources: `python3 src/pdx_build.py && python3 src/w3d_build.py`. The 3D code in `w3d/` loads directly. `w3d/mocks/` holds test replies; in the browser console, `__w3d.mockReply('answers')` (or `'winter'`, `'dismissed'`, `'living'`, `'ending'`) applies one; `'backwards'` and `'contradiction'` show the checks. The opening (letters, counsel, people, household, rival, canon, sources) is `src/opening.json`; what the adjudicator is told is `w3d/contract.md`, and the reply format and merge rules are in `w3d/turn.js`. Tests: `python3 -m pytest -q tests`. See `CLAUDE.md` for the layout.

## What's here

| Path | Holds |
| --- | --- |
| `cabinet-of-war.html`, `index.html` | The game: one page with the opening state embedded (index opens it) |
| `w3d/` | The 3D world: scenes, people, the battlefield, letters, dispatch and notebook; three.js and CC0 models (see `w3d/ASSETS-ATTRIBUTION.md`) |
| `w3d/contract.md`, `w3d/turn.js`, `w3d/campaign.js`, `w3d/almanac.json` | What Claude is told; the packet, reply format and checks; saves and the book; the research almanac |
| `tests/` | Tests for the reply format and the build (`python3 -m pytest -q tests`) |
| `tiles1740/`, `realms1740/`, `cities/`, `paint/` | Map tiles, realm borders and city and battlefield detail |
| `app/` | macOS WebKit app shell and its build script |
| `src/` | Build scripts and source modules for the page and map |
| `research/`, `WORLD-ENGINE.md`, `CAMPAIGN-FOUNDATION.md`, `VERIFICATION-REPORT.md` | Historical research, campaign rules and source checks |
| `CLAUDE.md`, `HANDOFF.md` | Working notes for Claude; development log and design decisions |

## Status

This is a work in progress. The places and the map are real. Many forces, offices and agendas in the opening state are still being researched, and buildings, uniforms and the people you meet are illustrative, and `VERIFICATION-REPORT.md` tracks what's been checked.

## Licences

See `ATTRIBUTION.md`. Leaflet is BSD-2-Clause. Some derived map tiles are CC BY-NC-SA 4.0, so the map assets are for non-commercial use.

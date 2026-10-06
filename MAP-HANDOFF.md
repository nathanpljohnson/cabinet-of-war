# Map pass — "make it feel like a Paradox game" (handoff)

Task: general map improvements so the Cabinet of War map feels like a Paradox grand-strategy map.
Started: 2026-10-04 (Claude Code, after the Codex session ran out of usage before changing anything).
Working copy: `~/Documents/Codex/2026-10-04/fin/outputs` (this folder; it has the verified state). Original workspace with raw geodata: `~/Documents/Codex/2026-10-03/files-pasted-by-the-user-i/work`.

## Status

Completed: everything in the plan below. Browser-checked at 1440×900 and 375×812 (Chromium preview): no console errors from the page (only the known 404s for missing edge tiles and favicon); all six modes, hover tooltip, click-to-select + realm card, Layers realm toggle, battle bookmark (mode bar lifts above the army bar), zoom 4–11 draw cost ≤ 18 ms. App bundle updated in place and re-signed; the running app needs a relaunch to show it.
Next: nothing required. Ideas below.
Files written: this file, src/pdx_geo.py, src/pdx.json, src/pdx.js, src/pdx.css, src/pdx_build.py, src/cabinet-of-war.base.html (snapshot of the page before this pass), cabinet-of-war.html (rebuilt), `~/Applications/Cabinet of War.app/Contents/Resources/web/cabinet-of-war.html`, `~/.claude/launch.json` (added `cabinet-fin`, port 8778).

## Plan (checklist — tick as done)

- [x] `src/pdx_geo.py`: read Natural Earth admin-1 (original workspace `work/borders/admin1`), assign realms with the same `realm()` table as `src/realms.py`, build shared-arc topology (no shapely), simplify arcs once so neighbours stay matched, classify arcs (state / crown-land / province border), compute a curved label path per realm (principal axis + quadratic bend). Output `src/pdx.json` (committed, so the page rebuilds without the raw data).
- [x] `src/pdx.js`: vector political layer on a Leaflet canvas — realm fills blended over the parchment (multiply), three border weights, curved realm names painted on the map that scale with zoom, hover tooltip, gold outline on the selected realm, map-mode bar with hotkeys.
- [x] Map modes, each with its own overlays (Paradox style): Political, Habsburg lands, Terrain, Courier reach (days from your location), Trade (routes), Intelligence (movements + fortresses).
- [x] `src/pdx_build.py`: deterministic build — `src/cabinet-of-war.base.html` (pre-pass copy) + small asserted edits + PDX block + current `src/state.json` → `cabinet-of-war.html`.
- [x] Browser check (preview `cabinet-fin`, port 8778): no console errors, desktop + mobile, modes, hover, labels, zoom levels.
- [x] Update the macOS app in place (copy the page into the bundle, re-sign); update `HANDOFF.md` revision log.

## Rules carried from HANDOFF.md

- Realm extents are modern provinces grouped into c.1740 realms: approximate. Keep saying so (tooltip + legend).
- No omniscience: the courier-reach mode is the staff's estimate from the player's location, not live knowledge.
- Do not delete files without asking (user rule). The app bundle is updated in place, not rebuilt with `rm -rf`.

## How to rebuild

```
python3 outputs/src/pdx_geo.py     # only if the realm table or simplification changes; needs the original workspace (COW_WORK)
python3 outputs/src/pdx_build.py   # base page + map layer + src/state.json -> cabinet-of-war.html
```
`src/world.py` still works after this (it only swaps the embedded state), but `pdx_build.py` is now the full rebuild: it reads `src/state.json` too.

## What changed in the page

- Realm tiles (`realms1740/`) and the old caps realm labels are no longer used; realms are vectors drawn by `pdx.js` on four Leaflet canvas panes: `pdxFill` (multiply-blended colour + inner border band), `pdxInk` (province / crown-land / state lines and the painted names), `pdxSel` (pulsing selection), `pdxHover`.
- Painted names: one curved path per realm landmass (`pdx_geo.py` picks the orientation that fits the largest lettering); they scale with the map, fade below 9 px and above 80 px.
- Map modes (bar bottom-right, keys Q W E R T Y): Political, Habsburg lands, Terrain, Courier reach, Trade, Intelligence. Each sets the Layers toggles for routes / movements / fortresses; the Layers panel still overrides. Chosen mode is remembered in localStorage.
- Removed with it: Tools ▸ Lens radios and `lens()`; the bottom-left caption (`#legend`, its caveats are now in the mode legend); `state.regionLabels` are hidden while names are painted (shown in Terrain mode).
- Arrow keys pan and +/- zoom when nothing is focused.

## Ideas not done

- Province names: the provinces are modern admin-1 units, so they are shown only as "modern district" in the tooltip. A sourced 1740 province layer would allow Paradox-style province names and hover per province.
- Diplomatic mode: needs sourced stances per power in `state`; none exist yet.
- `build_app.sh` still copies `realms1740/` into the bundle; it is unused now and could be dropped from the script (not deleted).

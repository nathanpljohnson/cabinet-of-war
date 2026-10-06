# Verification update — 4 October 2026

The current authority for research status is [VERIFICATION-REPORT.md](VERIFICATION-REPORT.md) and the embedded verification register. Historical notes below predate this pass; their DOC labels do not override its corrections. Use `src/world.py` to synchronise the shipped state and world document. Battle coefficients remain uncalibrated.

# Cabinet of War — living handoff

Updated: 2026-10-03. **Implementation is in progress.** This records the user's decisions and continuation requirements, not a claim that the new build or historical research is finished.

## Current authorization and files

The user has now authorized building the game UI and continuity workflow, superseding the earlier “design and reusable scaffolding only” limit. They want an excellent **map-first command desk**, with the map as the central background image, inspired by their Kasim’s War and Orison command table games. Those references have not yet been inspected; do not claim to reproduce them. Inspect existing files before changing them:

- `cabinet-of-war.html`: existing portable local HTML scaffold, not a finished campaign.
- `opening-state.example.json`: example state; do not mistake illustrative material for established history.
- `CAMPAIGN-FOUNDATION.md`: initial rules, source leads, research gates, and role proposal. Its earlier scope statements and fixed one-to-two-week normal turns must yield to the newer decisions here.
- `HANDOFF.md`: this living continuation record. Update as implementation, verification, and research actually finish.

Original user request is in `/Users/nathanjohnson/.codex/attachments/a5d7c87a-cbab-496e-be3b-cbfcd86f4d13/pasted-text.txt`.

Use suitable open-source components, maps, and resources; inspect compatibility and license, preserve attribution, and avoid unnecessary dependencies. User explicitly requests delegating straightforward bounded tasks to lower-cost/lower-token models when useful. Do not delegate difficult historical judgment merely to save usage. All frontend work must follow the user's frontend-design, frontend-excellence, and source-frontend-components skill requirements, including browser verification and accessibility.

## Confirmed campaign and experience

- **Setting:** Habsburg succession crisis, **late 1740**, beginning with preparedness and uncertainty rather than silently moving to a later battlefield opening.
- **Role:** historical commander with court access who must persuade the ruler and obtain resources. Not sovereign or universal commander. Ludwig Andreas von Khevenhüller remains a **candidate**; exact appointment, whereabouts, powers, and access for the opening date are unverified. Do not confuse him with Johann Joseph Khevenhüller-Metsch.
- **Priorities:** diplomacy, court politics, military command; both political scenes and map operations.
- **Logistics:** binding and consequential, but staff handle arithmetic. Present constraints, consequences, feasible alternatives, and uncertainties in ordinary language. No demanding accounting chores or arbitrary resource meters.
- **Knowledge assistance:** provide the professional/contextual knowledge the character reasonably possesses before consequential decisions, without revealing hidden outcomes.
- **Character freedom:** inherit historical reputation, relationships, and obligations; player chooses subsequent decisions. Sharp departures can provoke reactions.
- **Career stakes:** real dismissal, reassignment, loss of patronage or command are possible; do not protect the office by fiat.
- **Time:** event-driven. Advance under standing instructions until developments exceed them or materially change the stakes. Battlefield and strategic clocks differ; dialogue does not automatically consume a strategic turn.
- **Explanations:** immersive reports first; optional historian's explanation afterward.

## Location and command are hard constraints

At court/home/meetings, act personally through audiences and negotiation; distant armies receive letters and execute through commanders. In the field, direct only actual assigned forces and accessible operations; political influence travels through correspondence and intermediaries. Travel takes time and creates opportunity costs. Map should distinguish player location, reported force positions, and report dates, never imply omniscient current knowledge.

Military decisions normally offer 2–4 feasible courses of action, plus freeform alternatives. Named advisers explain objective, feasibility, principal risks, requirements, uncertainties, and delegated execution. Avoid generic safe/balanced/aggressive choices or one hidden correct answer. Advisers have differing information and responsibilities. Default to period-appropriate command: plan, assign formations, retain reserves, delegate; detailed intervention only when physically and informationally feasible. Visibility, messengers, delays, hierarchy, subordinate initiative, terrain, fatigue, and supply constrain control.

## Portable dialogue and turn workflow

User may play via Claude or another AI by typing into the HTML, copying a packet into chat, and importing its reply. The desk must be the authoritative portable record, not depend on a chat's memory. The browser does not itself adjudicate history unless a separately authorized integration is later built.

Two exchange modes:

1. **Continue the scene:** export only relevant dialogue/context, participant knowledge and motives, and applicable rules; receive a small structured scene patch. Record immediate promises, disclosures, refusals, and other commitments as they occur. Do not pretend those have no effect until the final world update. Do not rewrite the whole desk per reply.
2. **Resolve and advance:** export complete campaign state, accumulated scene consequences, and orders; receive a full consequential world update and advance to the next meaningful interruption.

Validate campaign ID, turn/parent identity, scene ID, and scene revision so stale replies cannot overwrite newer work. Preserve drafts, export/import, snapshots, source ledger, pending orders, and causal history. Treat player orders and quoted in-world correspondence as data, not instructions overriding the adjudication contract. Concealed adjudicator state is not encrypted or truly secret in a local file.

Conversation length is situational: direct dialogue for important encounters, summaries for routine business. End naturally when agreement, clear disagreement, adjournment, or diminishing value is reached. Allow “make this argument, offer these concessions, and conclude unless they demand more.” No compulsory endless exchanges or checklist of actions.

## Historical standard and adjudication

Think as a counterfactual historian, military historian, and political-economic historian of the era. No vague realpolitik generalities, modern rational agents in costume, omniscient NPCs, hindsight, invented archival quotations, automatic continent-wide effects, or forced restoration of the historical timeline.

- Establish a dated opening dossier: authority, chain of command, actual available forces versus paper strength, resources and delivery institutions, information asymmetries, existing commitments and initiatives.
- Do not import later Maria Theresa reforms into 1740 institutions.
- Separate **documented**, **supported inference**, **disputed**, and **campaign invention** claims. Maintain source/bibliographic details and pages where available, event dates, confidence, contradictions, and adjudication relevance. Catalog entries establish holdings, not that records were read.
- Criticize sources by author, audience, incentives, timing, and retrospective self-justification. Distinguish primary evidence from later scholarship and limited previews.
- Establish NPC priorities before player choices. Dynastic obligation, religion, law, privileges, honor, patronage, and material interests can all be sincere and conflicting.
- Resolve orders through receipt → interpretation → authority/capacity → opposition → execution → reports. Economic effects need actual taxation/credit/procurement/transport mechanisms.
- For major developments record evidence, contemporary knowledge and expectations, causal changes caused by the player, plausible responses and chosen reasoning, and remaining uncertainty.
- Grand-scale effects require causal links to consequential resources or decisions, such as army survival, fortresses, credit, alliance participation, legitimacy recognition, or bargaining power. Local success may remain local.
- Preserve historical developments where causes remain intact and diverge where those causes change. Historians can judge plausibility, not prove the unique outcome of invented decisions.

## Research gates before claiming a playable historical opening

1. Verify the chosen character's exact late-1740 office, location, command remit, and court/diplomatic access; then fix the opening date.
2. Establish a small cast of reachable historical people and their offices, relationships, agendas, and knowledge.
3. Source military geography, forces, finances, communications, and provisioning constraints; mark unknowns.
4. Map historical jurisdictions and geography with provenance. Modern borders are not substitutes; illustrative overlays must be labeled.
5. Establish the dated world baseline, private agendas, and source ledger before accepting the first adjudicated order. A sourced order of battle and terrain model are required before a real tactical scenario.

Existing research leads are in CAMPAIGN-FOUNDATION.md. Additional discussion referenced Charles Ingrao, *The Habsburg Monarchy, 1618–1815* (publisher contents/description only consulted); Austrian State Archives Hofkriegsrat/Alte Feldakten finding aids (records not consulted); and Habsburger.net accession/coronation discussion. Do not inflate those references into completed historical research.

## Completion log (updated 2026-10-03, second session, Claude Code)

**Built and browser-verified (desktop 1440x900 and mobile 375x812; no console errors):** `cabinet-of-war.html` is now a map-first command desk (schema v2). Single offline file, ~690 KB.

- **Map as background:** Leaflet 1.9.4 (BSD-2) vendored inline; Natural Earth 10m (public domain) land, lakes, rivers, mountain ranges, populated places clipped to Central Europe (Sutherland–Hodgman clip, then simplify). No 1740 frontier layer exists: region names are labels only and the UI says so. Place labels use 1740 exonyms where mapped in `EXONYM`, otherwise modern. CC0 `Europe_1740_en.jpg` is downloaded (`work/assets/europe1740.jpg`) but NOT used: its georeferencing is unknown.
- **UI:** walnut/vellum/brass "candlelit table" look; seal pins (gold = you, red = Habsburg places, blue = foreign); collapsible side panels; responsive bottom-sheet on narrow screens.
- **Tabs:** Counsel (2–4 adviser-backed options + freeform), Scene (portable dialogue), Orders (instrument list is **mode-gated**: court vs field), Record (ledger, sources, snapshot/HTML save/state import).
- **Portable workflow, tested:** scene packet copy → paste JSON `scene-patch` → rejects wrong campaign/turn/scene and stale revision; applies lines, commitments, disclosures, concluded status. Resolve packet (contract + orders + scene consequences + full state) → paste/import full next state; validated (schemaVersion 2, turn = current+1, parentTurn), confirmation dialog, local snapshot, replay rejected.
- **Source layout:** `outputs/src/` has `desk.template.html`, `state.json`, `build2.py` (run from anywhere; it reads `../work/assets`, writes `outputs/cabinet-of-war.html`). NOTE: build2.py expects `work/v2/` and `work/assets/` paths; originals live in `work/v2/`. The prior scaffold is kept at `work/cabinet-of-war.v0-scaffold.html`.
- **Preview server:** `cabinet-desk` entry added to `~/.claude/launch.json` (port 8777).

**Content status (honest):** all scenario content is a **demo fixture** (claim label `demo`): advisers and the scene participant are role placeholders, not historical people. `forces` is empty on purpose. Player location Vienna and office are **provisional**. No historical research is complete.

**Known gaps / next tasks**
1. Opening dossier (research gate 1–5). A research pass on Khevenhüller's late-1740 office, court figures, army state, and Prussian-intent knowledge was delegated; see `work/dossier-research.md` if it finished. Treat as leads until cross-checked.
2. 1740 jurisdiction layer: hand-reviewed GeoJSON from a cited source (not Natural Earth modern borders).
3. Replace demo decision/scene with researched ones once the character is fixed; add dated report-age styling and travel-time/delay display only from sourced data.
4. Kasim's War / Orison Command Table sources were not inspected (Orison prototypes are at `~/Documents/Codex/2026-09-26/files-pasted-by-the-user-you/campaign/`); match their look only after reading them.
5. `work/assets/raw/` (~67 MB Natural Earth shapefiles) can be deleted after build; not deleted without permission.
6. Accessibility: tabs/dialog/live status implemented; no screen-reader or contrast audit run yet.

### Research pass result (Sonnet agent, unverified by me; full text in `work/dossier-research.md`)
Treat as leads. The agent did not re-check Kriegsarchiv page numbers against scans.
- Khevenhüller appears in the 1740/41 Hofkriegsrat staff list as Feldmarschall and **Vice-President** under President Joseph Graf Harrach (Kriegsarchiv, *Österreichischer Erbfolge-Krieg* I, 1896, pp. 309–310), also nominal commanding general in Slavonia. The Wurzbach/Wikipedia claim that he was Vienna's Stadtkommandant in 1740 looks wrong (Daun held it until July 1741). No document found placing him in Vienna 20 Oct–Dec 1740; that is inference. Exact date of the Vice-Presidency unverified.
- Army 5 Nov 1740: ~141,880 on paper vs ~107,892 effective (Kriegsarchiv table, needs checking) vs Arneth's "barely over half of 160,000": sources disagree.
- Prussian intent: Vienna "in the dark" late Oct; warnings from Demeradt from 29 Oct; Botta 5 Dec; Vienna knew the plan ~15–16 Dec; crossing 16 Dec.
- Fallback characters: Neipperg (best documented, at court), Harrach (administrator); Browne and Traun were far from court.
- Implication: the "commander with court access" role fits Khevenhüller as Hofkriegsrat Vice-President (a council seat, not a field army) at least until the Prussian crisis. Confirm before fixing the opening.

### Map revision (user said the vector map looked flat/"trash"; wanted realistic, Paradox-like)
Replaced the flat vector map with a rendered **shaded-relief terrain image** (`work/terrain/terrain.jpg`, 3840x3328, ~3.7 MB, inlined as base64; bounds in `work/terrain/bounds.json`). Pipeline `outputs/src/render_terrain.py` (numpy + Pillow, no new installs; uses curl for downloads): Terrain Tiles z8 elevation (AWS Open Data) → multi-light hillshade + ridge/valley relief, elevation colour ramp, noise-based forest/field mottling, bathymetry-tinted sea, Natural Earth coast/lakes/rivers masks. Leaflet shows it as an imageOverlay; labels restyled cream-on-dark; left rail collapsed by default so the map dominates. Attribution added to `ATTRIBUTION.md` and the map credit line.
Caveats: relief is modern topography, vegetation is synthetic texture (not 1740 land cover); river coverage is Natural Earth's main rivers only. Possible next upgrades: heavier river network (e.g. HydroRIVERS), hand-painted forest masks from CORINE/ESA WorldCover (check licence), 1740 borders layer, province/campaign overlays, higher zoom tiles.

### Revision 3 (2026-10-03, later): tile pyramid map + battle preview
User wanted far more realism, higher zoom, real forest cover, fuller rivers, period touches, and a way to see battlefield troop blocks. Done:
- **Now a folder, not a single file.** `outputs/cabinet-of-war.html` loads `outputs/tiles/{z}/{x}/{y}.jpg` (z5–10, ~46 MB, Habsburg theatre lon 7.7–24.3, lat 44.8–53.1) and `outputs/battle/{z}/{x}/{y}.jpg` (z11–14 over the Mollwitz area, z15–16 over the line itself). Keep the folder together; "Save whole desk (HTML)" saves only the page, not tiles.
- **Renderer** `outputs/src/render_tiles.py` (numpy+Pillow only): DEM hillshade + OpenStreetMap landcover (wood/farm/grass/wetland/rock), OSM water polygons, HydroRIVERS (70k reaches, width by discharge), strip-field parcel texture, canopy texture, bathymetry sea; battle zoom adds OSM buildings (large industrial skipped), tracks/roads, streams. Inputs live in `work/dem`, `work/vt` (OpenFreeMap z10 + z14), `work/hydro`. Re-run: `python3 render_tiles.py overview ../tiles`, `battle ../battle`, `battlehi ../battle`. Tiles were brightness/colour-graded after rendering (x1.2, 1.1, 1.04) with a PIL pass — re-apply if re-rendering.
- **Page** (`outputs/src/desk.template.html`, `build3.py`): Layers panel (places / rivers & ranges / realm outlines c.1715), compass rose, scale bar, brass frame, 18th-century river/sea/range labels, **Battle tab**: Show battlefield → flies to Małujowice (Mollwitz), draws placeholder infantry/cavalry/artillery blocks (ranks, facing, guns), three adviser-backed courses of action that draw movement arrows, roster, unit selection. Units appear at zoom ≥ 12.
- **Honesty flags:** battle units/numbers/arrows are PLACEHOLDERS (not a historical order of battle); terrain/forests/villages are modern OSM data; realm outlines are coarse (the c.1715 dataset puts Bohemia and Austria inside one HRE polygon, so no internal Habsburg province borders exist yet); historical-basemaps is GPL-3.
- **Known issues / next:** (1) Chrome compositor blanks if a tile layer is scaled >4x (base layer capped at zoom 12 for that reason); (2) overview palette skews yellow-green over farmland; (3) build a properly sourced 1740 borders/provinces layer (e.g. hand-traced from a cited 18th-century atlas) and period place names; (4) battle blocks need sized-by-strength rules from a sourced order of battle; (5) z15–16 tiles cover only the central battlefield (~5×4 km).

### Revision 4 (2026-10-03): photoreal satellite fusion + period lettering
User: "find more open source ways to make it realistic... endlessly real." Done:
- **Base map is now satellite-fused.** `render_tiles.py` blends Sentinel-2 cloudless 2020 (EOX; 4,425 z11 tiles + z12-14 over Mollwitz downloaded to `work/sat`) with: DEM hillshade, OSM masks, HydroRIVERS. Modern built-up/industrial/airfield/bright-roof pixels (OSM landuse+aeroway+buildings+brightness mask) are inpainted from surrounding rural pixels; OSM village-scale buildings redrawn in brown at battle zoom. Pyramid: tiles z5–z11 (x1.22 brightness baked), battle z11–z16. Re-run: `python3 render_tiles.py z11 ../../outputs/tiles`; `battle`/`battlehi ../../outputs/battle`.
- Play area is now lon 9.0–22.1, lat 46.0–52.7 (z11 coverage). Beyond z11 the base layer is upscaled to z13; battle tiles take over at Mollwitz (z11–16).
- **Live satellite layer** (Layers panel): EOX WMTS up to z14, blend slider + mode. Needs internet.
- **Period lettering:** IM Fell English / English SC embedded (OFL).
- **Licence caution:** derived tiles are CC BY-NC-SA 4.0 (non-commercial). See ATTRIBUTION.md. Switch off `sat` to re-render commercial-safe.
- **Known gaps:** anachronisms remain (modern field patterns, forest cover, reservoirs, opencast mines not in OSM masks); inpainted towns look blurred; z12–14 only exist at Mollwitz; satellite max native zoom is 14 (~10 m) so z15–16 are upsampled; faint tile seams at fractional zoom. Next candidates: more battle sites (Chotusitz, Hohenfriedberg), higher DEM (national LiDAR: Austria DGM, CZ DMR5G, PL LIDAR), CORINE historical-ish land cover, hand-drawn 1740 settlements/roads from a cited atlas.

### Revision 5 (2026-10-03): painted close-range map + living map
User: satellite photos under armies at close zoom looked "chewy"/odd; wanted game-map detail, realistically animated.
- **Zoom behaviour:** overview z5–z11 stays satellite-fused; at z12.5–13.5 it cross-fades to a **painted map** (`outputs/paint/{z}/..`, z13–14 over the battle bbox, z15–17 over the central ~5×4 km). Painted by `outputs/src/paint.py` (numpy+Pillow): Silesian-style strip-field parcels with furrows and baulks, individual tree crowns with shadows (at z≥15), brown roofs with shadows from OSM buildings (huge modern ones skipped), tracks/roads, streams/rivers, soft relief. Re-run: `python3 paint.py run ../../outputs/paint`.
- **Living map (Layers panel toggle):** drifting cloud shadows and wind-shimmer overlays (z≥12.5), flowing water highlights on OSM streams (z≥15), chimney smoke over village houses (z≥15.5). Data in `battle_data.json` (from `extract_battle.py`).
- **Battle tab:** "Play order (preview)" animates the chosen course (units march, opposing line shifts, dust puffs); "Reset units" restores. Positions remain placeholders.
- **Known gaps:** faint tile seams at fractional zoom; painted style only exists around Mollwitz (outside it at z≥14 the map is blank); crowns look hatched at z17; roofs/roads are modern OSM; flat "yard" tint around villages; no sourced 1740 settlements/roads; unit sprites are still simple blocks.

### Revision 6 (2026-10-03): native macOS app
`~/Applications/Cabinet of War.app` (+ Desktop symlink, like Orison Command Table). Swift/WKWebView shell: `outputs/app/CabinetOfWar.swift`, icon `make_icon.py`, rebuild with `outputs/app/build_app.sh` (copies `cabinet-of-war.html`, `tiles/`, `battle/`, `paint/` into the bundle, ~162 MB, ad-hoc signed). Serves bundle files through a custom `cow://app/` scheme (no local server); JS→native clipboard bridge (`webkit.messageHandlers.clip`), save panel for downloads, open panel for file import, external links open in the browser, Edit/View/Window menus, window position remembered. Dev override: `COW_WEB_ROOT=/path/to/outputs`. After any page/tile change, re-run `build_app.sh`. The app does not include an AI; copy packets still go to Claude via the clipboard.

### Revision 7 (2026-10-03): UI pass — smooth zoom, zones, routes, movements, 3D towns
See `UI-IDEAS.md` (20 ideas; status marked).
- **Zoom glitches fixed:** integer zoom steps, tiles load only when idle, `markerZoomAnimation` off, place labels culled to the view (≤100), clouds/wind overlays only inside painted areas at z≥14 and hidden while moving (no full-screen blending during zoom), dynamic max zoom (13 outside painted sites, 18 inside) so you can't zoom into upscaled blur.
- **Realm zones:** `outputs/realms/{z}/{x}/{y}.png` (z5–12), from `realms.py` using Natural Earth admin-1 grouped into realms (`realm()` table). Bold state borders (5px + halo), crown-land lines (3px), province lines (1px), tint per realm; legend in Layers panel. Fades out by z13.
- **Trade routes / known movements:** `state.routes`, `state.movements` (demo content, `claim` labels). Routes are spline corridors with casing + animated caravans; movements have status (confirmed/reported/rumour), date, source, side colour. Toggles in Layers.
- **Cities:** `outputs/cities/{id}/{z}/..` painted ground (z13–16, no buildings) + `outputs/cities/{id}.json` (~27k extruded buildings each) drawn by a canvas "BlockLayer" at z≥15 for prague, vienna, breslau, pressburg, linz, munich, dresden, brunn. Place card has "Enter the town (3D)".
- **Known issues:** 404s for edge tiles (harmless); modern buildings/roads; walls/roofs palette is generic (no landmarks); cities.json files are 2–5 MB each; 3D blocks only redraw when the map stops moving; realm borders approximate; routes/movements are placeholders.

### Revision 8 (2026-10-03): 1740 look, whole Europe, all 20 ideas, faster
User asks: make it look like 1740 and smaller; see all of Europe without per-city detail elsewhere; fix slow loads and the jarring zoom in/out of cities; check battalion scale.
- **Look:** modern satellite replaced by a hand-coloured c.1740 style (`src/engrave.py`): parchment, relief hachures, tree-symbol forests (OSM forest cover = modern proxy), ink coast with water-lining, ink rivers. Tiles `tiles1740/` (WebP): Europe z3–7 (lon −12..45, lat 34..72), central Europe z8, theatre z9–10. Beyond z10 the map is upscaled to z13 outside sites.
- **Whole Europe:** `realms1740/` now covers all of Europe: Natural Earth admin-1 grouped into ~34 approximate c.1740 realms (`src/realms.py`, `realm()` table; modern provinces, so frontiers are approximate). Realm labels clickable → card (rulers marked documented/inference in `build4.py` `realms['info']` — check before relying on). `places_eu.json` supplies ~850 towns with 1740 exonyms (`EXONYM` in `map.js`).
- **Sites (detail only where you go):** `paint/` (Mollwitz z12–16) and `cities/<id>/` (Prague, Vienna, Breslau, Pressburg, Linz, Munich, Dresden, Brünn; z12–16) in the same muted palette, so the zoom-in no longer switches style; no cross-fade, no dynamic photo layers. 3D blocks (`cities/<id>.json`, ~1 MB each) use only the historic core: footprints 18–1800 m², heights clamped 7–18 m, taller kept as spires.
- **Speed:** bundle 380 MB → ~104 MB (2.9k base tiles + small sites; WebP); Swift scheme handler reads files on a background queue with an in-memory cache; one base style instead of satellite+painted+realms stacks; labels culled to view; overlays hidden while moving; local measured transitions 50–300 ms.
- **Battalion scale:** units now 150 m × 12 m (≈ 600 men, three ranks); true-scale blocks from z15, small counters at z13–14, army counters below z13; scale readout in Tools.
- **All 20 ideas built** (Tools/Layers panels, timeline strip, minimap, notes, measure, reach rings, season, lenses, fortresses, sound, comfort options). See `UI-IDEAS.md`.
- **Known gaps:** realm borders approximate; forests/farmland modern; city buildings modern footprints; routes/movements/fortress garrisons are placeholders or inference; realm card facts need checking; sound is synthesized (simple); minimap is rough.
- Rebuild: `python3 work/v4/assemble.py && python3 work/v4/build4.py && outputs/app/build_app.sh`. Old modern tiles are in `work/archive_modern/`.

### Revision 9 (2026-10-03): desk redesign, dispatch flow, border/zoom fixes
- **Borders** thinner (state 3 px + light halo, crown land 1 px, province 1 px): `realms.py` re-rendered.
- **Zoom glitches:** arrowheads are now screen-sized markers (the giant yellow wedge was a degrees-sized polygon); non-site zoom capped at 11; painted site tiles now cover wide areas at low zoom (z12 ±20 km, z13 ±12 km, z14 ±6 km, z15–16 core) in three tile layers per site, so zooming into a city is one continuous style; parchment backdrop at z≥12.
- **Loading:** idle prefetch of the next zoom level's tiles for the current view (`prefetch()` in `map.js`).
- **Desk:** tabs are Council · Scene · Dispatches · Battle · Record. Council = compact advice cards (adviser seal, one-line objective, "Their case" collapsed, Choose / Write it up). Scene = conversation bubbles. **Dispatches = letters:** pick a recipient from `state.cast`, choose Courier/Post/In person (ETA from distance and season), write the letter, optional discretion/contingency, attachments (chosen course, referenced places) → "Seal & add to outbox". Many letters allowed; the outbox shows who each goes to, how, when it arrives; "Send all" copies one packet listing every letter with recipient/via/ETA and stamps them SENT; paste the reply under "Reply received". Left rail renamed **Reports received** (each shows sender, channel, date; Show on map / Reply). "Dispatch 00" → "Turn 0".
- `state.cast` (recipients) is partly research-based (Harrach, Sinzendorff, Starhemberg, Königsegg, Bartenstein, Neipperg: inference from the dossier) and partly role placeholders (demo). Verify before relying on it.
- Rebuild: `python3 work/v4/assemble.py && python3 work/v4/build4.py && outputs/app/build_app.sh`.

### Revision 10 (2026-10-04): Case drawer, army you can command, Staff logistics; cast research merged
Sources are in `work/v5/` (build: `python3 work/v5/assemble.py && python3 work/v5/build5.py && outputs/app/build_app.sh`).
- **Writing case (header "Case")** replaces the Dispatches tab. Tabs: Letters · Household · Army orders · Packet. Letters: pick a recipient (`state.cast`), Via (courier/post/in person; ETA from distance+season), written in my own hand or by my secretary (purpose + topic → local template draft, editable), mark ready. Household: standing orders to the steward (provision, horses, quarters, prices, purse, sorting letters). Army orders: drafted on the table, grouped by commander, one-click "write this as a letter". Packet: checklist, contents, "Seal the packet & copy to Claude" (sends only letters marked ready + household + army orders + chosen course), then "Reply received".
- **Army tab + command bar:** select units (click, Shift-click, Shift-drag box, group chips), then Move / Face / Line⇄Column / Hold / Advance / Retire / Clear, drafted orders drawn as dashed arrows with ghost positions; Preview ▶ carries them out together; Reset. Courses of action now "Draft these orders". Keys: ⇧M, ⇧F, ⇧C, ⇧H, Esc. At court orders go as letters; in the field they are direct.
- **Staff tab (logistics):** what you do not yet know (returns, money's three accounts, fortress garrisons) with "ask" buttons that draft letters; marching rates by arm and season; convoy planner (distance, days, bread/wagon estimate). Bread (1 kg/man/day) and wagon (600 kg) figures are rule-of-thumb placeholders — source before use.
- **Cast research (`work/dossier-cast.md`) merged:** Joseph Harrach is Hofkriegsrat President (also Alois Raimund Harrach, Conference); Sinzendorf Hofkanzler; Gundaker Thomas Starhemberg (77, Banco-Deputation, not Hofkammer president); Königsegg (inference); Bartenstein only Hofrat/secretary of the Conference; Neipperg imprisoned after Belgrade (not in Vienna 21 Oct); Francis Stephen co-regent; first Conference 21 Oct with Maria Theresa presiding. **Khevenhüller was NOT confirmed as Hofkriegsrat Vice-President** (earlier lead was wrong; two sources say commander of the Vienna garrison). Daun was not Vienna commandant in Oct 1740. Unresolved: Bavarian envoy (Perusa vs Törring), Hague/Munich envoys, Silesian/Moravian commanders in Oct, Hofkriegsrat Vice-President, when news reached Berlin/Dresden/Munich.

### Revision 11 (2026-10-04): no logistics chores, adaptive table battle, world engine, gaps chased
Sources in `work/v6/` (`python3 work/v6/world.py` rebuilds the world data and doc; `assemble.py` + `build6.py` build the page; `outputs/app/build_app.sh` builds the app).
- **Logistics removed from the player’s hands:** Household tab, convoy planner and rate tables deleted. The Staff tab is read-only knowledge (“what your staff knows”) with ask-buttons that draft letters; supply, quarters, wagons and pay are the staff’s job and reach the player only as reports. Packet tells the adjudicator this.
- **Table battle engine (`battle.js`):** 30 m terrain grid from OSM (`battle_terrain.json`), fog of war (sight by arm, woods block, last-seen ghosts), fire/melee/morale/routing, 15-minute phases up to 12, victory/defeat/marginal outcomes, Withdraw. **Opponent AI** observes your visible dispositions (flank strengths, cavalry side, depth, advance vs hold, columns), keeps a memory across battles (`draft.battleMem`) and chooses among plans (bombard and hold, oblique left/right, cavalry flank, centre push, counter-charge, withdraw) with noise and anti-repetition. Calibration run: advancing blindly loses (≈50% casualties, defeat), passive play yields a marginal result, refusing a flank is safer. Numbers are placeholders (fire factor B 1.55, B manpower +18%) pending sourced values from `research/military.md` (Austrian wooden ramrods to 1744, 2 vs 3 volleys/min inference). Result and phase log go into the packet.
- **World engine:** `WORLD-ENGINE.md`, `state.hidden.world` (systems, stakes, calendar, 47 plots from five research reports in `research/`). **Status: research drafts**; politics, economy, society, religion reports mostly rest on recalled literature (scholarly texts often locked); military and gaps reports read Kriegsarchiv/Carlyle/Duncker OCR. A verification pass against primary/secondary texts is still needed before facts are shown as established.
- **Gaps chased (`research/gaps.md`):** Hofkriegsrat Vice-President 1740/41 = Khevenhüller per Kriegsarchiv vol. I pp. 309–310 (one source citing the 1740/41 Hof-Schematismus; appointment month unknown) — this reverses the earlier “not confirmed” note. Silesia: FML Wallis held the General-Commando at Glogau from June 1740 (Duncker 1885); only Wallis Infantry (1,719 men) in Silesia in October; Browne field command from early December; 7,359 men and 560 horse on the eve of invasion (upper bound); Breslau had no imperial garrison; Neipperg named supreme commander 22–23 Dec. Moravia: Brünn command “um 1740” (Sinzendorff?), no Olmütz commandant found → left as roles.

### Revision 12 (2026-10-04): Paradox-style map (Claude Code)
User asked for general map improvements that make it feel like a Paradox game, with handoff documents. Full notes, rebuild steps and open ideas: [MAP-HANDOFF.md](MAP-HANDOFF.md).
- Vector realms (`src/pdx_geo.py` → `src/pdx.json`; Natural Earth admin-1 grouped by the `realm()` table in `realms.py`, shared-arc topology so borders stay matched): saturated realm colours blended over the parchment with an inner border band, three border weights, curved realm names painted on the map, hover tooltip (ruler, evidence label, courier days, modern district), click to select (pulsing outline) and open the realm card.
- Map modes with hotkeys Q–Y: Political, Habsburg lands, Terrain, Courier reach (staff estimate, same rule as the reach rings), Trade, Intelligence; each sets the overlay toggles.
- Build: `python3 outputs/src/pdx_build.py` (base snapshot `src/cabinet-of-war.base.html` + edits + layer + `src/state.json`). App bundle page replaced in place and re-signed.
- Extents remain approximate (modern provinces grouped); the tooltip and mode legend say so.

### Revision 13 (2026-10-04): orders of the day replace letters (Claude Code)
User decision: most play is one order of the day; no letter writing; conversations are rare. The player sees only the orders box, a copy button and the reply box; everything else travels to Claude unseen.
- **Orders drawer** (header button "Orders", `src/case.js`): one textarea + "Copy orders for Claude" + "Reply received". Text saves per turn and clears when the next state is accepted. A dot on the button means orders are written. No preview, no locking, no letterhead.
- **Packet** (`resolve()` in `src/case.js`): orders of the day, places marked on the map, council course, map notes, army orders from the table, and the full table-battle record (result, every phase, enemy memory, seed), which the player never sees. At court the battle is sent as "fought by the field commander under his general orders". Packet tells Claude: staff turn the order into dispatches off-screen; record them in `hidden.dispatches`; never show the player how orders were worded or understood, only results via reports; open scenes only when orders ask for an audience or events require it.
- **Standing orders** are hidden and kept by Claude in `hidden.standingOrders`; until the first reply carries them, the packet uses the six defaults in `STANDING0` (campaign invention: the character's routine instructions; no hindsight about Prussia).
- **Removed:** Letters tab, Household, Army-orders tab and "write this as a letter", Packet tab, secretary drafts, Staff tab ask-buttons, Council "Write it up". Reports' "Reply" now adds "Regarding X's report:" to the orders. Fixed: place card "Reference in my orders" checkbox called a missing `renderOrders()`; accepting a new turn now clears the table-battle log so an old battle is not sent twice.
- Build: `python3 outputs/src/pdx_build.py` (it swaps `src/case.js` + `src/staff.js` into the page). The old letter CSS (`.lcard`, `.letter`, `.hh`, `.sealed`, `.chk` …) is now unused but left in the base page.
- Not changed: the Scene tab and its own packet flow (the rare conversation path).


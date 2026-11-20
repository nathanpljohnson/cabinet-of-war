# 20 ideas to make the map UI better

Status (checked in the 3D game, 20 Nov 2026): ✅ built · 🔶 built in part, what is missing said after it. In the 3D game the tools and layers open from the two buttons at the right of the map-mode bar (Q–Y).

1. ✅ **Smooth zoom.** Whole-number zoom steps, tiles load only when the move ends, overlays pause while you move, nothing blends full-screen during a zoom.
2. ✅ **Level of detail.** Only places inside the view and large enough for the zoom get labels (capped at 100), instead of ~450 live labels.
3. ✅ **Three-level borders.** Bold dark state borders with a light halo, mid-weight crown-land lines, thin province lines, plus a tint per realm.
4. ✅ **Zone legend and facts.** Colour legend in the Layers panel; hovering a realm shows ruler, evidence label and courier days; clicking opens its card (map pass, 4 Oct).
5. 🔶 **Trade routes.** Casing, colour by kind (river, road, salt), animated caravans, goods in the tooltip. Now: drawn from period sources (see the trade-routes work). Not yet: line weight by season or volume, a goods table on click.
6. 🔶 **Known movements, not fog of war.** Arrows with status (confirmed / reported / rumour), report date, source; next: age-fade and "last seen" ghosts.
7. ✅ **Reach rings.** Select a place and show how far a courier, an army and a supply train get in 1, 3, 7 days along roads, rivers and terrain, so information delay is visible. Now: marching rings (foot, wagons; 1, 3, 7 days) from where you are; couriers are the Courier reach map mode (R).
8. ✅ **Report-age ghosting.** Old reports render faint and blurred; fresh ones are crisp, so "what I know" is visible at a glance. Now: reported movements fade with the age of the report and say "may have moved since" after five days.
9. ✅ **3D town blocks.** Eight cities (Prague, Vienna, Breslau, Pressburg, Linz, Munich, Dresden, Brünn) as extruded buildings with roofs, walls and shadows over painted streets; next: landmarks (castle, cathedral, bridges) as hand-modelled pieces.
10. ✅ **Fortresses, magazines, bridges, fords.** Icon layer with garrison and supply notes; star-fort footprints when zoomed. Now: the Fortresses & crossings layer (fortress, bridge, magazine, ford) with garrison notes.
11. 🔶 **Season and weather.** Autumn / winter / mud / fog filters that also change movement notes from your staff. Now: the season follows the date and sets the staff's marching estimates; no picker. Not yet: mud and fog.
12. ✅ **Terrain lenses.** One-key switch between relief, forest and farmland, rivers and fords, "going" (dry/mud), supply. Now: the map modes Q–Y (Political, Habsburg lands, Terrain, Courier reach, Trade, Intelligence).
13. ✅ **Bookmarks and mini-map.** Hotkeys for Court, Frontier, Battle, plus an overview inset with your report limits drawn on it. Now: bookmarks 1–5 (Europe, Theatre, Vienna, Prague, Battle) and an overview map in Map tools.
14. 🔶 **Timeline strip.** Dispatches, courier ETAs and scheduled events along the bottom; scrub to see the map as of a past date. Now: the strip of letters, movements and ledger entries as they reach you, day by day. Not yet: courier ETAs, scrubbing back to an earlier day.
15. 🔶 **Proper military counters.** Period-style unit symbols that stack and fan out when you zoom, with formation icons instead of plain blocks. Now: counters by side and arm in table battles, last-seen ghosts for enemies out of sight. Not yet: stacking and fanning out on zoom.
16. ✅ **Measure tool.** Drag a line and your staff reports days of march by arm (foot, horse, wagons) without you doing arithmetic. Now: Measure (M) in Map tools.
17. ✅ **Annotations.** Draw, pin and note on the map; notes are saved with the campaign and included in packets sent to Claude. Now: Note (N) in Map tools; notes are saved with the campaign and go in the packet with where they were pinned.
18. 🔶 **Evidence badges everywhere.** Everything on the map carries documented / inference / demo labels; next: a card on click for every route, border and movement.
19. ✅ **Ambience.** Optional wind, bells, drums and cart sounds by zoom and place. Now: wind and bells on the map and drums in a table battle, at the game's Volume, when sound is on.
20. 🔶 **Readability and access.** Label halos tuned to the backdrop, colour-blind-safe palette option, reduced-motion mode, keyboard map navigation, scalable UI. Now: reduced motion, high-contrast labels, panel size, keyboard panning and zoom. Not yet: a colour-blind palette.

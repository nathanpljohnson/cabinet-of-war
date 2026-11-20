# Next: tempo per place, and scenes on their day (handoff)

Decided by Nathan, 20 Nov 2026. Not started in code.

**Start only after both of these are merged to `main`, in this order:**
1. [#13](https://github.com/nathanpljohnson/cabinet-of-war/pull/13) (bedchamber, leaner packet, winter baselines; branch `claude/wizardly-pasteur-sl24zf`)
2. [#10](https://github.com/nathanpljohnson/cabinet-of-war/pull/10) (battle grounds; branch `claude/affectionate-ride-sw51ia`)

Both touch `turn.js` (checkReply, liveState, buildPacket, replyFormat), `main.js` and the tests. Building before they merge makes a third conflicting branch.

Line numbers below are from `main` at `3002d42`. Re-find them after the merges.

## 1. Tempo per place
**Problem:** `world.tempo` is one value for the whole map. At the Prussian crossing (16 Dec 1740) Glogau is besieged while Vienna and the marching regiments are in winter quarters.

**Design:** keep `world.tempo` as the default for every place. Add `world.tempoAt: {placeId: "winter quarters" | "campaigning" | "truce"}`, which overrides it per place. Old replies and saves keep working.

**Steps:**
- `w3d/turn.js`
  - `checkReply` (~l.167, next to the `w.tempo` check): drop `tempoAt` entries whose value is not in `TEMPO` or whose place is not a known location id, with a note in `fixes`.
  - `mergeTurn` (~l.81): `tempoAt` must persist like `tempo`. It is not a per-turn field, so do not add it to the `['weather','scene']` clearing list. Check that `world` merges per key, so a reply giving `{glogau: …}` does not wipe `{brieg: …}`. If it replaces the whole map, merge per key; a `null` value removes a place.
  - `liveState` battle switch (`battleNear`, ~l.247): a battle is near if the global tempo or any `tempoAt` value is `campaigning`. Keep the preview exception (`bd-demo`).
  - `replyFormat` example (~l.281): add `"tempoAt":{"glogau":"campaigning"}`.
- `w3d/main.js` `worldCues()` (~l.148): `tempo: (W.tempoAt || {})[here] || W.tempo || null`. `region.js` reads `cues.tempo` and needs no change.
- `w3d/contract.md` "What he sees around him" (~l.42–43): one line. Give `tempoAt` for places whose war differs from the rest, e.g. a besieged fortress while the court is in winter quarters.
- Tests (`tests/harness.mjs`, `tests/test_turn.py`):
  - A bad value and an unknown place are dropped.
  - `tempoAt` survives a turn that does not mention it.
  - Per-key merge works.
  - `battleNear` is true when only `tempoAt` is campaigning.
- **Browser check:** Vienna in winter quarters with Glogau campaigning. Vienna shows idle soldiers; Glogau shows wagons and 6 drill rows (`region.js` l.24, 253).

## 2. Scenes shown on their day
**Problem:** 8 of 11 playtest replies had a scene, and they were among the best writing. The player sees them only in Notebook → "Conversations on record", collapsed. The contract and `src/case.js` say "keep scenes rare".

**Design:** a scene is written whenever he meets someone in person, and it arrives in the post on its day like a letter.

**Steps:**
- **Format:** add `"date": "YYYY-MM-DD"` to the scene in `replyFormat` (the "Optional…" line, ~l.260). In `checkReply` (the scene block added in #12, ~l.135), default it to the reply's `date` and clamp it to the turn's span.
- **Rule:**
  - `src/case.js`: replace "only when his orders ask for an audience or events truly require him in person; keep scenes rare" with "whenever he meets someone in person: an audience, a Council he sits in, a visitor at his bed (#13). One a turn, the meeting that mattered most." Keep the narration rule (the player's part is narration or the words of his orders).
  - Rebuild: `python3 src/pdx_build.py && python3 src/w3d_build.py`.
- **Show it:** `w3d/shell.js`
  - `post()` / `letters()` (~l.200–223): add the scene as an item `{id: 'scene-'+scene.id, kind: 'scene', dated: scene.date, arrives: scene.date, title, place}` when `state.scene` has lines.
  - In the letter view (where `r.kind === 'gazette'` goes to `drawGazette`, ~l.280), add `kind === 'scene'` → a paper sheet: setting in italics, speakers by name, player lines as "You", narration in italics, commitments as a short list.
  - Name lookup: copy the logic from the book's audience entry (`w3d/campaign.js` `addToBook`, `audience:`) into a shared helper.
  - Keep the Notebook's "Conversations on record" as the archive.
  - Make sure the scene does not count as an unanswered letter in `matters()`, or does so deliberately.
- **Tests:**
  - A scene with no date gets the reply's date.
  - A scene dated outside the turn is clamped.
- **Browser check:** a scene on day 3 of a turn appears in the post on day 3, renders on paper with names, and the day walk stops on it (check `nextDay()` stops on its date).
- **Later (only if wanted):** several scenes a turn (`scenes: []`). Not needed now.

## Testing setup that worked (playtest, Nov 2026)
- Driver: Playwright page held open. Scripts were in the playtest session's scratchpad: `drive.mjs`, `helpers.js`, `seal.sh`, `paste.sh`, `walk.sh`.
- Profile settings: autosave off, sound off.
- `page.screenshot` times out under SwiftShader; use `renderer.domElement.toDataURL()` right after `__w3d.step()`.
- Never pipe pytest into `&& git commit` (see `tasks/lessons.md`).

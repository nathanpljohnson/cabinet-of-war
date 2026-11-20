Task: Second simulated playthrough, spring 1741 up to Mollwitz (10 Apr 1741), to exercise what the Nov 2026 playtest never reached.

Completed (21 Nov 2026, mock smoke test, no code changed):
- Fresh profile on the launch.json server (port 8799, built-in browser), sound off (`w3d-gfx` {sound:false}), autosave off.
- From a clean save, in date order: answers → living → meeting → fever → battle all accepted, turns 1–5, no console errors.
  Separately from a clean save: ending accepted (turn 1), epilogue shown in the Book of the campaign (`.bk-epi`).
- Mocks only pass in date order; out of order the checker refuses them ("Time runs backwards"). That is correct behaviour, not a bug.
- Checked after (each from a clean save, walking days with `__w3d.shell.passDay()`): the urgent letter "The Breslau magazine" (living) arrives 22 Oct with its prompt and two choice buttons; choosing one shows "You answered: …". The scene "Bartenstein at the Chancellery" (meeting) stops the day walk on 24 Oct and renders on paper: setting, speaker by name, "You", no errors.
- Also checked: the scene stays out of the Notebook's "Matters in hand"; the ending's epilogue shows in the Notebook as well as the Book.
- Not verified: the table battle (refused by design: "You are not with the army"); forged/intercepted letters and trust in play.

Next: run the full playtest. Start from a state in early spring 1741 (or play on from Dec 1740) with the player sent to the army in Silesia so the field view and the table battle open; drive turns with a fresh adjudicator agent per packet as in Nov.
Test in order: urgent letter with branches → table battle (orders per phase, clock rail, aftermath ride) → forged/intercepted letters → trust/doubt → an ending.
Also measure the packet size at a late turn (was ~25k tokens at turn 10, before the leaner packet).

Files written: RESUME.md (this file)

Notes:
- Driver setup and gotchas: tasks/next-tempo-and-scenes.md "Testing setup that worked"; the Nov report: tasks/playtest-2026-11-20.md ("Still open").
- Console helpers: `__w3d.mockReply(name)`, `__w3d.shell.letters()`, `__w3d.shell.showBook()`, `__w3d.act('battle')`, `__w3d.lightCheck()`.
- Still unsourced: bread/forage prices, rations, magazine costs (almanac says "unverified").
- tasks/todo.md:83 (grounds verify box) is unticked though PR #10 merged; tick it once checked.

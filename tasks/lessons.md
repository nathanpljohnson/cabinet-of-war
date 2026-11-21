# Lessons (one line per correction from Nathan)
- Mute the game in every test instance (localStorage cabinet-of-war:w3d-gfx sound:false before boot); Nathan doesn't want to hear it while I work.
- Never chain `pytest ... | tail` into `&& git commit`: the pipe hides pytest's exit code. Run tests, read the result, then commit. (A backtick inside a JS template literal broke turn.js and was committed.)
- Read git log (and origin branches) before trusting tasks/*.md status; the notes lag the code (todo.md stopped at v11 while v12 and three visual passes had shipped).
- Never switch sound on in a test browser, even to test sound: check the audio nodes with music at 0, and leave sound off afterwards (Nathan heard the music, 20 Nov).
- Work done in another tool's session is not shipped until `git log origin/main` shows it; the Codex staff-briefing pass lived only as an uncommitted diff on Nathan's Mac and had to be rebuilt (21 Nov).

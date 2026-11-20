# Lessons (one line per correction from Nathan)
- Mute the game in every test instance (localStorage cabinet-of-war:w3d-gfx sound:false before boot); Nathan doesn't want to hear it while I work.
- Never chain `pytest ... | tail` into `&& git commit`: the pipe hides pytest's exit code. Run tests, read the result, then commit. (A backtick inside a JS template literal broke turn.js and was committed.)

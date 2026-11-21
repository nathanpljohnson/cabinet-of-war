# Turns

Each file here is one turn of a campaign: `turns/<campaignId>/turn-NNN.json`, the adjudicator's reply exactly as it would be pasted into the game.

A coding agent (Claude Code, Codex) writes it from the courier's errand the game copies when you seal a dispatch (Notebook → The record → How the courier rides). It checks the file with `node tools/turn-tool.mjs check <packet> <turn file>` and pushes it to main. The game page fetches the next turn from here, checks it again, and applies it at once if it passes every check; otherwise it shows the review.

The repository is public, so these files can be read by anyone, hidden plot included.

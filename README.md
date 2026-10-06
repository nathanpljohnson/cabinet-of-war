# Cabinet of War

A map-first command desk for a solo historical strategy campaign set in the Habsburg monarchy in October 1740, the day after Charles VI died and the War of the Austrian Succession began. You play a commander with access to the court in Vienna. You read reports, consult the council, study a hand-coloured map of 1740 Europe, and write orders. An AI chat (Claude or any other) acts as the GM and returns the next state of the world.

The desk is the record of the campaign. It does not depend on any chat remembering the game.

## How to play

You need Python 3 (to serve the files locally) and any AI chat. macOS is only needed for the optional desktop app.

1. Clone the repo and serve it:
   ```bash
   git clone https://github.com/nathanpljohnson/cabinet-of-war.git
   cd cabinet-of-war
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000/cabinet-of-war.html. Opening the HTML file directly won't work, because the map loads its tiles and city data from the neighbouring folders.

   On macOS you can build a desktop app instead: `app/build_app.sh` installs `Cabinet of War.app` in `~/Applications` and needs no server.
2. **Read the desk.** The map fills the screen. Click realms, cities and armies for their cards. Reports received are in the left rail. Council holds advisers' proposed courses, Staff holds logistics, and Record holds the campaign history.
3. **Write your orders.** Open **Orders** in the header and write the order of the day in plain prose. You can mark places on the map, choose a council course, or draw army orders on the table. These go into the packet too.
4. **Send them to the GM.** Click **Copy orders for Claude**, paste the packet into a new chat, and send it. The packet holds the full state of the world and the rules for the GM, so any chat can resolve the turn.
5. **Bring the reply back.** Paste the GM's reply into **Reply received — paste it here**. The desk checks it's the right campaign and turn, then asks you to **Accept and advance**. The world moves to the next turn.

Repeat. The desk saves your progress in the browser. **Save whole desk (HTML)** downloads a portable copy of the page with your campaign in it. Keep it next to the map folders.

Battles can be fought on the table. The result goes to the GM with your next packet.

## What's here

| Path | Holds |
| --- | --- |
| `cabinet-of-war.html` | The game: one page with the opening state embedded |
| `tiles1740/`, `realms1740/`, `cities/`, `paint/` | Map tiles, realm borders and city and battlefield detail |
| `app/` | macOS WebKit app shell and its build script |
| `src/` | Build scripts and source modules for the page and map |
| `research/`, `WORLD-ENGINE.md`, `CAMPAIGN-FOUNDATION.md`, `VERIFICATION-REPORT.md` | Historical research, campaign rules and source checks |
| `HANDOFF.md` | Development log and design decisions |

## Status

This is a work in progress. The places and the map are real. Many forces, offices and agendas in the opening state are still being researched, and `VERIFICATION-REPORT.md` tracks what's been checked.

## Licences

See `ATTRIBUTION.md`. Leaflet is BSD-2-Clause. Some derived map tiles are CC BY-NC-SA 4.0, so the map assets are for non-commercial use.

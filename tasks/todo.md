# game-v10: backend and living-world pass

## A. Backend
- [x] 1 Turn replies are changes only (schema 3), merged by the page
- [x] 2 Almanac (static research) out of the state; packet carries index + active plots
- [x] 3 Safe saves: prune snapshots, warn on failure, campaign file per turn, load it back
- [x] 4 Chronicle: Claude keeps a short story-so-far
- [x] 5 Threads: plot tracker Claude updates
- [x] 6 Stricter reply checks + cut-off paste handling
- [x] 7 Tests for the reply format (pytest + node)
- [x] 8 Contract and almanac as small files
- [x] 9 CLAUDE.md, docs tidy

## B/C. World
- [x] 10 Dice rolled by the page
- [x] 11 Other powers decide first
- [x] 12 Claude can add people
- [x] 13 Weather from the story
- [x] 14 Scene tags
- [x] 15 Enemy general's temperament
- [x] 16 Urgent letters with branches
- [x] 17 Whereabouts
- [x] 18 Trust / doubt sources
- [x] 19 Endings and epilogue
- [x] 20 Book of the campaign

## Verify
- [x] Tests pass
- [x] Full loop in browser with mock replies
- [x] lightCheck passes with new weather

# game-v11: the record, the Diarium, the purse, the seasons, the field afterwards
- [x] 2 Sealed record (seal chain, file fingerprint, ironman)
- [x] 4 Chronicle volumes every ten turns
- [x] 6 Wiennerisches Diarium
- [x] 10 His own purse
- [x] 11 Winter quarters / campaigning / truce
- [x] 13 Ride over the field afterwards
- [x] Tests (21) and browser check

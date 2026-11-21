# Dispatch exchange continuity

The page now owns a durable `state.exchange` record of unanswered order references, answered/settled references, meeting commitments and the latest meeting. Turn replies cannot overwrite it. Old unanswered orders no longer expire after three turns or disappear when the eight-dispatch history is pruned. Packets preserve their full wording and carry meeting context even after the meeting closes. Acknowledgement is distinguished from execution in the packet instructions.

The existing campaign file carries this record without a format change. Older browser saves recover commitments from the campaign book and orders from retained dispatches and archived replies. Already-discarded information cannot be recovered.

Pasted replies are saved with the current draft and restored after reload. Rejected replies give recovery instructions, a correction request with a manual-copy fallback, and keep the campaign unchanged. A rejected reply or Escape clears any prior candidate. The interface retains its existing dark paper styling and native dialog/disclosure controls; no new dependencies.

Validation: both production build scripts; 60 pytest checks (four new regression cases covering 12-turn order delays, exact long wording, commitments, answered/settled orders, save serialization and recovery copy); JavaScript syntax checks and git diff whitespace checks. Playwright exercised rejection, reload, acceptance and next-packet continuity on a separate localhost origin, with sound muted and automatic campaign downloads disabled. Error dialogs inspected at 390, 768 and 1440 CSS pixels and 200% text; no browser console errors. The shipped opening state was not advanced; all browser gameplay used local test fixtures.

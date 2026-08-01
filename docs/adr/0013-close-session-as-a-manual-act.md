# Close Session is a manual animator act, and results are readable before it

`SESSION_STATUS.ENDED` existed but was never written anywhere in the v2 backend — it appeared only in two reads — while the sole link into the results page was gated on `session.status === ENDED`. The results page was therefore unreachable in practice, and the close-session step that ADR-0011 deferred (and that Session Code collision-safety depends on) had no owner. The decision: **Close Session is an explicit animator action**, offered once both games are done, which sets `ENDED` and opens the results — and reading results is **decoupled from it**, available at any time, warning first when the picture is partial.

Closing is deliberately manual rather than an automatic transition when the second game stops, because it is irreversible in effect: the Code Dispatcher refuses every code form against an `ENDED` session, so once closed no player can rejoin or reach their avatar. That irreversibility is the point — bounding the pool of resolvable sessions is what keeps unchecked 4-digit Session Codes collision-safe — but it is not something to trigger behind the animator's back.

## Considered options

- **Auto-close when the second game stops.** Rejected: it makes the moment of lockout implicit, and the animator frequently still needs the room reachable after the last round.
- **Block closing until every survey is in.** Rejected: it hands a room of players the power to prevent the animator from closing, and one person leaving early would strand the session open forever.
- **Keep the `ENDED` gate on results and build the full lifecycle first.** Rejected: it blocks all reporting work behind a lifecycle design whose real driver is code recycling, not reporting. An animator may well want to show the debt game's curves during the break before the June game — so results renders one column when only one game has been played.
- **Carve out an exception so avatar codes still resolve on `ENDED` sessions for the survey.** Rejected: it puts an asterisk on the Code Dispatcher's cleanest rule and keeps codes resolvable past the point that was supposed to bound the pool.

## Consequences

- Closing does not destroy in-flight surveys. The survey POST is independent of session status, so a player already on the survey screen can still submit and is redirected to their lobby afterwards; only re-entry by code is closed off. Results must therefore rebuild the feelings radar from the latest answers rather than snapshotting them at load — the backend already emits `IO.SESSION.NEW_FEEDBACK` to the gameState room on submit.
- The `*ngIf="session.status === ENDED"` guard on the history screen's results link is removed; reaching results on a session that is not closed confirms first that the results are incomplete.
- Session Code recycling becomes real for the first time, which is what ADR-0011 was waiting on.

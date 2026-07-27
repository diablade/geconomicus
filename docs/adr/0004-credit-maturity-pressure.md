# Credit maturity pressure is client-derived, not a new backend timer

To push debt-game borrowers toward settling on time, a running credit nearing maturity now shows escalating cues: a **Halfway Nudge** snackbar at 50% elapsed, and a **Final-Minute Alarm** in the last 60s — a ~2s full-screen flash (reincarnate-overlay style, ⏰) that then force-opens the credit panel and replaces that credit's "en cours" label with a per-second `59s`…`0s` countdown that pulses each tick. All of it is **computed on the client** from the `IO.CREDIT.PROGRESS` heartbeat (already emitted every 5s per credit) plus a local 1s ticker for the countdown — **no new socket events, no new backend timers**.

## Considered options

- **Detect the 50% / 60s crossings on the server** (the `Timer` class has spare interval slots, giving exact timing) — rejected: it adds socket events and couples pedagogical UX to the timer engine, and the per-second countdown still needs a client ticker regardless. The ~5s detection lag and ~58s countdown start are acceptable.
- **A single aggregated "soonest credit" warning** — rejected: a player can hold several credits with independent maturities; aggregating would hide an approaching deadline, which defeats the point. Warnings are per-credit.

## Consequences

- **~5s resolution.** Crossings are detected at the next heartbeat, so a warning can fire up to ~5s late and the countdown may start at ~58s. Accepted.
- **Per-credit, independent latches** (armed → fired per threshold, keyed by credit `id`). **Extend re-arms both** — paying interest resets `remainingTime` to a fresh `durationCredit`, and the repeating pressure on a rolled-over debt is exactly the pedagogy. Interest-extend (`IO.CREDIT.EXTENDED`) is the only path that pushes `remainingTime` back up.
- **Reconnect reconstructs state, not theatre.** Latches initialize from the current `remainingTime` on `IO.PLAYER.INIT`: already-passed thresholds start "fired" (no stale replay), and a credit already under 60s restores its countdown state (panel open + counting) — but the 2s flash never replays.
- **Pause is free.** The client already flips `RUNNING` → `PAUSED` on `IO.GAME.PAUSED` (and back on resume); the ticker gates on `RUNNING`, so the countdown freezes and resumes with the game, with latches intact in memory.
- **Hardwired** `WARN_FRACTION = 0.5` / `FINAL_MS = 60_000` (not rules-config; promotable later). The Halfway Nudge is **suppressed when `durationCredit ≤ 2 min`** so it can't collide with the Final-Minute Alarm.
- **Player-only.** All three cues live in the player's own view; the animator's table/bank views (`credit-chip`) are untouched.
- Two credits entering their final minute in the same heartbeat is rare, so the flash is **not** de-duped — both may flash.
- **Companion bug fix (FAULT progress bar covers the blinking "police" warning until refresh).** Root cause is reactivity, not a missing `else`: credit socket handlers mutate credits **in place**, so `ngOnChanges` does not fire on a status transition, leaving the stale progress bar painted over the FAULT animation. Two surfaces:
  - **Player card (`credit.component`):** `progress` is now a **live getter** (reads `remainingTime` each change-detection pass), so it clears to 0 the moment a fault zeroes the timer.
  - **Animator table (`credit-chip`):** same live-getter fix — *and* the underlying cause was that the animator's `IO.CREDIT.FAULT` handler in `game-state.service` read the wrong payload shape (`data.playerStateIdx`/`data.status`, both `undefined`) and never called `creditsSubject.next()`, so `rows$` never recomputed and the fault surfaced only on refresh. Fixed to read `data.credit` (the shape the bank room actually receives, per `bank.state.service.js`), zero `remainingTime`, and emit — mirroring the player service.

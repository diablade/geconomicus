# Generic overlay component, and the /fake harness that exercises it

The player board grew several near-identical full-screen overlays — Reincarnate, Final-Minute Alarm, Fault Lockout (police), Take-over — each a glyph + title + text panel, all hand-written as separate `*ngIf` blocks with duplicated markup and timing. We extracted a single config-driven **`<app-overlay [config] (done) (onClick)>`** that renders one or more phases (icon, title, text, per-phase `durationMs`/`bg`/`sound`/`dismissable`, and an optional action `button`), so Reincarnate becomes the two-phase case, the Alarm the one-phase timed case, Fault Lockout the `loop: true` (host-cleared, un-skippable) case, and Take-over the button-carrying case. The decision is worth recording because a future reader will otherwise wonder why one component drives four unrelated-looking overlays, and because the **boundary of what folds in was a deliberate trade-off, not an accident**.

## The in/out boundary (the actual decision)

**In** — presentational-only overlays: Reincarnate, Final-Minute Alarm, Fault Lockout, Take-over.

**Out, and why:**
- **Prison** → its own dedicated component. It's a live countdown widget (spinner, `@prisonDoor` animation, audio), not a glyph+text panel.
- **Production Reveal** → stays in `square-zone`. It's card-area-scoped (not full-screen), with confetti and an in-place card swap.
- **Dead / First-Credit Question** → left untouched. Interactive blocking panels with real action buttons and game logic.

**Side-effects stay in the host.** The overlay renders phases and emits `(done)`/`(onClick)` — it never navigates or opens panels itself. Reincarnate's navigation and the Alarm's force-open-credit-panel remain in `PlayerBoardComponent`, driven off the overlay's `(done)`. This is what keeps the component generic; folding side-effects in would have re-coupled it to the board.

## Considered options

- **Leave the overlays as separate hand-written blocks.** Rejected: four copies of the same glyph/title/text/timing scaffolding, and no clean way to exercise them in isolation.
- **One mega-overlay that also absorbs Prison, Production Reveal, Dead, First-Credit.** Rejected: those are interactive or structurally different (timer widget, card-scoped celebration, blocking action panels). Forcing them into a phases-config would make the config a leaky catch-all.
- **A generic overlay that owns its own side-effects** (navigation, panel opening). Rejected: that re-couples the "generic" component to board-specific behavior; side-effects live in the host instead.

## Motivation / consequence: the `/fake` harness

The forcing function was a **fake player view** at route `/fake` (`data: { fake: true }`) that renders the real `PlayerBoardComponent` against hardcoded data (via a single new `PlayerStateService.loadFake(bundle)` seam, fed by pure factories under `front/src/app/fake/`) with no game or backend. A `fake-player-panel` component hosts its **own** instances of the extracted pieces — `<app-overlay>` with test configs (all phases `durationMs: 4000`, `dismissable: true`), the prison component, and a `square-zone` with a fake complete group — plus buttons for all 17 sounds, and toggles for JUNE⇄DEBT / CARD⇄ITEM theme / autoSeizure. Because the harness drives its own overlay instances, no demo trigger logic leaks into `PlayerBoardComponent` (only a `fakeMode` flag, one `*ngIf`, and small `if (fakeMode) return;` guards). This is only possible because the overlays became standalone, config-driven components — which is the real reason the extraction was done now rather than later.

---
name: project-migration-debt
description: Audit of v1 remnants, broken code, missing tests, and type gaps as of 2026-07-04
metadata:
  type: project
---

# Migration Debt Audit (2026-07-04)

## BREAKING
- `app.js` error handler: `app.use((err, req, res) => {...})` has 3 args — Express requires 4 (`err, req, res, next`) to treat as error middleware. Currently not invoked as error handler.
- `game.state.test.js` sends requests to `"/"` instead of real routes — tests are hollow stubs, false safety.

## CRITICAL — Legacy Still Live
- `/back/src/legacy/` (game, bank, player) routes served at `/game`, `/bank`, `/player` in app.js
- `DeprecatedBackService` (front) still injected in: HistoryGamesComponent, MasterAdminComponent, ResultsComponent, EventsComponent
- 4 frontend files import directly from `../../../../back/config/constantes_deprecated.cjs`

## IMPORTANT — v2 Consistency Gaps
- `MasterAdminComponent` — fully v1: idGame routing, deprecated service, legacy Game model
- `ResultsComponent` — 20+ `@ts-ignore` suppressions, fully on deprecated service
- `bank.state.controller.js` (`back/src/gameState/`) — orphaned, not imported by any route file. Also calls `BankStateService.getCreditsByPlayer`/`payInterest`/`seizure` which DON'T EXIST on the current `BankStateService` export — would throw ReferenceError/TypeError if ever wired up. Also missing `log` import. Do not wire this up as-is; bank logic actually lives inline in `game.state.controller.js` + `game.state.routes.js` under `/game-state/bank-state/*`.
- Inconsistent error handling: mix of `next(err)` and `res.status(500)` across controllers
- 9 deprecated `ogame/:idGame/...` routes still in app-routing.module.ts

## CRITICAL — Dead/stub gameplay logic in v2 (found via v1-vs-v2 route audit, 2026-07-10)

- `BankStateService.seizure` (`back/src/gameState/services/bank.state.service.js` ~L628-720) — entire body commented out, function is a no-op returning undefined. v1 equivalent (`legacy/bank/bank.service.js` `seizure()`, fully working) never ported. Route `bank-state/seizure` is commented out in `game.state.routes.js`.
- `BankStateService.lockDownPlayer` / `_getOut` / `_prisonEndCallback` (same file) — all stubs with v1 logic commented out. Prison mechanic (jail player, timer, release with new cards) is non-functional in v2. `BankStateService.prisonBreak` (uses `prisonTimerManager.releasePlayer`) IS implemented but has no route (`bank-state/prison-free` commented out in routes).
- `GameStateService._timerDeathCallback` (`game.state.service.js` ~L81-93) — `// TODO: Implement death logic`. v1's auto-death (round timer kills players on interval per `autoDeath`/`deathPassTimer` config, via `game.service.js` `startRoundTimers`) has zero v2 counterpart. Core gameplay feature currently silently does nothing each interval tick.
- `PlayerStateService.killPlayer` / `GameStateController.killPlayer` — fully implemented (handles debt seizure-on-death via `BankStateService.seizureOnDead`, events, sockets) but unreachable — route commented out in `game.state.routes.js` (`// router.post('/kill-player', ...)`).
- v1 `game/copy` (`copyGame` — duplicate a game+players into new game of opposite money type) has no v2 equivalent anywhere (checked session/rules/gameState routes).
- v1 `game/delete` (bcrypt-gated admin hard delete) — v2 has `session/delete` and `session/kill-game` but semantic parity unverified.

**Why:** these were surfaced by a systematic v1-route vs v2-route audit; several look "wired" (controller+service exist) but silently no-op or 404. Treat game-state prison/seizure/auto-death features as unimplemented until these are addressed, not just "needs testing".
**How to apply:** before building on top of prison/seizure/death features, check this list first — don't assume existence of a service function means it works.

## NICE-TO-HAVE
- Backend has no TypeScript (all .js)
- No ChangeDetectionStrategy.OnPush on major components (PlayerBoard, MasterBoard, BankBoard)
- No route lazy loading in Angular
- No shared DTO interfaces between front and back
- Frontend specs are all auto-generated "should create" stubs
- Angular still NgModule-based (not standalone/signals)

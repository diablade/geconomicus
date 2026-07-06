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
- `bank.state.controller.js` — exists but commented out of routes, orphaned file
- Inconsistent error handling: mix of `next(err)` and `res.status(500)` across controllers
- 9 deprecated `ogame/:idGame/...` routes still in app-routing.module.ts

## NICE-TO-HAVE
- Backend has no TypeScript (all .js)
- No ChangeDetectionStrategy.OnPush on major components (PlayerBoard, MasterBoard, BankBoard)
- No route lazy loading in Angular
- No shared DTO interfaces between front and back
- Frontend specs are all auto-generated "should create" stubs
- Angular still NgModule-based (not standalone/signals)

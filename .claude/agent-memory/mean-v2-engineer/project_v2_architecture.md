---
name: project-v2-architecture
description: Stack structure, key patterns, what is v2 vs still-legacy in geconomicus
metadata:
  type: project
---

# V2 Architecture Overview

## Stack
- Backend: Node.js + Express, plain JavaScript ES modules (.js), NOT TypeScript
- Frontend: Angular (NgModule-based, not standalone), TypeScript
- Shared: `/shared/constants.ts` compiled to `/shared/dist/` — exports as `@geco/shared`
- Database: MongoDB via Mongoose

## Backend Layout (`/back/src/`)
- `session/` — v2 session, avatar, rules (complete)
- `event/` — v2 event service (complete)
- `survey/` — v2 survey (complete)
- `gameState/` — v2 core game logic: helpers/, managers/, sanitizers/, services/
  - `managers/`: GameStateManager (in-memory singleton), GameQueueManager, GameTimerManager, CreditTimerManager, PrisonTimerManager, PlayersStateConnectionManager
  - Services: game.state, player.state, bank.state, decks.state, action.state
- `legacy/` — v1 code (game, bank, player) still LIVE in production via `/game`, `/bank`, `/player` routes
- `misc/` — Timer, validate.tool, misc.tool, token.service, activeTransactions

## Frontend Layout (`/front/src/app/`)
- `services/api/` — v2 API services: game-state, player-state, bank, deck, action, avatar, rules, session, survey
- `services/deprecated-back.service.ts` — v1 API client, still injected in 4 components
- `models/gameState.ts` — v2 models (Card, Credit, PlayerState, GameState, etc.)
- `models/game.ts` — v1 models (Game, Player, Credit with `_id`/`idGame` fields), still active

## Key V2 Patterns
- In-memory game state via `GameStateManager` singleton with queue-based mutation (`withQueue()`)
- `@geco/shared` provides constants/enums used across all layers
- Socket emissions via `socket.emitTo()` / `socket.emitAckTo()` (not direct io usage)
- Frontend uses `BehaviorSubject` + `$` observable pattern for state (GameStateService is the central hub)
- `combineLatest` + `vm$` pattern in master-board for reactive templates

## Why
**How to apply:** When adding new features, follow the gameState/ pattern: service does business logic via GameStateManager.withQueue(), controller handles HTTP and socket emit, routes use validate() middleware.

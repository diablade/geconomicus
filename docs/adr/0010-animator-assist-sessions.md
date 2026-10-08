# Animator assist sessions (co-exist / take-over / kick)

Sockets are keyed one-live-connection-per-identity (`s:{sessionId}:a:{avatarIdx}` for a player, `s:{sessionId}:master` for the cockpit); a second device on the same identity silently kicked the first, so the animator's *play the user* booted the player off their own phone (and a second cockpit booted the first). We now let the animator's **Assist Session** attach to a Seat under a *separate* connection identity so it never collides, and — when *play the user* is opened on a player who is currently live — choose one of three relationships: **Co-exist** (both devices act at once), **Take-over** (the player's screen is covered by a blocking overlay with a *Retake* button while the animator drives), or **Kick** (hard-disconnect the player, who must re-join). A second master cockpit always attaches silently as Co-exist.

## Decision

Co-exist permits **two devices acting on one Seat with no added locking**. We accept this because every game mutation already runs through a per-game serialisation queue (`GameStateManager.withQueue` → `gameQueueManager.enqueue`) and re-validates balances and card ownership on apply (`_deductTokens`, card lookups), so concurrent actions cannot corrupt state — the loser of a race is simply rejected.

## Considered options

- **Read-only mirror** (strict one-actor): the assist tab could only watch. Rejected — the animator wanted the assist tab usable for helping a player and driving demos.
- **Dual control with per-action locks + idempotency keys**: true concurrency control, but touches every action / buy / sell / credit path to defend against a race the per-game queue already prevents. Rejected as cost without benefit.

## Consequences

- The connected/disconnected indicator must **ignore assist sessions** — they belong to the animator, not the player.
- *play the user* must carry the chosen mode to the server so it knows which signal to send the displaced device: `kicked` (hard) vs `taken_over` (overlay + Retake).
- **Retake is a hard reclaim** — the player reconnecting as the actor ends the animator's assist session outright.

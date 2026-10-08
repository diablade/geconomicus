# The podium scores an Avatar across every Life it lived, dead ones included

Reincarnation appends Lives rather than mutating one (ADR-0002), so "how much does this player have" stopped having a single answer: an Avatar that died owns a frozen `DEAD` snapshot plus a fresh Life that started at zero. The decision: the **Avatar Score** is the sum over *all* of an Avatar's Lives of that Life's final coins plus its final card value. A Life's `DEAD` snapshot *is* the record of what that life accumulated, and the fact that its cards were also cloned back into the weight decks is a supply mechanic, not an economic statement about the life.

## Considered options

- **Score only the Current Life.** Rejected: it makes a player who accumulated for twenty minutes and then died rank below someone who did nothing, and the totals then reconcile with nothing — the gap being exactly Ghost Money.
- **Each Life competes separately on the podium.** Rejected: a player who died reads as two half-people, and the podium can be topped by someone no longer playing.
- **Score coins across all Lives but cards from the Current Life only**, so that both halves reconcile. Rejected despite being tempting: it splits one intuitive question ("what did this person end up with") into two rules that a room would have to be talked through.
- **Stop recycling dead Lives' cards** so plain summing reconciles. Rejected as out of scope — that is a rules change shrinking the card supply on every death, needing its own playtesting.

## Consequences

- **The coin half reconciles exactly.** Every coin sits in some Life and every Life belongs to an Avatar, so Σ coins over Avatar Scores equals the money mass. A dead Life's coins appear both in its Avatar's Score and in Ghost Money — two lenses on the same coins, not a double count.
- **The card half deliberately does not reconcile.** A recycled card is counted in the dead Life *and* in the hand that later redrew it. The Score's card component measures accumulation, never stock, and must never be presented next to goods-in-play as though the two were addable. For the same reason Ghost Cards measures churn — value that passed through dead hands — and is not the counterpart to Ghost Money that its name suggests.
- The coins curve draws **one line per Life**, all Lives of an Avatar sharing the avatar's colour so death reads as a visible break. A curve therefore never equals the Score for an Avatar that has died: the curve shows holdings at a moment, the Score sums across moments.
- The Gini is computed over Avatar Scores, and activity counts (`mostActive`, transactions per player) aggregate per Avatar rather than per `playerStateIdx`.

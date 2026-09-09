# Accents are ordered by significance

**Rule.** `accent-trace`, `accent-debug`, `accent-info`, `accent-warn`,
`accent-error` are a ladder from quiet to loud. Pick a rung by how loud the
thing should be on the page, never by what it means.

A faint background flourish and a trace line take `accent-trace` for the same
reason. A shout takes `accent-error` whether or not anything failed.

No tool can check this — "is this loud enough to be `accent-warn`?" is a
judgment at the call site, in four repos — so it is written down instead.

## Consequences

**Every consumer defines all five.** A palette with holes cannot be relied on,
which is what would stop a kit component from referencing an accent at all. A
design that does not visually distinguish two rungs binds them to the same
value; it does not leave one undefined.

**There is no separate severity vocabulary.** Colouring a message by importance
is not a second job — importance *is* the axis. `level-*` was the same five
values written a second time.

**Valence is not significance.** A success is low-significance (nothing to see)
but must read as good, so `positive` is its own role off the ladder. Adding it
as a sixth rung would break the ordering.

**Charts are neither.** `chart-1 … chart-5` are distinguishable hues carrying no
significance. A decorative colour that is not ordered belongs there.

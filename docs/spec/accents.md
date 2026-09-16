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

## A fill is not an ink

`primary` is not an accent and not a rung of the ladder: it is the action role,
and it is the one role whose fill and ink are two values. A role is one colour
worn two ways — as a solid fill with `on-{role}` reading on it, and as ink on a
surface — and for every other role one value does both jobs: `positive` and the
five accents each hold their dark `on-*` label (≥ 4.5:1) and read as ink on
`background` and `card` at once. `primary` could too — `#070d18` reads on the
teal ink `#2a9d8f` at 5.85:1 — so the split is a choice, not a necessity: the
call to action wanted a white label and a calmer plane than a bright teal
chip, and a teal dark enough for white (`#128377`, 4.63:1) is too dark to be
the link and eyebrow colour on a card. Hence `primary` / `primary-ink`, the
same hue and chroma one step apart in lightness; a role whose two values ever
diverge names its ink the same way, `{role}-ink`.

**What is the fill and what is the ink.** `bg-primary`, `text-on-primary`, the
checked state of a Checkbox and a Switch, a selected Calendar day and the
`Primary` band are the fill. A link, an eyebrow, a checked Field outline, the
focus `ring`, a radio dot, a Slider range and a Progress indicator are the ink.
The radio dot, range and indicator are ink although they are painted shapes
because a shape with no label is identified by contrast alone, and the ink
holds more of it: 4.72:1 on card against the fill's 3.39:1 for the 8px dot,
3.54:1 against 2.54:1 for the range on its muted track. A Checkbox and a
Switch stay the fill because their mark — the tick, the thumb — is
`on-primary`, so they identify themselves even where the fill does not clear
the surface.

**The floors.** The label on the fill ≥ 4.5:1. The fill against every surface
it is placed on ≥ 3:1: `background` (4.20:1), `secondary` (3.94:1), `card`
(3.39:1) and `popover` (3.01:1). `muted` is the one exception (2.54:1), and
the test holds it as one so that it cannot drift silently. It is the palette's
well, not a plane a screen is laid out on — the `TABS_LIST` behind the
triggers, the `DRAWER_HANDLE` bar, a `Muted` band — and a fill that does land
there (a Switch or a Button in a `Muted` band) is never a bare shape: its
`on-primary` mark — a label, a tick, a thumb — identifies it, which is what
WCAG 1.4.11 asks of a control. The ink on `background` and `card` ≥ 4.5:1. `--ring` is the ink, and the test holds that
too: a focus indicator needs the 3:1 the ink gives on every surface, not the
2.54:1 the fill gives on muted.

**An outline follows what it touches.** A border adjoining its own fill takes
the fill's colour — `border-primary` on a checked Checkbox — and a border
adjoining an ink shape takes the ink — `border-primary-ink` on the Slider
thumb riding its ink range. An outline on a surface with no fill inside it is
ink: `border-primary-ink` on a checked Field.

**What lives where.** The measured values live beside the tokens in
`tokens.css`; the track and indicator pairs beside their classes in
`rust/classes/src/{slider,progress}.rs`; every floor above is asserted in
`ts/uikit/test/tokens.test.ts`, so a retune of one value cannot quietly move
the other. `card` is pinned from both sides — the surface ladder below it and
the 3.39:1 the fill needs above it — so lifting card one step breaks the test.

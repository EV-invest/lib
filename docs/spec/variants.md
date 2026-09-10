# A variant names the state

**Rule.** A variant names the **state**, never its appearance and never its
selection.

A name that would become a lie if the palette changed (`Red`, `Teal`) is wrong.
A name that says only "this is the one you get if you say nothing" (`Default`)
is wrong — that fact lives in a `Default` impl. `lg / md / sm`, never
`lg / default / sm`.

No tool can check this — it is decided once per new enum, in four repos — so it
is written down instead.

## Where the line falls

`Outline`, `Ghost` and `Link` stay. They name an **affordance pattern**, not a
raw visual property: "outlined button" is a term of art that survives a
repalette, and it carries information an emphasis ladder loses — `Tertiary` does
not tell you the thing has a border. `Destructive` stays for the same reason
inverted: it names a consequence.

`Red` names a hue. Change the palette and the name lies.
`Default` names nothing at all.

## Consequences

**The selected-by-default fact lives in the trait.** `#[tw(default, …)]` already
emits `impl Default`, so a variant marked with it needs no name saying so.

**The generated key is the variant name.** A table keyed `"default"` beside
`"sm"` and `"lg"` cannot be read: `sidebarMenuButtonSizeClasses["default"]` was
`Sm` while `buttonSizeClasses["default"]` was `Md`, and nothing surfaced the
discrepancy because the key carried no information to contradict.

**There is one severity vocabulary.** A toast is `{Neutral, Positive, Info,
Warn, Error}` — the [accent rungs](./accents.md) plus the valence — not a second
ladder written in different words.

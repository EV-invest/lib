# Pricing fixtures — the contract with the panel

The Service-Arb panel vendors this directory by commit sha and holds its own
validator and its own `priceOf` to it; the site runs `src/core/pricing` on the
same files (`test/pricing.node.test.ts`). Changing a file here changes the
contract: tell the panel.

- `valid/*.json` — models every validator must accept.
- `invalid/*.json` — models every validator must refuse, whole. The file name
  says the one thing wrong with it.
- `cases.json` — `[{ name, model, need, inputs, cents }]`: what `priceOf`
  answers, to the cent. `cents: null` is "no price": an unanswered input, an
  option the input does not have, or a need the model does not price.

## The model

`format` 1, `currency` `"EUR"` (TTC), `validFrom` `YYYY-MM-DD`, `roundToCents`
≥ 1, `minimumCents` ≥ 0, `inputs`, `needs`. Unknown fields are refused, not
ignored. Ids and need keys are slugs, `[a-z0-9_-]{1,40}`. Labels are by locale
(`fr`, `en`, `fr-FR`), 1–120 characters, at least one; a site also wants one
in each of its own locales.

An input is `add` (options carry `addCents`), `multiply` (`multiplyBp`, 0 to
100 000 — 10 000 is ×1) or `discount` (`discountBp`, 0 to 10 000). A need is
`{ kind: "estimate", baseCents, inputs: [ids] }` (at most 12 inputs) or
`{ kind: "fixed", cents }`. Every amount is at most 100 000 000 cents, and so is
every step of a need's dearest combination.

## Rounding (normative)

Integer cents throughout; nothing is ever a float.

1. The base, plus every `add` input — in the need's input order.
2. Times every `multiply` input, in order; each product rounded half up to the
   cent at once: `floor((cents × bp + 5 000) / 10 000)`.
3. Every `discount` input, in order, as a multiplication by
   `10 000 − discountBp`, rounded the same way.
4. The total rounded half up to a multiple of `roundToCents`.
5. Raised to `minimumCents`.

A `fixed` need is its `cents`, as is: neither rounded nor raised to the
minimum.

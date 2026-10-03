import type { PriceLine, Price, PricingInput, PricingInputs, PricingModel } from "./model";

const BP = 10_000;

/**
 * `cents × bp / 10 000`, rounded half up to the cent. Integers throughout:
 * the product is exact (the model's limits keep it under 2^53), and the
 * division is done on the remainder, never on a float.
 */
export function mulBp(cents: number, bp: number): number {
  const n = cents * bp + BP / 2;
  return (n - (n % BP)) / BP;
}

/** Half up to a multiple of `step` (≥ 1). */
export function roundTo(cents: number, step: number): number {
  const rest = cents % step;
  return rest * 2 >= step ? cents - rest + step : cents - rest;
}

type Chosen = { input: PricingInput; option: string; effect: number };

/** The option answered for each of the need's inputs, or `null` when one is missing or unknown. */
function chosen(model: PricingModel, ids: readonly string[], inputs: PricingInputs): Chosen[] | null {
  const out: Chosen[] = [];
  for (const id of ids) {
    const input = model.inputs.find(i => i.id === id);
    const answer = Object.hasOwn(inputs, id) ? inputs[id] : undefined;
    if (!input || answer === undefined) return null;
    const effect = effectOf(input, answer);
    if (effect === null) return null;
    out.push({ input, option: answer, effect });
  }
  return out;
}

function effectOf(input: PricingInput, option: string): number | null {
  switch (input.kind) {
    case "add":
      return input.options.find(o => o.id === option)?.addCents ?? null;
    case "multiply":
      return input.options.find(o => o.id === option)?.multiplyBp ?? null;
    case "discount":
      return input.options.find(o => o.id === option)?.discountBp ?? null;
  }
}

/**
 * What a need costs for these answers — the one function the form shows and
 * the server stores, and the one the panel's preview ports. Normative order:
 *
 * 1. the need's base, plus every `add` input, in the need's input order;
 * 2. times every `multiply` input, in order, each product rounded half up to
 *    the cent at once;
 * 3. less every `discount` input, in order, each as a multiplication by
 *    `10 000 − discountBp` rounded the same way;
 * 4. the total rounded half up to a multiple of `roundToCents`;
 * 5. raised to `minimumCents`.
 *
 * A `fixed` need is its price, as is. `null`: the need is not priced, or an
 * input is unanswered or answered with an option it does not have — never a
 * guess. Answers to inputs the need does not ask are ignored.
 */
export function priceOf(model: PricingModel, need: string, inputs: PricingInputs): Price | null {
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  if (!pricing) return null;
  if (pricing.kind === "fixed") return { cents: pricing.cents, breakdown: [{ kind: "base", cents: pricing.cents }] };
  const answers = chosen(model, pricing.inputs, inputs);
  if (!answers) return null;
  const lines: PriceLine[] = [{ kind: "base", cents: pricing.baseCents }];
  let total = pricing.baseCents;
  const step = (kind: PricingInput["kind"], apply: (total: number, effect: number) => number) => {
    for (const a of answers) {
      if (a.input.kind !== kind) continue;
      const next = apply(total, a.effect);
      lines.push({ kind, input: a.input.id, option: a.option, cents: next - total });
      total = next;
    }
  };
  step("add", (t, cents) => t + cents);
  step("multiply", (t, bp) => mulBp(t, bp));
  step("discount", (t, bp) => mulBp(t, BP - bp));
  const rounded = roundTo(total, model.roundToCents);
  if (rounded !== total) lines.push({ kind: "rounding", cents: rounded - total });
  total = rounded;
  if (total < model.minimumCents) {
    lines.push({ kind: "minimum", cents: model.minimumCents - total });
    total = model.minimumCents;
  }
  return { cents: total, breakdown: lines };
}

/**
 * The band a price falls in, for analytics: `"5000-7500"` (cents, lower
 * bound included), never the price itself — a funnel needs the shape of
 * what was shown, not a number that, with a time and a place, singles a
 * visitor out.
 */
export const CENTS_BUCKETS: readonly number[] = [0, 2_500, 5_000, 7_500, 10_000, 15_000, 20_000, 30_000, 50_000, 100_000];

export function centsBucket(cents: number): string {
  let at = 0;
  for (let i = 0; i < CENTS_BUCKETS.length; i++) if (cents >= (CENTS_BUCKETS[i] ?? 0)) at = i;
  const low = CENTS_BUCKETS[at] ?? 0;
  const high = CENTS_BUCKETS[at + 1];
  return high === undefined ? `${low}+` : `${low}-${high}`;
}

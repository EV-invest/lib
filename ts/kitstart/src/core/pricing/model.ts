/**
 * A brand's price list as data: what an `estimate` need costs for a set of
 * enum inputs, and what a `fixed` need costs outright. JSON-serialisable on
 * purpose — the panel edits it, serves it, and prices its own preview with a
 * port of `priceOf` held to the same fixtures (`test/fixtures/pricing/`).
 *
 * Money is integer euro cents, TTC, throughout; a multiplier or a discount is
 * in basis points (10 000 = ×1, 1 000 = 10 %), so no float ever reaches a
 * stored or sent number.
 */

/** The model's format; a model of another format is refused whole. */
export const PRICING_FORMAT = 1;

/** The only currency a model may be in today: euros, all taxes included. */
export const PRICING_CURRENCY = "EUR";

/** A label per locale (`{ fr: "Studio", en: "Studio" }`); the page picks its own. */
export type PricingLabels = Readonly<Record<string, string>>;

/** One choice of an input: its slug, its words, and what it does to the price. */
export interface AddOption {
  id: string;
  labels: PricingLabels;
  /** Added to the base, in cents. */
  addCents: number;
}

export interface MultiplyOption {
  id: string;
  labels: PricingLabels;
  /** The subtotal times this, in basis points: 11 000 is ×1.1. */
  multiplyBp: number;
}

export interface DiscountOption {
  id: string;
  labels: PricingLabels;
  /** Taken off the subtotal, in basis points: 1 000 is 10 % off, 0 none. */
  discountBp: number;
}

/**
 * An enum the visitor answers — bedrooms, a surface band, a zone, a
 * frequency. Its `kind` says what its options do, and when (see `priceOf`):
 * every `add` first, then every `multiply`, then every `discount`.
 */
export type PricingInput =
  | { id: string; kind: "add"; labels: PricingLabels; options: readonly AddOption[] }
  | { id: string; kind: "multiply"; labels: PricingLabels; options: readonly MultiplyOption[] }
  | { id: string; kind: "discount"; labels: PricingLabels; options: readonly DiscountOption[] };

export type PricingInputKind = PricingInput["kind"];

/**
 * How one need is priced. `estimate`: a base and the inputs the visitor
 * answers, in the order the form asks them. `fixed`: one price, exactly —
 * neither rounded nor raised to the minimum, which are the estimate's.
 */
export type NeedPricing =
  | { kind: "estimate"; baseCents: number; inputs: readonly string[] }
  | { kind: "fixed"; cents: number };

export interface PricingModel {
  format: typeof PRICING_FORMAT;
  currency: typeof PRICING_CURRENCY;
  /** The date the prices hold from, `YYYY-MM-DD` — stored with every lead priced by it. */
  validFrom: string;
  /** The estimate's total is rounded half up to a multiple of this (1 = to the cent). */
  roundToCents: number;
  /** An estimate never comes out below this, after the rounding. */
  minimumCents: number;
  inputs: readonly PricingInput[];
  /** By the brand's subject slug; a need not here is a `quote`. */
  needs: Readonly<Record<string, NeedPricing>>;
}

/** The answers to an estimate's inputs: input id → option id. */
export type PricingInputs = Readonly<Record<string, string>>;

/**
 * One line of how a price was reached; `cents` is what the line changed, so
 * the lines add up to the total. `base` is the need's base (or the fixed
 * price); `rounding` and `minimum` appear only when they changed something.
 */
export type PriceLine =
  | { kind: "base"; cents: number }
  | { kind: "add" | "multiply" | "discount"; input: string; option: string; cents: number }
  | { kind: "rounding"; cents: number }
  | { kind: "minimum"; cents: number };

export interface Price {
  cents: number;
  breakdown: readonly PriceLine[];
}

/**
 * The model's limits. Ids are slugs (they travel to the panel as
 * `estimate_inputs`, which takes at most 12 pairs); every amount, and every
 * step of the dearest combination, stays at or under `MAX_PRICE_CENTS`, so
 * each product fits a double exactly and a 64-bit integer with room to spare.
 */
export const PRICING_LIMITS = {
  slug: /^[a-z0-9_-]{1,40}$/,
  locale: /^[a-z]{2}(-[A-Z]{2})?$/,
  maxLabel: 120,
  maxInputs: 32,
  maxOptions: 32,
  maxNeeds: 64,
  /** Per need: what `estimate_inputs` may carry. */
  maxNeedInputs: 12,
  maxPriceCents: 100_000_000,
  /** ×10 at most. */
  maxMultiplyBp: 100_000,
  maxDiscountBp: 10_000,
} as const;

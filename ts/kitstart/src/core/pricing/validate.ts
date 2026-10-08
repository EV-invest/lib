import {
  PRICING_CURRENCY,
  PRICING_FORMAT,
  PRICING_LIMITS as LIMIT,
  type NeedPricing,
  type PricingInput,
  type PricingLabels,
  type PricingModel,
} from "./model";
import { mulBp } from "./price";

/**
 * A model that does not validate, with every reason found. A model is taken
 * whole or not at all: one bad field refuses it, so a page never prices from
 * half a model.
 */
export class PricingModelError extends Error {
  override readonly name = "PricingModelError";
  constructor(readonly problems: readonly string[]) {
    super(`pricing model: ${problems.join("; ")}`);
  }
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Collects problems at a path, so the panel's editor can say which field. */
class Check {
  readonly problems: string[] = [];
  fail(path: string, why: string): void {
    this.problems.push(`${path}: ${why}`);
  }
  /** Only these keys, all of them required unless listed as optional. */
  keys(path: string, v: Json, required: readonly string[], optional: readonly string[] = []): void {
    for (const key of required) if (!Object.hasOwn(v, key)) this.fail(`${path}.${key}`, "missing");
    for (const key of Object.keys(v)) if (!required.includes(key) && !optional.includes(key)) this.fail(`${path}.${key}`, "unknown field");
  }
  int(path: string, v: unknown, min: number, max: number): number {
    if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) {
      this.fail(path, `an integer from ${min} to ${max}`);
      return min;
    }
    return v;
  }
  slug(path: string, v: unknown): string {
    if (typeof v !== "string" || !LIMIT.slug.test(v)) {
      this.fail(path, "a slug, [a-z0-9_-]{1,40}");
      return "";
    }
    return v;
  }
  labels(path: string, v: unknown): PricingLabels {
    if (!isObject(v) || Object.keys(v).length === 0) {
      this.fail(path, "an object of labels by locale, at least one");
      return {};
    }
    const out: Record<string, string> = {};
    for (const [locale, text] of Object.entries(v)) {
      if (!LIMIT.locale.test(locale)) this.fail(`${path}.${locale}`, "not a locale (fr, en, fr-FR)");
      else if (typeof text !== "string" || text.trim() === "" || text.length > LIMIT.maxLabel) this.fail(`${path}.${locale}`, `a label of 1 to ${LIMIT.maxLabel} characters`);
      else out[locale] = text;
    }
    return out;
  }
  list(path: string, v: unknown, min: number, max: number): unknown[] {
    if (!Array.isArray(v) || v.length < min || v.length > max) {
      this.fail(path, `a list of ${min} to ${max}`);
      return [];
    }
    return v;
  }
  unique(path: string, ids: readonly string[]): void {
    const dup = ids.find((id, i) => id !== "" && ids.indexOf(id) !== i);
    if (dup !== undefined) this.fail(path, `"${dup}" is listed twice`);
  }
}

/** `YYYY-MM-DD`, and a day the calendar has. */
function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const day = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === v;
}

const EFFECT = { add: "addCents", multiply: "multiplyBp", discount: "discountBp" } as const;
const EFFECT_MAX = { add: LIMIT.maxPriceCents, multiply: LIMIT.maxMultiplyBp, discount: LIMIT.maxDiscountBp } as const;

function input(c: Check, path: string, v: unknown): PricingInput | null {
  if (!isObject(v)) {
    c.fail(path, "an object");
    return null;
  }
  c.keys(path, v, ["id", "kind", "labels", "options"]);
  const id = c.slug(`${path}.id`, v.id);
  const labels = c.labels(`${path}.labels`, v.labels);
  const kind = v.kind;
  if (kind !== "add" && kind !== "multiply" && kind !== "discount") {
    c.fail(`${path}.kind`, "add, multiply or discount");
    return null;
  }
  const effect = EFFECT[kind];
  const options = c.list(`${path}.options`, v.options, 1, LIMIT.maxOptions).map((o, i) => {
    const at = `${path}.options[${i}]`;
    if (!isObject(o)) {
      c.fail(at, "an object");
      return { id: "", labels: {}, value: 0 };
    }
    c.keys(at, o, ["id", "labels", effect]);
    return { id: c.slug(`${at}.id`, o.id), labels: c.labels(`${at}.labels`, o.labels), value: c.int(`${at}.${effect}`, o[effect], 0, EFFECT_MAX[kind]) };
  });
  c.unique(`${path}.options`, options.map(o => o.id));
  switch (kind) {
    case "add":
      return { id, kind, labels, options: options.map(o => ({ id: o.id, labels: o.labels, addCents: o.value })) };
    case "multiply":
      return { id, kind, labels, options: options.map(o => ({ id: o.id, labels: o.labels, multiplyBp: o.value })) };
    case "discount":
      return { id, kind, labels, options: options.map(o => ({ id: o.id, labels: o.labels, discountBp: o.value })) };
  }
}

function need(c: Check, path: string, v: unknown, inputs: readonly PricingInput[]): NeedPricing | null {
  if (!isObject(v)) {
    c.fail(path, "an object");
    return null;
  }
  if (v.kind === "fixed") {
    c.keys(path, v, ["kind", "cents"]);
    return { kind: "fixed", cents: c.int(`${path}.cents`, v.cents, 0, LIMIT.maxPriceCents) };
  }
  if (v.kind !== "estimate") {
    c.fail(`${path}.kind`, "estimate or fixed");
    return null;
  }
  c.keys(path, v, ["kind", "baseCents", "inputs"]);
  const baseCents = c.int(`${path}.baseCents`, v.baseCents, 0, LIMIT.maxPriceCents);
  const ids = c.list(`${path}.inputs`, v.inputs, 0, LIMIT.maxNeedInputs).map((id, i) => c.slug(`${path}.inputs[${i}]`, id));
  c.unique(`${path}.inputs`, ids);
  for (const [i, id] of ids.entries()) if (id !== "" && !inputs.some(input => input.id === id)) c.fail(`${path}.inputs[${i}]`, `no input "${id}"`);
  return { kind: "estimate", baseCents, inputs: ids };
}

/**
 * The dearest answer to every input — each effect only raises the price with
 * its value, and rounding half up is monotonic — walked step by step: if no
 * step of it passes the cap, no combination does.
 */
function dearest(c: Check, path: string, pricing: Extract<NeedPricing, { kind: "estimate" }>, inputs: readonly PricingInput[]): void {
  const asked = pricing.inputs.map(id => inputs.find(i => i.id === id)).filter((i): i is PricingInput => i !== undefined);
  const max = (i: PricingInput) => Math.max(...i.options.map(o => ("addCents" in o ? o.addCents : "multiplyBp" in o ? o.multiplyBp : 0)));
  let total = pricing.baseCents;
  const steps = [total];
  for (const i of asked) if (i.kind === "add") steps.push((total += max(i)));
  for (const i of asked) if (i.kind === "multiply") steps.push((total = mulBp(total, max(i))));
  if (steps.some(s => s > LIMIT.maxPriceCents)) c.fail(path, `its dearest combination passes ${LIMIT.maxPriceCents} cents`);
}

/**
 * Every reason `value` is not a pricing model, or none. The panel's editor
 * holds a model to the same rules (`test/fixtures/pricing/`): unknown fields
 * are refused, not ignored, so the two never disagree on what a model says.
 */
export function pricingProblems(value: unknown): string[] {
  return check(value).problems;
}

function check(value: unknown): { problems: string[]; model: PricingModel | null } {
  const c = new Check();
  if (!isObject(value)) return { problems: ["model: an object"], model: null };
  c.keys("model", value, ["format", "currency", "validFrom", "roundToCents", "minimumCents", "inputs", "needs"]);
  if (value.format !== PRICING_FORMAT) c.fail("model.format", `${PRICING_FORMAT}`);
  if (value.currency !== PRICING_CURRENCY) c.fail("model.currency", PRICING_CURRENCY);
  if (!isDate(value.validFrom)) c.fail("model.validFrom", "a date, YYYY-MM-DD");
  const roundToCents = c.int("model.roundToCents", value.roundToCents, 1, LIMIT.maxPriceCents);
  const minimumCents = c.int("model.minimumCents", value.minimumCents, 0, LIMIT.maxPriceCents);
  const inputs = c
    .list("model.inputs", value.inputs, 0, LIMIT.maxInputs)
    .map((v, i) => input(c, `model.inputs[${i}]`, v))
    .filter((i): i is PricingInput => i !== null);
  c.unique("model.inputs", inputs.map(i => i.id));
  const needs: Record<string, NeedPricing> = {};
  if (!isObject(value.needs)) c.fail("model.needs", "an object by need slug");
  else {
    const entries = Object.entries(value.needs);
    if (entries.length > LIMIT.maxNeeds) c.fail("model.needs", `at most ${LIMIT.maxNeeds}`);
    for (const [slug, v] of entries) {
      const path = `model.needs.${slug}`;
      if (!LIMIT.slug.test(slug)) c.fail(path, "the need must be a slug, [a-z0-9_-]{1,40}");
      const pricing = need(c, path, v, inputs);
      if (pricing) needs[slug] = pricing;
    }
  }
  if (c.problems.length > 0) return { problems: c.problems, model: null };
  for (const [slug, pricing] of Object.entries(needs)) if (pricing.kind === "estimate") dearest(c, `model.needs.${slug}`, pricing, inputs);
  if (c.problems.length > 0) return { problems: c.problems, model: null };
  return {
    problems: [],
    model: { format: PRICING_FORMAT, currency: PRICING_CURRENCY, validFrom: String(value.validFrom), roundToCents, minimumCents, inputs, needs },
  };
}

/** The model `value` is, rebuilt from what was checked; throws `PricingModelError` with every problem. */
export function parsePricingModel(value: unknown): PricingModel {
  const { problems, model } = check(value);
  if (!model) throw new PricingModelError(problems);
  return model;
}

/**
 * A model a site can show: valid, and labelled in every one of its locales —
 * the panel may serve a model before a language is filled in, and a page
 * must not show an option with no words.
 */
export function pricingProblemsFor(value: unknown, locales: readonly string[]): string[] {
  const { problems, model } = check(value);
  if (!model) return problems;
  const out: string[] = [];
  const labelled = (path: string, labels: PricingLabels) => {
    for (const locale of locales) if (!Object.hasOwn(labels, locale)) out.push(`${path}.labels: no "${locale}" label`);
  };
  for (const [i, inp] of model.inputs.entries()) {
    labelled(`model.inputs[${i}]`, inp.labels);
    for (const [j, o] of inp.options.entries()) labelled(`model.inputs[${i}].options[${j}]`, o.labels);
  }
  return out;
}

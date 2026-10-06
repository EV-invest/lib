import type { PricingInputs, PricingModel } from "./model";
import { PRICING_LIMITS } from "./model";

/**
 * How a need is sold. `quote`: the price is uncertain, the lead asks for one.
 * `estimate`: the price follows from a few enum answers, shown live, then a
 * slot is booked. `fixed`: one price for a well-defined job, then a slot.
 * Chosen per need, not per site: one brand can mix them.
 */
export type LeadFlow = "quote" | "estimate" | "fixed";
export const LEAD_FLOWS: readonly LeadFlow[] = ["quote", "estimate", "fixed"];

/** A brand's flows by subject slug; a need left out is a `quote`. */
export type LeadFlows = Readonly<Record<string, LeadFlow>>;

/**
 * The flow a need actually runs: the brand's, when the model prices the need
 * that way — an `estimate` the model cannot price (a remote model without
 * it, no model at all) is a `quote`, never a form with no price. The form and
 * the server both ask this, so they agree on what was shown.
 */
export function flowOf(flows: LeadFlows | undefined, model: PricingModel | null, need: string | undefined): LeadFlow {
  if (!flows || !model || need === undefined || !Object.hasOwn(flows, need)) return "quote";
  const wanted = flows[need];
  if (wanted === undefined || wanted === "quote") return "quote";
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  return pricing?.kind === wanted ? wanted : "quote";
}

/** The form field an estimate's input is posted under: `estimate_<input id>`. */
export const ESTIMATE_FIELD_PREFIX = "estimate_";
export const estimateField = (input: string): string => `${ESTIMATE_FIELD_PREFIX}${input}`;

/**
 * The answer "I don't know" to an estimate's question (`EstimateQuestion.unknown`
 * in `LeadCapture`): not a slug, so it can never be an option a model prices.
 * A need answered with it is sold as a `quote` for that lead — on the form and
 * on the server alike (`answeredUnknown`).
 */
export const ESTIMATE_UNKNOWN = "?";

/** Whether any of the need's questions was answered "I don't know" — the lead is then a `quote`. */
export function answeredUnknown(model: PricingModel, need: string, get: (field: string) => string | null): boolean {
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  if (pricing?.kind !== "estimate") return false;
  return pricing.inputs.some(id => get(estimateField(id))?.trim() === ESTIMATE_UNKNOWN);
}

/**
 * The answers a form posted for the need's inputs — only those, and only
 * slugs. Read by the server, which prices them itself: a posted amount, if
 * any, is never read.
 */
export function readEstimateInputs(model: PricingModel, need: string, get: (field: string) => string | null): PricingInputs {
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  if (pricing?.kind !== "estimate") return {};
  const out: Record<string, string> = {};
  for (const id of pricing.inputs) {
    const value = get(estimateField(id))?.trim();
    if (value && PRICING_LIMITS.slug.test(value)) out[id] = value;
  }
  return out;
}

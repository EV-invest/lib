"use client";

import { useEffect, useMemo, useState } from "react";
import { ESTIMATE_UNKNOWN, type LeadFlow } from "../core/pricing/flow";
import type { PricingInput, PricingModel } from "../core/pricing/model";
import { priceOf } from "../core/pricing/price";

// What an estimate asks and prices, apart from the tiles that ask it: the
// card runs these on every layout, and draws the questions from a chunk of
// their own (`lead-parts`).

/**
 * How one of an estimate's questions is asked, by its input id — the brand's
 * presentation, never the price list's (which the panel owns).
 */
export interface EstimateQuestion {
  /** `tiles` (default): a grid of answers. `cards`: one per line, each with the total it would make. */
  display?: "tiles" | "cards" | undefined;
  /** Offers "I don't know" (`text.estimateUnknown`): the lead is then a quote, on the form and on the server. */
  unknown?: boolean | undefined;
  /** `2`: the "I don't know" tile takes two columns of the grid. Its own part is `estimateUnknown`, after `estimateOption`. */
  unknownSpan?: 1 | 2 | undefined;
  /** A short tag on an answer, by option id — the brand's words ("Le plus avantageux"); the kit picks none. */
  badges?: Readonly<Record<string, string>> | undefined;
  /** A shorter label per option id, drawn on a phone (under `sm`); the radio keeps the whole one. */
  shortLabels?: Readonly<Record<string, string>> | undefined;
  /**
   * The answer as a `messenger` variant's message says it, per option id — in
   * the need's line and the preview («2 ch.», «40–70 m²»), where a tile's own
   * «2» says nothing. Over `shortLabels`, then the label.
   */
  previewLabels?: Readonly<Record<string, string>> | undefined;
  /**
   * `steps` only: questions with the same number share a screen, in the
   * need's order. It moves on by itself once every one is answered; until
   * then a button does (`next`, else `text.stepNext`), and says what is missing.
   */
  step?: number | undefined;
  /** The words of that button, from the first question of the screen ("Voir les prix"). */
  next?: string | undefined;
}

/**
 * The screens an estimate's questions take in `steps`, in order: one each,
 * or those sharing a `step` number together, where the first of them stands.
 */
export function screensOf(inputs: readonly string[], questions: EstimateQuestions | undefined): string[][] {
  const out: string[][] = [];
  const byStep = new Map<number, string[]>();
  for (const id of inputs) {
    const step = questions?.[id]?.step;
    const shared = step === undefined ? undefined : byStep.get(step);
    if (shared) {
      shared.push(id);
      continue;
    }
    const screen = [id];
    if (step !== undefined) byStep.set(step, screen);
    out.push(screen);
  }
  return out;
}

export type EstimateQuestions = Readonly<Record<string, EstimateQuestion>>;

const isUnknown = (answers: Readonly<Record<string, string>>, ids: readonly string[]) => ids.some(id => answers[id] === ESTIMATE_UNKNOWN);

/**
 * The live price of the need on screen: its answers, as the visitor taps
 * them, and the price `priceOf` makes of them — the same function the server
 * stores the lead's price with. A full set of answers is reported once per
 * band (`onShown`), never the price itself. An answer "I don't know" makes
 * the need a `quote` for this lead (`flow`), as the server will.
 */
export function useEstimate(model: PricingModel | null, need: string | undefined, wanted: LeadFlow, onShown: (need: string, cents: number) => void) {
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const pricing = model && need !== undefined && Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  const flow: LeadFlow = wanted === "estimate" && pricing?.kind === "estimate" && isUnknown(answers, pricing.inputs) ? "quote" : wanted;
  const price = useMemo(() => (flow === "quote" || !model || need === undefined ? null : priceOf(model, need, flow === "estimate" ? answers : {})), [model, need, flow, answers]);
  const cents = flow === "estimate" ? price?.cents : undefined;
  useEffect(() => {
    if (need !== undefined && cents !== undefined) onShown(need, cents);
  }, [need, cents, onShown]);
  const answer = (input: string, option: string) => setAnswers(prev => ({ ...prev, [input]: option }));
  return { answers, answer, price, flow };
}

/** Every question a need's estimate asks, by input id, in order: none for a need not priced so. */
export function estimatePlan(model: PricingModel, need: string): readonly string[] {
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  return pricing?.kind === "estimate" ? pricing.inputs : [];
}

/**
 * The questions an estimate asks now, in order: all of them, or — once one
 * is answered "I don't know" — up to that one. The rest would price nothing.
 */
export function askedInputs(model: PricingModel, need: string, answers: Readonly<Record<string, string>>): PricingInput[] {
  const pricing = Object.hasOwn(model.needs, need) ? model.needs[need] : undefined;
  if (pricing?.kind !== "estimate") return [];
  const out: PricingInput[] = [];
  for (const id of pricing.inputs) {
    const input = model.inputs.find(i => i.id === id);
    if (!input) continue;
    out.push(input);
    if (answers[id] === ESTIMATE_UNKNOWN) break;
  }
  return out;
}

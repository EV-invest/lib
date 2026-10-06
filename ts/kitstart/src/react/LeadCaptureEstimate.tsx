"use client";

import { cn } from "@evinvest/uikit";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "../core/lead-capture-format";
import { ESTIMATE_UNKNOWN, estimateField, type LeadFlow } from "../core/pricing/flow";
import type { PricingInput, PricingModel } from "../core/pricing/model";
import { priceOf } from "../core/pricing/price";
import { labelOf } from "../core/pricing/validate";
import { TileGroup, type TileOption } from "./LeadCaptureTiles";
import type { PartClassNames } from "./parts";

export type EstimatePart = "estimate" | "estimateInput" | "estimateLegend" | "estimateGrid" | "estimateOption" | "estimateUnknown" | "badge" | "optionPrice";

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

export interface EstimateQuestionProps {
  model: PricingModel;
  need: string;
  input: PricingInput;
  question: EstimateQuestion | undefined;
  locale: string;
  answers: Readonly<Record<string, string>>;
  unknownLabel: string;
  required: boolean;
  enterPicks: boolean;
  onPick: (input: string, option: string, radio: HTMLInputElement) => void;
  onSelect: (input: string, option: string) => void;
  classNames?: PartClassNames<EstimatePart> | undefined;
}

/**
 * One question, a tile per answer — touch-sized radios, so the answers post
 * without a script too (the server prices them; the live price needs the
 * script). As `cards`, each answer shows the total it would make with the
 * others given, once they are.
 */
export function EstimateQuestionField(props: EstimateQuestionProps) {
  const { model, need, input, question, locale, answers, classNames: c } = props;
  const cards = question?.display === "cards";
  const totalWith = (option: string) => {
    const price = cards ? priceOf(model, need, { ...answers, [input.id]: option }) : null;
    return price ? formatCents(price.cents, locale) : null;
  };
  const options: TileOption[] = input.options.map(o => ({ value: o.id, label: labelOf(o.labels, locale), shortLabel: question?.shortLabels?.[o.id], badge: question?.badges?.[o.id], aside: totalWith(o.id) }));
  if (question?.unknown) options.push({ value: ESTIMATE_UNKNOWN, label: props.unknownLabel, span: question.unknownSpan === 2 ? 2 : undefined, className: c?.estimateUnknown });
  return (
    <TileGroup
      name={estimateField(input.id)}
      legend={labelOf(input.labels, locale)}
      options={options}
      value={answers[input.id]}
      required={props.required}
      field={estimateField(input.id)}
      enterPicks={props.enterPicks}
      onPick={(option, radio) => props.onPick(input.id, option, radio)}
      onSelect={option => props.onSelect(input.id, option)}
      classNames={{
        field: c?.estimateInput,
        legend: c?.estimateLegend,
        // The column count is the brand's (`estimateGrid`): a denser grid makes a shorter card, and the tile keeps its touch height in any.
        grid: cn(cards ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3", c?.estimateGrid),
        tile: cn(cards ? "h-full gap-3 px-4 py-3" : "h-full px-3 py-2", c?.estimateOption),
        badge: c?.badge,
        aside: c?.optionPrice,
      }}
    />
  );
}

/** An estimate's questions on one screen: `EstimateQuestionField` each, in order. */
export function EstimateInputs(props: Omit<EstimateQuestionProps, "input" | "question"> & { questions: EstimateQuestions | undefined }) {
  const { model, need, answers, questions, classNames: c, ...rest } = props;
  const inputs = askedInputs(model, need, answers);
  if (inputs.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-5", c?.estimate)}>
      {inputs.map(input => (
        <EstimateQuestionField key={input.id} model={model} need={need} input={input} question={questions?.[input.id]} answers={answers} classNames={c} {...rest} />
      ))}
    </div>
  );
}

"use client";

import { cn } from "@evinvest/uikit";
import { useEffect, useMemo, useState } from "react";
import { formatCents } from "../core/lead-capture-format";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import { estimateField, type LeadFlow } from "../core/pricing/flow";
import type { Price, PriceLine, PricingInput, PricingModel } from "../core/pricing/model";
import { priceOf } from "../core/pricing/price";
import { labelOf } from "../core/pricing/validate";
import type { PartClassNames } from "./parts";

export type EstimatePart = "estimate" | "estimateInput" | "estimateLegend" | "estimateGrid" | "estimateOption" | "price" | "priceTotal" | "breakdown" | "priceNote";

/**
 * The live price of the need on screen: its answers, as the visitor taps
 * them, and the price `priceOf` makes of them — the same function the server
 * stores the lead's price with. A full set of answers is reported once per
 * band (`onShown`), never the price itself.
 */
export function useEstimate(model: PricingModel | null, need: string | undefined, flow: LeadFlow, onShown: (need: string, cents: number) => void) {
  const [answers, setAnswers] = useState<Readonly<Record<string, string>>>({});
  const price = useMemo(() => (flow === "quote" || !model || need === undefined ? null : priceOf(model, need, flow === "estimate" ? answers : {})), [model, need, flow, answers]);
  const cents = flow === "estimate" ? price?.cents : undefined;
  useEffect(() => {
    if (need !== undefined && cents !== undefined) onShown(need, cents);
  }, [need, cents, onShown]);
  const answer = (input: string, option: string) => setAnswers(prev => ({ ...prev, [input]: option }));
  return { answers, answer, price };
}

/**
 * An estimate's questions, a tile per answer — touch-sized radios, so the
 * answers post without a script too (the server prices them; the live price
 * needs the script). Required once the script runs: a price needs every
 * answer, and without the script an unanswered estimate is still a lead, a
 * quote.
 */
export function EstimateInputs(props: {
  model: PricingModel;
  need: string;
  locale: string;
  answers: Readonly<Record<string, string>>;
  onAnswer: (input: string, option: string) => void;
  required: boolean;
  classNames?: PartClassNames<EstimatePart> | undefined;
}) {
  const { model, need, locale, answers, classNames: c } = props;
  const pricing = model.needs[need];
  if (pricing?.kind !== "estimate") return null;
  const inputs = pricing.inputs.map(id => model.inputs.find(i => i.id === id)).filter((i): i is PricingInput => i !== undefined);
  return (
    <div className={cn("flex flex-col gap-5", c?.estimate)}>
      {inputs.map(input => (
        <fieldset key={input.id} className={cn("flex flex-col gap-2", c?.estimateInput)}>
          <legend className={cn("mb-2 text-sm font-medium text-ink", c?.estimateLegend)}>{labelOf(input.labels, locale)}</legend>
          {/* The column count is the brand's (`estimateGrid`): a denser grid makes a shorter card, and the tile keeps its touch height in any. */}
          <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", c?.estimateGrid)}>
            {input.options.map(option => (
              <label key={option.id} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name={estimateField(input.id)}
                  value={option.id}
                  required={props.required}
                  checked={answers[input.id] === option.id}
                  onChange={() => props.onAnswer(input.id, option.id)}
                  className="peer absolute inset-0 opacity-0"
                  data-lead-field={estimateField(input.id)}
                />
                <span
                  className={cn(
                    "flex h-full min-h-11 items-center rounded-[var(--control-radius)] border border-input px-3 py-2 text-ink transition-colors",
                    "peer-checked:border-primary peer-checked:bg-hover peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
                    c?.estimateOption,
                  )}
                >
                  {labelOf(option.labels, locale)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function lineLabel(line: PriceLine, model: PricingModel, locale: string, text: LeadCaptureFlowText): string {
  switch (line.kind) {
    case "base":
      return text.priceBase;
    case "rounding":
      return text.priceRounding;
    case "minimum":
      return text.priceMinimum;
    case "add":
    case "multiply":
    case "discount": {
      // The answer names itself ("2 chambres", "Toutes les 2 semaines"); the question would only repeat it.
      const option = model.inputs.find(i => i.id === line.input)?.options.find(o => o.id === line.option);
      return option ? labelOf(option.labels, locale) : line.option;
    }
  }
}

/**
 * The price, read out as it changes (`aria-live`): an estimate's total and
 * how it was reached, or — until every question is answered — what is
 * missing; a fixed need's price, as is. Never "from": it is the price for
 * these answers.
 */
export function PriceBox(props: {
  model: PricingModel;
  flow: Exclude<LeadFlow, "quote">;
  price: Price | null;
  locale: string;
  text: LeadCaptureFlowText;
  classNames?: PartClassNames<EstimatePart> | undefined;
}) {
  const { model, flow, price, locale, text, classNames: c } = props;
  // A line that changed nothing (an answer worth 0) is not worth reading out.
  const lines = price?.breakdown.filter((line, i) => i === 0 || line.cents !== 0) ?? [];
  return (
    <div aria-live="polite" aria-atomic="true" className={cn("flex flex-col gap-2 rounded-[var(--control-radius)] border border-border bg-card p-4", c?.price)}>
      <p className="text-sm text-ink-soft">{text.priceTitle}</p>
      {price ? (
        <p className={cn("font-display text-3xl font-bold text-ink", c?.priceTotal)} data-price-cents={price.cents}>
          {formatCents(price.cents, locale)}
        </p>
      ) : (
        <p className="text-ink">{text.pricePending}</p>
      )}
      {flow === "estimate" && lines.length > 1 && (
        <ul className={cn("flex flex-col gap-1 text-sm text-ink-soft", c?.breakdown)}>
          {lines.map((line, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{lineLabel(line, model, locale, text)}</span>
              <span className="tabular-nums">{formatCents(line.cents, locale, i > 0)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={cn("text-sm text-ink-soft", c?.priceNote)}>{text.priceNote}</p>
    </div>
  );
}

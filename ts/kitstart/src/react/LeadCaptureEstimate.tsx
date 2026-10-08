"use client";

import { cn } from "@evinvest/uikit";
import { formatCents } from "../core/lead-capture-format";
import { ESTIMATE_UNKNOWN, estimateField } from "../core/pricing/flow";
import type { PricingInput, PricingModel } from "../core/pricing/model";
import { priceOf } from "../core/pricing/price";
import { labelOf } from "../core/pricing/label";
import { TileGroup, type TileOption } from "./LeadCaptureTiles";
import { askedInputs, type EstimateQuestion, type EstimateQuestions } from "./estimate-plan";
import type { PartClassNames } from "./parts";

export type EstimatePart = "estimate" | "estimateInput" | "estimateLegend" | "estimateGrid" | "estimateOption" | "estimateUnknown" | "badge" | "optionPrice";

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

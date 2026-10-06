import { cn } from "@evinvest/uikit";
import { fillText, formatCents } from "../core/lead-capture-format";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import type { LeadFlow } from "../core/pricing/flow";
import type { Price, PriceLine, PricingModel } from "../core/pricing/model";
import { labelOf } from "../core/pricing/validate";
import type { PartClassNames } from "./parts";

export type PricePart = "price" | "priceTotal" | "breakdown" | "priceNote" | "priceLine" | "priceTaxCredit" | "priceDetail";

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
  classNames?: PartClassNames<PricePart> | undefined;
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

/** What is left to pay once a tax credit of `ratio` (0.5 for half) is taken off, to the cent. */
export const afterCredit = (cents: number, ratio: number): number => cents - Math.round(cents * ratio);

/**
 * `price="compact"`: the price on one line (`priceLine`), what is left after
 * the brand's tax credit when it has one (`taxCredit`, a ratio), and how it
 * was reached behind a disclosure — a `<details>`, so it opens without a
 * script. Read out as it changes, the line only.
 */
export function PriceCompact(props: {
  model: PricingModel;
  flow: Exclude<LeadFlow, "quote">;
  price: Price | null;
  locale: string;
  taxCredit: number | undefined;
  text: LeadCaptureFlowText;
  classNames?: PartClassNames<PricePart> | undefined;
}) {
  const { model, flow, price, locale, taxCredit, text, classNames: c } = props;
  const lines = price?.breakdown.filter((line, i) => i === 0 || line.cents !== 0) ?? [];
  const credit = price && taxCredit !== undefined && taxCredit > 0 && taxCredit < 1 ? afterCredit(price.cents, taxCredit) : null;
  return (
    <div className={cn("flex flex-col gap-1", c?.price)}>
      <p aria-live="polite" aria-atomic="true" className={cn("flex flex-wrap items-baseline gap-x-2 text-ink", c?.priceLine)}>
        {price ? (
          <>
            <span className={cn("font-semibold", c?.priceTotal)} data-price-cents={price.cents}>
              {fillText(text.priceLine, { price: formatCents(price.cents, locale) })}
            </span>
            {credit !== null && (
              <span className={cn("text-sm text-ink-soft", c?.priceTaxCredit)} data-credit-cents={credit}>
                <span aria-hidden="true">· </span>
                {fillText(text.priceTaxCredit, { price: formatCents(credit, locale) })}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-ink-soft">{text.pricePending}</span>
        )}
      </p>
      {flow === "estimate" && lines.length > 1 && (
        <details className={cn("text-sm text-ink-soft", c?.priceDetail)}>
          <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-4">{text.priceDetail}</summary>
          <ul className={cn("flex flex-col gap-1 pb-2", c?.breakdown)}>
            {lines.map((line, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{lineLabel(line, model, locale, text)}</span>
                <span className="tabular-nums">{formatCents(line.cents, locale, i > 0)}</span>
              </li>
            ))}
          </ul>
          <p className={c?.priceNote}>{text.priceNote}</p>
        </details>
      )}
    </div>
  );
}

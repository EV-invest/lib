import { cn } from "@evinvest/uikit";
import type { ReactNode } from "react";
import { fillText, formatCents } from "../core/lead-capture-format";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import type { LeadSent } from "./use-lead-submit";
import type { PartClassNames } from "./parts";

export type PricedPart = "priced" | "pricedPrice" | "pricedNote";

/**
 * After a priced lead (`estimate`, `fixed`): the price the server took it at,
 * then how the slot is set — by a call, until a booking provider is chosen;
 * a brand's `booking` (its own scheduling widget, say) stands in for that
 * promise. The lead is stored before any of this, so an abandoned booking is
 * still a lead to call.
 */
export function LeadCapturePriced(props: { sent: LeadSent; booking: ReactNode; locale: string; text: LeadCaptureFlowText; classNames?: PartClassNames<PricedPart> | undefined }) {
  const { sent, locale, text, classNames: c } = props;
  return (
    <div className={cn("flex flex-col gap-3", c?.priced)}>
      {sent.cents !== undefined && <p className={cn("font-medium text-ink", c?.pricedPrice)}>{fillText(text.sentPrice, { price: formatCents(sent.cents, locale) })}</p>}
      {props.booking ?? <p className={cn("text-ink", c?.pricedNote)}>{text.slotCallback}</p>}
    </div>
  );
}

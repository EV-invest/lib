"use client";

import { useState } from "react";
import { PRICE_CHANGED } from "../core/accept";
import { fillText, formatCents } from "../core/lead-capture-format";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import type { Price } from "../core/pricing/model";

/**
 * The price the server answered when the one on screen was stale
 * (`price_changed`): shown in its place, and posted back as `shown_cents` —
 * a resubmit is the visitor confirming it. Only while the answers are the
 * ones it was refused for; a change and the page prices on its own again.
 */
export function useRepriced(price: Price | null, need: string | undefined, text: LeadCaptureFlowText, locale: string) {
  const [repriced, setRepriced] = useState<{ cents: number; shown: number; need: string | undefined } | null>(null);
  const current = repriced && price && repriced.shown === price.cents && repriced.need === need ? repriced : null;
  return {
    /** The price to show: the server's fresh one, else the page's own. */
    price: current ? { cents: current.cents, breakdown: [] } : price,
    /** What the form posts as `shown_cents`. */
    shownCents: current?.cents ?? price?.cents,
    /** The words for a `price_changed` refusal, with both prices when the page has them. */
    message: (): string =>
      current ? fillText(text.priceChanged, { price: formatCents(current.cents, locale), shown: formatCents(current.shown, locale) }) : text.priceChangedGeneric,
    /** A refusal: remembers the fresh price when it is `price_changed`. */
    refused(field: string, cents: number | undefined): void {
      if (field === PRICE_CHANGED && cents !== undefined && price) setRepriced({ cents, shown: price.cents, need });
    },
  };
}

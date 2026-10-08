import { lazyPart } from "./lazy-part";

/**
 * `LeadCapture`'s pieces that only some cards draw, each in a chunk of its
 * own: a page pays for what its variant draws — the screens of `steps`, the
 * tiles, an estimate's questions and its price, the booking after a priced
 * lead — and the one-screen card with the select for none of them.
 */
export const LeadStepsPart = lazyPart(() => import("./LeadCaptureSteps").then(m => m.LeadSteps));
export const IntroFieldPart = lazyPart(() => import("./LeadCaptureSteps").then(m => m.IntroField));
export const TileGroupPart = lazyPart(() => import("./LeadCaptureTiles").then(m => m.TileGroup));
export const EstimateInputsPart = lazyPart(() => import("./LeadCaptureEstimate").then(m => m.EstimateInputs));
export const EstimateQuestionPart = lazyPart(() => import("./LeadCaptureEstimate").then(m => m.EstimateQuestionField));
export const PriceBoxPart = lazyPart(() => import("./LeadCapturePrice").then(m => m.PriceBox));
export const PriceCompactPart = lazyPart(() => import("./LeadCapturePrice").then(m => m.PriceCompact));
export const LeadBookingPart = lazyPart(() => import("./LeadBooking").then(m => m.LeadBooking));

/** What a card may draw, read off its props: the chunks to ask for. */
export interface LeadPartsWanted {
  steps: boolean;
  tiles: boolean;
  /** A need the price list prices: the estimate's questions, the price, and the booking after the lead. */
  priced: boolean;
  /** The kit's booking, not the brand's own `booking`. */
  booking: boolean;
}

/**
 * Asks at once for every chunk the card may draw, from its render: hydrating
 * waits for the ones drawn now, and none of them behind another. Later ones
 * (an estimate after the need, the booking after the lead) are there by the
 * time the visitor gets to them.
 */
export function preloadLeadParts(wanted: LeadPartsWanted): void {
  if (typeof window === "undefined") return;
  if (wanted.steps) {
    LeadStepsPart.preload();
    IntroFieldPart.preload();
  }
  if (wanted.tiles || wanted.steps || wanted.priced) TileGroupPart.preload();
  if (wanted.priced) {
    EstimateInputsPart.preload();
    EstimateQuestionPart.preload();
    PriceBoxPart.preload();
    PriceCompactPart.preload();
    if (wanted.booking) LeadBookingPart.preload();
  }
}

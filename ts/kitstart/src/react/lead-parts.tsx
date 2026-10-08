import { holdUntilLoaded, lazyPart, type Loadable } from "./lazy-part";

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
 * Every chunk the card may draw, asked for at once from its render, and the
 * render held until they are all here. Hydrating, the server's markup stays
 * as it is meanwhile; after, no state the visitor reaches — the next screen,
 * an estimate's questions, the success with its booking — waits on a chunk
 * and draws empty. They come in parallel, so the hold is about the slowest
 * one, not their sum.
 */
export function holdLeadParts(wanted: LeadPartsWanted): void {
  const parts: Loadable[] = [];
  if (wanted.steps) parts.push(LeadStepsPart, IntroFieldPart);
  if (wanted.tiles || wanted.steps || wanted.priced) parts.push(TileGroupPart);
  if (wanted.priced) parts.push(EstimateInputsPart, EstimateQuestionPart, PriceBoxPart, PriceCompactPart);
  if (wanted.priced && wanted.booking) parts.push(LeadBookingPart);
  if (typeof window !== "undefined") for (const part of parts) part.whenLoaded();
  holdUntilLoaded(parts);
}

"use client";

import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { MESSAGE_REF_PREFIX, newMessageRef, type MessengerFacts, type MessengerMode, type MessengerVariant } from "../core/messenger";
import type { MessengerAt, MessengerKit, MessengerShown } from "./messenger/types";

/**
 * The `messenger` variants, each its own chunk: a page pays for the one its
 * arm draws, and the control for none. `LeadCapture` only says where.
 */
const PARTS: Record<MessengerShown, ComponentType<{ kit: MessengerKit }>> = {
  select: lazy(() => import("./messenger/select")),
  segment: lazy(() => import("./messenger/segment")),
  tiles: lazy(() => import("./messenger/tiles")),
  thanks: lazy(() => import("./messenger/thanks")),
  swap: lazy(() => import("./messenger/swap")),
  saga: lazy(() => import("./messenger/saga")),
  urgency: lazy(() => import("./messenger/urgency")),
  sheet: lazy(() => import("./messenger/sheet")),
  chip: lazy(() => import("./messenger/chip")),
  split: lazy(() => import("./messenger/split")),
  fallback: lazy(() => import("./messenger/fallback")),
};

/** Where each variant draws; everywhere else the card is the control's. */
const USES: Readonly<Record<MessengerShown, readonly MessengerAt[]>> = {
  select: ["contact"],
  segment: ["contact"],
  tiles: ["contact"],
  thanks: ["done"],
  swap: ["contact"],
  saga: ["head", "body", "contact"],
  urgency: ["beforeNeed", "contact"],
  sheet: ["contact"],
  chip: ["afterHead", "contact"],
  split: ["contact"],
  fallback: ["afterSubmit"],
};

export const NO_MESSENGERS: MessengerFacts = { whatsapp: null, telegram: null };

/**
 * What a variant becomes on this place: itself while the place has WhatsApp;
 * without it the control (Figma's «Выключено в панели») — with a way to the
 * bot when there is one — except `urgency`, whose question is the lead's
 * (both answers then ask the phone), and `thanks`, whose success keeps the
 * bot. `null`: the control as it is.
 */
export function messengerShownOf(variant: MessengerVariant | undefined, facts: MessengerFacts): MessengerShown | null {
  if (!variant) return null;
  if (facts.whatsapp) return variant.kind;
  if (variant.kind === "urgency") return "urgency";
  if (!facts.telegram) return null;
  return variant.kind === "thanks" ? "thanks" : "fallback";
}

export function drawsAt(shown: MessengerShown | null, at: MessengerAt): boolean {
  return shown !== null && USES[shown].includes(at);
}

/** The channel a variant starts on: none until asked (`saga`, `urgency`), else WhatsApp. */
export function initialMode(variant: MessengerVariant | undefined): MessengerMode | null {
  return variant?.kind === "saga" || variant?.kind === "urgency" ? null : "whatsapp";
}

/**
 * The card's `message_ref`, minted once the script runs — a server render
 * cannot know it without the hydration seeing another — and again by
 * `renew`, after a messenger lead is posted.
 */
export function useMessageRef(prefix: string | undefined, on: boolean): { ref: string | null; renew: () => void; minted: boolean } {
  const [ref, setRef] = useState<string | null>(null);
  // Without a prefix there is no reference to wait for; with one, nothing is
  // minted on the server — an ISR page is one render for every visitor.
  const [settled, setSettled] = useState(false);
  const valid = on && prefix !== undefined && MESSAGE_REF_PREFIX.test(prefix);
  useEffect(() => {
    if (valid && prefix !== undefined) setRef(newMessageRef(prefix));
    setSettled(true);
  }, [valid, prefix]);
  return { ref, renew: () => (valid && prefix !== undefined ? setRef(newMessageRef(prefix)) : undefined), minted: settled && (!valid || ref !== null) };
}

/** One variant's piece at one place in the card; nothing where it draws nothing. */
export function MessengerSlot({ kit }: { kit: MessengerKit }) {
  if (!drawsAt(kit.shown, kit.at)) return null;
  const Part = PARTS[kit.shown];
  return (
    <Suspense fallback={null}>
      <Part kit={kit} />
    </Suspense>
  );
}

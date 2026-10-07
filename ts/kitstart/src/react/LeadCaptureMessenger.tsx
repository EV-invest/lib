"use client";

import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { MESSAGE_REF_PREFIX, newMessageRef, type MessengerFacts, type MessengerMode, type MessengerVariant } from "../core/messenger";
import type { MessengerAt, MessengerKit, MessengerShown } from "./messenger/types";

type Module = { default: ComponentType<{ kit: MessengerKit }> };

/**
 * The `messenger` variants, each its own chunk: a page pays for the one its
 * arm draws, and the control for none. `LeadCapture` only says where.
 */
const LOAD: Record<MessengerShown, () => Promise<Module>> = {
  select: () => import("./messenger/select"),
  segment: () => import("./messenger/segment"),
  tiles: () => import("./messenger/tiles"),
  thanks: () => import("./messenger/thanks"),
  swap: () => import("./messenger/swap"),
  saga: () => import("./messenger/saga"),
  urgency: () => import("./messenger/urgency"),
  sheet: () => import("./messenger/sheet"),
  chip: () => import("./messenger/chip"),
  split: () => import("./messenger/split"),
  fallback: () => import("./messenger/fallback"),
};

const LOADING = new Map<MessengerShown, Promise<Module>>();
/** The variants whose chunk has arrived, by kind. */
const MODULES = new Map<MessengerShown, Module>();

/** The variant's chunk, asked for once a page. */
function load(kind: MessengerShown): Promise<Module> {
  const known = LOADING.get(kind);
  if (known) return known;
  const loading = LOAD[kind]().then(mod => {
    MODULES.set(kind, mod);
    return mod;
  });
  LOADING.set(kind, loading);
  return loading;
}

const KINDS: readonly MessengerShown[] = ["select", "segment", "tiles", "thanks", "swap", "saga", "urgency", "sheet", "chip", "split", "fallback"];

// On the server every variant is loaded as the module is: a render then finds
// its variant here and writes it into the page whole. One still loading
// renders through `lazy` and streams in behind its boundary, after the shell
// — React reveals such a boundary late, and the card would draw without its
// contact block first.
if (typeof window === "undefined") for (const kind of KINDS) void load(kind).catch(() => undefined);

/** Until its chunk is here, a variant is drawn through `lazy`, behind its boundary. */
const LAZY = new Map(KINDS.map(kind => [kind, lazy(() => load(kind))]));

/** The variant's component: its module's own once it is here, else its lazy stand-in. */
function partOf(kind: MessengerShown): ComponentType<{ kit: MessengerKit }> | null {
  return MODULES.get(kind)?.default ?? LAZY.get(kind) ?? null;
}

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

const noop = () => () => undefined;

/**
 * One variant's piece at one place in the card; nothing where it draws
 * nothing.
 *
 * Drawn by the server, or hydrated, it has no boundary of its own. The server
 * finds the variant loaded (every one is, as this module loads) and writes it
 * into the page whole — a boundary would not do: React writes a large
 * boundary's content apart from the shell and reveals it late, the card drawn
 * without its contact block first. Hydrating, a variant whose chunk is still
 * on its way holds the card's hydration — the server's markup stays as it is,
 * and nothing in the card runs until the chunk is here. A piece first drawn
 * after that (a step, the success) is the browser's own: it waits behind a
 * boundary, its chunk loaded then.
 */
export function MessengerSlot({ kit }: { kit: MessengerKit }) {
  const hydrating = useSyncExternalStore(noop, () => false, () => true);
  // Chosen on the first render: a structure swapped under the slot would draw the variant anew.
  const [wrapped] = useState(() => !hydrating);
  const [Part] = useState(() => partOf(kit.shown));
  if (!drawsAt(kit.shown, kit.at) || !Part) return null;
  return wrapped ? (
    <Suspense fallback={null}>
      <Part kit={kit} />
    </Suspense>
  ) : (
    <Part kit={kit} />
  );
}

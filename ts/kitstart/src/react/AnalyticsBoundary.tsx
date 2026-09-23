"use client";

import { ContactLinkTracker } from "@evinvest/marketing/tracker";
import { usePathname } from "next/navigation.js";
import { useEffect, useMemo, type ReactNode } from "react";
import { analyticsSink, countsAsPageView, EVENTS, type AnalyticsTarget, type IntentChannel } from "../core/analytics";

/** `data-intent` on a link or button marks a conversion intent that is not a contact link. */
const INTENT_ATTR = "data-intent";
const INTENTS: readonly IntentChannel[] = ["form_open", "booking"];

function source(): string {
  const utm = new URLSearchParams(window.location.search).get("utm_source");
  if (utm) return utm.slice(0, 64);
  if (!document.referrer) return "direct";
  try {
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? "internal" : host;
  } catch {
    return "unknown";
  }
}

/**
 * The only client island analytics needs. Everything it wraps stays server
 * rendered; this adds one delegated listener (capture phase, never cancelling
 * the navigation) and a page-view beacon. With no key it sends nothing, and it
 * writes no cookie. `target` is plain data from the server layout — the key
 * is read from the container when the page renders, never inlined.
 */
export function AnalyticsBoundary({ target, placeSlug, children }: { target: AnalyticsTarget; placeSlug: string | null; children: ReactNode }) {
  // On the target's values: a server layout hands a fresh object every render.
  const { key, host, brandId } = target;
  const sink = useMemo(() => analyticsSink({ key, host, brandId }, placeSlug), [key, host, brandId, placeSlug]);
  const pathname = usePathname();

  useEffect(() => {
    if (!countsAsPageView(pathname)) return;
    sink.capture(EVENTS.pageView, {
      source: source(),
      device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    });
  }, [sink, pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = event.target instanceof Element ? event.target.closest(`[${INTENT_ATTR}]`) : null;
      const channel = el?.getAttribute(INTENT_ATTR);
      if (channel && INTENTS.some(i => i === channel)) sink.capture(EVENTS.intent, { channel }, { transport: "beacon" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [sink]);

  return (
    <ContactLinkTracker channels={["phone", "whatsapp"]} onContact={({ channel }) => sink.capture(EVENTS.intent, { channel }, { transport: "beacon" })}>
      {children}
    </ContactLinkTracker>
  );
}

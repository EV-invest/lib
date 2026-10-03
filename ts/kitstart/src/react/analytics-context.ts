"use client";

import type { AnalyticsSink } from "@evinvest/analytics";
import { createContext, useContext } from "react";
import { experimentProps } from "../core/analytics";

/**
 * The sink `AnalyticsBoundary` built, for an island inside it that reports
 * events of its own (`LeadCapture`). Outside a boundary there is none, and the
 * island reports nothing — the same as a boundary with no key.
 */
export const AnalyticsSinkContext = createContext<AnalyticsSink | null>(null);

export const useAnalyticsSink = (): AnalyticsSink | null => useContext(AnalyticsSinkContext);

/**
 * The `distinct_id` the boundary's sink sends, for a lead to carry to the
 * panel. `null` outside a boundary or with no key: no event names it, so a
 * lead has nothing to join.
 */
export const AnalyticsIdContext = createContext<string | null>(null);

export const useAnalyticsId = (): string | null => useContext(AnalyticsIdContext);

/** `data-experiment` / `data-variant` on an element or its ancestors, for an intent's event. */
export function experimentOf(el: Element | null): ReturnType<typeof experimentProps> {
  const host = el?.closest("[data-experiment]");
  return experimentProps(host?.getAttribute("data-experiment"), host?.getAttribute("data-variant"));
}

import { createContext } from "react";
import type { AnalyticsSink } from "../index";

/**
 * The analytics sink context, shared by the provider/hooks (`./react`) and the
 * App Router page-view tracker (`./next/client`).
 *
 * It lives in its own module so both client entries import the **same** context
 * instance — tsup emits it as a shared chunk. If each entry created its own
 * `createContext`, `PostHogPageView` would read a different context than
 * `PostHogProvider` populates and would never see the real sink.
 *
 * `null` is the "no provider mounted" sentinel; consumers fall back to a
 * {@link noopSink} so `capture` is always safe to call.
 */
export const AnalyticsContext = createContext<AnalyticsSink | null>(null);

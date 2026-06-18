"use client";

/**
 * @module @evinvest/analytics/next/client
 *
 * The Next.js App Router page-view tracker — a `"use client"` island that fires
 * `$pageview` on every client-side navigation.
 *
 * **Why it's needed.** The App Router does soft navigations (no full page load),
 * so posthog-js only ever sees the *first* page. {@link PostHogPageView}
 * subscribes to `usePathname` / `useSearchParams` and re-fires `$pageview` on
 * each route change.
 *
 * It captures through the shared analytics context, so mount it **inside**
 * `<PostHogProvider>`. To avoid double-counting the initial view, disable the
 * provider's own initial pageview — let this component own all of them:
 *
 * ```tsx
 * <PostHogProvider capturePageview={false}>
 *   <Suspense fallback={null}><PostHogPageView /></Suspense>
 *   {children}
 * </PostHogProvider>
 * ```
 *
 * `useSearchParams` makes a route Suspense-dependent during static rendering, so
 * wrap `<PostHogPageView />` in a `<Suspense>` boundary.
 */
import { useContext, useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnalyticsContext } from "../react/context";
import { noopSink, type AnalyticsSink, type CaptureFn } from "../index";

/**
 * Fires a `$pageview` on mount and on every subsequent App Router navigation
 * (pathname or query-string change). Renders nothing.
 *
 * Resolves the sink leniently from {@link AnalyticsContext}: if no
 * `PostHogProvider` is mounted it no-ops, so it is always safe to render.
 *
 * @returns `null` — it only runs an effect.
 */
export function PostHogPageView(): null {
  const sink = useContext(AnalyticsContext);
  const capture = useMemo<CaptureFn>(() => {
    const target: AnalyticsSink = sink ?? noopSink();
    return (event, props) => {
      target.capture(event, props);
    };
  }, [sink]);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    // posthog reads $current_url from the live location; pass it explicitly so
    // the URL is correct on soft navigations and in tests. `searchParams` is in
    // the dep list so query-only changes re-fire too.
    const url =
      typeof window !== "undefined" ? window.location.href : pathname;
    capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, capture]);

  return null;
}

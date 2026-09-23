import { AnalyticsBoundary } from "@evinvest/kitstart/react";
import type { ReactNode } from "react";
import { loadPlace } from "@/entities/place/server";
import { serverEnv } from "@/shared/config/env";
import { site } from "@/shared/config/site";

/**
 * Incremental static regeneration. Nothing is prerendered at build — in a
 * sandbox with no network that would bake the fallback into the artefact —
 * so the list is empty: the first request renders a page, the result is
 * cached, and it re-renders in the background after the live data's TTL.
 */
export function generateStaticParams(): { locale: string; location: string }[] {
  return [];
}

/** A literal: Next reads it statically. The place source's TTL. */
export const revalidate = 600;

export default async function PlaceLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string; location: string }> }) {
  const { view } = await loadPlace(params);
  const env = serverEnv();
  // The key is read from the container when the page renders, never inlined.
  return (
    <AnalyticsBoundary target={{ key: env.posthogKey, host: env.posthogHost, brandId: site.brand.id }} placeSlug={view.place.slug}>
      {children}
    </AnalyticsBoundary>
  );
}

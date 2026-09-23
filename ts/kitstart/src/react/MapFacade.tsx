"use client";

import { ClickToLoad } from "@evinvest/marketing/click-to-load";
import { cn } from "@evinvest/uikit";

/**
 * Google's map behind a click. Until the visitor asks, the page holds a button
 * and nothing else — no Google request, no cookie — so a cookieless page stays
 * cookieless and the first load carries no map. The keyless `output=embed`
 * URL needs no API key in the build.
 */
export interface MapFacadeProps {
  /** What Google searches for: the place's GBP name and address. */
  query: string;
  /** The iframe's accessible title. */
  title: string;
  /** The button's call to action. */
  show: string;
  /** The address, printed under the call to action. */
  address: string;
  className?: string;
}

export function MapFacade({ query, title, show, address, className }: MapFacadeProps) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return (
    <ClickToLoad
      className={cn("relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted md:aspect-[21/9]", className)}
      placeholder={load => (
        <button type="button" onClick={load} className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center hover:bg-hover">
          <span className="font-display text-lg font-bold text-ink">{show}</span>
          <span className="text-sm text-ink-soft">{address}</span>
        </button>
      )}
    >
      <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 size-full border-0" />
    </ClickToLoad>
  );
}

"use client";

import { ClickToLoad } from "@evinvest/marketing/click-to-load";
import { cn } from "@evinvest/uikit";
import type { PartClassNames } from "./parts";

export type MapFacadePart = "show" | "address";

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
  classNames?: PartClassNames<MapFacadePart>;
}

export function MapFacade({ query, title, show, address, className, classNames: c }: MapFacadeProps) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return (
    <ClickToLoad
      className={cn("relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted md:aspect-[21/9]", className)}
      placeholder={load => (
        <button type="button" onClick={load} className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center hover:bg-hover">
          <span className={cn("font-display text-lg font-bold text-ink", c?.show)}>{show}</span>
          <span className={cn("text-sm text-ink-soft", c?.address)}>{address}</span>
        </button>
      )}
    >
      <iframe title={title} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 size-full border-0" />
    </ClickToLoad>
  );
}

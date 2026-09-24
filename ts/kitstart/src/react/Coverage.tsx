import { cn } from "@evinvest/uikit";
import type { ReactNode } from "react";
import { servedLocalities, storefrontOf, type Place } from "../core/place/types";
import { AreaChips } from "./AreaChips";
import { MapFacade } from "./MapFacade";
import type { PartClassNames } from "./parts";

export type CoveragePart = "chips" | "landmark" | "map";

/**
 * Where a place works: its communes as chips, and — for a storefront only —
 * its landmark and a map behind a click. A service-area business has no
 * address in its type, so it gets neither, by construction. The band around
 * it (a `Section`, a heading) is the brand's.
 */
export interface CoverageProps<L extends string> {
  place: Place<L>;
  locale: L;
  /** The map button's words; the map is left out when absent. */
  map?: { title: string; show: string };
  /** Anything the brand puts above the chips: its section head. */
  head?: ReactNode;
  className?: string;
  classNames?: PartClassNames<CoveragePart>;
}

export function Coverage<L extends string>({ place, locale, map, head, className, classNames: c }: CoverageProps<L>) {
  const front = storefrontOf(place);
  const address = front && `${front.address.street}, ${front.address.postalCode} ${front.address.locality}`;
  return (
    <div className={cn("flex flex-col gap-6 md:gap-8", className)}>
      {head}
      <AreaChips areas={servedLocalities(place)} {...(c?.chips ? { className: c.chips } : {})} />
      {front?.landmark && <p className={cn("text-sm text-ink-soft", c?.landmark)}>{front.landmark[locale]}</p>}
      {address && map && <MapFacade query={`${place.gbpName}, ${address}`} title={map.title} show={map.show} address={address} {...(c?.map ? { className: c.map } : {})} />}
    </div>
  );
}

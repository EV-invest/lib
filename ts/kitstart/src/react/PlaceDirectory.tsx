import { cn } from "@evinvest/uikit";
import { telHref } from "@evinvest/marketing";
import type { ReactNode } from "react";
import { storefrontOf, type Place } from "../core/place/types";

/**
 * The apex's one job on a `subdomains` site: send the visitor to their place.
 * Each card links to the place's canonical home and carries its phone, so the
 * emergency visitor need not click through at all. A service-area place shows
 * no address.
 */
export interface PlaceDirectoryProps<L extends string> {
  places: readonly Place<L>[];
  locale: L;
  /** Each place's canonical home: `placeUrl(site, slug, locale, "")`. */
  hrefOf: (place: Place<L>) => string;
  /** Each place's phone: `contactOf(site, place).phone`. */
  phoneOf: (place: Place<L>) => string | null;
  /** The link's label: "Open the page". */
  openLabel: string;
  head?: ReactNode;
  id?: string;
  className?: string;
}

export function PlaceDirectory<L extends string>(props: PlaceDirectoryProps<L>) {
  const { places, head, id = "points", className } = props;
  return (
    <div id={id} className={cn("flex flex-col gap-7 md:gap-10", className)}>
      {head}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {places.map(place => (
          <PlaceCard key={place.slug} place={place} {...props} />
        ))}
      </ul>
    </div>
  );
}

function PlaceCard<L extends string>({ place, locale, hrefOf, phoneOf, openLabel }: PlaceDirectoryProps<L> & { place: Place<L> }) {
  const phone = phoneOf(place);
  const front = storefrontOf(place);
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 md:p-7">
      <p className="font-display text-xl font-bold text-ink">{place.name[locale]}</p>
      {front && (
        <address className="text-sm not-italic leading-relaxed text-ink-soft">
          {front.address.street}
          <br />
          {front.address.postalCode} {front.address.locality}
        </address>
      )}
      {phone && (
        <a href={telHref(phone)} className="font-display text-lg font-bold text-primary-ink">
          {phone}
        </a>
      )}
      <a href={hrefOf(place)} className="mt-auto text-sm font-medium text-ink underline-offset-4 hover:underline">
        {openLabel} →
      </a>
    </li>
  );
}

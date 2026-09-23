import { ldCompact, localBusiness, type JsonLdNode } from "@evinvest/marketing";
import { freshRating } from "../place/rating";
import { servedLocalities, storefrontOf, type Place } from "../place/types";
import { placeOrigin, siteOrigin, type PlaceView } from "../place/view";
import { contactOf, type Site } from "../site";

/**
 * schema.org, derived from the site, the place and the page's copy — never
 * authored. One `@graph` per page with shared `@id`s, so Google collapses the
 * entities instead of reading each as separate. Output is pinned against
 * aquafix's goldens in `tests/fixtures/kitstart/json-ld.json`, which the Rust
 * `kitstart` feature reads too.
 *
 * A storefront carries its address, pin and photo; a service-area business
 * has none of the three in its type, so its node says where it goes
 * (`areaServed`) and nothing about where it is. No `aggregateRating` from
 * anything baked: only a live rating inside the API's 30-day window.
 */

/** One row of a price list, as the page's table prints it. */
export interface OfferInput {
  name: string;
  /** Whole currency units, the same integer the table cell renders. */
  price: number;
  /** ISO 4217; `EUR` when left out. */
  currency?: string;
}

export interface QuestionAnswer {
  q: string;
  a: string;
}

/** The words one page's graph quotes. */
export interface PageGraphCopy {
  /** The short place name the copy uses: "Royat". */
  placeName: string;
  title: string;
  description: string;
  /** Emitted only where the page renders the price list. */
  offers?: readonly OfferInput[];
  /** Emitted only where the page renders the FAQ. */
  faq?: readonly QuestionAnswer[];
}

const origin = (o: string | null): string => o ?? "";

export const organizationId = <L extends string, P extends string>(site: Site<L, P>): string => `${origin(siteOrigin(site))}/#organization`;
// Language-free: the French and the English page describe one business.
export const businessId = <L extends string, P extends string>(site: Site<L, P>, slug: string): string => `${origin(placeOrigin(site, slug))}/#business`;
export const websiteId = <L extends string, P extends string>(site: Site<L, P>, slug: string): string => `${origin(placeOrigin(site, slug))}/#website`;

export function organizationNode<L extends string, P extends string>(site: Site<L, P>): JsonLdNode {
  return ldCompact({
    "@type": "Organization",
    "@id": organizationId(site),
    name: site.brand.name,
    legalName: site.brand.legalName,
    url: siteOrigin(site),
    email: site.brand.email,
  });
}

function days(place: Place<string>): JsonLdNode[] | undefined {
  return place.hours?.map(h => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: h.days,
    opens: h.opens,
    closes: h.closes,
  }));
}

/** Named communes as `Place`s, a radius as a `GeoCircle`. */
export function areaServedNodes(place: Place<string>): JsonLdNode[] {
  const named: JsonLdNode[] = servedLocalities(place).map(name => ({ "@type": "Place", name }));
  const circles: JsonLdNode[] = (place.serviceArea ?? []).flatMap(area =>
    area.kind === "radius"
      ? [
          {
            "@type": "GeoCircle",
            geoMidpoint: { "@type": "GeoCoordinates", latitude: area.center.lat, longitude: area.center.lng },
            geoRadius: area.km * 1000,
          },
        ]
      : [],
  );
  return [...named, ...circles];
}

/** The business behind one place. */
export function businessNode<L extends string, P extends string>(site: Site<L, P>, view: PlaceView<L>, now: Date): JsonLdNode {
  const { place } = view;
  const front = storefrontOf(place);
  const rating = freshRating(place, now);
  return localBusiness(
    {
      id: businessId(site, place.slug),
      type: site.brand.businessType,
      name: place.gbpName,
      url: view.url(site.pages.home),
      telephone: contactOf(site, place).phone ?? undefined,
      email: site.brand.email ?? undefined,
      image: front?.storefrontPhoto ?? undefined,
      address: front
        ? {
            streetAddress: front.address.street,
            postalCode: front.address.postalCode,
            addressLocality: front.address.locality,
            addressRegion: front.address.region,
            addressCountry: front.address.country,
          }
        : undefined,
      geo: front?.geo ?? undefined,
      parentOrganization: { "@id": organizationId(site) },
    },
    ldCompact({
      priceRange: site.brand.priceRange,
      areaServed: areaServedNodes(place),
      openingHoursSpecification: days(place),
      aggregateRating: rating
        ? { "@type": "AggregateRating", ratingValue: rating.value, reviewCount: rating.count, bestRating: 5 }
        : undefined,
    }),
  );
}

/** The town an offer is priced for: a storefront's own, or the first commune served. */
function cityOf(place: Place<string>): JsonLdNode | undefined {
  const name = storefrontOf(place)?.address.locality ?? servedLocalities(place)[0];
  return name === undefined ? undefined : { "@type": "City", name };
}

/** One `Service` + `Offer` per price row: the same integer as the table cell, tax included. */
export function offerNodes<L extends string, P extends string>(site: Site<L, P>, place: Place<L>, offers: readonly OfferInput[]): JsonLdNode[] {
  return offers.map(row => {
    const currency = row.currency ?? "EUR";
    return ldCompact({
      "@type": "Service",
      name: row.name,
      serviceType: row.name,
      provider: { "@id": businessId(site, place.slug) },
      areaServed: cityOf(place),
      offers: {
        "@type": "Offer",
        price: row.price,
        priceCurrency: currency,
        availability: "https://schema.org/InStock",
        priceSpecification: {
          "@type": "PriceSpecification",
          minPrice: row.price,
          priceCurrency: currency,
          valueAddedTaxIncluded: true,
        },
      },
    });
  });
}

export function faqPageNode(items: readonly QuestionAnswer[]): JsonLdNode {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(item => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Home → page. The chain is the route, so a new page cannot forget it. */
export function breadcrumbNode<L extends string, P extends string>(
  site: Site<L, P>,
  view: PlaceView<L>,
  page: P | "home",
  copy: Pick<PageGraphCopy, "placeName" | "title">,
): JsonLdNode {
  const items: JsonLdNode[] = [
    { "@type": "ListItem", position: 1, name: `${site.brand.name} ${copy.placeName}`, item: view.url(site.pages.home) },
  ];
  if (page !== "home") {
    items.push({ "@type": "ListItem", position: 2, name: copy.title, item: view.url(site.pages[page]) });
  }
  return { "@type": "BreadcrumbList", itemListElement: items };
}

/** The `@graph` for one of a place's pages in one language. */
export function placeGraph<L extends string, P extends string>(
  site: Site<L, P>,
  view: PlaceView<L>,
  page: P | "home",
  copy: PageGraphCopy,
  now: Date,
): JsonLdNode {
  const { place } = view;
  const url = view.url(site.pages[page]);
  const nodes: JsonLdNode[] = [
    organizationNode(site),
    businessNode(site, view, now),
    {
      "@type": "WebSite",
      "@id": websiteId(site, place.slug),
      url: origin(placeOrigin(site, place.slug)),
      name: `${site.brand.name} ${copy.placeName}`,
    },
    {
      "@type": "WebPage",
      "@id": `${url}#page`,
      url,
      name: copy.title,
      description: copy.description,
      inLanguage: site.i18n.hreflangOf(view.locale),
      isPartOf: { "@id": websiteId(site, place.slug) },
      about: { "@id": businessId(site, place.slug) },
    },
    breadcrumbNode(site, view, page, copy),
  ];
  if (copy.offers && copy.offers.length > 0) nodes.push(...offerNodes(site, place, copy.offers));
  if (copy.faq && copy.faq.length > 0) nodes.push(faqPageNode(copy.faq));
  return { "@context": "https://schema.org", "@graph": nodes };
}

// schema.org JSON-LD primitives for a local-business page. Generic on purpose:
// the site (its organisation node, its `@id` scheme, where a location's facts
// come from) is composed by the app. What lives here is only what every
// location page emits identically — and emitting it identically matters:
// inconsistent NAP (name/address/phone) across one site is a well-known
// local-SEO penalty, and duplicating the builder per page is how it starts.

export type JsonLdNode = Record<string, unknown>;

/**
 * Drop `undefined` / `null` / empty-string / empty-array values so optional
 * facts (a phone not on file, no geo yet) never emit blank schema fields.
 * Shallow by design — call it on each node as you build it.
 */
export function ldCompact<T extends JsonLdNode>(node: T): T {
  const out: JsonLdNode = {};
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as T;
}

export interface PostalAddressInput {
  streetAddress?: string | undefined;
  addressLocality?: string | undefined;
  addressRegion?: string | undefined;
  postalCode?: string | undefined;
  /** ISO 3166-1 alpha-2, e.g. `"FR"`. */
  addressCountry?: string | undefined;
}

export function postalAddress(address: PostalAddressInput): JsonLdNode {
  return ldCompact({ "@type": "PostalAddress", ...address });
}

export interface GeoInput {
  lat: number;
  lng: number;
}

export function geoCoordinates({ lat, lng }: GeoInput): JsonLdNode {
  return { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
}

export interface LocalBusinessInput {
  /** Absolute `@id`, stable across every page that lists this location. */
  id?: string | undefined;
  /** A `LocalBusiness` subtype (`"Plumber"`, `"Store"`…). */
  type?: string | undefined;
  name: string;
  /** Absolute URL — schema.org rejects relative ones. */
  url?: string | undefined;
  telephone?: string | undefined;
  email?: string | undefined;
  /** Absolute image URL, or an `{ "@id": … }` reference to one. */
  image?: string | JsonLdNode | undefined;
  address?: PostalAddressInput | undefined;
  geo?: GeoInput | undefined;
  /** Usually `{ "@id": ORG_ID }` — folds every location into one brand. */
  parentOrganization?: JsonLdNode | undefined;
  /** Profiles of the same place (Google Business Profile, socials). */
  sameAs?: readonly string[] | undefined;
}

/**
 * A `LocalBusiness` node. Anything schema.org allows beyond the fields above
 * (opening hours, price range, aggregate rating) is spread in by the caller —
 * those are live facts from the app's data, not layout.
 */
export function localBusiness(
  input: LocalBusinessInput,
  extra: JsonLdNode = {},
): JsonLdNode {
  const { id, type = "LocalBusiness", address, geo, ...rest } = input;
  return ldCompact({
    "@type": type,
    "@id": id,
    ...rest,
    address: address ? postalAddress(address) : undefined,
    geo: geo ? geoCoordinates(geo) : undefined,
    ...extra,
  });
}

/** Renders a JSON-LD graph as a `<script>`. Server Component — no hooks. */
export function JsonLd({ data }: { data: JsonLdNode | readonly JsonLdNode[] }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so no string value can close the <script> element early —
      // the documented Next.js JSON-LD pattern. Values come from translators
      // and databases, so this is not hypothetical.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

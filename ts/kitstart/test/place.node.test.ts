import { describe, expect, it } from "vitest";
import {
  businessNode,
  createPlaceView,
  freshRating,
  isPublished,
  mergeLive,
  parsePlaceLive,
  placeUrl,
  publicationGaps,
  servedLocalities,
  SERVICE_AREA_GATE,
  STOREFRONT_GATE,
  type Place,
} from "../src/index";
import { fixtureSite, viaJson } from "./support/fixtures";

const NOW = new Date("2026-09-23T12:00:00Z");
const aquafix = fixtureSite("aquafix");
const cleaning = fixtureSite("cleaning");

const royat = (over: Partial<Place<"fr" | "en">> = {}): Place<"fr" | "en"> => {
  const baked = aquafix.places[0];
  if (!baked) throw new Error("fixture: no royat");
  return { ...baked, ...over };
};

/** A business with no front: it goes to the customer, and says where. */
const sab = (over: Partial<Place<"fr" | "en">> = {}): Place<"fr" | "en"> => ({
  slug: "royat",
  gbpName: "Aquafix Service",
  name: { fr: "Royat", en: "Royat" },
  presence: { kind: "service-area" },
  serviceArea: [
    { kind: "localities", names: ["Royat", "Ceyrat"] },
    { kind: "radius", center: { lat: 45.77, lng: 3.05 }, km: 15 },
  ],
  channels: { phone: null, whatsapp: null },
  hours: [{ days: ["Monday"], opens: "08:00", closes: "18:00" }],
  rating: null,
  ...over,
});

describe("the publication gate as a policy", () => {
  it("asks a storefront for its front and a service area only for its zone and hours", () => {
    expect(publicationGaps(sab(), STOREFRONT_GATE)).toEqual(["storefrontPhoto", "landmark"]);
    expect(publicationGaps(sab(), SERVICE_AREA_GATE)).toEqual([]);
    expect(publicationGaps(sab({ hours: null }), SERVICE_AREA_GATE)).toEqual(["hours"]);
    expect(publicationGaps(royat(), STOREFRONT_GATE)).toEqual(["storefrontPhoto", "landmark", "serviceArea", "hours"]);
  });

  it("publishes nothing on a site without a domain", () => {
    expect(isPublished(sab(), SERVICE_AREA_GATE, { domain: "example.fr" })).toBe(true);
    expect(isPublished(sab(), SERVICE_AREA_GATE, { domain: null })).toBe(false);
  });

  it("wants a landmark in every language, none of them blank", () => {
    const front = royat().presence;
    if (front.kind !== "storefront") throw new Error("fixture");
    const blank = royat({ presence: { ...front, landmark: { fr: "Place", en: " " } } });
    expect(publicationGaps(blank, STOREFRONT_GATE)).toContain("landmark");
    const empty = royat({ presence: { ...front, landmark: {} as Record<"fr" | "en", string> } });
    expect(publicationGaps(empty, STOREFRONT_GATE)).toContain("landmark");
  });
});

describe("a service-area business in schema.org", () => {
  const node = viaJson(businessNode(aquafix, createPlaceView(aquafix, sab(), "fr", "host"), NOW));

  it("has no address, pin or photo", () => {
    expect(node).not.toHaveProperty("address");
    expect(node).not.toHaveProperty("geo");
    expect(node).not.toHaveProperty("image");
  });

  it("says where it goes: its communes and its radius", () => {
    expect(node).toMatchObject({
      areaServed: [
        { "@type": "City", name: "Royat" },
        { "@type": "City", name: "Ceyrat" },
        { "@type": "GeoCircle", geoMidpoint: { "@type": "GeoCoordinates", latitude: 45.77, longitude: 3.05 }, geoRadius: 15000 },
      ],
    });
  });

  it("has no telephone or email when the brand has none", () => {
    const place = cleaning.places[0];
    if (!place) throw new Error("fixture");
    const own = viaJson(businessNode(cleaning, createPlaceView(cleaning, place, "fr", "host"), NOW));
    expect(own).not.toHaveProperty("telephone");
    expect(own).not.toHaveProperty("email");
    expect(own).toMatchObject({ "@id": "https://clean.example/#business", url: "https://clean.example/fr" });
  });
});

describe("where a place's canonical URL lives", () => {
  it("is the subdomain on a subdomains site, whatever served the request", () => {
    expect(createPlaceView(aquafix, royat(), "en", "path").url("/prices")).toBe("https://royat.aquafix.top/en/prices");
    expect(createPlaceView(aquafix, royat(), "en", "path").href("/prices")).toBe("/en/royat/prices");
    expect(createPlaceView(aquafix, royat(), "en", "host").href("#quote")).toBe("/en#quote");
  });

  it("is the apex on a single site", () => {
    expect(placeUrl(cleaning, "paris", "fr", "/prices")).toBe("https://clean.example/fr/prices");
  });

  it("is the served path when the site has no domain yet", () => {
    const bare = { ...cleaning, brand: { ...cleaning.brand, domain: null } };
    expect(placeUrl(bare, "paris", "fr", "")).toBe("/fr");
    const apex = { ...aquafix, brand: { ...aquafix.brand, domain: null } };
    expect(placeUrl(apex, "royat", "fr", "/prices")).toBe("/fr/royat/prices");
  });
});

describe("the live overlay", () => {
  it("keeps what validates and drops what does not", () => {
    const live = parsePlaceLive(
      {
        phone: "+33 4 00 00 00 00",
        whatsapp: "06 12 34 56 78", // national: cannot become wa.me, dropped
        storefrontPhoto: "http://insecure.example/x.jpg", // not https, dropped
        hours: [{ days: ["Monday"], opens: "07:00", closes: "21:00" }],
        serviceArea: ["Royat", 3, "Ceyrat"],
        rating: { value: 9, count: 1, fetchedAt: "2026-09-20" }, // out of range, dropped
        address: { street: "1 Rue X", postalCode: "6313", locality: "Royat" }, // bad CP, dropped
      },
      ["fr", "en"],
    );
    expect(live).toEqual({
      phone: "+33 4 00 00 00 00",
      hours: [{ days: ["Monday"], opens: "07:00", closes: "21:00" }],
      serviceArea: [{ kind: "localities", names: ["Royat", "Ceyrat"] }],
    });
  });

  const live = parsePlaceLive(
    {
      address: { street: "1 Rue X", postalCode: "63130", locality: "Royat" },
      geo: { lat: 1, lng: 2 },
      storefrontPhoto: "https://cdn.example/x.jpg",
      phone: "+33 4 22 22 22 22",
    },
    ["fr", "en"],
  );

  it("never gives a service-area place a front", () => {
    const merged = mergeLive(sab(), live);
    expect(merged.presence).toEqual({ kind: "service-area" });
    expect(merged.channels.phone).toBe("+33 4 22 22 22 22");
  });

  it("merges a storefront's fields", () => {
    expect(mergeLive(royat(), live).presence).toMatchObject({
      kind: "storefront",
      address: { street: "1 Rue X", postalCode: "63130", locality: "Royat", country: "FR" },
      geo: { lat: 1, lng: 2 },
      storefrontPhoto: "https://cdn.example/x.jpg",
    });
  });

  it("takes a landmark only in every language", () => {
    expect(parsePlaceLive({ landmark: { fr: "Ici" } }, ["fr", "en"])).toEqual({});
    expect(parsePlaceLive({ landmark: { fr: "Ici", en: "Here" } }, ["fr", "en"])).toEqual({ landmark: { fr: "Ici", en: "Here" } });
  });

  it("refuses a body that is not an object", () => {
    expect(() => parsePlaceLive([], ["fr"])).toThrow(/not an object/);
  });
});

describe("the rating", () => {
  const rated = (fetchedAt: string) => royat({ rating: { value: 4.7, count: 31, fetchedAt } });
  it("is shown only inside the API's 30-day window", () => {
    expect(freshRating(rated("2026-09-20T00:00:00Z"), NOW)).not.toBeNull();
    expect(freshRating(rated("2026-08-01T00:00:00Z"), NOW)).toBeNull();
    expect(freshRating(rated("2026-10-01T00:00:00Z"), NOW)).toBeNull();
    expect(freshRating(rated("not a date"), NOW)).toBeNull();
  });
});

describe("served localities", () => {
  it("is a storefront's own town until the zone is named", () => {
    expect(servedLocalities(royat())).toEqual(["Royat"]);
    expect(servedLocalities(sab())).toEqual(["Royat", "Ceyrat"]);
  });
});

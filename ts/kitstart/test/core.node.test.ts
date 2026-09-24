import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsSink,
  countsAsPageView,
  createLocaleRegistry,
  defineSite,
  EVENTS,
  goneHeader,
  gonePath,
  parseGoneHeader,
  ogImageUrl,
  ogLocaleOf,
  parsePlaceParam,
  perLocale,
  placeParam,
  pointSuffixes,
  robotsFor,
  sitemapFor,
  STOREFRONT_GATE,
} from "../src/index";
import { memoByKey } from "../src/core/memo";
import { fixtureSite } from "./support/fixtures";

afterEach(() => vi.unstubAllGlobals());

const aquafix = fixtureSite("aquafix");

describe("the site composition root", () => {
  it("lists the pages in declaration order", () => {
    expect(aquafix.pageKeys).toEqual(["home", "prices", "guarantee", "about"]);
    expect(pointSuffixes(aquafix)).toEqual(["", "/prices", "/guarantee", "/about", "/thanks"]);
  });

  const base = {
    brand: aquafix.brand,
    i18n: createLocaleRegistry({ locales: ["fr"], labels: { fr: "Français" }, default: "fr" }),
    topology: { kind: "subdomains", apex: "directory" } as const,
    pages: { home: "" } as const,
    publication: STOREFRONT_GATE,
    lead: { subjects: [], wire: { subject: "a", locality: "b", mobile: "c" } },
  };
  const place = aquafix.places[0];
  if (!place) throw new Error("fixture");

  it("refuses a slug twice, a slug the route param would misread, and a single place it does not have", () => {
    expect(() => defineSite({ ...base, places: [place, place] })).toThrow(/twice/);
    expect(() => defineSite({ ...base, places: [{ ...place, slug: "_royat" }] })).toThrow(/must be/);
    expect(() => defineSite({ ...base, places: [place], topology: { kind: "single", place: "paris" } })).toThrow(/not one of/);
  });

  it("gives one value per locale, and og:locale from the config or the hreflang", () => {
    expect(perLocale(aquafix, l => l.toUpperCase())).toEqual({ fr: "FR", en: "EN" });
    expect(ogLocaleOf(aquafix, "en")).toBe("en_GB");
    const derived = { i18n: aquafix.i18n };
    expect(ogLocaleOf(derived, "fr")).toBe("fr_FR");
    expect(ogLocaleOf(derived, "en")).toBe("en");
  });
});

describe("the link mode in the route param", () => {
  it("round-trips both modes", () => {
    expect(placeParam("royat", "host")).toBe("_royat");
    expect(parsePlaceParam("_royat")).toEqual({ slug: "royat", mode: "host" });
    expect(parsePlaceParam("royat")).toEqual({ slug: "royat", mode: "path" });
  });
});

describe("a site with no domain yet", () => {
  const bare = { ...fixtureSite("cleaning"), brand: { ...fixtureSite("cleaning").brand, domain: null } };
  it("lists nothing and lets no crawler in", () => {
    expect(sitemapFor(bare, "localhost:3000", bare.places)).toEqual([]);
    expect(robotsFor(bare, "localhost:3000")).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });
});

describe("the OG card URL", () => {
  it("is on the apex", () => {
    expect(ogImageUrl(aquafix, { slug: "royat", locale: "en", page: "prices" })).toBe("https://aquafix.top/og?lang=en&l=royat&p=prices");
    expect(ogImageUrl(aquafix, { locale: "fr" })).toBe("https://aquafix.top/og?lang=fr");
  });
});

describe("the event model", () => {
  const target = { key: null, host: "https://eu.i.posthog.com", brandId: "aquafix" };
  it("refuses a customer's phone as a property in development", () => {
    const sink = analyticsSink(target, "royat");
    expect(() => sink.capture(EVENTS.leadSubmit, { form_id: "quote", phone: "+33 6 12 34 56 78" })).toThrow();
    expect(() => sink.capture(EVENTS.intent, { channel: "phone" })).not.toThrow();
  });

  it("beacons with the brand and the place mixed in, and nothing without a key", () => {
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    analyticsSink(target, "royat").capture(EVENTS.intent, { channel: "phone" });
    expect(beacon).not.toHaveBeenCalled();
    analyticsSink({ ...target, key: "phc_test" }, "royat").capture(EVENTS.intent, { channel: "whatsapp" });
    const [url, body] = beacon.mock.calls[0] ?? [];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    expect(JSON.parse(body ?? "null")).toMatchObject({ event: "contact_intent_click", properties: { brand_id: "aquafix", location_id: "royat", channel: "whatsapp" } });
  });

  it("does not count the thank-you page as a page view, in either link mode", () => {
    expect(countsAsPageView("/fr/thanks")).toBe(false);
    expect(countsAsPageView("/en/royat/thanks/")).toBe(false);
    expect(countsAsPageView("/fr/_royat")).toBe(true);
  });
});

describe("memoByKey", () => {
  it("computes each key once, concurrent first callers included, and forgets a failure", async () => {
    const draw = vi.fn(async (key: string) => `card:${key}`);
    const card = memoByKey(draw);
    expect(await Promise.all([card("a"), card("a"), card("b")])).toEqual(["card:a", "card:a", "card:b"]);
    expect(draw).toHaveBeenCalledTimes(2);
    let calls = 0;
    const flaky = memoByKey(async () => {
      calls += 1;
      if (calls === 1) throw new Error("font missing");
      return "ok";
    });
    await expect(flaky("k")).rejects.toThrow();
    expect(await flaky("k")).toBe("ok");
  });
});

describe("the core's promise", () => {
  // eslint enforces this on the sources; this reads the source tree too, so a
  // lint config that stopped matching the files would not pass silently.
  it("imports no React, Next or node:* anywhere under src/core", () => {
    const root = join(import.meta.dirname, "../src/core");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" }).filter(f => /\.tsx?$/.test(f));
    const bad = files.filter(f => /from\s+["'](node:|next|react|server-only)/.test(readFileSync(join(root, f), "utf8")));
    expect(bad).toEqual([]);
  });
});

describe("defineSite's reserved shapes", () => {
  const site = fixtureSite("cleaning");
  it("refuses a page suffix with a trailing slash, and the 404 slug", () => {
    expect(() => defineSite({ ...site, pages: { home: "", prices: "/prices/" } })).toThrow(/must not end/);
    const place = site.places[0];
    if (!place) throw new Error("fixture");
    expect(() => defineSite({ ...site, places: [{ ...place, slug: "404" }], topology: { kind: "single", place: "404" } })).toThrow(/reserved/);
  });

  it("takes public files only as root paths outside any language", () => {
    for (const file of ["icon.svg", "/assets/", "/_next/x.js", "/fr/icon.svg"]) {
      expect(() => defineSite({ ...site, publicFiles: [file] }), file).toThrow(/public file/);
    }
    expect(() => defineSite({ ...site, publicFiles: ["/icon.svg", "/fonts/inter.woff2"] })).not.toThrow();
  });
});

describe("the gone header", () => {
  it("round-trips, and reads anything malformed as nothing", () => {
    expect(parseGoneHeader(goneHeader("fr", "_royat"))).toEqual({ locale: "fr", location: "_royat" });
    expect(parseGoneHeader(goneHeader("en", null))).toEqual({ locale: "en" });
    expect(parseGoneHeader(null)).toEqual({});
    expect(parseGoneHeader("fr/a/b")).toEqual({});
    expect(gonePath("fr")).toBe("/fr/404/404");
  });
});

import { describe, expect, it } from "vitest";
import {
  createPlaceView,
  createRouting,
  placeGraph,
  robotsFor,
  sitemapFor,
  type Decision,
  type LinkMode,
  type OfferInput,
  type Place,
  type QuestionAnswer,
} from "../src/index";
import { fixture, fixtureSite } from "./support/fixtures";

/**
 * The fixtures in `tests/fixtures/kitstart/` pin what a crawler reads — the
 * expected values are aquafix's goldens verbatim — and the Rust `kitstart`
 * feature runs the same files. Compared as serialised text, so key order is
 * pinned too: the goldens are byte-for-byte.
 */
const text = (value: unknown): string => JSON.stringify(value, null, 2);

type Locale = "fr" | "en";

interface LdCase {
  name: string;
  site: string;
  place: Place<Locale>;
  locale: Locale;
  page: string;
  mode: LinkMode;
  copy: { placeName: string; title: string; description: string; offers: OfferInput[]; faq: QuestionAnswer[] };
  expected: unknown;
}

describe("JSON-LD against aquafix's goldens", () => {
  const { now, cases } = fixture<{ now: string; cases: LdCase[] }>("json-ld.json");
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    const site = fixtureSite(c.site);
    const page = site.pageKeys.find(k => k === c.page);
    if (!page) throw new Error(`no page ${c.page}`);
    const view = createPlaceView(site, c.place, c.locale, c.mode);
    expect(text(placeGraph(site, view, page, c.copy, new Date(now)))).toBe(text(c.expected));
  });
});

interface SitemapCase {
  name: string;
  site: string;
  host: string;
  places: Place<Locale>[];
  expected: { sitemap: unknown; robots: unknown };
}

describe("sitemap and robots against aquafix's goldens", () => {
  const { cases } = fixture<{ cases: SitemapCase[] }>("sitemap.json");
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    const site = fixtureSite(c.site);
    expect(text(sitemapFor(site, c.host, c.places))).toBe(text(c.expected.sitemap));
    expect(text(robotsFor(site, c.host))).toBe(text(c.expected.robots));
  });
});

interface DecideCase {
  name: string;
  site: string;
  request: { host: string; pathname: string; query: string; acceptLanguage: string | null; cookieLang: string | null };
  decision: Decision<Locale>;
}

describe("routing decisions", () => {
  const { cases } = fixture<{ cases: DecideCase[] }>("decide.json");
  it.each(cases.map(c => [`${c.site}: ${c.name}`, c] as const))("%s", (_, c) => {
    const routing = createRouting(fixtureSite(c.site));
    const decision = routing.decide({ ...c.request, query: new URLSearchParams(c.request.query) });
    expect(decision).toEqual(c.decision);
  });
});

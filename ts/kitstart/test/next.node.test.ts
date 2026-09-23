import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlaceView, statusTarget, type Lead, type LeadStore, type Place } from "../src/index";
import { brandMetadata, createPlaceLoader, healthRoute, ogRoute, placeMetadata, quoteRoute, statusMetadata } from "../src/next/index";
import { buildEnv, withLanding } from "../src/next/config/index";
import { createProxy, PROXY_MATCHER } from "../src/proxy/index";
import { createPlaceSource } from "../src/server/index";
import { fixture, fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const text = (value: unknown): string => JSON.stringify(value, null, 2);
type Locale = "fr" | "en";

afterEach(() => vi.unstubAllGlobals());

interface MetaCase {
  name: string;
  kind: "place" | "brand" | "status";
  place?: Place<Locale>;
  locale?: Locale;
  page?: string;
  mode?: "host" | "path";
  copy: { title: string; description?: string };
  expected: unknown;
}

describe("<head> metadata against aquafix's goldens", () => {
  const { cases } = fixture<{ cases: MetaCase[] }>("metadata.json");
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    const description = c.copy.description ?? "";
    if (c.kind === "status") return expect(text(statusMetadata(site, c.copy.title))).toBe(text(c.expected));
    if (!c.locale) throw new Error("case has no locale");
    if (c.kind === "brand") return expect(text(brandMetadata(site, c.locale, { title: c.copy.title, description }))).toBe(text(c.expected));
    const page = site.pageKeys.find(k => k === c.page);
    if (!c.place || !page || !c.mode) throw new Error("incomplete place case");
    const view = createPlaceView(site, c.place, c.locale, c.mode);
    expect(text(placeMetadata(site, view, page, { title: c.copy.title, description }))).toBe(text(c.expected));
  });
});

describe("the proxy", () => {
  const proxy = createProxy(site);
  const request = (url: string, headers: Record<string, string> = {}) => new NextRequest(new URL(url), { headers });

  it("answers the bare URL with a 302 that varies on the language inputs", () => {
    const res = proxy(request("https://aquafix.top/"));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location") ?? "").pathname).toBe("/fr");
    expect(res.headers.get("vary")).toContain("Accept-Language");
  });

  it("mints the language cookie for a year on ?lang=", () => {
    const res = proxy(request("https://royat.aquafix.top/fr/prices?lang=en", { host: "royat.aquafix.top" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("set-cookie")).toMatch(/^lang=en;.*Max-Age=31536000/);
  });

  it("answers an old apex URL with a 301", () => {
    expect(proxy(request("https://aquafix.top/fr/prices")).status).toBe(301);
  });

  it("rewrites a subdomain to the host-mode route and hands the page nothing but the path", () => {
    const res = proxy(request("https://royat.aquafix.top/fr/prices", { host: "royat.aquafix.top", "x-aquafix-link-mode": "path" }));
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/fr/_royat/prices");
    expect(res.headers.get("x-middleware-override-headers")).toBeNull();
  });

  it("publishes the matcher a brand's proxy.ts spells out", () => {
    expect(new RegExp(`^${PROXY_MATCHER}$`).test("/fr/prices")).toBe(true);
    expect(new RegExp(`^${PROXY_MATCHER}$`).test("/_next/static/x.js")).toBe(false);
  });
});

describe("status targets from route params", () => {
  it("answers for the place the param names, in its link mode", () => {
    expect(statusTarget(site, { locale: "en", location: "_royat" })).toMatchObject({
      locale: "en",
      phone: "+33 4 23 50 06 40",
      home: "/en",
      langHrefs: { fr: "/fr", en: "/en" },
    });
    expect(statusTarget(site, { locale: "fr", location: "royat" })).toMatchObject({ home: "/fr/royat", langHrefs: { en: "/en/royat" } });
    expect(statusTarget(site, { locale: "fr", location: "royat" }, { thanks: true }).langHrefs).toEqual({ fr: "/fr/royat/thanks", en: "/en/royat/thanks" });
  });

  it("falls back to the brand and the default locale", () => {
    expect(statusTarget(site, {})).toMatchObject({ locale: "fr", place: null, home: "/fr", retry: "/fr" });
    expect(statusTarget(site, { locale: "xx", location: "_paris" })).toMatchObject({ locale: "fr", place: null });
  });
});

describe("the place loader", () => {
  const load = createPlaceLoader(site, createPlaceSource(site, { baseUrl: () => null }));

  it("reads the link mode out of the param", async () => {
    expect((await load({ locale: "fr", location: "_royat" })).href("/prices")).toBe("/fr/prices");
    expect((await load(Promise.resolve({ locale: "en", location: "royat" }))).href("/prices")).toBe("/en/royat/prices");
  });

  it("is a 404 for an unknown language or place", async () => {
    await expect(load({ locale: "de", location: "royat" })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    await expect(load({ locale: "fr", location: "_paris" })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe("the quote route", () => {
  const NOW = 1_800_000_000_000;
  const post = (fields: Record<string, string>, host = "royat.aquafix.top") => {
    const body = new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", job: "other", zip: "63130", mobile: "0612345678", ...fields });
    return new Request("https://aquafix.top/quote", { method: "POST", body, headers: { host, "content-type": "application/x-www-form-urlencoded" } });
  };
  const memory = (fail = false): LeadStore & { rows: Lead[] } => {
    const rows: Lead[] = [];
    return {
      rows,
      insert: async lead => {
        if (fail) throw new Error("disk full");
        return rows.push(lead);
      },
      count: async () => rows.length,
      schemaVersion: async () => 4,
      health: async () => undefined,
      close: async () => undefined,
    };
  };
  const route = (store: LeadStore, log = { warn: vi.fn(), error: vi.fn() }) =>
    quoteRoute(site, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "https://eu.i.posthog.com" }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: locale => ({ title: `500 ${locale}`, heading: "Oops <b>", body: "Call us", callLabel: "Call" }),
      store: () => store,
      defer: () => undefined,
      now: () => NOW,
      log,
    });

  it("stores the lead and answers 303 to the place's thank-you page on the host it came from", async () => {
    const store = memory();
    const res = await route(store)(post({}));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr/thanks");
    expect(store.rows).toHaveLength(1);
    expect((await route(memory())(post({}, "aquafix.top"))).headers.get("location")).toBe("/fr/royat/thanks");
  });

  it("sends an invalid lead back to the form, and a lead with no place to the brand", async () => {
    const res = await quoteRoute({ ...site, lead: { ...site.lead, validate: () => "no" } }, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "x" }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => memory(),
      log: { warn: vi.fn(), error: vi.fn() },
    })(post({}));
    expect(res.headers.get("location")).toBe("/fr#quote");
    expect((await route(memory())(post({ location: "paris" }))).headers.get("location")).toBe("/fr/thanks");
  });

  it("answers a self-contained, escaped 500 with the phone when the store refuses", async () => {
    const res = await route(memory(true))(post({}));
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain('href="tel:+33423500640"');
    expect(html).toContain("Oops &lt;b&gt;");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("refuses an oversized body and a body that is not a form", async () => {
    const big = new Request("https://aquafix.top/quote", { method: "POST", body: "x", headers: { "content-length": String(1 << 20) } });
    expect((await route(memory())(big)).status).toBe(413);
    const junk = new Request("https://aquafix.top/quote", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect((await route(memory())(junk)).status).toBe(400);
  });
});

describe("the OG route", () => {
  it("normalises the query to the closed set and draws each card once", async () => {
    const draw = vi.fn(() => ({ type: "div", props: { style: { display: "flex" }, children: "x" }, key: null }));
    const og = ogRoute(site, { draw, fonts: async () => [] });
    const first = await og(new Request("https://aquafix.top/og?l=royat&lang=en&p=prices"));
    expect(first.headers.get("content-type")).toBe("image/png");
    await og(new Request("https://aquafix.top/og?l=royat&lang=en&p=prices"));
    await og(new Request("https://aquafix.top/og?l=nowhere&lang=xx&p=nope"));
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw).toHaveBeenLastCalledWith({ locale: "fr", place: null, page: "home" });
  });
});

describe("health", () => {
  it("answers ok, or 503 when the brand's check fails", async () => {
    expect((await healthRoute()()).status).toBe(200);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await healthRoute(async () => Promise.reject(new Error("db")))()).status).toBe(503);
  });
});

describe("withLanding", () => {
  const root = mkdtempSync(join(tmpdir(), "kitstart-brand-"));
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets/card.toml"), 'email = "hi@clean.example"\n');
  writeFileSync(join(root, "assets/mark.svg"), '<svg><path d="M0 0h1v1z"/></svg>');
  writeFileSync(join(root, "assets/brand.toml"), '[colors.dark]\nbackground = "#000"\ncard = "#111"\nink = "#fff"\nink-soft = "#ccc"\nprimary = "#0f0"\n');

  it("inlines the card, leaving out what the card leaves out", () => {
    expect(buildEnv(root)).toMatchObject({ SITE_CARD_PHONE: "", SITE_CARD_EMAIL: "hi@clean.example", SITE_CARD_SITE: "", SITE_MARK_PATH: "M0 0h1v1z" });
  });

  it("layers the shared config under the brand's", () => {
    const config = withLanding({ env: { EXTRA: "1" }, experimental: { typedEnv: true } }, { root, ogFiles: ["./assets/fonts/*.ttf"] });
    expect(config).toMatchObject({
      output: "standalone",
      poweredByHeader: false,
      expireTime: 86_400,
      images: { unoptimized: true },
      outputFileTracingIncludes: { "/og": ["./assets/fonts/*.ttf"] },
      experimental: { isrFlushToDisk: false, typedEnv: true },
      env: { EXTRA: "1", SITE_CARD_EMAIL: "hi@clean.example" },
    });
  });

  it("refuses a national phone number", () => {
    writeFileSync(join(root, "assets/card.toml"), 'phone = "06 12 34 56 78"\n');
    expect(() => buildEnv(root)).toThrow(/international/);
  });
});

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brandStatusTarget, createPlaceView, statusTarget, thanksChannel, type Lead, type LeadStore, type Place } from "../src/index";
import { brandMetadata, createPlaceLoader, healthRoute, ogRoute, placeMetadata, quoteRoute, statusMetadata } from "../src/next/index";
import { buildEnv, withLanding } from "../src/next/config/index";
import { createProxy, GONE_HEADER, PROXY_MATCHER } from "../src/proxy/index";
import { createPlaceSource, openSqliteLeadStore, parseServerEnv } from "../src/server/index";
import { fixture, fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const text = (value: unknown): string => JSON.stringify(value, null, 2);
type Locale = "fr" | "en";

afterEach(() => vi.unstubAllGlobals());

interface MetaCase {
  name: string;
  site: string;
  kind: "place" | "brand" | "status";
  place?: Place<Locale>;
  locale?: Locale;
  page?: string;
  mode?: "host" | "path";
  copy: { title: string; description?: string };
  expected: unknown;
}

describe("<head> metadata against the shared fixtures", () => {
  const { cases } = fixture<{ cases: MetaCase[] }>("metadata.json");
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    const site = fixtureSite(c.site);
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

  it("sends a dead path to the 404 route, telling it the language and the place", () => {
    const res = proxy(request("https://royat.aquafix.top/fr/nope", { host: "royat.aquafix.top" }));
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/fr/404/404");
    expect(res.headers.get(`x-middleware-request-${GONE_HEADER}`)).toBe("fr/_royat");
    const junk = proxy(request("https://aquafix.top/wp-admin", { "accept-language": "en" }));
    expect(new URL(junk.headers.get("x-middleware-rewrite") ?? "").pathname).toBe("/en/404/404");
    expect(junk.headers.get(`x-middleware-request-${GONE_HEADER}`)).toBe("en");
  });

  it("strips a client-sent gone header on every onward branch", () => {
    for (const url of ["https://aquafix.top/quote", "https://aquafix.top/fr", "https://royat.aquafix.top/fr/prices"]) {
      const res = proxy(request(url, { host: new URL(url).host, [GONE_HEADER]: "en/_lyon-nord" }));
      expect(res.headers.get("x-middleware-override-headers")?.split(","), url).not.toContain(GONE_HEADER);
      expect(res.headers.get(`x-middleware-request-${GONE_HEADER}`), url).toBeNull();
    }
  });

  it("keeps its own header on the 404 route's second pass, and only a well-formed one", () => {
    const pass = (value: string, path = "/fr/404/404") => proxy(request(`https://aquafix.top${path}`, { host: "localhost:3000", [GONE_HEADER]: value }));
    // Kept: untouched, so Next hands it to the global not-found page.
    expect(pass("fr/_royat").headers.get("x-middleware-override-headers")).toBeNull();
    expect(pass("fr").headers.get("x-middleware-override-headers")).toBeNull();
    // Another language than the path's, or no real place: stripped.
    expect(pass("en/_royat").headers.get("x-middleware-override-headers")).not.toBeNull();
    expect(pass("fr/_nowhere").headers.get("x-middleware-override-headers")).not.toBeNull();
  });

  it("keeps a per-visitor redirect out of every cache", () => {
    expect(proxy(request("https://aquafix.top/")).headers.get("cache-control")).toBe("private, no-store");
    expect(proxy(request("https://aquafix.top/fr?lang=en")).headers.get("cache-control")).toBe("private, no-store");
  });

  it("publishes the matcher a brand's proxy.ts spells out", () => {
    expect(new RegExp(`^${PROXY_MATCHER}$`).test("/fr/prices")).toBe(true);
    expect(new RegExp(`^${PROXY_MATCHER}$`).test("/_next/static/x.js")).toBe(false);
  });
});

describe("the brand's status target for a client boundary", () => {
  it("needs two facts, not the site", () => {
    expect(brandStatusTarget({ locales: ["fr", "en"], phone: null }, "en", { retry: "/en/x" })).toEqual({
      locale: "en",
      place: null,
      phone: null,
      home: "/en",
      retry: "/en/x",
      langHrefs: { fr: "/fr", en: "/en" },
    });
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
  const deps = (store: LeadStore, log = { warn: vi.fn(), error: vi.fn() }) => ({
    env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "https://eu.i.posthog.com", trustedProxy: null }) as const,
    notifier: () => ({ notify: async () => undefined }),
    unavailable: (locale: string) => ({ title: `500 ${locale}`, heading: "Oops <b>", body: "Call us", callLabel: "Call" }),
    store: () => store,
    defer: () => undefined,
    now: () => NOW,
    log,
  });
  const route = (store: LeadStore, log = { warn: vi.fn(), error: vi.fn() }) => quoteRoute(site, deps(store, log));

  it("stores the lead and answers 303 to the place's thank-you page on the host it came from", async () => {
    const store = memory();
    const res = await route(store)(post({}));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr/thanks");
    expect(store.rows).toHaveLength(1);
    expect((await route(memory())(post({}, "aquafix.top"))).headers.get("location")).toBe("/fr/royat/thanks");
  });

  it("sends an invalid lead back to the card with the field it is about, and a lead with no place to the brand", async () => {
    const res = await quoteRoute({ ...site, lead: { ...site.lead, validate: () => "no" } }, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "x", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => memory(),
      log: { warn: vi.fn(), error: vi.fn() },
    })(post({}));
    expect(res.headers.get("location")).toBe("/fr?lead_error=form&need=other#quote");
    expect((await route(memory())(post({ location: "paris" }))).headers.get("location")).toBe("/fr/thanks");
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #1, #2: a refusal was a 303 to `#quote` and nothing else.
  it("names the refused field and lands on the card's own anchor, never a hard-coded one", async () => {
    const store = memory();
    const bad = { mobile: "06 12 34 56 7" };
    expect((await route(store)(post(bad))).headers.get("location")).toBe("/fr?lead_error=phone&need=other#quote");
    const devis = quoteRoute(site, { ...deps(store), anchor: "devis" });
    expect((await devis(post(bad))).headers.get("location")).toBe("/fr?lead_error=phone&need=other#devis");
    // The card posts its own id; one that is not a slug is not echoed.
    expect((await devis(post({ ...bad, card: "quote-band" }))).headers.get("location")).toBe("/fr?lead_error=phone&need=other#quote-band");
    expect((await devis(post({ ...bad, card: "x\"><script>" }))).headers.get("location")).toBe("/fr?lead_error=phone&need=other#devis");
    // A need the brand does not offer is not echoed either; nothing typed ever is.
    expect((await route(store)(post({ ...bad, job: "<b>" }))).headers.get("location")).toBe("/fr?lead_error=phone#quote");
    expect(store.rows).toHaveLength(0);
    expect(() => quoteRoute(site, { ...deps(store), anchor: "#devis" })).toThrow(/anchor/);
  });

  it("opens the callback at its own anchor when the callback is refused", async () => {
    const res = await route(memory())(post({ channel: "callback", mobile: "07 12 34 56 78" }));
    expect(res.headers.get("location")).toBe("/fr?lead_error=consent#quote-callback");
  });

  it("answers a script with JSON: 422 and the field when refused, the thanks page when taken", async () => {
    const asked = (fields: Record<string, string>) => {
      const req = post(fields);
      req.headers.set("accept", "application/json");
      return req;
    };
    const store = memory();
    const refused = await route(store)(asked({ mobile: "+3361234567" }));
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ ok: false, field: "phone" });
    const taken = await route(store)(asked({}));
    expect(taken.status).toBe(200);
    expect(await taken.json()).toEqual({ ok: true, location: "/fr/thanks", lead: expect.stringMatching(/^lead-1-[0-9a-f]{8}$/) });
    expect(store.rows).toHaveLength(1);
  });

  // LEAD-FORMS-REVIEW-2026-10-03 #12: the thanks page could not tell a callback from a quote.
  it("tells the thanks page a callback was asked for", async () => {
    const res = await route(memory())(post({ channel: "callback", mobile: "07 12 34 56 78", consent: "oui" }));
    expect(res.headers.get("location")).toBe("/fr/thanks?channel=callback");
    expect(thanksChannel(new URL(`https://x${res.headers.get("location")}`).searchParams)).toBe("callback");
    expect(thanksChannel({ channel: ["callback", "form"] })).toBe("callback");
    expect(thanksChannel({ channel: "sms" })).toBe("form");
    expect(thanksChannel({})).toBe("form");
    const target = statusTarget(site, { locale: "fr", location: "royat" }, { thanks: true, channel: "callback" });
    expect(target.langHrefs.en).toBe("/en/royat/thanks?channel=callback");
  });

  it("answers a repeated submission as it answered the first, without a second row", async () => {
    const store = openSqliteLeadStore(":memory:");
    const sid = { submission_id: "3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f", channel: "callback", mobile: "07 12 34 56 78", consent: "oui" };
    const first = await route(store)(post(sid));
    const again = await route(store)(post({ ...sid, location: "paris" }));
    expect(first.headers.get("location")).toBe("/fr/thanks?channel=callback");
    expect(again.headers.get("location")).toBe("/fr/thanks?channel=callback");
    expect(await store.count()).toBe(1);
  });

  it("answers a self-contained, escaped 500 with the phone when the store refuses", async () => {
    const res = await route(memory(true))(post({}));
    expect(res.status).toBe(500);
    const html = await res.text();
    expect(html).toContain('href="tel:+33423500640"');
    expect(html).toContain("Oops &lt;b&gt;");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("cuts a chunked body off at 64 KiB, whatever Content-Length says", async () => {
    const chunk = new Uint8Array(16 * 1024).fill(97);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 8; i++) c.enqueue(chunk);
        c.close();
      },
    });
    const req = new Request("https://aquafix.top/quote", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" }, duplex: "half" } as RequestInit);
    expect((await route(memory())(req)).status).toBe(413);
  });

  it("answers the phone page, not a bare 500, when the environment is unusable", async () => {
    const res = await quoteRoute(site, {
      env: () => {
        throw new Error("LEADS_DB_URL is not a URL");
      },
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "t", heading: "h", body: "b", callLabel: "Call" }),
      log: { warn: vi.fn(), error: vi.fn() },
    })(post({}));
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('href="tel:+33423500640"');
  });

  it("refuses an oversized body and a body that is not a form", async () => {
    const big = new Request("https://aquafix.top/quote", { method: "POST", body: "x", headers: { "content-length": String(1 << 20) } });
    expect((await route(memory())(big)).status).toBe(413);
    const junk = new Request("https://aquafix.top/quote", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect((await route(memory())(junk)).status).toBe(400);
  });

  it("counts the submit with its channel and the site's experiment, and nothing the customer typed", async () => {
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const counted = quoteRoute(site, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => memory(),
      defer: task => void task(),
      now: () => NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    });
    await counted(post({ channel: "callback", consent: "J’accepte d’être rappelé·e.", experiment: "lead_layout", variant: "single" }));
    const [, body] = beacon.mock.calls[0] ?? [];
    const event = JSON.parse(body ?? "null");
    expect(event).toMatchObject({ event: "lead_form_submit", properties: { form_id: "quote", channel: "callback", experiment: "lead_layout", variant: "single", location_id: "royat" } });
    expect(body).not.toMatch(/0612345678|\+33612345678|63130|J’accepte|consent/);
    vi.unstubAllGlobals();
  });
});

describe("the rate limit", () => {
  it("is LEAD_RATE_LIMIT's, and outside production loose enough for a local stack", () => {
    const base = { LEADS_DB_PATH: "/data/leads.db" };
    expect(parseServerEnv({ brand: { id: "x" } }, { ...base, NODE_ENV: "production", TRUSTED_PROXY: "xff:1" }).leadRateLimit).toEqual({ limit: 5, windowMs: 600_000 });
    expect(parseServerEnv({ brand: { id: "x" } }, base).leadRateLimit).toEqual({ limit: 100, windowMs: 600_000 });
    expect(parseServerEnv({ brand: { id: "x" } }, { ...base, LEAD_RATE_LIMIT: "20/60" }).leadRateLimit).toEqual({ limit: 20, windowMs: 60_000 });
    for (const bad of ["20", "0/60", "x/y", "5/0"]) expect(() => parseServerEnv({ brand: { id: "x" } }, { ...base, LEAD_RATE_LIMIT: bad }), bad).toThrow(/LEAD_RATE_LIMIT/);
  });

  it("never costs the lead when the webhook cannot be built", async () => {
    const store = openSqliteLeadStore(":memory:");
    const log = { warn: vi.fn(), error: vi.fn() };
    const res = await quoteRoute(site, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "x", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      webhook: () => {
        throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
      },
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => store,
      defer: () => undefined,
      log,
    })(new Request("https://aquafix.top/quote", { method: "POST", body: new URLSearchParams({ location: "royat", locale: "fr", job: "other", zip: "63130", mobile: "0612345678", t: "1" }), headers: { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" } }));
    expect(res.status).toBe(303);
    expect(await store.count()).toBe(1);
    expect(log.error).toHaveBeenCalled();
  });

  it("is said loudly outside production when it holds a lead back", async () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    const route = (production: boolean) =>
      quoteRoute(site, {
        env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "x", trustedProxy: null, production, leadRateLimit: { limit: 1, windowMs: 60_000 } }),
        notifier: () => ({ notify: async () => undefined }),
        unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
        store: () => openSqliteLeadStore(":memory:"),
        defer: () => undefined,
        log,
      });
    const body = () => new URLSearchParams({ location: "royat", locale: "fr", job: "other", zip: "63130", mobile: "0612345678", t: "1" });
    const req = () => new Request("https://aquafix.top/quote", { method: "POST", body: body(), headers: { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" } });
    const dev = route(false);
    await dev(req());
    await dev(req());
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/rate-limited.*NOT sent on.*LEAD_RATE_LIMIT/s));
    log.warn.mockClear();
    const prod = route(true);
    await prod(req());
    await prod(req());
    expect(log.warn).not.toHaveBeenCalledWith(expect.stringContaining("LEAD_RATE_LIMIT"));
  });
});

describe("the quote route's refusals, counted", () => {
  // LEAD-FORMS-REVIEW-2026-10-03 #11: a refusal left no trace in the funnel.
  it("captures lead_form_reject with the field and the reason, and nothing the customer typed", async () => {
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const rejecting = quoteRoute(site, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => openSqliteLeadStore(":memory:"),
      defer: task => void task(),
      log: { warn: vi.fn(), error: vi.fn() },
    });
    const body = new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", job: "other", zip: "63130", mobile: "06 12 34 56 7", experiment: "lead_layout", variant: "single" });
    await rejecting(new Request("https://aquafix.top/quote", { method: "POST", body, headers: { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" } }));
    const [, sent] = beacon.mock.calls[0] ?? [];
    expect(JSON.parse(sent ?? "null")).toMatchObject({
      event: "lead_form_reject",
      properties: { form_id: "quote", channel: "form", field: "phone", reason: "invalid", experiment: "lead_layout", variant: "single", location_id: "royat" },
    });
    expect(sent).not.toMatch(/06 12 34 56 7|63130/);
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
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await healthRoute(async () => Promise.reject(new Error("db")))()).status).toBe(503);
    spy.mockRestore();
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
      experimental: { isrFlushToDisk: false, globalNotFound: true, typedEnv: true },
      env: { EXTRA: "1", SITE_CARD_EMAIL: "hi@clean.example" },
    });
  });

  it("refuses a national phone number", () => {
    writeFileSync(join(root, "assets/card.toml"), 'phone = "06 12 34 56 78"\n');
    expect(() => buildEnv(root)).toThrow(/international/);
  });
});

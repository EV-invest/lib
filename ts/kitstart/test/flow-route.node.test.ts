import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineSite, leadRef, parsePricingModel, type Lead, type PricingModel } from "../src/index";
import { confirmRoute, quoteRoute } from "../src/next/index";
import { leadWebhook, openSqliteLeadStore, panelFlowOf, panelFlowProperties, type LeadWebhookContext, type PricingSource, type WebhookOutbox } from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

const BAKED = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
const LIVE: PricingModel = { ...BAKED, validFrom: "2026-11-01", minimumCents: 9900 };

const aquafix = fixtureSite("aquafix");
const site = defineSite({
  ...aquafix,
  lead: { ...aquafix.lead, subjects: ["standard", "windows", "deep", "other"], flows: { standard: "estimate", windows: "fixed", deep: "quote" } },
  pricing: BAKED,
});

const NOW = 1_800_000_000_000;
const ESTIMATE = { estimate_zone: "proche", estimate_bedrooms: "t3", estimate_surface: "s70", estimate_frequency: "biweekly" };
const post = (fields: Record<string, string>, json = true) => {
  const body = new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", job: "standard", zip: "63130", mobile: "0612345678", ...fields });
  const headers: Record<string, string> = { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" };
  if (json) headers["accept"] = "application/json";
  return new Request("https://aquafix.top/quote", { method: "POST", body, headers });
};

const opened: WebhookOutbox[] = [];
afterEach(() => {
  for (const o of opened.splice(0)) o.close();
});

function harness(over: { pricing?: PricingSource; panelFlow?: boolean } = {}) {
  const store = openSqliteLeadStore(":memory:");
  const bodies: LeadWebhookContext[] = [];
  const hook = leadWebhook(site, { leadsDb: { kind: "sqlite", path: ":memory:" }, leadWebhook: { url: "http://panel.local/ingest", keyId: "k", secret: "s" } }, {
    signing: { prefix: "p.", headers: { keyId: "x-k", timestamp: "x-t", signature: "x-s" } },
    buildBody: (_lead, ctx) => (bodies.push(ctx), {}),
    fetch: vi.fn(async () => new Response(null, { status: 200 })),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...(over.panelFlow === undefined ? {} : { panelFlow: over.panelFlow }),
  });
  if (!hook) throw new Error("expected the webhook on");
  opened.push(hook.outbox);
  const log = { warn: vi.fn(), error: vi.fn() };
  const route = quoteRoute(site, {
    env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
    notifier: () => ({ notify: async () => undefined }),
    webhook: () => hook,
    unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
    store: () => store,
    defer: () => undefined,
    now: () => NOW,
    log,
    ...(over.pricing ? { pricing: over.pricing } : {}),
  });
  const stored = async (sid: string): Promise<Lead | undefined> => (await store.findSubmission(sid))?.lead;
  return { route, store, bodies, log, stored };
}

const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("the quote route, pricing a lead", () => {
  it("recomputes an estimate from the posted answers and ignores any posted amount", async () => {
    const { route, stored } = harness();
    const res = await route(post({ ...ESTIMATE, submission_id: sid(1), quoted_cents: "1", cents: "1", price: "1", estimate_price: "1" }));
    expect(await res.json()).toEqual({ ok: true, location: "/fr/thanks", lead: leadRef(1, sid(1)), cents: 8400 });
    expect((await stored(sid(1)))?.flow).toBe("estimate");
    expect((await stored(sid(1)))?.price).toEqual({ cents: 8400, validFrom: "2026-10-01", inputs: { zone: "proche", bedrooms: "t3", surface: "s70", frequency: "biweekly" } });
  });

  it("prices a fixed need at its price, with no answers", async () => {
    const { route, stored } = harness();
    const res = await route(post({ job: "windows", ...ESTIMATE, submission_id: sid(2) }));
    expect(await res.json()).toMatchObject({ ok: true, cents: 8900 });
    expect(await stored(sid(2))).toMatchObject({ flow: "fixed", price: { cents: 8900, validFrom: "2026-10-01" } });
    expect((await stored(sid(2)))?.price?.inputs).toBeUndefined();
  });

  it("keeps an estimate that does not price — a missing or forged answer — as a quote, never refused", async () => {
    const { route, stored, log } = harness();
    const missing = await route(post({ ...ESTIMATE, estimate_frequency: "", submission_id: sid(3) }));
    expect(missing.status).toBe(200);
    expect(await missing.json()).not.toHaveProperty("cents");
    expect(await stored(sid(3))).toMatchObject({ flow: "quote" });
    expect((await stored(sid(3)))?.price).toBeUndefined();
    await route(post({ ...ESTIMATE, estimate_zone: "mars", submission_id: sid(4) }));
    expect((await stored(sid(4)))?.flow).toBe("quote");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("did not price"));
  });

  it("is a quote for a need the brand sells by quote, or does not list, and no flow at all for a callback", async () => {
    const { route, stored } = harness();
    await route(post({ job: "deep", ...ESTIMATE, submission_id: sid(5) }));
    await route(post({ job: "other", submission_id: sid(6) }));
    await route(post({ channel: "callback", consent: "oui", ...ESTIMATE, submission_id: sid(7) }));
    expect((await stored(sid(5)))?.flow).toBe("quote");
    expect((await stored(sid(6)))?.flow).toBe("quote");
    expect((await stored(sid(7)))?.flow).toBeUndefined();
    expect((await stored(sid(7)))?.price).toBeUndefined();
  });

  it("prices from the live source the page priced from, and a failing one is a quote, not a lost lead", async () => {
    const live = harness({ pricing: { model: async () => LIVE } });
    await live.route(post({ ...ESTIMATE, estimate_zone: "centre", estimate_bedrooms: "studio", estimate_surface: "s40", submission_id: sid(8) }));
    expect((await live.stored(sid(8)))?.price).toMatchObject({ cents: 9900, validFrom: "2026-11-01" });
    const broken = harness({ pricing: { model: async () => Promise.reject(new Error("boom")) } });
    const res = await broken.route(post({ ...ESTIMATE, submission_id: sid(9) }));
    expect(res.status).toBe(200);
    expect((await broken.stored(sid(9)))?.flow).toBe("quote");
    expect(broken.log.error).toHaveBeenCalledWith(expect.stringContaining("price list"), expect.any(Error));
  });

  it("answers a resend with the same reference", async () => {
    const { route } = harness();
    const first = await (await route(post({ ...ESTIMATE, submission_id: sid(10) }))).json();
    const again = await (await route(post({ ...ESTIMATE, submission_id: sid(10) }))).json();
    expect(again).toEqual(first);
  });

  it("still answers a plain post with a 303 and nothing else", async () => {
    const { route } = harness();
    const res = await route(post(ESTIMATE, false));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/fr/thanks");
  });
});

describe("the lead webhook and the sale", () => {
  it("is off by default: the context carries the reference, never the sale", async () => {
    const { route, bodies } = harness();
    await route(post({ ...ESTIMATE, submission_id: sid(11) }));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.leadRef).toBe(leadRef(1, sid(11)));
    expect(bodies[0]).not.toHaveProperty("flow");
  });

  it("on, tells the panel how the need was sold and at what price", async () => {
    const { route, bodies } = harness({ panelFlow: true });
    await route(post({ ...ESTIMATE, submission_id: sid(12) }));
    await route(post({ job: "windows", submission_id: sid(13) }));
    await route(post({ job: "deep", submission_id: sid(14) }));
    await route(post({ channel: "callback", consent: "oui", submission_id: sid(15) }));
    expect(bodies.map(b => panelFlowProperties(b.flow))).toEqual([
      { flow: "estimate", quoted_cents: 8400, pricing_valid_from: "2026-10-01", estimate_inputs: { zone: "proche", bedrooms: "t3", surface: "s70", frequency: "biweekly" } },
      { flow: "fixed", quoted_cents: 8900, pricing_valid_from: "2026-10-01" },
      { flow: "quote" },
      {},
    ]);
  });

  it("never sends a price with a quote, nor answers without a price", () => {
    expect(panelFlowOf({ flow: "quote", price: { cents: 1, validFrom: "2026-10-01" } })).toEqual({ flow: "quote" });
    expect(panelFlowOf({ flow: "estimate" })).toEqual({ flow: "quote" });
    expect(panelFlowOf({ flow: "estimate", price: { cents: 7000, validFrom: "2026-10-01", inputs: {} } })).toEqual({ flow: "estimate", quotedCents: 7000, pricingValidFrom: "2026-10-01" });
    expect(panelFlowOf({})).toBeUndefined();
  });
});

describe("leadRef", () => {
  it("is the row and an 8-hex tag of its seed", () => {
    expect(leadRef(42, sid(1))).toMatch(/^lead-42-[0-9a-f]{8}$/);
    expect(leadRef(42, sid(1))).toBe(leadRef(42, sid(1)));
    expect(leadRef(42, sid(1))).not.toBe(leadRef(42, sid(2)));
  });
});

// Live retest 2026-10-04: a stale form showed 77 €, the panel changed the
// tariff, and the lead was taken at 86 € without a word. The price a consumer
// is shown must be the price recorded: the form posts what it showed, and a
// difference is a refusal with the fresh price, never a silent change.
describe("the quote route, when the price changed under the form", () => {
  const live: PricingSource = { model: async () => LIVE };

  it("takes the lead when the shown price is the server's", async () => {
    const { route, stored } = harness();
    const res = await route(post({ ...ESTIMATE, shown_cents: "8400", submission_id: sid(40) }));
    expect(await res.json()).toMatchObject({ ok: true, cents: 8400 });
    expect((await stored(sid(40)))?.price?.cents).toBe(8400);
  });

  it("refuses a lead shown at another price, answering the fresh one, and stores nothing", async () => {
    const { route, stored } = harness({ pricing: live });
    const res = await route(post({ ...ESTIMATE, shown_cents: "8400", submission_id: sid(41) }));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, field: "price_changed", reason: "price_changed", cents: 9900 });
    expect(await stored(sid(41))).toBeUndefined();
    const again = await route(post({ ...ESTIMATE, shown_cents: "9900", submission_id: sid(42) }));
    expect(await again.json()).toMatchObject({ ok: true, cents: 9900 });
  });

  // Review of #185: a cached (ISR) page keeps its stale shown_cents, so
  // sending it back to the card refused every resubmit. A form without a
  // script goes to a page that is never cached, and confirms from there.
  it("sends a form without a script to a confirmation that is never cached, with no personal data in the URL", async () => {
    const { route } = harness({ pricing: live });
    const res = await route(post({ job: "standard", ...ESTIMATE, shown_cents: "8400", submission_id: sid(43) }, false));
    expect(res.status).toBe(303);
    const location = new URL(res.headers.get("location") ?? "", "https://aquafix.top");
    expect(location.pathname).toBe("/quote/confirm");
    expect(location.search).not.toMatch(/0612345678|63130/);
    expect(Object.fromEntries(location.searchParams)).toMatchObject({ job: "standard", estimate_zone: "proche", shown: "8400", submission_id: sid(43), location: "royat", locale: "fr" });
  });

  it("confirms at the fresh price, and the confirmation's post is taken: no loop", async () => {
    const { route, stored } = harness({ pricing: live });
    const sent = await route(post({ job: "standard", ...ESTIMATE, shown_cents: "8400", submission_id: sid(45) }, false));
    const confirm = confirmRoute(site, { pricing: live, now: () => NOW });
    const page = await confirm(new Request(new URL(sent.headers.get("location") ?? "", "https://royat.aquafix.top")));
    expect(page.status).toBe(200);
    expect(page.headers.get("cache-control")).toBe("no-store");
    const html = await page.text();
    expect(html).toMatch(/Le prix a changé : 99\s€ au lieu de 84\s€/);
    expect(html).toContain('<form method="post" action="/quote">');
    // The form as the confirmation posts it: its hidden fields, and the phone and postcode typed again.
    const fields = Object.fromEntries([...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/g)].map(m => [m[1], m[2]]));
    expect(fields).toMatchObject({ shown_cents: "9900", job: "standard", submission_id: sid(45), estimate_frequency: "biweekly" });
    expect(html).toMatch(/name="mobile"/);
    expect(html).toMatch(/name="zip"/);
    const res = await route(post({ ...fields, hp_ref: "", t: String(NOW - 10_000), zip: "63130", mobile: "0612345678" }, false));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/\/thanks/);
    expect((await stored(sid(45)))?.price?.cents).toBe(9900);
  });

  it("sends a confirmation it cannot price back to the place's form", async () => {
    const confirm = confirmRoute(site, { pricing: live, now: () => NOW });
    const res = await confirm(new Request("https://royat.aquafix.top/quote/confirm?job=standard&locale=fr&location=royat&shown=8400"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/#quote$/);
  });

  it("takes the lead as before when the page posts no shown price (a page cached before the field)", async () => {
    const { route, stored } = harness({ pricing: live });
    const res = await route(post({ ...ESTIMATE, submission_id: sid(44) }));
    expect(await res.json()).toMatchObject({ ok: true, cents: 9900 });
    expect((await stored(sid(44)))?.price?.cents).toBe(9900);
  });
});

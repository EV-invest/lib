import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead, LeadStore } from "../src/index";
import { quoteRoute } from "../src/next/index";
import {
  checkWebhookUrl,
  leadWebhook,
  openWebhookOutbox,
  panelChannel,
  parseServerEnv,
  signatureHeaders,
  signWebhook,
  type WebhookOutbox,
  type WebhookTarget,
} from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

const SIGNING = { prefix: "sa-ingest/v1.", headers: { keyId: "x-sa-key-id", timestamp: "x-sa-timestamp", signature: "x-sa-signature" } };
const TARGET: WebhookTarget = { url: "http://panel.sa.svc.cluster.local/api/ingest/v1/events", keyId: "aquafix-site", secret: "s3cret", signing: SIGNING };
const PII = { mobile: "0612345678", locality: "Royat, rue Secrète 7" };
const lead: Lead = { subject: "hot_water", ...PII, extras: { note: "le chauffe-eau fuit" }, placeSlug: "royat", spamVerdict: null };

const opened: WebhookOutbox[] = [];
afterEach(() => {
  for (const o of opened.splice(0)) o.close();
});

const file = (): string => join(mkdtempSync(join(tmpdir(), "kitstart-webhook-")), "leads.db");
const quiet = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });
const logged = (log: ReturnType<typeof quiet>): string => JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls, ...log.error.mock.calls]);

/** A receiver that answers from a script, and records what it was sent. */
function receiver(...answers: (Response | Error)[]) {
  const seen: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers).entries()), body: String(init?.body) });
    const next = answers.length > 1 ? answers.shift() : answers[0];
    if (!next) throw new Error("receiver: no answer scripted");
    if (next instanceof Error) throw next;
    return next.clone();
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, seen };
}

function outbox(path: string, fetch: typeof globalThis.fetch, clock: { t: number }, extra: Parameters<typeof openWebhookOutbox>[2] = {}) {
  const o = openWebhookOutbox(path, TARGET, { fetch, now: () => clock.t, random: () => 0, log: quiet(), ...extra });
  opened.push(o);
  return o;
}

describe("the webhook signature", () => {
  it("matches the panel's fixed vector (panel_core::signature::tests)", () => {
    expect(signWebhook("0123456789abcdef0123456789abcdef", "sa-ingest/v1.", "1790762400", '{"events":[]}')).toBe(
      "8201ce64bf37d5332c8782bf19dba21d02573a6bf0f424dac260a9db83419b4f",
    );
  });

  it("puts the timestamp in unix seconds, and the prefix and header names are the caller's", () => {
    const h = signatureHeaders({ prefix: "p.", headers: { keyId: "x-key", timestamp: "x-ts", signature: "x-sig" } }, { keyId: "k", secret: "s" }, "{}", 1_790_762_400_999);
    expect(h).toEqual({ "x-key": "k", "x-ts": "1790762400", "x-sig": signWebhook("s", "p.", "1790762400", "{}") });
    expect(signWebhook("s", "", "1", "{}")).not.toBe(signWebhook("s", "p.", "1", "{}"));
  });
});

describe("the webhook URL", () => {
  it("takes https anywhere, and http only inside the cluster or on loopback", () => {
    for (const ok of ["https://panel.example/api", "http://panel.sa.svc/x", "http://panel.sa.svc.cluster.local:8080/x", "http://localhost:3000/x", "http://127.0.0.1/x"]) {
      expect(() => checkWebhookUrl(ok)).not.toThrow();
    }
    for (const bad of ["http://panel.example/x", "http://svc.example.com/x", "ftp://a.svc/x", "not a url"]) {
      expect(() => checkWebhookUrl(bad)).toThrow(/LEAD_WEBHOOK_URL/);
    }
  });

  it("never repeats the value it refuses", () => {
    expect(() => checkWebhookUrl("http://user:hunter2@evil.example/x")).toThrow(expect.objectContaining({ message: expect.not.stringContaining("hunter2") }));
  });
});

describe("the webhook settings", () => {
  const base = { LEADS_DB_PATH: "/data/leads.db" };
  const env = (extra: Record<string, string>) => parseServerEnv({ brand: { id: "aquafix" } }, { ...base, ...extra });

  it("is off without LEAD_WEBHOOK_URL, and needs the key id and secret with it", () => {
    expect(env({ LEAD_WEBHOOK_SECRET: "s" }).leadWebhook).toBeNull();
    expect(() => env({ LEAD_WEBHOOK_URL: TARGET.url, LEAD_WEBHOOK_KEY_ID: "k" })).toThrow(/LEAD_WEBHOOK_SECRET/);
    expect(env({ LEAD_WEBHOOK_URL: TARGET.url, LEAD_WEBHOOK_KEY_ID: "k", LEAD_WEBHOOK_SECRET: "s" }).leadWebhook).toEqual({ url: TARGET.url, keyId: "k", secret: "s" });
    expect(() => env({ LEAD_WEBHOOK_URL: "http://panel.example/x", LEAD_WEBHOOK_KEY_ID: "k", LEAD_WEBHOOK_SECRET: "s" })).toThrow(/https/);
  });
});

describe("the webhook outbox", () => {
  it("POSTs the stored body, signed, and marks it delivered on a 2xx", async () => {
    const clock = { t: 1_790_762_400_000 };
    const { fetch, seen } = receiver(new Response(null, { status: 204 }));
    const o = outbox(":memory:", fetch, clock);
    o.enqueue('{"a":1}', "lead:1");
    expect(await o.tick()).toEqual({ delivered: 1, retried: 0, dead: 0 });
    expect(seen[0]).toMatchObject({ url: TARGET.url, body: '{"a":1}' });
    expect(seen[0]?.headers).toMatchObject({
      "content-type": "application/json",
      "x-sa-key-id": "aquafix-site",
      "x-sa-timestamp": "1790762400",
      "x-sa-signature": signWebhook("s3cret", "sa-ingest/v1.", "1790762400", '{"a":1}'),
    });
    expect(o.rows()).toMatchObject([{ ref: "lead:1", state: "delivered", attempts: 1, lastError: null }]);
    expect(await o.tick()).toEqual({ delivered: 0, retried: 0, dead: 0 });
  });

  it("retries 5xx, 408, 429 and network errors with a doubling, capped backoff, then gives up", async () => {
    const clock = { t: 0 };
    const { fetch, seen } = receiver(
      new Response("down", { status: 503 }),
      new Response(null, { status: 408 }),
      new Response(null, { status: 429 }),
      new TypeError("fetch failed"),
      new Response(null, { status: 500 }),
    );
    const log = quiet();
    const o = outbox(":memory:", fetch, clock, { baseDelayMs: 1_000, maxDelayMs: 4_000, maxAttempts: 5, log });
    o.enqueue("{}");
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      expect(await o.tick()).toEqual({ delivered: 0, retried: 1, dead: 0 });
      const next = o.rows()[0]?.nextAttemptAt ?? 0;
      waits.push(next - clock.t);
      // Not due yet: nothing is sent early.
      clock.t = next - 1;
      await o.tick();
      clock.t = next;
    }
    expect(waits).toEqual([1_000, 2_000, 4_000, 4_000]);
    expect(await o.tick()).toEqual({ delivered: 0, retried: 0, dead: 1 });
    expect(seen).toHaveLength(5);
    expect(o.rows()).toMatchObject([{ state: "dead", attempts: 5, lastError: "HTTP 500" }]);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("dead after 5 attempt(s): HTTP 500"));
  });

  it("waits at least what Retry-After asks", async () => {
    const clock = { t: 0 };
    const o = outbox(":memory:", receiver(new Response(null, { status: 429, headers: { "retry-after": "120" } })).fetch, clock);
    o.enqueue("{}");
    await o.tick();
    expect(o.rows()[0]?.nextAttemptAt).toBe(120_000);
  });

  it("does not retry a 4xx other than 408/429, nor follow a redirect", async () => {
    const clock = { t: 0 };
    const log = quiet();
    const { fetch, seen } = receiver(new Response('{"error":"invalid key or signature"}', { status: 401 }), new Response(null, { status: 302, headers: { location: "https://elsewhere" } }));
    const o = outbox(":memory:", fetch, clock, { log });
    o.enqueue("{}");
    o.enqueue("{}");
    expect(await o.tick()).toEqual({ delivered: 0, retried: 0, dead: 2 });
    expect(seen).toHaveLength(2);
    expect(o.rows().map(r => r.lastError)).toEqual(['HTTP 401: {"error":"invalid key or signature"}', "HTTP 302"]);
    // The receiver's words stay in the row, not in the log.
    expect(logged(log)).not.toContain("invalid key");
  });

  it("takes a 207 as delivered and does not retry a rejected item; the reason stays out of the log", async () => {
    const clock = { t: 0 };
    const log = quiet();
    const verdicts = {
      results: [
        { index: 0, id: "a", status: "accepted" },
        { index: 1, id: "b", status: "rejected", reason: `pii.phone: ${PII.mobile} is not E.164` },
        { index: 2, id: "c", status: "duplicate" },
      ],
    };
    const { fetch, seen } = receiver(new Response(JSON.stringify(verdicts), { status: 207 }));
    const o = outbox(":memory:", fetch, clock, { log });
    o.enqueue('{"events":[1,2,3]}');
    expect(await o.tick()).toEqual({ delivered: 1, retried: 0, dead: 0 });
    clock.t += 24 * 3600_000;
    await o.tick();
    expect(seen).toHaveLength(1);
    expect(o.rows()[0]).toMatchObject({ state: "delivered", lastError: expect.stringContaining("#1: pii.phone") });
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("item 1 rejected"));
    expect(logged(log)).not.toContain(PII.mobile);
  });

  it("survives a restart: a new instance on the same file sends what the old one did not", async () => {
    const path = file();
    const clock = { t: 0 };
    const first = outbox(path, receiver(new TypeError("fetch failed")).fetch, clock, { baseDelayMs: 1_000 });
    first.enqueue('{"lead":1}');
    first.enqueue('{"lead":2}');
    await first.tick();
    first.close();
    opened.splice(opened.indexOf(first), 1);

    clock.t = 60_000;
    const { fetch, seen } = receiver(new Response(null, { status: 200 }));
    const second = outbox(path, fetch, clock);
    expect(await second.tick()).toEqual({ delivered: 2, retried: 0, dead: 0 });
    expect(seen.map(s => s.body)).toEqual(['{"lead":1}', '{"lead":2}']);
  });

  it("leaves rows queued for another URL alone, and says how many", async () => {
    const path = file();
    const clock = { t: 0 };
    const old = openWebhookOutbox(path, { ...TARGET, url: "https://old.example/x" }, { fetch: receiver(new TypeError("x")).fetch, now: () => 0, log: quiet() });
    old.enqueue("{}");
    old.close();
    const log = quiet();
    const { fetch, seen } = receiver(new Response(null, { status: 200 }));
    const o = outbox(path, fetch, clock, { log });
    expect(await o.tick()).toEqual({ delivered: 0, retried: 0, dead: 0 });
    expect(seen).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("1 pending row(s) queued for another target"));
  });

  it("sends a row once when two ticks overlap", async () => {
    const clock = { t: 0 };
    const { fetch, seen } = receiver(new Response(null, { status: 200 }));
    const o = outbox(":memory:", fetch, clock);
    o.enqueue("{}");
    await Promise.all([o.tick(), o.tick()]);
    expect(seen).toHaveLength(1);
  });

  it("never logs the body on failure", async () => {
    const clock = { t: 0 };
    const log = quiet();
    const o = outbox(":memory:", receiver(new TypeError(`fetch failed ${PII.mobile}`)).fetch, clock, { log, maxAttempts: 1 });
    o.enqueue(JSON.stringify(lead));
    await o.tick();
    expect(logged(log)).not.toContain(PII.mobile);
    expect(logged(log)).not.toContain("Secrète");
  });
});

describe("the panel's channel", () => {
  // The panel refuses a lead.created outside its closed set, which would park
  // the lead in the outbox: a callback travels as a form until it accepts one.
  it("is form for a form and, for now, for a callback too", () => {
    expect(panelChannel("form")).toBe("form");
    expect(panelChannel("callback")).toBe("form");
  });
});

describe("the lead webhook", () => {
  const site = { brand: { id: "aquafix" } };
  const on = { leadsDb: { kind: "sqlite" as const, path: ":memory:" }, leadWebhook: { url: TARGET.url, keyId: "k", secret: "s" } };

  it("is off without a URL or without the brand's body builder", () => {
    expect(leadWebhook(site, { ...on, leadWebhook: null }, { signing: SIGNING, buildBody: () => ({}) })).toBeNull();
    expect(leadWebhook(site, on, { signing: SIGNING })).toBeNull();
  });

  it("serialises what the brand builds, once, with a stable idempotency key", async () => {
    const clock = { t: 1_790_762_400_000 };
    const { fetch, seen } = receiver(new Response(null, { status: 503 }), new Response(null, { status: 200 }));
    const build = vi.fn((l: Lead, ctx: { leadId: number; idempotencyKey: string; brandId: string; at: Date; locale: string; formId: string }) => ({
      id: ctx.idempotencyKey,
      lead: ctx.leadId,
      brand: ctx.brandId,
      at: ctx.at.toISOString(),
      locale: ctx.locale,
      phone: l.mobile,
    }));
    const hook = leadWebhook(site, on, { signing: SIGNING, buildBody: build, fetch, now: () => clock.t, random: () => 0, log: quiet() });
    if (!hook) throw new Error("expected the webhook on");
    opened.push(hook.outbox);
    hook.enqueue(lead, 7, { locale: "fr", formId: "quote" });
    await hook.tick();
    clock.t += 3600_000;
    await hook.tick();
    expect(build).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(2);
    expect(seen[0]?.body).toBe(seen[1]?.body);
    expect(JSON.parse(seen[0]?.body ?? "")).toMatchObject({ lead: 7, brand: "aquafix", at: "2026-09-30T10:00:00.000Z", locale: "fr", phone: PII.mobile });
    expect(hook.outbox.rows()).toMatchObject([{ ref: "lead:7", state: "delivered", attempts: 2 }]);
  });
});

describe("the quote route with a webhook", () => {
  const site = fixtureSite("aquafix");
  const NOW = 1_800_000_000_000;
  const post = (fields: Record<string, string> = {}) =>
    new Request("https://aquafix.top/quote", {
      method: "POST",
      body: new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", job: "other", zip: "63130", mobile: PII.mobile, ...fields }),
      headers: { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded" },
    });
  const store = (): LeadStore => {
    let n = 0;
    return { insert: async () => ++n, count: async () => n, schemaVersion: async () => 4, health: async () => undefined, close: async () => undefined };
  };

  it("queues the lead before the 303 and sends it after; a honeypot lead is neither", async () => {
    const { fetch, seen } = receiver(new Response(null, { status: 200 }));
    const deferred: (() => Promise<void> | void)[] = [];
    const hook = leadWebhook(site, { leadsDb: { kind: "sqlite", path: ":memory:" }, leadWebhook: { url: TARGET.url, keyId: "k", secret: "s" } }, {
      signing: SIGNING,
      buildBody: (l, ctx) => ({ lead: ctx.leadId, place: l.placeSlug }),
      fetch,
      log: quiet(),
    });
    if (!hook) throw new Error("expected the webhook on");
    opened.push(hook.outbox);
    const route = quoteRoute(site, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      webhook: () => hook,
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store,
      defer: task => void deferred.push(task),
      now: () => NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    });

    const res = await route(post());
    expect(res.status).toBe(303);
    expect(hook.outbox.rows()).toMatchObject([{ ref: "lead:1", state: "pending" }]);
    for (const task of deferred.splice(0)) await task();
    expect(seen.map(s => JSON.parse(s.body))).toEqual([{ lead: 1, place: "royat" }]);
    expect(hook.outbox.rows()[0]?.state).toBe("delivered");

    expect((await route(post({ website: "http://spam" }))).status).toBe(303);
    expect(hook.outbox.rows()).toHaveLength(1);
    hook.stop();
  });
});

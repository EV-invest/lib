import { afterEach, describe, expect, it, vi } from "vitest";
import { declarationProblem, declareExperiments, experimentsDeclaredBody, leadWebhook, signWebhook, type LeadWebhook, type WebhookOutbox } from "../src/server/index";
import { fixtureSite } from "./support/fixtures";

const SIGNING = { prefix: "sa-ingest/v1.", headers: { keyId: "x-sa-key-id", timestamp: "x-sa-timestamp", signature: "x-sa-signature" } };
const site = fixtureSite("aquafix");
const AT = new Date("2026-10-04T10:00:00.000Z");
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const experiments = {
  lead_layout: { variants: ["a", "b"], weights: [1, 1] },
  hero: { variants: ["control", "short", "long"], weights: [2, 1, 1], enabled: false, holdout: 0.1 },
} as const;

const opened: WebhookOutbox[] = [];
afterEach(() => {
  for (const o of opened.splice(0)) o.close();
});

function wired(answer = new Response(null, { status: 207 })) {
  const seen: { headers: Headers; body: string }[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    seen.push({ headers: new Headers(init?.headers), body: String(init?.body) });
    return answer.clone();
  });
  const hook = leadWebhook(site, { leadsDb: { kind: "sqlite", path: ":memory:" }, leadWebhook: { url: "http://panel.sa.svc.cluster.local/api/ingest/v1/events", keyId: "aquafix-site", secret: "s3cret" } }, {
    signing: SIGNING,
    buildBody: () => ({}),
    fetch: fetch as unknown as typeof globalThis.fetch,
    now: () => AT.getTime(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  if (!hook) throw new Error("expected the webhook on");
  opened.push(hook.outbox);
  return { hook, seen };
}

describe("experiments.declared@1", () => {
  it("is the panel's envelope with every experiment, in code order", () => {
    const { body, skipped } = experimentsDeclaredBody(experiments, { brandId: "aquafix", sourceId: "aquafix-site", at: AT, summaries: { hero: "A shorter hero converts better" } });
    expect(skipped).toEqual([]);
    const [event] = body.events;
    expect(event.id).toMatch(UUID_V7);
    expect(event).toEqual({
      id: event.id,
      schema: "sa.funnel.v1",
      type: "experiments.declared",
      typeVersion: 1,
      occurredAt: "2026-10-04T10:00:00.000Z",
      source: { kind: "site", id: "aquafix-site" },
      subject: { brandId: "aquafix" },
      properties: {
        experiments: [
          { key: "lead_layout", variants: ["a", "b"], weights: [1, 1], enabled: true },
          { key: "hero", variants: ["control", "short", "long"], weights: [2, 1, 1], enabled: false, holdout: 0.1, summary: "A shorter hero converts better" },
        ],
      },
    });
  });

  it("carries the time in its UUIDv7 and a new id every start", () => {
    const ctx = { brandId: "aquafix", sourceId: "aquafix-site", at: AT };
    const a = experimentsDeclaredBody(experiments, ctx).body.events[0].id;
    const b = experimentsDeclaredBody(experiments, ctx).body.events[0].id;
    expect(a).not.toBe(b);
    expect(parseInt(a.replaceAll("-", "").slice(0, 12), 16)).toBe(AT.getTime());
  });

  it.each([
    ["Lead-Layout", { variants: ["a", "b"], weights: [1, 1] }, undefined, /key/],
    ["k", { variants: ["a"], weights: [1] }, undefined, /two variants/],
    ["k", { variants: ["a", "a"], weights: [1, 1] }, undefined, /twice/],
    ["k", { variants: ["a", "B c"], weights: [1, 1] }, undefined, /slug/],
    ["k", { variants: ["a", "b"], weights: [1] }, undefined, /one weight per variant/],
    ["k", { variants: ["a", "b"], weights: [1, -1] }, undefined, /negative/],
    ["k", { variants: ["a", "b"], weights: [1, Number.NaN] }, undefined, /negative/],
    ["k", { variants: ["a", "b"], weights: [0, 0] }, undefined, /zero/],
    ["k", { variants: ["a", "b"], weights: [1, 1], holdout: 1 }, undefined, /holdout/],
    ["k", { variants: ["a", "b"], weights: [1, 1] }, "x".repeat(201), /summary/],
  ])("leaves out %s: %j", (key, spec, summary, why) => {
    expect(declarationProblem(key, spec, summary)).toMatch(why);
    const { body, skipped } = experimentsDeclaredBody({ [key]: spec, ok: { variants: ["a", "b"], weights: [1, 1] } }, { brandId: "aquafix", sourceId: "s", at: AT, ...(summary ? { summaries: { [key]: summary } } : {}) });
    expect(body.events[0].properties.experiments.map(e => e.key)).toEqual(["ok"]);
    expect(skipped).toEqual([{ key, why: expect.stringMatching(why) }]);
  });
});

describe("declareExperiments", () => {
  it("queues the declaration in the lead outbox and sends it signed, at once", async () => {
    const { hook, seen } = wired();
    const outcome = declareExperiments(() => hook, experiments);
    expect(outcome).toMatchObject({ kind: "queued", skipped: [] });
    await vi.waitFor(() => expect(hook.outbox.rows()).toMatchObject([{ state: "delivered" }]));
    const [sent] = seen;
    if (!sent) throw new Error("nothing sent");
    expect(JSON.parse(sent.body)).toMatchObject({ events: [{ type: "experiments.declared", source: { kind: "site", id: "aquafix-site" }, subject: { brandId: "aquafix" } }] });
    expect(sent.headers.get("x-sa-key-id")).toBe("aquafix-site");
    const ts = sent.headers.get("x-sa-timestamp") ?? "";
    expect(sent.headers.get("x-sa-signature")).toBe(signWebhook("s3cret", SIGNING.prefix, ts, sent.body));
    expect(hook.outbox.rows()[0]?.ref).toMatch(/^experiments:/);
  });

  it("logs what it left out and declares the rest", () => {
    const { hook } = wired();
    const log = { warn: vi.fn(), error: vi.fn() };
    const outcome = declareExperiments(() => hook, { ...experiments, Bad: { variants: ["a", "b"], weights: [1, 1] } }, { log });
    expect(outcome).toMatchObject({ kind: "queued", skipped: [{ key: "Bad" }] });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("Bad is not declared"));
  });

  it("is off without a webhook, and never throws", () => {
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(declareExperiments(() => null, experiments, { log })).toEqual({ kind: "off" });
    expect(
      declareExperiments(
        () => {
          throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
        },
        experiments,
        { log },
      ),
    ).toEqual({ kind: "failed" });
    const broken = { declareExperiments: () => { throw new Error("disk full"); } } as unknown as LeadWebhook;
    expect(declareExperiments(() => broken, experiments, { log })).toEqual({ kind: "failed" });
    expect(log.error).toHaveBeenCalledTimes(2);
  });

  it("is off for a webhook that cannot declare (a brand's own double)", () => {
    const double = { tick: vi.fn() } as unknown as LeadWebhook;
    expect(declareExperiments(() => double, experiments)).toEqual({ kind: "off" });
  });

  it("does not throw when the first send fails: the outbox retries", async () => {
    const { hook } = wired(new Response(null, { status: 503 }));
    const log = { warn: vi.fn(), error: vi.fn() };
    expect(declareExperiments(() => hook, experiments, { log })).toMatchObject({ kind: "queued" });
    await vi.waitFor(() => expect(hook.outbox.rows()).toMatchObject([{ state: "pending", attempts: 1 }]));
  });
});

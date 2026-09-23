import { describe, expect, it, vi } from "vitest";
import { createAcceptLead, RateLimiter, screen, type AcceptDeps, type Lead, type Screening } from "../src/index";
import { fixture, fixtureSite } from "./support/fixtures";

interface Step {
  honeypot: string;
  renderedAt: string | null;
  clientKey: string;
  now: number;
  expected: Screening;
}
interface Case {
  name: string;
  limit: number;
  windowMs: number;
  maxKeys: number;
  steps: Step[];
}

// Shared with the Rust port: one limiter per case, the steps in order.
describe("antispam against the shared fixtures", () => {
  const { cases } = fixture<{ cases: Case[] }>("antispam.json");
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    const limiter = new RateLimiter(c.limit, c.windowMs, c.maxKeys);
    const got = c.steps.map(s => screen({ honeypot: s.honeypot, renderedAt: s.renderedAt, clientKey: s.clientKey, now: s.now, limiter }));
    expect(got).toEqual(c.steps.map(s => s.expected));
  });
});

describe("a script that omits the render stamp", () => {
  it("is rate-limited after the limit, and the rate-limited lead is not notified", async () => {
    const NOW = 1_800_000_000_000;
    const notify = vi.fn(async (_lead: Lead, _id: number) => undefined);
    const deferred: (() => Promise<void> | void)[] = [];
    const site = { ...fixtureSite("aquafix"), lead: { subjects: ["other"], wire: { subject: "job", locality: "zip", mobile: "mobile" } } };
    const accept = createAcceptLead(site);
    const deps: AcceptDeps = {
      insert: async () => 1,
      defer: t => void deferred.push(t),
      notify,
      capture: () => undefined,
      limiter: new RateLimiter(3, 60_000),
      now: NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    };
    const post = () => {
      const f = new FormData();
      for (const [k, v] of Object.entries({ job: "other", zip: "63130", mobile: "0612345678", location: "royat" })) f.set(k, v);
      return accept(f, "1.2.3.4", deps);
    };
    const outcomes = [];
    for (let i = 0; i < 4; i++) outcomes.push(await post());
    expect(outcomes.map(o => (o.kind === "stored" ? o.lead.spamVerdict : o.kind))).toEqual(["too-fast", "too-fast", "too-fast", "rate-limited"]);
    await Promise.all(deferred.map(t => t()));
    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify.mock.calls.every(([lead]) => lead.spamVerdict === "too-fast")).toBe(true);
  });
});

describe("the limiter's bounds", () => {
  it("holds at most maxKeys buckets plus the overflow one", () => {
    const limiter = new RateLimiter(1, 60_000, 100);
    for (let i = 0; i < 1_000; i++) limiter.hit(`k${i}`, 0);
    expect(limiter.size).toBe(101);
  });

  it("sweeps expired windows, at most once a second", () => {
    const limiter = new RateLimiter(1, 1_000, 100);
    for (let i = 0; i < 50; i++) limiter.hit(`k${i}`, 0);
    limiter.hit("late", 500);
    expect(limiter.size).toBe(51);
    limiter.hit("later", 2_000);
    expect(limiter.size).toBe(1);
  });
});

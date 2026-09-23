import { describe, expect, it, vi } from "vitest";
import {
  checkTiming,
  createAcceptLead,
  MIN_FILL_MS,
  RateLimiter,
  readCandidate,
  screen,
  validateCandidate,
  type AcceptDeps,
  type LeadSchema,
} from "../src/index";
import { fixtureSite } from "./support/fixtures";

const NOW = 1_800_000_000_000;

const form = (fields: Record<string, string>, omit: string[] = []): FormData => {
  const data = new FormData();
  const base = { location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "" };
  for (const [k, v] of Object.entries({ ...base, ...fields })) if (!omit.includes(k)) data.set(k, v);
  return data;
};

/** Aquafix's schema: the Rust form's field names, and a reachable number required. */
const PLUMBING: LeadSchema<"blocked_drain" | "other"> = {
  subjects: ["blocked_drain", "other"],
  wire: { subject: "job", locality: "zip", mobile: "mobile" },
  validate: lead => {
    if (lead.mobile.replace(/\D/g, "").length < 10) return "a mobile number we can text the price to";
    if (lead.locality.trim() === "") return "the town or postcode we would drive to";
    return null;
  },
};

const site = { ...fixtureSite("aquafix"), lead: PLUMBING };
const acceptLead = createAcceptLead(site);
const good = { job: "blocked_drain", zip: "63130", mobile: "06 12 34 56 78" };

function deps(over: Partial<AcceptDeps> = {}) {
  const deferred: (() => Promise<void> | void)[] = [];
  const log = { warn: vi.fn(), error: vi.fn() };
  const d: AcceptDeps = {
    insert: async () => 1,
    defer: task => void deferred.push(task),
    notify: async () => undefined,
    capture: () => undefined,
    limiter: new RateLimiter(5, 60_000),
    now: NOW,
    log,
    ...over,
  };
  return { d, deferred, log, flush: () => Promise.all(deferred.map(t => t())) };
}

describe("the lead schema", () => {
  it("reads a form under the brand's field names", () => {
    expect(readCandidate(PLUMBING, form({ job: " hot_water ", zip: "63130", mobile: "0612345678" }), "royat")).toEqual({
      subject: "hot_water",
      locality: "63130",
      mobile: "0612345678",
      extras: {},
      placeSlug: "royat",
    });
  });

  it("reads a brand's extras, capped at their own limit, and leaves out the empty ones", () => {
    const cleaning: LeadSchema<"flat"> = {
      subjects: ["flat"],
      wire: { subject: "kind", locality: "city", mobile: "phone" },
      extras: [
        { name: "surface_m2", max: 4 },
        { name: "notes", max: 500 },
      ],
    };
    const lead = readCandidate(cleaning, form({ kind: "flat", surface_m2: "123456", notes: "  " }), null);
    expect(lead.extras).toEqual({ surface_m2: "1234" });
    expect(readCandidate(cleaning, form({ notes: "n".repeat(600) }), null).extras["notes"]).toHaveLength(500);
    expect(validateCandidate(cleaning, lead)).toBeNull();
  });
});

describe("the form's barriers", () => {
  it("catches the honeypot", () => {
    const limiter = new RateLimiter(5, 60_000);
    const at = { renderedAt: String(NOW - 10_000), clientKey: "a", now: NOW, limiter };
    expect(screen({ ...at, honeypot: "http://spam" })).toBe("honeypot");
    expect(screen({ ...at, honeypot: "" })).toBe("ok");
  });

  it("rejects a form filled faster than a person can, a missing stamp and a forged future one", () => {
    expect(checkTiming(String(NOW - MIN_FILL_MS + 1), NOW)).toBe("too-fast");
    expect(checkTiming(String(NOW - MIN_FILL_MS), NOW)).toBe("ok");
    expect(checkTiming(null, NOW)).toBe("too-fast");
    expect(checkTiming("soon", NOW)).toBe("too-fast");
    expect(checkTiming(String(NOW + 120_000), NOW)).toBe("too-fast");
  });

  it("limits one address per window and forgets it after", () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.hit("1.2.3.4", NOW)).toBe(true);
    expect(limiter.hit("1.2.3.4", NOW + 1)).toBe(true);
    expect(limiter.hit("1.2.3.4", NOW + 2)).toBe(false);
    expect(limiter.hit("5.6.7.8", NOW + 3)).toBe(true);
    expect(limiter.hit("1.2.3.4", NOW + 60_000)).toBe(true);
  });
});

describe("accepting a lead", () => {
  it("stores the lead before anything else, and a failed notification does not lose it", async () => {
    const rows: unknown[] = [];
    const { d, flush, log } = deps({
      insert: async l => rows.push(l),
      notify: async () => {
        throw new Error("SMTP down");
      },
    });
    expect(await acceptLead(form(good), "1.2.3.4", d)).toMatchObject({ kind: "stored", id: 1, lead: { placeSlug: "royat", spamVerdict: null } });
    expect(rows).toHaveLength(1);
    await flush();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("notification failed"), expect.any(Error));
  });

  it("never reports a stored lead the store refused", async () => {
    const { d, deferred } = deps({
      insert: async () => {
        throw new Error("disk full");
      },
    });
    expect(await acceptLead(form(good), "1.2.3.4", d)).toMatchObject({ kind: "failed" });
    expect(deferred).toHaveLength(0);
  });

  it("rejects a lead with no reachable number without storing it or spending the limit", async () => {
    const insert = vi.fn(async () => 1);
    const { d } = deps({ insert, limiter: new RateLimiter(1, 60_000) });
    expect(await acceptLead(form({ ...good, mobile: "0612" }), "1.2.3.4", d)).toMatchObject({ kind: "invalid" });
    expect(await acceptLead(form({ ...good, zip: " " }), "1.2.3.4", d)).toMatchObject({ kind: "invalid" });
    expect(insert).not.toHaveBeenCalled();
    expect(await acceptLead(form(good), "1.2.3.4", d)).toMatchObject({ kind: "stored", lead: { spamVerdict: null } });
  });

  it("keeps a honeypot submission, flagged and neither notified nor captured", async () => {
    const notify = vi.fn(async () => undefined);
    const capture = vi.fn();
    const { d, flush } = deps({ notify, capture });
    expect(await acceptLead(form({ ...good, website: "http://spam" }), "1.2.3.4", d)).toMatchObject({ kind: "stored", lead: { spamVerdict: "honeypot" } });
    await flush();
    expect(notify).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    ["a fast submit", { t: String(NOW - 500) }, []],
    ["an empty stamp", { t: "" }, []],
    ["the Rust form, which had no stamp", {}, ["t"]],
  ] as const)("flags %s as too-fast and still notifies", async (_, fields, omit) => {
    const notify = vi.fn(async () => undefined);
    const { d, flush } = deps({ notify });
    expect(await acceptLead(form({ ...good, ...fields }, [...omit]), "1.2.3.4", d)).toMatchObject({ lead: { spamVerdict: "too-fast" } });
    await flush();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ spamVerdict: "too-fast" }), 1);
  });

  it("keeps a rate-limited submission flagged, per client key", async () => {
    const { d } = deps({ limiter: new RateLimiter(1, 60_000) });
    expect(await acceptLead(form(good), "1.2.3.4", d)).toMatchObject({ lead: { spamVerdict: null } });
    expect(await acceptLead(form(good), "1.2.3.4", d)).toMatchObject({ lead: { spamVerdict: "rate-limited" } });
    expect(await acceptLead(form(good), "5.6.7.8", d)).toMatchObject({ lead: { spamVerdict: null } });
  });

  it.each([
    ["an unknown place", { location: "paris" }, []],
    ["no place at all", {}, ["location"]],
  ] as const)("stores a lead from %s without one", async (_, fields, omit) => {
    const { d } = deps({ insert: async () => 7 });
    expect(await acceptLead(form({ ...good, ...fields }, [...omit]), "1.2.3.4", d)).toMatchObject({ kind: "stored", id: 7, lead: { placeSlug: null } });
  });

  it("falls back to the default locale for a forged one", async () => {
    const { d } = deps();
    expect(await acceptLead(form({ ...good, locale: "xx" }), "k", d)).toMatchObject({ locale: "fr" });
  });

  it("records the submission for analytics only after it is stored", async () => {
    const capture = vi.fn();
    const { d, flush } = deps({ capture });
    await acceptLead(form(good), "1.2.3.4", d);
    expect(capture).not.toHaveBeenCalled();
    await flush();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ placeSlug: "royat" }), "quote");
  });
});

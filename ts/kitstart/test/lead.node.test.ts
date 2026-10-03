import { describe, expect, it, vi } from "vitest";
import {
  checkTiming,
  createAcceptLead,
  MIN_FILL_MS,
  phoneProblem,
  RateLimiter,
  readCandidate,
  screen,
  validateCandidate,
  validateLead,
  type AcceptDeps,
  type Lead,
  type LeadSchema,
} from "../src/index";
import { leadRuleDisagreements, PHONE_MATRIX } from "../src/testing/index";
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
      channel: "form",
    });
  });

  it("keeps the mobile in E.164 when the brand asks, and as typed when it cannot read it", () => {
    const e164 = { ...PLUMBING, mobileFormat: "e164" } as const;
    expect(readCandidate(e164, form({ ...good, mobile: "06 12 34 56 78" }), null).mobile).toBe("+33612345678");
    expect(readCandidate(e164, form({ ...good, mobile: " 06 12 " }), null).mobile).toBe("06 12");
    expect(readCandidate(PLUMBING, form({ ...good, mobile: "06 12 34 56 78" }), null).mobile).toBe("06 12 34 56 78");
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
    // No rule of its own: the kit's, which asks only for a number to call.
    expect(validateCandidate(cleaning, lead)).toMatchObject({ field: "phone" });
    expect(validateCandidate(cleaning, { ...lead, mobile: "06 12 34 56 78" })).toBeNull();
  });
});

describe("the phone rule the form and the server share", () => {
  // The review's matrix (LEAD-FORMS-REVIEW-2026-10-03 §1): each number, and
  // whether a person typing it gave us a way to reach them.
  const kit: LeadSchema<"other"> = { subjects: ["other"], wire: { subject: "job", locality: "zip", mobile: "mobile" } };
  const candidate = (mobile: string, channel: "form" | "callback") =>
    readCandidate(kit, form({ job: "other", zip: "63130", mobile, ...(channel === "callback" ? { channel, consent: "oui" } : {}) }), null);

  it("client and server phone rules agree on every number of the matrix", () => {
    for (const { mobile, valid } of PHONE_MATRIX) {
      expect(phoneProblem(mobile) === null, `client: ${mobile}`).toBe(valid);
      expect(validateCandidate(kit, candidate(mobile, "form"))?.field ?? null, `form: ${mobile}`).toBe(valid ? null : "phone");
      expect(validateCandidate(kit, candidate(mobile, "callback"))?.field ?? null, `callback: ${mobile}`).toBe(valid ? null : "phone");
    }
  });

  it("reads full-width digits and refuses a run of one digit", () => {
    expect(phoneProblem("\uff10\uff16\uff11\uff12\uff13\uff14\uff15\uff16\uff17\uff18")).toBeNull();
    expect(phoneProblem("06 66 66 66 66")).toBe("invalid");
    expect(phoneProblem("+33 6 66 66 66 66")).toBe("invalid");
    expect(phoneProblem("   ")).toBe("required");
  });

  it("is the default rule, which a brand composes with its own and the contract holds to the form's", () => {
    expect(leadRuleDisagreements(kit)).toEqual([]);
    expect(leadRuleDisagreements({ ...kit, validate: lead => validateLead(lead) ?? (lead.locality === "" ? { field: "locality", why: "a postcode" } : null) })).toEqual([]);
    // The rule brands shipped before: ten digits, whatever they spell.
    expect(leadRuleDisagreements(PLUMBING)).toEqual(expect.arrayContaining([expect.stringContaining("+12345678"), expect.stringContaining("0000000000")]));
  });

  it("names the field a brand's plain reason is about as the whole form", () => {
    expect(validateCandidate(PLUMBING, readCandidate(PLUMBING, form({ ...good, zip: " " }), null))).toEqual({ field: "form", why: "the town or postcode we would drive to" });
    const odd: LeadSchema<"other"> = { ...kit, validate: () => ({ field: "Not A Slug", why: "x" }) };
    expect(validateCandidate(odd, candidate("0612345678", "form"))?.field).toBe("form");
  });

  it("collapses control characters and line breaks in a single-line field, and keeps a multi-line extra's lines", () => {
    const notes: LeadSchema<"other"> = { ...kit, extras: [{ name: "floor", max: 50 }, { name: "notes", max: 500, multiline: true }] };
    const lead = readCandidate(notes, form({ job: "other", zip: "63130\r\nMobile : 0700000000", mobile: "06 12\t34 56 78", floor: "2\u0000\u2028nd", notes: "line one\nline\u0007 two" }), null);
    expect(lead.locality).toBe("63130 Mobile : 0700000000");
    expect(lead.mobile).toBe("06 12 34 56 78");
    expect(lead.extras).toEqual({ floor: "2 nd", notes: "line one\nline two" });
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
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ placeSlug: "royat" }), "quote", {});
  });
});

describe("a repeated submission", () => {
  const SID = "3f2b8c1e-5d4a-4f6b-9c7e-1a2b3c4d5e6f";
  /** A store that keeps rows by submission id, as the SQLite one does under its unique index. */
  function keeping() {
    const rows: Lead[] = [];
    const findSubmission = async (sid: string) => {
      const at = rows.findIndex(r => r.submissionId === sid);
      return at === -1 ? null : { id: at + 1, lead: rows[at] as Lead };
    };
    const insert = vi.fn(async (lead: Lead) => {
      if (lead.submissionId && rows.some(r => r.submissionId === lead.submissionId)) throw new Error("UNIQUE constraint failed: leads.submission_id");
      return rows.push(lead);
    });
    return { rows, insert, findSubmission };
  }

  // LEAD-FORMS-REVIEW-2026-10-03 #3: a lost answer and a resend made two leads.
  it("dedupes a repeated submission id: one row, the same answer, nothing sent twice", async () => {
    const store = keeping();
    const notify = vi.fn(async () => undefined);
    const enqueue = vi.fn();
    const { d, flush } = deps({ insert: store.insert, findSubmission: store.findSubmission, notify, enqueue, limiter: new RateLimiter(1, 60_000) });
    const first = await acceptLead(form({ ...good, submission_id: SID }), "k", d);
    const again = await acceptLead(form({ ...good, submission_id: SID }), "k", d);
    expect(first).toMatchObject({ kind: "stored", id: 1, lead: { submissionId: SID, spamVerdict: null } });
    // Not rate-limited: a resend is not a second hit.
    expect(again).toMatchObject({ kind: "stored", id: 1, duplicate: true, lead: { submissionId: SID, spamVerdict: null } });
    await flush();
    expect(store.rows).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("answers the loser of a race with the winner's row", async () => {
    const store = keeping();
    let looked = 0;
    // The lookup misses (both requests look before either writes); the insert's unique index catches it.
    const findSubmission = async (sid: string) => (looked++ === 0 ? null : store.findSubmission(sid));
    await store.insert({ ...readCandidate(PLUMBING, form({ ...good, submission_id: SID }), "royat"), spamVerdict: null, submissionId: SID });
    const { d } = deps({ insert: store.insert, findSubmission });
    expect(await acceptLead(form({ ...good, submission_id: SID }), "k", d)).toMatchObject({ kind: "stored", id: 1, duplicate: true });
    expect(store.rows).toHaveLength(1);
  });

  it("ignores a submission id that is not one", async () => {
    const { d } = deps();
    const out = await acceptLead(form({ ...good, submission_id: "x'; DROP" }), "k", d);
    expect(out.kind === "stored" && "submissionId" in out.lead).toBe(false);
  });
});

describe("a callback request", () => {
  const SAID = "J’accepte d’être rappelé·e à ce numéro au sujet de ma demande.";
  const callback = { channel: "callback", mobile: "06 12 34 56 78", consent: SAID };

  it("is a lead with the callback channel, refused only for want of a number", async () => {
    const { d } = deps();
    // No job, no postcode: the brand's form rule would refuse it; the callback rule does not.
    expect(await acceptLead(form(callback), "k", d)).toMatchObject({ kind: "stored", lead: { channel: "callback", mobile: "06 12 34 56 78", locality: "" } });
    expect(await acceptLead(form({ ...callback, mobile: "06 12" }), "k", d)).toMatchObject({ kind: "invalid", field: "phone", channel: "callback" });
  });

  it("keeps the consent sentence as posted and stamps when the server accepted it", async () => {
    const { d } = deps();
    const out = await acceptLead(form(callback), "k", d);
    expect(out).toMatchObject({ kind: "stored", lead: { consent: { text: SAID, at: new Date(NOW).toISOString() } } });
  });

  it("refuses a callback without the consent, before storing anything — whatever the brand's rule says", async () => {
    const insert = vi.fn(async () => 1);
    const lenient = createAcceptLead({ ...site, lead: { ...PLUMBING, validateCallback: () => null } });
    for (const consent of [[], ["consent"]] as const) {
      const { d } = deps({ insert });
      const posted = consent.length ? form({ ...callback, consent: "  " }) : form(callback, ["consent"]);
      expect(await lenient(posted, "k", d)).toMatchObject({ kind: "invalid", field: "consent", why: "consent to be called back" });
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps no consent on a form lead, even when one is posted", async () => {
    const { d } = deps();
    const out = await acceptLead(form({ ...good, consent: SAID }), "k", d);
    expect(out.kind === "stored" && "consent" in out.lead).toBe(false);
  });

  it("takes the brand's own callback rule when it has one", async () => {
    const strict = createAcceptLead({ ...site, lead: { ...PLUMBING, validateCallback: () => "never" } });
    const { d } = deps();
    expect(await strict(form(callback), "k", d)).toMatchObject({ kind: "invalid", why: "never", field: "form" });
  });

  it("is a form lead when the channel is absent or anything else", () => {
    expect(readCandidate(PLUMBING, form(good), null).channel).toBe("form");
    expect(readCandidate(PLUMBING, form({ ...good, channel: "sms" }), null).channel).toBe("form");
  });
});

describe("the submit's experiment tags", () => {
  it("carry the site's assignment when it is a pair of slugs, and nothing else", async () => {
    const capture = vi.fn();
    const { d, flush } = deps({ capture });
    await acceptLead(form({ ...good, experiment: "lead_layout", variant: "qualify-first" }), "a", d);
    await acceptLead(form({ ...good, experiment: "lead_layout", variant: "06 12 34 56 78" }), "b", d);
    await acceptLead(form({ ...good, experiment: "lead_layout" }), "c", d);
    await flush();
    expect(capture.mock.calls.map(c => c[2])).toEqual([{ experiment: "lead_layout", variant: "qualify-first" }, {}, {}]);
  });
});

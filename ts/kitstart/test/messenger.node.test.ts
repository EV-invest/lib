import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  channelHref,
  channelsAvailable,
  contactOf,
  createAcceptLead,
  defineSite,
  LEAD_CAPTURE_MESSENGER_TEXT,
  MAX_MESSENGER_MESSAGE,
  MESSAGE_REF,
  mergeLive,
  messageRefOf,
  messengerFacts,
  messengerMessage,
  newMessageRef,
  parsePlaceLive,
  parsePricingModel,
  RateLimiter,
  readCandidate,
  telegramHref,
  validateCandidate,
  validateLead,
  type AcceptDeps,
  type Lead,
  type LeadSchema,
  type PricingModel,
} from "../src/index";
import { quoteRoute } from "../src/next/index";
import { defaultLeadMail, leadWebhook, openSqliteLeadStore, type LeadWebhookContext, type WebhookOutbox } from "../src/server/index";
import { messengerRuleDisagreements } from "../src/testing/index";
import { serviceAreaPlace, storefrontPlace } from "../src/testing/fixtures";
import { fixtureSite } from "./support/fixtures";

const FR = LEAD_CAPTURE_MESSENGER_TEXT.fr;
const NOW = 1_800_000_000_000;
const bytes = (...values: number[]) => () => Uint8Array.from(values);

describe("the message reference", () => {
  it("is the brand's prefix and four Crockford symbols, the panel's own rule", () => {
    expect(newMessageRef("AQ", bytes(0, 31, 32, 255))).toBe("AQ-0Z0Z");
    expect(newMessageRef("VF", bytes(7, 20, 3, 15))).toBe("VF-7M3F");
    expect(newMessageRef("AQ")).toMatch(MESSAGE_REF);
    expect(newMessageRef("ABCD")).toMatch(/^ABCD-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("refuses a prefix that is not two to four capital letters", () => {
    for (const prefix of ["aq", "A", "ABCDE", "A1", "", "AQ-"]) expect(() => newMessageRef(prefix), prefix).toThrow(/prefix/);
  });

  it("reads a posted reference in any case and drops anything that is not one", () => {
    expect(messageRefOf(" aq-7k3f ")).toBe("AQ-7K3F");
    expect(messageRefOf("VF-7K3F9ABC")).toBe("VF-7K3F9ABC");
    expect(messageRefOf("AQ-7K3I")).toBeNull();
    expect(messageRefOf("AQ-7K3")).toBeNull();
    expect(messageRefOf("AQ-7K3F\n<b>")).toBeNull();
    expect(messageRefOf("A-7K3F")).toBeNull();
    expect(messageRefOf(42)).toBeNull();
    expect(messageRefOf(null)).toBeNull();
  });
});

describe("the prefilled message", () => {
  it("leaves out a line without its value, the reference last", () => {
    expect(messengerMessage({ brand: "Aquafix", need: "Fuite d’eau", postcode: " ", price: null, ref: "AQ-7K3F" }, FR)).toBe(
      "Bonjour Aquafix 👋\nJe souhaite un devis : Fuite d’eau\nRéf. AQ-7K3F",
    );
    expect(messengerMessage({ brand: "Aquafix", need: "Fuite d’eau", postcode: "63130", price: "≈ 77 €", timing: "aujourd’hui", ref: "AQ-7K3F" }, FR)).toBe(
      [
        "Bonjour Aquafix 👋",
        "Je souhaite un devis : Fuite d’eau",
        "Code postal : 63130",
        "Estimation vue sur le site : ≈ 77 €",
        "Délai souhaité : aujourd’hui",
        "Réf. AQ-7K3F",
      ].join("\n"),
    );
    expect(messengerMessage({ brand: "Aquafix" }, FR)).toBe("Bonjour Aquafix 👋");
  });

  it("stays within 400 characters, cutting the optional lines from the bottom and keeping the greeting and the reference", () => {
    const long = (c: string) => c.repeat(120);
    const message = messengerMessage({ brand: "Aquafix", need: long("n"), postcode: long("p"), price: long("e"), timing: long("t"), ref: "AQ-7K3F" }, FR);
    expect(MAX_MESSENGER_MESSAGE).toBe(400);
    expect(message.length).toBeLessThanOrEqual(400);
    expect(message.split("\n")).toEqual([
      "Bonjour Aquafix 👋",
      `Je souhaite un devis : ${"n".repeat(80)}`,
      `Code postal : ${"p".repeat(80)}`,
      `Estimation vue sur le site : ${"e".repeat(80)}`,
      "Réf. AQ-7K3F",
    ]);
  });

  it("makes every value one line: control characters and line separators are gone", () => {
    const [lineSeparator, paragraphSeparator] = [String.fromCharCode(0x2028), String.fromCharCode(0x2029)];
    const message = messengerMessage({ brand: `Aqua\u0007fix${paragraphSeparator}`, need: `Fuite\u0000${lineSeparator}d’eau\r\nMobile : 0612345678`, postcode: "63130\u0085", ref: "AQ-7K3F" }, FR);
    expect(message.split("\n")).toEqual(["Bonjour Aqua fix 👋", "Je souhaite un devis : Fuite d’eau Mobile : 0612345678", "Code postal : 63130", "Réf. AQ-7K3F"]);
    expect([...message].filter(ch => ch !== "\n" && (ch < " " || (ch >= "\u007f" && ch <= "\u009f") || ch === lineSeparator || ch === paragraphSeparator))).toEqual([]);
  });
});

describe("the Telegram link and the messengers a card offers", () => {
  it("opens the bot with the reference as its start parameter", () => {
    expect(telegramHref("aquafix_devis_bot", "AQ-7K3F")).toBe("https://t.me/aquafix_devis_bot?start=AQ-7K3F");
    expect(telegramHref("@aquafix_devis_bot")).toBe("https://t.me/aquafix_devis_bot");
    expect(channelHref("telegram", { phone: null, whatsapp: null, telegram: "aquafix_devis_bot" }, "AQ-7K3F")).toBe("https://t.me/aquafix_devis_bot?start=AQ-7K3F");
    expect(channelHref("telegram", { phone: "+33612345678", whatsapp: "+33612345678", telegram: null }, "AQ-7K3F")).toBeNull();
  });

  it("leaves off a start parameter the bot would not read", () => {
    expect(telegramHref("aquafix_devis_bot", "AQ 7K3F")).toBe("https://t.me/aquafix_devis_bot");
    expect(telegramHref("aquafix_devis_bot", "AQ-7K3F&x=1")).toBe("https://t.me/aquafix_devis_bot");
    expect(telegramHref("aquafix_devis_bot", "a".repeat(65))).toBe("https://t.me/aquafix_devis_bot");
    expect(telegramHref("aquafix_devis_bot", "")).toBe("https://t.me/aquafix_devis_bot");
  });

  it("says which messengers were offered, in four words", () => {
    expect(channelsAvailable({ whatsapp: "+33612345678", telegram: "aquafix_devis_bot" })).toBe("wa,tg");
    expect(channelsAvailable({ whatsapp: "+33612345678", telegram: null })).toBe("wa");
    expect(channelsAvailable({ whatsapp: null, telegram: "aquafix_devis_bot" })).toBe("tg");
    expect(channelsAvailable({ whatsapp: null, telegram: null })).toBe("none");
    expect(channelsAvailable(undefined)).toBe("none");
  });
});

/** Aquafix's schema: the form's field names, the kit's phone rule. */
const KIT: LeadSchema<"leak" | "other"> = { subjects: ["leak", "other"], wire: { subject: "job", locality: "zip", mobile: "mobile" } };

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [k, v] of Object.entries({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", ...fields })) data.set(k, v);
  return data;
};

describe("a messenger lead, read and judged", () => {
  it("is taken with the need alone: no postcode, no phone, no consent", () => {
    for (const channel of ["whatsapp", "telegram"] as const) {
      const lead = readCandidate(KIT, form({ job: "leak", channel, message_ref: "aq-7k3f" }), "royat");
      expect(lead).toEqual({ subject: "leak", locality: "", mobile: "", extras: {}, placeSlug: "royat", channel, messageRef: "AQ-7K3F" });
      expect(validateCandidate(KIT, lead)).toBeNull();
    }
  });

  it("still holds a typed phone to the form's rule, at the phone field", () => {
    const lead = readCandidate(KIT, form({ job: "leak", channel: "whatsapp", mobile: "06 12" }), null);
    expect(validateCandidate(KIT, lead)).toEqual({ field: "phone", why: "a phone number we can call" });
    expect(validateCandidate(KIT, readCandidate(KIT, form({ job: "leak", channel: "telegram", mobile: "06 12 34 56 78" }), null))).toBeNull();
  });

  it("is a form lead, held to the phone, when the channel is not one the kit knows", () => {
    const lead = readCandidate(KIT, form({ job: "leak", channel: "signal" }), null);
    expect(lead.channel).toBe("form");
    expect(validateCandidate(KIT, lead)).toMatchObject({ field: "phone" });
  });

  it("keeps no consent, even when one is posted", () => {
    const lead = readCandidate(KIT, form({ job: "leak", channel: "whatsapp", consent: "J’accepte." }), null);
    expect(lead).not.toHaveProperty("consentText");
  });

  it("drops a reference that is not one and keeps the lead", () => {
    const lead = readCandidate(KIT, form({ job: "leak", channel: "whatsapp", message_ref: "<script>" }), null);
    expect(lead).not.toHaveProperty("messageRef");
    expect(validateCandidate(KIT, lead)).toBeNull();
  });

  it("agrees with the default rule, and finds a brand rule that asks a messenger lead for a postcode", () => {
    expect(messengerRuleDisagreements(KIT)).toEqual([]);
    expect(messengerRuleDisagreements({ ...KIT, validate: lead => validateLead(lead) })).toEqual([]);
    const postcodeFirst: LeadSchema<"leak" | "other"> = { ...KIT, validate: lead => (lead.locality === "" ? { field: "locality", why: "a postcode" } : validateLead(lead)) };
    expect(messengerRuleDisagreements(postcodeFirst)).toEqual(
      expect.arrayContaining([
        "whatsapp: a lead with no postcode and no phone is refused at locality (a postcode)",
        "telegram: a lead with no postcode and no phone is refused at locality (a postcode)",
      ]),
    );
  });
});

describe("accepting a messenger lead", () => {
  const site = { ...fixtureSite("aquafix"), lead: KIT };
  function deps() {
    const deferred: (() => Promise<void> | void)[] = [];
    const capture = vi.fn<AcceptDeps["capture"]>();
    const d: AcceptDeps = {
      insert: async () => 1,
      defer: task => void deferred.push(task),
      notify: async () => undefined,
      capture,
      limiter: new RateLimiter(5, 60_000),
      now: NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    };
    return { d, capture, flush: () => Promise.all(deferred.map(t => t())) };
  }

  it("stores it with its channel and reference, and tags the submit with the messengers the card offered", async () => {
    const { d, capture, flush } = deps();
    const out = await createAcceptLead(site)(form({ job: "leak", channel: "whatsapp", message_ref: "AQ-7K3F", channels_available: "wa,tg" }), "k", d);
    expect(out).toMatchObject({ kind: "stored", lead: { channel: "whatsapp", messageRef: "AQ-7K3F", mobile: "", locality: "" } });
    expect(out).not.toHaveProperty("lead.consent");
    await flush();
    expect(capture).toHaveBeenCalledWith(expect.objectContaining({ messageRef: "AQ-7K3F" }), "quote", { channels_available: "wa,tg" });
  });

  it("drops a channels_available that is not one of the four", async () => {
    const { d, capture, flush } = deps();
    await createAcceptLead(site)(form({ job: "leak", channel: "telegram", channels_available: "wa,tg,sms" }), "k", d);
    await flush();
    expect(capture.mock.calls[0]?.[2]).toEqual({});
  });
});

describe("the quote route and a messenger lead", () => {
  const BAKED = parsePricingModel(JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/pricing/valid/cleaning.json"), "utf8")));
  const LIVE: PricingModel = { ...BAKED, validFrom: "2026-11-01", minimumCents: 9900 };
  const aquafix = fixtureSite("aquafix");
  const priced = defineSite({ ...aquafix, lead: { ...aquafix.lead, subjects: ["standard", "other"], flows: { standard: "estimate" } }, pricing: BAKED });
  const ESTIMATE = { estimate_zone: "proche", estimate_bedrooms: "t3", estimate_surface: "s70", estimate_frequency: "biweekly" };
  const post = (fields: Record<string, string>) =>
    new Request("https://aquafix.top/quote", {
      method: "POST",
      body: new URLSearchParams({ location: "royat", locale: "fr", form_id: "quote", t: String(NOW - 10_000), website: "", ...fields }),
      headers: { host: "royat.aquafix.top", "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    });
  const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

  afterEach(() => vi.unstubAllGlobals());

  // The visitor has left for the chat when the lead lands: nobody is there to
  // confirm a fresh price, so the server's is taken.
  it("takes a priced messenger lead shown at a stale price, at the server's price", async () => {
    const store = openSqliteLeadStore(":memory:");
    const route = quoteRoute(priced, {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: null, posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => store,
      defer: () => undefined,
      now: () => NOW,
      log: { warn: vi.fn(), error: vi.fn() },
      pricing: { model: async () => LIVE },
    });
    const res = await route(post({ job: "standard", channel: "whatsapp", message_ref: "AQ-7K3F", shown_cents: "8400", submission_id: sid(1), ...ESTIMATE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, cents: 9900 });
    expect((await store.findSubmission(sid(1)))?.lead).toMatchObject({ channel: "whatsapp", messageRef: "AQ-7K3F", price: { cents: 9900 } });
    // The same stale price on the form is still sent back to confirm.
    const form = await route(post({ job: "standard", mobile: "0612345678", zip: "63130", shown_cents: "8400", submission_id: sid(2), ...ESTIMATE }));
    expect(await form.json()).toMatchObject({ ok: false, field: "price_changed", cents: 9900 });
  });

  it("counts the submit with its reference and the messengers offered, and nothing typed", async () => {
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const route = quoteRoute(fixtureSite("aquafix"), {
      env: () => ({ leadsDb: { kind: "sqlite", path: ":memory:" }, posthogKey: "phc_test", posthogHost: "https://eu.i.posthog.com", trustedProxy: null }),
      notifier: () => ({ notify: async () => undefined }),
      unavailable: () => ({ title: "", heading: "", body: "", callLabel: "" }),
      store: () => openSqliteLeadStore(":memory:"),
      defer: task => void task(),
      now: () => NOW,
      log: { warn: vi.fn(), error: vi.fn() },
    });
    await route(post({ job: "other", zip: "63130", mobile: "0612345678", channel: "telegram", message_ref: "AQ-7K3F", channels_available: "wa,tg", submission_id: sid(3) }));
    const [, body] = beacon.mock.calls[0] ?? [];
    expect(JSON.parse(body ?? "null")).toMatchObject({
      event: "lead_form_submit",
      properties: { form_id: "quote", channel: "telegram", message_ref: "AQ-7K3F", channels_available: "wa,tg", location_id: "royat" },
    });
    expect(body).not.toMatch(/0612345678|\+33612345678|63130/);
  });
});

const lead = (over: Partial<Lead> = {}): Lead => ({ subject: "leak", locality: "", mobile: "", extras: {}, placeSlug: "royat", spamVerdict: null, ...over });

describe("the sqlite store and a messenger lead", () => {
  const sqlite = () => {
    const mod = process.getBuiltinModule("node:sqlite");
    if (!mod) throw new Error("node:sqlite missing");
    return mod;
  };
  const tmp = () => join(mkdtempSync(join(tmpdir(), "kitstart-messenger-")), "leads.db");

  it("brings a version 7 file to 8, its rows kept with no reference", async () => {
    const path = tmp();
    const old = new (sqlite().DatabaseSync)(path);
    old.exec(`CREATE TABLE leads (id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT NOT NULL, zip TEXT NOT NULL, mobile TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')),
      location_id TEXT, spam_verdict TEXT, extras TEXT, channel TEXT, consent_at TEXT, consent_text TEXT, submission_id TEXT,
      flow TEXT, quoted_cents INTEGER, pricing_valid_from TEXT, estimate_inputs TEXT)`);
    old.exec("CREATE UNIQUE INDEX leads_submission_id ON leads (submission_id) WHERE submission_id IS NOT NULL");
    old.exec("INSERT INTO leads (job, zip, mobile, channel, submission_id) VALUES ('other', '63130', '+33612345678', 'form', '00000000-0000-4000-8000-000000000001')");
    old.exec("PRAGMA user_version = 7");
    old.close();
    const store = openSqliteLeadStore(path);
    expect(store.version()).toBe(8);
    const before = await store.findSubmission("00000000-0000-4000-8000-000000000001");
    expect(before?.lead).not.toHaveProperty("messageRef");
    expect(before?.lead.channel).toBe("form");
    await store.close();
  });

  it("keeps a lead's reference and its messenger channel, and reads them back", async () => {
    const store = openSqliteLeadStore(":memory:");
    const sid = "00000000-0000-4000-8000-000000000002";
    const id = await store.insert(lead({ channel: "telegram", messageRef: "VF-7K3F", submissionId: sid }));
    expect(await store.findSubmission(sid)).toEqual({ id, lead: lead({ channel: "telegram", messageRef: "VF-7K3F", submissionId: sid }) });
    const wa = "00000000-0000-4000-8000-000000000003";
    await store.insert(lead({ channel: "whatsapp", submissionId: wa }));
    expect((await store.findSubmission(wa))?.lead).toEqual(lead({ channel: "whatsapp", submissionId: wa }));
    await store.close();
  });
});

describe("the webhook and a messenger lead", () => {
  const opened: WebhookOutbox[] = [];
  afterEach(() => {
    for (const o of opened.splice(0)) o.close();
  });

  function hook(panelMessenger: boolean | undefined) {
    const seen: LeadWebhookContext[] = [];
    const h = leadWebhook(fixtureSite("aquafix"), { leadsDb: { kind: "sqlite", path: ":memory:" }, leadWebhook: { url: "http://panel.local/ingest", keyId: "k", secret: "s" } }, {
      signing: { prefix: "p.", headers: { keyId: "x-k", timestamp: "x-t", signature: "x-s" } },
      buildBody: (_lead, ctx) => (seen.push(ctx), {}),
      fetch: vi.fn(async () => new Response(null, { status: 200 })),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      ...(panelMessenger === undefined ? {} : { panelMessenger }),
    });
    if (!h) throw new Error("expected the webhook on");
    opened.push(h.outbox);
    return { h, seen };
  }

  it("sends a messenger lead as a form, without its reference, until the panel takes messengers", () => {
    for (const off of [undefined, false]) {
      const { h, seen } = hook(off);
      expect(h.panelMessenger).toBe(false);
      h.enqueue(lead({ channel: "whatsapp", messageRef: "AQ-7K3F" }), 1, { locale: "fr", formId: "quote" });
      expect(seen[0]?.channel).toBe("form");
      expect(seen[0]).not.toHaveProperty("messageRef");
    }
  });

  it("sends the channel and the reference once the panel takes them", () => {
    const { h, seen } = hook(true);
    h.enqueue(lead({ channel: "whatsapp", messageRef: "AQ-7K3F" }), 1, { locale: "fr", formId: "quote" });
    h.enqueue(lead({ channel: "telegram" }), 2, { locale: "fr", formId: "quote" });
    h.enqueue(lead({ channel: "callback", mobile: "0612345678" }), 3, { locale: "fr", formId: "quote" });
    expect(seen.map(c => [c.channel, c.messageRef ?? null])).toEqual([
      ["whatsapp", "AQ-7K3F"],
      ["telegram", null],
      ["callback", null],
    ]);
  });
});

describe("the lead mail for a messenger lead", () => {
  const BRAND = { name: "Aquafix" };

  it("says the channel in the subject, and the reference the operator matches the chat by", () => {
    const mail = defaultLeadMail(BRAND, lead({ channel: "whatsapp", messageRef: "AQ-7K3F" }), 7);
    expect(mail.subject).toBe("Aquafix — WhatsApp lead (royat)");
    const lines = mail.text.split("\n");
    expect(lines[0]).toBe("Lead #7 — place royat — WHATSAPP");
    expect(lines).toContain("Réf.     : AQ-7K3F");
    expect(lines).toContain("Mobile   : (none — answer on WhatsApp)");
    expect(defaultLeadMail(BRAND, lead({ channel: "telegram" }), 8).subject).toBe("Aquafix — Telegram lead (royat)");
  });

  it("prints a phone the visitor did give, and no reference line without one", () => {
    const mail = defaultLeadMail(BRAND, lead({ channel: "whatsapp", mobile: "06 12 34 56 78" }), 9);
    expect(mail.text.split("\n")).toContain("Mobile   : 06 12 34 56 78");
    expect(mail.text).not.toContain("Réf.");
  });
});

describe("a place's messengers", () => {
  it("reads the bot and the panel's switches off the live answer, dropping what does not read", () => {
    expect(parsePlaceLive({ telegram: "@aquafix_devis_bot", messengers: { whatsapp: false, telegram: "yes" } }, ["fr"])).toEqual({
      telegram: "aquafix_devis_bot",
      messengers: { whatsapp: false },
    });
    // Telegram's rule: 5 to 32 characters, a letter first, `bot` last.
    expect(parsePlaceLive({ telegram: "a_bot" }, ["fr"])).toEqual({ telegram: "a_bot" });
    expect(parsePlaceLive({ telegram: `A${"b".repeat(28)}Bot` }, ["fr"])).toEqual({ telegram: `A${"b".repeat(28)}Bot` });
    for (const bot of ["abot", "abcd", "aquafix_devis", "1aquafix_bot", "aquafix devis_bot", `a${"b".repeat(29)}bot`, "", 42]) {
      expect(parsePlaceLive({ telegram: bot }, ["fr"]), String(bot)).toEqual({});
    }
    expect(parsePlaceLive({ messengers: { whatsapp: "off" } }, ["fr"])).toEqual({});
    expect(parsePlaceLive({ messengers: [] }, ["fr"])).toEqual({});
  });

  it("merges the live bot and switches over the baked ones", () => {
    const baked = serviceAreaPlace(["fr"], { channels: { phone: null, whatsapp: "+33612345678", telegram: "baked_devis_bot" }, messengers: { telegram: false } });
    expect(mergeLive(baked, {})).toMatchObject({ channels: { telegram: "baked_devis_bot" }, messengers: { telegram: false } });
    const merged = mergeLive(baked, { telegram: "aquafix_devis_bot", messengers: { whatsapp: false } });
    expect(merged.channels).toEqual({ phone: null, whatsapp: "+33612345678", telegram: "aquafix_devis_bot" });
    expect(merged.messengers).toEqual({ whatsapp: false });
  });

  it("offers only the place's own WhatsApp — never the brand's phone — and nothing the panel switched off", () => {
    const site = { brand: { ...fixtureSite("aquafix").brand, phone: "+33423500640" } };
    const bare = storefrontPlace(["fr"]);
    expect(messengerFacts(site, bare)).toEqual({ whatsapp: null, telegram: null });
    expect(contactOf(site, bare).whatsapp).toBe("+33423500640");
    const own = storefrontPlace(["fr"], { channels: { phone: null, whatsapp: "+33612345678", telegram: "aquafix_devis_bot" } });
    expect(messengerFacts(site, own)).toEqual({ whatsapp: "+33612345678", telegram: "aquafix_devis_bot" });
    expect(messengerFacts(site, { ...own, messengers: { whatsapp: false } })).toEqual({ whatsapp: null, telegram: "aquafix_devis_bot" });
    expect(messengerFacts(site, { ...own, messengers: { telegram: false } })).toEqual({ whatsapp: "+33612345678", telegram: null });
    // The switches are the lead form's only: the header's and the call bar's number stays.
    expect(contactOf(site, { ...own, messengers: { whatsapp: false, telegram: false } })).toEqual({ phone: "+33423500640", whatsapp: "+33612345678" });
  });
});

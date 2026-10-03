import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingRequestedProperties, leadRef, type BookingRequest, type Lead } from "../src/index";
import { bookingRoute } from "../src/next/index";
import { leadWebhook, openSqliteLeadStore, type LeadWebhook } from "../src/server/index";
import { testLead } from "../src/testing/index";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const SIGNING = { prefix: "sa-ingest/v1.", headers: { keyId: "x-sa-key-id", timestamp: "x-sa-timestamp", signature: "x-sa-signature" } };
const URL_ = "http://panel.sa.svc.cluster.local/api/ingest/v1/events";
const NOW = Date.parse("2026-10-04T10:00:00Z");
const SUBMISSION = "0b6c3f9e-1d2a-4c5b-8e7f-9a0b1c2d3e4f";
const PRICED: Partial<Lead> = { flow: "estimate", price: { cents: 8400, validFrom: "2026-10-01" }, submissionId: SUBMISSION };

const hooks: LeadWebhook[] = [];
afterEach(() => {
  for (const h of hooks.splice(0)) h.close();
});

async function stand(options: { panelBooking?: boolean; lead?: Partial<Lead> } = {}) {
  const path = join(mkdtempSync(join(tmpdir(), "kitstart-booking-")), "leads.db");
  const store = openSqliteLeadStore(path);
  const id = await store.insert(testLead({ ...PRICED, ...options.lead }));
  const bodies: { request: BookingRequest; brandId: string }[] = [];
  const hook = leadWebhook(site, { leadsDb: { kind: "sqlite", path }, leadWebhook: { url: URL_, keyId: "k", secret: "s" } }, {
    signing: SIGNING,
    buildBody: () => ({}),
    buildBookingBody: (request, ctx) => {
      bodies.push({ request, brandId: ctx.brandId });
      return { type: "booking.requested", properties: bookingRequestedProperties(request) };
    },
    fetch: vi.fn(async () => new Response(null, { status: 200 })),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...(options.panelBooking === undefined ? {} : { panelBooking: options.panelBooking }),
  });
  if (!hook) throw new Error("expected the webhook on");
  hooks.push(hook);
  const route = bookingRoute({ env: () => ({ leadsDb: { kind: "sqlite", path } }), store: () => store, webhook: () => hook, now: () => NOW, log: { warn: vi.fn(), error: vi.fn() } });
  return { route, hook, bodies, ref: leadRef(id, SUBMISSION) };
}

const post = (body: unknown, type = "application/json") => new Request("https://brand.fr/quote/booking", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("bookingRoute", () => {
  it("queues booking.requested once per lead, under panelBooking", async () => {
    const { route, hook, bodies, ref } = await stand({ panelBooking: true });
    const res = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2026-10-06", preferred_part: "morning" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: true });
    expect(bodies).toEqual([{ request: { leadRef: ref, provider: "manual", preferredDate: "2026-10-06", preferredPart: "morning" }, brandId: "aquafix" }]);
    expect(hook.outbox.rows()).toMatchObject([{ ref: `booking:${ref}`, state: "pending" }]);

    const again = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }));
    expect(await again.json()).toEqual({ ok: true, queued: false });
    expect(hook.outbox.rows()).toHaveLength(1);
  });

  it("answers and queues nothing with the switch off (the default)", async () => {
    const { route, hook, bodies, ref } = await stand();
    const res = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "cal_com" }));
    expect(await res.json()).toEqual({ ok: true, queued: false });
    expect(bodies).toEqual([]);
    expect(hook.outbox.rows()).toEqual([]);
  });

  it("books nothing for a reference the submission id does not prove", async () => {
    const { route, ref } = await stand({ panelBooking: true });
    expect((await route(post({ submission: "1b6c3f9e-1d2a-4c5b-8e7f-9a0b1c2d3e4f", lead_ref: ref, provider: "link" }))).status).toBe(404);
    expect((await route(post({ submission: SUBMISSION, lead_ref: "lead-1-00000000", provider: "link" }))).status).toBe(404);
    expect((await route(post({ lead_ref: ref, provider: "link" }))).status).toBe(422);
  });

  it("books only a priced lead", async () => {
    const { route, ref } = await stand({ panelBooking: true, lead: { flow: "quote" } });
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }))).status).toBe(409);
  });

  it("refuses what is not booking.requested, or not JSON", async () => {
    const { route, ref } = await stand({ panelBooking: true });
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "link", preferred_part: "morning" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", note: "free text" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2026-09-01" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2028-10-01" }))).status).toBe(422);
    expect((await route(post("submission=x", "application/x-www-form-urlencoded"))).status).toBe(415);
    expect((await route(post("{not json"))).status).toBe(400);
    expect((await route(post({ submission: SUBMISSION, pad: "x".repeat(5000) }))).status).toBe(413);
  });
});
